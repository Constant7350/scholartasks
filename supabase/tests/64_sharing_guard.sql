\set ON_ERROR_STOP on
\o /dev/null
-- Sharing guard: 6 students per account (the team can raise it), sign-in records hidden from
-- families, the team-only flag list, and the 90-day clean-up.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000064a1', 'parent64@example.com'),
  ('00000000-0000-0000-0000-0000000064b1', 'kid64@example.com'),
  ('00000000-0000-0000-0000-0000000064c1', 'team64@example.com');
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000064c1');
create temp table r64 (k text primary key, v text);
grant all on r64 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000064a1', false);
insert into r64 values ('fam', create_family('Sharing Test')::text);
insert into r64 select 'kid' || i, add_student((select v::uuid from r64 where k='fam'), 'Kid' || i, (current_date - interval '15 years')::date, 10, 'GA')::text
  from generate_series(1, 6) i;

do $$
begin
  -- The 7th student is refused.
  begin
    perform add_student((select v::uuid from r64 where k='fam'), 'Kid7', (current_date - interval '15 years')::date, 10, 'GA');
    raise exception 'FAIL: 7th student was added';
  exception when others then
    if sqlerrm not like '%student limit%' then raise; end if;
  end;
  -- A parent can't read sign-in records or the team list, or raise their own limit.
  begin
    perform 1 from signin_seen;
    raise exception 'FAIL: parent read signin_seen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from family_account_flags();
    raise exception 'FAIL: parent saw team flags';
  exception when others then
    if sqlerrm not like '%not allowed%' then raise; end if;
  end;
  begin
    perform set_family_student_limit((select v::uuid from r64 where k='fam'), 10);
    raise exception 'FAIL: parent raised own limit';
  exception when others then
    if sqlerrm not like '%not allowed%' then raise; end if;
  end;
end $$;
reset role;

-- Sign-ins (written by the server): the parent at home, Kid1 at home too, Kid2 only elsewhere.
insert into signin_seen (user_id, family_id, role, student_id, device_id, net_hash, day) values
  ('00000000-0000-0000-0000-0000000064a1', (select v::uuid from r64 where k='fam'), 'parent', null, 'dev-parent-1', 'home-net-hash', current_date),
  ('00000000-0000-0000-0000-0000000064b1', (select v::uuid from r64 where k='fam'), 'student', (select v::uuid from r64 where k='kid1'), 'dev-kid1-01', 'home-net-hash', current_date),
  ('00000000-0000-0000-0000-0000000064b1', (select v::uuid from r64 where k='fam'), 'student', (select v::uuid from r64 where k='kid1'), 'dev-kid1-01', 'school-net-h', current_date),
  ('00000000-0000-0000-0000-0000000064b1', (select v::uuid from r64 where k='fam'), 'student', (select v::uuid from r64 where k='kid2'), 'dev-kid2-01', 'other-house', current_date),
  ('00000000-0000-0000-0000-0000000064b1', (select v::uuid from r64 where k='fam'), 'student', (select v::uuid from r64 where k='kid2'), 'dev-kid2-01', 'other-house', current_date - 120);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000064c1', false);
do $$
declare r record;
begin
  select * into r from family_account_flags() where family_id = (select v::uuid from r64 where k='fam');
  if r is null then raise exception 'FAIL: family not flagged'; end if;
  if r.students <> 6 then raise exception 'FAIL: students %', r.students; end if;
  if r.apart <> 1 then raise exception 'FAIL: apart %', r.apart; end if;
  if r.students_signed_in <> 2 then raise exception 'FAIL: signed in %', r.students_signed_in; end if;
  -- The team raises the limit for a big family.
  perform set_family_student_limit((select v::uuid from r64 where k='fam'), 8);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000064a1', false);
select add_student((select v::uuid from r64 where k='fam'), 'Kid7', (current_date - interval '15 years')::date, 10, 'GA');
reset role;

do $$
declare n int;
begin
  select prune_signin_seen() into n;
  if n <> 1 then raise exception 'FAIL: pruned %', n; end if;
  if exists (select 1 from signin_seen where day < current_date - 90) then raise exception 'FAIL: old record kept'; end if;
end $$;
\o
\echo SHARING GUARD CHECKS PASSED
