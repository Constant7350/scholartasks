\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Nguyens')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Mai', '2010-01-01', 10, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));

do $$
declare s uuid := (select v::uuid from g where k='student'); p uuid;
begin
  insert into rescue_plans (student_id, course, grade, plan) values (s, 'Algebra II', 'C', '{"steps":[]}') returning id into p;
  perform set_rescue_progress(p, array[0, 2], 'active');
  assert (select done_steps from rescue_plans where id = p) = array[0, 2], 'parent ticked steps';
  assert exists (select 1 from audit_log where target = 'rescue_plans'), 'plan is audited';
  begin
    perform set_rescue_progress(p, '{}', 'finished');
    raise exception 'FAIL: bad status accepted';
  exception when check_violation then null; end;
end $$;

-- The student sees the plan, ticks steps and can start their own (AI chat on by default).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  perform accept_student_invite((select v from g where k='code'));
  assert (select count(*) from rescue_plans) = 1, 'student sees plan';
  perform set_rescue_progress((select id from rescue_plans limit 1), array[1], 'done');
  assert (select status from rescue_plans limit 1) = 'done', 'student closed plan';
  insert into rescue_plans (student_id, course, grade, plan) values (s, 'Chemistry', 'D', '{"steps":[]}');
  delete from rescue_plans;
  assert (select count(*) from rescue_plans) = 2, 'student cannot delete plans';
end $$;

-- With AI chat off, the student can't save new plans.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_student_permission((select v::uuid from g where k='student'), 'ai_chat', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', false);
do $$ begin
  begin
    insert into rescue_plans (student_id, course, grade, plan) values ((select v::uuid from g where k='student'), 'Biology', 'C', '{}');
    raise exception 'FAIL: plan saved with AI off';
  exception when insufficient_privilege then null; end;
end $$;

-- A stranger sees nothing and can't change progress.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e9', false);
do $$ begin
  assert (select count(*) from rescue_plans) = 0, 'stranger sees no plans';
  begin
    perform set_rescue_progress((select id from rescue_plans limit 1), '{}', 'done');
    raise exception 'FAIL: stranger changed progress';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
\o
\echo GRADE RESCUE CHECKS PASSED
