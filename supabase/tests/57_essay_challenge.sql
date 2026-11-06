\set ON_ERROR_STOP on
\o /dev/null
-- Essay challenge: only the student writes, pasting is refused, grades and dates are checked,
-- submitting needs a signed parent permission, results and certificates are team-only,
-- team families can't win, and the certificate check shows only a first name.
-- People: parent (57a1), student Zoe 16 (57b1), team member (57c1) with own student Max (57d1).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000057a1', 'mom57@example.com'),
  ('00000000-0000-0000-0000-0000000057b1', 'zoe57@example.com'),
  ('00000000-0000-0000-0000-0000000057c1', 'team57@example.com'),
  ('00000000-0000-0000-0000-0000000057d1', 'max57@example.com');
insert into app_admins values ('00000000-0000-0000-0000-0000000057c1') on conflict do nothing;
create temp table r57 (k text primary key, v text);
grant all on r57 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057a1', false);
insert into r57 values ('fam', create_family('Challenge Test')::text);
insert into r57 values ('zoe', add_student((select v::uuid from r57 where k='fam'), 'Zoe', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r57 values ('code', create_student_invite((select v::uuid from r57 where k='zoe')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057b1', false);
select accept_student_invite((select v from r57 where k='code'));
-- Team member's family.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057c1', false);
insert into r57 values ('tfam', create_family('Team Family')::text);
insert into r57 values ('max', add_student((select v::uuid from r57 where k='tfam'), 'Max', (current_date - interval '16 years')::date, 10, 'GA')::text);
insert into r57 values ('tcode', create_student_invite((select v::uuid from r57 where k='max')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057d1', false);
select accept_student_invite((select v from r57 where k='tcode'));

-- Only the team creates challenges.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057a1', false);
do $$ begin
  begin
    insert into challenges (title, prompt, grade_min, grade_max, opens_at, closes_at) values ('Nope', 'A prompt here', 9, 12, now(), now() + interval '1 day');
    raise exception 'FAIL: parent made a challenge';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057c1', false);
with x as (insert into challenges (title, subject, prompt, grade_min, grade_max, min_words, max_words, opens_at, closes_at, status, prizes)
  values ('Test challenge', 'Science', 'Tell us about an animal you care for.', 10, 12, 50, 400, now() - interval '1 hour', now() + interval '7 days', 'open',
          '[{"place":1,"label":"1st place","kind":"cash","amount":250}]') returning id)
insert into r57 select 'ch', id::text from x;
with x as (insert into challenges (title, prompt, grade_min, grade_max, opens_at, closes_at, status)
  values ('Middle school', 'A prompt for younger students', 6, 8, now() - interval '1 hour', now() + interval '7 days', 'open') returning id)
insert into r57 select 'ch68', id::text from x;

-- The student starts an entry. Wrong grade and pasted text are refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057b1', false);
do $$
declare zoe uuid := (select v::uuid from r57 where k='zoe'); ch uuid := (select v::uuid from r57 where k='ch'); eid uuid; w text;
begin
  begin
    insert into challenge_entries (challenge_id, student_id) values ((select v::uuid from r57 where k='ch68'), zoe);
    raise exception 'FAIL: wrong grade allowed';
  exception when raise_exception then if sqlerrm not like 'This challenge is for grades%' then raise; end if; end;
  begin
    insert into challenge_entries (challenge_id, student_id, body) values (ch, zoe, repeat('pasted words ', 60));
    raise exception 'FAIL: big paste on insert';
  exception when raise_exception then if sqlerrm not like 'Type your essay%' then raise; end if; end;
  insert into challenge_entries (challenge_id, student_id, status, result, certificate_code) values (ch, zoe, 'submitted', 'winner', 'HACK') returning id into eid;
  if (select status from challenge_entries where id = eid) <> 'draft' or (select certificate_code from challenge_entries where id = eid) is not null then
    raise exception 'FAIL: student set status or certificate';
  end if;
  insert into r57 values ('entry', eid::text);
  -- Typing in small saves works; a giant jump is refused.
  w := repeat('horse ', 40);
  update challenge_entries set body = w, active_seconds = 999999 where id = eid;
  if (select words from challenge_entries where id = eid) <> 40 then raise exception 'FAIL: word count'; end if;
  if (select active_seconds from challenge_entries where id = eid) > 100 then raise exception 'FAIL: time not capped'; end if;
  if (select writing_days from challenge_entries where id = eid) <> 1 then raise exception 'FAIL: writing days'; end if;
  if not exists (select 1 from challenge_entry_versions where entry_id = eid) and (select count(*) from challenge_entry_versions) <> 0 then null; end if;
  begin
    update challenge_entries set body = w || repeat('pasted words ', 200) where id = eid;
    raise exception 'FAIL: big paste on update';
  exception when raise_exception then if sqlerrm not like 'Type your essay%' then raise; end if; end;
  update challenge_entries set body = w || repeat('mare ', 30), result = 'winner' where id = eid;
  if (select result from challenge_entries where id = eid) is not null then raise exception 'FAIL: student set result'; end if;
  -- No permission yet: can't submit.
  begin
    perform challenge_submit(eid);
    raise exception 'FAIL: submitted without permission';
  exception when raise_exception then if sqlerrm not like 'A parent or guardian%' then raise; end if; end;
  -- A student (16) can't sign or give permission.
  begin
    perform challenge_give_permission(ch, zoe, true);
    raise exception 'FAIL: student gave permission';
  exception when raise_exception then if sqlerrm not like 'Only this student%' then raise; end if; end;
end $$;

-- The parent can read but not write the essay, then signs permission.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057a1', false);
do $$
declare zoe uuid := (select v::uuid from r57 where k='zoe'); ch uuid := (select v::uuid from r57 where k='ch'); eid uuid := (select v::uuid from r57 where k='entry');
begin
  if not exists (select 1 from challenge_entries where id = eid) then raise exception 'FAIL: parent cannot read'; end if;
  update challenge_entries set body = 'parent wrote this' where id = eid;
  if (select body from challenge_entries where id = eid) = 'parent wrote this' then raise exception 'FAIL: parent wrote the essay'; end if;
  begin
    perform challenge_give_permission(ch, zoe, true);
    raise exception 'FAIL: permission without signature';
  exception when raise_exception then if sqlerrm not like 'Please confirm%' then raise; end if; end;
  perform test_sign('challenge', zoe, ch::text);
  perform challenge_give_permission(ch, zoe, true);
  if not (select public_name_ok from challenge_permissions where student_id = zoe) then raise exception 'FAIL: permission not saved'; end if;
end $$;

-- The student submits, can't change it after, and claims a certificate.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057b1', false);
do $$
declare eid uuid := (select v::uuid from r57 where k='entry'); code text; cert jsonb;
begin
  code := challenge_submit(eid);
  if length(code) <> 10 then raise exception 'FAIL: no certificate code'; end if;
  begin
    update challenge_entries set body = 'changed after' where id = eid;
    raise exception 'FAIL: changed after submit';
  exception when raise_exception then if sqlerrm not like 'This essay was already sent in%' then raise; end if; end;
  if challenge_claim(eid) <> code then raise exception 'FAIL: claim'; end if;
  insert into r57 values ('cert', code);
  begin
    perform challenge_judging((select v::uuid from r57 where k='ch'));
    raise exception 'FAIL: student saw judging';
  exception when raise_exception then if sqlerrm not like 'This is for%' then raise; end if; end;
  if exists (select 1 from challenge_entry_versions) then raise exception 'FAIL: student read versions'; end if;
end $$;

-- Team member's own student can practice but is left out of judging and can't win.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057d1', false);
do $$
declare mx uuid := (select v::uuid from r57 where k='max'); eid uuid;
begin
  insert into challenge_entries (challenge_id, student_id) values ((select v::uuid from r57 where k='ch'), mx) returning id into eid;
  if not (select team_family from challenge_entries where id = eid) then raise exception 'FAIL: team family not marked'; end if;
  insert into r57 values ('maxentry', eid::text);
end $$;

-- The team judges with names hidden, picks a winner and records the prize.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057c1', false);
do $$
declare ch uuid := (select v::uuid from r57 where k='ch'); eid uuid := (select v::uuid from r57 where k='entry'); cert jsonb;
begin
  if (select count(*) from challenge_judging(ch)) <> 1 then raise exception 'FAIL: judging list'; end if;
  insert into challenge_scores (entry_id, prompt, voice, ideas, organization, mechanics) values (eid, 5, 5, 4, 4, 3);
  if (select average from challenge_judging(ch)) <> 87.0 then raise exception 'FAIL: points %', (select average from challenge_judging(ch)); end if;
  perform challenge_set_result(eid, 'winner', 1);
  begin
    perform challenge_set_result((select v::uuid from r57 where k='maxentry'), 'winner', 2);
    raise exception 'FAIL: team family result';
  exception when raise_exception then if sqlerrm not like 'That entry wasn''t sent in%' and sqlerrm not like 'Families of our team%' then raise; end if; end;
  -- Before results are published, the certificate shows "finisher".
  cert := challenge_certificate((select v from r57 where k='cert'));
  if cert->>'result' <> 'finisher' then raise exception 'FAIL: winner shown early'; end if;
  update challenges set status = 'done', results_on = current_date where id = ch;
  cert := challenge_certificate(lower((select v from r57 where k='cert')));
  if cert->>'result' <> 'winner' or (cert->>'place')::int <> 1 or cert->>'first_name' <> 'Zoe' then raise exception 'FAIL: certificate %', cert; end if;
  if cert ? 'state' or cert ? 'email' then raise exception 'FAIL: certificate shows too much'; end if;
  insert into challenge_payouts (entry_id, kind, amount, paid_to, method, status, paid_on) values (eid, 'cash', 250, 'Test Parent', 'Check', 'paid', current_date);
  if (select parent_emails from challenge_results(ch) where entry_id = eid) <> 'mom57@example.com' then raise exception 'FAIL: results emails'; end if;
end $$;

-- The family sees their prize; anyone signed out can check the certificate.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057a1', false);
do $$ begin
  if (challenge_my_prize((select v::uuid from r57 where k='entry'))->>'status') <> 'paid' then raise exception 'FAIL: my prize'; end if;
  if exists (select 1 from challenge_payouts) then raise exception 'FAIL: parent read payouts table'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  if challenge_certificate((select v from r57 where k='cert')) is null then raise exception 'FAIL: anon certificate check'; end if;
  if challenge_certificate('NOTREAL123') is not null then raise exception 'FAIL: fake certificate'; end if;
  if (select count(*) from challenges) <> 2 then raise exception 'FAIL: anon read challenges'; end if;
end $$;
reset role;
\o
\echo 57 essay challenge OK
