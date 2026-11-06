-- Apply to scholarships inside the app (database update 51).
--
-- 1. scholarship_applications: one workspace per student per saved award. The
--    form questions and answers, papers to gather, letter writers, when it was
--    sent and what happened. Only the family sees it.
-- 2. school_scholarship_submissions: for a school's own local scholarship
--    (posted in the school portal), the student can send the application to the
--    school inside the app. The family chooses exactly what goes in the packet,
--    and only that school's counselors can read it. Every send, look and
--    decision is written to the audit log. Nothing else is ever shared with a
--    school this way.

create table if not exists scholarship_applications (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  status         text not null default 'getting_ready' check (status in ('getting_ready', 'submitted', 'won', 'not_won')),
  -- [{q, a, limit}]: the questions the form asks and the student's answers.
  answers        jsonb not null default '[]' check (jsonb_typeof(answers) = 'array' and length(answers::text) <= 60000),
  -- [{name, done, link}]: transcript, resume, FAFSA page...
  docs           jsonb not null default '[]' check (jsonb_typeof(docs) = 'array' and length(docs::text) <= 10000),
  -- [{name, email, role, asked_on, received}]
  recommenders   jsonb not null default '[]' check (jsonb_typeof(recommenders) = 'array' and length(recommenders::text) <= 10000),
  submitted_on   date,
  confirmation   text check (confirmation is null or length(confirmation) <= 200),
  heard_on       date,
  amount_won     int check (amount_won is null or amount_won between 0 and 1000000),
  thanked        boolean not null default false,
  notes          text check (notes is null or length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, scholarship_id)
);
create index if not exists scholarship_applications_student on scholarship_applications (student_id);

alter table scholarship_applications enable row level security;
drop policy if exists applications_parent on scholarship_applications;
drop policy if exists applications_self on scholarship_applications;
create policy applications_parent on scholarship_applications for all to authenticated
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy applications_self on scholarship_applications for all to authenticated
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on scholarship_applications to authenticated;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists scholarship_applications_touch on scholarship_applications;
create trigger scholarship_applications_touch before update on scholarship_applications
  for each row execute function touch_updated_at();
drop trigger if exists audit_scholarship_applications on scholarship_applications;
create trigger audit_scholarship_applications after insert or update or delete on scholarship_applications
  for each row execute function audit_row_change();

-- ---------- Sending a school's own scholarship application in the app ----------

create table if not exists school_scholarship_submissions (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references schools(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  -- Exactly what the family chose to send (name, answers, essay, activities...).
  packet         jsonb not null check (jsonb_typeof(packet) = 'object' and length(packet::text) <= 60000),
  sent_by        uuid not null,
  sent_at        timestamptz not null default now(),
  status         text not null default 'new' check (status in ('new', 'reviewing', 'awarded', 'not_awarded')),
  -- A short note from the school the family sees, e.g. "Interviews are Dec 2".
  school_note    text check (school_note is null or length(school_note) <= 1000),
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  unique (scholarship_id, student_id)
);
create index if not exists school_submissions_school on school_scholarship_submissions (school_id, sent_at desc);

alter table school_scholarship_submissions enable row level security;
-- Families read their own (to see the school's answer). Schools read through
-- school_applications(), which logs every look. All writes go through functions.
drop policy if exists submissions_family on school_scholarship_submissions;
create policy submissions_family on school_scholarship_submissions for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id));
grant select on school_scholarship_submissions to authenticated;

