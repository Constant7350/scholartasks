-- The ScholarTasks Essay Challenge (Constant, 2026-11-06).
--
-- Our team runs essay challenges from time to time: each one has its own topic, its own
-- subject (writing, science, history, careers...) and its own grade group. Students write the
-- essay INSIDE the app, in their own login (free or paid account, same chances), step by step
-- like a game (ideas, plan, draft, come back another day, coach check, polish, submit), and
-- every student who submits gets a certificate they can claim and print. Our team judges with
-- names hidden, picks winners, and records how each cash prize was paid. Prize money is
-- separate from scholarship money.
--
-- Rules the database keeps:
--   * Only the student writes their own entry (parents can read it, never type in it).
--   * The essay is typed here: the page blocks pasting, the server refuses a huge jump of
--     text in one save, and keeps a writing history (snapshots) the judges can see.
--   * Entries only while the challenge is open, and only for students in its grades.
--   * Submitting needs a parent's signed permission (an 18+ student signs for themselves).
--   * Families of our own team can practice and get a certificate, but can't win.
--   * Places, results, certificates and prize payments are set by our team only.

-- ---------- Challenges ----------
create table if not exists challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 3 and 120),
  subject     text not null default 'Writing' check (length(subject) between 2 and 60),
  prompt      text not null check (length(prompt) between 10 and 2000),
  tips        text check (tips is null or length(tips) <= 4000),
  grade_min   int not null check (grade_min between 6 and 12),
  grade_max   int not null check (grade_max between 6 and 12),
  min_words   int not null default 250 check (min_words between 50 and 3000),
  max_words   int not null default 650 check (max_words between 100 and 5000),
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  results_on  date,
  -- [{ "place": 1, "label": "1st place", "kind": "cash" | "scholarship" | "certificate", "amount": 250 }]
  prizes      jsonb not null default '[]'::jsonb check (jsonb_typeof(prizes) = 'array' and length(prizes::text) <= 10000),
  status      text not null default 'draft' check (status in ('draft', 'open', 'judging', 'done')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint challenges_grades check (grade_min <= grade_max),
  constraint challenges_words check (min_words < max_words),
  constraint challenges_dates check (closes_at > opens_at)
);
alter table challenges enable row level security;
drop policy if exists challenges_read on challenges;
drop policy if exists challenges_team on challenges;
-- Anyone (even signed out) can read a published challenge and its official rules.
create policy challenges_read on challenges for select using (status <> 'draft' or is_app_admin());
create policy challenges_team on challenges for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select on challenges to anon, authenticated;
grant insert, update, delete on challenges to authenticated;

create or replace function challenges_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists challenges_touch on challenges;
create trigger challenges_touch before update on challenges for each row execute function challenges_touch();

-- ---------- Entries ----------
create table if not exists challenge_entries (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  title           text check (title is null or length(title) <= 150),
  ideas           text check (ideas is null or length(ideas) <= 4000),
  outline         text check (outline is null or length(outline) <= 4000),
  body            text not null default '' check (length(body) <= 40000),
  words           int not null default 0,
  checklist       jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object' and length(checklist::text) <= 2000),
  -- Writing record (set by the server, shown to judges).
  active_seconds  int not null default 0,
  writing_days    int not null default 0,
  last_wrote_on   date,
  saves           int not null default 0,
  big_jumps       int not null default 0,
  paste_blocked   int not null default 0,
  coach_checks    int not null default 0,
  team_family     boolean not null default false,
  status          text not null default 'draft' check (status in ('draft', 'submitted', 'withdrawn')),
  submitted_at    timestamptz,
  result          text check (result is null or result in ('finisher', 'finalist', 'winner')),
  place           int check (place is null or place between 1 and 10),
  certificate_code text unique,
  claimed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (challenge_id, student_id)
);
create index if not exists challenge_entries_challenge on challenge_entries (challenge_id, status);
alter table challenge_entries enable row level security;
drop policy if exists challenge_entries_read on challenge_entries;
drop policy if exists challenge_entries_student_insert on challenge_entries;
drop policy if exists challenge_entries_student_update on challenge_entries;
drop policy if exists challenge_entries_student_delete on challenge_entries;
create policy challenge_entries_read on challenge_entries for select to authenticated
  using (is_student_self(student_id) or can_parent_see_student(student_id) or is_app_admin());
create policy challenge_entries_student_insert on challenge_entries for insert to authenticated
  with check (is_student_self(student_id));
