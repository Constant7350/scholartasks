\set ON_ERROR_STOP on
\o /dev/null
-- These people have said yes to AI help (0023).
insert into user_settings (user_id, ai_consent_at) values ('00000000-0000-0000-0000-0000000000c0', now()),('00000000-0000-0000-0000-0000000000c1', now()),('00000000-0000-0000-0000-0000000000c9', now()) on conflict (user_id) do update set ai_consent_at = excluded.ai_consent_at;
-- Staff member c0 reviews the bank.
insert into app_admins values ('00000000-0000-0000-0000-0000000000c0');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Rivers')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Sam', '2009-01-01', 12, 'GA')::text);

do $$ declare s uuid := (select v::uuid from g where k='student'); begin
  -- Must have used the counselor today before suggesting.
  begin
    perform answer_bank_submit(s, 'How do the FAFSA and the GSFAPP differ?', 'The FAFSA is the federal form; the GSFAPP is Georgia''s own form for state aid.');
    raise exception 'FAIL: submit without counselor use';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  perform ai_take_turn(s, 10);
  perform answer_bank_submit(s, 'How do the FAFSA and the GSFAPP differ?', 'The FAFSA is the federal form; the GSFAPP is Georgia''s own form for state aid.');
  perform answer_bank_submit(s, 'How do the FAFSA and GSFAPP differ?', 'Duplicate that should be skipped because it is so close.');
  -- Families can't read the bank directly, and pending answers aren't served.
  assert (select count(*) from answer_bank) = 0, 'family cannot read bank';
  assert (select count(*) from answer_bank_lookup(s, 'How do the FAFSA and the GSFAPP differ?')) = 0, 'pending not served';
  begin
    insert into answer_bank (state, question, answer) values ('GA', 'Injected question?', 'Injected answer that should never be allowed in.');
    raise exception 'FAIL: family inserted into bank';
  exception when insufficient_privilege then null; end;
end $$;

-- Staff sees one pending answer (duplicate skipped) and approves it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c0', false);
do $$ begin
  assert is_app_admin(), 'admin recognized';
  assert (select count(*) from answer_bank where status = 'pending') = 1, 'one pending, duplicate skipped';
  update answer_bank set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now();
end $$;

-- Now a similar question gets the saved answer and the hit is counted.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ declare s uuid := (select v::uuid from g where k='student'); n int; begin
  assert (select count(*) from answer_bank_lookup(s, 'how do the FAFSA and the GSFAPP differ')) = 1, 'approved answer served';
  assert (select count(*) from answer_bank_lookup(s, 'What colleges should I apply to?')) = 0, 'unrelated question not matched';
  assert not is_app_admin(), 'parent is not admin';
end $$;

-- A stranger can't use the lookup.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c9', false);
do $$ begin
  begin
    perform answer_bank_lookup((select v::uuid from g where k='student'), 'How do the FAFSA and the GSFAPP differ?');
    raise exception 'FAIL: stranger used lookup';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin assert (select hits from answer_bank) = 1, 'hit counted once'; end $$;
\o
\echo ANSWER BANK CHECKS PASSED
