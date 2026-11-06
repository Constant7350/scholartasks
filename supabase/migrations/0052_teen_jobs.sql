-- Weekend and holiday jobs (part of local openings).
-- Companies make a company account on /employers, agree to the teen job rules, and post
-- weekend, holiday and other jobs. Our team approves each company and each listing.
-- Students apply inside ScholarTasks. EVERY application needs a parent's "I agree" before the
-- company sees it (Constant, 2026-11-06), and the parent's email goes with it so the company
-- includes the parent. Each consent (agree or decline) is written to the hash-chained audit_log
-- with the exact wording the parent agreed to, who, and when. Companies see only what the application holds (first name,
-- grade, age, the student's message and the contact the family chose to share), never the
-- rest of the student's account. Every change to an application is audited.

-- ---------- Company accounts ----------
create table if not exists employers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  company_name    text not null check (char_length(company_name) between 1 and 120),
  website         text check (website is null or website ~* '^https?://'),
  contact_name    text not null check (char_length(contact_name) between 1 and 100),
  contact_email   text not null check (char_length(contact_email) <= 200),
  phone           text check (phone is null or char_length(phone) <= 30),
  city            text not null check (char_length(city) <= 80),
  state           char(2) not null,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  review_note     text check (review_note is null or char_length(review_note) <= 2000),
  agreed_rules_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
alter table employers enable row level security;
drop policy if exists employers_own on employers;
create policy employers_own on employers for select to authenticated using (user_id = auth.uid() or is_app_admin());
drop policy if exists employers_team on employers;
create policy employers_team on employers for update to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, update on employers to authenticated;

create or replace function my_employer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employers where user_id = auth.uid() and status <> 'blocked';
$$;
grant execute on function my_employer_id() to authenticated;

-- A signed-in person makes (or updates) their company account and agrees to the rules.
create or replace function employer_sign_up(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid; email text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from family_members where user_id = auth.uid() and role = 'student') then
    raise exception 'Student accounts can''t be company accounts.';
  end if;
  if coalesce((p->>'agree')::boolean, false) is not true then raise exception 'Please agree to the rules.'; end if;
  select u.email into email from auth.users u where u.id = auth.uid();
  insert into employers (user_id, company_name, website, contact_name, contact_email, phone, city, state)
  values (auth.uid(), trim(p->>'company_name'), nullif(p->>'website', ''), trim(p->>'contact_name'),
          lower(coalesce(nullif(trim(p->>'contact_email'), ''), email)), nullif(p->>'phone', ''), trim(p->>'city'), upper(p->>'state'))
  on conflict (user_id) do update
    set company_name = excluded.company_name, website = excluded.website, contact_name = excluded.contact_name,
        contact_email = excluded.contact_email, phone = excluded.phone, city = excluded.city, state = excluded.state,
        agreed_rules_at = now()
  returning id into eid;
  return eid;
end $$;
revoke all on function employer_sign_up(jsonb) from public, anon;
grant execute on function employer_sign_up(jsonb) to authenticated;

-- ---------- Listings: weekend and holiday kinds, company accounts, apply in the app ----------
alter table local_openings drop constraint if exists local_openings_kind_check;
alter table local_openings add constraint local_openings_kind_check
  check (kind in ('apprenticeship', 'pre_apprenticeship', 'training', 'job', 'internship', 'weekend', 'holiday'));
alter table local_openings add column if not exists employer_id uuid references employers(id) on delete set null;
alter table local_openings add column if not exists apply_in_app boolean not null default false;
-- The flat fee for a company post: free while we launch; 'unpaid'/'paid' once charging starts.
alter table local_openings add column if not exists fee_status text not null default 'launch_free'
  check (fee_status in ('launch_free', 'unpaid', 'paid', 'waived'));
create index if not exists local_openings_employer on local_openings (employer_id);

drop policy if exists local_openings_employer on local_openings;
create policy local_openings_employer on local_openings for select to authenticated
  using (employer_id is not null and employer_id = my_employer_id());

create or replace view public_openings as
  select id, kind, title, trade_slug, company_name, company_website, city, state, zip, min_age, pay, schedule,
         description, requirements, how_to_apply, apply_url, registered_apprenticeship, registered_verified,
         show_until, approved_at,
         coalesce(featured_until >= (now() at time zone 'America/New_York')::date, false) as featured,
         apply_in_app
  from local_openings
  where status = 'approved' and show_until >= (now() at time zone 'America/New_York')::date;
grant select on public_openings to anon, authenticated;

-- A company posts from its account. Goes to our team for review like every listing.
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
                              registered_apprenticeship, rapids_number, show_until, employer_id, apply_in_app)
  values (p->>'kind', p->>'title', nullif(p->>'trade_slug', ''), e.company_name, e.website,
          e.contact_name, e.contact_email, e.phone, p->>'city', upper(p->>'state'), nullif(p->>'zip', ''),
          (p->>'min_age')::smallint, nullif(p->>'pay', ''), nullif(p->>'schedule', ''), p->>'description',
          nullif(p->>'requirements', ''), coalesce(nullif(p->>'how_to_apply', ''), 'Apply in ScholarTasks.'), nullif(p->>'apply_url', ''),
          coalesce((p->>'registered_apprenticeship')::boolean, false), nullif(p->>'rapids_number', ''),
          least(greatest((p->>'show_until')::date, current_date + 1), current_date + 180),
          e.id, coalesce((p->>'apply_in_app')::boolean, true))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function employer_post_opening(jsonb) from public, anon;
