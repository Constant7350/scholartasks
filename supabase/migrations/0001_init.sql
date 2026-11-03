-- ScholarTasks initial schema (Supabase / PostgreSQL 15+).
-- Principles: the parent owns the family account; students see only what
-- parents allow; every change to a child's data lands in a tamper-evident,
-- append-only audit log.

-- On Supabase pgcrypto already lives in the "extensions" schema; functions
-- that use it set search_path = public, extensions.
create extension if not exists pgcrypto;

-- ---------- Families and members ----------

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'trial' check (plan in ('trial','monthly','annual','senior_pass','school')),
  created_at  timestamptz not null default now()
);

create table students (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  first_name    text not null,
  birth_date    date not null,
  grade_level   int  not null check (grade_level between 6 and 12),
  state         char(2) not null,
  sat           int  check (sat between 400 and 1600),
  act           int  check (act between 1 and 36),
  income_band   text check (income_band in ('under_30k','30_60k','60_110k','110_200k','over_200k','prefer_not')),
  -- Parent-controlled permissions for the student's own app (see build spec).
  permissions   jsonb not null default '{
    "enter_grades": true,
    "ai_chat": true,
    "see_income_and_costs": false,
    "mark_done_without_approval": true,
    "change_plan_without_approval": false
  }'::jsonb,
  -- Set when a student turns 18 and decides whether parents keep access.
  adult_consents_parent_access boolean,
  created_at    timestamptz not null default now()
);

create table family_members (
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null,
  role        text not null check (role in ('parent','student')),
  student_id  uuid references students(id) on delete cascade,
  primary key (family_id, user_id),
  check ((role = 'student') = (student_id is not null))
);

create table course_grades (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  term         text not null,
  course       text not null,
  grade        char(1) not null check (grade in ('A','B','C','D','F')),
  level        text not null check (level in ('standard','honors','AP','IB','DE')),
  core         boolean not null,
  grade_level  int not null check (grade_level between 6 and 12),
  created_at   timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  deadline_id  text,
  title        text not null,
  due_on       date,
  status       text not null default 'todo' check (status in ('todo','done','needs_parent_approval','dismissed')),
  created_at   timestamptz not null default now()
);

-- ---------- Access helpers ----------

create or replace function is_parent_of_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members m
                 where m.family_id = f and m.user_id = auth.uid() and m.role = 'parent');
$$;

-- A parent can see a student unless the student is 18+ and declined parent access.
create or replace function can_parent_see_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students st
                 where st.id = s and is_parent_of_family(st.family_id)
                   and coalesce(st.adult_consents_parent_access, true));
$$;

create or replace function is_student_self(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members m
                 where m.student_id = s and m.user_id = auth.uid() and m.role = 'student');
$$;

create or replace function student_may(s uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_student_self(s)
     and coalesce((select (permissions ->> perm)::boolean from students where id = s), false);
$$;

-- ---------- Row-level security ----------

alter table families       enable row level security;
alter table family_members enable row level security;
alter table students       enable row level security;
alter table course_grades  enable row level security;
alter table tasks          enable row level security;

create policy families_parent on families for all
  using (is_parent_of_family(id)) with check (is_parent_of_family(id));
create policy families_member_read on families for select
  using (exists (select 1 from family_members m where m.family_id = id and m.user_id = auth.uid()));

create policy members_parent on family_members for all
  using (is_parent_of_family(family_id)) with check (is_parent_of_family(family_id));
create policy members_self_read on family_members for select using (user_id = auth.uid());

-- Students read their own record but cannot change permissions or billing.
create policy students_parent on students for all
  using (can_parent_see_student(id)) with check (is_parent_of_family(family_id));
create policy students_self_read on students for select using (is_student_self(id));

create policy grades_parent on course_grades for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy grades_self_read on course_grades for select using (is_student_self(student_id));
create policy grades_self_write on course_grades for insert with check (student_may(student_id, 'enter_grades'));
create policy grades_self_update on course_grades for update
  using (student_may(student_id, 'enter_grades')) with check (student_may(student_id, 'enter_grades'));

create policy tasks_parent on tasks for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy tasks_self_read on tasks for select using (is_student_self(student_id));
create policy tasks_self_update on tasks for update using (is_student_self(student_id))
  with check (is_student_self(student_id)
              and (status <> 'done' or student_may(student_id, 'mark_done_without_approval')));

-- ---------- Audit log: append-only and hash-chained ----------

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default clock_timestamp(),
  actor_id    uuid,
  family_id   uuid,
  student_id  uuid,
  action      text not null,          -- insert | update | delete | view | export | support_access | consent ...
  target      text not null,          -- table or resource name
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  prev_hash   text not null,
  hash        text not null
);
create index audit_log_family on audit_log (family_id, at);

