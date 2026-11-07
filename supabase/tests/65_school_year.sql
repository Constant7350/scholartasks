\set ON_ERROR_STOP on
\o /dev/null
-- New school year: grades move up on August 1, seniors are marked graduated, a rerun changes
-- nothing, grades set in summer are left alone, parents get one notice list, and graduated
-- students free a place under the 6-student limit.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000065a1', 'parent65@example.com');
create temp table r65 (k text primary key, v text);
grant all on r65 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065a1', false);
insert into r65 values ('fam', create_family('School Year Test')::text);
insert into r65 values
  ('emma', add_student((select v::uuid from r65 where k='fam'), 'Emma', (current_date - interval '17 years')::date, 12, 'GA')::text),
  ('lily', add_student((select v::uuid from r65 where k='fam'), 'Lily', (current_date - interval '14 years')::date, 8, 'GA')::text),
  ('noah', add_student((select v::uuid from r65 where k='fam'), 'Noah', (current_date - interval '15 years')::date, 9, 'GA')::text),
  ('ava',  add_student((select v::uuid from r65 where k='fam'), 'Ava',  (current_date - interval '15 years')::date, 10, 'GA')::text),
  ('mia',  add_student((select v::uuid from r65 where k='fam'), 'Mia',  (current_date - interval '16 years')::date, 11, 'GA')::text),
  ('leo',  add_student((select v::uuid from r65 where k='fam'), 'Leo',  (current_date - interval '13 years')::date, 7, 'GA')::text);

do $$
begin
  -- A parent can't run the move-up, and can't mark a grade-10 student graduated.
  begin
    perform advance_school_year('2027-08-01');
    raise exception 'FAIL: parent ran the move-up';
  exception when insufficient_privilege then null;
  end;
  begin
    update students set graduated_on = current_date where id = (select v::uuid from r65 where k='ava');
    raise exception 'FAIL: grade 10 marked graduated';
  exception when others then
    if sqlerrm not like '%only a grade 12%' then raise; end if;
  end;
end $$;
reset role;

-- Every student was entered before June; Noah's grade was fixed by a parent in July 2027.
update students set grade_set_on = '2026-11-07' where family_id = (select v::uuid from r65 where k='fam');
update students set grade_set_on = '2027-07-10' where id = (select v::uuid from r65 where k='noah');
-- Students from the other check files stay out of the counts below.
update students set grade_set_on = '2099-01-01' where family_id <> (select v::uuid from r65 where k='fam');

do $$
declare n int;
begin
  select advance_school_year('2027-08-01') into n;
  if n <> 5 then raise exception 'FAIL: moved %', n; end if;
  if (select grade_level from students where id = (select v::uuid from r65 where k='lily')) <> 9 then raise exception 'FAIL: Lily not in 9'; end if;
  if (select grade_level from students where id = (select v::uuid from r65 where k='noah')) <> 9 then raise exception 'FAIL: Noah moved after a July fix'; end if;
  if (select graduated_on from students where id = (select v::uuid from r65 where k='emma')) <> '2027-08-01' then raise exception 'FAIL: Emma not graduated'; end if;
  if (select grade_level from students where id = (select v::uuid from r65 where k='emma')) <> 12 then raise exception 'FAIL: Emma grade changed'; end if;
  -- Running again the same day (or later that week) changes nothing.
  select advance_school_year('2027-08-02') into n;
  if n <> 0 then raise exception 'FAIL: rerun moved %', n; end if;
  if (select grade_level from students where id = (select v::uuid from r65 where k='lily')) <> 9 then raise exception 'FAIL: Lily moved twice'; end if;
  -- The parent's notice list: 5 students, Emma graduated.
  if (select count(*) from school_year_notices(2027)) <> 5 then raise exception 'FAIL: notices %', (select count(*) from school_year_notices(2027)); end if;
  if not (select graduated from school_year_notices(2027) where first_name = 'Emma') then raise exception 'FAIL: Emma not listed as graduated'; end if;
  perform school_year_notified(2027, (select v::uuid from r65 where k='fam'));
  if exists (select 1 from school_year_notices(2027)) then raise exception 'FAIL: notices left after sending'; end if;
  -- The next year, Emma stays graduated and Mia (now 12) graduates.
  select advance_school_year('2028-08-01') into n;
  if n <> 5 then raise exception 'FAIL: 2028 moved %', n; end if;
  if (select graduated_on from students where id = (select v::uuid from r65 where k='emma')) <> '2027-08-01' then raise exception 'FAIL: Emma changed in 2028'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065a1', false);
do $$
begin
  -- The parent sees their own log.
  if (select count(*) from school_year_log) <> 10 then raise exception 'FAIL: parent log %', (select count(*) from school_year_log); end if;
  -- Two graduated (Emma, Mia): the family has 4 current students, so 2 more fit under 6.
  perform add_student((select v::uuid from r65 where k='fam'), 'Kid7', (current_date - interval '15 years')::date, 9, 'GA');
  perform add_student((select v::uuid from r65 where k='fam'), 'Kid8', (current_date - interval '15 years')::date, 9, 'GA');
  begin
    perform add_student((select v::uuid from r65 where k='fam'), 'Kid9', (current_date - interval '15 years')::date, 9, 'GA');
    raise exception 'FAIL: 7th current student added';
  exception when others then
    if sqlerrm not like '%student limit%' then raise; end if;
  end;
  -- A parent's fix: picking a grade again clears "graduated" and records the day.
  update students set grade_level = 11 where id = (select v::uuid from r65 where k='mia');
  if (select graduated_on from students where id = (select v::uuid from r65 where k='mia')) is not null then raise exception 'FAIL: fix kept graduated'; end if;
  if (select grade_set_on from students where id = (select v::uuid from r65 where k='mia')) <> current_date then raise exception 'FAIL: fix day not recorded'; end if;
end $$;
reset role;
\o
\echo SCHOOL YEAR CHECKS PASSED
