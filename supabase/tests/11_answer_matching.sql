\set ON_ERROR_STOP on
\o /dev/null
reset role;
insert into answer_bank (state, question, answer, status) values
  ('GA', 'How is the HOPE GPA calculated?', 'Only core classes from 9th to 12th grade count, on a 4.0 scale.', 'approved'),
  ('GA', 'What is dual enrollment in Georgia?', 'High school students take college classes for both credits.', 'pending'),
  ('FL', 'How is the Bright Futures GPA calculated?', 'A Florida answer that must not show up for Georgia.', 'approved');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a1', false);
do $$
declare cid uuid;
begin
  select id into cid from answer_bank_candidates(null, 'how do they work out my hope gpa') limit 1;
  assert (select question from answer_bank_candidates(null, 'how do they work out my hope gpa') limit 1) = 'How is the HOPE GPA calculated?', 'closest question first';
  assert not exists (select 1 from answer_bank_candidates(null, 'how is the gpa calculated') c where c.question in ('What is dual enrollment in Georgia?', 'How is the Bright Futures GPA calculated?')), 'no pending or other-state questions';
  assert (select answer from answer_bank_take(null, cid)) like 'Only core classes%', 'take returns the answer';
  assert (select count(*) from answer_bank_take(null, cid)) = 1, 'take again';
end $$;
reset role;
do $$ begin
  assert (select hits from answer_bank where question = 'How is the HOPE GPA calculated?') = 2, 'take counts hits';
end $$;
-- A pending answer can't be taken even with its id.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a1', false);
create temp table p as select id from answer_bank where false;
reset role;
insert into p select id from answer_bank where status = 'pending';
set role authenticated;
do $$ begin
  assert (select count(*) from answer_bank_take(null, (select id from p limit 1))) = 0, 'pending answer not served';
end $$;
-- A student whose parent turned AI chat off is refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a2', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Ngs')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Ana', '2009-01-01', 11, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
select set_student_permission((select v::uuid from g where k='student'), 'ai_chat', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  begin
    perform answer_bank_candidates((select v::uuid from g where k='student'), 'hope gpa');
    raise exception 'FAIL: candidates without AI chat permission';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
\o
\echo ANSWER MATCHING CHECKS PASSED
