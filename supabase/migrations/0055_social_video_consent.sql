-- Signed consent everywhere, hard for a child to fake (Constant, 2026-11-06).
--
-- Every place a parent (or a school) gives consent, they now:
--   1. prove it is really them right then: Face ID / fingerprint (passkey) on this device,
--      or a 6-digit code sent to their own email (the website's /api/consent routes check it);
--   2. type their full name and sign with a finger or mouse.
-- Only the server (service role) can save a signature, and only after step 1, so a child
-- using a parent's unlocked phone or open session still can't sign. Student accounts can
-- never sign. The consent itself (sending a job application, connecting to a school, the
-- school data agreement) is refused by the database unless the same person signed in the
-- last 15 minutes; each signature works once. The parent gets an email receipt every time.
--
-- Audit trail: every code sent, wrong code, signature, use and take-back is written to the
-- tamper-evident audit_log (hash chained), and signatures are kept with the exact wording.
--
-- Also: parents sign permission for their student to appear in ScholarTasks videos from a
-- link our team sends (/video-permission?t=...), and can take it back from the same link.

-- ---------- Signatures ----------
create table if not exists consent_signatures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  user_email   text,
  kind         text not null check (kind in ('job_application', 'school_link', 'school_agreement', 'video')),
  target_id    text check (target_id is null or length(target_id) <= 80),
  student_id   uuid,
  signed_name  text not null check (length(signed_name) between 3 and 120),
  signature    text not null check (signature like 'data:image/png;base64,%' and length(signature) between 200 and 300000),
  version      text check (version is null or length(version) <= 40),
  wording      text not null check (length(wording) between 10 and 6000),
  verified_by  text not null check (verified_by in ('passkey', 'email_code')),
  ip           text check (ip is null or length(ip) <= 64),
  user_agent   text check (user_agent is null or length(user_agent) <= 300),
  signed_at    timestamptz not null default now(),
  used_at      timestamptz
);
create index if not exists consent_signatures_user on consent_signatures (user_id, kind, signed_at desc);
alter table consent_signatures enable row level security;
drop policy if exists consent_signatures_read on consent_signatures;
create policy consent_signatures_read on consent_signatures for select
  using (user_id = auth.uid() or is_app_admin() or (student_id is not null and can_parent_see_student(student_id)));
revoke all on consent_signatures from anon, authenticated;
grant select on consent_signatures to authenticated;
grant select, insert, update on consent_signatures to service_role;

-- Email codes for the identity check (server only; the code itself is never stored).
create table if not exists consent_codes (
  user_id     uuid primary key,
  code_hash   text not null,
  expires_at  timestamptz not null,
  tries       int not null default 0,
  sent_at     timestamptz not null default now()
);
alter table consent_codes enable row level security;
revoke all on consent_codes from anon, authenticated;
grant select, insert, update, delete on consent_codes to service_role;

