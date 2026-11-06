-- School portal phase 2: a school admin signs the student data agreement,
-- then uploads a class roster (CSV). The roster lets counselors see who has
-- connected and email a join code to families who haven't. Roster rows hold
-- only what the school chose to upload (name, grade, school ID, optional email).
-- When the agreement ends, the roster is deleted within 45 days
-- (Georgia Student Data Privacy, O.C.G.A. 20-2-666). No grades are uploaded.

create table if not exists school_data_agreements (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  version      text not null default '2026-11',
  signer_name  text not null check (length(trim(signer_name)) between 2 and 120),
  signer_title text not null check (length(trim(signer_title)) between 2 and 120),
  district     text check (district is null or length(district) <= 200),
  signed_by    uuid not null,
  signed_at    timestamptz not null default now(),
  ended_at     timestamptz,
  ended_by     uuid
);
create unique index if not exists school_dpa_active on school_data_agreements (school_id) where ended_at is null;

create table if not exists school_roster (
  school_id    uuid not null references schools(id) on delete cascade,
  student_ref  text not null check (length(trim(student_ref)) between 1 and 40),
  first_name   text not null check (length(trim(first_name)) between 1 and 80),
  last_name    text not null check (length(trim(last_name)) between 1 and 80),
  grade_level  int not null check (grade_level between 6 and 12),
  email        text check (email is null or (length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  invited_at   timestamptz,
  uploaded_by  uuid not null,
  uploaded_at  timestamptz not null default now(),
  primary key (school_id, student_ref)
);

alter table school_data_agreements enable row level security;
alter table school_roster enable row level security;
drop policy if exists dpa_staff_read on school_data_agreements;
create policy dpa_staff_read on school_data_agreements for select to authenticated using (is_school_staff(school_id) or is_app_admin());
drop policy if exists roster_staff_read on school_roster;
create policy roster_staff_read on school_roster for select to authenticated using (is_school_staff(school_id));
grant select on school_data_agreements, school_roster to authenticated;

-- Only a school admin signs. One active agreement per school.
create or replace function sign_school_data_agreement(p_school uuid, p_name text, p_title text, p_district text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  if not exists (select 1 from schools where id = p_school and status = 'approved') then raise exception 'The school must be approved first.'; end if;
  select id into v from school_data_agreements where school_id = p_school and ended_at is null;
  if v is not null then return v; end if;
  insert into school_data_agreements (school_id, signer_name, signer_title, district, signed_by)
  values (p_school, trim(p_name), trim(p_title), nullif(trim(coalesce(p_district, '')), ''), auth.uid()) returning id into v;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'sign', 'school_data_agreement', p_school::text, jsonb_build_object('signer', trim(p_name), 'title', trim(p_title)));
  return v;
end $$;

-- Ending the agreement schedules the roster for deletion in 45 days (sooner with delete_school_roster).
create or replace function end_school_data_agreement(p_school uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  update school_data_agreements set ended_at = now(), ended_by = auth.uid() where school_id = p_school and ended_at is null;
  insert into audit_log (actor_id, action, target, target_id) values (auth.uid(), 'end', 'school_data_agreement', p_school::text);
end $$;

-- Upload or replace the roster. p_rows: [{student_ref, first_name, last_name, grade_level, email}].
create or replace function upload_school_roster(p_school uuid, p_rows jsonb, p_replace boolean default true) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  if not exists (select 1 from school_data_agreements where school_id = p_school and ended_at is null) then
    raise exception 'Sign the student data agreement first.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'Up to 5,000 students per upload.'; end if;
  if p_replace then delete from school_roster where school_id = p_school; end if;
  insert into school_roster (school_id, student_ref, first_name, last_name, grade_level, email, uploaded_by)
  select p_school, trim(r->>'student_ref'), trim(r->>'first_name'), trim(r->>'last_name'), (r->>'grade_level')::int,
         nullif(lower(trim(coalesce(r->>'email', ''))), ''), auth.uid()
    from jsonb_array_elements(p_rows) r
  on conflict (school_id, student_ref) do update
    set first_name = excluded.first_name, last_name = excluded.last_name, grade_level = excluded.grade_level,
        email = excluded.email, uploaded_by = excluded.uploaded_by, uploaded_at = now();
  get diagnostics n = row_count;
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'upload', 'school_roster', p_school::text, jsonb_build_object('rows', n, 'replace', p_replace));
  return n;
end $$;

create or replace function delete_school_roster(p_school uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_school_admin(p_school) then raise exception 'not allowed'; end if;
  delete from school_roster where school_id = p_school;
  insert into audit_log (actor_id, action, target, target_id) values (auth.uid(), 'delete', 'school_roster', p_school::text);
end $$;

-- The roster with "connected" shown: a roster email that matches a parent or
-- student account linked (active) to this school.
create or replace function school_roster_status(p_school uuid)
returns table (student_ref text, first_name text, last_name text, grade_level int, email text, connected boolean, invited_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.student_ref, r.first_name, r.last_name, r.grade_level, r.email,
         exists (
           select 1 from school_links l
             join students s on s.id = l.student_id
             join family_members m on m.family_id = s.family_id and (m.role = 'parent' or m.student_id = s.id)
             join auth.users u on u.id = m.user_id
            where l.school_id = p_school and l.status = 'active' and r.email is not null and lower(u.email) = r.email
         ),
         r.invited_at
    from school_roster r
   where r.school_id = p_school and is_school_staff(p_school)
   order by r.grade_level desc, r.last_name, r.first_name;
$$;

-- Emails for a join-code invite to roster families not yet connected (marks them invited).
-- Each address is invited at most once a week.
create or replace function school_roster_invitees(p_school uuid, p_user uuid, p_grades int[])
returns table (email text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from school_staff where school_id = p_school and user_id = p_user) then raise exception 'not allowed'; end if;
  if not exists (select 1 from schools where id = p_school and status = 'approved') then raise exception 'not allowed'; end if;
  return query
    with picked as (
      select s.student_ref, s.email from school_roster_status_for(p_school) s
       where not s.connected and s.email is not null
         and (coalesce(array_length(p_grades, 1), 0) = 0 or s.grade_level = any(p_grades))
         and (s.invited_at is null or s.invited_at < now() - interval '7 days')
    ), marked as (
      update school_roster r set invited_at = now() from picked p
       where r.school_id = p_school and r.student_ref = p.student_ref returning r.email
    )
    select distinct m.email from marked m;
  insert into audit_log (actor_id, action, target, target_id) values (p_user, 'invite', 'school_roster', p_school::text);
end $$;

-- Same as school_roster_status without the staff check (server-side use only).
create or replace function school_roster_status_for(p_school uuid)
returns table (student_ref text, grade_level int, email text, connected boolean, invited_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.student_ref, r.grade_level, r.email,
         exists (
           select 1 from school_links l
             join students s on s.id = l.student_id
             join family_members m on m.family_id = s.family_id and (m.role = 'parent' or m.student_id = s.id)
             join auth.users u on u.id = m.user_id
            where l.school_id = p_school and l.status = 'active' and r.email is not null and lower(u.email) = r.email
         ),
         r.invited_at
    from school_roster r where r.school_id = p_school;
$$;

-- Daily job: delete rosters 45 days after their agreement ended.
create or replace function purge_school_rosters() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from school_roster r
   where not exists (select 1 from school_data_agreements a where a.school_id = r.school_id and a.ended_at is null)
     and exists (select 1 from school_data_agreements a where a.school_id = r.school_id and a.ended_at < now() - interval '45 days');
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function sign_school_data_agreement(uuid, text, text, text), end_school_data_agreement(uuid),
  upload_school_roster(uuid, jsonb, boolean), delete_school_roster(uuid), school_roster_status(uuid) from public, anon;
grant execute on function sign_school_data_agreement(uuid, text, text, text), end_school_data_agreement(uuid),
  upload_school_roster(uuid, jsonb, boolean), delete_school_roster(uuid), school_roster_status(uuid) to authenticated;
revoke all on function school_roster_invitees(uuid, uuid, int[]), school_roster_status_for(uuid), purge_school_rosters() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function school_roster_invitees(uuid, uuid, int[]), school_roster_status_for(uuid), purge_school_rosters() to service_role';
  end if;
end $$;
