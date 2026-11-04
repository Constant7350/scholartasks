\set ON_ERROR_STOP on
\o /dev/null
-- Parent a1 with student Mia (connected as a5); stranger a9.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002a1', false);
create temp table fa (k text primary key, v text);
grant all on fa to authenticated, service_role;
insert into fa values ('family', create_family('The Aids')::text);
insert into fa values ('student', add_student((select v::uuid from fa where k='family'), 'Mia', '2008-05-01', 12, 'GA')::text);
insert into fa values ('code', create_student_invite((select v::uuid from fa where k='student')));

do $$
declare s uuid := (select v::uuid from fa where k='student');
begin
  insert into aid_progress (student_id, cycle, step_id, status) values (s, '2027-28', 'student-account', 'done');
  insert into aid_households (student_id, answers) values (s, '{"parents":"married","filed_jointly":true}');
  assert (select count(*) from aid_progress) = 1, 'parent saves a step';
  begin
    update aid_households set answers = '{"note":"123-45-6789"}' where student_id = s;
    raise exception 'FAIL: SSN-like text accepted';
  exception when check_violation then null; end;
  begin
    insert into aid_progress (student_id, cycle, step_id, status) values (s, '2027-28', 'Bad Id!', 'done');
    raise exception 'FAIL: bad step id accepted';
  exception when check_violation then null; end;
end $$;

-- The student ticks steps and documents but cannot change the household answers.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002a5', false);
do $$
declare s uuid := (select v::uuid from fa where k='student');
begin
  perform accept_student_invite((select v from fa where k='code'));
  assert (select count(*) from aid_progress) = 1, 'student sees progress';
  insert into aid_progress (student_id, cycle, step_id, status) values (s, '2027-28', 'ga-gafutures-account', 'done');
  update aid_households set docs_found = '{cash}' where student_id = s;
  assert (select docs_found from aid_households) = '{cash}', 'student ticks a document';
  begin
    update aid_households set answers = '{"parents":"single_widowed"}' where student_id = s;
    raise exception 'FAIL: student changed household answers';
  exception when insufficient_privilege then null; end;
end $$;

-- A stranger sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000002a9', false);
do $$ begin
  assert (select count(*) from aid_progress) = 0, 'stranger sees no progress';
  assert (select count(*) from aid_households) = 0, 'stranger sees no household';
end $$;
reset role;
\o
\echo FINANCIAL AID CHECKS PASSED
