-- Spanish review: each person's language (for reminder emails and texts), the team's
-- testers, the reviewers' fixes to the Spanish word list, the "on your screen now"
-- feed for the check page, and a sample test family with made-up information.

-- ---------- Language for emails and texts ----------
alter table user_settings
  add column if not exists lang text not null default 'en' check (lang in ('en', 'es'));

create or replace function set_my_lang(p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_lang not in ('en', 'es') then raise exception 'Pick en or es.'; end if;
  insert into user_settings (user_id, lang) values (auth.uid(), p_lang)
  on conflict (user_id) do update set lang = excluded.lang, updated_at = now();
end $$;
revoke all on function set_my_lang(text) from public, anon;
grant execute on function set_my_lang(text) to authenticated;

-- The reminder jobs (service role) look up each person's language.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select on user_settings to service_role';
  end if;
end $$;

-- ---------- Testers ----------
create table if not exists app_testers (
  email      text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  name       text not null check (length(trim(name)) between 1 and 100),
  phone      text check (phone is null or length(phone) <= 30),
  focus      text not null default 'spanish' check (focus in ('spanish', 'app')),
  note       text check (length(note) <= 1000),
  active     boolean not null default true,
  added_by   uuid default auth.uid(),
  added_at   timestamptz not null default now(),
  last_seen  timestamptz
);
alter table app_testers enable row level security;
drop policy if exists testers_team on app_testers;
create policy testers_team on app_testers for all using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on app_testers to authenticated;

create or replace function my_email() returns text
language sql stable security definer set search_path = public as $$
  select lower(email::text) from auth.users where id = auth.uid();
$$;
revoke all on function my_email() from public, anon;
grant execute on function my_email() to authenticated;

/** The team, or an active tester. */
create or replace function is_tester() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    is_app_admin() or exists (select 1 from app_testers t where t.active and t.email = my_email()));
$$;
revoke all on function is_tester() from public, anon;
grant execute on function is_tester() to authenticated;

/** What the check page needs to know about the person using it. */
create or replace function tester_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r app_testers;
begin
  if not is_tester() then return jsonb_build_object('tester', false); end if;
  update app_testers set last_seen = now() where email = my_email() returning * into r;
  return jsonb_build_object('tester', true, 'team', is_app_admin(), 'email', my_email(),
    'name', coalesce(r.name, ''), 'focus', coalesce(r.focus, 'spanish'),
    'sample_family', (select f.id from families f join family_members m on m.family_id = f.id
                       where f.is_sample and m.user_id = auth.uid() and m.role = 'parent' limit 1));
end $$;
revoke all on function tester_me() from public, anon;
grant execute on function tester_me() to authenticated;

-- ---------- Fixes to the Spanish word list ----------
create table if not exists translation_fixes (
  en          text primary key check (length(en) between 1 and 4000),
  es          text not null default '' check (length(es) <= 6000),
  status      text not null check (status in ('ok', 'fix')),
  note        text check (length(note) <= 1000),
  by_email    text,
  updated_at  timestamptz not null default now()
);
alter table translation_fixes enable row level security;
drop policy if exists fixes_testers_read on translation_fixes;
create policy fixes_testers_read on translation_fixes for select using (is_tester());
grant select on translation_fixes to authenticated;

