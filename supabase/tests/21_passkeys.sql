\set ON_ERROR_STOP on
\o /dev/null
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002101', 'pk-a@example.com'),
  ('00000000-0000-0000-0000-000000002102', 'pk-b@example.com');
-- The server adds passkeys (locally the owner stands in for service_role).
insert into passkeys (id, user_id, public_key) values
  ('cred-a', '00000000-0000-0000-0000-000000002101', 'pub-a'),
  ('cred-b', '00000000-0000-0000-0000-000000002102', 'pub-b');
insert into passkey_challenges (kind, challenge) values ('login', 'abc');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002101', false);
do $$ begin
  assert (select count(*) from passkeys) = 1, 'sees only own passkey';
  begin
    insert into passkeys (id, user_id, public_key) values ('cred-x', '00000000-0000-0000-0000-000000002101', 'pub-x');
    raise exception 'FAIL: person added a passkey directly';
  exception when insufficient_privilege then null; end;
  begin
    update passkeys set counter = 99;
    raise exception 'FAIL: person changed a passkey';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from passkey_challenges;
    raise exception 'FAIL: person read challenges';
  exception when insufficient_privilege then null; end;
  delete from passkeys where id = 'cred-b';
  delete from passkeys where id = 'cred-a';
end $$;
reset role;
do $$ begin
  assert (select count(*) from passkeys where id = 'cred-b') = 1, 'cannot remove someone else''s passkey';
  assert (select count(*) from passkeys where id = 'cred-a') = 0, 'removed own passkey';
  assert (select count(*) from audit_log where target = 'passkeys' and action = 'delete' and target_id = 'cred-a') = 1, 'removal audited';
end $$;
set role anon;
do $$ begin
  begin
    perform 1 from passkeys;
    raise exception 'FAIL: anon read passkeys';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\o
\echo PASSKEY CHECKS PASSED
