\set ON_ERROR_STOP on
\o /dev/null
-- Practice levels, "My classes" and the anonymous USA ranking (migration 0066).
\i seed/practice_questions_more.sql
\i seed/practice_questions_more.sql
do $$ begin
  assert (select count(distinct subject) from practice_questions where exam is null) = 31, 'every class loads';
  assert (select count(*) from practice_questions where exam is null and level = 5) >= 60, 'Expert questions load';
  assert (select count(*) from practice_questions where subject = 'Spanish 1') >= 20, 'languages load';
  assert (select count(*) from practice_questions where exam is null and level >= 3 and status <> 'pending') = 0, 'new questions wait for review';
end $$;

-- Three families with five students each; twelve students join the ranking.
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000066a' || p)::uuid, 'parent66-' || p || '@example.com' from generate_series(1, 3) p;
create temp table r66 (k text primary key, v text);
grant all on r66 to public;
do $$
declare p int; f uuid; i int;
begin
  for p in 1..3 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066a' || p, false);
    f := create_family('Rank ' || p);
    for i in 1..5 loop
      insert into r66 values ('kid' || ((p - 1) * 5 + i), add_student(f, 'Kid' || i, (current_date - interval '15 years')::date, 10, 'GA')::text);
    end loop;
  end loop;
end $$;
-- Kid n answers 30 Algebra I questions: n of them right at Expert level, the rest wrong.
insert into student_practice (student_id, ranked) select v::uuid, substr(k, 4)::int <= 12 from r66;
insert into practice_attempts (student_id, question_id, correct, created_at)
select r.v::uuid, q.id, g <= substr(r.k, 4)::int, now() - (g || ' minutes')::interval
from r66 r cross join generate_series(1, 30) g
cross join lateral (select id from practice_questions where subject = 'Algebra I' and level = 5 and kind = 'mc' limit 1) q;

set role authenticated;
-- Kid 12 (family 3) is ranked: ahead of the 11 other ranked students; nobody else is named.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066a3', false);
do $$
declare s uuid := (select v::uuid from r66 where k = 'kid12'); row record;
begin
  select * into row from practice_standing(s) where subject = 'Algebra I';
  assert row.answered = 30 and row.score = 2.00, 'score uses the last 30 answers and question level';
  assert row.ranked_count = 11 and row.ahead_pct = 100, 'ranked against other students only by percent';
  -- Kid 13 didn't join: their own score shows, but no ranking.
  select * into row from practice_standing((select v::uuid from r66 where k = 'kid13')) where subject = 'Algebra I';
  assert row.score is not null and row.ahead_pct is null and row.ranked_count is null, 'no ranking unless joined';
  -- Another family's student returns nothing.
  assert (select count(*) from practice_standing((select v::uuid from r66 where k = 'kid1'))) = 0, 'no other families';
  assert (select count(*) from student_practice) = 5, 'parent sees only their own students';
  update student_practice set subjects = '{"Algebra I","Spanish 1"}' where student_id = s;
  assert (select subjects from student_practice where student_id = s) = '{"Algebra I","Spanish 1"}', 'parent saves My classes';
end $$;

-- Kid 1 (family 1) has the lowest score.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066a1', false);
do $$
declare row record;
begin
  select * into row from practice_standing((select v::uuid from r66 where k = 'kid1')) where subject = 'Algebra I';
  assert row.ahead_pct = 0, 'lowest score is ahead of no one';
  -- Fewer than 10 other ranked students: no percent yet.
  update student_practice set ranked = false where student_id in (select v::uuid from r66 where k in ('kid2', 'kid3'));
  select * into row from practice_standing((select v::uuid from r66 where k = 'kid1')) where subject = 'Algebra I';
  assert row.ahead_pct is null and row.ranked_count = 9, 'no percent until 10 other students are ranked';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001a9', false);
do $$ begin
  assert (select count(*) from student_practice) = 0, 'stranger sees no settings';
  assert (select count(*) from practice_standing((select v::uuid from r66 where k = 'kid12'))) = 0, 'stranger sees no standing';
end $$;
reset role;
\o
\echo PRACTICE LEVELS CHECKS PASSED