create or replace function send_school_application(p_student uuid, p_scholarship uuid, p_packet jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_deadline date; v_status text; v_id uuid; v_prev text;
begin
  if not (can_parent_see_student(p_student) or is_student_self(p_student)) then raise exception 'not allowed'; end if;
  select school_id, deadline, status into v_school, v_deadline, v_status from scholarships where id = p_scholarship;
  if v_school is null then raise exception 'This scholarship is applied for on its official site.'; end if;
  if v_status = 'retired' then raise exception 'This scholarship is closed.'; end if;
  if v_deadline is not null and v_deadline < current_date then raise exception 'The deadline for this scholarship has passed.'; end if;
  if not exists (select 1 from school_links l where l.school_id = v_school and l.student_id = p_student
                  and l.status = 'active' and l.class_of >= school_year_end()) then
    raise exception 'Connect to this school on the My school page first.';
  end if;
  if p_packet is null or jsonb_typeof(p_packet) <> 'object' or length(trim(coalesce(p_packet->>'full_name', ''))) < 2 then
    raise exception 'Type your full name.';
  end if;
  if length(p_packet::text) > 60000 then raise exception 'This is too long to send. Shorten the essay or answers.'; end if;

  select status into v_prev from school_scholarship_submissions where scholarship_id = p_scholarship and student_id = p_student;
  if v_prev is not null and v_prev <> 'new' then
    raise exception 'The school is already reviewing this application, so it can''t be changed. Ask your counselor.';
  end if;
  insert into school_scholarship_submissions (school_id, scholarship_id, student_id, packet, sent_by)
  values (v_school, p_scholarship, p_student, p_packet, auth.uid())
  on conflict (scholarship_id, student_id) do update set packet = excluded.packet, sent_by = excluded.sent_by, sent_at = now()
  returning id into v_id;

  insert into scholarship_applications (student_id, scholarship_id, status, submitted_on)
  values (p_student, p_scholarship, 'submitted', current_date)
  on conflict (student_id, scholarship_id) do update
    set status = case when scholarship_applications.status = 'getting_ready' then 'submitted' else scholarship_applications.status end,
        submitted_on = coalesce(scholarship_applications.submitted_on, current_date);

  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), p_student, case when v_prev is null then 'school_application_sent' else 'school_application_resent' end,
          'school_scholarship_submissions', v_id::text, jsonb_build_object('school', v_school, 'scholarship', p_scholarship));
  return v_id;
end $$;

-- The family can take it back while the school hasn't started reviewing it.
create or replace function withdraw_school_application(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r school_scholarship_submissions;
begin
  select * into r from school_scholarship_submissions where id = p_id;
  if r.id is null or not (can_parent_see_student(r.student_id) or is_student_self(r.student_id)) then raise exception 'not allowed'; end if;
  if r.status <> 'new' then raise exception 'The school is already reviewing this application. Ask your counselor.'; end if;
  delete from school_scholarship_submissions where id = p_id;
  update scholarship_applications set status = 'getting_ready', submitted_on = null
   where student_id = r.student_id and scholarship_id = r.scholarship_id and status = 'submitted';
  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), r.student_id, 'school_application_withdrawn', 'school_scholarship_submissions', p_id::text,
          jsonb_build_object('school', r.school_id, 'scholarship', r.scholarship_id));
end $$;

-- Counselors: every application sent to the school's own scholarships.
create or replace function school_applications(p_school uuid)
returns table (id uuid, scholarship_id uuid, scholarship_name text, first_name text, grade_level int,
               packet jsonb, sent_at timestamptz, status text, school_note text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_staff(p_school) then raise exception 'not allowed'; end if;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'view', 'school_scholarship_submissions', p_school::text, jsonb_build_object('school', p_school));
  return query
    select x.id, x.scholarship_id, s.name, st.first_name, st.grade_level, x.packet, x.sent_at, x.status, x.school_note
      from school_scholarship_submissions x
      join scholarships s on s.id = x.scholarship_id
      join students st on st.id = x.student_id
     where x.school_id = p_school
     order by x.sent_at desc;
end $$;

create or replace function school_review_application(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r school_scholarship_submissions;
begin
  select * into r from school_scholarship_submissions where id = p_id;
  if r.id is null or not is_school_staff(r.school_id) then raise exception 'not allowed'; end if;
  if p_status not in ('reviewing', 'awarded', 'not_awarded') then raise exception 'Pick reviewing, awarded or not awarded.'; end if;
  update school_scholarship_submissions
     set status = p_status, school_note = nullif(left(trim(coalesce(p_note, '')), 1000), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if p_status in ('awarded', 'not_awarded') then
    update scholarship_applications
       set status = case when p_status = 'awarded' then 'won' else 'not_won' end, heard_on = current_date
     where student_id = r.student_id and scholarship_id = r.scholarship_id and status in ('submitted', 'won', 'not_won');
  end if;
  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), r.student_id, 'school_application_' || p_status, 'school_scholarship_submissions', p_id::text,
          jsonb_build_object('school', r.school_id, 'scholarship', r.scholarship_id));
end $$;

revoke all on function send_school_application(uuid, uuid, jsonb) from public, anon;
revoke all on function withdraw_school_application(uuid) from public, anon;
revoke all on function school_applications(uuid) from public, anon;
revoke all on function school_review_application(uuid, text, text) from public, anon;
grant execute on function send_school_application(uuid, uuid, jsonb) to authenticated;
grant execute on function withdraw_school_application(uuid) to authenticated;
grant execute on function school_applications(uuid) to authenticated;
grant execute on function school_review_application(uuid, text, text) to authenticated;
