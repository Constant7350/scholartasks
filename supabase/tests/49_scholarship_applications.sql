\set ON_ERROR_STOP on
\o /dev/null
-- Applying to scholarships in the app: families keep their own application workspace;
-- a school's own local award can be sent to that school in the app; only that
-- school's counselors read it; every send, look and decision is logged.
-- People: parent p (49a1), student Mia (49b1), counselor c (49c1), other school's counselor x (49d1),
-- outsider parent o (49e1), team admin t (49f1).
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000049f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000049a1', 'p49@example.com'),
  ('00000000-0000-0000-0000-0000000049b1', 'mia49@example.com'),
  ('00000000-0000-0000-0000-0000000049c1', 'c49@school.example'),
  ('00000000-0000-0000-0000-0000000049d1', 'x49@school.example'),
  ('00000000-0000-0000-0000-0000000049e1', 'o49@example.com');

set role authenticated;
create temp table r (k text primary key, v text);
grant all on r to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049a1', false);
insert into r values ('fam', create_family('Apply Test')::text);
insert into r values ('mia', add_student((select v::uuid from r where k='fam'), 'Mia', (current_date - interval '17 years')::date, 12, 'GA')::text);
insert into r values ('code', create_student_invite((select v::uuid from r where k='mia')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049b1', false);
select accept_student_invite((select v from r where k='code'));

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049e1', false);
insert into r values ('ofam', create_family('Other')::text);
insert into r values ('oli', add_student((select v::uuid from r where k='ofam'), 'Oli', (current_date - interval '17 years')::date, 12, 'GA')::text);

-- Two schools; the team approves both.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049c1', false);
insert into r values ('school', create_school('Apply High', 'Macon', 'GA', null, null, 'Pat Lee', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049d1', false);
insert into r values ('school2', create_school('Other High', 'Macon', 'GA', null, null, 'Sam Roe', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049f1', false);
select review_school((select v::uuid from r where k='school'), 'approved');
select review_school((select v::uuid from r where k='school2'), 'approved');
insert into r select 'join', join_code from schools where id = (select v::uuid from r where k='school');

-- A national award (team adds it) and the school's own local award (counselor posts it).
insert into scholarships (name, sponsor, url, summary, amount_text, status, deadline)
values ('Apply Test National Award', 'Test Org', 'https://example.org/a', 'For any senior who writes an essay.', '$2,000', 'approved', current_date + 30);
insert into r select 'nat', id::text from scholarships where name = 'Apply Test National Award';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049c1', false);
insert into r values ('local', school_post_scholarship((select v::uuid from r where k='school'), 'Rotary Award', 'https://example.org/rotary',
  'For a senior at Apply High who serves the community.', '$1,000', 1000, current_date + 20, 'Apply in ScholarTasks.', '{12}')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049d1', false);
insert into r values ('local2', school_post_scholarship((select v::uuid from r where k='school2'), 'Lions Award', 'https://example.org/lions',
  'For a senior at Other High who serves the community.', '$500', 500, current_date + 20, null, '{12}')::text);

-- Mia keeps an application workspace; her parent sees it; an outsider doesn't.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049b1', false);
insert into scholarship_applications (student_id, scholarship_id, answers, docs, recommenders)
values ((select v::uuid from r where k='mia'), (select v::uuid from r where k='nat'),
        '[{"q":"Why you?","a":"I love animals."}]', '[{"name":"Transcript","done":false}]', '[{"name":"Ms. Lee","received":false}]');
update scholarship_applications set status = 'submitted', submitted_on = current_date, confirmation = 'ABC123'
 where scholarship_id = (select v::uuid from r where k='nat');
do $$ begin
  assert (select confirmation from scholarship_applications where scholarship_id = (select v::uuid from r where k='nat')) = 'ABC123', 'student updates own';
  begin
    insert into scholarship_applications (student_id, scholarship_id, answers) values ((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'), '{"bad":1}');
    raise exception 'FAIL: answers must be a list';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049a1', false);
do $$ begin
  assert (select count(*) from scholarship_applications) = 1, 'parent sees it';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049e1', false);
do $$ begin
  assert (select count(*) from scholarship_applications) = 0, 'outsider sees nothing';
  begin
    insert into scholarship_applications (student_id, scholarship_id) values ((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'));
    raise exception 'FAIL: outsider wrote into another family';
  exception when insufficient_privilege then null; end;
end $$;

-- Sending: only for a school's own award, only once connected to that school, and not to another school.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049b1', false);
do $$ begin
  begin
    perform send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='nat'), '{"full_name":"Mia Smith"}');
    raise exception 'FAIL: national award sent to a school';
  exception when raise_exception then if sqlerrm not like '%official site%' then raise; end if; end;
  begin
    perform send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'), '{"full_name":"Mia Smith"}');
    raise exception 'FAIL: sent before connecting';
  exception when raise_exception then if sqlerrm not like 'Connect to this school%' then raise; end if; end;
end $$;
-- Mia is 17: she asks to connect and her parent approves.
select link_student_to_school((select v::uuid from r where k='mia'), (select v from r where k='join'), 'progress');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049a1', false);
select approve_school_link((select id from my_school_links() limit 1));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049b1', false);
do $$ begin
  begin
    perform send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'), '{"full_name":" "}');
    raise exception 'FAIL: sent with no name';
  exception when raise_exception then if sqlerrm <> 'Type your full name.' then raise; end if; end;
  begin
    perform send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local2'), '{"full_name":"Mia Smith"}');
    raise exception 'FAIL: sent to a school she is not connected to';
  exception when raise_exception then if sqlerrm not like 'Connect to this school%' then raise; end if; end;
end $$;
insert into r values ('sub', send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'),
  '{"full_name":"Mia Smith","grade_level":12,"answers":[{"q":"Why you?","a":"I volunteer every week."}]}')::text);
-- Sending again while it's new just updates it.
select send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'),
  '{"full_name":"Mia Smith","grade_level":12,"answers":[{"q":"Why you?","a":"I volunteer every Saturday."}]}');
do $$ begin
  assert (select count(*) from school_scholarship_submissions) = 1, 'one submission, family can read it';
  assert (select packet->'answers'->0->>'a' from school_scholarship_submissions) = 'I volunteer every Saturday.', 'resend updates the packet';
  assert (select status from scholarship_applications where scholarship_id = (select v::uuid from r where k='local')) = 'submitted', 'tracker marked sent';
  begin
    update school_scholarship_submissions set status = 'awarded';
    raise exception 'FAIL: family changed the school decision';
  exception when insufficient_privilege then null; end;
end $$;

-- Only that school's counselor reads it, and each look is logged.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049d1', false);
do $$ begin
  begin
    perform * from school_applications((select v::uuid from r where k='school'));
    raise exception 'FAIL: other school read the applications';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    perform school_review_application((select v::uuid from r where k='sub'), 'awarded', null);
    raise exception 'FAIL: other school decided';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  assert (select count(*) from school_scholarship_submissions) = 0, 'other school cannot select the table';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049c1', false);
do $$ begin
  assert (select count(*) from school_scholarship_submissions) = 0, 'counselor reads only through the logged function';
  assert (select first_name || ':' || (packet->>'full_name') from school_applications((select v::uuid from r where k='school'))) = 'Mia:Mia Smith', 'counselor sees the packet';
end $$;
select school_review_application((select v::uuid from r where k='sub'), 'reviewing', 'Interviews are next week.');

-- Once the school is reviewing, the family can't change or withdraw it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049b1', false);
do $$ begin
  assert (select school_note from school_scholarship_submissions) = 'Interviews are next week.', 'family sees the note';
  begin
    perform send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local'), '{"full_name":"Mia S"}');
    raise exception 'FAIL: changed after review started';
  exception when raise_exception then if sqlerrm not like 'The school is already reviewing%' then raise; end if; end;
  begin
    perform withdraw_school_application((select v::uuid from r where k='sub'));
    raise exception 'FAIL: withdrew after review started';
  exception when raise_exception then if sqlerrm not like 'The school is already reviewing%' then raise; end if; end;
end $$;

-- The decision flows into the family's tracker.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049c1', false);
select school_review_application((select v::uuid from r where k='sub'), 'awarded', 'Congratulations!');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049a1', false);
do $$ begin
  assert (select status from scholarship_applications where scholarship_id = (select v::uuid from r where k='local')) = 'won', 'tracker shows the win';
  assert (select status from school_scholarship_submissions) = 'awarded', 'parent sees the decision';
end $$;

reset role;
do $$ begin
  assert (select count(*) from audit_log where action = 'school_application_sent') = 1, 'send logged';
  assert (select count(*) from audit_log where action = 'school_application_resent') = 1, 'resend logged';
  assert (select count(*) from audit_log where action = 'view' and target = 'school_scholarship_submissions') >= 1, 'looks logged';
  assert (select count(*) from audit_log where action = 'school_application_awarded') = 1, 'decision logged';
end $$;

-- Withdraw works while new: Oli's family isn't involved, so set up a fresh one for Mia on a new award.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049c1', false);
insert into r values ('local3', school_post_scholarship((select v::uuid from r where k='school'), 'Kiwanis Award', 'https://example.org/kiwanis',
  'For a senior at Apply High who shows leadership.', '$750', 750, null, null, '{12}')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000049a1', false);
insert into r values ('sub3', send_school_application((select v::uuid from r where k='mia'), (select v::uuid from r where k='local3'), '{"full_name":"Mia Smith"}')::text);
select withdraw_school_application((select v::uuid from r where k='sub3'));
do $$ begin
  assert (select count(*) from school_scholarship_submissions where scholarship_id = (select v::uuid from r where k='local3')) = 0, 'withdrawn';
  assert (select status from scholarship_applications where scholarship_id = (select v::uuid from r where k='local3')) = 'getting_ready', 'back to getting ready';
end $$;
reset role;
\o
\echo SCHOLARSHIP APPLICATION CHECKS PASSED
