\set ON_ERROR_STOP on
\o /dev/null
-- SAT/ACT questions load once, stay out of plain school subjects, and can share passages.
\i seed/test_prep_questions.sql
\i seed/test_prep_questions.sql
do $$ begin
  assert (select count(*) from practice_questions where exam is not null) = 601, 'test prep questions load once';
  assert (select count(*) from practice_questions where exam = 'SAT') = 201, 'SAT questions';
  assert (select count(distinct passage) from practice_questions where subject = 'ACT Reading') = 25, 'reading questions share passages';
  assert (select count(*) from practice_questions where exam is not null and status <> 'pending') = 0, 'new questions wait for review';
  begin
    insert into practice_questions (exam, subject, topic, kind, question, options, answer_index) values ('GRE', 'GRE Math', 'Test', 'mc', 'What is 2 + 2?', '["4","5"]', 0);
    raise exception 'FAIL: unknown exam accepted';
  exception when check_violation then null; end;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000019a1', false);
create temp table tp (k text primary key, v text);
insert into tp values ('family', create_family('The Ortizes')::text);
insert into tp values ('student', add_student((select v::uuid from tp where k='family'), 'Lena', '2009-03-01', 11, 'GA')::text);
insert into tp values ('code', create_student_invite((select v::uuid from tp where k='student')));

-- A parent saves a practice test result.
do $$
declare s uuid := (select v::uuid from tp where k='student');
begin
  insert into test_prep_results (student_id, exam, sections, estimate, minutes)
    values (s, 'SAT', '{"SAT Math": {"right": 10, "total": 14, "estimate": 630}}', 1210, 40);
  assert (select count(*) from test_prep_results) = 1, 'parent sees result';
  begin
    insert into test_prep_results (student_id, exam, sections, estimate) values (s, 'SAT', '[]', 1200);
    raise exception 'FAIL: sections must be an object';
  exception when check_violation then null; end;
end $$;

-- The student saves and sees their own results.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000019a5', false);
do $$
declare s uuid := (select v::uuid from tp where k='student');
begin
  perform accept_student_invite((select v from tp where k='code'));
  insert into test_prep_results (student_id, exam, sections, estimate) values (s, 'ACT', '{}', 27);
  assert (select count(*) from test_prep_results) = 2, 'student sees own results';
end $$;

-- A stranger sees nothing and can't write.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000019a9', false);
do $$ begin
  assert (select count(*) from test_prep_results) = 0, 'stranger sees no results';
  begin
    insert into test_prep_results (student_id, exam, sections, estimate) values ((select v::uuid from tp where k='student'), 'SAT', '{}', 1600);
    raise exception 'FAIL: stranger saved a result';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\o
\echo TEST PREP CHECKS PASSED
