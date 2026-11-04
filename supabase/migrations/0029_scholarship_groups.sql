-- Scholarship groups brought up to date (Nov 2026).
-- * "Woman" is no longer a group chip. Students answer "Female / Male / Prefer
--   not to say" on its own, and awards tagged "Woman" or "Man" match that answer.
-- * Race labels follow the 2024 federal standard: "Asian American or Pacific
--   Islander" is split into "Asian or Asian American" and "Native Hawaiian or
--   Pacific Islander", and "Middle Eastern or North African" is new.
-- * New groups: Child of a first responder, Rural or small-town student,
--   Student who is a parent, DACA or undocumented student.
-- Safe to run twice.

-- 1. Saved student answers.
update students
set match_profile = jsonb_set(
      match_profile || case when match_profile ? 'sex' then '{}'::jsonb
                            when match_profile->'groups' ? 'Woman' then '{"sex":"female"}'::jsonb
                            when match_profile->'groups' ? 'Man' then '{"sex":"male"}'::jsonb
                            else '{}'::jsonb end,
      '{groups}',
      coalesce((
        select jsonb_agg(distinct g)
        from jsonb_array_elements_text(match_profile->'groups') old(x)
        cross join lateral unnest(case when old.x = 'Asian American or Pacific Islander'
                                       then array['Asian or Asian American', 'Native Hawaiian or Pacific Islander']
                                       else array[old.x] end) as g
        where g not in ('Woman', 'Man')
      ), '[]'::jsonb))
where jsonb_typeof(match_profile->'groups') = 'array'
  and (match_profile->'groups' ?| array['Woman', 'Man', 'Asian American or Pacific Islander']);

-- 2. Scholarships that used the old combined label.
update scholarships
set groups = (select array_agg(distinct g) from unnest(groups) old(x)
              cross join lateral unnest(case when old.x = 'Asian American or Pacific Islander'
                                             then array['Asian or Asian American', 'Native Hawaiian or Pacific Islander']
                                             else array[old.x] end) as g)
where 'Asian American or Pacific Islander' = any(groups);

-- 3. Awards that fit the new groups.
update scholarships set groups = array['Child of a first responder']
  where name = 'Georgia Public Service Memorial Grant' and groups is null;
update scholarships set groups = array['Military family', 'Child of a first responder']
  where name in ('Maximum Pell Grant for children of fallen service members and public safety officers',
                 'Folds of Honor Higher Education Scholarship')
    and not ('Child of a first responder' = any(coalesce(groups, '{}')));
update scholarships set groups = array['Rural or small-town student']
  where name = 'UGA CAES Rural Scholars Program' and groups is null;
update scholarships set groups = array['DACA or undocumented student']
  where name = 'TheDream.US National Scholarship' and groups is null;
update scholarships set groups = array['Man']
  where name = 'Morehouse Academic Scholarship' and groups is null;
