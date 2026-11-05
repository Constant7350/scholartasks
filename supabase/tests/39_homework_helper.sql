\set ON_ERROR_STOP on
\o /dev/null
-- Homework Helper (0039): parent switch, add-on limits, and the parent's log.
insert into user_settings (user_id, ai_consent_at) values ('00000000-0000-0000-0000-000000003901', now()),('00000000-0000-0000-0000-000000003902', now()),('00000000-0000-0000-0000-000000003903', now()) on conflict (user_id) do update set ai_consent_at = excluded.ai_consent_at;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000003901', false);
create temp table hw (k text primary key, v text);
grant select on hw to service_role;
insert into hw values ('family', create_family('The Rivers')::text);
insert into hw values ('student', add_student((select v::uuid from hw where k='family'), 'Emma', '2010-02-01', 10, 'GA')::text);
insert into hw values ('code', create_student_invite((select v::uuid from hw where k='student')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000003902', false);
select accept_student_invite((select v from hw where k='code'));
do $$
declare s uuid := (select v::uuid from hw where k='student');
begin
  assert homework_enabled(s), 'on by default';
  -- Add-on turns: 2 a day for the student, 3 a month for the family (small numbers for the test).
  assert homework_take_turn(s, true, 2, 3), 'turn 1';
  assert homework_take_turn(s, true, 2, 3), 'turn 2';
  assert not homework_take_turn(s, true, 2, 3), 'daily limit, no pack';
  -- Without the add-on, a turn is an ordinary AI use.
  assert homework_take_turn(s, false, 1, 0), 'ordinary turn';
  assert not homework_take_turn(s, false, 1, 0), 'ordinary limit';
  -- The student writes log lines; bad help types are refused.
  perform homework_log_add(s, 'Math', 'Solving two-step equations', 'hint', 1, false, null, false, 'Worked on isolating x');
  perform homework_log_add(s, 'English', 'Essay thesis', 'redirect', 0, false, 'writing', false, 'Asked for a paragraph; helped plan it instead');
  begin
    perform homework_log_add(s, 'Math', null, 'answer_given', 0, false, null, false, null);
    raise exception 'FAIL: bad help type saved';
  exception when check_violation then null; end;
  assert (select count(*) from homework_log) = 2, 'student sees own log';
  begin
    perform homework_set_enabled(s, false);
    raise exception 'FAIL: student turned the switch';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    insert into homework_log (student_id, subject, help_type) values (s, 'Math', 'hint');
    raise exception 'FAIL: direct insert';
  exception when insufficient_privilege then null; end;
end $$;
-- The parent sees the log and turns the helper off; the student is refused, the parent is not.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000003901', false);
do $$
declare s uuid := (select v::uuid from hw where k='student');
begin
  assert (select count(*) from homework_log where said_no = 'writing') = 1, 'parent sees said-no line';
  perform homework_set_enabled(s, false);
  assert not homework_enabled(s), 'off';
  assert homework_take_turn(s, false, 5, 0), 'parent can still use it';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000003902', false);
do $$ begin
  perform homework_take_turn((select v::uuid from hw where k='student'), true, 40, 500);
  raise exception 'FAIL: student used helper while off';
exception when raise_exception then if sqlerrm <> 'helper turned off' then raise; end if;
end $$;
-- Someone outside the family sees nothing and can't use or log for Emma.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000003903', false);
do $$
declare s uuid := (select v::uuid from hw where k='student');
begin
  assert (select count(*) from homework_log) = 0 and (select count(*) from homework_usage) = 0, 'outsider sees nothing';
  begin
    perform homework_take_turn(s, true, 40, 500);
    raise exception 'FAIL: outsider took a turn';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    perform homework_log_add(s, 'Math', null, 'hint', 0, false, null, false, null);
    raise exception 'FAIL: outsider logged';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
\o
\echo HOMEWORK HELPER CHECKS PASSED
