-- Two ways to keep every job application inside ScholarTasks (Constant, 2026-11-06):
-- 1. Company questions: a company can add up to 3 short questions of its own to our application form.
--    Students answer them in ScholarTasks, so the parent's consent and the Hired answer still flow through us.
-- 2. "I applied on their site": for listings that send students to a company's own website, email or phone,
--    the family logs the application here. A parent still agrees (logged in the audit log), it shows in
--    My job applications, and Hired goes to the resume. Nothing is sent to the company from ScholarTasks.
-- We never take a company's own form to fill in: those ask for private details we shouldn't hold for minors.

alter table local_openings add column if not exists extra_questions jsonb not null default '[]'::jsonb;
alter table local_openings drop constraint if exists local_openings_extra_questions_check;
alter table local_openings add constraint local_openings_extra_questions_check
  check (jsonb_typeof(extra_questions) = 'array' and jsonb_array_length(extra_questions) <= 3);

alter table job_applications add column if not exists answers jsonb not null default '[]'::jsonb;
alter table job_applications add column if not exists applied_outside boolean not null default false;

create or replace view public_openings as
  select id, kind, title, trade_slug, company_name, company_website, city, state, zip, min_age, pay, schedule,
         description, requirements, how_to_apply, apply_url, registered_apprenticeship, registered_verified,
         show_until, approved_at,
         coalesce(featured_until >= (now() at time zone 'America/New_York')::date, false) as featured,
         apply_in_app, extra_questions
  from local_openings
  where status = 'approved' and show_until >= (now() at time zone 'America/New_York')::date;
grant select on public_openings to anon, authenticated;

-- Up to 3 questions, each trimmed to 200 characters; anything else is dropped.
create or replace function clean_job_questions(q jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(left(trim(v), 200) order by n), '[]'::jsonb)
    from (select v, n from jsonb_array_elements_text(case when jsonb_typeof(q) = 'array' then q else '[]'::jsonb end) with ordinality t(v, n)
           where char_length(trim(v)) >= 3 order by n limit 3) s;
$$;

