\set ON_ERROR_STOP on
\o /dev/null
insert into app_admins values ('00000000-0000-0000-0000-0000000032a0') on conflict do nothing;
set role authenticated;

-- A team member sees and marks checks.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000032a0', false);
do $$ begin
  insert into trade_checks (subject, title, url, checked_on, result, summary, status)
    values ('aid:hope-grant', 'HOPE Grant', 'https://www.gafutures.org/', '2026-11-01', 'changed', 'Rate is now $110', 'review');
  update trade_checks set status = 'fixed', reviewed_by = auth.uid(), reviewed_at = now() where subject = 'aid:hope-grant';
  assert (select status from trade_checks where subject = 'aid:hope-grant') = 'fixed', 'team marks fixed';
  begin
    insert into trade_checks (subject, title, url) values ('Bad Subject', 'x', 'https://x.com');
    raise exception 'FAIL: bad subject accepted';
  exception when check_violation then null; end;
  begin
    insert into trade_checks (subject, title, url) values ('aid:x', 'x', 'http://x.com');
    raise exception 'FAIL: non-https url accepted';
  exception when check_violation then null; end;
end $$;

-- Anyone else sees and changes nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000032a9', false);
do $$ begin
  assert (select count(*) from trade_checks) = 0, 'families cannot see trade checks';
  update trade_checks set status = 'dismissed';
  begin
    insert into trade_checks (subject, title, url) values ('aid:y', 'y', 'https://y.com');
    raise exception 'FAIL: family inserted a check';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select status from trade_checks where subject = 'aid:hope-grant') = 'fixed', 'family update had no effect';
end $$;
\o
\echo TRADE CHECKS PASSED
