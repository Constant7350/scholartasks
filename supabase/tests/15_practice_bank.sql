\set ON_ERROR_STOP on
\o /dev/null
insert into app_admins values ('00000000-0000-0000-0000-0000000001a0') on conflict do nothing;
\i seed/practice_questions.sql
\i seed/practice_questions.sql
do $$ begin
  assert (select count(*) from practice_questions) = 56, 'starter questions load once';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Kims')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Joon', '2010-01-01', 10, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));

do $$
declare s uuid := (select v::uuid from g where k='student'); qid uuid := (select id from practice_questions where kind = 'mc' limit 1);
begin
  assert (select count(*) from practice_questions) = 56, 'family sees pending questions';
  insert into practice_attempts (student_id, question_id, correct) values (s, qid, true);
  update practice_questions set question = 'hacked' where id = qid;
  assert (select count(*) from practice_questions where question = 'hacked') = 0, 'family cannot edit questions';
end $$;

-- The student records their own attempts only.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a5', false);
do $$
declare s uuid := (select v::uuid from g where k='student'); qid uuid := (select id from practice_questions where kind = 'mc' limit 1);
begin
  perform accept_student_invite((select v from g where k='code'));
  insert into practice_attempts (student_id, question_id, correct) values (s, qid, false);
  assert (select count(*) from practice_attempts) = 2, 'student sees own attempts';
end $$;

-- The reviewer rejects a question; families no longer see it. Bad MC data is refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a0', false);
do $$ begin
  update practice_questions set status = 'rejected' where id = (select id from practice_questions where kind = 'mc' order by id limit 1);
  update practice_questions set status = 'approved' where kind = 'written';
  assert (select count(*) from practice_attempts) = 0, 'reviewer cannot see family attempts';
  begin
    insert into practice_questions (subject, topic, kind, question, options, answer_index) values ('Math', 'Test', 'mc', 'What is 1 + 1?', '["2","3"]', 5);
    raise exception 'FAIL: bad answer index accepted';
  exception when check_violation then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a1', false);
do $$ begin
  assert (select count(*) from practice_questions) = 55, 'rejected question hidden from families';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a9', false);
do $$ begin
  assert (select count(*) from practice_attempts) = 0, 'stranger sees no attempts';
  begin
    insert into practice_attempts (student_id, question_id, correct) values ((select v::uuid from g where k='student'), (select id from practice_questions limit 1), true);
    raise exception 'FAIL: stranger recorded an attempt';
  exception when insufficient_privilege then null; end;
end $$;
\o
\echo PRACTICE BANK CHECKS PASSED
