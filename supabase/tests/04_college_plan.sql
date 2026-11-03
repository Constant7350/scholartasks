\set ON_ERROR_STOP on
\o /dev/null
-- Parent p1 with student Ava (connected as s1); stranger p2.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
create temp table c (k text primary key, v text);
grant all on c to authenticated, service_role;
insert into c values ('family', create_family('The Lees')::text);
insert into c values ('student', add_student((select v::uuid from c where k='family'), 'Ava', '2008-03-01', 12, 'GA')::text);
insert into c values ('code', create_student_invite((select v::uuid from c where k='student')));

-- Parent adds a college and a scholarship deadline.
insert into student_colleges (student_id, name, plan, deadline)
  values ((select v::uuid from c where k='student'), 'University of Georgia', 'EA', current_date + 14);
insert into tasks (student_id, title, kind, due_on, amount)
  values ((select v::uuid from c where k='student'), 'Coca-Cola Scholars', 'scholarship', current_date + 7, 20000);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', false);
do $$ begin
  perform accept_student_invite((select v from c where k='code'));
  assert (select count(*) from student_colleges) = 1, 'student sees her college list';
  -- No "change plan" permission by default: an approved addition is refused, a pending one is allowed.
  begin
    insert into student_colleges (student_id, name) values ((select v::uuid from c where k='student'), 'Emory');
    raise exception 'FAIL: student added approved college without permission';
  exception when insufficient_privilege then null; end;
  insert into student_colleges (student_id, name, approved) values ((select v::uuid from c where k='student'), 'Emory', false);
  insert into tasks (student_id, title, kind, due_on) values ((select v::uuid from c where k='student'), 'SAT', 'test', current_date + 30);
  assert (select count(*) from tasks) = 2, 'student sees both deadlines';
  -- She can delete what she added, not what her parent added.
  delete from tasks where kind = 'scholarship';
  assert (select count(*) from tasks) = 2, 'parent-added task survives student delete';
end $$;

-- A stranger sees nothing and cannot add.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
do $$ begin
  assert (select count(*) from student_colleges) = 0, 'stranger sees no colleges';
  assert (select count(*) from tasks) = 0, 'stranger sees no tasks';
  begin
    insert into student_colleges (student_id, name) values ((select v::uuid from c where k='student'), 'Hack U');
    raise exception 'FAIL: stranger inserted';
  exception when insufficient_privilege then null; end;
  begin
    perform approve_college((select id from student_colleges limit 1));
  exception when raise_exception then null; end;
end $$;

-- Parent approves Emory; reminders opt-out is per user.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
do $$ begin
  perform approve_college((select id from student_colleges where name = 'Emory'));
  assert (select approved from student_colleges where name = 'Emory'), 'parent approved';
  assert (select count(*) from audit_log where target = 'student_colleges') >= 3, 'college changes audited';
end $$;
insert into user_settings (email_reminders) values (true);

-- Users cannot call the reminder job functions.
do $$ begin
  begin perform * from reminders_due(current_date); raise exception 'FAIL: user called reminders_due';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The server job sees today's due reminders for parent and student, once.
insert into auth.users values ('00000000-0000-0000-0000-0000000000f1', 'parent@example.com'), ('00000000-0000-0000-0000-0000000000f5', 'ava@example.com');
set role service_role;
do $$ declare n int; begin
  select count(*) into n from reminders_due(current_date) where title like 'University of Georgia%';
  assert n = 2, format('UGA 14-day reminder goes to parent and student, got %s', n);
  select count(*) into n from reminders_due(current_date) where title = 'Coca-Cola Scholars';
  assert n = 2, 'scholarship 7-day reminder';
  select count(*) into n from reminders_due(current_date) where title = 'SAT';
  assert n = 2, 'SAT 30-day reminder';
  perform mark_reminder_sent(user_id, item_type, item_id, days_before) from reminders_due(current_date);
  assert (select count(*) from reminders_due(current_date)) = 0, 'nothing is sent twice';
end $$;
reset role;
-- Turning reminders off stops them.
update user_settings set email_reminders = false where user_id = '00000000-0000-0000-0000-0000000000f1';
delete from reminder_log;
set role service_role;
do $$ begin
  assert (select count(*) from reminders_due(current_date) where email = 'parent@example.com') = 0, 'opted-out parent gets none';
  assert (select count(*) from reminders_due(current_date) where email = 'ava@example.com') = 3, 'student still gets hers';
end $$;
reset role;
\o
\echo COLLEGE PLAN CHECKS PASSED
