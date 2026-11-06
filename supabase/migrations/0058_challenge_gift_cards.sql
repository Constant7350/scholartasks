-- Essay challenge prizes as digital gift cards, picked up in the app (Constant, 2026-11-06).
--
-- Mailing checks or sending money by email invites fraud. Instead our team buys a digital
-- gift card (Amazon, Walmart, Target...) at face value and saves its code here. The code is
-- shown ONLY inside the winning parent's own ScholarTasks login (or an 18+ winner's), after
-- they prove it's them right then (Face ID or an email code) and sign a receipt with a finger.
-- It is never sent by email or text. Who picked it up, and when, goes in the audit log.

alter table challenge_payouts add column if not exists gift_brand text check (gift_brand is null or length(gift_brand) <= 60);
alter table challenge_payouts add column if not exists gift_code text check (gift_code is null or length(gift_code) <= 200);
alter table challenge_payouts add column if not exists gift_link text check (gift_link is null or (length(gift_link) <= 500 and gift_link like 'https://%'));
alter table challenge_payouts add column if not exists picked_up_at timestamptz;
alter table challenge_payouts add column if not exists picked_up_by uuid;

alter table consent_signatures drop constraint if exists consent_signatures_kind_check;
alter table consent_signatures add constraint consent_signatures_kind_check
  check (kind in ('job_application', 'school_link', 'school_agreement', 'video', 'challenge', 'prize'));

-- The signature check now also knows the prize pick-up receipt (otherwise unchanged from 0057).
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
  -- A student account can never sign for anyone, except an adult (18+) student signing for themselves.
  if exists (select 1 from family_members where user_id = p_user and role = 'student')
     and not (p_kind in ('school_link', 'challenge', 'prize') and exists (
       select 1 from family_members m join students s on s.id = m.student_id
        where m.user_id = p_user and m.role = 'student' and s.id = p_student and age(current_date, s.birth_date) >= interval '18 years')) then
    raise exception 'Only a parent or guardian can sign this. Ask your parent to sign from their own account.';
  end if;
  if p_kind in ('job_application', 'school_link', 'challenge', 'prize') then
    select family_id into fid from students where id = p_student;
    select age(current_date, birth_date) >= interval '18 years' into adult from students where id = p_student;
    if fid is null or not (exists (select 1 from family_members where family_id = fid and user_id = p_user and role = 'parent')
                           or (p_kind in ('school_link', 'challenge', 'prize') and adult and exists (select 1 from family_members where user_id = p_user and student_id = p_student))) then
      raise exception 'Only this student''s parent or guardian can sign this.';
    end if;
    if p_kind = 'challenge' and not exists (select 1 from challenges where id::text = p_target and status <> 'draft') then
      raise exception 'That challenge wasn''t found.';
    end if;
    if p_kind = 'prize' and not exists (select 1 from challenge_entries where id::text = p_target and student_id = p_student) then
      raise exception 'That prize wasn''t found.';
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

-- What a family sees about their own prize (never the code itself).
create or replace function challenge_my_prize(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare e challenge_entries; p challenge_payouts;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not (is_student_self(e.student_id) or can_parent_see_student(e.student_id)) then return null; end if;
  if (select status from challenges where id = e.challenge_id) <> 'done' then return null; end if;
  select * into p from challenge_payouts where entry_id = p_entry;
  if not found then return null; end if;
  return jsonb_build_object('kind', p.kind, 'amount', p.amount, 'status', p.status, 'paid_on', p.paid_on, 'brand', p.gift_brand,
    'ready', p.gift_code is not null or p.gift_link is not null, 'picked_up_at', p.picked_up_at);
end $$;
revoke all on function challenge_my_prize(uuid) from public, anon;
grant execute on function challenge_my_prize(uuid) to authenticated;

-- The parent (or an 18+ winner) picks up the gift card, right after signing the receipt.
-- Returns the code and link. Can be opened again later by the same family.
create or replace function challenge_pickup_prize(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; p challenge_payouts; adult boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select * into e from challenge_entries where id = p_entry;
  if not found then raise exception 'That prize wasn''t found.'; end if;
  select age(current_date, birth_date) >= interval '18 years' into adult from students where id = e.student_id;
  if not (exists (select 1 from students s join family_members m on m.family_id = s.family_id
                   where s.id = e.student_id and m.user_id = auth.uid() and m.role = 'parent') and can_parent_see_student(e.student_id)
          or (adult and is_student_self(e.student_id))) then
    raise exception 'Only the winner''s parent or guardian can pick up this prize.';
  end if;
  if (select status from challenges where id = e.challenge_id) <> 'done' then raise exception 'Results aren''t out yet.'; end if;
  select * into p from challenge_payouts where entry_id = p_entry for update;
  if not found or (p.gift_code is null and p.gift_link is null) then raise exception 'Your prize isn''t ready yet. We''ll let you know.'; end if;
  if p.picked_up_at is null then
    perform use_consent_signature('prize', e.student_id, p_entry::text);
    update challenge_payouts set picked_up_at = now(), picked_up_by = auth.uid(), status = 'paid',
           paid_on = coalesce(paid_on, (now() at time zone 'America/New_York')::date) where entry_id = p_entry;
  end if;
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = e.student_id), e.student_id,
          case when p.picked_up_at is null then 'prize_picked_up' else 'prize_viewed_again' end, 'challenge_payouts', p_entry::text,
          jsonb_build_object('amount', p.amount, 'brand', p.gift_brand));
  return jsonb_build_object('brand', p.gift_brand, 'amount', p.amount, 'code', p.gift_code, 'link', p.gift_link);
end $$;
revoke all on function challenge_pickup_prize(uuid) from public, anon;
grant execute on function challenge_pickup_prize(uuid) to authenticated;

-- Payouts fill: keep pick-up columns from being changed by hand once picked up.
create or replace function challenge_payouts_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.student_id := (select student_id from challenge_entries where id = new.entry_id);
  if tg_op = 'UPDATE' and auth.uid() is not null and is_app_admin() then
    new.picked_up_at := old.picked_up_at; new.picked_up_by := old.picked_up_by;
    if old.picked_up_at is not null then new.gift_code := old.gift_code; new.gift_link := old.gift_link; end if;
  elsif tg_op = 'INSERT' then
    new.picked_up_at := null; new.picked_up_by := null;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by); new.updated_at := now();
  return new;
end $$;
