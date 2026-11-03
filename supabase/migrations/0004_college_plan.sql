-- College list, scholarships and deadlines, plus email reminder bookkeeping.
-- Parents manage everything for their students. Students manage their own
-- list; if their parent hasn't allowed "change the plan without approval",
-- what they add waits for the parent's OK.

create table student_colleges (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 200),
  plan          text not null default 'RD' check (plan in ('ED','ED2','EA','REA','RD','rolling','priority')),
  deadline      date,
  status        text not null default 'considering'
                check (status in ('considering','applying','submitted','accepted','waitlisted','denied','deferred','enrolled','withdrawn')),
  notes         text check (length(notes) <= 2000),
  approved      boolean not null default true,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index student_colleges_student on student_colleges (student_id);

-- Deadlines that aren't a college application: scholarships, aid forms, tests, anything else.
alter table tasks
  add column kind        text not null default 'other' check (kind in ('scholarship','aid','test','college','other')),
  add column college_id  uuid references student_colleges(id) on delete cascade,
  add column url         text check (url is null or url ~* '^https?://'),
  add column amount      int  check (amount is null or amount between 0 and 1000000),
  add column notes       text check (length(notes) <= 2000),
  add column created_by  uuid default auth.uid();
alter table tasks add constraint tasks_title_len check (length(trim(title)) between 1 and 300);
create index tasks_student_due on tasks (student_id, due_on);

alter table student_colleges enable row level security;

create policy colleges_parent on student_colleges for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy colleges_self_read on student_colleges for select using (is_student_self(student_id));
-- Without permission, a student's additions and edits wait for the parent's approval.
create policy colleges_self_insert on student_colleges for insert
  with check (is_student_self(student_id)
              and (approved = false or student_may(student_id, 'change_plan_without_approval')));
create policy colleges_self_update on student_colleges for update using (is_student_self(student_id))
  with check (is_student_self(student_id)
              and (approved = false or student_may(student_id, 'change_plan_without_approval')));
create policy colleges_self_delete on student_colleges for delete
  using (is_student_self(student_id) and (created_by = auth.uid() or student_may(student_id, 'change_plan_without_approval')));

-- Students can add their own deadlines and remove the ones they added.
create policy tasks_self_insert on tasks for insert
  with check (is_student_self(student_id) and status in ('todo','needs_parent_approval'));
create policy tasks_self_delete on tasks for delete
  using (is_student_self(student_id) and created_by = auth.uid());

create trigger audit_student_colleges after insert or update or delete on student_colleges
  for each row execute function audit_row_change();

-- ---------- Email reminders ----------

create table user_settings (
  user_id          uuid primary key default auth.uid(),
  email_reminders  boolean not null default true,
  updated_at       timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy settings_self on user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One row per reminder sent, so the daily job never sends the same one twice.
create table reminder_log (
  user_id      uuid not null,
  item_type    text not null check (item_type in ('task','college')),
  item_id      uuid not null,
  days_before  int  not null,
  sent_at      timestamptz not null default now(),
  primary key (user_id, item_type, item_id, days_before)
);
alter table reminder_log enable row level security;  -- no policies: only the server job reads or writes it

-- What the daily job should send today: every open deadline that is exactly
-- 30, 14, 7, 2, 1 or 0 days away, for each parent (and the connected student)
-- who hasn't turned reminders off. Only the server (service role) may call it.
create or replace function reminders_due(p_today date)
returns table (user_id uuid, email text, student_first_name text, item_type text, item_id uuid,
               title text, due_on date, days_before int, url text)
language sql stable security definer set search_path = public as $$
  with items as (
    select 'task'::text as item_type, t.id as item_id, t.student_id, t.title, t.due_on, t.url
      from tasks t where t.due_on is not null and t.status in ('todo','needs_parent_approval')
    union all
    select 'college', c.id, c.student_id, c.name || ' application (' || c.plan || ')', c.deadline, null
      from student_colleges c where c.deadline is not null and c.status in ('considering','applying') and c.approved
  ),
  due as (
    select i.*, (i.due_on - p_today) as days_before from items i
     where (i.due_on - p_today) in (30, 14, 7, 2, 1, 0)
  ),
  recipients as (
    select d.*, m.user_id
      from due d join students s on s.id = d.student_id
      join family_members m on m.family_id = s.family_id
     where (m.role = 'parent' and coalesce(s.adult_consents_parent_access, true))
        or (m.role = 'student' and m.student_id = d.student_id)
  )
  select r.user_id, u.email::text, s.first_name, r.item_type, r.item_id, r.title, r.due_on, r.days_before, r.url
    from recipients r
    join auth.users u on u.id = r.user_id
    join students s on s.id = r.student_id
    left join user_settings us on us.user_id = r.user_id
   where coalesce(us.email_reminders, true)
     and u.email is not null
     and not exists (select 1 from reminder_log l where l.user_id = r.user_id and l.item_type = r.item_type
                                                   and l.item_id = r.item_id and l.days_before = r.days_before);
$$;

create or replace function mark_reminder_sent(p_user uuid, p_item_type text, p_item uuid, p_days int)
returns void language sql security definer set search_path = public as $$
  insert into reminder_log (user_id, item_type, item_id, days_before) values (p_user, p_item_type, p_item, p_days)
  on conflict do nothing;
$$;

-- Parent approves (or keeps) something a student added.
create or replace function approve_college(p_college uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from student_colleges c where c.id = p_college and can_parent_see_student(c.student_id)) then
    raise exception 'not allowed';
  end if;
  update student_colleges set approved = true where id = p_college;
end $$;

-- ---------- Grants (new tables are not exposed automatically) ----------

grant select, insert, update, delete on student_colleges to authenticated;
grant select, insert, update on user_settings to authenticated;
grant execute on function approve_college(uuid) to authenticated;
revoke execute on function reminders_due(date), mark_reminder_sent(uuid, text, uuid, int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function reminders_due(date), mark_reminder_sent(uuid, text, uuid, int) to service_role';
  end if;
end $$;
