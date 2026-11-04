\set ON_ERROR_STOP on
\o /dev/null
-- These people have said yes to AI help (0023).
insert into user_settings (user_id, ai_consent_at) values ('00000000-0000-0000-0000-000000002001', now()),('00000000-0000-0000-0000-000000002002', now()),('00000000-0000-0000-0000-000000002003', now()) on conflict (user_id) do update set ai_consent_at = excluded.ai_consent_at;
set role authenticated;
-- Parent sets up a family with one student who has the student app.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002001', false);
create temp table g (k text primary key, v text);
grant select on g to service_role;
insert into g values ('family', create_family('The Okafors')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Ada', '2009-03-01', 11, 'GA')::text);
select set_student_permission((select v::uuid from g where k='student'), 'ai_chat', true);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
do $$ begin
  assert (select not family_plan and not study_coach and ai_credits = 0 from my_plan(null)), 'starts with nothing';
  -- Families can't give themselves a plan or credits.
  begin
    insert into billing_subscriptions (id, family_id, kind, status) values ('sub_fake', (select v::uuid from g where k='family'), 'family', 'active');
    raise exception 'FAIL: parent wrote a subscription';
  exception when insufficient_privilege then null; end;
  begin
    perform billing_grant_credits('cs_fake', (select v::uuid from g where k='family'), 1000);
    raise exception 'FAIL: parent granted credits';
  exception when insufficient_privilege then null; end;
  -- Two free turns, then the third is refused with no pack.
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'turn 1';
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'turn 2';
  assert not ai_take_turn((select v::uuid from g where k='student'), 2), 'turn 3 refused without a pack';
end $$;
reset role;
-- The server (webhook) records a paid pack; a repeated webhook adds nothing.
set role service_role;
do $$ begin
  assert billing_grant_credits('cs_test_1', (select v::uuid from g where k='family'), 2), 'first grant';
  assert not billing_grant_credits('cs_test_1', (select v::uuid from g where k='family'), 2), 'same session twice';
end $$;
reset role;
-- (Supabase's service_role skips row security; locally the owner writes the rows.)
do $$ begin
  insert into billing_subscriptions (id, family_id, kind, status, billing_interval)
    values ('sub_1', (select v::uuid from g where k='family'), 'family', 'active', 'year'),
           ('sub_2', (select v::uuid from g where k='family'), 'study_coach', 'canceled', 'month');
end $$;
reset role;
set role authenticated;
do $$ begin
  assert (select family_plan and not study_coach and ai_credits = 2 from my_plan(null)), 'plan active, canceled coach ignored, 2 credits';
  assert (select count(*) from billing_subscriptions) = 2, 'parent sees own subscriptions';
  -- Over the daily limit, turns now come from the pack until it runs out.
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'pack turn 1';
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'pack turn 2';
  assert not ai_take_turn((select v::uuid from g where k='student'), 2), 'pack empty';
  assert (select ai_credits = 0 from my_plan(null)), 'pack used up';
end $$;
-- The student shares the family's plan and pack but can't read billing details.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002002', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  assert (select family_plan from my_plan((select v::uuid from g where k='student'))), 'student sees plan';
  assert (select count(*) from billing_subscriptions) = 0, 'student cannot read subscriptions';
end $$;
-- Someone outside the family sees nothing and can't ask about Ada.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002003', false);
do $$ begin
  assert (select count(*) from billing_subscriptions) = 0 and (select count(*) from ai_credits) = 0, 'outsider sees nothing';
  begin
    perform my_plan((select v::uuid from g where k='student'));
    raise exception 'FAIL: outsider read plan';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  assert (select family_id is null and not family_plan from my_plan(null)), 'no family, no plan';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
\o
\echo BILLING CHECKS PASSED
