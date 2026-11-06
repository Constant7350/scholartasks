\set ON_ERROR_STOP on
\o /dev/null
-- Gift card prizes: only the winner's parent picks the code up, after a fresh signed receipt;
-- the student and strangers can't; the code never shows in "my prize".
-- Reuses the people and the winning entry from 57_essay_challenge.sql.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000058e1', 'other58@example.com');
create temp table r57 (k text primary key, v text);
grant all on r57 to public;
insert into r57 select 'zoe', s.id::text from students s join families f on f.id = s.family_id where f.name = 'Challenge Test';
insert into r57 select 'entry', e.id::text from challenge_entries e where e.student_id = (select v::uuid from r57 where k='zoe');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057c1', false);
update challenge_payouts set gift_brand = 'Amazon', gift_code = 'GIFT-1234-ABCD', status = 'to_pay', paid_on = null
 where entry_id = (select v::uuid from r57 where k='entry');

-- The student can't pick it up; "my prize" says ready but has no code.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057b1', false);
do $$
declare eid uuid := (select v::uuid from r57 where k='entry'); mp jsonb;
begin
  mp := challenge_my_prize(eid);
  if not (mp->>'ready')::boolean or mp ? 'code' or mp::text like '%GIFT-1234%' then raise exception 'FAIL: my prize %', mp; end if;
  begin
    perform challenge_pickup_prize(eid);
    raise exception 'FAIL: student picked up';
  exception when raise_exception then if sqlerrm not like 'Only the winner%' then raise; end if; end;
end $$;

-- A stranger can't either.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000058e1', false);
do $$ begin
  perform challenge_pickup_prize((select v::uuid from r57 where k='entry'));
  raise exception 'FAIL: stranger picked up';
exception when raise_exception then if sqlerrm not like 'Only the winner%' then raise; end if; end $$;

-- The parent needs a fresh receipt signature, then gets the code; it's marked paid.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057a1', false);
do $$
declare eid uuid := (select v::uuid from r57 where k='entry'); zoe uuid := (select v::uuid from r57 where k='zoe'); g jsonb;
begin
  begin
    perform challenge_pickup_prize(eid);
    raise exception 'FAIL: picked up without signing';
  exception when raise_exception then if sqlerrm not like 'Please confirm%' then raise; end if; end;
  perform test_sign('prize', zoe, eid::text);
  g := challenge_pickup_prize(eid);
  if g->>'code' <> 'GIFT-1234-ABCD' then raise exception 'FAIL: code %', g; end if;
  -- Opening it again works without signing again.
  g := challenge_pickup_prize(eid);
  if g->>'code' <> 'GIFT-1234-ABCD' then raise exception 'FAIL: reopen'; end if;
  if (challenge_my_prize(eid)->>'status') <> 'paid' or challenge_my_prize(eid)->>'picked_up_at' is null then raise exception 'FAIL: not marked paid'; end if;
  if not exists (select 1 from audit_log where action = 'prize_picked_up' and actor_id = auth.uid()) then raise exception 'FAIL: no audit'; end if;
end $$;

-- The team can't wipe the pick-up record or swap the code afterwards.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000057c1', false);
update challenge_payouts set picked_up_at = null, gift_code = 'SWAPPED' where entry_id = (select v::uuid from r57 where k='entry');
do $$ begin
  if (select picked_up_at from challenge_payouts) is null or (select gift_code from challenge_payouts) <> 'GIFT-1234-ABCD' then raise exception 'FAIL: pick-up record changed'; end if;
end $$;
reset role;
\o
\echo 58 gift card prizes OK
