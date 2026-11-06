-- Christian colleges and universities as a search option.
-- colleges.religious_affiliation holds the College Scorecard religious
-- affiliation code (IPEDS RELAFFIL; names and the Christian list live in
-- packages/core/src/faith.ts). Null when a college reports none.
-- Loaded from supabase/seed/college_faith.sql (built from college_faith.json).

alter table colleges add column if not exists religious_affiliation smallint;
create index if not exists colleges_religious_affiliation on colleges (religious_affiliation) where religious_affiliation is not null;

-- The match quiz can keep only colleges with the chosen affiliations
-- (p_faith null = any college). Home state first and nationwide stay the
-- family's "Where?" choice.
drop function if exists match_colleges(text[], int[], text[], int);
create or replace function match_colleges(p_states text[], p_ownership int[], p_programs text[], p_limit int default 300, p_faith int[] default null)
returns setof colleges language sql stable set search_path = public as $$
  select c.* from colleges c
   where (p_states is null or c.state = any(p_states))
     and (coalesce(c.degree, 3) = 3 or (c.degree = 2 and c.state = 'GA'))
     and c.ownership = any(coalesce(p_ownership, array[1, 2]))
     and (p_faith is null or c.religious_affiliation = any(p_faith))
     and (coalesce(cardinality(p_programs), 0) = 0
          or exists (select 1 from unnest(p_programs) f where coalesce((c.programs ->> f)::numeric, 0) > 0))
   order by (select coalesce(sum((c.programs ->> f)::numeric), 0) from unnest(coalesce(p_programs, '{}')) f) desc,
            c.size desc nulls last
   limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function match_colleges(text[], int[], text[], int, int[]) from public;
grant execute on function match_colleges(text[], int[], text[], int, int[]) to authenticated;