grant execute on function employer_post_opening(jsonb) to authenticated;

-- A company ends one of its own listings early.
create or replace function employer_close_opening(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update local_openings set show_until = current_date - 1
   where id = p_id and employer_id is not null and employer_id = my_employer_id();
  if not found then raise exception 'not allowed'; end if;
end $$;
revoke all on function employer_close_opening(uuid) from public, anon;
grant execute on function employer_close_opening(uuid) to authenticated;

-- ---------- Parent consent wording (versioned; the exact text is saved with every consent) ----------
create or replace function job_consent_text() returns table (version text, wording text)
language sql immutable as $$
  select 'job-consent-v1'::text,
    'I am this student''s parent or guardian. I agree that ScholarTasks may send this application to the company, '
    'with the student''s first name, grade, age, message, availability, the contact details we chose to share, and my email. '
    'I understand our review team checks companies and listings but does not employ the student, and that I should look up '
    'the company myself and go with my child to any first visit if they are under 18.'::text;
$$;
grant execute on function job_consent_text() to anon, authenticated;

-- Writes one consent record to the tamper-evident audit log.
create or replace function log_job_consent(a_id uuid, a_student uuid, agreed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from job_consent_text();
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = a_student), a_student, 'consent', 'job_application', a_id::text,
          jsonb_build_object('agreed', agreed, 'version', c.version, 'wording', c.wording,
                             'parent_email', (select email from auth.users where id = auth.uid())));
end $$;
revoke all on function log_job_consent(uuid, uuid, boolean) from public, anon, authenticated;

-- ---------- Applications ----------
create table if not exists job_applications (
  id                 uuid primary key default gen_random_uuid(),
  opening_id         uuid not null references local_openings(id) on delete cascade,
  student_id         uuid not null references students(id) on delete cascade,
  submitted_by       uuid references auth.users(id) on delete set null,
  message            text not null check (char_length(message) between 10 and 2000),
  availability       text check (availability is null or char_length(availability) <= 500),
  share_email        text check (share_email is null or char_length(share_email) <= 200),
  share_phone        text check (share_phone is null or char_length(share_phone) <= 30),
  parent_email       text check (parent_email is null or char_length(parent_email) <= 200),
  status             text not null default 'sent' check (status in
                       ('needs_parent', 'declined_by_parent', 'sent', 'seen', 'interview', 'not_selected', 'hired', 'withdrawn')),
  parent_decided_by  uuid references auth.users(id) on delete set null,
  parent_decided_at  timestamptz,
  consent_version    text,
  employer_note      text check (employer_note is null or char_length(employer_note) <= 1000),
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (opening_id, student_id)
);
create index if not exists job_applications_student on job_applications (student_id);
alter table job_applications enable row level security;
drop policy if exists job_applications_family on job_applications;
create policy job_applications_family on job_applications for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id) or is_app_admin());
grant select on job_applications to authenticated;
-- All changes go through the functions below.

drop trigger if exists job_applications_touch on job_applications;
create trigger job_applications_touch before update on job_applications
  for each row execute function touch_updated_at();
drop trigger if exists job_applications_audit on job_applications;
create trigger job_applications_audit after insert or update or delete on job_applications
  for each row execute function audit_row_change();

