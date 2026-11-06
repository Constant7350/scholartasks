\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', false);
create temp table h40 (k text primary key, v text);
insert into h40 values ('family', create_family('The Planners')::text);
insert into h40 values ('student', add_student((select v::uuid from h40 where k='family'), 'Emma', '2011-03-01', 9, 'GA')::text);
insert into h40 values ('code', create_student_invite((select v::uuid from h40 where k='student')));

do $$
declare s uuid := (select v::uuid from h40 where k='student');
begin
  insert into course_plan (student_id, grade_level, course, subject, level) values (s, 9, 'Biology', 'Science', 'standard');
  insert into course_plan (student_id, grade_level, course, subject, level) values (s, 11, 'AP Biology', 'Science', 'AP');
  assert (select count(*) from course_plan where student_id = s) = 2, 'parent plans courses';
  begin
    insert into course_plan (student_id, grade_level, course) values (s, 8, 'Too early');
    raise exception 'FAIL: grade 8 accepted';
  exception when check_violation then null; end;
  begin
    insert into course_plan (student_id, grade_level, course, level) values (s, 10, 'Bad level', 'expert');
    raise exception 'FAIL: unknown level accepted';
  exception when check_violation then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000405', false);
do $$
declare s uuid := (select v::uuid from h40 where k='student');
begin
  perform accept_student_invite((select v from h40 where k='code'));
  assert (select count(*) from course_plan) = 2, 'student sees the plan';
  insert into course_plan (student_id, grade_level, course, subject) values (s, 10, 'Chemistry', 'Science');
  update course_plan set level = 'honors' where course = 'Chemistry';
  assert (select level from course_plan where course = 'Chemistry') = 'honors', 'student edits the plan';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000409', false);
do $$ begin
  assert (select count(*) from course_plan) = 0, 'stranger sees no plan';
  update course_plan set course = 'hacked';
  delete from course_plan;
end $$;
reset role;
do $$ begin
  assert (select count(*) from course_plan where course = 'hacked') = 0, 'stranger cannot edit';
  assert (select count(*) from course_plan) = 3, 'stranger cannot delete';
  assert (select count(*) from audit_log where target = 'course_plan') >= 3, 'changes are audited';
end $$;
\o
\echo COURSE PLAN CHECKS PASSED
