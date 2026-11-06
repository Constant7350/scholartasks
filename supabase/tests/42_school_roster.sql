\set ON_ERROR_STOP on
\o /dev/null
-- Counselor-admin a1 sets up a school; parent p1 with Mia connects; counselor c2 joins; outsider o1.
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000042f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000042a1', 'admin@school.example'),
  ('00000000-0000-0000-0000-0000000042b1', 'Mom@Example.com'),
  ('00000000-0000-0000-0000-0000000042c2', 'c2@school.example');
set role authenticated;
create temp table h42 (k text primary key, v text);
grant all on h42 to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042a1', false);
insert into h42 values ('school', create_school('Roster High', 'Athens', 'GA', null, null, 'Ana Ruiz', 'Lead counselor')::text);
insert into h42 select 'join', join_code from schools where id = (select v::uuid from h42 where k='school');
insert into h42 select 'staff', staff_code from schools where id = (select v::uuid from h42 where k='school');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042f1', false);
select review_school((select v::uuid from h42 where k='school'), 'approved');

-- No roster before the agreement is signed.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042a1', false);
do $$ declare s uuid := (select v::uuid from h42 where k='school'); begin
  begin
    perform upload_school_roster(s, '[{"student_ref":"1","first_name":"Mia","last_name":"Diaz","grade_level":12}]'::jsonb);
    raise exception 'FAIL: roster before agreement';
  exception when raise_exception then if sqlerrm not like 'Sign the student data agreement%' then raise; end if; end;
  perform sign_school_data_agreement(s, 'Ana Ruiz', 'Lead counselor', 'Clarke County');
  assert (select count(*) from school_data_agreements where school_id = s and ended_at is null) = 1, 'agreement signed';
  assert upload_school_roster(s, '[{"student_ref":"1","first_name":"Mia","last_name":"Diaz","grade_level":12,"email":"mom@example.com"},
                                    {"student_ref":"2","first_name":"Leo","last_name":"Park","grade_level":11,"email":"leo.family@example.com"},
                                    {"student_ref":"3","first_name":"Ava","last_name":"Kim","grade_level":10}]'::jsonb) = 3, 'three uploaded';
  begin
    perform upload_school_roster(s, '[{"student_ref":"4","first_name":"Bad","last_name":"Grade","grade_level":13}]'::jsonb, false);
    raise exception 'FAIL: grade 13 accepted';
  exception when check_violation then null; end;
end $$;

-- Mia's parent connects to the school; the roster shows her as connected.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042b1', false);
insert into h42 values ('fam', create_family('Diaz')::text);
insert into h42 values ('mia', add_student((select v::uuid from h42 where k='fam'), 'Mia', (current_date - interval '17 years')::date, 12, 'GA')::text);
select link_student_to_school((select v::uuid from h42 where k='mia'), (select v from h42 where k='join'), 'progress');
do $$ begin
  assert (select count(*) from school_roster) = 0, 'families never see a roster';
  begin perform * from school_roster_status((select v::uuid from h42 where k='school')); exception when others then null; end;
  assert (select count(*) from school_roster_status((select v::uuid from h42 where k='school'))) = 0, 'non-staff get no roster rows';
end $$;

-- A counselor who joins sees the roster but cannot upload or sign.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042c2', false);
select join_school_staff((select v from h42 where k='staff'), 'Sam Cole', 'Counselor');
do $$ declare s uuid := (select v::uuid from h42 where k='school'); begin
  assert (select count(*) from school_roster) = 3, 'counselor sees roster';
  assert (select connected from school_roster_status(s) where student_ref = '1'), 'Mia is connected (email match ignores case)';
  assert not (select connected from school_roster_status(s) where student_ref = '2'), 'Leo is not connected';
  begin
    perform upload_school_roster(s, '[]'::jsonb);
    raise exception 'FAIL: counselor uploaded';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;

-- Invites go to roster families not yet connected, once a week.
set role service_role;
do $$ declare s uuid := (select v::uuid from h42 where k='school'); begin
  assert (select array_agg(email) from school_roster_invitees(s, '00000000-0000-0000-0000-0000000042c2', '{}')) = array['leo.family@example.com'], 'only Leo is invited';
  assert (select count(*) from school_roster_invitees(s, '00000000-0000-0000-0000-0000000042c2', '{}')) = 0, 'not twice in a week';
end $$;
reset role;

-- Ending the agreement deletes the roster 45 days later; deleting now works for the admin.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042a1', false);
select end_school_data_agreement((select v::uuid from h42 where k='school'));
reset role;
do $$ begin
  assert purge_school_rosters() = 0, 'kept during the 45 days';
  update school_data_agreements set ended_at = now() - interval '46 days';
  assert purge_school_rosters() = 3, 'deleted after 45 days';
  assert (select count(*) from audit_log where target in ('school_roster', 'school_data_agreement')) >= 4, 'audited';
end $$;

-- An outsider sees nothing.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000042e1', false);
do $$ begin
  assert (select count(*) from school_data_agreements) = 0, 'outsider sees no agreements';
end $$;
reset role;
\o
\echo SCHOOL ROSTER CHECKS PASSED
