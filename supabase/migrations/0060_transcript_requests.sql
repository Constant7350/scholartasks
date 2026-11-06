-- Transcripts and letters tracker (Constant, 2026-11-06).
--
-- Students still submit their own applications on Common App or each college's site, and
-- the high school sends the official transcript and counselor letter (Common App, GAfutures,
-- Parchment or the mail). ScholarTasks keeps track of what each college needs from the
-- school and who has been asked:
--   * The family lists what each college needs (transcript, counselor letter, teacher
--     letter, test scores, mid-year report) and ticks off asked / sent / received.
--   * If the student is connected to their school on My school, they can ask the counselor
--     right in the app. Only that school's counselors see the request (every look is
--     logged), and they mark it sent with a short note the family sees.
-- Nothing is sent to a college by ScholarTasks.

create table if not exists transcript_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  college_id  uuid not null references student_colleges(id) on delete cascade,
  what        text not null check (what in ('transcript', 'counselor_letter', 'teacher_letter', 'test_scores', 'mid_year', 'final_transcript')),
  -- Teacher letters: which teacher. Otherwise empty.
  person      text check (person is null or length(person) <= 120),
  -- How it gets to the college.
  how         text not null default 'common_app' check (how in ('common_app', 'gafutures', 'parchment', 'college_portal', 'email', 'mail', 'testing_agency', 'other')),
  needed_by   date,
  status      text not null default 'to_ask' check (status in ('to_ask', 'asked', 'sent', 'received')),
  asked_on    date,
  sent_on     date,
  notes       text check (notes is null or length(notes) <= 500),
  -- Set only by ask_school_for_paper(): the request is in this school's portal.
  school_id   uuid references schools(id) on delete set null,
  school_note text check (school_note is null or length(school_note) <= 500),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists transcript_requests_student on transcript_requests (student_id);
create index if not exists transcript_requests_school on transcript_requests (school_id) where school_id is not null;

alter table transcript_requests enable row level security;
drop policy if exists transcript_requests_family on transcript_requests;
create policy transcript_requests_family on transcript_requests for all to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id))
  with check (can_parent_see_student(student_id) or is_student_self(student_id));
grant select, insert, update, delete on transcript_requests to authenticated;

-- The college must belong to the same student, and only the functions below may set
-- which school sees the request or write the school's note.
create or replace function transcript_requests_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from student_colleges c where c.id = new.college_id and c.student_id = new.student_id) then
    raise exception 'Pick a college from this student''s list.';
  end if;
  if coalesce(current_setting('st.transcript_fn', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      if new.school_id is not null or new.school_note is not null then raise exception 'Ask your counselor with the Ask button.'; end if;
    elsif new.school_id is distinct from old.school_id or new.school_note is distinct from old.school_note then
      raise exception 'Ask your counselor with the Ask button.';
    end if;
  end if;
  if new.status in ('asked', 'sent', 'received') and new.asked_on is null then new.asked_on := current_date; end if;
  if new.status in ('sent', 'received') and new.sent_on is null then new.sent_on := current_date; end if;
  if new.status = 'to_ask' then new.asked_on := null; new.sent_on := null; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists transcript_requests_guard on transcript_requests;
create trigger transcript_requests_guard before insert or update on transcript_requests
  for each row execute function transcript_requests_guard();
drop trigger if exists audit_transcript_requests on transcript_requests;
create trigger audit_transcript_requests after insert or update or delete on transcript_requests
  for each row execute function audit_row_change();

-- Family: put this request in the counselor's portal (student must be connected to the school).
create or replace function ask_school_for_paper(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r transcript_requests; v_school uuid;
begin
  select * into r from transcript_requests where id = p_id;
  if r.id is null or not (can_parent_see_student(r.student_id) or is_student_self(r.student_id)) then raise exception 'not allowed'; end if;
  if r.what = 'test_scores' then raise exception 'Test scores are sent by the College Board or ACT, not the school.'; end if;
  select l.school_id into v_school from school_links l
   where l.student_id = r.student_id and l.status = 'active' and l.class_of >= school_year_end()
   order by l.created_at desc limit 1;
  if v_school is null then raise exception 'Connect to your school on the My school page first, or ask your counselor in person and tick Asked.'; end if;
  perform set_config('st.transcript_fn', 'on', true);
  update transcript_requests
     set school_id = v_school, school_note = null,
         status = case when status = 'to_ask' then 'asked' else status end,
         asked_on = coalesce(asked_on, current_date)
   where id = p_id;
  perform set_config('st.transcript_fn', '', true);
  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), r.student_id, 'transcript_request_sent_to_school', 'transcript_requests', p_id::text, jsonb_build_object('school', v_school, 'what', r.what));
  return v_school;
end $$;

-- Family: take it back out of the counselor's portal (only before the school marks it sent).
create or replace function cancel_school_paper(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r transcript_requests;
begin
  select * into r from transcript_requests where id = p_id;
  if r.id is null or not (can_parent_see_student(r.student_id) or is_student_self(r.student_id)) then raise exception 'not allowed'; end if;
  if r.status in ('sent', 'received') then raise exception 'The school already sent it.'; end if;
  perform set_config('st.transcript_fn', 'on', true);
  update transcript_requests set school_id = null, school_note = null where id = p_id;
  perform set_config('st.transcript_fn', '', true);
  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), r.student_id, 'transcript_request_cancelled', 'transcript_requests', p_id::text, jsonb_build_object('school', r.school_id));
