\set ON_ERROR_STOP on
\o /dev/null
-- School portal v2: events that connected families see, and private counselor notes that only
-- that school's counselors see while the student is connected.
-- People: parent p (61a1), student Bo (61b1), counselor c (61c1), other school's counselor x (61d1),
-- outsider parent o (61e1), team admin t (61f1).
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000061f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000061a1', 'p61@example.com'),
  ('00000000-0000-0000-0000-0000000061b1', 'bo61@example.com'),
  ('00000000-0000-0000-0000-0000000061c1', 'c61@school.example'),
  ('00000000-0000-0000-0000-0000000061d1', 'x61@school.example'),
  ('00000000-0000-0000-0000-0000000061e1', 'o61@example.com');

set role authenticated;
create temp table r (k text primary key, v text);
grant all on r to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061a1', false);
insert into r values ('fam', create_family('Portal Test')::text);
insert into r values ('bo', add_student((select v::uuid from r where k='fam'), 'Bo', (current_date - interval '17 years')::date, 12, 'GA')::text);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061c1', false);
insert into r values ('school', create_school('Event High', 'Athens', 'GA', null, null, 'Pat Lee', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061d1', false);
insert into r values ('school2', create_school('Other High', 'Athens', 'GA', null, null, 'Sam Roe', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061f1', false);
select review_school((select v::uuid from r where k='school'), 'approved');
select review_school((select v::uuid from r where k='school2'), 'approved');
insert into r select 'join', join_code from schools where id = (select v::uuid from r where k='school');

-- Counselor posts an event; can't write a note before Bo is connected.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061c1', false);
insert into school_events (school_id, title, starts_on, grades) values ((select v::uuid from r where k='school'), 'FAFSA night', current_date + 5, '{12}');
do $$ begin
  begin
    insert into school_student_notes (school_id, student_id, body) values ((select v::uuid from r where k='school'), (select v::uuid from r where k='bo'), 'early note');
    raise exception 'FAIL: note before connecting';
  exception when insufficient_privilege then null; end;
end $$;

-- The family doesn't see the event until connected.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061a1', false);
do $$ begin assert (select count(*) from school_events) = 0, 'not connected, no events'; end $$;
select test_sign('school_link', (select v::uuid from r where k='bo'));
select link_student_to_school((select v::uuid from r where k='bo'), (select v from r where k='join'), 'progress');
do $$ begin assert (select count(*) from school_events) = 1, 'connected family sees event'; end $$;

-- Counselor writes a private note; author name filled in.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061c1', false);
insert into school_student_notes (school_id, student_id, body) values ((select v::uuid from r where k='school'), (select v::uuid from r where k='bo'), 'Wants engineering.');
do $$ begin
  assert (select author_name from school_student_notes) = 'Pat Lee', 'author name';
end $$;

-- Family, outsider and the other school's counselor never see notes; the other school can't add events here.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061a1', false);
do $$ begin assert (select count(*) from school_student_notes) = 0, 'family never sees notes'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061e1', false);
do $$ begin
  assert (select count(*) from school_student_notes) = 0, 'outsider sees no notes';
  assert (select count(*) from school_events) = 0, 'outsider sees no events';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061d1', false);
do $$ begin
  assert (select count(*) from school_student_notes) = 0, 'other school sees no notes';
  begin
    insert into school_events (school_id, title, starts_on) values ((select v::uuid from r where k='school'), 'Fake', current_date);
    raise exception 'FAIL: other school posted an event';
  exception when insufficient_privilege then null; end;
end $$;

-- Once the family disconnects, the notes are hidden from counselors too.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061a1', false);
select end_school_link((select id from my_school_links() limit 1));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000061c1', false);
do $$ begin assert (select count(*) from school_student_notes) = 0, 'notes hidden after disconnect'; end $$;
reset role;
do $$ begin
  assert (select count(*) from audit_log where target = 'school_student_notes') >= 1, 'note logged';
  assert (select count(*) from audit_log where target = 'school_events') >= 1, 'event logged';
end $$;
\o
\echo SCHOOL PORTAL V2 CHECKS PASSED
