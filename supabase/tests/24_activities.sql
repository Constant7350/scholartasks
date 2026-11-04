\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', false);
create temp table h3 (k text primary key, v text);
insert into h3 values ('family', create_family('The Nguyens')::text);
insert into h3 values ('student', add_student((select v::uuid from h3 where k='family'), 'Mai', '2009-05-01', 11, 'GA')::text);
insert into h3 values ('code', create_student_invite((select v::uuid from h3 where k='student')));

-- The parent adds an activity and an honor.
do $$
declare s uuid := (select v::uuid from h3 where k='student');
begin
  insert into student_activities (student_id, kind, category, position, organization, description, grades, hours_per_week, weeks_per_year)
    values (s, 'activity', 'work', 'Barn helper', 'Oak Hill Horse Farm', 'Feed and groom 12 horses; train younger helpers.', '{10,11}', 10, 40);
  insert into student_activities (student_id, kind, position, grades, recognition)
    values (s, 'honor', 'Honor roll', '{9,10}', 'school');
  assert (select count(*) from student_activities where student_id = s) = 2, 'parent adds activities';
  begin
    insert into student_activities (student_id, position, description) values (s, 'Too long', repeat('x', 151));
    raise exception 'FAIL: description over 150 characters accepted';
  exception when check_violation then null; end;
  begin
    insert into student_activities (student_id, position, grades) values (s, 'Bad grade', '{13}');
    raise exception 'FAIL: grade 13 accepted';
  exception when check_violation then null; end;
end $$;

-- The student joins, sees the list and adds their own without approval.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', false);
do $$
declare s uuid := (select v::uuid from h3 where k='student');
begin
  perform accept_student_invite((select v from h3 where k='code'));
  assert (select count(*) from student_activities) = 2, 'student sees their activities';
  insert into student_activities (student_id, category, position, organization) values (s, 'club', 'Member', 'FFA');
  update student_activities set hours_per_week = 12 where position = 'Barn helper';
  assert (select hours_per_week from student_activities where position = 'Barn helper') = 12, 'student edits an activity';
  delete from student_activities where position = 'Member';
  assert (select count(*) from student_activities) = 2, 'student removes an activity';
end $$;

-- A stranger sees and changes nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000309', false);
do $$ begin
  assert (select count(*) from student_activities) = 0, 'stranger sees no activities';
  update student_activities set position = 'hacked';
  delete from student_activities;
end $$;
reset role;
do $$ begin
  assert (select count(*) from student_activities where position = 'hacked') = 0, 'stranger cannot edit';
  assert (select count(*) from student_activities where position = 'Barn helper') = 1, 'stranger cannot delete';
  assert (select count(*) from audit_log where target = 'student_activities') >= 4, 'changes are audited';
end $$;
\o
\echo ACTIVITIES CHECKS PASSED
