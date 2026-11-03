\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Lees')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Mia', '2010-01-01', 10, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));
select set_student_permission((select v::uuid from g where k='student'), 'enter_grades', false);

do $$ begin
  assert (select weight_rigor from students where id = (select v::uuid from g where k='student')) = 1 and (select weight_honors from students where id = (select v::uuid from g where k='student')) = 0.5, 'defaults +1 / +0.5';
  perform set_school_weights((select v::uuid from g where k='student'), 0.5, 0);
  assert (select weight_rigor from students where id = (select v::uuid from g where k='student')) = 0.5 and (select weight_honors from students where id = (select v::uuid from g where k='student')) = 0, 'parent saved weights';
  begin
    perform set_school_weights((select v::uuid from g where k='student'), 5, 0);
    raise exception 'FAIL: weight of 5 accepted';
  exception when check_violation then null; end;
end $$;

-- Student without grade entry permission can't change it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', false);
do $$ begin
  perform accept_student_invite((select v from g where k='code'));
  begin
    perform set_school_weights((select v::uuid from g where k='student'), 1, 1);
    raise exception 'FAIL: student changed weights without permission';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;

-- A stranger can't.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', false);
do $$ begin
  begin
    perform set_school_weights((select v::uuid from g where k='student'), 1, 1);
    raise exception 'FAIL: stranger changed weights';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
end $$;
\o
\echo SCHOOL GPA WEIGHT CHECKS PASSED