create policy challenge_entries_student_update on challenge_entries for update to authenticated
  using (is_student_self(student_id) or is_app_admin()) with check (is_student_self(student_id) or is_app_admin());
create policy challenge_entries_student_delete on challenge_entries for delete to authenticated
  using (is_student_self(student_id) and status = 'draft');
grant select, insert, update, delete on challenge_entries to authenticated;

-- Writing history: a snapshot at most every 10 minutes while the student writes.
create table if not exists challenge_entry_versions (
  id        bigserial primary key,
  entry_id  uuid not null references challenge_entries(id) on delete cascade,
  body      text not null,
  words     int not null,
  saved_at  timestamptz not null default now()
);
create index if not exists challenge_entry_versions_entry on challenge_entry_versions (entry_id, saved_at);
alter table challenge_entry_versions enable row level security;
drop policy if exists challenge_versions_team on challenge_entry_versions;
create policy challenge_versions_team on challenge_entry_versions for select to authenticated using (is_app_admin());
grant select on challenge_entry_versions to authenticated;

create or replace function challenge_word_count(t text) returns int
language sql immutable set search_path = public as $$
  select coalesce(array_length(regexp_split_to_array(nullif(trim(coalesce(t, '')), ''), '\s+'), 1), 0);
$$;

-- True when someone in the student's family is on our team (they can practice, not win).
create or replace function challenge_is_team_family(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s join family_members m on m.family_id = s.family_id
                   join app_admins a on a.user_id = m.user_id where s.id = p_student);
$$;
revoke all on function challenge_is_team_family(uuid) from public, anon, authenticated;

-- Checks every insert and save. RPCs below set st.challenge_rpc to change status and results.
create or replace function challenge_entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c challenges; st students; rpc boolean := coalesce(current_setting('st.challenge_rpc', true), '') = 'on';
        team boolean := is_app_admin(); grow int; secs numeric;
begin
  select * into c from challenges where id = new.challenge_id;
  if tg_op = 'INSERT' then
    select * into st from students where id = new.student_id;
    if c.id is null or c.status <> 'open' or now() < c.opens_at or now() > c.closes_at then raise exception 'This challenge isn''t open for entries right now.'; end if;
    if st.grade_level not between c.grade_min and c.grade_max then
      raise exception 'This challenge is for grades % to %.', c.grade_min, c.grade_max;
    end if;
    new.status := 'draft'; new.result := null; new.place := null; new.certificate_code := null; new.claimed_at := null;
    new.submitted_at := null; new.active_seconds := 0; new.writing_days := 0; new.saves := 0; new.big_jumps := 0;
    new.paste_blocked := 0; new.coach_checks := 0; new.body := coalesce(new.body, '');
    if length(new.body) > 400 then raise exception 'Type your essay here in the app. Pasting isn''t allowed in the challenge.'; end if;
    new.team_family := challenge_is_team_family(new.student_id);
    new.words := challenge_word_count(new.body);
    return new;
  end if;

  -- UPDATE
  new.id := old.id; new.challenge_id := old.challenge_id; new.student_id := old.student_id;
  new.created_at := old.created_at; new.team_family := old.team_family;
  if not rpc then
    -- Status, results and certificates only change through the functions below.
    new.status := old.status; new.submitted_at := old.submitted_at; new.result := old.result;
    new.place := old.place; new.certificate_code := old.certificate_code; new.claimed_at := old.claimed_at;
    new.coach_checks := old.coach_checks;
  end if;
  if old.status <> 'draft' and not rpc then
    if new.body is distinct from old.body or new.title is distinct from old.title or new.ideas is distinct from old.ideas
       or new.outline is distinct from old.outline or new.checklist is distinct from old.checklist then
      raise exception 'This essay was already sent in, so it can''t be changed.';
    end if;
    new.active_seconds := old.active_seconds; new.paste_blocked := old.paste_blocked;
  elsif not rpc and old.status = 'draft' then
    if new.body is distinct from old.body and (c.status <> 'open' or now() > c.closes_at) then
      raise exception 'This challenge has closed, so the essay can''t be changed now.';
    end if;
    secs := extract(epoch from now() - old.updated_at);
    -- Time spent writing can only grow by the real time since the last save.
    new.active_seconds := least(greatest(new.active_seconds, old.active_seconds), old.active_seconds + ceil(secs)::int + 5);
    new.paste_blocked := greatest(new.paste_blocked, old.paste_blocked);
    if new.body is distinct from old.body then
      grow := length(new.body) - length(old.body);
      if grow > 2000 then raise exception 'Type your essay here in the app. Pasting isn''t allowed in the challenge.'; end if;
      if grow > 300 then new.big_jumps := old.big_jumps + 1; else new.big_jumps := old.big_jumps; end if;
      new.saves := old.saves + 1;
      if old.last_wrote_on is distinct from (now() at time zone 'America/New_York')::date then
        new.writing_days := old.writing_days + 1;
        new.last_wrote_on := (now() at time zone 'America/New_York')::date;
      else
        new.writing_days := old.writing_days; new.last_wrote_on := old.last_wrote_on;
      end if;
    else
      new.big_jumps := old.big_jumps; new.saves := old.saves; new.writing_days := old.writing_days; new.last_wrote_on := old.last_wrote_on;
    end if;
  end if;
  if not team and not rpc then
    new.big_jumps := greatest(new.big_jumps, old.big_jumps);
  end if;
  new.words := challenge_word_count(new.body);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists challenge_entries_guard on challenge_entries;
