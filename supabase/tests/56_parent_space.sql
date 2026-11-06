\set ON_ERROR_STOP on
\o /dev/null
-- A parent's own space: parents keep their own picks, students see only shared ones,
-- other parents can read but not change them, and quiz answers are saved with who saved them.
-- People: parent (56a1), second parent (56a2), student Zoe 16 (56b1), stranger (56c1).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000056a1', 'mom56@example.com'),
  ('00000000-0000-0000-0000-0000000056a2', 'dad56@example.com'),
  ('00000000-0000-0000-0000-0000000056b1', 'zoe56@example.com'),
  ('00000000-0000-0000-0000-0000000056c1', 'other56@example.com');
create temp table r56 (k text primary key, v text);
grant all on r56 to public;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056a1', false);
insert into r56 values ('fam', create_family('Parent Space Test')::text);
insert into r56 values ('zoe', add_student((select v::uuid from r56 where k='fam'), 'Zoe', (current_date - interval '16 years')::date, 11, 'GA')::text);
insert into r56 values ('code', create_student_invite((select v::uuid from r56 where k='zoe')));
reset role;
insert into family_members (family_id, user_id, role)
  values ((select v::uuid from r56 where k='fam'), '00000000-0000-0000-0000-0000000056a2', 'parent');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056b1', false);
select accept_student_invite((select v from r56 where k='code'));

-- The parent saves picks of their own. Nothing lands on the student's plan.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056a1', false);
do $$
declare zoe uuid := (select v::uuid from r56 where k='zoe');
begin
  insert into parent_saves (student_id, kind, item_key, name) values (zoe, 'college', '139959', 'University of Georgia');
  insert into parent_saves (student_id, kind, item_key, name, pick, shared, note) values (zoe, 'career', 'vet', 'Veterinarian', 'like', true, 'You love animals');
  insert into parent_saves (student_id, kind, item_key, name, pick) values (zoe, 'trade', 'welding', 'Welding', 'no');
  if (select count(*) from student_colleges where student_id = zoe) <> 0 then raise exception 'FAIL: parent save went on the plan'; end if;
  if (select user_id from parent_saves where item_key = '139959') <> auth.uid() then raise exception 'FAIL: owner not set'; end if;
  begin
    update parent_saves set shared = true where item_key = 'welding';
    raise exception 'FAIL: shared a no pick';
  exception when check_violation then null; end;
  begin
    insert into parent_saves (user_id, student_id, kind, item_key, name) values ('00000000-0000-0000-0000-0000000056a2', zoe, 'college', '1', 'Fake');
    raise exception 'FAIL: saved as another parent';
  exception when insufficient_privilege then null; end;
  -- Owner can't be moved on update.
  update parent_saves set user_id = '00000000-0000-0000-0000-0000000056a2' where item_key = '139959';
  if (select user_id from parent_saves where item_key = '139959') <> auth.uid() then raise exception 'FAIL: owner changed'; end if;
  if not exists (select 1 from audit_log where target = 'parent_saves' and actor_id = auth.uid() and student_id = zoe) then
    raise exception 'FAIL: no audit row';
  end if;
end $$;

-- The second parent reads them but can't change or delete them.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056a2', false);
do $$ begin
  if (select count(*) from parent_saves) <> 3 then raise exception 'FAIL: other parent sees %', (select count(*) from parent_saves); end if;
  update parent_saves set note = 'changed' where item_key = 'vet';
  delete from parent_saves where item_key = '139959';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056a1', false);
do $$ begin
  if (select note from parent_saves where item_key = 'vet') <> 'You love animals' then raise exception 'FAIL: other parent changed a pick'; end if;
  if (select count(*) from parent_saves) <> 3 then raise exception 'FAIL: other parent deleted a pick'; end if;
end $$;

-- The student sees only the shared pick and can't write.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056b1', false);
do $$
declare zoe uuid := (select v::uuid from r56 where k='zoe');
begin
  if (select count(*) from parent_saves) <> 1 then raise exception 'FAIL: student sees % picks', (select count(*) from parent_saves); end if;
  if (select item_key from parent_saves) <> 'vet' then raise exception 'FAIL: wrong pick shown'; end if;
  begin
    insert into parent_saves (student_id, kind, item_key, name) values (zoe, 'college', '2', 'Sneaky');
    raise exception 'FAIL: student saved a parent pick';
  exception when insufficient_privilege then null; end;
  update parent_saves set note = 'hacked';
  -- The student saves their quiz answers; the parent can read them.
  insert into career_quiz_answers (student_id, answers, seconds) values (zoe, '{"R1": 4, "I2": 1}', 300);
  if (select saved_by from career_quiz_answers) <> auth.uid() then raise exception 'FAIL: saved_by not stamped'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056a1', false);
do $$ begin
  if (select note from parent_saves where item_key = 'vet') <> 'You love animals' then raise exception 'FAIL: student changed a pick'; end if;
  if (select (answers ->> 'R1')::int from career_quiz_answers) <> 4 then raise exception 'FAIL: parent cannot read answers'; end if;
end $$;

-- A stranger sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000056c1', false);
do $$ begin
  if exists (select 1 from parent_saves) then raise exception 'FAIL: stranger sees picks'; end if;
  if exists (select 1 from career_quiz_answers) then raise exception 'FAIL: stranger sees answers'; end if;
end $$;
reset role;
\o
\echo PARENT SPACE CHECKS PASSED
