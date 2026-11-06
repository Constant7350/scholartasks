\set ON_ERROR_STOP on
\o /dev/null
-- Transcripts and letters tracker: families list what each college needs from the school;
-- a connected student can ask the counselor in the app; only that school's counselors see
-- it, every look is logged, and only the counselor's functions can set the school or its note.
-- People: parent p (60a1), student Ana (60b1), counselor c (60c1), other school's counselor x (60d1),
-- outsider parent o (60e1), team admin t (60f1).
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000060f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000060a1', 'p60@example.com'),
  ('00000000-0000-0000-0000-0000000060b1', 'ana60@example.com'),
  ('00000000-0000-0000-0000-0000000060c1', 'c60@school.example'),
  ('00000000-0000-0000-0000-0000000060d1', 'x60@school.example'),
  ('00000000-0000-0000-0000-0000000060e1', 'o60@example.com');

set role authenticated;
create temp table r (k text primary key, v text);
grant all on r to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060a1', false);
insert into r values ('fam', create_family('Transcript Test')::text);
insert into r values ('ana', add_student((select v::uuid from r where k='fam'), 'Ana', (current_date - interval '17 years')::date, 12, 'GA')::text);
insert into r values ('code', create_student_invite((select v::uuid from r where k='ana')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060b1', false);
select accept_student_invite((select v from r where k='code'));

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060e1', false);
insert into r values ('ofam', create_family('Other')::text);
insert into r values ('oli', add_student((select v::uuid from r where k='ofam'), 'Oli', (current_date - interval '17 years')::date, 12, 'GA')::text);
insert into student_colleges (student_id, name, deadline) values ((select v::uuid from r where k='oli'), 'Oli College', current_date + 40);
insert into r select 'olicol', id::text from student_colleges where name = 'Oli College';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060c1', false);
insert into r values ('school', create_school('Paper High', 'Athens', 'GA', null, null, 'Pat Lee', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060d1', false);
insert into r values ('school2', create_school('Other High', 'Athens', 'GA', null, null, 'Sam Roe', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060f1', false);
select review_school((select v::uuid from r where k='school'), 'approved');
select review_school((select v::uuid from r where k='school2'), 'approved');
insert into r select 'join', join_code from schools where id = (select v::uuid from r where k='school');

-- Ana lists what UGA needs: transcript (Common App), a teacher letter, test scores.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060b1', false);
insert into student_colleges (student_id, name, plan, deadline, approved) values ((select v::uuid from r where k='ana'), 'University of Georgia', 'EA', current_date + 30, false);
insert into r select 'uga', id::text from student_colleges where name = 'University of Georgia';
insert into transcript_requests (student_id, college_id, what) values ((select v::uuid from r where k='ana'), (select v::uuid from r where k='uga'), 'transcript');
insert into transcript_requests (student_id, college_id, what, person) values ((select v::uuid from r where k='ana'), (select v::uuid from r where k='uga'), 'teacher_letter', 'Ms. Diaz');
insert into transcript_requests (student_id, college_id, what, how) values ((select v::uuid from r where k='ana'), (select v::uuid from r where k='uga'), 'test_scores', 'testing_agency');
insert into r select 'tr', id::text from transcript_requests where what = 'transcript';
insert into r select 'tl', id::text from transcript_requests where what = 'teacher_letter';
insert into r select 'ts', id::text from transcript_requests where what = 'test_scores';
do $$ begin
  -- Ticking Asked fills the date.
  update transcript_requests set status = 'asked' where id = (select v::uuid from r where k='tl');
  assert (select asked_on from transcript_requests where id = (select v::uuid from r where k='tl')) = current_date, 'asked date filled';
  -- Can't point at another student's college.
  begin
    insert into transcript_requests (student_id, college_id, what) values ((select v::uuid from r where k='ana'), (select v::uuid from r where k='olicol'), 'transcript');
    raise exception 'FAIL: used another student''s college';
  exception when raise_exception then if sqlerrm not like 'Pick a college%' then raise; end if; end;
  -- Can't put it in a school's portal or write the school's note directly.
  begin
    update transcript_requests set school_id = (select v::uuid from r where k='school2') where id = (select v::uuid from r where k='tr');
    raise exception 'FAIL: family set school directly';
  exception when raise_exception then if sqlerrm not like 'Ask your counselor%' then raise; end if; end;
  begin
    update transcript_requests set school_note = 'Sent!' where id = (select v::uuid from r where k='tr');
    raise exception 'FAIL: family wrote school note';
  exception when raise_exception then if sqlerrm not like 'Ask your counselor%' then raise; end if; end;
  -- Asking the counselor needs a school connection first.
  begin
    perform ask_school_for_paper((select v::uuid from r where k='tr'));
    raise exception 'FAIL: asked before connecting';
  exception when raise_exception then if sqlerrm not like 'Connect to your school%' then raise; end if; end;
  -- Test scores come from the testing agency, not the school.
  begin
    perform ask_school_for_paper((select v::uuid from r where k='ts'));
    raise exception 'FAIL: asked school for test scores';
  exception when raise_exception then if sqlerrm not like 'Test scores%' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060a1', false);
do $$ begin assert (select count(*) from transcript_requests) = 3, 'parent sees all three'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060e1', false);
do $$ begin
  assert (select count(*) from transcript_requests) = 0, 'outsider sees nothing';
  begin
    insert into transcript_requests (student_id, college_id, what) values ((select v::uuid from r where k='ana'), (select v::uuid from r where k='uga'), 'transcript');
    raise exception 'FAIL: outsider wrote into another family';
  exception when insufficient_privilege then null;
            when raise_exception then if sqlerrm not like 'Pick a college%' then raise; end if; end;
end $$;

-- Ana connects to Paper High (parent approves), then asks the counselor in the app.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060b1', false);
select link_student_to_school((select v::uuid from r where k='ana'), (select v from r where k='join'), 'progress');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060a1', false);
select test_sign('school_link', (select v::uuid from r where k='ana'));
select approve_school_link((select id from my_school_links() limit 1));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060b1', false);
select ask_school_for_paper((select v::uuid from r where k='tr'));
select ask_school_for_paper((select v::uuid from r where k='tl'));
do $$ begin
  assert (select status from transcript_requests where id = (select v::uuid from r where k='tr')) = 'asked', 'asking marks asked';
  assert (select school_id from transcript_requests where id = (select v::uuid from r where k='tr')) = (select v::uuid from r where k='school'), 'in Paper High portal';
end $$;

-- Paper High's counselor sees both (logged); the other school's counselor sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060c1', false);
do $$ begin
  assert (select count(*) from school_transcript_requests((select v::uuid from r where k='school'))) = 2, 'counselor sees two';
  assert (select college from school_transcript_requests((select v::uuid from r where k='school')) limit 1) = 'University of Georgia', 'college name';
  assert (select count(*) from transcript_requests) = 0, 'counselor cannot read the table directly';
end $$;
select school_mark_paper((select v::uuid from r where k='tr'), 'sent', 'Sent through Common App.');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060d1', false);
do $$ begin
  begin
    perform school_transcript_requests((select v::uuid from r where k='school'));
    raise exception 'FAIL: other school read requests';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    perform school_mark_paper((select v::uuid from r where k='tl'), 'sent', null);
    raise exception 'FAIL: other school marked sent';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- The family sees it sent with the note; it can't be taken back now; the letter can.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000060a1', false);
do $$ begin
  assert (select status from transcript_requests where id = (select v::uuid from r where k='tr')) = 'sent', 'family sees sent';
  assert (select school_note from transcript_requests where id = (select v::uuid from r where k='tr')) = 'Sent through Common App.', 'family sees note';
  assert (select sent_on from transcript_requests where id = (select v::uuid from r where k='tr')) = current_date, 'sent date';
  begin
    perform cancel_school_paper((select v::uuid from r where k='tr'));
    raise exception 'FAIL: cancelled after sent';
  exception when raise_exception then if sqlerrm not like 'The school already%' then raise; end if; end;
end $$;
select cancel_school_paper((select v::uuid from r where k='tl'));
-- Family can still tick Received themselves.
update transcript_requests set status = 'received' where id = (select v::uuid from r where k='tr');
reset role;
do $$ begin
  assert (select school_id from transcript_requests where id = (select v::uuid from r where k='tl')) is null, 'cancelled leaves portal';
  assert (select count(*) from audit_log where action = 'transcript_request_sent_to_school') = 2, 'asks logged';
  assert (select count(*) from audit_log where action = 'view' and target = 'transcript_requests') >= 1, 'counselor look logged';
  assert (select count(*) from audit_log where action = 'transcript_request_sent') = 1, 'sent logged';
end $$;
\o
\echo TRANSCRIPT REQUEST CHECKS PASSED
