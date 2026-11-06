\set ON_ERROR_STOP on
\o /dev/null
insert into colleges (id, name, city, state, ownership, degree, size, religious_affiliation, programs)
values (998001, 'Faith Test College', 'Macon', 'GA', 2, 3, 2500, 54, '{"biological":0.1}'),
       (998002, 'Secular Test College', 'Macon', 'GA', 2, 3, 2500, null, '{"biological":0.1}')
on conflict (id) do nothing;

set role authenticated;
do $$
begin
  assert (select count(*) from match_colleges(array['GA'], array[2], null, 50, array[54, 75]::int[]) where id in (998001, 998002)) = 1, 'Christian filter keeps only affiliated colleges';
  assert (select count(*) from match_colleges(array['GA'], array[2], null, 50) where id in (998001, 998002)) = 2, 'no filter keeps both';
  assert (select count(*) from match_colleges(array['GA'], array[2], null, 50, array[30]::int[]) where id in (998001, 998002)) = 0, 'other church family finds none';
end $$;
reset role;
delete from colleges where id in (998001, 998002);
\o
\echo COLLEGE FAITH CHECKS PASSED
