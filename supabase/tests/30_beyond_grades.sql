\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', false);
create temp table h4 (k text primary key, v text);
insert into h4 values ('family', create_family('The Ortizes')::text);
insert into h4 values ('student', add_student((select v::uuid from h4 where k='family'), 'Lena', '2009-03-01', 11, 'GA')::text);
insert into h4 values ('code', create_student_invite((select v::uuid from h4 where k='student')));

-- The parent's view adds milestones once; a second copy is refused.
do $$
declare s uuid := (select v::uuid from h4 where k='student');
begin
  insert into tasks (student_id, kind, deadline_id, title, due_on) values (s, 'milestone', 'bg:11:pick', 'Pick two teachers', '2027-01-31');
  begin
    insert into tasks (student_id, kind, deadline_id, title) values (s, 'milestone', 'bg:11:pick', 'Pick two teachers');
    raise exception 'FAIL: duplicate milestone accepted';
  exception when unique_violation then null; end;
  insert into service_hours (student_id, served_on, hours, organization) values (s, '2026-10-01', 3, 'County shelter');
  begin
    insert into service_hours (student_id, served_on, hours, organization) values (s, '2026-10-02', 30, 'Too long');
    raise exception 'FAIL: 30 hours in a day accepted';
  exception when check_violation then null; end;
  insert into recommenders (student_id, name, subject) values (s, 'Ms. Rivera', 'AP Biology');
end $$;

-- The student joins, adds their own milestones, hours, recommender and brag sheet.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000405', false);
do $$
declare s uuid := (select v::uuid from h4 where k='student');
begin
  perform accept_student_invite((select v from h4 where k='code'));
  insert into tasks (student_id, kind, deadline_id, title, due_on, status) values (s, 'milestone', 'bg:11:lead', 'Lead a project', '2026-11-18', 'todo');
  update tasks set status = 'dismissed' where deadline_id = 'bg:11:lead';
  assert (select status from tasks where deadline_id = 'bg:11:lead') = 'dismissed', 'student sets a milestone aside';
  insert into service_hours (student_id, served_on, hours, organization, note) values (s, '2026-10-08', 2.5, 'County shelter', 'Walked dogs');
  assert (select sum(hours) from service_hours) = 5.5, 'student sees all hours';
  update recommenders set status = 'agreed', asked_on = '2026-11-01' where name = 'Ms. Rivera';
  insert into brag_sheets (student_id, answers) values (s, '{"proud":"Raised $2,400 for the shelter"}');
  insert into brag_sheets (student_id, answers) values (s, '{"proud":"Raised $2,500 for the shelter"}')
    on conflict (student_id) do update set answers = excluded.answers;
  assert (select answers->>'proud' from brag_sheets) like '%2,500%', 'student updates brag sheet';
end $$;

-- A stranger sees and changes nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000409', false);
do $$ begin
  assert (select count(*) from service_hours) = 0, 'stranger sees no hours';
  assert (select count(*) from recommenders) = 0, 'stranger sees no recommenders';
  assert (select count(*) from brag_sheets) = 0, 'stranger sees no brag sheet';
  update recommenders set name = 'hacked';
  delete from service_hours;
end $$;
reset role;
do $$ begin
  assert (select count(*) from recommenders where name = 'hacked') = 0, 'stranger cannot edit';
  assert (select count(*) from service_hours) = 2, 'stranger cannot delete';
  assert (select count(*) from audit_log where target in ('service_hours', 'recommenders', 'brag_sheets')) >= 5, 'changes are audited';
end $$;
\o
\echo BEYOND GRADES CHECKS PASSED
