\set ON_ERROR_STOP on
\o /dev/null
-- Weekly progress email: only parents of students who used the helper get it, never twice
-- for the same week, the opt-out works, and a parent can only see their own log rows.
-- People: parent (59a1), student Mia (59b1), a stranger (59c1).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000059a1', 'Mom59@example.com'),
  ('00000000-0000-0000-0000-0000000059b1', 'mia59@example.com'),
  ('00000000-0000-0000-0000-0000000059c1', 'other59@example.com');
create temp table r59 (k text primary key, v text);
grant all on r59 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000059a1', false);
insert into r59 values ('fam', create_family('Progress Email Test')::text);
insert into r59 values ('mia', add_student((select v::uuid from r59 where k='fam'), 'Mia', (current_date - interval '15 years')::date, 10, 'GA')::text);
insert into r59 values ('ava', add_student((select v::uuid from r59 where k='fam'), 'Ava', (current_date - interval '14 years')::date, 9, 'GA')::text);
reset role;

do $$
declare
  mia uuid := (select v::uuid from r59 where k='mia');
  wk date := date '2026-11-02';
  n int;
begin
  -- Nobody used the helper yet: no email.
  if exists (select 1 from progress_email_due(wk)) then raise exception 'FAIL: email with no helper use'; end if;

  -- Mia used it two weeks ago (inside the four-week window); Ava never did.
  insert into homework_log (student_id, user_id, created_at, subject, help_type, hints, solved)
    values (mia, '00000000-0000-0000-0000-0000000059b1', timestamptz '2026-10-21 18:00+00', 'Math', 'hint', 2, true);
  select count(*) into n from progress_email_due(wk);
  if n <> 1 then raise exception 'FAIL: expected 1 due row, got %', n; end if;
  if (select first_name from progress_email_due(wk)) <> 'Mia' then raise exception 'FAIL: wrong student'; end if;
  if (select lang from progress_email_due(wk)) <> 'en' then raise exception 'FAIL: default language'; end if;

  -- Use from more than four weeks back doesn't count.
  if exists (select 1 from progress_email_due(date '2026-12-07')) then raise exception 'FAIL: old use still emails'; end if;

  -- Sent once: not due again that week, and next week sees the tactic.
  insert into progress_email_log (user_id, student_id, week_start, trend, tactic)
    values ('00000000-0000-0000-0000-0000000059a1', mia, wk, 'steady', 'Ten-minute timer');
  if exists (select 1 from progress_email_due(wk)) then raise exception 'FAIL: sent twice'; end if;
  if (select last_tactic from progress_email_due(wk + 7)) <> 'Ten-minute timer' then raise exception 'FAIL: last tactic missing'; end if;

  -- Helper turned off for Mia: no email.
  insert into homework_settings (student_id, enabled) values (mia, false);
  if exists (select 1 from progress_email_due(wk + 7)) then raise exception 'FAIL: helper off still emails'; end if;
  update homework_settings set enabled = true where student_id = mia;

  -- The email link turns it off (email matched without caring about capitals).
  perform progress_emails_off('mom59@EXAMPLE.com ');
  if exists (select 1 from progress_email_due(wk + 7)) then raise exception 'FAIL: opt-out ignored'; end if;
  update user_settings set progress_emails = true where user_id = '00000000-0000-0000-0000-0000000059a1';
  if not exists (select 1 from progress_email_due(wk + 7)) then raise exception 'FAIL: turning back on'; end if;
end $$;

-- Signed-in people can't call the server-only functions, and only see their own log rows.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000059c1', false);
do $$ begin
  begin
    perform progress_email_due(date '2026-11-02');
    raise exception 'FAIL: a user could list who gets emails';
  exception when insufficient_privilege then null; end;
  begin
    perform progress_emails_off('mom59@example.com');
    raise exception 'FAIL: a user could turn off someone else''s email';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from progress_email_log) then raise exception 'FAIL: stranger sees log rows'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000059a1', false);
do $$ begin
  if (select count(*) from progress_email_log) <> 1 then raise exception 'FAIL: parent should see their row'; end if;
  -- The parent switches the email from the Homework Helper page.
  update user_settings set progress_emails = false where user_id = auth.uid();
  if (select progress_emails from user_settings where user_id = auth.uid()) then raise exception 'FAIL: parent switch'; end if;
end $$;
reset role;
\o
\echo 59 progress emails OK
