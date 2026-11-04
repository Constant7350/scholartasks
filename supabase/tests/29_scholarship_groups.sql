\set ON_ERROR_STOP on
\o /dev/null
reset role;
-- Old answers ("Woman" chip, combined Asian/Pacific Islander label) move to the new shape.
insert into families (id, name) values ('00000000-0000-0000-0000-0000000029f0', 'Groups test') on conflict do nothing;
insert into students (id, family_id, first_name, birth_date, grade_level, state, match_profile) values
  ('00000000-0000-0000-0000-0000000029a1', '00000000-0000-0000-0000-0000000029f0', 'Ana', '2008-01-01', 12, 'GA',
   '{"groups":["Woman","Asian American or Pacific Islander","Military family"],"groups_answered":true}'),
  ('00000000-0000-0000-0000-0000000029a2', '00000000-0000-0000-0000-0000000029f0', 'Ben', '2008-01-01', 12, 'GA',
   '{"groups":["Woman"],"sex":"male"}'),
  ('00000000-0000-0000-0000-0000000029a3', '00000000-0000-0000-0000-0000000029f0', 'Cy', '2008-01-01', 12, 'GA', '{"interests":["STEM"]}');
update scholarships set groups = array['Black or African American', 'Asian American or Pacific Islander'] where name = 'The Gates Scholarship';
update scholarships set groups = null where name = 'UGA CAES Rural Scholars Program';
\i migrations/0029_scholarship_groups.sql
\i migrations/0029_scholarship_groups.sql
do $$
declare a jsonb := (select match_profile from students where id = '00000000-0000-0000-0000-0000000029a1');
begin
  assert a->>'sex' = 'female', 'Woman chip becomes sex female';
  assert a->'groups' @> '["Asian or Asian American","Native Hawaiian or Pacific Islander","Military family"]'
     and jsonb_array_length(a->'groups') = 3, 'groups split and Woman removed';
  assert (a->>'groups_answered')::boolean, 'other answers kept';
  assert (select match_profile->>'sex' from students where id = '00000000-0000-0000-0000-0000000029a2') = 'male', 'an existing sex answer wins';
  assert (select match_profile from students where id = '00000000-0000-0000-0000-0000000029a3') = '{"interests":["STEM"]}', 'untouched profiles stay the same';
  assert (select groups from scholarships where name = 'The Gates Scholarship') @> array['Asian or Asian American', 'Native Hawaiian or Pacific Islander', 'Black or African American']
     and not exists (select 1 from scholarships where name = 'The Gates Scholarship' and 'Asian American or Pacific Islander'::text = any(groups)), 'scholarship labels split';
  assert (select groups from scholarships where name = 'UGA CAES Rural Scholars Program') = array['Rural or small-town student'], 'rural award tagged';
end $$;
delete from students where family_id = '00000000-0000-0000-0000-0000000029f0';
delete from families where id = '00000000-0000-0000-0000-0000000029f0';