end $$;

-- Counselors: every request sent to this school, oldest deadline first.
create or replace function school_transcript_requests(p_school uuid)
returns table (id uuid, first_name text, grade_level int, college text, plan text, what text, person text,
               how text, needed_by date, status text, asked_on date, sent_on date, school_note text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_staff(p_school) then raise exception 'not allowed'; end if;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'view', 'transcript_requests', p_school::text, jsonb_build_object('school', p_school));
  return query
    select t.id, st.first_name, st.grade_level, c.name, c.plan, t.what, t.person, t.how,
           coalesce(t.needed_by, c.deadline), t.status, t.asked_on, t.sent_on, t.school_note
      from transcript_requests t
      join students st on st.id = t.student_id
      join student_colleges c on c.id = t.college_id
     where t.school_id = p_school
       -- Only students still connected to this school.
       and exists (select 1 from school_links l where l.school_id = p_school and l.student_id = t.student_id
                    and l.status = 'active' and l.class_of >= school_year_end())
     order by (t.status in ('sent', 'received')), coalesce(t.needed_by, c.deadline) nulls last, t.asked_on;
end $$;

-- Counselors: mark a request sent (or back to asked), with a note the family sees.
create or replace function school_mark_paper(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r transcript_requests;
begin
  select * into r from transcript_requests where id = p_id;
  if r.id is null or r.school_id is null or not is_school_staff(r.school_id) then raise exception 'not allowed'; end if;
  if p_status not in ('asked', 'sent') then raise exception 'Pick sent or not yet.'; end if;
  perform set_config('st.transcript_fn', 'on', true);
  update transcript_requests
     set status = case when p_status = 'sent' and status = 'received' then 'received' else p_status end,
         sent_on = case when p_status = 'sent' then coalesce(sent_on, current_date) else null end,
         school_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where id = p_id;
  perform set_config('st.transcript_fn', '', true);
  insert into audit_log (actor_id, student_id, action, target, target_id, details)
  values (auth.uid(), r.student_id, 'transcript_request_' || p_status, 'transcript_requests', p_id::text, jsonb_build_object('school', r.school_id, 'what', r.what));
end $$;

revoke all on function ask_school_for_paper(uuid) from public, anon;
revoke all on function cancel_school_paper(uuid) from public, anon;
revoke all on function school_transcript_requests(uuid) from public, anon;
revoke all on function school_mark_paper(uuid, text, text) from public, anon;
grant execute on function ask_school_for_paper(uuid) to authenticated;
grant execute on function cancel_school_paper(uuid) to authenticated;
grant execute on function school_transcript_requests(uuid) to authenticated;
grant execute on function school_mark_paper(uuid, text, text) to authenticated;
