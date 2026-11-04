\set ON_ERROR_STOP on
\o /dev/null
-- The server loads college data (no RLS here, like the seed file).
insert into colleges (id, name, city, state, ownership, degree, size, tuition_in, tuition_out, cost_attendance, net_price, programs)
values (139959, 'University of Georgia', 'Athens', 'GA', 1, 3, 31000, 10000, 30000, 28000, '{8000,9000,12000,18000,22000}', '{"biological":0.08,"agriculture":0.03}'),
       (999001, 'Small Arts College', 'Savannah', 'GA', 2, 3, 2000, 40000, 40000, 60000, '{10000,12000,15000,20000,35000}', '{"visual_performing":0.6}'),
       (999002, 'Coast University', 'Wilmington', 'NC', 1, 3, 17000, 7000, 22000, 25000, '{6000,8000,11000,16000,20000}', '{"biological":0.1}')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000311', false);
create temp table h4 (k text primary key, v text);
insert into h4 values ('family', create_family('The Okafors')::text);
insert into h4 values ('student', add_student((select v::uuid from h4 where k='family'), 'Ada', '2009-02-01', 12, 'GA')::text);
insert into h4 values ('code', create_student_invite((select v::uuid from h4 where k='student')));

do $$
declare s uuid := (select v::uuid from h4 where k='student');
begin
  assert (select count(*) from colleges) >= 3, 'families read college data';
  update colleges set name = 'hacked' where id = 139959;
  assert (select name from colleges where id = 139959) = 'University of Georgia', 'families cannot change college data';
  -- Match quiz candidates: Georgia, biology-type programs.
  assert (select count(*) from match_colleges(array['GA'], array[1,2], array['biological'], 50)) = 1, 'match by state and program';
  assert (select count(*) from match_colleges(null, array[1], array['biological'], 50)) = 2, 'match anywhere, public only';
  assert (select count(*) from match_colleges(array['GA'], null, null, 50)) = 2, 'match with no interests';
  -- Link a college on the list and save an aid offer and outside awards.
  insert into student_colleges (student_id, name, college_id, aid_offer) values (s, 'University of Georgia', 139959, 6000);
  assert (select aid_offer from student_colleges where college_id = 139959) = 6000, 'parent saves an aid offer';
  perform set_outside_awards(s, 1500);
  assert (select outside_awards from students where id = s) = 1500, 'parent saves outside awards';
  begin
    update student_colleges set aid_offer = 999999 where college_id = 139959;
    raise exception 'FAIL: huge aid offer accepted';
  exception when check_violation then null; end;
end $$;

-- The student can update outside awards; a stranger cannot.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000315', false);
do $$ begin
  perform accept_student_invite((select v from h4 where k='code'));
  perform set_outside_awards((select v::uuid from h4 where k='student'), 2000);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000319', false);
do $$ begin
  begin
    perform set_outside_awards((select v::uuid from h4 where k='student'), 0);
    raise exception 'FAIL: stranger changed outside awards';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  assert (select count(*) from student_colleges) = 0, 'stranger sees no college list';
end $$;
reset role;
do $$ begin
  assert (select outside_awards from students where id = (select v::uuid from h4 where k='student')) = 2000, 'student saved outside awards';
end $$;
\o
\echo COLLEGE SEARCH CHECKS PASSED
