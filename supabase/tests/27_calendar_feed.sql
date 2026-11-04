\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000331', false);
create temp table h6 (k text primary key, v text);
grant all on h6 to service_role;
insert into h6 values ('family', create_family('The Garcias')::text);
insert into h6 values ('student', add_student((select v::uuid from h6 where k='family'), 'Luz', '2009-01-01', 12, 'GA')::text);
do $$
declare s uuid := (select v::uuid from h6 where k='student'); t text; t2 text;
begin
  insert into tasks (student_id, title, kind, due_on) values (s, 'FAFSA', 'aid', current_date + 20);
  insert into student_colleges (student_id, name, plan, deadline) values (s, 'Georgia Tech', 'EA', current_date + 30);
  t := my_calendar_token();
  assert length(t) = 48, 'token is long and random';
  assert my_calendar_token() = t, 'same link each time';
  t2 := my_calendar_token(true);
  assert t2 <> t, 'a new link replaces the old one';
  insert into h6 values ('token', t2), ('old', t);
  begin
    perform * from calendar_items(t2);
    raise exception 'FAIL: family called the server-only function';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ begin
  assert (select count(*) from calendar_items((select v from h6 where k='token'))) = 2, 'feed lists the task and the college';
  assert (select count(*) from calendar_items((select v from h6 where k='old'))) = 0, 'old link shows nothing';
  assert (select count(*) from calendar_items('short')) = 0, 'bad token shows nothing';
end $$;
reset role;
\o
\echo CALENDAR FEED CHECKS PASSED
