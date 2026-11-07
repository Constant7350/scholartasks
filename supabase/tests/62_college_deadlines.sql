\set ON_ERROR_STOP on
\o /dev/null
-- College deadlines: anyone signed in can read them, only the team can write, and the starter
-- rows only appear when the college itself is loaded.
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000062f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000062a1', 'p62@example.com');

-- A college the team loaded, then its dates.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000062f1', false);
insert into colleges (id, name, state, ownership) values (999062, 'Test State University', 'GA', 1);
insert into college_deadlines (college_id, plan, month, day, note) values (999062, 'EA', 10, 15, null), (999062, 'aid_priority', 2, 1, 'FAFSA priority');

-- A parent reads them but cannot change them.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000062a1', false);
do $$ begin
  if (select count(*) from college_deadlines where college_id = 999062) <> 2 then raise exception 'parent should see both dates'; end if;
end $$;
do $$ begin
  insert into college_deadlines (college_id, plan, month, day) values (999062, 'RD', 1, 1);
  raise exception 'parent must not add deadlines';
exception when insufficient_privilege or check_violation then null;
  when others then if sqlerrm like '%row-level security%' then null; else raise; end if;
end $$;
do $$ begin
  if exists (select 1 from college_deadlines where college_id = 999062 and plan = 'RD') then raise exception 'parent insert should have been refused'; end if;
end $$;

-- Bad plan names and days are refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000062f1', false);
do $$ begin
  insert into college_deadlines (college_id, plan, month, day) values (999062, 'whenever', 1, 1);
  raise exception 'bad plan accepted';
exception when check_violation then null;
end $$;
do $$ begin
  insert into college_deadlines (college_id, plan, month, day) values (999062, 'RD', 13, 1);
  raise exception 'bad month accepted';
exception when check_violation then null;
end $$;

reset role;
delete from colleges where id = 999062;
do $$ begin
  if exists (select 1 from college_deadlines where college_id = 999062) then raise exception 'dates should go with the college'; end if;
end $$;
\echo COLLEGE DEADLINE CHECKS PASSED
