-- School portal, second version (Constant, 2026-11-07): the counselor portal gets its own
-- workspace, plus two new things counselors asked for:
--   * School events (FAFSA night, college visits, deadlines). Staff post them; connected
--     families see them on My school and can add them to their calendar.
--   * Private counselor notes on a connected student. Only that school's counselors see
--     them, only while the student is still connected, and every change is logged.
--     Families never see these notes.
-- school_transcript_requests() now also returns the student id, so a counselor can see
-- which papers belong to which student.

create table if not exists school_events (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  title       text not null check (length(trim(title)) between 2 and 150),
  starts_on   date not null,
  start_time  time,
  location    text check (location is null or length(location) <= 200),
  details     text check (details is null or length(details) <= 1500),
  -- Which grades it is for. Empty = everyone.
  grades      int[] not null default '{}',
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists school_events_school on school_events (school_id, starts_on);

alter table school_events enable row level security;
drop policy if exists school_events_staff on school_events;
create policy school_events_staff on school_events for all to authenticated
  using (is_school_staff(school_id)) with check (is_school_staff(school_id));
drop policy if exists school_events_family on school_events;
create policy school_events_family on school_events for select to authenticated
  using (school_id in (select my_linked_school_ids()));
grant select, insert, update, delete on school_events to authenticated;
drop trigger if exists audit_school_events on school_events;
create trigger audit_school_events after insert or update or delete on school_events
  for each row execute function audit_row_change();

create table if not exists school_student_notes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 2000),
  author_id   uuid not null default auth.uid(),
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists school_student_notes_student on school_student_notes (school_id, student_id);

-- True when the student is connected to this school right now.
create or replace function school_student_connected(p_school uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from school_links l where l.school_id = p_school and l.student_id = p_student
                 and l.status = 'active' and l.class_of >= school_year_end());
$$;

alter table school_student_notes enable row level security;
drop policy if exists school_notes_read on school_student_notes;
create policy school_notes_read on school_student_notes for select to authenticated
  using (is_school_staff(school_id) and school_student_connected(school_id, student_id));
drop policy if exists school_notes_add on school_student_notes;
create policy school_notes_add on school_student_notes for insert to authenticated
  with check (is_school_staff(school_id) and school_student_connected(school_id, student_id) and author_id = auth.uid());
drop policy if exists school_notes_delete on school_student_notes;
create policy school_notes_delete on school_student_notes for delete to authenticated
  using (author_id = auth.uid() and is_school_staff(school_id));
grant select, insert, delete on school_student_notes to authenticated;
drop trigger if exists audit_school_student_notes on school_student_notes;
create trigger audit_school_student_notes after insert or update or delete on school_student_notes
  for each row execute function audit_row_change();

-- Fill the author's name from the school's staff list.
create or replace function school_notes_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := (select full_name from school_staff where school_id = new.school_id and user_id = new.author_id);
  return new;
end $$;
drop trigger if exists school_notes_fill on school_student_notes;
create trigger school_notes_fill before insert on school_student_notes
  for each row execute function school_notes_fill();

-- Same as before, plus student_id.
drop function if exists school_transcript_requests(uuid);
create function school_transcript_requests(p_school uuid)
returns table (id uuid, student_id uuid, first_name text, grade_level int, college text, plan text, what text, person text,
               how text, needed_by date, status text, asked_on date, sent_on date, school_note text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_staff(p_school) then raise exception 'not allowed'; end if;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'view', 'transcript_requests', p_school::text, jsonb_build_object('school', p_school));
  return query
    select t.id, t.student_id, st.first_name, st.grade_level, c.name, c.plan, t.what, t.person, t.how,
           coalesce(t.needed_by, c.deadline), t.status, t.asked_on, t.sent_on, t.school_note
      from transcript_requests t
      join students st on st.id = t.student_id
      join student_colleges c on c.id = t.college_id
     where t.school_id = p_school
       and exists (select 1 from school_links l where l.school_id = p_school and l.student_id = t.student_id
                    and l.status = 'active' and l.class_of >= school_year_end())
     order by (t.status in ('sent', 'received')), coalesce(t.needed_by, c.deadline) nulls last, t.asked_on;
end $$;
revoke all on function school_transcript_requests(uuid) from public, anon;
grant execute on function school_transcript_requests(uuid) to authenticated;
revoke all on function school_student_connected(uuid, uuid) from public, anon;
grant execute on function school_student_connected(uuid, uuid) to authenticated;
