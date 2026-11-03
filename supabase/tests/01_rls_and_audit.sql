-- Run after the migration on a scratch database. Any failed check raises an error.
\set ON_ERROR_STOP on
\o /dev/null
grant usage on schema auth to authenticated;

-- Ids: f* families, a* students, b* parent users, c* student users.
insert into families (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Family One'),
  ('00000000-0000-0000-0000-0000000000f2', 'Family Two');
insert into students (id, family_id, first_name, birth_date, grade_level, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'Ava', '2011-03-01', 10, 'GA'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'Ben', '2008-01-15', 12, 'GA');
insert into family_members (family_id, user_id, role, student_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'parent', null),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'student', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000b2', 'parent', null),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2', 'student', '00000000-0000-0000-0000-0000000000a2');

set role authenticated;

-- 1. Parent of family one sees only their own child.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $$ begin
  assert (select count(*) from students) = 1, 'parent should see exactly one student';
  assert (select first_name from students) = 'Ava', 'parent should see Ava';
end $$;
insert into course_grades (student_id, term, course, grade, level, core, grade_level)
values ('00000000-0000-0000-0000-0000000000a1', '2026-fall', 'Biology', 'B', 'AP', true, 10);
select log_access('00000000-0000-0000-0000-0000000000a1', 'view', '{"screen":"grades"}');
do $$ begin
  assert (select count(*) from audit_log where action = 'insert' and target = 'course_grades') = 1, 'grade insert must be audited';
  assert (select count(*) from audit_log where action = 'view') = 1, 'view must be audited';
  assert (select count(*) from audit_log where family_id <> '00000000-0000-0000-0000-0000000000f1') = 0, 'parent must not see other families'' log';
end $$;

-- 2. Student can enter grades while allowed, but cannot change permissions.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
insert into course_grades (student_id, term, course, grade, level, core, grade_level)
values ('00000000-0000-0000-0000-0000000000a1', '2026-fall', 'Algebra II', 'A', 'standard', true, 10);
update students set permissions = permissions || '{"see_income_and_costs": true}';
do $$ begin
  assert (select (permissions->>'see_income_and_costs')::boolean from students) = false, 'student must not change permissions';
  assert (select count(*) from audit_log) = 0, 'students must not read the audit log';
  assert (select count(*) from course_grades) = 2, 'student sees own grades';
end $$;

-- 3. Parent turns off grade entry; the student's next insert is refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
update students set permissions = permissions || '{"enter_grades": false}' where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ begin
  begin
    insert into course_grades (student_id, term, course, grade, level, core, grade_level)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-fall', 'History', 'C', 'standard', true, 10);
    raise exception 'FAIL: insert should have been refused';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. Under-18 student cannot cut off parent access; other families cannot log access.
do $$ begin
  begin
    perform set_adult_consent('00000000-0000-0000-0000-0000000000a1', false);
    raise exception 'FAIL: under-18 consent change should fail';
  exception when raise_exception then
    if sqlerrm not like '%18 or older%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $$ begin
  begin
    perform log_access('00000000-0000-0000-0000-0000000000a1', 'view');
    raise exception 'FAIL: other parent should not log access';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;

-- 5. An 18+ student who declines parent access hides their data from the parent.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select set_adult_consent('00000000-0000-0000-0000-0000000000a2', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $$ begin
  assert (select count(*) from students) = 0, 'parent must lose access after an adult student declines';
end $$;

-- 6. The audit log cannot be edited or deleted, and tampering is detectable.
reset role;
do $$ begin
  begin
    update audit_log set action = 'nothing';
    raise exception 'FAIL: update should be blocked';
  exception when raise_exception then
    if sqlerrm <> 'audit_log is append-only' then raise; end if;
  end;
  begin
    delete from audit_log;
    raise exception 'FAIL: delete should be blocked';
  exception when raise_exception then
    if sqlerrm <> 'audit_log is append-only' then raise; end if;
  end;
  assert (select count(*) from verify_audit_chain()) = 0, 'chain should verify';
end $$;
-- Simulate an attacker with database-owner rights who disables the trigger.
alter table audit_log disable trigger audit_log_no_update;
update audit_log set details = '{"row":"forged"}' where id = (select min(id) from audit_log where action = 'insert' and target = 'course_grades');
alter table audit_log enable trigger audit_log_no_update;
do $$ begin
  assert (select count(*) from verify_audit_chain()) > 0, 'tampering must be detected';
end $$;

\o
\echo ALL DATABASE CHECKS PASSED
