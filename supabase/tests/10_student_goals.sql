\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Diazes')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Leo', '2010-01-01', 10, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
select set_student_permission((select v::uuid from g where k='student'), 'enter_grades', false);

do $$ begin
  assert (select goal_gpa from students where id = (select v::uuid from g where k='student')) is null and (select min_grade from students where id = (select v::uuid from g where k='student')) = 'B', 'defaults: no goal, B standard';
  perform set_student_goal((select v::uuid from g where k='student'), 2.8, 'C');
  assert (select goal_gpa from students where id = (select v::uuid from g where k='student')) = 2.8 and (select min_grade from students where id = (select v::uuid from g where k='student')) = 'C', 'parent saved goal';
  begin
    perform set_student_goal((select v::uuid from g where k='student'), 3.5, 'E');
    raise exception 'FAIL: grade E accepted';
  exception when check_violation then null; end;
end $$;

-- Student without grade entry permission can't change it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  begin
    perform set_student_goal((select v::uuid from g where k='student'), 4.0, 'A');
    raise exception 'FAIL: student changed goal without permission';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- A stranger can't.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c9', false);
do $$ begin
  begin
    perform set_student_goal((select v::uuid from g where k='student'), 4.0, 'A');
    raise exception 'FAIL: stranger changed goal';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
\o
\echo STUDENT GOAL CHECKS PASSED
