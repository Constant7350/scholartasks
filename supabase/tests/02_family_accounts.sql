\set ON_ERROR_STOP on
\o /dev/null
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Test 01 deliberately tampers with an early row; only check entries written here.
create temp table start_id as select coalesce(max(id), 0) as id from audit_log;
grant select on start_id to authenticated;
set role authenticated;

-- Parent d1 signs up and creates a family.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
create temp table t (k text primary key, v text);
insert into t values ('family', create_family('The Smiths')::text);
insert into t values ('student', add_student((select v::uuid from t where k='family'), 'Maya', '2012-05-01', 8, 'ga')::text);
do $$ begin
  assert (select state from students where id = (select v::uuid from t where k='student')) = 'GA', 'state is upper-cased';
  begin
    perform add_student((select v::uuid from t where k='family'), 'Tiny', (current_date - interval '12 years')::date, 7, 'GA');
    raise exception 'FAIL: under-13 student should be refused';
  exception when raise_exception then
    if sqlerrm not like '%at least 13%' then raise; end if;
  end;
end $$;
insert into t values ('code', create_student_invite((select v::uuid from t where k='student')));
do $$ begin
  assert (select v from t where k='code') ~ '^[A-HJKMNP-Z2-9]{8}$', 'invite code format';
end $$;

-- Another parent cannot invite or change permissions for Maya.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
do $$ begin
  begin
    perform set_student_permission((select v::uuid from t where k='student'), 'ai_chat', false);
    raise exception 'FAIL: stranger changed permissions';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    perform create_student_invite((select v::uuid from t where k='student'));
    raise exception 'FAIL: stranger created invite';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- Maya joins with the code (lower-case and spaces are fine); the code is single-use.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  assert accept_student_invite(' ' || lower((select v from t where k='code')) || ' ') = (select v::uuid from t where k='student'), 'accept returns student';
  assert (select count(*) from students) = 1, 'Maya sees her own record';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  begin
    perform accept_student_invite((select v from t where k='code'));
    raise exception 'FAIL: code reused';
  exception when raise_exception then if sqlerrm <> 'invite code is invalid or expired' then raise; end if; end;
end $$;

-- Parent changes a permission; unknown keys are refused; everything is audited.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_student_permission((select v::uuid from t where k='student'), 'ai_chat', false);
do $$ begin
  assert (select (permissions->>'ai_chat')::boolean from students where id = (select v::uuid from t where k='student')) = false, 'permission saved';
  begin
    perform set_student_permission((select v::uuid from t where k='student'), 'billing', true);
    raise exception 'FAIL: unknown key accepted';
  exception when raise_exception then if sqlerrm not like 'unknown permission%' then raise; end if; end;
  assert (select count(*) from audit_log where target = 'family_invites') >= 2, 'invite created and accepted are audited';
  assert (select count(*) from audit_log where target = 'students' and action = 'update'
          and details->'after'->'permissions'->>'ai_chat' = 'false') = 1, 'permission change audited';
  assert (select count(*) from audit_log where target = 'family_members' and action = 'insert') = 2, 'parent and student joins audited';
end $$;
reset role;
do $$ begin assert (select count(*) from verify_audit_chain() where broken_at > (select id from start_id)) = 0, 'audit chain intact'; end $$;
\o
\echo FAMILY ACCOUNT CHECKS PASSED