-- Writes one line to the audit log for a consent event.
create or replace function consent_audit(p_user uuid, p_student uuid, p_action text, p_kind text, p_target text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (p_user, (select family_id from students where id = p_student), p_student, p_action, 'consent:' || p_kind, p_target, coalesce(p_details, '{}'::jsonb));
end $$;
revoke all on function consent_audit(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function consent_audit(uuid, uuid, text, text, text, jsonb) to service_role;

-- Saves a signature after the server checked who is signing (service role only).
create or replace function record_consent_signature(
  p_user uuid, p_kind text, p_target text, p_student uuid, p_name text, p_signature text,
  p_version text, p_wording text, p_method text, p_ip text, p_agent text
) returns uuid language plpgsql security definer set search_path = public as $$
declare n text := trim(coalesce(p_name, '')); fid uuid; sid uuid; adult boolean; email text;
begin
  if p_user is null then raise exception 'Please sign in first.'; end if;
  if length(n) < 3 or length(n) > 120 then raise exception 'Type your full name.'; end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or length(p_signature) < 200 or length(p_signature) > 300000 then
    raise exception 'Sign in the box with your finger or mouse.';
  end if;
  if p_method not in ('passkey', 'email_code') then raise exception 'Please confirm it''s you first.'; end if;
  -- A student account can never sign for anyone, except an adult (18+) student connecting their own school.
  if exists (select 1 from family_members where user_id = p_user and role = 'student')
     and not (p_kind = 'school_link' and exists (
       select 1 from family_members m join students s on s.id = m.student_id
        where m.user_id = p_user and m.role = 'student' and s.id = p_student and age(current_date, s.birth_date) >= interval '18 years')) then
    raise exception 'Only a parent or guardian can sign this. Ask your parent to sign from their own account.';
  end if;
  if p_kind in ('job_application', 'school_link') then
    select family_id into fid from students where id = p_student;
    select age(current_date, birth_date) >= interval '18 years' into adult from students where id = p_student;
    if fid is null or not (exists (select 1 from family_members where family_id = fid and user_id = p_user and role = 'parent')
                           or (p_kind = 'school_link' and adult and exists (select 1 from family_members where user_id = p_user and student_id = p_student))) then
      raise exception 'Only this student''s parent or guardian can sign this.';
    end if;
  elsif p_kind = 'school_agreement' then
    if not exists (select 1 from school_staff where school_id = p_target::uuid and user_id = p_user and role = 'admin') then
      raise exception 'Only the school''s admin can sign this.';
    end if;
  elsif p_kind = 'video' then
    if not exists (select 1 from social_people where sign_token::text = p_target) then
      raise exception 'This permission link is no longer valid. Ask our team for a new one.';
    end if;
  else
    raise exception 'unknown consent';
  end if;
  select u.email into email from auth.users u where u.id = p_user;
  insert into consent_signatures (user_id, user_email, kind, target_id, student_id, signed_name, signature, version, wording, verified_by, ip, user_agent)
  values (p_user, email, p_kind, left(p_target, 80), p_student, n, p_signature, left(p_version, 40), left(coalesce(p_wording, ''), 6000),
          p_method, left(p_ip, 64), left(p_agent, 300))
  returning id into sid;
  perform consent_audit(p_user, p_student, 'consent_signed', p_kind, coalesce(left(p_target, 80), sid::text),
    jsonb_build_object('signature_id', sid, 'signed_name', n, 'email', email, 'verified_by', p_method, 'ip', p_ip,
                       'version', p_version, 'wording', left(coalesce(p_wording, ''), 6000)));
  if p_kind = 'video' then
    update social_people
       set parent_name = n, signed_name = n, signature = p_signature, signed_by = p_user, signed_at = now(),
           consent_version = left(p_version, 40), withdrawn_at = null,
           consent_on = (now() at time zone 'America/New_York')::date, consent_note = 'Signed online (' || coalesce(email, 'no email') || ')'
     where sign_token::text = p_target;
    update consent_signatures set used_at = now() where id = sid;
  end if;
  return sid;
end $$;
revoke all on function record_consent_signature(uuid, text, text, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function record_consent_signature(uuid, text, text, uuid, text, text, text, text, text, text, text) to service_role;

-- Uses up the signer's fresh signature for this consent, or refuses. Called by the triggers below.
create or replace function use_consent_signature(p_kind text, p_student uuid, p_target text) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from consent_signatures
   where user_id = auth.uid() and kind = p_kind and used_at is null and signed_at > now() - interval '15 minutes'
     and (p_student is null or student_id = p_student) and (p_target is null or target_id = p_target)
   order by signed_at desc limit 1 for update;
  if sid is null then raise exception 'Please confirm it''s you and sign first.'; end if;
  update consent_signatures set used_at = now() where id = sid;
  perform consent_audit(auth.uid(), p_student, 'consent_used', p_kind, coalesce(p_target, sid::text), jsonb_build_object('signature_id', sid));
end $$;
revoke all on function use_consent_signature(text, uuid, text) from public, anon, authenticated;

-- A parent agreeing to a job application (sent in the app, or logged as applied outside).
create or replace function job_consent_needs_signature() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_decided_at is not null and new.status <> 'declined_by_parent'
     and (tg_op = 'INSERT' or old.parent_decided_at is distinct from new.parent_decided_at) then
    perform use_consent_signature('job_application', new.student_id, null);
  end if;
  return new;
end $$;
drop trigger if exists job_consent_needs_signature on job_applications;
create trigger job_consent_needs_signature before insert or update on job_applications
  for each row execute function job_consent_needs_signature();

-- A parent (or an adult student) connecting a student to a school.
create or replace function school_link_needs_signature() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and new.approved_by is not null
     and (tg_op = 'INSERT' or old.status <> 'active' or old.approved_by is distinct from new.approved_by) then
    perform use_consent_signature('school_link', new.student_id, null);
  end if;
  return new;
end $$;
drop trigger if exists school_link_needs_signature on school_links;
create trigger school_link_needs_signature before insert or update on school_links
  for each row execute function school_link_needs_signature();

-- A school admin signing the student data agreement.
create or replace function school_agreement_needs_signature() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform use_consent_signature('school_agreement', null, new.school_id::text);
  return new;
end $$;
drop trigger if exists school_agreement_needs_signature on school_data_agreements;
create trigger school_agreement_needs_signature before insert on school_data_agreements
  for each row execute function school_agreement_needs_signature();

-- ---------- Video permission (Social media tab) ----------
alter table social_people add column if not exists sign_token uuid unique;
alter table social_people add column if not exists signed_name text check (signed_name is null or length(signed_name) <= 120);
alter table social_people add column if not exists signature text check (signature is null or (signature like 'data:image/png;base64,%' and length(signature) <= 300000));
alter table social_people add column if not exists signed_by uuid;
alter table social_people add column if not exists signed_at timestamptz;
alter table social_people add column if not exists consent_version text check (consent_version is null or length(consent_version) <= 40);
alter table social_people add column if not exists withdrawn_at timestamptz;

-- What the signing page shows for a link. Signed-in users only; the link is the key.
create or replace function video_consent_get(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare p social_people;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select * into p from social_people where sign_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'student', p.name,
    'signed', p.signed_at is not null and p.withdrawn_at is null and p.consent_on is not null,
    'signed_name', p.signed_name, 'signed_at', p.signed_at,
    'mine', p.signed_by = auth.uid(), 'withdrawn_at', p.withdrawn_at
  );
end $$;
revoke all on function video_consent_get(uuid) from public, anon;
grant execute on function video_consent_get(uuid) to authenticated;

-- The parent who signed takes permission back.
create or replace function video_consent_withdraw(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update social_people set consent_on = null, withdrawn_at = now(), consent_note = 'Parent took back permission online'
   where sign_token = p_token and signed_by = auth.uid();
  if not found then raise exception 'Only the parent who signed can take this back. Email support@scholartasks.com for help.'; end if;
  perform consent_audit(auth.uid(), null, 'consent_withdrawn', 'video', p_token::text, '{}'::jsonb);
end $$;
revoke all on function video_consent_withdraw(uuid) from public, anon;
grant execute on function video_consent_withdraw(uuid) to authenticated;

-- Our team's view of the consent audit trail (/admin/consents).
create or replace function consent_audit_trail(p_limit int default 200) returns table (
  at timestamptz, action text, kind text, target_id text, student_id uuid, actor_email text, details jsonb
) language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return query
    select a.at, a.action, substr(a.target, 9), a.target_id, a.student_id, u.email::text, a.details - 'wording'
      from audit_log a left join auth.users u on u.id = a.actor_id
     where a.target like 'consent:%'
     order by a.id desc limit least(greatest(p_limit, 1), 1000);
end $$;
revoke all on function consent_audit_trail(int) from public, anon;
grant execute on function consent_audit_trail(int) to authenticated;