create trigger challenge_entries_guard before insert or update on challenge_entries
  for each row execute function challenge_entries_guard();

create or replace function challenge_entries_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.body is distinct from old.body and new.body <> ''
     and not exists (select 1 from challenge_entry_versions where entry_id = new.id and saved_at > now() - interval '10 minutes') then
    insert into challenge_entry_versions (entry_id, body, words) values (new.id, new.body, new.words);
  end if;
  return null;
end $$;
drop trigger if exists challenge_entries_history on challenge_entries;
create trigger challenge_entries_history after update on challenge_entries
  for each row execute function challenge_entries_history();

-- ---------- Parent permission (signed) ----------
alter table consent_signatures drop constraint if exists consent_signatures_kind_check;
alter table consent_signatures add constraint consent_signatures_kind_check
  check (kind in ('job_application', 'school_link', 'school_agreement', 'video', 'challenge'));

create table if not exists challenge_permissions (
  challenge_id    uuid not null references challenges(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  signed_by       uuid not null default auth.uid(),
  signature_id    uuid,
  public_name_ok  boolean not null default false,
  signed_at       timestamptz not null default now(),
  primary key (challenge_id, student_id)
);
alter table challenge_permissions enable row level security;
drop policy if exists challenge_permissions_read on challenge_permissions;
create policy challenge_permissions_read on challenge_permissions for select to authenticated
  using (is_student_self(student_id) or can_parent_see_student(student_id) or is_app_admin());
grant select on challenge_permissions to authenticated;

-- A parent (or an adult student) gives permission, right after signing (Face ID or email code).
create or replace function challenge_give_permission(p_challenge uuid, p_student uuid, p_public boolean) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid; adult boolean;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select age(current_date, birth_date) >= interval '18 years' into adult from students where id = p_student;
  if not (can_parent_see_student(p_student) or (adult and is_student_self(p_student))) then
    raise exception 'Only this student''s parent or guardian can give permission.';
  end if;
  if not exists (select 1 from challenges where id = p_challenge and status <> 'draft') then raise exception 'That challenge wasn''t found.'; end if;
  perform use_consent_signature('challenge', p_student, p_challenge::text);
  select id into sid from consent_signatures where user_id = auth.uid() and kind = 'challenge' and student_id = p_student
     and target_id = p_challenge::text order by signed_at desc limit 1;
  insert into challenge_permissions (challenge_id, student_id, signed_by, signature_id, public_name_ok, signed_at)
  values (p_challenge, p_student, auth.uid(), sid, coalesce(p_public, false), now())
  on conflict (challenge_id, student_id) do update
    set signed_by = excluded.signed_by, signature_id = excluded.signature_id, public_name_ok = excluded.public_name_ok, signed_at = now();
end $$;
revoke all on function challenge_give_permission(uuid, uuid, boolean) from public, anon;
grant execute on function challenge_give_permission(uuid, uuid, boolean) to authenticated;

-- The signature check now knows the challenge permission too (the rest is unchanged from 0055).
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
     and not (p_kind in ('school_link', 'challenge') and exists (
       select 1 from family_members m join students s on s.id = m.student_id
        where m.user_id = p_user and m.role = 'student' and s.id = p_student and age(current_date, s.birth_date) >= interval '18 years')) then
    raise exception 'Only a parent or guardian can sign this. Ask your parent to sign from their own account.';
  end if;
  if p_kind in ('job_application', 'school_link', 'challenge') then
    select family_id into fid from students where id = p_student;
    select age(current_date, birth_date) >= interval '18 years' into adult from students where id = p_student;
    if fid is null or not (exists (select 1 from family_members where family_id = fid and user_id = p_user and role = 'parent')
                           or (p_kind in ('school_link', 'challenge') and adult and exists (select 1 from family_members where user_id = p_user and student_id = p_student))) then
      raise exception 'Only this student''s parent or guardian can sign this.';
    end if;
    if p_kind = 'challenge' and not exists (select 1 from challenges where id::text = p_target and status <> 'draft') then
      raise exception 'That challenge wasn''t found.';
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

-- ---------- Student actions ----------
create or replace function challenge_new_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 10);
$$;

