\set ON_ERROR_STOP on
\o /dev/null
-- Family A: parent a1, student Sam who signed in as s1.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000022a1', false);
create temp table d (k text primary key, v text);
grant all on d to authenticated;
insert into d values ('fam', create_family('Delete Test')::text);
insert into d values ('stu', add_student((select v::uuid from d where k='fam'), 'Sam', '2010-01-01', 10, 'GA')::text);
insert into d values ('code', create_student_invite((select v::uuid from d where k='stu')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000022b1', false);
select accept_student_invite((select v from d where k='code'));

-- A signed-in person can't call it directly (only the server can).
do $$ begin
  begin
    perform delete_account('00000000-0000-0000-0000-0000000022b1');
    raise exception 'FAIL: person called delete_account directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The student deletes their sign-in: the family and Sam's record stay.
do $$ declare r uuid[]; begin
  r := delete_account('00000000-0000-0000-0000-0000000022b1');
  assert r = array['00000000-0000-0000-0000-0000000022b1'::uuid], 'student removes only their own sign-in';
  assert (select count(*) from students where id = (select v::uuid from d where k='stu')) = 1, 'student record kept for the parent';
  assert not exists (select 1 from family_members where user_id = '00000000-0000-0000-0000-0000000022b1'), 'student unlinked';
end $$;

-- Sam joins again; an active paid plan blocks the parent from deleting.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000022a1', false);
update d set v = create_student_invite((select v::uuid from d where k='stu')) where k = 'code';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000022b1', false);
select accept_student_invite((select v from d where k='code'));
reset role;
insert into billing_subscriptions (id, family_id, kind, status) values ('sub_del', (select v::uuid from d where k='fam'), 'family', 'active');
do $$ begin
  begin
    perform delete_account('00000000-0000-0000-0000-0000000022a1');
    raise exception 'FAIL: deleted with an active plan';
  exception when raise_exception then
    if sqlerrm not like '%cancel your paid plan%' then raise; end if;
  end;
end $$;

-- Once the plan is set to end, the last parent deletes everything.
update billing_subscriptions set cancel_at_period_end = true where id = 'sub_del';
do $$ declare r uuid[]; begin
  r := delete_account('00000000-0000-0000-0000-0000000022a1');
  assert cardinality(r) = 2 and '00000000-0000-0000-0000-0000000022a1' = any(r) and '00000000-0000-0000-0000-0000000022b1' = any(r), 'parent and student sign-ins returned';
  assert not exists (select 1 from families where id = (select v::uuid from d where k='fam')), 'family deleted';
  assert not exists (select 1 from students where id = (select v::uuid from d where k='stu')), 'student data deleted';
  assert not exists (select 1 from billing_subscriptions where id = 'sub_del'), 'billing rows deleted';
  assert (select count(*) from audit_log where action = 'account_delete' and actor_id = '00000000-0000-0000-0000-0000000022a1') = 2, 'deletion audited';
end $$;
\o
\echo ACCOUNT DELETION CHECKS PASSED
