\set ON_ERROR_STOP on
\o /dev/null
-- Company questions on our form, and "I applied on their site" with a parent's consent.
-- People: parent p (53a1), student Ava (53b1), company boss e (53c1). Admin from test 52 is 52f1.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000053a1', 'p53@example.com'),
  ('00000000-0000-0000-0000-0000000053b1', 'ava53@example.com'),
  ('00000000-0000-0000-0000-0000000053c1', 'boss53@shop.example');

set role authenticated;
create temp table r53 (k text primary key, v text);
grant all on r53 to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053a1', false);
insert into r53 values ('fam', create_family('Questions Test')::text);
insert into r53 values ('ava', add_student((select v::uuid from r53 where k='fam'), 'Ava', (current_date - interval '17 years')::date, 12, 'GA')::text);
insert into r53 values ('code', create_student_invite((select v::uuid from r53 where k='ava')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053b1', false);
select accept_student_invite((select v from r53 where k='code'));

-- The company adds questions: blanks dropped, at most 3 kept, in order.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053c1', false);
select employer_sign_up(jsonb_build_object('company_name', 'Peach Movies', 'contact_name', 'Kim', 'city', 'Macon', 'state', 'GA', 'agree', true));
insert into r53 values ('job', employer_post_opening(jsonb_build_object('kind', 'holiday', 'title', 'Holiday ticket helper', 'city', 'Macon', 'state', 'GA',
  'min_age', 16, 'description', 'Scan tickets and help families find their seats over winter break.',
  'extra_questions', jsonb_build_array('Can you work Dec 26?', ' ', 'Have you worked with customers?', 'Do you have a ride?', 'A fourth one')))::text);
do $$ begin
  assert (select extra_questions from local_openings where id = (select v::uuid from r53 where k='job'))
    = '["Can you work Dec 26?", "Have you worked with customers?", "Do you have a ride?"]'::jsonb, 'questions cleaned and capped';
end $$;
reset role;
update local_openings set status = 'approved', approved_at = now() where id = (select v::uuid from r53 where k='job');
-- An older-style listing that sends students to the company's site.
insert into local_openings (id, kind, title, company_name, contact_name, contact_email, city, state, min_age, description, how_to_apply, apply_url, show_until, status, approved_at)
values ('00000000-0000-0000-0000-0000000053d1', 'apprenticeship', 'HVAC apprentice', 'Cool Air', 'Sam', 'sam@cool.example', 'Macon', 'GA', 16,
        'Learn heating and air conditioning on the job, paid from day one.', 'Apply on our website.', 'https://cool.example/jobs', current_date + 30, 'approved', now());
set role authenticated;

-- The student must answer every question.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053b1', false);
do $$ begin
  assert (select jsonb_array_length(extra_questions) from public_openings where id = (select v::uuid from r53 where k='job')) = 3, 'questions are public';
  begin
    perform apply_for_job((select v::uuid from r53 where k='job'), (select v::uuid from r53 where k='ava'), 'I love movies and people.', null, 'ava53@example.com', null, false,
      jsonb_build_array('Yes', ''));
    raise exception 'FAIL: missing answer accepted';
  exception when raise_exception then
    if sqlerrm not like 'Please answer%' then raise; end if;
  end;
  assert apply_for_job((select v::uuid from r53 where k='job'), (select v::uuid from r53 where k='ava'), 'I love movies and people.', null, 'ava53@example.com', null, false,
      jsonb_build_array('Yes', 'At a summer camp', 'My mom drives me')) = 'needs_parent', 'waits for parent';
  -- Logging an outside application only works on listings that aren't in-app.
  begin
    perform log_outside_application((select v::uuid from r53 where k='job'), (select v::uuid from r53 where k='ava'), null);
    raise exception 'FAIL: outside log on an in-app job';
  exception when raise_exception then
    if sqlerrm not like 'This job isn%' then raise; end if;
  end;
  assert log_outside_application('00000000-0000-0000-0000-0000000053d1', (select v::uuid from r53 where k='ava'), 'Applied online on Monday.') = 'needs_parent',
    'outside application waits for parent';
end $$;

-- The parent agrees to both; the outside one is logged with its own wording.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053a1', false);
select decide_job_application(id, true, true) from job_applications where student_id = (select v::uuid from r53 where k='ava');
do $$ begin
  assert (select consent_version from job_applications where opening_id = '00000000-0000-0000-0000-0000000053d1') = 'job-outside-consent-v1', 'outside version saved';
  assert (select count(*) from audit_log where action = 'consent' and details->>'version' = 'job-outside-consent-v1') = 1, 'outside consent logged';
  assert (select count(*) from my_job_applications() where applied_outside) = 1, 'family sees the outside one';
end $$;
select family_update_job_application((select id from job_applications where opening_id = '00000000-0000-0000-0000-0000000053d1'), 'hired');

-- The company sees the answers to its questions, and never the outside application.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053c1', false);
do $$ begin
  assert (select count(*) from employer_applications()) = 1, 'company sees only its in-app application';
  assert (select answers->>2 from employer_applications()) = 'My mom drives me', 'company sees the answers';
end $$;

-- A parent applying for an outside job agrees in the same step.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000053a1', false);
do $$ begin
  begin
    perform log_outside_application('00000000-0000-0000-0000-0000000053d1', (select v::uuid from r53 where k='ava'), null);
    raise exception 'FAIL: parent logged without agreeing';
  exception when raise_exception then
    if sqlerrm not like 'Please read the consent%' then raise; end if;
  end;
end $$;
reset role;
\o
\echo JOB QUESTIONS AND OUTSIDE APPLICATIONS CHECKS PASSED