-- Same as 0052, plus the company's questions.
create or replace function employer_post_opening(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare e employers; new_id uuid;
begin
  select * into e from employers where user_id = auth.uid();
  if e.id is null then raise exception 'Make your company account first.'; end if;
  if e.status = 'blocked' then raise exception 'not allowed'; end if;
  if (select count(*) from local_openings where employer_id = e.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many listings today';
  end if;
  insert into local_openings (kind, title, trade_slug, company_name, company_website, contact_name, contact_email, contact_phone,
                              city, state, zip, min_age, pay, schedule, description, requirements, how_to_apply, apply_url,
                              registered_apprenticeship, rapids_number, show_until, employer_id, apply_in_app, extra_questions)
  values (p->>'kind', p->>'title', nullif(p->>'trade_slug', ''), e.company_name, e.website,
          e.contact_name, e.contact_email, e.phone, p->>'city', upper(p->>'state'), nullif(p->>'zip', ''),
          (p->>'min_age')::smallint, nullif(p->>'pay', ''), nullif(p->>'schedule', ''), p->>'description',
          nullif(p->>'requirements', ''), coalesce(nullif(p->>'how_to_apply', ''), 'Apply in ScholarTasks.'), nullif(p->>'apply_url', ''),
          coalesce((p->>'registered_apprenticeship')::boolean, false), nullif(p->>'rapids_number', ''),
          least(greatest((p->>'show_until')::date, current_date + 1), current_date + 180),
          e.id, coalesce((p->>'apply_in_app')::boolean, true), clean_job_questions(p->'extra_questions'))
  returning id into new_id;
  return new_id;
end $$;

-- Consent wording when the student applies on the company's own site.
create or replace function job_consent_outside_text() returns table (version text, wording text)
language sql immutable as $$
  select 'job-outside-consent-v1'::text,
    'I am this student''s parent or guardian. I agree to my child applying for this opening the way the company asks, '
    'on its own website, by email or by phone. ScholarTasks sends nothing to the company. I understand our review team checks '
    'listings but does not employ the student, that a real employer never asks for money to apply, and that I should go with my '
    'child to any first visit if they are under 18.'::text;
$$;
grant execute on function job_consent_outside_text() to anon, authenticated;

-- The audit record uses the wording that matches the kind of application.
create or replace function log_job_consent(a_id uuid, a_student uuid, agreed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c record; outside boolean;
begin
  select applied_outside into outside from job_applications where id = a_id;
  if coalesce(outside, false) then select * into c from job_consent_outside_text(); else select * into c from job_consent_text(); end if;
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = a_student), a_student, 'consent', 'job_application', a_id::text,
          jsonb_build_object('agreed', agreed, 'version', c.version, 'wording', c.wording,
                             'parent_email', (select email from auth.users where id = auth.uid())));
end $$;
revoke all on function log_job_consent(uuid, uuid, boolean) from public, anon, authenticated;

-- Same as 0052, plus answers to the company's questions (one per question, each up to 1,000 characters).
drop function if exists apply_for_job(uuid, uuid, text, text, text, text, boolean);
create or replace function apply_for_job(p_opening uuid, p_student uuid, p_message text, p_availability text,
                                         p_email text, p_phone text, p_parent_agree boolean default false,
                                         p_answers jsonb default '[]'::jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare o local_openings; st students; yrs int; by_parent boolean; parent text; st_status text; app_id uuid; ans jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  by_parent := can_parent_see_student(p_student);
  if not (by_parent or is_student_self(p_student)) then raise exception 'not allowed'; end if;
  if is_under_13(p_student) then raise exception 'not allowed: under 13'; end if;
  select * into o from local_openings where id = p_opening;
  if o.id is null or o.status <> 'approved' or o.show_until < current_date or not o.apply_in_app then
    raise exception 'This job isn''t taking applications here.';
  end if;
  select * into st from students where id = p_student;
  yrs := date_part('year', age(current_date, st.birth_date));
  if yrs is null or yrs < o.min_age then raise exception 'too young for this job'; end if;
  if char_length(trim(coalesce(p_message, ''))) < 10 then raise exception 'Please write a short message to the company.'; end if;
  if nullif(trim(coalesce(p_email, '')), '') is null and nullif(trim(coalesce(p_phone, '')), '') is null then
    raise exception 'Please share an email or phone so the company can reach you.';
  end if;
  select coalesce(jsonb_agg(left(trim(coalesce(p_answers->>(n - 1)::int, '')), 1000) order by n), '[]'::jsonb) into ans
    from generate_series(1, jsonb_array_length(o.extra_questions)) n;
  if exists (select 1 from jsonb_array_elements_text(ans) a where a = '') then
    raise exception 'Please answer the company''s questions.';
  end if;
  if by_parent and not coalesce(p_parent_agree, false) then raise exception 'Please read the consent and tick I agree.'; end if;
  select u.email into parent from family_members m join auth.users u on u.id = m.user_id
   where m.family_id = st.family_id and m.role = 'parent'
   order by (m.user_id = auth.uid()) desc limit 1;
  st_status := case when by_parent then 'sent' else 'needs_parent' end;
  insert into job_applications (opening_id, student_id, submitted_by, message, availability, share_email, share_phone,
                                parent_email, status, sent_at, parent_decided_by, parent_decided_at, consent_version, answers, applied_outside)
  values (p_opening, p_student, auth.uid(), trim(p_message), nullif(trim(coalesce(p_availability, '')), ''),
          nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(trim(coalesce(p_phone, '')), ''), parent, st_status,
          case when by_parent then now() end, case when by_parent then auth.uid() end, case when by_parent then now() end,
          case when by_parent then (select version from job_consent_text()) end, ans, false)
  on conflict (opening_id, student_id) do update
    set message = excluded.message, availability = excluded.availability, share_email = excluded.share_email,
        share_phone = excluded.share_phone, parent_email = excluded.parent_email, status = excluded.status,
        sent_at = excluded.sent_at, parent_decided_by = excluded.parent_decided_by, parent_decided_at = excluded.parent_decided_at,
        consent_version = excluded.consent_version, submitted_by = excluded.submitted_by, answers = excluded.answers,
        applied_outside = false
    where job_applications.status in ('withdrawn', 'declined_by_parent', 'needs_parent')
  returning id into app_id;
  if app_id is null then raise exception 'You already applied to this job.'; end if;
  if by_parent then perform log_job_consent(app_id, p_student, true); end if;
  return st_status;
end $$;
revoke all on function apply_for_job(uuid, uuid, text, text, text, text, boolean, jsonb) from public, anon;
grant execute on function apply_for_job(uuid, uuid, text, text, text, text, boolean, jsonb) to authenticated;

-- The family logs an application made on the company's own site. A parent agrees (now, or later on /jobs).
create or replace function log_outside_application(p_opening uuid, p_student uuid, p_note text, p_parent_agree boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare o local_openings; st students; yrs int; by_parent boolean; parent text; st_status text; app_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  by_parent := can_parent_see_student(p_student);
  if not (by_parent or is_student_self(p_student)) then raise exception 'not allowed'; end if;
  if is_under_13(p_student) then raise exception 'not allowed: under 13'; end if;
  select * into o from local_openings where id = p_opening;
  if o.id is null or o.status <> 'approved' or o.apply_in_app then raise exception 'This job isn''t taking applications here.'; end if;
  select * into st from students where id = p_student;
  yrs := date_part('year', age(current_date, st.birth_date));
  if yrs is null or yrs < o.min_age then raise exception 'too young for this job'; end if;
  if by_parent and not coalesce(p_parent_agree, false) then raise exception 'Please read the consent and tick I agree.'; end if;
  select u.email into parent from family_members m join auth.users u on u.id = m.user_id
   where m.family_id = st.family_id and m.role = 'parent'
   order by (m.user_id = auth.uid()) desc limit 1;
  st_status := case when by_parent then 'sent' else 'needs_parent' end;
  insert into job_applications (opening_id, student_id, submitted_by, message, parent_email, status, sent_at,
                                parent_decided_by, parent_decided_at, consent_version, applied_outside)
  values (p_opening, p_student, auth.uid(),
          coalesce(nullif(left(trim(coalesce(p_note, '')), 2000), ''), 'Applied on the company''s own site.'),
          parent, st_status, case when by_parent then now() end, case when by_parent then auth.uid() end,
          case when by_parent then now() end, case when by_parent then (select version from job_consent_outside_text()) end, true)
  on conflict (opening_id, student_id) do update
    set message = excluded.message, parent_email = excluded.parent_email, status = excluded.status, sent_at = excluded.sent_at,
        parent_decided_by = excluded.parent_decided_by, parent_decided_at = excluded.parent_decided_at,
        consent_version = excluded.consent_version, submitted_by = excluded.submitted_by, applied_outside = true
    where job_applications.status in ('withdrawn', 'declined_by_parent', 'needs_parent')
  returning id into app_id;
  if app_id is null then raise exception 'You already applied to this job.'; end if;
  if by_parent then perform log_job_consent(app_id, p_student, true); end if;
  return st_status;
end $$;
revoke all on function log_outside_application(uuid, uuid, text, boolean) from public, anon;
grant execute on function log_outside_application(uuid, uuid, text, boolean) to authenticated;

-- A parent decides; the version saved matches the kind of application.
create or replace function decide_job_application(p_id uuid, p_ok boolean, p_agree boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a job_applications;
begin
  select * into a from job_applications where id = p_id;
  if a.id is null or not can_parent_see_student(a.student_id) then raise exception 'not allowed'; end if;
  if a.status <> 'needs_parent' then raise exception 'This application was already decided.'; end if;
  if p_ok and not coalesce(p_agree, false) then raise exception 'Please read the consent and tick I agree.'; end if;
  update job_applications
     set status = case when p_ok then 'sent' else 'declined_by_parent' end,
         sent_at = case when p_ok then now() end,
         parent_email = (select email from auth.users where id = auth.uid()),
         parent_decided_by = auth.uid(), parent_decided_at = now(),
         consent_version = case when not p_ok then null
                                when a.applied_outside then (select version from job_consent_outside_text())
                                else (select version from job_consent_text()) end
   where id = p_id;
  perform log_job_consent(p_id, a.student_id, p_ok);
end $$;

-- Companies see the answers to their questions; never applications made outside ScholarTasks.
drop function if exists employer_applications();
create or replace function employer_applications()
returns table (id uuid, opening_id uuid, opening_title text, first_name text, grade_level int, age int,
               message text, availability text, share_email text, share_phone text, parent_email text,
               status text, employer_note text, sent_at timestamptz, questions jsonb, answers jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.opening_id, o.title, s.first_name, s.grade_level,
         date_part('year', age(current_date, s.birth_date))::int,
         a.message, a.availability, a.share_email, a.share_phone, a.parent_email, a.status, a.employer_note, a.sent_at,
         o.extra_questions, a.answers
    from job_applications a
    join local_openings o on o.id = a.opening_id
    join students s on s.id = a.student_id
   where o.employer_id is not null and o.employer_id = my_employer_id() and not a.applied_outside
     and a.status in ('sent', 'seen', 'interview', 'not_selected', 'hired')
   order by a.sent_at desc;
$$;
revoke all on function employer_applications() from public, anon;
grant execute on function employer_applications() to authenticated;

drop function if exists my_job_applications();
create or replace function my_job_applications()
returns table (id uuid, opening_id uuid, student_id uuid, first_name text, title text, company_name text, city text, state char(2),
               kind text, pay text, schedule text, message text, availability text, share_email text, share_phone text,
               parent_email text, status text, employer_note text, parent_decided_at timestamptz, consent_version text,
               sent_at timestamptz, created_at timestamptz, applied_outside boolean, questions jsonb, answers jsonb, apply_url text)
language sql stable security definer set search_path = public as $$
  select a.id, a.opening_id, a.student_id, s.first_name, o.title, o.company_name, o.city, o.state, o.kind, o.pay, o.schedule,
         a.message, a.availability, a.share_email, a.share_phone, a.parent_email, a.status, a.employer_note,
         a.parent_decided_at, a.consent_version, a.sent_at, a.created_at, a.applied_outside, o.extra_questions, a.answers, o.apply_url
    from job_applications a
    join local_openings o on o.id = a.opening_id
    join students s on s.id = a.student_id
   where can_parent_see_student(a.student_id) or is_student_self(a.student_id)
   order by a.created_at desc;
$$;
revoke all on function my_job_applications() from public, anon;
grant execute on function my_job_applications() to authenticated;
