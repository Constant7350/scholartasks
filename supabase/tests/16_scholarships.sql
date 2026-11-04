\set ON_ERROR_STOP on
\o /dev/null
-- Use new user ids so this file doesn't depend on the earlier ones.
insert into app_admins values ('00000000-0000-0000-0000-0000000001b0') on conflict do nothing;
\i seed/scholarships.sql
create temp table n0 as select count(*) as n from scholarships;
grant select on n0 to authenticated;
\i seed/scholarships.sql
do $$ begin
  assert (select count(*) from scholarships) = (select n from n0) and (select n from n0) >= 23, 'starter scholarships load once';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b1', false);
create temp table h (k text primary key, v text);
insert into h values ('family', create_family('The Ortegas')::text);
insert into h values ('student', add_student((select v::uuid from h where k='family'), 'Lu', '2009-03-01', 12, 'GA')::text);
insert into h values ('code', create_student_invite((select v::uuid from h where k='student')));

do $$
declare s uuid := (select v::uuid from h where k='student'); sch uuid := (select id from scholarships where name = 'Coca-Cola Scholars Program');
        t uuid;
begin
  assert (select count(*) from scholarships) = (select n from n0), 'family sees unverified scholarships';
  update scholarships set amount_text = 'hacked' where id = sch;
  assert (select count(*) from scholarships where amount_text = 'hacked') = 0, 'family cannot edit scholarships';
  perform set_match_profile(s, '{"interests":["STEM"],"citizen":"yes"}');
  assert (select match_profile ->> 'citizen' from students where id = s) = 'yes', 'parent sets match profile';
  perform set_income_band(s, '30_60k');
  assert (select income_band from students where id = s) = '30_60k', 'parent sets income range';
  insert into tasks (student_id, title, kind, due_on, url) values (s, 'Coca-Cola Scholars Program', 'scholarship', '2027-09-30', 'https://www.coca-colascholarsfoundation.org/apply/') returning id into t;
  insert into scholarship_choices (student_id, scholarship_id, choice, task_id) values (s, sch, 'added', t);
  assert (select count(*) from scholarship_choices) = 1, 'parent saves a choice';
  begin
    insert into scholarship_updates (scholarship_id, summary) values (sch, 'x');
    raise exception 'FAIL: family proposed an update';
  exception when insufficient_privilege then null; end;
end $$;

-- The student hides one scholarship and updates their own profile.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b5', false);
do $$
declare s uuid := (select v::uuid from h where k='student');
begin
  perform accept_student_invite((select v from h where k='code'));
  insert into scholarship_choices (student_id, scholarship_id, choice) values (s, (select id from scholarships where name = 'Dell Scholars Program'), 'hidden');
  perform set_match_profile(s, '{"interests":["Arts"]}');
  assert (select count(*) from scholarship_choices) = 2, 'student sees both choices';
  begin
    perform set_income_band(s, 'over_200k');
    raise exception 'FAIL: student changed income range';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- A stranger can't touch the family's profile or choices.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b9', false);
do $$ begin
  assert (select count(*) from scholarship_choices) = 0, 'stranger sees no choices';
  begin
    perform set_match_profile((select v::uuid from h where k='student'), '{}');
    raise exception 'FAIL: stranger changed a profile';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- The team retires one and records an AI update; families no longer see the retired one.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b0', false);
do $$ begin
  update scholarships set status = 'retired' where name = 'Equitable Excellence Scholarship';
  insert into scholarship_updates (scholarship_id, summary, proposed) values ((select id from scholarships where name = 'Coca-Cola Scholars Program'), 'Deadline confirmed', '{"deadline":"2027-09-30"}');
  assert (select count(*) from scholarship_choices) = 0, 'team cannot see family choices';
  begin
    insert into scholarships (name, sponsor, url, summary, amount_text) values ('Bad', 'Bad', 'http://x.com', 'A bad url scholarship', '$1');
    raise exception 'FAIL: non-https url accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001b1', false);
do $$ begin
  assert (select count(*) from scholarships) = (select n from n0) - 1, 'retired scholarship hidden from families';
  assert (select count(*) from scholarship_updates) = 0, 'families cannot see AI updates';
end $$;
\o
\echo SCHOLARSHIP CHECKS PASSED
