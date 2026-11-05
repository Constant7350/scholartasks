\set ON_ERROR_STOP on
\o /dev/null
-- Awards the AI finder saves as 'found' are seen only by the team, never by families.
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000038f1');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000038a1', 'parent38@example.com');
insert into scholarships (name, sponsor, url, summary, amount_text, status, found_from) values
  ('Finder Test Award', 'Test Org', 'https://example.org/a', 'An award the finder found.', '$1,000', 'found', 'Finder: test'),
  ('Finder Test Verified', 'Test Org', 'https://example.org/b', 'An award already verified.', '$500', 'approved', null);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000038a1', false);
do $$ begin
  assert not exists (select 1 from scholarships where name = 'Finder Test Award'), 'FAIL: family saw a found award';
  assert exists (select 1 from scholarships where name = 'Finder Test Verified'), 'FAIL: family missed a verified award';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000038f1', false);
do $$ begin
  assert exists (select 1 from scholarships where name = 'Finder Test Award'), 'FAIL: team cannot see found awards';
end $$;
-- The checker confirms it: approved, and families see it.
update scholarships set status = 'approved' where name = 'Finder Test Award';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000038a1', false);
do $$ begin
  assert exists (select 1 from scholarships where name = 'Finder Test Award'), 'FAIL: approved award still hidden';
end $$;
reset role;
\o
\echo FOUND SCHOLARSHIP CHECKS PASSED
