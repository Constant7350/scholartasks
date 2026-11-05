-- Free school portal, phase 1 (database update 37).
--
-- Schools sign up for free; the ScholarTasks team approves each school before
-- anyone there can see a student. Families choose to connect a student to a
-- school with the school's code and pick what to share. The school never
-- uploads student records in phase 1, and every look at the caseload is
-- written to the audit log.
--
-- No AI runs in the school portal. A school-wide AI allowance can be switched
-- on later per school (schools.ai_plan) once AI packages for schools are priced.

-- ---------- Schools and staff ----------

create table if not exists schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 3 and 200),
  city          text not null check (length(trim(city)) between 2 and 100),
  state         char(2) not null check (state ~ '^[A-Z]{2}$'),
  website       text check (website is null or website ~* '^https?://'),
  phone         text check (phone is null or length(phone) <= 40),
  -- Families type this to connect a student. Staff type staff_code to join the school.
  join_code     text not null unique,
  staff_code    text not null unique,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'closed')),
  -- Reserved for later: AI packages for schools. 'none' = students use their own family plan.
  ai_plan       text not null default 'none' check (ai_plan in ('none', 'school_ai')),
  created_by    uuid not null,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists school_staff (
  school_id   uuid not null references schools(id) on delete cascade,
  user_id     uuid not null,
  role        text not null check (role in ('admin', 'counselor')),
  full_name   text not null check (length(trim(full_name)) between 2 and 120),
  job_title   text check (job_title is null or length(job_title) <= 120),
  added_at    timestamptz not null default now(),
  primary key (school_id, user_id)
);
create index if not exists school_staff_user on school_staff (user_id);

-- ---------- Family-approved links between a student and a school ----------

create table if not exists school_links (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  -- 'progress' = on-track signals only; 'progress_grades' adds the HOPE GPA and course grades.
  share       text not null default 'progress' check (share in ('progress', 'progress_grades')),
  status      text not null default 'active' check (status in ('pending_parent', 'active', 'ended')),
  -- The spring the student finishes high school; the link stops showing after June 30 that year.
  class_of    int not null check (class_of between 2000 and 2100),
  linked_by   uuid not null,
  approved_by uuid,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  unique (school_id, student_id)
);
create index if not exists school_links_student on school_links (student_id);

create table if not exists school_messages (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  sent_by     uuid not null,
  grades      int[] not null default '{}',
  subject     text not null check (length(trim(subject)) between 2 and 150),
  body        text not null check (length(trim(body)) between 2 and 3000),
  recipients  int not null default 0,
  sent_at     timestamptz not null default now()
);
create index if not exists school_messages_school on school_messages (school_id, sent_at desc);

-- Local scholarships a counselor posts show only to that school's connected students.
alter table scholarships add column if not exists school_id uuid references schools(id) on delete cascade;

-- ---------- Helpers ----------

create or replace function school_year_end(d date default current_date) returns int
language sql immutable as $$
  select (extract(year from d)::int + case when extract(month from d) >= 7 then 1 else 0 end);
$$;

create or replace function is_school_staff(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_staff ss join schools s on s.id = ss.school_id
                 where ss.school_id = p_school and ss.user_id = auth.uid() and s.status = 'approved');
$$;

create or replace function is_school_admin(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_staff where school_id = p_school and user_id = auth.uid() and role = 'admin');
$$;

-- Schools the signed-in person's students are connected to (for local scholarships).
create or replace function my_linked_school_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.school_id from school_links l
   where l.status = 'active' and l.class_of >= school_year_end()
     and (can_parent_see_student(l.student_id) or is_student_self(l.student_id));
$$;

create or replace function new_school_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
          from (select gen_random_bytes(8) as b) r, generate_series(0, 7) as i);
    exit when not exists (select 1 from schools where join_code = c or staff_code = c);
  end loop;
  return c;
end $$;

-- ---------- Row-level security ----------

alter table schools         enable row level security;
alter table school_staff    enable row level security;
alter table school_links    enable row level security;
alter table school_messages enable row level security;

drop policy if exists schools_staff_read on schools;
drop policy if exists schools_admin on schools;
create policy schools_staff_read on schools for select to authenticated
  using (exists (select 1 from school_staff where school_staff.school_id = schools.id and school_staff.user_id = auth.uid()) or is_app_admin());
create policy schools_admin on schools for update to authenticated using (is_app_admin()) with check (is_app_admin());

