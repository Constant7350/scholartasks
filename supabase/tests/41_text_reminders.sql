\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000004a1', false);
create temp table h41 (k text primary key, v text);
grant all on h41 to authenticated, service_role;
insert into h41 values ('family', create_family('The Texters')::text);
insert into h41 values ('student', add_student((select v::uuid from h41 where k='family'), 'Emma', '2008-03-01', 12, 'GA')::text);
insert into tasks (student_id, title, kind, due_on) values ((select v::uuid from h41 where k='student'), 'Rotary essay', 'scholarship', current_date + 7);
insert into tasks (student_id, title, kind, due_on) values ((select v::uuid from h41 where k='student'), 'SAT signup', 'test', current_date + 14);

-- People cannot switch texts on for themselves: only the server can, after the code check.
do $$ begin
  begin
    insert into sms_settings (user_id, phone, sms_on, verified_at) values (auth.uid(), '+14045550123', true, now());
    raise exception 'FAIL: user turned on texts without a code';
  exception when insufficient_privilege then null; end;
  begin perform * from sms_reminders_due(current_date); raise exception 'FAIL: user called sms_reminders_due';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into auth.users values ('00000000-0000-0000-0000-0000000004a1', 'texter@example.com');
-- The server saves a verified number (Supabase's service role skips row rules).
insert into sms_settings (user_id, phone, sms_on, verified_at) values ('00000000-0000-0000-0000-0000000004a1', '+14045550123', true, now());
do $$ begin
  begin
    insert into sms_settings (user_id, phone) values (gen_random_uuid(), '555-1234');
    raise exception 'FAIL: bad phone accepted';
  exception when check_violation or foreign_key_violation then null; end;
end $$;

-- The owner sees their row; a stranger does not.
set role authenticated;
do $$ begin
  assert (select phone from sms_settings) = '+14045550123', 'owner reads own number';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000004a9', false);
do $$ begin
  assert (select count(*) from sms_settings) = 0, 'stranger sees no numbers';
end $$;
reset role;

set role service_role;
do $$ declare n int; begin
  select count(*) into n from sms_reminders_due(current_date);
  assert n = 1, format('only the 7-day deadline is texted, got %s', n);
  assert (select texts_this_month from sms_reminders_due(current_date) limit 1) = 0, 'no texts yet this month';
end $$;
reset role;
insert into sms_log (user_id, item_type, item_id, days_before) select user_id, item_type, item_id, days_before from sms_reminders_due(current_date);
insert into sms_log (user_id, item_type) values ('00000000-0000-0000-0000-0000000004a1', 'batch');
set role service_role;
do $$ begin
  assert (select count(*) from sms_reminders_due(current_date)) = 0, 'nothing is texted twice';
end $$;
reset role;
update sms_settings set sms_on = false;
delete from sms_log where item_type <> 'batch';
set role service_role;
do $$ begin
  assert (select count(*) from sms_reminders_due(current_date)) = 0, 'texts off stops them';
end $$;
reset role;
\o
\echo TEXT REMINDER CHECKS PASSED