-- Each entry's hash covers its content and the previous entry's hash, so any
-- edited or deleted row breaks the chain (see verify_audit_chain).
create or replace function audit_log_chain() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare last text;
begin
  perform pg_advisory_xact_lock(hashtext('audit_log_chain'));
  select hash into last from audit_log order by id desc limit 1;
  new.prev_hash := coalesce(last, 'genesis');
  new.hash := encode(digest(
    new.prev_hash || '|' || new.at::text || '|' || coalesce(new.actor_id::text,'') || '|' ||
    coalesce(new.family_id::text,'') || '|' || coalesce(new.student_id::text,'') || '|' ||
    new.action || '|' || new.target || '|' || coalesce(new.target_id,'') || '|' || new.details::text,
    'sha256'), 'hex');
  return new;
end $$;
create trigger audit_log_chain before insert on audit_log for each row execute function audit_log_chain();

create or replace function audit_log_block_changes() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_block_changes();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_block_changes();

create or replace function verify_audit_chain() returns table (broken_at bigint)
language sql stable set search_path = public, extensions as $$
  select id from (
    select id, prev_hash, lag(hash) over (order by id) as expected,
           hash, encode(digest(prev_hash || '|' || at::text || '|' || coalesce(actor_id::text,'') || '|' ||
             coalesce(family_id::text,'') || '|' || coalesce(student_id::text,'') || '|' ||
             action || '|' || target || '|' || coalesce(target_id,'') || '|' || details::text, 'sha256'), 'hex') as recomputed
    from audit_log) t
  where prev_hash <> coalesce(expected, 'genesis') or hash <> recomputed;
$$;

alter table audit_log enable row level security;
-- Parents read their family's log; nobody writes to it directly.
create policy audit_parent_read on audit_log for select using (is_parent_of_family(family_id));

-- Records every insert/update/delete on a child's data with who did it.
create or replace function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  sid uuid;
  fid uuid;
begin
  sid := case when tg_table_name = 'students' then (rec ->> 'id')::uuid else (rec ->> 'student_id')::uuid end;
  fid := case when tg_table_name in ('students','family_members') then (rec ->> 'family_id')::uuid
              else (select family_id from students where id = sid) end;
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), fid, sid, lower(tg_op), tg_table_name, coalesce(rec ->> 'id', rec ->> 'user_id'),
          case tg_op when 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
                     else jsonb_build_object('row', rec) end);
  return coalesce(new, old);
end $$;

create trigger audit_students       after insert or update or delete on students       for each row execute function audit_row_change();
create trigger audit_family_members after insert or update or delete on family_members for each row execute function audit_row_change();
create trigger audit_course_grades  after insert or update or delete on course_grades  for each row execute function audit_row_change();
create trigger audit_tasks          after insert or update or delete on tasks          for each row execute function audit_row_change();

-- ---------- App-level events the database can't see by itself ----------

-- Views, exports and staff support access are logged by the app through this call.
create or replace function log_access(p_student uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_action not in ('view','export','support_access','share_with_school') then
    raise exception 'unknown access action %', p_action;
  end if;
  if not (can_parent_see_student(p_student) or is_student_self(p_student)) then
    raise exception 'not allowed';
  end if;
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  select auth.uid(), family_id, id, p_action, 'students', id::text, p_details from students where id = p_student;
end $$;

-- A student who is 18 or older decides whether parents keep access.
create or replace function set_adult_consent(p_student uuid, p_consent boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_student_self(p_student) then raise exception 'not allowed'; end if;
  if (select age(current_date, birth_date) < interval '18 years' from students where id = p_student) then
    raise exception 'student must be 18 or older';
  end if;
  update students set adult_consents_parent_access = p_consent where id = p_student;
end $$;