/** A reviewer marks a line correct, or saves a better Spanish line. */
create or replace function i18n_save(p_en text, p_status text, p_es text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_tester() then raise exception 'not allowed'; end if;
  if p_status not in ('ok', 'fix', 'clear') then raise exception 'Pick ok, fix or clear.'; end if;
  if p_status = 'clear' then delete from translation_fixes where en = p_en; return; end if;
  if p_status = 'fix' and coalesce(trim(p_es), '') = '' then raise exception 'Type the Spanish line.'; end if;
  insert into translation_fixes (en, es, status, note, by_email)
  values (p_en, case when p_status = 'fix' then trim(p_es) else '' end, p_status, nullif(trim(p_note), ''), my_email())
  on conflict (en) do update set es = excluded.es, status = excluded.status, note = excluded.note,
                                 by_email = excluded.by_email, updated_at = now();
end $$;
revoke all on function i18n_save(text, text, text, text) from public, anon;
grant execute on function i18n_save(text, text, text, text) to authenticated;

/** The fixed lines, for every visitor's page translator. Only English and Spanish text, nothing personal. */
create or replace function i18n_fixes() returns table (en text, es text)
language sql stable security definer set search_path = public as $$
  select f.en, f.es from translation_fixes f where f.status = 'fix' and f.es <> '';
$$;
grant execute on function i18n_fixes() to anon, authenticated;

-- ---------- "On your screen now" ----------
create table if not exists translation_live (
  user_id     uuid primary key default auth.uid(),
  path        text not null check (length(path) <= 300),
  title       text check (length(title) <= 300),
  lines       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table translation_live enable row level security;
drop policy if exists live_self on translation_live;
create policy live_self on translation_live for select using (user_id = auth.uid());
grant select on translation_live to authenticated;

/** A tester's phone or computer reports the lines on the screen in front of them. */
create or replace function i18n_live_report(p_path text, p_title text, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_tester() then return; end if;
  if jsonb_typeof(p_lines) <> 'array' or pg_column_size(p_lines) > 200000 then raise exception 'too many lines'; end if;
  insert into translation_live (user_id, path, title, lines) values (auth.uid(), left(p_path, 300), left(p_title, 300), p_lines)
  on conflict (user_id) do update set path = excluded.path, title = excluded.title, lines = excluded.lines, updated_at = now();
end $$;
revoke all on function i18n_live_report(text, text, jsonb) from public, anon;
grant execute on function i18n_live_report(text, text, jsonb) to authenticated;

-- ---------- Sample test family ----------
alter table families add column if not exists is_sample boolean not null default false;

/** Makes (or remakes) a test family full of made-up information for the signed-in tester:
    a parent account with an 11th grader named Emma in Georgia, grades, test scores, colleges,
    deadlines, activities, an essay and saved scholarships. */
create or replace function tester_make_sample_family() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  fid uuid; sid uuid; uga uuid; gt uuid; today date := current_date;
begin
  if not is_tester() then raise exception 'not allowed'; end if;
  if exists (select 1 from family_members m join families f on f.id = m.family_id
              where m.user_id = auth.uid() and not f.is_sample) then
    raise exception 'This sign-in already has a real family. Use a separate email for testing.';
  end if;
  delete from families f using family_members m
   where m.family_id = f.id and m.user_id = auth.uid() and m.role = 'parent' and f.is_sample;

  insert into families (name, is_sample) values ('Test family (sample)', true) returning id into fid;
  insert into family_members (family_id, user_id, role) values (fid, auth.uid(), 'parent');
  insert into students (family_id, first_name, birth_date, grade_level, state, sat, act, income_band, goal_gpa)
  values (fid, 'Emma', (today - interval '16 years 4 months')::date, 11, 'GA', 1180, 25, '60_110k', 3.7)
  returning id into sid;

  insert into course_grades (student_id, term, course, grade, level, core, grade_level) values
    (sid, 'Year', 'English 9', 'A', 'honors', true, 9),
    (sid, 'Year', 'Algebra I', 'B', 'standard', true, 9),
    (sid, 'Year', 'Biology', 'A', 'honors', true, 9),
    (sid, 'Year', 'World Geography', 'A', 'standard', true, 9),
    (sid, 'Year', 'Spanish I', 'B', 'standard', true, 9),
    (sid, 'Year', 'English 10', 'A', 'honors', true, 10),
    (sid, 'Year', 'Geometry', 'B', 'standard', true, 10),
    (sid, 'Year', 'Chemistry', 'C', 'standard', true, 10),
    (sid, 'Year', 'AP World History', 'B', 'AP', true, 10),
    (sid, 'Year', 'Spanish II', 'A', 'standard', true, 10),
    (sid, 'Fall', 'AP Biology', 'B', 'AP', true, 11),
    (sid, 'Fall', 'Algebra II', 'B', 'standard', true, 11);

  insert into student_colleges (student_id, name, plan, deadline, status) values
    (sid, 'University of Georgia', 'EA', today + 9, 'applying') returning id into uga;
  insert into student_colleges (student_id, name, plan, deadline, status) values
    (sid, 'Georgia Institute of Technology', 'EA', today + 21, 'considering') returning id into gt;
  insert into student_colleges (student_id, name, plan, deadline, status) values
    (sid, 'Georgia Southern University', 'RD', today + 75, 'considering'),
    (sid, 'Kennesaw State University', 'rolling', null, 'considering');

  insert into tasks (student_id, title, due_on, kind, status) values
    (sid, 'Ask Ms. Carter for a recommendation letter', today - 2, 'college', 'todo'),
    (sid, 'Make an FSA ID on StudentAid.gov', today + 3, 'aid', 'todo'),
    (sid, 'Register for the December SAT', today + 6, 'test', 'todo'),
    (sid, 'Local Rotary Club scholarship', today + 30, 'scholarship', 'todo'),
    (sid, 'Finish the career quiz', null, 'other', 'todo'),
    (sid, 'Visit the Georgia Southern campus', today - 20, 'college', 'done');

  insert into student_activities (student_id, kind, category, position, organization, description, grades, hours_per_week, weeks_per_year, sort_order) values
    (sid, 'activity', 'work', 'Barn helper', 'Oak Hill Farm', 'Feed and groom 12 horses before school; trained 2 new helpers.', '{10,11}', 10, 40, 1),
    (sid, 'activity', 'community', 'Volunteer', 'County animal shelter', 'Walk dogs and clean kennels on Saturdays.', '{9,10,11}', 3, 30, 2),
    (sid, 'activity', 'career', 'Member', 'FFA', 'Vet science team; placed 3rd at the region contest.', '{9,10,11}', 2, 30, 3);
  insert into student_activities (student_id, kind, category, position, recognition, grades, sort_order) values
    (sid, 'honor', 'academic', 'Honor roll', 'school', '{9,10}', 1);

  insert into student_essays (student_id, kind, title, prompt, word_limit, draft) values
    (sid, 'personal', 'Common App personal essay',
     'Discuss an accomplishment, event, or realization that sparked a period of personal growth.', 650,
     'The first time a horse trusted me, it was 5:30 in the morning and still dark. I had been working at the barn for three weeks...');
  insert into student_essays (student_id, kind, college_id, title, prompt, word_limit) values
    (sid, 'supplement', uga, 'University of Georgia short answer', 'Tell us an interesting or unusual fact about yourself.', 200);

  -- Two real awards from the scholarship list, saved to the plan.
  insert into scholarship_choices (student_id, scholarship_id, choice)
  select sid, s.id, 'added' from scholarships s order by s.name limit 2
  on conflict do nothing;

  return fid;
end $$;
revoke all on function tester_make_sample_family() from public, anon;
grant execute on function tester_make_sample_family() to authenticated;
