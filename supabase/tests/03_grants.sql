\set ON_ERROR_STOP on
\o /dev/null
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
set role anon;
do $$ begin
  begin perform 1 from students; raise exception 'FAIL: anon read students';
  exception when insufficient_privilege then null; end;
  begin perform 1 from audit_log; raise exception 'FAIL: anon read audit_log';
  exception when insufficient_privilege then null; end;
  begin perform create_family('x'); raise exception 'FAIL: anon called create_family';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $$ begin
  begin insert into audit_log (action, target, prev_hash, hash) values ('x','y','z','w'); raise exception 'FAIL: user wrote audit_log';
  exception when insufficient_privilege then null; end;
  begin delete from students; raise exception 'FAIL: user deleted students directly';
  exception when insufficient_privilege then null; end;
  begin perform audit_row_change(); raise exception 'FAIL: user called internal function';
  exception when insufficient_privilege or feature_not_supported or object_not_in_prerequisite_state then null; end;
end $$;
reset role;
\o
\echo GRANT CHECKS PASSED