-- Sends the essay in. Only the student, only while open, within the word limits, with permission.
create or replace function challenge_submit(p_entry uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; c challenges; code text;
begin
  select * into e from challenge_entries where id = p_entry for update;
  if not found or not is_student_self(e.student_id) then raise exception 'Only the student who wrote this essay can send it in.'; end if;
  if e.status <> 'draft' then raise exception 'This essay was already sent in.'; end if;
  select * into c from challenges where id = e.challenge_id;
  if c.status <> 'open' or now() > c.closes_at then raise exception 'This challenge has closed.'; end if;
  if e.words < c.min_words then raise exception 'Your essay needs at least % words. It has % now.', c.min_words, e.words; end if;
  if e.words > c.max_words then raise exception 'Your essay can be up to % words. It has % now.', c.max_words, e.words; end if;
  if not exists (select 1 from challenge_permissions where challenge_id = e.challenge_id and student_id = e.student_id) then
    raise exception 'A parent or guardian needs to sign permission first.';
  end if;
  loop
    code := challenge_new_code();
    exit when not exists (select 1 from challenge_entries where certificate_code = code);
  end loop;
  perform set_config('st.challenge_rpc', 'on', true);
  update challenge_entries set status = 'submitted', submitted_at = now(), result = 'finisher', certificate_code = code where id = p_entry;
  perform set_config('st.challenge_rpc', 'off', true);
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = e.student_id), e.student_id, 'challenge_submitted', 'challenge_entries', p_entry::text,
          jsonb_build_object('challenge_id', e.challenge_id, 'words', e.words, 'writing_days', e.writing_days, 'active_seconds', e.active_seconds));
  return code;
end $$;
revoke all on function challenge_submit(uuid) from public, anon;
grant execute on function challenge_submit(uuid) to authenticated;

