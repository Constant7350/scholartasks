\set ON_ERROR_STOP on
\o /dev/null
-- Uses the family and choices from 16_scholarships.sql.
-- The server (no RLS here, like the secret key) saves a checklist for one award.
insert into scholarship_steps (scholarship_id, steps, essay_prompts)
  values ((select id from scholarships where name = 'Coca-Cola Scholars Program'), '[{"title":"Fill in the online form","detail":"x"}]', '{"Tell us about you"}')
  on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b1', false);
do $$
declare sch uuid := (select id from scholarships where name = 'Coca-Cola Scholars Program');
begin
  assert (select count(*) from scholarship_steps where scholarship_id = sch) = 1, 'family reads a checklist';
  begin
    insert into scholarship_steps (scholarship_id) values ((select id from scholarships where name = 'Dell Scholars Program'));
    raise exception 'FAIL: family wrote a checklist';
  exception when insufficient_privilege then null; end;
  update scholarship_steps set steps = '[]' where scholarship_id = sch;
  assert (select jsonb_array_length(steps) from scholarship_steps where scholarship_id = sch) = 1, 'family cannot change a checklist';
  update scholarship_choices set done_steps = '{0}', essay_draft = 'My first draft' where scholarship_id = sch;
  assert (select essay_draft from scholarship_choices where scholarship_id = sch) = 'My first draft', 'parent saves progress and a draft';
  begin
    update scholarship_choices set essay_draft = repeat('x', 12001) where scholarship_id = sch;
    raise exception 'FAIL: huge draft accepted';
  exception when check_violation then null; end;
end $$;

-- The student sees the same progress; a stranger sees none.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b5', false);
do $$ begin
  assert (select essay_draft from scholarship_choices where essay_draft is not null) = 'My first draft', 'student sees the draft';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b9', false);
do $$ begin
  assert (select count(*) from scholarship_choices where essay_draft is not null) = 0, 'stranger sees no drafts';
end $$;
reset role;
\o
\echo APPLICATION HELP CHECKS PASSED
