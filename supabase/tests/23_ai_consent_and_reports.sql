\set ON_ERROR_STOP on
\o /dev/null
-- Parent g1 with student Gia; AI help is off until g1 says yes.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000023a1', false);
create temp table g (k text primary key, v text);
insert into g values ('fam', create_family('Consent Test')::text);
insert into g values ('stu', add_student((select v::uuid from g where k='fam'), 'Gia', '2010-02-02', 10, 'GA')::text);
do $$ begin
  begin
    perform ai_take_turn((select v::uuid from g where k='stu'), 10);
    raise exception 'FAIL: AI ran without permission';
  exception when raise_exception then
    if sqlerrm <> 'ai consent needed' then raise; end if;
  end;
  assert set_ai_consent(true) is not null, 'consent saved';
  assert ai_take_turn((select v::uuid from g where k='stu'), 10), 'AI runs after yes';
  assert set_ai_consent(false) is null, 'consent withdrawn';
  begin
    perform ai_take_turn((select v::uuid from g where k='stu'), 10);
    raise exception 'FAIL: AI ran after permission was withdrawn';
  exception when raise_exception then
    if sqlerrm <> 'ai consent needed' then raise; end if;
  end;
  -- Reports: anyone signed in can file one; only the team reads them.
  insert into ai_reports (feature, answer, note) values ('counselor', 'some answer', 'this was wrong');
  begin
    insert into ai_reports (user_id, feature, note) values ('00000000-0000-0000-0000-0000000023ff', 'counselor', 'spoof');
    raise exception 'FAIL: filed a report as someone else';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from ai_reports) = 0, 'reporter cannot read reports';
end $$;
reset role;
do $$ begin
  assert (select count(*) from ai_reports where user_id = '00000000-0000-0000-0000-0000000023a1') = 1, 'report saved';
  assert (select count(*) from audit_log where action = 'consent' and target = 'ai_help' and actor_id = '00000000-0000-0000-0000-0000000023a1') = 2, 'consent changes audited';
end $$;
\o
\echo AI CONSENT AND REPORT CHECKS PASSED