-- A student (or their parent) applies. It always waits for a parent's "I agree" first.
-- A parent applying for their own student can agree in the same step (p_parent_agree).
drop function if exists apply_for_job(uuid, uuid, text, text, text, text);
create or replace function apply_for_job(p_opening uuid, p_student uuid, p_message text, p_availability text,
                                         p_email text, p_phone text, p_parent_agree boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare o local_openings; st students; yrs int; by_parent boolean; parent text; st_status text; app_id uuid;
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
  if by_parent and not coalesce(p_parent_agree, false) then raise exception 'Please read the consent and tick I agree.'; end if;
  select u.email into parent from family_members m join auth.users u on u.id = m.user_id
   where m.family_id = st.family_id and m.role = 'parent'
   order by (m.user_id = auth.uid()) desc limit 1;
  st_status := case when by_parent then 'sent' else 'needs_parent' end;
  insert into job_applications (opening_id, student_id, submitted_by, message, availability, share_email, share_phone,
                                parent_email, status, sent_at, parent_decided_by, parent_decided_at, consent_version)
  values (p_opening, p_student, auth.uid(), trim(p_message), nullif(trim(coalesce(p_availability, '')), ''),
          nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(trim(coalesce(p_phone, '')), ''), parent, st_status,
          case when by_parent then now() end, case when by_parent then auth.uid() end, case when by_parent then now() end,
          case when by_parent then (select version from job_consent_text()) end)
  on conflict (opening_id, student_id) do update
    set message = excluded.message, availability = excluded.availability, share_email = excluded.share_email,
        share_phone = excluded.share_phone, parent_email = excluded.parent_email, status = excluded.status,
        sent_at = excluded.sent_at, parent_decided_by = excluded.parent_decided_by, parent_decided_at = excluded.parent_decided_at,
        consent_version = excluded.consent_version, submitted_by = excluded.submitted_by
    where job_applications.status in ('withdrawn', 'declined_by_parent', 'needs_parent')
  returning id into app_id;
  if app_id is null then raise exception 'You already applied to this job.'; end if;
  if by_parent then perform log_job_consent(app_id, p_student, true); end if;
  return st_status;
end $$;
revoke all on function apply_for_job(uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function apply_for_job(uuid, uuid, text, text, text, text, boolean) to authenticated;

-- A parent agrees (p_ok with p_agree ticked) or declines a student's application. Both are logged.
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
         consent_version = case when p_ok then (select version from job_consent_text()) end
   where id = p_id;
  perform log_job_consent(p_id, a.student_id, p_ok);
end $$;
revoke all on function decide_job_application(uuid, boolean, boolean) from public, anon;
grant execute on function decide_job_application(uuid, boolean, boolean) to authenticated;

-- Consent history for one application (the family and our team): from the tamper-evident log.
create or replace function job_application_consents(p_id uuid)
returns table (at timestamptz, agreed boolean, version text, wording text, parent_email text)
language sql stable security definer set search_path = public as $$
  select l.at, (l.details->>'agreed')::boolean, l.details->>'version', l.details->>'wording', l.details->>'parent_email'
    from audit_log l join job_applications a on a.id::text = l.target_id
   where l.target = 'job_application' and l.action = 'consent' and a.id = p_id
     and (can_parent_see_student(a.student_id) or is_student_self(a.student_id) or is_app_admin())
   order by l.at;
$$;
revoke all on function job_application_consents(uuid) from public, anon;
grant execute on function job_application_consents(uuid) to authenticated;

-- The family takes an application back, or says the student got the job.
create or replace function family_update_job_application(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare a job_applications;
begin
  select * into a from job_applications where id = p_id;
  if a.id is null or not (can_parent_see_student(a.student_id) or is_student_self(a.student_id)) then raise exception 'not allowed'; end if;
  if p_status not in ('withdrawn', 'hired') then raise exception 'not allowed'; end if;
  update job_applications set status = p_status where id = p_id;
end $$;
revoke all on function family_update_job_application(uuid, text) from public, anon;
grant execute on function family_update_job_application(uuid, text) to authenticated;

-- What a company sees: applications to its own listings that were sent to it. Nothing else about the student.
create or replace function employer_applications()
returns table (id uuid, opening_id uuid, opening_title text, first_name text, grade_level int, age int,
               message text, availability text, share_email text, share_phone text, parent_email text,
               status text, employer_note text, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.opening_id, o.title, s.first_name, s.grade_level,
         date_part('year', age(current_date, s.birth_date))::int,
         a.message, a.availability, a.share_email, a.share_phone, a.parent_email, a.status, a.employer_note, a.sent_at
    from job_applications a
    join local_openings o on o.id = a.opening_id
    join students s on s.id = a.student_id
   where o.employer_id is not null and o.employer_id = my_employer_id()
     and a.status in ('sent', 'seen', 'interview', 'not_selected', 'hired')
   order by a.sent_at desc;
$$;
revoke all on function employer_applications() from public, anon;
grant execute on function employer_applications() to authenticated;

-- A company moves an application along (the family sees the status).
create or replace function employer_update_application(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('seen', 'interview', 'not_selected', 'hired') then raise exception 'not allowed'; end if;
  update job_applications a
     set status = p_status, employer_note = nullif(left(trim(coalesce(p_note, '')), 1000), '')
    from local_openings o
   where a.id = p_id and o.id = a.opening_id and o.employer_id is not null and o.employer_id = my_employer_id()
     and a.status in ('sent', 'seen', 'interview', 'not_selected', 'hired');
  if not found then raise exception 'not allowed'; end if;
end $$;
revoke all on function employer_update_application(uuid, text, text) from public, anon;
grant execute on function employer_update_application(uuid, text, text) to authenticated;

-- ---------- Reference letters from the company ----------
-- After a company marks a student Hired, it can write a reference letter about work ethic and character.
-- The letter is tied to that student through the application (the student's private internal id), so the
-- company never needs or sees a student id. The family reads it first and chooses to keep it in the records.
create table if not exists job_references (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null unique references job_applications(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  employer_id     uuid references employers(id) on delete set null,
  company_name    text not null,
  job_title       text not null,
  writer_name     text not null check (char_length(writer_name) between 2 and 100),
  writer_role     text check (writer_role is null or char_length(writer_role) <= 100),
  worked_from     date,
  worked_to       date,
  letter          text not null check (char_length(letter) between 50 and 5000),
  family_status   text not null default 'new' check (family_status in ('new', 'kept', 'hidden')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists job_references_student on job_references (student_id);
alter table job_references enable row level security;
drop policy if exists job_references_family on job_references;
create policy job_references_family on job_references for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id) or is_app_admin()
         or (employer_id is not null and employer_id = my_employer_id()));
grant select on job_references to authenticated;
drop trigger if exists job_references_touch on job_references;
create trigger job_references_touch before update on job_references for each row execute function touch_updated_at();
drop trigger if exists job_references_audit on job_references;
create trigger job_references_audit after insert or update or delete on job_references
  for each row execute function audit_row_change();

-- The company writes (or fixes) the letter for a student it hired.
create or replace function employer_write_reference(p_application uuid, p_writer text, p_role text, p_from date, p_to date, p_letter text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a job_applications; o local_openings; rid uuid;
begin
  select * into a from job_applications where id = p_application;
  select * into o from local_openings where id = a.opening_id;
  if a.id is null or o.employer_id is null or o.employer_id is distinct from my_employer_id() or a.status <> 'hired' then
    raise exception 'not allowed';
  end if;
  if char_length(trim(coalesce(p_letter, ''))) < 50 then raise exception 'Please write a few sentences (at least 50 letters).'; end if;
  insert into job_references (application_id, student_id, employer_id, company_name, job_title, writer_name, writer_role, worked_from, worked_to, letter)
  values (a.id, a.student_id, o.employer_id, o.company_name, o.title, trim(p_writer), nullif(trim(coalesce(p_role, '')), ''), p_from, p_to, trim(p_letter))
  on conflict (application_id) do update
    set writer_name = excluded.writer_name, writer_role = excluded.writer_role, worked_from = excluded.worked_from,
        worked_to = excluded.worked_to, letter = excluded.letter, family_status = 'new'
  returning id into rid;
  return rid;
end $$;
revoke all on function employer_write_reference(uuid, text, text, date, date, text) from public, anon;
grant execute on function employer_write_reference(uuid, text, text, date, date, text) to authenticated;

-- A parent decides: keep the letter in the student's records, or hide it (it then never shows anywhere,
-- and the company is not told). A student can read it but not decide.
create or replace function family_set_reference(p_id uuid, p_keep boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r job_references;
begin
  select * into r from job_references where id = p_id;
  if r.id is null or not can_parent_see_student(r.student_id) then raise exception 'not allowed'; end if;
  update job_references set family_status = case when p_keep then 'kept' else 'hidden' end where id = p_id;
end $$;
revoke all on function family_set_reference(uuid, boolean) from public, anon;
grant execute on function family_set_reference(uuid, boolean) to authenticated;

-- The family's applications with the job's title and company (the family can't read the listings table itself).
create or replace function my_job_applications()
returns table (id uuid, opening_id uuid, student_id uuid, first_name text, title text, company_name text, city text, state char(2),
               kind text, pay text, schedule text, message text, availability text, share_email text, share_phone text,
               parent_email text, status text, employer_note text, parent_decided_at timestamptz, consent_version text,
               sent_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.opening_id, a.student_id, s.first_name, o.title, o.company_name, o.city, o.state, o.kind, o.pay, o.schedule,
         a.message, a.availability, a.share_email, a.share_phone, a.parent_email, a.status, a.employer_note,
         a.parent_decided_at, a.consent_version, a.sent_at, a.created_at
    from job_applications a
    join local_openings o on o.id = a.opening_id
    join students s on s.id = a.student_id
   where can_parent_see_student(a.student_id) or is_student_self(a.student_id)
   order by a.created_at desc;
$$;
revoke all on function my_job_applications() from public, anon;
grant execute on function my_job_applications() to authenticated;
