\set ON_ERROR_STOP on
\o /dev/null
-- Family with parent p1 and two students: Ann (signed in as s1) and Ben (no sign-in).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000033a1', false);
create temp table r (k text primary key, v text);
grant all on r to authenticated;
insert into r values ('fam', create_family('Remove Test')::text);
insert into r values ('ann', add_student((select v::uuid from r where k='fam'), 'Ann', '2010-01-01', 10, 'GA')::text);
insert into r values ('ben', add_student((select v::uuid from r where k='fam'), 'Ben', '2011-01-01', 9, 'GA')::text);
insert into r values ('code', create_student_invite((select v::uuid from r where k='ann')));
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000033b1', false);
select accept_student_invite((select v from r where k='code'));

-- Nobody signed in can call it directly (only the server can).
do $$ begin
  begin
    perform remove_student((select v::uuid from r where k='ann'), '00000000-0000-0000-0000-0000000033a1');
    raise exception 'FAIL: called remove_student directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The student, or someone outside the family, can't remove a student.
do $$ begin
  begin
    perform remove_student((select v::uuid from r where k='ann'), '00000000-0000-0000-0000-0000000033b1');
    raise exception 'FAIL: student removed themselves';
  exception when raise_exception then
    if sqlerrm not like 'Only a parent%' then raise; end if;
  end;
  begin
    perform remove_student((select v::uuid from r where k='ben'), '00000000-0000-0000-0000-0000000033c9');
    raise exception 'FAIL: outsider removed a student';
  exception when raise_exception then
    if sqlerrm not like 'Only a parent%' then raise; end if;
  end;
end $$;

-- The parent removes Ann: her record, link and invite go; her sign-in is returned; Ben stays.
do $$ declare out uuid[]; begin
  out := remove_student((select v::uuid from r where k='ann'), '00000000-0000-0000-0000-0000000033a1');
  assert out = array['00000000-0000-0000-0000-0000000033b1'::uuid], 'returns Ann''s sign-in';
  assert not exists (select 1 from students where id = (select v::uuid from r where k='ann')), 'Ann deleted';
  assert not exists (select 1 from family_members where user_id = '00000000-0000-0000-0000-0000000033b1'), 'Ann unlinked';
  assert not exists (select 1 from family_invites where student_id = (select v::uuid from r where k='ann')), 'invite gone';
  assert exists (select 1 from students where id = (select v::uuid from r where k='ben')), 'Ben kept';
  assert exists (select 1 from audit_log where action = 'student_remove' and target_id = (select v from r where k='ann')), 'audited';
end $$;

-- A student who never signed in: nothing to remove besides the record.
do $$ declare out uuid[]; begin
  out := remove_student((select v::uuid from r where k='ben'), '00000000-0000-0000-0000-0000000033a1');
  assert cardinality(out) = 0, 'no sign-ins for Ben';
  assert exists (select 1 from families where id = (select v::uuid from r where k='fam')), 'family kept';
end $$;
\o
\echo REMOVE STUDENT PASSED
