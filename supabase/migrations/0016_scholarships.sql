-- Scholarship matches: a shared list of scholarships with their rules, a
-- short "match profile" per student, and each family's choices (added to
-- their deadlines, or hidden). The ScholarTasks team (app_admins) keeps the
-- list current; an AI checker proposes updates that a person approves.

create table if not exists scholarships (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'scholarship' check (kind in ('scholarship', 'grant')),
  name             text not null unique check (length(trim(name)) between 2 and 200),
  sponsor          text not null check (length(trim(sponsor)) between 2 and 200),
  url              text not null check (url ~* '^https://'),
  summary          text not null check (length(trim(summary)) between 10 and 1500),
  how_to_apply     text check (length(how_to_apply) <= 1500),
  amount_text      text not null check (length(trim(amount_text)) between 2 and 200),
  amount_max       int check (amount_max is null or amount_max between 0 and 1000000),
  deadline         date,
  deadline_text    text check (length(deadline_text) <= 200),
  scope            text not null default 'US' check (scope ~ '^(US|[A-Z]{2})$'),
  grades           int[] not null default '{12}',
  min_gpa          numeric(3,2) check (min_gpa is null or min_gpa between 0 and 5),
  gpa_kind         text check (gpa_kind in ('hope', 'unweighted', 'weighted')),
  min_sat          int check (min_sat is null or min_sat between 400 and 1600),
  min_act          int check (min_act is null or min_act between 1 and 36),
  max_income       int check (max_income is null or max_income > 0),
  need_based       boolean not null default false,
  citizen_required boolean not null default false,
  interests        text[],
  groups           text[],
  college_type     text not null default 'any' check (college_type in ('any', 'four_year', 'technical')),
  college          text check (length(college) <= 200),
  other_requirements text check (length(other_requirements) <= 1000),
  automatic        boolean not null default false,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'retired')),
  last_checked     date,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

alter table scholarships enable row level security;
drop policy if exists scholarships_read on scholarships;
drop policy if exists scholarships_admin on scholarships;
create policy scholarships_read on scholarships for select to authenticated using (status <> 'retired' or is_app_admin());
create policy scholarships_admin on scholarships for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on scholarships to authenticated;

-- Changes the AI checker found on the sponsor's site, waiting for a person to accept.
create table if not exists scholarship_updates (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  summary        text not null check (length(summary) <= 2000),
  proposed       jsonb not null default '{}'::jsonb,
  sources        text[] not null default '{}',
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
alter table scholarship_updates enable row level security;
drop policy if exists scholarship_updates_admin on scholarship_updates;
create policy scholarship_updates_admin on scholarship_updates for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on scholarship_updates to authenticated;

-- What each student is interested in, for matching. Optional answers only.
alter table students add column if not exists match_profile jsonb not null default '{}'::jsonb;

create or replace function set_match_profile(p_student uuid, p_profile jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or is_student_self(p_student)) then
    raise exception 'not allowed';
  end if;
  if jsonb_typeof(p_profile) <> 'object' or length(p_profile::text) > 4000 then
    raise exception 'bad profile';
  end if;
  update students set match_profile = p_profile where id = p_student;
end $$;
revoke all on function set_match_profile(uuid, jsonb) from public;
grant execute on function set_match_profile(uuid, jsonb) to authenticated;

-- A family's choice for one scholarship: added to their deadlines, or hidden.
create table if not exists scholarship_choices (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  choice         text not null check (choice in ('added', 'hidden')),
  task_id        uuid references tasks(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (student_id, scholarship_id)
);
alter table scholarship_choices enable row level security;
drop policy if exists choices_parent on scholarship_choices;
drop policy if exists choices_self on scholarship_choices;
create policy choices_parent on scholarship_choices for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy choices_self on scholarship_choices for all
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on scholarship_choices to authenticated;

drop trigger if exists audit_scholarship_choices on scholarship_choices;
create trigger audit_scholarship_choices after insert or update or delete on scholarship_choices
  for each row execute function audit_row_change();

-- Parents (only) set the family income range used for need-based matches.
create or replace function set_income_band(p_student uuid, p_band text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_parent_see_student(p_student) then
    raise exception 'not allowed';
  end if;
  update students set income_band = p_band where id = p_student;
end $$;
revoke all on function set_income_band(uuid, text) from public;
grant execute on function set_income_band(uuid, text) to authenticated;
