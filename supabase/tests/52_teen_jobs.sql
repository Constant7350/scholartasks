\set ON_ERROR_STOP on
\o /dev/null
-- Weekend and holiday jobs: company accounts, apply in the app, a parent's "I agree" always
-- comes first and is logged in the tamper-evident audit log, companies see only what was sent.
-- People: parent p (52a1), student Ben (52b1), company boss e (52c1), other company x (52d1),
-- outsider parent o (52e1), team admin t (52f1).
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000052f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000052a1', 'p52@example.com'),
  ('00000000-0000-0000-0000-0000000052b1', 'ben52@example.com'),
  ('00000000-0000-0000-0000-0000000052c1', 'boss52@shop.example'),
  ('00000000-0000-0000-0000-0000000052d1', 'x52@shop.example'),
  ('00000000-0000-0000-0000-0000000052e1', 'o52@example.com');

set role authenticated;
create temp table r52 (k text primary key, v text);
grant all on r52 to authenticated, service_role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052a1', false);
insert into r52 values ('fam', create_family('Jobs Test')::text);
insert into r52 values ('ben', add_student((select v::uuid from r52 where k='fam'), 'Ben', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r52 values ('kid', add_student((select v::uuid from r52 where k='fam'), 'Kid', (current_date - interval '14 years')::date, 9, 'GA')::text);
insert into r52 values ('code', create_student_invite((select v::uuid from r52 where k='ben')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052b1', false);
select accept_student_invite((select v from r52 where k='code'));

-- A student account can't be a company account.
do $$ begin
  begin
    perform employer_sign_up(jsonb_build_object('company_name', 'Ben Co', 'contact_name', 'Ben', 'city', 'Macon', 'state', 'GA', 'agree', true));
    raise exception 'FAIL: student made a company account';
  exception when raise_exception then
    if sqlerrm not like 'Student accounts%' then raise; end if;
  end;
end $$;

-- The company signs up (must agree), posts a weekend job; it waits for our team.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052c1', false);
do $$ begin
  begin
    perform employer_sign_up(jsonb_build_object('company_name', 'Macon Garden Center', 'contact_name', 'Lee', 'city', 'Macon', 'state', 'GA'));
    raise exception 'FAIL: signed up without agreeing';
  exception when raise_exception then
    if sqlerrm not like 'Please agree%' then raise; end if;
  end;
end $$;
select employer_sign_up(jsonb_build_object('company_name', 'Macon Garden Center', 'website', 'https://garden.example', 'contact_name', 'Lee',
  'city', 'Macon', 'state', 'ga', 'agree', true));
insert into r52 values ('job', employer_post_opening(jsonb_build_object('kind', 'weekend', 'title', 'Saturday plant helper', 'city', 'Macon', 'state', 'GA',
  'min_age', 16, 'pay', '$10 an hour', 'schedule', 'Saturdays 8am to 1pm', 'description', 'Water plants, help customers carry bags, keep the shop tidy.',
  'show_until', (current_date + 400)::text, 'apply_in_app', true))::text);
do $$ begin
  assert (select count(*) from public_openings where id = (select v::uuid from r52 where k='job')) = 0, 'company listing waits for review';
  assert (select count(*) from local_openings) = 1, 'company sees its own listing';
  assert (select show_until from local_openings) = current_date + 180, 'capped at 180 days';
  assert (select contact_email from local_openings) = 'boss52@shop.example', 'contact comes from the account';
end $$;

-- Our team approves; nobody can apply to a listing that isn't approved.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052f1', false);
update employers set status = 'approved';
update local_openings set status = 'approved', approved_at = now() where employer_id is not null;
do $$ begin
  assert (select apply_in_app and kind = 'weekend' from public_openings where id = (select v::uuid from r52 where k='job')), 'shows with apply in app';
end $$;

-- The 14-year-old is too young; the student applies and it waits for a parent.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052a1', false);
do $$ begin
  begin
    perform apply_for_job((select v::uuid from r52 where k='job'), (select v::uuid from r52 where k='kid'), 'I would love to help out.', null, 'kid@example.com', null, true);
    raise exception 'FAIL: too young accepted';
  exception when raise_exception then
    if sqlerrm not like 'too young%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052b1', false);
do $$ begin
  assert apply_for_job((select v::uuid from r52 where k='job'), (select v::uuid from r52 where k='ben'),
    'I like plants and I am free every Saturday.', 'Saturdays', 'ben52@example.com', null) = 'needs_parent', 'student application waits for a parent';
  begin
    perform apply_for_job((select v::uuid from r52 where k='job'), (select v::uuid from r52 where k='ben'), 'short', null, 'b@x.com', null);
    raise exception 'FAIL: short message accepted';
  exception when raise_exception then
    if sqlerrm not like 'Please write%' then raise; end if;
  end;
end $$;
insert into r52 select 'app', id::text from job_applications;

-- The company sees nothing before the parent agrees.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052c1', false);
do $$ begin
  assert (select count(*) from employer_applications()) = 0, 'company sees nothing before consent';
  assert (select count(*) from job_applications) = 0, 'company cannot read the applications table';
  begin
    perform employer_update_application((select v::uuid from r52 where k='app'), 'hired', null);
    raise exception 'FAIL: company changed an unsent application';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;

-- The student can't approve their own; an outsider parent can't either; the parent must tick I agree.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052b1', false);
do $$ begin
  begin
    perform decide_job_application((select v::uuid from r52 where k='app'), true, true);
    raise exception 'FAIL: student approved own application';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052e1', false);
do $$ begin
  begin
    perform decide_job_application((select v::uuid from r52 where k='app'), true, true);
    raise exception 'FAIL: outsider approved';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052a1', false);
do $$ begin
  begin
    perform decide_job_application((select v::uuid from r52 where k='app'), true, false);
    raise exception 'FAIL: approved without ticking I agree';
  exception when raise_exception then
    if sqlerrm not like 'Please read the consent%' then raise; end if;
  end;
end $$;
select decide_job_application((select v::uuid from r52 where k='app'), true, true);
do $$ begin
  assert (select status || '|' || parent_email || '|' || consent_version from job_applications) = 'sent|p52@example.com|job-consent-v1', 'sent with parent email and consent version';
  assert (select count(*) from job_application_consents((select v::uuid from r52 where k='app')) where agreed and wording like 'I am this student%') = 1,
    'consent is in the audit log with the exact wording';
end $$;
reset role;
do $$ begin
  assert (select count(*) from verify_audit_chain() where broken_at > (select min(id) from audit_log where target = 'job_application')) = 0, 'audit chain intact';
end $$;
set role authenticated;

-- Now the company sees only what the application holds.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052c1', false);
do $$ begin
  assert (select first_name || '|' || age || '|' || share_email || '|' || parent_email from employer_applications())
    = 'Ben|16|ben52@example.com|p52@example.com', 'company sees the sent application';
end $$;
-- A reference letter only after Hired.
do $$ begin
  begin
    perform employer_write_reference((select v::uuid from r52 where k='app'), 'Lee Park', 'Owner', null, null, repeat('Ben is a hard worker. ', 5));
    raise exception 'FAIL: letter before hired';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;
select employer_update_application((select v::uuid from r52 where k='app'), 'hired', 'Start Saturday at 8.');
insert into r52 values ('ref', employer_write_reference((select v::uuid from r52 where k='app'), 'Lee Park', 'Owner', current_date - 60, current_date,
  'Ben showed up on time every Saturday, worked hard and was kind to every customer.')::text);

-- Another company sees nothing and can't close the listing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052d1', false);
select employer_sign_up(jsonb_build_object('company_name', 'Other Shop', 'contact_name', 'X', 'city', 'Macon', 'state', 'GA', 'agree', true));
do $$ begin
  assert (select count(*) from employer_applications()) = 0, 'other company sees nothing';
  assert (select count(*) from local_openings) = 0, 'other company cannot see the listing row';
  assert (select count(*) from job_references) = 0, 'other company cannot see the letter';
  assert (select count(*) from my_job_applications()) = 0, 'company has no family list';
  begin
    perform employer_write_reference((select v::uuid from r52 where k='app'), 'X', null, null, null, repeat('Fake letter text. ', 5));
    raise exception 'FAIL: other company wrote a letter';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
  begin
    perform employer_close_opening((select v::uuid from r52 where k='job'));
    raise exception 'FAIL: other company closed the listing';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;

-- The family sees the status; a parent applying for the student agrees in the same step.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052b1', false);
do $$ begin
  assert (select status || '|' || employer_note from job_applications) = 'hired|Start Saturday at 8.', 'student sees hired';
  assert (select family_status || '|' || company_name from job_references) = 'new|Macon Garden Center', 'student sees the letter';
  begin
    perform family_set_reference((select v::uuid from r52 where k='ref'), true);
    raise exception 'FAIL: student decided on the letter';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052a1', false);
select family_set_reference((select v::uuid from r52 where k='ref'), true);
do $$ begin
  assert (select family_status from job_references) = 'kept', 'family keeps the letter';
  assert (select title || '|' || company_name || '|' || first_name from my_job_applications() limit 1) = 'Saturday plant helper|Macon Garden Center|Ben', 'family list has the job';
  begin
    update job_references set letter = 'changed by the family, which is not allowed at all here';
    raise exception 'FAIL: family edited the letter';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052c1', false);
insert into r52 values ('job2', employer_post_opening(jsonb_build_object('kind', 'holiday', 'title', 'Winter break gift wrapper', 'city', 'Macon', 'state', 'GA',
  'min_age', 16, 'description', 'Wrap gifts for customers during the winter break rush.'))::text);
reset role;
update local_openings set status = 'approved', approved_at = now() where employer_id is not null;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000052a1', false);
do $$ begin
  begin
    perform apply_for_job((select v::uuid from r52 where k='job2'), (select v::uuid from r52 where k='ben'), 'Ben is great with people.', null, null, '478-555-0101');
    raise exception 'FAIL: parent applied without agreeing';
  exception when raise_exception then
    if sqlerrm not like 'Please read the consent%' then raise; end if;
  end;
  assert apply_for_job((select v::uuid from r52 where k='job2'), (select v::uuid from r52 where k='ben'), 'Ben is great with people.', null, null, '478-555-0101', true) = 'sent',
    'parent applies and agrees in one step';
  assert (select count(*) from audit_log where action = 'consent' and target = 'job_application') = 2, 'both consents logged';
end $$;

-- Nobody writes to the applications table directly.
do $$ begin
  begin
    update job_applications set status = 'sent';
    raise exception 'FAIL: direct update';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\o
\echo TEEN JOBS CHECKS PASSED
