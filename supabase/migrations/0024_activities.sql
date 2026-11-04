-- Activities, honors and awards, laid out the way the Common App asks for
-- them (position 50 characters, organization 100, description 150), so the
-- student can copy them straight in. The same list prints as a one-page
-- resume. Students keep their own list without needing a parent's OK; it is
-- their record. Parents see and can edit it too.

create table if not exists student_activities (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  kind             text not null default 'activity' check (kind in ('activity', 'honor')),
  category         text not null default 'other' check (category in (
                     'academic', 'arts', 'athletics', 'career', 'community', 'family', 'club',
                     'leadership', 'religious', 'work', 'other')),
  position         text not null check (length(trim(position)) between 1 and 100),
  organization     text check (length(organization) <= 100),
  description      text check (length(description) <= 150),
  grades           int[] not null default '{}' check (grades <@ array[6,7,8,9,10,11,12]),
  hours_per_week   numeric(4,1) check (hours_per_week is null or hours_per_week between 0 and 80),
  weeks_per_year   int check (weeks_per_year is null or weeks_per_year between 0 and 52),
  -- Honors only: how far the recognition reaches.
  recognition      text check (recognition in ('school', 'state', 'national', 'international')),
  ongoing          boolean not null default true,
  sort_order       int not null default 0,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()
);
create index if not exists student_activities_student on student_activities (student_id, kind, sort_order);

alter table student_activities enable row level security;
drop policy if exists activities_parent on student_activities;
drop policy if exists activities_self on student_activities;
create policy activities_parent on student_activities for all to authenticated
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy activities_self on student_activities for all to authenticated
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on student_activities to authenticated;

drop trigger if exists audit_student_activities on student_activities;
create trigger audit_student_activities after insert or update or delete on student_activities
  for each row execute function audit_row_change();
