\set ON_ERROR_STOP on
\o /dev/null
insert into app_admins values ('00000000-0000-0000-0000-0000000000f0') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Ortizes')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Luz', '2011-01-01', 9, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));

do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  insert into lesson_progress (student_id, lesson_id) values (s, 'test-yourself');
  assert (select count(*) from lesson_progress) = 1, 'parent marked lesson done';
  begin
    insert into lesson_progress (student_id, lesson_id) values (s, 'Bad Id!');
    raise exception 'FAIL: bad lesson id accepted';
  exception when check_violation then null; end;
  begin
    perform set_lesson_review('test-yourself', 'approved', 'ok');
    raise exception 'FAIL: parent reviewed a lesson';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- The student sees and records their own progress.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', false);
do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  perform accept_student_invite((select v from g where k='code'));
  insert into lesson_progress (student_id, lesson_id) values (s, 'space-it-out');
  assert (select count(*) from lesson_progress) = 2, 'student sees both';
  delete from lesson_progress where lesson_id = 'space-it-out';
  assert (select count(*) from lesson_progress) = 1, 'student can undo';
end $$;

-- The team reviewer approves a lesson; everyone signed in can read the review.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f0', false);
do $$ begin
  perform set_lesson_review('test-yourself', 'changes', 'Add an example for math.');
  perform set_lesson_review('test-yourself', 'approved', '  ');
  assert (select status from lesson_reviews where lesson_id = 'test-yourself') = 'approved', 'review updated';
  assert (select notes from lesson_reviews where lesson_id = 'test-yourself') is null, 'blank notes cleared';
  assert (select count(*) from lesson_progress) = 0, 'reviewer cannot see family progress';
end $$;

-- A stranger sees no progress but can see which lessons are reviewed.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f9', false);
do $$ begin
  assert (select count(*) from lesson_progress) = 0, 'stranger sees no progress';
  assert (select count(*) from lesson_reviews) = 1, 'review status is readable';
  begin
    insert into lesson_progress (student_id, lesson_id) values ((select v::uuid from g where k='student'), 'focus-sessions');
    raise exception 'FAIL: stranger recorded progress';
  exception when insufficient_privilege then null; end;
end $$;
\o
\echo STUDY LIBRARY CHECKS PASSED
