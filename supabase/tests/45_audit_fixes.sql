\set ON_ERROR_STOP on
\o /dev/null
-- 0045: Homework Helper add-on refuses under-13 students; email opt-outs skip roster invites.
-- Lily (11) was added in 43_younger_students.sql by user ...43a1, who allowed AI help there.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000043a1', false);
do $$ declare s uuid := (select id from students where first_name = 'Lily' and is_under_13(id) limit 1); begin
  assert s is not null, 'Lily exists';
  begin
    perform homework_take_turn(s, true, 40, 500);
    raise exception 'FAIL: add-on homework turn for under 13';
  exception when raise_exception then if sqlerrm <> 'not allowed: under 13' then raise; end if; end;
  begin
    perform homework_take_turn(s, false, 40, 500);
    raise exception 'FAIL: homework turn for under 13';
  exception when raise_exception then if sqlerrm <> 'not allowed: under 13' then raise; end if; end;
end $$;
-- Families can't read or write the opt-out list directly.
do $$ begin
  begin
    perform 1 from email_opt_outs;
    raise exception 'FAIL: opt-outs readable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- An opted-out address is skipped by school invites.
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000045f1');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000045a1', 'lead@optout.example');
set role authenticated;
create temp table h45 (k text primary key, v text);
grant all on h45 to authenticated, service_role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000045a1', false);
insert into h45 values ('school', create_school('Opt Out High', 'Macon', 'GA', null, null, 'Lee Fox', 'Counselor')::text);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000045f1', false);
select review_school((select v::uuid from h45 where k='school'), 'approved');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000045a1', false);
select test_sign('school_agreement', null, (select v from h45 where k='school'));
select sign_school_data_agreement((select v::uuid from h45 where k='school'), 'Lee Fox', 'Counselor', 'Bibb County');
select upload_school_roster((select v::uuid from h45 where k='school'),
  '[{"student_ref":"1","first_name":"Zoe","last_name":"Lane","grade_level":11,"email":"zoe.family@example.com"},
    {"student_ref":"2","first_name":"Sam","last_name":"Ito","grade_level":11,"email":"stop.me@example.com"}]'::jsonb);
reset role;
-- (The opt-out route writes with the service key, which skips row security in Supabase.)
insert into email_opt_outs (email) values ('stop.me@example.com');
set role service_role;
do $$ declare s uuid := (select v::uuid from h45 where k='school'); begin
  assert (select array_agg(email) from school_roster_invitees(s, '00000000-0000-0000-0000-0000000045a1', '{}')) = array['zoe.family@example.com'], 'opted-out address skipped';
end $$;
reset role;
\o
\echo AUDIT FIX CHECKS PASSED
