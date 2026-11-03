\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
-- A brand-new parent with no family yet can try the counselor.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  assert ai_take_turn(null, 10), 'no-student turn allowed';
  assert (select count(*) from answer_bank_lookup(null, 'What is Early Action?')) = 0, 'lookup works without student';
  perform answer_bank_submit(null, 'What is Early Action?', 'Early Action means applying early and hearing back early, without a binding commitment.');
end $$;
-- A student account must chat about their own record (so the AI chat setting applies).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Lees')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Kai', '2009-01-01', 11, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  begin
    perform ai_take_turn(null, 10);
    raise exception 'FAIL: student bypassed AI chat setting';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin assert (select state from answer_bank where question = 'What is Early Action?') = 'GA', 'defaults to Georgia'; end $$;
\o
\echo COUNSELOR WITHOUT STUDENT CHECKS PASSED
