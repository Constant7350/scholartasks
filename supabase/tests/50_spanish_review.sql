\set ON_ERROR_STOP on
\o /dev/null
-- Spanish review: language setting, testers, word-list fixes, the live screen feed and the sample family.
insert into auth.users values ('00000000-0000-0000-0000-0000000050a1', 'Tester@Example.com'),
                              ('00000000-0000-0000-0000-0000000050a2', 'someone@example.com'),
                              ('00000000-0000-0000-0000-0000000050b1', 'team@example.com');
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000050b1');
insert into scholarships (name, sponsor, url, amount_text, summary)
select 'Sample award ' || g, 'Provider', 'https://example.com/' || g, '$1,000', 'Summary text here.'
  from generate_series(1, 3) g
on conflict do nothing;

set role authenticated;

-- The team adds a tester; nobody else can.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050a2', false);
do $$ begin
  begin
    insert into app_testers (email, name) values ('x@example.com', 'X');
    raise exception 'FAIL: non-team added a tester';
  exception when insufficient_privilege then null; end;
  assert not is_tester(), 'a regular person is not a tester';
  begin
    perform i18n_save('Home', 'fix', 'Casa');
    raise exception 'FAIL: non-tester saved a fix';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;
select set_my_lang('es');
do $$ begin
  assert (select lang from user_settings where user_id = auth.uid()) = 'es', 'language saved';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050b1', false);
insert into app_testers (email, name, phone) values ('tester@example.com', 'Ana', '4045550123');

-- The tester (email matched without caring about capitals) saves fixes; everyone can read the fixed lines.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050a1', false);
select i18n_save('Home', 'fix', '  Inicio  ', 'shorter');
select i18n_save('Menu', 'ok');
select i18n_live_report('/home', 'Home', '[{"en":"Home","es":"Inicio"}]'::jsonb);
do $$ begin
  assert is_tester(), 'an active tester is a tester';
  assert (tester_me()->>'name') = 'Ana', 'tester_me knows the name';
  assert (select es from translation_fixes where en = 'Home') = 'Inicio', 'fix saved and trimmed';
  assert (select count(*) from i18n_fixes()) = 1, 'only fixes are served, not OK marks';
  assert (select path from translation_live) = '/home', 'live screen saved';
  begin
    perform i18n_save('Menu', 'fix', '  ');
    raise exception 'FAIL: blank fix saved';
  exception when raise_exception then
    if sqlerrm not like 'Type the Spanish%' then raise; end if;
  end;
end $$;

-- Sample family: made with Emma and her plan, remade cleanly a second time.
select tester_make_sample_family();
select tester_make_sample_family();
do $$ begin
  assert (select count(*) from families where is_sample) = 1, 'remaking replaces the old sample family';
  assert (select first_name || grade_level || state from students) = 'Emma11GA', 'sample student';
  assert (select count(*) from course_grades) = 12, 'sample grades';
  assert (select count(*) from student_colleges) = 4, 'sample colleges';
  assert (select count(*) from tasks) = 6, 'sample deadlines';
  assert (select count(*) from student_activities) = 4, 'sample activities';
  assert (select count(*) from student_essays) = 2, 'sample essays';
  assert (select count(*) from scholarship_choices) = 2, 'sample saved scholarships';
  assert (tester_me()->>'sample_family') is not null, 'tester_me points to the sample family';
end $$;

-- Others can't see the live screen, and can't be given a sample family.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050a2', false);
do $$ begin
  assert (select count(*) from translation_live) = 0, 'live screens are private';
  assert (select count(*) from i18n_fixes()) = 1, 'anyone gets the fixed lines';
  begin
    perform tester_make_sample_family();
    raise exception 'FAIL: non-tester made a sample family';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end $$;

-- A turned-off tester loses access.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050b1', false);
update app_testers set active = false where email = 'tester@example.com';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000050a1', false);
do $$ begin
  assert not is_tester(), 'inactive tester is not a tester';
end $$;
reset role;
\o
\echo SPANISH REVIEW CHECKS PASSED
