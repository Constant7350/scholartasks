\set ON_ERROR_STOP on
\o /dev/null
-- People: counselor c1 (sets up the school), counselor c2 (joins with the staff code),
-- team admin t1, parent p1 with Ben (grade 11, signs in as s1), outsider o1.
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000035f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000035a1', 'parent@example.com'),
  ('00000000-0000-0000-0000-0000000035b1', 'ben@example.com'),
  ('00000000-0000-0000-0000-0000000035c1', 'counselor@school.example');

set role authenticated;
create temp table r (k text primary key, v text);
grant all on r to authenticated, service_role;

-- Parent sets up Ben; Ben joins the student app.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035a1', false);
insert into r values ('fam', create_family('School Test')::text);
insert into r values ('ben', add_student((select v::uuid from r where k='fam'), 'Ben', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r values ('code', create_student_invite((select v::uuid from r where k='ben')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035b1', false);
select accept_student_invite((select v from r where k='code'));

-- Counselor signs the school up. It waits for team approval.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
insert into r values ('school', create_school('Test High School', 'Macon', 'ga', null, null, 'Pat Lee', 'Counselor')::text);
insert into r select 'join', join_code from schools where id = (select v::uuid from r where k='school');
insert into r select 'staff', staff_code from schools where id = (select v::uuid from r where k='school');
do $$ begin
  assert (select status from schools where id = (select v::uuid from r where k='school')) = 'pending', 'starts pending';
  assert (select state from schools where id = (select v::uuid from r where k='school')) = 'GA', 'state upper-cased';
  begin
    perform * from school_caseload((select v::uuid from r where k='school'));
    raise exception 'FAIL: pending school saw a caseload';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    perform review_school((select v::uuid from r where k='school'), 'approved');
    raise exception 'FAIL: counselor approved their own school';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- Families can't find or connect to a school that isn't approved.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035a1', false);
do $$ begin
  assert not exists (select 1 from school_lookup((select v from r where k='join'))), 'pending school hidden';
  begin
    perform link_student_to_school((select v::uuid from r where k='ben'), (select v from r where k='join'), 'progress');
    raise exception 'FAIL: linked to a pending school';
  exception when raise_exception then if sqlerrm not like 'That school code%' then raise; end if; end;
end $$;

-- The team approves it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035f1', false);
select review_school((select v::uuid from r where k='school'), 'approved');
do $$ begin
  assert (select count(*) from schools_for_review()) >= 1, 'team sees schools';
  assert (select staff->0->>'email' from schools_for_review() where id = (select v::uuid from r where k='school')) = 'counselor@school.example', 'team sees sign-up email';
end $$;

-- Ben (16) asks to connect; a parent must approve first.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035b1', false);
do $$ begin
  assert (select name from school_lookup(lower((select v from r where k='join')))) = 'Test High School', 'lookup works';
  assert link_student_to_school((select v::uuid from r where k='ben'), (select v from r where k='join'), 'progress') = 'pending_parent', 'student under 18 waits for parent';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
do $$ begin
  assert (select count(*) from school_caseload((select v::uuid from r where k='school'))) = 0, 'not shown before parent approves';
  assert school_pending_count((select v::uuid from r where k='school')) = 1, 'pending count';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035a1', false);
insert into r select 'link', id::text from my_school_links();
select test_sign('school_link', (select v::uuid from r where k='ben'));
select approve_school_link((select v::uuid from r where k='link'));

-- Ben has some progress to show.
insert into course_grades (student_id, term, course, grade, level, core, grade_level)
values ((select v::uuid from r where k='ben'), 'Fall', 'English 11', 'A', 'honors', true, 11);
insert into student_colleges (student_id, name, status) values ((select v::uuid from r where k='ben'), 'UGA', 'submitted');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
do $$ declare row record; begin
  select * into row from school_caseload((select v::uuid from r where k='school'));
  assert row.first_name = 'Ben', 'Ben on caseload';
  assert row.colleges = 1 and row.submitted = 1, 'college counts';
  assert row.grades is null, 'grades hidden on progress-only sharing';
  assert row.class_of = school_year_end() + 1, 'class year from grade 11';
end $$;

-- Ben can't share more by himself; the parent can.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035b1', false);
do $$ begin
  begin
    perform set_school_link_share((select v::uuid from r where k='link'), 'progress_grades');
    raise exception 'FAIL: student under 18 widened sharing';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035a1', false);
select set_school_link_share((select v::uuid from r where k='link'), 'progress_grades');

-- A second counselor joins with the staff code and sees grades now.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c2', false);
select join_school_staff((select v from r where k='staff'), 'Sam Ray', null);
do $$ begin
  assert jsonb_array_length((select grades from school_caseload((select v::uuid from r where k='school')))) = 1, 'grades shared';
  begin
    perform new_school_codes((select v::uuid from r where k='school'), 'join');
    raise exception 'FAIL: counselor (not admin) changed codes';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- An outsider sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035e1', false);
do $$ begin
  assert (select count(*) from schools) = 0, 'outsider sees no schools';
  assert (select count(*) from school_links) = 0, 'outsider sees no links';
  begin
    perform * from school_caseload((select v::uuid from r where k='school'));
    raise exception 'FAIL: outsider saw a caseload';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- Local scholarship: only the school's families and staff see it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
insert into r values ('sch', school_post_scholarship((select v::uuid from r where k='school'), 'Rotary Award',
  'https://example.org/award', 'A local award for seniors at this school.', '$500', 500, null, null, '{12}')::text);
do $$ begin
  assert (select status from school_scholarships((select v::uuid from r where k='school'))) = 'pending', 'goes to team review';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035a1', false);
do $$ begin
  assert exists (select 1 from scholarships where id = (select v::uuid from r where k='sch')), 'family sees local award';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035e1', false);
do $$ begin
  assert not exists (select 1 from scholarships where id = (select v::uuid from r where k='sch')), 'outsider does not';
end $$;

-- Messages: only the server can get the email list.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
do $$ begin
  begin
    perform * from school_message_recipients((select v::uuid from r where k='school'), '00000000-0000-0000-0000-0000000035c1', '{}', 'Hi', 'Hello');
    raise exception 'FAIL: counselor called recipients directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare emails text[]; begin
  emails := array(select email from school_message_recipients((select v::uuid from r where k='school'),
                  '00000000-0000-0000-0000-0000000035c1', '{11}', 'FAFSA night', 'Join us Tuesday.') order by 1);
  assert emails = array['ben@example.com', 'parent@example.com'], 'student and parent get it';
  emails := array(select email from school_message_recipients((select v::uuid from r where k='school'),
                  '00000000-0000-0000-0000-0000000035c1', '{12}', 'Seniors', 'Only seniors.'));
  assert cardinality(emails) = 0, 'grade filter';
  begin
    perform * from school_message_recipients((select v::uuid from r where k='school'), '00000000-0000-0000-0000-0000000035e1', '{}', 'Hi', 'Hello');
    raise exception 'FAIL: outsider sent a message';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;

-- Ben stops sharing; the school no longer sees him.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035b1', false);
select end_school_link((select v::uuid from r where k='link'));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000035c1', false);
do $$ begin
  assert (select count(*) from school_caseload((select v::uuid from r where k='school'))) = 0, 'gone after ending';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from audit_log where action = 'view' and target = 'school_caseload'), 'caseload views audited';
  assert exists (select 1 from audit_log where action = 'school_message'), 'messages audited';
end $$;
\o
\echo SCHOOL PORTAL CHECKS PASSED
