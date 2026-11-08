\set ON_ERROR_STOP on
\o /dev/null
-- Practice competitions: the team sets questions (key hidden from families), the student
-- starts after a parent signs, answers once each within the time, right/wrong stays hidden
-- until it closes, scoring is automatic (harder counts more, faster wins ties), team families
-- can't win, and winners are never public.
-- People: parent (67a1), students Ana (67b1) and Ben (67b2), team member (67c1).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000067a1', 'mom67@example.com'),
  ('00000000-0000-0000-0000-0000000067b1', 'ana67@example.com'),
  ('00000000-0000-0000-0000-0000000067b2', 'ben67@example.com'),
  ('00000000-0000-0000-0000-0000000067c1', 'team67@example.com');
insert into app_admins values ('00000000-0000-0000-0000-0000000067c1') on conflict do nothing;
create temp table r67 (k text primary key, v text);
grant all on r67 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067a1', false);
insert into r67 values ('fam', create_family('Compete Test')::text);
insert into r67 values ('ana', add_student((select v::uuid from r67 where k='fam'), 'Ana', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r67 values ('ben', add_student((select v::uuid from r67 where k='fam'), 'Ben', (current_date - interval '15 years')::date, 10, 'GA')::text);
insert into r67 values ('acode', create_student_invite((select v::uuid from r67 where k='ana')));
insert into r67 values ('bcode', create_student_invite((select v::uuid from r67 where k='ben')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b1', false);
select accept_student_invite((select v from r67 where k='acode'));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b2', false);
select accept_student_invite((select v from r67 where k='bcode'));

-- The team makes a competition with three questions (levels 3, 4, 5); one stays pending.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067c1', false);
with x as (insert into challenges (kind, title, subject, prompt, grade_min, grade_max, opens_at, closes_at, status, time_minutes, prizes)
  values ('practice', 'Algebra I Showdown', 'Algebra I', 'Answer as many as you can in 20 minutes.', 9, 12, now() - interval '1 hour', now() + interval '7 days', 'open', 20,
          '[{"place":1,"label":"1st place","kind":"gift_card","amount":100}]') returning id)
insert into r67 select 'ch', id::text from x;
insert into challenge_questions (challenge_id, n, topic, level, question, options, answer_index, status)
select (select v::uuid from r67 where k='ch'), n, 'Algebra', least(n + 2, 5), 'Question number ' || n, '["a","b","c","d"]', 1, case when n = 4 then 'pending' else 'approved' end
from generate_series(1, 4) n;

-- Families never see the key.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067a1', false);
do $$ begin
  assert (select count(*) from challenge_questions) = 0, 'families cannot read the questions table';
end $$;

-- Ana enters; she can't start until a parent signs.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b1', false);
with x as (insert into challenge_entries (challenge_id, student_id, body) values ((select v::uuid from r67 where k='ch'), (select v::uuid from r67 where k='ana'), 'sneaky') returning id)
insert into r67 select 'ae', id::text from x;
do $$
declare e uuid := (select v::uuid from r67 where k='ae');
begin
  assert (select body from challenge_entries where id = e) = '', 'no essay text in a competition';
  begin
    perform challenge_practice_start(e);
    raise exception 'FAIL: started without permission';
  exception when others then if sqlerrm not like '%sign permission%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067a1', false);
do $$
declare ch uuid := (select v::uuid from r67 where k='ch');
begin
  perform test_sign('challenge', (select v::uuid from r67 where k='ana'), ch::text);
  perform challenge_give_permission(ch, (select v::uuid from r67 where k='ana'), true);
  perform test_sign('challenge', (select v::uuid from r67 where k='ben'), ch::text);
  perform challenge_give_permission(ch, (select v::uuid from r67 where k='ben'), true);
  assert (select bool_and(not public_name_ok) from challenge_permissions where challenge_id = ch), 'competition winners are never public';
  -- A parent can't take it for the student.
  begin
    perform challenge_practice_start((select v::uuid from r67 where k='ae'));
    raise exception 'FAIL: parent started it';
  exception when others then if sqlerrm not like '%Only the student%' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b1', false);
do $$
declare e uuid := (select v::uuid from r67 where k='ae'); s jsonb;
begin
  s := challenge_practice_start(e);
  assert jsonb_array_length(s -> 'questions') = 3, 'only approved questions';
  assert not (s::text like '%answer_index%'), 'the key is never sent';
  perform challenge_practice_answer(e, 1, 1);  -- right, 3 points
  perform challenge_practice_answer(e, 1, 0);  -- second try ignored
  perform challenge_practice_answer(e, 2, 0);  -- wrong
  perform challenge_practice_answer(e, 3, 1);  -- right, 5 points
  assert (select points from challenge_entries where id = e) = 0, 'score hidden while running';
  assert (s ->> 'ends_at')::timestamptz > now() + interval '19 minutes', 'timer from the challenge';
  -- She can't edit the score by hand.
  update challenge_entries set points = 999, status = 'submitted' where id = e;
  assert (select points from challenge_entries where id = e) = 0 and (select status from challenge_entries where id = e) = 'draft', 'score is server-only';
  assert (select challenge_practice_finish(e)) is not null, 'finish gives a certificate code';
  assert (select points from challenge_entries where id = e) = 8 and (select correct from challenge_entries where id = e) = 2, 'harder questions count more';
  assert challenge_practice_review(e) is null, 'answer key hidden until it closes';
  begin
    perform challenge_practice_answer(e, 2, 1);
    raise exception 'FAIL: answered after finishing';
  exception when others then if sqlerrm not like '%isn''t running%' then raise; end if; end;
end $$;

-- Ben gets the same points but is slower; he started earlier.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b2', false);
with x as (insert into challenge_entries (challenge_id, student_id) values ((select v::uuid from r67 where k='ch'), (select v::uuid from r67 where k='ben')) returning id)
insert into r67 select 'be', id::text from x;
do $$
declare e uuid := (select v::uuid from r67 where k='be');
begin
  perform challenge_practice_start(e);
  perform challenge_practice_answer(e, 1, 1);
  perform challenge_practice_answer(e, 3, 1);
end $$;
reset role;
update challenge_entries set started_at = now() - interval '10 minutes' where id = (select v::uuid from r67 where k='be');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b2', false);
select challenge_practice_finish((select v::uuid from r67 where k='be'));

-- The team can't award while it's open; after closing, Ana (faster) wins.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067c1', false);
do $$
declare ch uuid := (select v::uuid from r67 where k='ch');
begin
  begin
    perform challenge_practice_award(ch);
    raise exception 'FAIL: awarded while open';
  exception when others then if sqlerrm not like '%Close the competition%' then raise; end if; end;
  update challenges set status = 'judging' where id = ch;
  assert challenge_practice_award(ch) = 1, 'one prize, one winner';
  assert (select first_name from challenge_practice_results(ch) where rank = 1) = 'Ana', 'ties go to the faster finish';
  assert (select result from challenge_entries where id = (select v::uuid from r67 where k='ae')) = 'winner', 'winner marked';
  assert (select result from challenge_entries where id = (select v::uuid from r67 where k='be')) = 'finisher', 'others finish';
end $$;

-- After it closes the student sees the key; strangers see nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067b1', false);
do $$ begin
  assert jsonb_array_length(challenge_practice_review((select v::uuid from r67 where k='ae'))) = 3, 'review after close';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a9', false);
do $$ begin
  assert challenge_practice_review((select v::uuid from r67 where k='ae')) is null, 'stranger sees no review';
  begin
    perform challenge_practice_results((select v::uuid from r67 where k='ch'));
    raise exception 'FAIL: stranger read results';
  exception when others then if sqlerrm not like '%ScholarTasks team%' then raise; end if; end;
end $$;
reset role;
\o
\echo PRACTICE COMPETITION CHECKS PASSED
