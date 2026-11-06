\set ON_ERROR_STOP on
\o /dev/null
-- Signed consent: only the server saves signatures, students can't sign for a parent,
-- each signature works once, and every step lands in the audit log.
-- People: parent (55a1), student Zoe 16 (55b1), team (55f1), stranger (55c1).
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000055f1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000055a1', 'mom55@example.com'),
  ('00000000-0000-0000-0000-0000000055b1', 'zoe55@example.com'),
  ('00000000-0000-0000-0000-0000000055c1', 'other55@example.com');
create temp table r55 (k text primary key, v text);
grant all on r55 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055a1', false);
insert into r55 values ('fam', create_family('Sign Test')::text);
insert into r55 values ('zoe', add_student((select v::uuid from r55 where k='fam'), 'Zoe', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r55 values ('code', create_student_invite((select v::uuid from r55 where k='zoe')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055b1', false);
select accept_student_invite((select v from r55 where k='code'));

-- Nobody signed in can save a signature directly.
do $$ begin
  begin
    perform record_consent_signature('00000000-0000-0000-0000-0000000055a1', 'job_application', null, (select v::uuid from r55 where k='zoe'),
      'Mom Test', 'data:image/png;base64,' || repeat('A', 300), 'v1', 'I agree to this test wording', 'email_code', null, null);
    raise exception 'FAIL: user saved a signature without the server';
  exception when insufficient_privilege then null; end;
  begin
    insert into consent_signatures (user_id, kind, signed_name, signature, wording, verified_by)
    values (auth.uid(), 'job_application', 'Fake Mom', 'data:image/png;base64,' || repeat('A', 300), 'fake wording here', 'email_code');
    raise exception 'FAIL: student inserted a signature';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The server (service role) checks who is signing.
set role service_role;
do $$
declare zoe uuid := (select v::uuid from r55 where k='zoe'); sig text := 'data:image/png;base64,' || repeat('A', 300);
begin
  begin
    perform record_consent_signature('00000000-0000-0000-0000-0000000055b1', 'job_application', null, zoe, 'Mom Test', sig, 'v1', 'I agree to this test wording', 'email_code', '1.2.3.4', 'test');
    raise exception 'FAIL: the student signed as a parent';
  exception when raise_exception then
    if sqlerrm not like 'Only a parent or guardian can sign%' then raise; end if;
  end;
  begin
    perform record_consent_signature('00000000-0000-0000-0000-0000000055c1', 'job_application', null, zoe, 'Stranger', sig, 'v1', 'I agree to this test wording', 'email_code', null, null);
    raise exception 'FAIL: a stranger signed';
  exception when raise_exception then
    if sqlerrm not like 'Only this student''s parent%' then raise; end if;
  end;
  begin
    perform record_consent_signature('00000000-0000-0000-0000-0000000055a1', 'job_application', null, zoe, 'Mom Test', sig, 'v1', 'I agree to this test wording', 'none', null, null);
    raise exception 'FAIL: signed without the identity check';
  exception when raise_exception then
    if sqlerrm not like 'Please confirm it''s you%' then raise; end if;
  end;
  begin
    perform record_consent_signature('00000000-0000-0000-0000-0000000055a1', 'job_application', null, zoe, 'Mom Test', 'data:image/png;base64,x', 'v1', 'I agree to this test wording', 'passkey', null, null);
    raise exception 'FAIL: empty signature';
  exception when raise_exception then
    if sqlerrm not like 'Sign in the box%' then raise; end if;
  end;
  perform record_consent_signature('00000000-0000-0000-0000-0000000055a1', 'school_link', null, zoe, 'Mom Test', sig, 'v1', 'I agree to share with the school', 'passkey', '1.2.3.4', 'test');
end $$;
reset role;

-- The signature lets the parent connect Zoe to a school once; the audit log has it.
insert into schools (id, name, city, state, status, join_code, staff_code, created_by) values ('00000000-0000-0000-0000-0000000055e1', 'Sign High', 'Athens', 'GA', 'approved', 'SIGN55AB', 'SIGN55ST', '00000000-0000-0000-0000-0000000055f1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055a1', false);
select link_student_to_school((select v::uuid from r55 where k='zoe'), 'SIGN55AB', 'progress');
do $$ begin
  assert (select count(*) from consent_signatures where used_at is not null) = 1, 'signature used';
  assert (select signed_name from consent_signatures where kind = 'school_link') = 'Mom Test', 'parent sees own signature';
end $$;
select end_school_link((select id from school_links where student_id = (select v::uuid from r55 where k='zoe')));
do $$ begin
  begin
    perform link_student_to_school((select v::uuid from r55 where k='zoe'), 'SIGN55AB', 'progress');
    raise exception 'FAIL: signature used twice';
  exception when raise_exception then
    if sqlerrm not like 'Please confirm it''s you and sign first%' then raise; end if;
  end;
  begin
    perform * from consent_audit_trail();
    raise exception 'FAIL: parent read the team audit trail';
  exception when raise_exception then
    if sqlerrm not like 'This is for the ScholarTasks team%' then raise; end if;
  end;
end $$;

-- Video permission: the team makes a link; the parent signs through the server; then takes it back.
reset role;
insert into social_people (id, name, sign_token) values ('00000000-0000-0000-0000-0000000055d1', 'Zoe', '00000000-0000-0000-0000-0000000055d2');
set role service_role;
select record_consent_signature('00000000-0000-0000-0000-0000000055a1', 'video', '00000000-0000-0000-0000-0000000055d2', null, 'Mom Test',
  'data:image/png;base64,' || repeat('A', 300), 'video-v1', 'I agree my student may appear in videos', 'email_code', null, null);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055a1', false);
do $$ begin
  assert (video_consent_get('00000000-0000-0000-0000-0000000055d2') ->> 'signed')::boolean, 'video signed';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055c1', false);
do $$ begin
  begin
    perform video_consent_withdraw('00000000-0000-0000-0000-0000000055d2');
    raise exception 'FAIL: stranger withdrew';
  exception when raise_exception then
    if sqlerrm not like 'Only the parent who signed%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055a1', false);
select video_consent_withdraw('00000000-0000-0000-0000-0000000055d2');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000055f1', false);
do $$ begin
  assert (select consent_on from social_people where id = '00000000-0000-0000-0000-0000000055d1') is null, 'permission taken back';
  assert (select count(*) from consent_audit_trail() where action in ('consent_signed', 'consent_used', 'consent_withdrawn')) >= 4, 'audit trail';
end $$;
reset role;
\o
\echo SIGNED CONSENT CHECKS PASSED
