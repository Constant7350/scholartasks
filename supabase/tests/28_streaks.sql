\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000341', false);
create temp table h7 (k text primary key, v text);
insert into h7 values ('family', create_family('The Lees')::text);
insert into h7 values ('student', add_student((select v::uuid from h7 where k='family'), 'Min', '2010-01-01', 10, 'GA')::text);
do $$
declare s uuid := (select v::uuid from h7 where k='student'); t uuid;
begin
  insert into tasks (student_id, title) values (s, 'Ask for a recommendation') returning id into t;
  assert (select count(*) from student_progress_days where student_id = s) = 0, 'adding a to-do is not progress yet';
  update tasks set status = 'done' where id = t;
  insert into student_activities (student_id, position) values (s, 'Member');
  assert (select actions from student_progress_days where student_id = s) = 2, 'ticking a to-do and adding an activity count';
  begin
    insert into student_progress_days (student_id, day) values (s, '2020-01-01');
    raise exception 'FAIL: family wrote progress directly';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000349', false);
do $$ begin
  assert (select count(*) from student_progress_days) = 0, 'stranger sees no progress';
end $$;
reset role;
\o
\echo STREAK CHECKS PASSED
