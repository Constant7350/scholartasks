\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000043a1', false);
create temp table h43 (k text primary key, v text);
insert into h43 values ('fam', create_family('Young Ones')::text);

do $$ declare fam uuid := (select v::uuid from h43 where k='fam'); s uuid; begin
  -- An 11-year-old 6th grader can be added by a parent.
  s := add_student(fam, 'Lily', (current_date - interval '11 years')::date, 6, 'GA');
  insert into h43 values ('lily', s::text);
  assert is_under_13(s), 'Lily is under 13';
  -- ...but gets no join code and no AI.
  begin
    perform create_student_invite(s);
    raise exception 'FAIL: invite for under 13';
  exception when raise_exception then if sqlerrm not like 'under 13%' then raise; end if; end;
  -- Under 10, or under 13 in high school, is still refused.
  begin
    perform add_student(fam, 'Tiny', (current_date - interval '9 years')::date, 6, 'GA');
    raise exception 'FAIL: 9-year-old accepted';
  exception when raise_exception then if sqlerrm not like 'students must be at least 13%' then raise; end if; end;
  begin
    perform add_student(fam, 'Early', (current_date - interval '12 years')::date, 9, 'GA');
    raise exception 'FAIL: 12-year-old in grade 9 accepted';
  exception when raise_exception then if sqlerrm not like 'students must be at least 13%' then raise; end if; end;
  -- A 13-year-old can still get a join code.
  s := add_student(fam, 'Max', (current_date - interval '13 years 1 day')::date, 8, 'GA');
  assert length(create_student_invite(s)) = 8, '13-year-old gets a code';
end $$;

insert into user_settings (ai_consent_at) values (now());
do $$ begin
  begin
    perform ai_take_turn((select v::uuid from h43 where k='lily'), 10);
    raise exception 'FAIL: AI turn for under 13';
  exception when raise_exception then if sqlerrm <> 'not allowed: under 13' then raise; end if; end;
end $$;
reset role;
\o
\echo YOUNGER STUDENT CHECKS PASSED
