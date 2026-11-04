\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000321', false);
create temp table h5 (k text primary key, v text);
insert into h5 values ('family', create_family('The Patels')::text);
insert into h5 values ('student', add_student((select v::uuid from h5 where k='family'), 'Rani', '2009-04-01', 12, 'GA')::text);
insert into h5 values ('code', create_student_invite((select v::uuid from h5 where k='student')));
do $$
declare s uuid := (select v::uuid from h5 where k='student'); c uuid;
begin
  insert into student_colleges (student_id, name) values (s, 'Emory University') returning id into c;
  insert into student_essays (student_id, kind, title, word_limit) values (s, 'personal', 'Common App personal essay', 650);
  insert into student_essays (student_id, kind, college_id, title, prompt) values (s, 'supplement', c, 'Why Emory?', 'Why Emory?');
  assert (select count(*) from student_essays) = 2, 'parent adds essays';
  begin
    update student_essays set draft = repeat('x', 20001) where kind = 'personal';
    raise exception 'FAIL: huge draft accepted';
  exception when check_violation then null; end;
end $$;

-- The student writes; typing doesn't fill the audit log, finishing does.
reset role;
create temp table n5 as select count(*) as n from audit_log where target = 'student_essays';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000325', false);
do $$ begin
  perform accept_student_invite((select v from h5 where k='code'));
  update student_essays set draft = 'When the mare finally let me lead her...' where kind = 'personal';
  assert (select draft from student_essays where kind = 'personal') like 'When the mare%', 'student saves a draft';
end $$;
reset role;
do $$ begin
  assert (select count(*) from audit_log where target = 'student_essays') = (select n from n5), 'draft typing is not audited';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000325', false);
update student_essays set status = 'done' where kind = 'personal';
reset role;
do $$ begin
  assert (select count(*) from audit_log where target = 'student_essays') = (select n from n5) + 1, 'finishing is audited';
end $$;

-- A stranger sees nothing.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000329', false);
do $$ begin
  assert (select count(*) from student_essays) = 0, 'stranger sees no essays';
end $$;
reset role;
\o
\echo COLLEGE ESSAY CHECKS PASSED
