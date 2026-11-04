-- Study skills library: lessons live in the app's code. The database keeps
-- which lessons each student finished, and the teacher review of each lesson
-- (team members listed in app_admins approve lessons or leave notes).

create table if not exists lesson_progress (
  student_id   uuid not null references students(id) on delete cascade,
  lesson_id    text not null check (lesson_id ~ '^[a-z0-9-]{1,60}$'),
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

alter table lesson_progress enable row level security;
drop policy if exists lessons_parent on lesson_progress;
drop policy if exists lessons_self on lesson_progress;
create policy lessons_parent on lesson_progress for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy lessons_self on lesson_progress for all
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, delete on lesson_progress to authenticated;

create table if not exists lesson_reviews (
  lesson_id   text primary key check (lesson_id ~ '^[a-z0-9-]{1,60}$'),
  status      text not null check (status in ('approved', 'changes')),
  notes       text check (length(notes) <= 4000),
  reviewed_by uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

alter table lesson_reviews enable row level security;
drop policy if exists lesson_reviews_read on lesson_reviews;
create policy lesson_reviews_read on lesson_reviews for select to authenticated using (true);
grant select on lesson_reviews to authenticated;

create or replace function set_lesson_review(p_lesson text, p_status text, p_notes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  insert into lesson_reviews (lesson_id, status, notes, reviewed_by, updated_at)
  values (p_lesson, p_status, nullif(trim(p_notes), ''), auth.uid(), now())
  on conflict (lesson_id) do update
    set status = excluded.status, notes = excluded.notes, reviewed_by = excluded.reviewed_by, updated_at = now();
end $$;

revoke all on function set_lesson_review(text, text, text) from public;
grant execute on function set_lesson_review(text, text, text) to authenticated;