drop policy if exists school_staff_read on school_staff;
create policy school_staff_read on school_staff for select to authenticated
  using (user_id = auth.uid() or is_school_staff(school_id) or is_app_admin());

-- Families see their own links (and the school's name through school_lookup).
drop policy if exists school_links_family on school_links;
create policy school_links_family on school_links for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id));

drop policy if exists school_messages_read on school_messages;
create policy school_messages_read on school_messages for select to authenticated
  using (is_school_staff(school_id) or school_id in (select my_linked_school_ids()));

grant select on schools, school_staff, school_links, school_messages to authenticated;
grant update on schools to authenticated;

-- Local scholarships: only that school's families (and staff, and our team) see them.
drop policy if exists scholarships_read on scholarships;
create policy scholarships_read on scholarships for select to authenticated using (
  is_app_admin()
  or (status <> 'retired' and (school_id is null
       or school_id in (select my_linked_school_ids())
       or is_school_staff(school_id)))
);

drop trigger if exists audit_school_links on school_links;
create trigger audit_school_links after insert or update or delete on school_links
  for each row execute function audit_row_change();

-- ---------- Schools sign up, team approves ----------

create or replace function create_school(p_name text, p_city text, p_state text, p_website text,
                                         p_phone text, p_full_name text, p_job_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if (select count(*) from school_staff where user_id = auth.uid()) >= 5 then
    raise exception 'You are already on 5 schools.';
  end if;
  insert into schools (name, city, state, website, phone, join_code, staff_code, created_by)
  values (trim(p_name), trim(p_city), upper(trim(p_state)), nullif(trim(coalesce(p_website, '')), ''),
          nullif(trim(coalesce(p_phone, '')), ''), new_school_code(), new_school_code(), auth.uid())
  returning id into sid;
  insert into school_staff (school_id, user_id, role, full_name, job_title)
  values (sid, auth.uid(), 'admin', trim(p_full_name), nullif(trim(coalesce(p_job_title, '')), ''));
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'school_signup', 'schools', sid::text, jsonb_build_object('name', trim(p_name)));
  return sid;
end $$;

create or replace function review_school(p_school uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('approved', 'closed', 'pending') then raise exception 'unknown status'; end if;
  update schools set status = p_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_school;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'school_review', 'schools', p_school::text, jsonb_build_object('status', p_status));
end $$;

-- For the team review page: who signed each school up, with their sign-in email.
create or replace function schools_for_review()
returns table (id uuid, name text, city text, state text, website text, phone text, status text,
               created_at timestamptz, staff jsonb, students int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  return query
    select s.id, s.name, s.city, s.state::text, s.website, s.phone, s.status, s.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('name', ss.full_name, 'title', ss.job_title,
                                                         'role', ss.role, 'email', u.email) order by ss.added_at)
                     from school_staff ss left join auth.users u on u.id = ss.user_id
                     where ss.school_id = s.id), '[]'::jsonb),
           (select count(*)::int from school_links l where l.school_id = s.id and l.status = 'active')
      from schools s
     order by (s.status = 'pending') desc, s.created_at desc;
end $$;

create or replace function join_school_staff(p_code text, p_full_name text, p_job_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into sid from schools where staff_code = upper(trim(p_code)) and status <> 'closed';
  if sid is null then raise exception 'That staff code is not right. Ask the person who set up your school.'; end if;
  insert into school_staff (school_id, user_id, role, full_name, job_title)
  values (sid, auth.uid(), 'counselor', trim(p_full_name), nullif(trim(coalesce(p_job_title, '')), ''))
  on conflict (school_id, user_id) do nothing;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'school_staff_join', 'schools', sid::text, '{}'::jsonb);
  return sid;
end $$;

create or replace function remove_school_staff(p_school uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_school_admin(p_school) or p_user = auth.uid()) then raise exception 'not allowed'; end if;
  if (select role from school_staff where school_id = p_school and user_id = p_user) = 'admin'
     and (select count(*) from school_staff where school_id = p_school and role = 'admin') = 1 then
    raise exception 'A school needs at least one admin. Make someone else an admin first.';
  end if;
  delete from school_staff where school_id = p_school and user_id = p_user;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'school_staff_remove', 'schools', p_school::text, jsonb_build_object('user', p_user));
end $$;

