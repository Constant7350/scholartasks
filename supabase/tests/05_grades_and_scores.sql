\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Parks')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Jin', '2009-01-01', 11, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
select set_student_permission((select v::uuid from g where k='student'), 'enter_grades', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  insert into course_grades (student_id, term, course, grade, level, core, grade_level)
    values ((select v::uuid from g where k='student'), 'Fall', 'Algebra II', 'A', 'honors', true, 11),
           ((select v::uuid from g where k='student'), 'Fall', 'Typo class', 'C', 'standard', true, 11);
  delete from course_grades where course = 'Typo class';
  assert (select count(*) from course_grades) = 1, 'student removed own typo';
  perform set_test_scores((select v::uuid from g where k='student'), 1310, null);
  assert (select sat from students) = 1310, 'student saved SAT';
  begin
    perform set_test_scores((select v::uuid from g where k='student'), 2000, null);
    raise exception 'FAIL: impossible SAT accepted';
  exception when check_violation then null; end;
end $$;

-- Parent turns grade entry off: student can no longer save scores.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_student_permission((select v::uuid from g where k='student'), 'enter_grades', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
do $$ begin
  begin
    perform set_test_scores((select v::uuid from g where k='student'), 1400, 30);
    raise exception 'FAIL: student saved scores without permission';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- A stranger can't.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
do $$ begin
  begin
    perform set_test_scores((select v::uuid from g where k='student'), 1400, 30);
    raise exception 'FAIL: stranger saved scores';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;
\o
\echo GRADES AND SCORES CHECKS PASSED