-- The student claims their certificate (marks it as theirs; it then shows on the page to print).
create or replace function challenge_claim(p_entry uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e challenge_entries;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not (is_student_self(e.student_id) or can_parent_see_student(e.student_id)) then raise exception 'That entry wasn''t found.'; end if;
  if e.status <> 'submitted' then raise exception 'Send your essay in first, then claim your certificate.'; end if;
  perform set_config('st.challenge_rpc', 'on', true);
  update challenge_entries set claimed_at = coalesce(claimed_at, now()) where id = p_entry;
  perform set_config('st.challenge_rpc', 'off', true);
  return e.certificate_code;
end $$;
revoke all on function challenge_claim(uuid) from public, anon;
grant execute on function challenge_claim(uuid) to authenticated;

-- Counts one coach check (the coach route calls this after a good answer).
create or replace function challenge_coach_used(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from challenge_entries where id = p_entry and is_student_self(student_id) and status = 'draft') then return; end if;
  perform set_config('st.challenge_rpc', 'on', true);
  update challenge_entries set coach_checks = coach_checks + 1 where id = p_entry;
  perform set_config('st.challenge_rpc', 'off', true);
end $$;
revoke all on function challenge_coach_used(uuid) from public, anon;
grant execute on function challenge_coach_used(uuid) to authenticated;

-- Anyone with the code can check a certificate is real. Shows only a first name.
create or replace function challenge_certificate(p_code text) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare e challenge_entries; c challenges; s students; res text; pl int;
begin
  select * into e from challenge_entries where certificate_code = upper(trim(p_code)) and status = 'submitted';
  if not found then return null; end if;
  select * into c from challenges where id = e.challenge_id;
  select * into s from students where id = e.student_id;
  -- Winners and finalists show only once our team publishes the results.
  res := case when c.status = 'done' then coalesce(e.result, 'finisher') else 'finisher' end;
  pl := case when res = 'winner' then e.place end;
  return jsonb_build_object('first_name', s.first_name, 'challenge', c.title, 'subject', c.subject,
    'grade_min', c.grade_min, 'grade_max', c.grade_max, 'result', res, 'place', pl,
    'date', to_char(coalesce(case when c.status = 'done' then c.results_on end, e.submitted_at::date), 'YYYY-MM-DD'),
    'code', e.certificate_code);
end $$;
revoke all on function challenge_certificate(text) from public;
grant execute on function challenge_certificate(text) to anon, authenticated;

-- ---------- Judging (our team) ----------
-- Five parts, each scored 1 to 5. Weights are in the official rules on the website.
create table if not exists challenge_scores (
  entry_id     uuid not null references challenge_entries(id) on delete cascade,
  judge_id     uuid not null default auth.uid(),
  prompt       int not null check (prompt between 1 and 5),
  voice        int not null check (voice between 1 and 5),
  ideas        int not null check (ideas between 1 and 5),
  organization int not null check (organization between 1 and 5),
  mechanics    int not null check (mechanics between 1 and 5),
  note         text check (note is null or length(note) <= 2000),
  scored_at    timestamptz not null default now(),
  primary key (entry_id, judge_id)
);
alter table challenge_scores enable row level security;
drop policy if exists challenge_scores_team on challenge_scores;
create policy challenge_scores_team on challenge_scores for all to authenticated
  using (is_app_admin()) with check (is_app_admin() and judge_id = auth.uid());
grant select, insert, update, delete on challenge_scores to authenticated;

-- 100-point total: prompt 25, voice 25, ideas 20, organization 15, mechanics 15.
create or replace function challenge_points(sc challenge_scores) returns numeric
language sql immutable as $$
  select round((sc.prompt * 5 + sc.voice * 5 + sc.ideas * 4 + sc.organization * 3 + sc.mechanics * 3)::numeric, 1);
$$;

-- Entries to judge, names hidden. Team families are left out (they can't win).
create or replace function challenge_judging(p_challenge uuid) returns table (
  entry_id uuid, number int, title text, body text, words int, writing_days int, active_minutes int, saves int,
  big_jumps int, paste_blocked int, coach_checks int, versions int, submitted_at timestamptz,
  my_score jsonb, judges int, average numeric
) language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return query
    select e.id, (row_number() over (order by e.submitted_at, e.id))::int, e.title, e.body, e.words, e.writing_days,
           (e.active_seconds / 60)::int, e.saves, e.big_jumps, e.paste_blocked, e.coach_checks,
           (select count(*)::int from challenge_entry_versions v where v.entry_id = e.id), e.submitted_at,
           (select to_jsonb(s) - 'entry_id' - 'judge_id' from challenge_scores s where s.entry_id = e.id and s.judge_id = auth.uid()),
           (select count(*)::int from challenge_scores s where s.entry_id = e.id),
           (select round(avg(challenge_points(s)), 1) from challenge_scores s where s.entry_id = e.id)
      from challenge_entries e
     where e.challenge_id = p_challenge and e.status = 'submitted' and not e.team_family
     order by e.submitted_at, e.id;
end $$;
revoke all on function challenge_judging(uuid) from public, anon;
grant execute on function challenge_judging(uuid) to authenticated;

-- The writing history of one entry (snapshots), for a judge who wants to look closer.
create or replace function challenge_history(p_entry uuid) returns table (saved_at timestamptz, words int, body text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return query select v.saved_at, v.words, v.body from challenge_entry_versions v where v.entry_id = p_entry order by v.saved_at;
end $$;
revoke all on function challenge_history(uuid) from public, anon;
grant execute on function challenge_history(uuid) to authenticated;

-- Results with names (after judging), for picking winners and contacting families.
create or replace function challenge_results(p_challenge uuid) returns table (
  entry_id uuid, number int, first_name text, grade_level int, state text, parent_emails text, public_name_ok boolean,
  team_family boolean, average numeric, judges int, result text, place int, certificate_code text
) language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return query
    select e.id, (row_number() over (order by e.submitted_at, e.id))::int, s.first_name, s.grade_level, s.state::text,
           (select string_agg(u.email::text, ', ') from family_members m join auth.users u on u.id = m.user_id
             where m.family_id = s.family_id and m.role = 'parent'),
           coalesce(p.public_name_ok, false), e.team_family,
           (select round(avg(challenge_points(sc)), 1) from challenge_scores sc where sc.entry_id = e.id),
           (select count(*)::int from challenge_scores sc where sc.entry_id = e.id),
           e.result, e.place, e.certificate_code
      from challenge_entries e join students s on s.id = e.student_id
      left join challenge_permissions p on p.challenge_id = e.challenge_id and p.student_id = e.student_id
     where e.challenge_id = p_challenge and e.status = 'submitted'
     order by 9 desc nulls last, e.submitted_at;
end $$;
revoke all on function challenge_results(uuid) from public, anon;
grant execute on function challenge_results(uuid) to authenticated;

-- Our team marks a winner (with place) or finalist, or back to finisher.
create or replace function challenge_set_result(p_entry uuid, p_result text, p_place int) returns void
language plpgsql security definer set search_path = public as $$
declare e challenge_entries;
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  if p_result not in ('finisher', 'finalist', 'winner') then raise exception 'Pick winner, finalist or finisher.'; end if;
  select * into e from challenge_entries where id = p_entry;
  if not found or e.status <> 'submitted' then raise exception 'That entry wasn''t sent in.'; end if;
  if e.team_family and p_result <> 'finisher' then raise exception 'Families of our team can''t win.'; end if;
  if p_result = 'winner' and (p_place is null or p_place < 1) then raise exception 'Give the winner a place (1, 2, 3...).'; end if;
  perform set_config('st.challenge_rpc', 'on', true);
  update challenge_entries set result = p_result, place = case when p_result = 'winner' then p_place end where id = p_entry;
  perform set_config('st.challenge_rpc', 'off', true);
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = e.student_id), e.student_id, 'challenge_result', 'challenge_entries', p_entry::text,
          jsonb_build_object('result', p_result, 'place', p_place));
end $$;
revoke all on function challenge_set_result(uuid, text, int) from public, anon;
grant execute on function challenge_set_result(uuid, text, int) to authenticated;

-- ---------- Prize payments (our team) ----------
-- Cash prizes go to the parent or guardian (or an adult student). Kept separate from scholarships.
create table if not exists challenge_payouts (
  entry_id      uuid primary key references challenge_entries(id) on delete cascade,
  kind          text not null default 'cash' check (kind in ('cash', 'scholarship', 'gift_card')),
  amount        numeric(10, 2) not null check (amount >= 0 and amount <= 100000),
  paid_to       text check (paid_to is null or length(paid_to) <= 200),
  method        text check (method is null or length(method) <= 100),
  reference     text check (reference is null or length(reference) <= 200),
  status        text not null default 'to_pay' check (status in ('to_pay', 'waiting_on_family', 'paid')),
  paid_on       date,
  tax_form      boolean not null default false,
  note          text check (note is null or length(note) <= 2000),
  updated_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);
alter table challenge_payouts enable row level security;
drop policy if exists challenge_payouts_team on challenge_payouts;
create policy challenge_payouts_team on challenge_payouts for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on challenge_payouts to authenticated;
drop trigger if exists audit_challenge_payouts on challenge_payouts;
create trigger audit_challenge_payouts after insert or update or delete on challenge_payouts
  for each row execute function audit_row_change();

-- What a family sees about their own prize (no internal notes).
create or replace function challenge_my_prize(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare e challenge_entries; p challenge_payouts;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not (is_student_self(e.student_id) or can_parent_see_student(e.student_id)) then return null; end if;
  if (select status from challenges where id = e.challenge_id) <> 'done' then return null; end if;
  select * into p from challenge_payouts where entry_id = p_entry;
  if not found then return null; end if;
  return jsonb_build_object('kind', p.kind, 'amount', p.amount, 'status', p.status, 'paid_on', p.paid_on);
end $$;
revoke all on function challenge_my_prize(uuid) from public, anon;
grant execute on function challenge_my_prize(uuid) to authenticated;

-- The audit trigger above reads student_id from the row; payouts have entry_id instead, so
-- add it as a plain column kept in step for the log.
alter table challenge_payouts add column if not exists student_id uuid;
create or replace function challenge_payouts_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.student_id := (select student_id from challenge_entries where id = new.entry_id);
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists challenge_payouts_fill on challenge_payouts;
create trigger challenge_payouts_fill before insert or update on challenge_payouts
  for each row execute function challenge_payouts_fill();
