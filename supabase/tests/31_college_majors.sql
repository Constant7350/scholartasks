\set ON_ERROR_STOP on
\o /dev/null
-- The server loads majors data (no RLS here, like the seed file).
insert into colleges (id, name, city, state, ownership, degree, size, tuition_in, tuition_out, cost_attendance, net_price, programs)
values (139959, 'University of Georgia', 'Athens', 'GA', 1, 3, 31000, 10000, 30000, 28000, '{8000,9000,12000,18000,22000}', '{}'),
       (999002, 'Coast University', 'Wilmington', 'NC', 1, 3, 17000, 7000, 22000, 25000, '{6000,8000,11000,16000,20000}', '{}'),
       (999003, 'Online U', 'Phoenix', 'AZ', 3, 3, 90000, 9000, 9000, 15000, '{}', '{}'),
       (999004, 'Ohio Welding Institute', 'Dayton', 'OH', 2, 1, 300, null, null, 18000, '{}', '{"precision_production":1}')
on conflict (id) do nothing;
insert into study_fields values ('2613', 'Ecology, Evolution, Systematics, and Population Biology'), ('0180', 'Veterinary Medicine'), ('5138', 'Registered Nursing') on conflict do nothing;
insert into field_earnings values ('2613', 3, 2, 300, 35000, 50000, 18000), ('5138', 3, 3, 900, 80000, 90000, 20000) on conflict do nothing;
insert into college_programs values
  (139959, '2613', 3, 40, 33000, 48000, 15000, false),
  (139959, '0180', 7, 110, 95000, null, 150000, false),
  (999002, '2613', 3, 90, 35000, 51000, 20000, false),
  (999003, '5138', 3, 5000, 90000, 95000, 10000, true),
  (139959, '5138', 3, 200, 75000, 85000, 18000, false)
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000331', false);
do $$ begin
  assert (select count(*) from programs_for(array['2613'], array[3], 'GA')) = 2, 'home state and nationwide';
  assert (select count(*) from programs_for(array['2613'], array[3], 'GA', false, 1)) = 2, 'home state is always included';
  assert (select count(*) from programs_for(array['2613'], array[3], 'NC', false, 1)) = 1, 'limit applies outside home state';
  assert (select count(*) from programs_for(array['5138'], array[3], 'GA')) = 1, 'online-only programs left out by default';
  assert (select count(*) from programs_for(array['5138'], array[3], 'GA', true)) = 2, 'online programs when asked';
  assert (select college ->> 'name' from programs_for(array['0180'], array[7], 'GA')) = 'University of Georgia', 'vet school with college facts';
  assert (select college ? 'programs' from programs_for(array['0180'], array[7], 'GA')) = false, 'college facts without the big programs field';
  assert (select cip from search_majors('veterinary')) = '0180', 'search major names';
  assert (select count(*) from match_colleges(array['OH'], array[1,2], null, 50)) = 0, 'match quiz stays four-year';
  assert (select count(*) from search_majors('ve')) = 0, 'too short to search';
  update college_programs set grads = 1 where college_id = 139959;
  assert (select grads from college_programs where college_id = 139959 and cip = '2613') = 40, 'families cannot change majors data';
end $$;
reset role;
-- Signed out visitors can read the public data too.
set role anon;
do $$ begin
  assert (select count(*) from field_earnings) >= 2, 'anon reads national earnings';
end $$;
reset role;
\o
\echo COLLEGE MAJORS CHECKS PASSED