create or replace function set_school_staff_role(p_school uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  if p_role not in ('admin', 'counselor') then raise exception 'unknown role'; end if;
  if p_role = 'counselor' and (select count(*) from school_staff where school_id = p_school and role = 'admin') = 1
     and (select role from school_staff where school_id = p_school and user_id = p_user) = 'admin' then
    raise exception 'A school needs at least one admin. Make someone else an admin first.';
  end if;
  update school_staff set role = p_role where school_id = p_school and user_id = p_user;
end $$;

create or replace function new_school_codes(p_school uuid, p_which text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  if p_which = 'join' then update schools set join_code = new_school_code() where id = p_school;
  elsif p_which = 'staff' then update schools set staff_code = new_school_code() where id = p_school;
  else raise exception 'unknown code'; end if;
end $$;

-- ---------- Families connect a student ----------

-- What a family sees before connecting: the school's name and town, only for approved schools.
create or replace function school_lookup(p_code text)
returns table (id uuid, name text, city text, state text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.city, s.state::text from schools s
   where s.join_code = upper(trim(p_code)) and s.status = 'approved';
$$;

create or replace function link_student_to_school(p_student uuid, p_code text, p_share text) returns text
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; st students; is_parent boolean; adult boolean; new_status text; cls int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_share not in ('progress', 'progress_grades') then raise exception 'unknown share choice'; end if;
  select * into st from students where id = p_student;
  is_parent := can_parent_see_student(p_student);
  if st.id is null or not (is_parent or is_student_self(p_student)) then raise exception 'not allowed'; end if;
  select id into sid from schools where join_code = upper(trim(p_code)) and status = 'approved';
  if sid is null then raise exception 'That school code is not right, or the school is not set up yet.'; end if;
  adult := age(current_date, st.birth_date) >= interval '18 years';
  -- A student under 18 can ask; a parent approves before the school sees anything.
  new_status := case when is_parent or adult then 'active' else 'pending_parent' end;
  cls := school_year_end() + greatest(0, 12 - st.grade_level);
  insert into school_links (school_id, student_id, share, status, class_of, linked_by, approved_by)
  values (sid, p_student, p_share, new_status, cls, auth.uid(), case when new_status = 'active' then auth.uid() end)
  on conflict (school_id, student_id) do update
    set share = excluded.share, status = excluded.status, class_of = excluded.class_of,
        linked_by = excluded.linked_by, approved_by = excluded.approved_by, ended_at = null;
  return new_status;
end $$;

create or replace function approve_school_link(p_link uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l school_links;
begin
  select * into l from school_links where id = p_link;
  if l.id is null or not can_parent_see_student(l.student_id) then raise exception 'not allowed'; end if;
  update school_links set status = 'active', approved_by = auth.uid() where id = p_link;
end $$;

create or replace function set_school_link_share(p_link uuid, p_share text) returns void
language plpgsql security definer set search_path = public as $$
declare l school_links; adult boolean;
begin
  if p_share not in ('progress', 'progress_grades') then raise exception 'unknown share choice'; end if;
  select * into l from school_links where id = p_link;
  if l.id is null then raise exception 'not allowed'; end if;
  select age(current_date, birth_date) >= interval '18 years' into adult from students where id = l.student_id;
  -- Parents can change it; students 18+ can too. Younger students can only share less.
  if not (can_parent_see_student(l.student_id)
          or (is_student_self(l.student_id) and (adult or p_share = 'progress'))) then
    raise exception 'not allowed';
  end if;
  update school_links set share = p_share where id = p_link;
end $$;

-- Parents, the student, or the school's staff can stop the sharing at any time.
create or replace function end_school_link(p_link uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l school_links;
begin
  select * into l from school_links where id = p_link;
  if l.id is null or not (can_parent_see_student(l.student_id) or is_student_self(l.student_id)
                          or is_school_staff(l.school_id)) then
    raise exception 'not allowed';
  end if;
  update school_links set status = 'ended', ended_at = now() where id = p_link;
end $$;

-- A family's school connections, with the school's name.
create or replace function my_school_links()
returns table (id uuid, student_id uuid, school_id uuid, school_name text, city text, state text,
               share text, status text, class_of int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.student_id, s.id, s.name, s.city, s.state::text, l.share, l.status, l.class_of, l.created_at
    from school_links l join schools s on s.id = l.school_id
   where l.status <> 'ended' and l.class_of >= school_year_end()
     and (can_parent_see_student(l.student_id) or is_student_self(l.student_id))
   order by l.created_at;
$$;

-- ---------- The counselor's caseload ----------

-- One row per connected student, with only what the family chose to share.
-- Every call is written to the audit log.
create or replace function school_caseload(p_school uuid)
returns table (
  link_id uuid, student_id uuid, first_name text, grade_level int, class_of int, share text, linked_at timestamptz,
  colleges int, applying int, submitted int, accepted int,
  fafsa_submitted boolean, aid_steps_done int,
  scholarships_saved int, tasks_overdue int, tasks_next_14 int,
  sat int, act int, last_active date, grades jsonb
)
language plpgsql security definer set search_path = public as $$
declare v_cycle text;
begin
  if not is_school_staff(p_school) then raise exception 'not allowed'; end if;
  -- The FAFSA year a senior files during this school year, e.g. '2027-28' in 2026-27.
  v_cycle := school_year_end()::text || '-' || lpad(((school_year_end() + 1) % 100)::text, 2, '0');

  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'view', 'school_caseload', p_school::text,
          jsonb_build_object('students', (select count(*) from school_links
                                          where school_id = p_school and status = 'active')));

  return query
    select l.id, st.id, st.first_name, st.grade_level, l.class_of, l.share, l.created_at,
           (select count(*)::int from student_colleges c where c.student_id = st.id),
           (select count(*)::int from student_colleges c where c.student_id = st.id and c.status = 'applying'),
           (select count(*)::int from student_colleges c where c.student_id = st.id
              and c.status in ('submitted', 'accepted', 'waitlisted', 'denied', 'deferred', 'enrolled')),
           (select count(*)::int from student_colleges c where c.student_id = st.id and c.status in ('accepted', 'enrolled')),
           exists (select 1 from aid_progress a where a.student_id = st.id and a.step_id = 'fafsa-submitted'
                     and a.status = 'done' and a.cycle = v_cycle),
           (select count(*)::int from aid_progress a where a.student_id = st.id and a.status = 'done' and a.cycle = v_cycle),
           (select count(*)::int from scholarship_choices sc where sc.student_id = st.id and sc.choice = 'added'),
           (select count(*)::int from tasks t where t.student_id = st.id and t.status = 'todo' and t.due_on < current_date),
           (select count(*)::int from tasks t where t.student_id = st.id and t.status = 'todo'
              and t.due_on between current_date and current_date + 14),
           st.sat, st.act,
           (select max(d.day) from student_progress_days d where d.student_id = st.id),
           case when l.share = 'progress_grades' then
             coalesce((select jsonb_agg(jsonb_build_object('term', g.term, 'course', g.course, 'grade', g.grade,
                                                           'level', g.level, 'core', g.core, 'grade_level', g.grade_level))
                       from course_grades g where g.student_id = st.id), '[]'::jsonb)
           end
      from school_links l join students st on st.id = l.student_id
     where l.school_id = p_school and l.status = 'active' and l.class_of >= school_year_end()
     order by st.grade_level desc, st.first_name;
end $$;

-- Pending connections a parent still has to approve (counts only, no names).
create or replace function school_pending_count(p_school uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when is_school_staff(p_school)
    then (select count(*)::int from school_links where school_id = p_school and status = 'pending_parent') end;
$$;

-- ---------- Messages to connected families (sent by the server) ----------

-- Saves the message and returns the email addresses to send it to: each connected
-- student's own sign-in and their parents'. Called only by the server after it has
-- checked who is signed in.
create or replace function school_message_recipients(p_school uuid, p_user uuid, p_grades int[],
                                                     p_subject text, p_body text)
returns table (email text) language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if not exists (select 1 from school_staff ss join schools s on s.id = ss.school_id
                 where ss.school_id = p_school and ss.user_id = p_user and s.status = 'approved') then
    raise exception 'not allowed';
  end if;
  if (select count(*) from school_messages where school_id = p_school and sent_at > now() - interval '1 day') >= 10 then
    raise exception 'Your school has sent 10 messages today. Please wait until tomorrow.';
  end if;
  insert into school_messages (school_id, sent_by, grades, subject, body)
  values (p_school, p_user, coalesce(p_grades, '{}'), trim(p_subject), trim(p_body)) returning id into mid;

  drop table if exists _msg_to;
  create temporary table _msg_to (email text) on commit drop;
  insert into _msg_to
    select distinct lower(u.email)
      from school_links l
      join students st on st.id = l.student_id
      join family_members m on m.family_id = st.family_id
                           and (m.student_id = st.id or (m.role = 'parent' and coalesce(st.adult_consents_parent_access, true)))
      join auth.users u on u.id = m.user_id
     where l.school_id = p_school and l.status = 'active' and l.class_of >= school_year_end()
       and (cardinality(coalesce(p_grades, '{}')) = 0 or st.grade_level = any (p_grades))
       and u.email is not null;

  update school_messages set recipients = (select count(*) from _msg_to) where id = mid;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (p_user, 'school_message', 'school_messages', mid::text,
          jsonb_build_object('school', p_school, 'recipients', (select count(*) from _msg_to)));
  return query select t.email from _msg_to t;
end $$;

-- ---------- Local scholarships posted by a counselor ----------

-- Goes to the ScholarTasks team review like any other new scholarship.
create or replace function school_post_scholarship(p_school uuid, p_name text, p_url text, p_summary text,
                                                   p_amount_text text, p_amount_max int, p_deadline date,
                                                   p_how_to_apply text, p_grades int[])
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; sname text; sstate text;
begin
  if not is_school_staff(p_school) then raise exception 'not allowed'; end if;
  select name, state into sname, sstate from schools where id = p_school;
  insert into scholarships (kind, name, sponsor, url, summary, how_to_apply, amount_text, amount_max,
                            deadline, scope, grades, status, school_id)
  values ('scholarship', trim(p_name) || ' (' || sname || ')', sname, trim(p_url), trim(p_summary),
          nullif(trim(coalesce(p_how_to_apply, '')), ''), trim(p_amount_text), p_amount_max,
          p_deadline, sstate, coalesce(nullif(p_grades, '{}'), '{12}'), 'pending', p_school)
  returning id into sid;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'school_scholarship', 'scholarships', sid::text, jsonb_build_object('school', p_school));
  return sid;
end $$;

create or replace function school_scholarships(p_school uuid)
returns table (id uuid, name text, amount_text text, deadline date, status text, url text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.amount_text, s.deadline, s.status, s.url from scholarships s
   where s.school_id = p_school and is_school_staff(p_school)
   order by s.created_at desc;
$$;

-- ---------- Grants ----------

revoke all on function create_school(text, text, text, text, text, text, text) from public, anon;
revoke all on function review_school(uuid, text) from public, anon;
revoke all on function schools_for_review() from public, anon;
revoke all on function join_school_staff(text, text, text) from public, anon;
revoke all on function remove_school_staff(uuid, uuid) from public, anon;
revoke all on function set_school_staff_role(uuid, uuid, text) from public, anon;
revoke all on function new_school_codes(uuid, text) from public, anon;
revoke all on function school_lookup(text) from public, anon;
revoke all on function link_student_to_school(uuid, text, text) from public, anon;
revoke all on function approve_school_link(uuid) from public, anon;
revoke all on function set_school_link_share(uuid, text) from public, anon;
revoke all on function end_school_link(uuid) from public, anon;
revoke all on function my_school_links() from public, anon;
revoke all on function school_caseload(uuid) from public, anon;
revoke all on function school_pending_count(uuid) from public, anon;
revoke all on function school_post_scholarship(uuid, text, text, text, text, int, date, text, int[]) from public, anon;
revoke all on function school_scholarships(uuid) from public, anon;
revoke all on function new_school_code() from public, anon, authenticated;

grant execute on function create_school(text, text, text, text, text, text, text) to authenticated;
grant execute on function review_school(uuid, text) to authenticated;
grant execute on function schools_for_review() to authenticated;
grant execute on function join_school_staff(text, text, text) to authenticated;
grant execute on function remove_school_staff(uuid, uuid) to authenticated;
grant execute on function set_school_staff_role(uuid, uuid, text) to authenticated;
grant execute on function new_school_codes(uuid, text) to authenticated;
grant execute on function school_lookup(text) to authenticated;
grant execute on function link_student_to_school(uuid, text, text) to authenticated;
grant execute on function approve_school_link(uuid) to authenticated;
grant execute on function set_school_link_share(uuid, text) to authenticated;
grant execute on function end_school_link(uuid) to authenticated;
grant execute on function my_school_links() to authenticated;
grant execute on function school_caseload(uuid) to authenticated;
grant execute on function school_pending_count(uuid) to authenticated;
grant execute on function school_post_scholarship(uuid, text, text, text, text, int, date, text, int[]) to authenticated;
grant execute on function school_scholarships(uuid) to authenticated;
grant execute on function is_school_staff(uuid) to authenticated;
grant execute on function my_linked_school_ids() to authenticated;

revoke all on function school_message_recipients(uuid, uuid, int[], text, text) from public, anon, authenticated;
grant execute on function school_message_recipients(uuid, uuid, int[], text, text) to service_role;
