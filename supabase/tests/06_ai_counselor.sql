\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Okafors')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Ada', '2009-01-01', 12, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));

-- Parent: allowed until the daily limit.
do $$ begin
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'parent turn 1';
  assert ai_take_turn((select v::uuid from g where k='student'), 2), 'parent turn 2';
  assert not ai_take_turn((select v::uuid from g where k='student'), 2), 'parent over limit';
  assert (select messages from ai_usage) = 2, 'over-limit try not counted';
end $$;

-- Student with AI chat on (the default) can chat; with it off, cannot.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  assert ai_take_turn((select v::uuid from g where k='student'), 5), 'student turn';
  assert (select count(*) from ai_usage) = 1, 'student sees only own usage';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_student_permission((select v::uuid from g where k='student'), 'ai_chat', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', false);
do $$ begin
  begin
    perform ai_take_turn((select v::uuid from g where k='student'), 5);
    raise exception 'FAIL: student chatted with AI chat off';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- A stranger can't, and can't write usage rows directly.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', false);
do $$ begin
  begin
    perform ai_take_turn((select v::uuid from g where k='student'), 5);
    raise exception 'FAIL: stranger chatted';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  begin
    insert into ai_usage values (auth.uid(), current_date, -100);
    raise exception 'FAIL: direct usage write';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\o
\echo AI COUNSELOR CHECKS PASSED
