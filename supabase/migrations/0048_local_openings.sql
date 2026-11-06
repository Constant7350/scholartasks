-- Local openings (/trades/openings): companies post apprenticeships, paid
-- training and entry-level jobs on /trades/post without an account. Our team
-- approves each one on /admin/openings before anyone sees it.
-- Safety for students: there is no messaging inside the app. Students see only
-- the public details (never the company contact's private email or phone) and
-- choose to apply the way the company gave. Three reports hide a listing until
-- the team looks again. Listings end on their "show until" day (180 days at most).

create table if not exists local_openings (
  id                         uuid primary key default gen_random_uuid(),
  kind                       text not null check (kind in ('apprenticeship', 'pre_apprenticeship', 'training', 'job', 'internship')),
  title                      text not null check (char_length(title) between 4 and 120),
  trade_slug                 text check (trade_slug is null or char_length(trade_slug) <= 80),
  company_name               text not null check (char_length(company_name) between 1 and 120),
  company_website            text check (company_website is null or company_website ~* '^https?://'),
  -- Private: only the team sees these (to check the company and send the review result).
  contact_name               text not null check (char_length(contact_name) <= 100),
  contact_email              text not null check (char_length(contact_email) <= 200),
  contact_phone              text check (contact_phone is null or char_length(contact_phone) <= 30),
  city                       text not null check (char_length(city) <= 80),
  state                      char(2) not null,
  zip                        text check (zip is null or zip ~ '^\d{5}$'),
  min_age                    smallint not null check (min_age in (14, 15, 16, 17, 18, 21)),
  pay                        text check (pay is null or char_length(pay) <= 120),
  schedule                   text check (schedule is null or char_length(schedule) <= 160),
  description                text not null check (char_length(description) between 30 and 4000),
  requirements               text check (requirements is null or char_length(requirements) <= 2000),
  how_to_apply               text not null check (char_length(how_to_apply) <= 1000),
  apply_url                  text check (apply_url is null or apply_url ~* '^https?://'),
  registered_apprenticeship  boolean not null default false,
  rapids_number              text check (rapids_number is null or char_length(rapids_number) <= 40),
  -- Ticked by the team after finding the program on apprenticeship.gov.
  registered_verified        boolean not null default false,
  show_until                 date not null,
  status                     text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  review_note                text check (review_note is null or char_length(review_note) <= 2000),
  reviewed_by                uuid references auth.users(id) on delete set null,
  reviewed_at                timestamptz,
  approved_at                timestamptz,
  reports                    int not null default 0,
  created_at                 timestamptz not null default now()
);
create index if not exists local_openings_status on local_openings (status, show_until);
create index if not exists local_openings_email on local_openings (contact_email, created_at);

alter table local_openings enable row level security;
drop policy if exists local_openings_team on local_openings;
create policy local_openings_team on local_openings for all using (is_app_admin()) with check (is_app_admin());
grant select, update, delete on local_openings to authenticated;
-- Companies and students never read the table itself: new listings go in
-- through submit_opening(), and everyone reads approved ones from public_openings.

create table if not exists opening_reports (
  id          uuid primary key default gen_random_uuid(),
  opening_id  uuid not null references local_openings(id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 1000),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table opening_reports enable row level security;
drop policy if exists opening_reports_team on opening_reports;
create policy opening_reports_team on opening_reports for select using (is_app_admin());
grant select on opening_reports to authenticated;

-- What students and parents see: approved, not yet ended, public details only.
create or replace view public_openings as
  select id, kind, title, trade_slug, company_name, company_website, city, state, zip, min_age, pay, schedule,
         description, requirements, how_to_apply, apply_url, registered_apprenticeship, registered_verified,
         show_until, approved_at
  from local_openings
  where status = 'approved' and show_until >= (now() at time zone 'America/New_York')::date;
grant select on public_openings to anon, authenticated;

-- A company sends a listing for review (no account needed). Five a day per email at most.
create or replace function submit_opening(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; email text := lower(trim(p->>'contact_email'));
begin
  if (select count(*) from local_openings where contact_email = email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many listings today';
  end if;
  insert into local_openings (kind, title, trade_slug, company_name, company_website, contact_name, contact_email, contact_phone,
                              city, state, zip, min_age, pay, schedule, description, requirements, how_to_apply, apply_url,
                              registered_apprenticeship, rapids_number, show_until)
  values (p->>'kind', p->>'title', nullif(p->>'trade_slug', ''), p->>'company_name', nullif(p->>'company_website', ''),
          p->>'contact_name', email, nullif(p->>'contact_phone', ''), p->>'city', upper(p->>'state'), nullif(p->>'zip', ''),
          (p->>'min_age')::smallint, nullif(p->>'pay', ''), nullif(p->>'schedule', ''), p->>'description',
          nullif(p->>'requirements', ''), p->>'how_to_apply', nullif(p->>'apply_url', ''),
          coalesce((p->>'registered_apprenticeship')::boolean, false), nullif(p->>'rapids_number', ''),
          least(greatest((p->>'show_until')::date, current_date + 1), current_date + 180))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function submit_opening(jsonb) from public;
grant execute on function submit_opening(jsonb) to anon, authenticated;

-- Anyone can report a listing. Three reports hide it until the team looks again.
create or replace function report_opening(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r text := left(trim(coalesce(p_reason, '')), 1000);
begin
  if char_length(r) < 3 then raise exception 'Please say what is wrong.'; end if;
  if not exists (select 1 from local_openings where id = p_id and status = 'approved') then raise exception 'not found'; end if;
  insert into opening_reports (opening_id, reason, user_id) values (p_id, r, auth.uid());
  update local_openings set reports = reports + 1,
         status = case when reports + 1 >= 3 then 'hidden' else status end
   where id = p_id;
end $$;
revoke all on function report_opening(uuid, text) from public;
grant execute on function report_opening(uuid, text) to anon, authenticated;
