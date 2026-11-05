-- Search colleges by what a student wants to study.
-- college_programs: every major at every college in the colleges table, from
-- the U.S. Department of Education's College Scorecard field-of-study data
-- (public data, shared by every family; loaded from
-- supabase/seed/college_programs.sql and refreshed each fall).
--   cip      4-digit federal major code (e.g. 2613 ecology and marine biology, 5138 nursing)
--   level    2 associate, 3 bachelor's, 5 master's, 6 doctorate, 7 professional (vet, medicine, law...)
--   grads    degrees awarded in a year
--   earn_*   median pay of graduates 1 and 4 years after finishing
--   debt     median federal loan debt of graduates
--   online   only offered online
-- study_fields: the federal name of each major code.
-- field_earnings: the national picture for each major and degree level.

create table if not exists college_programs (
  college_id int not null references colleges(id) on delete cascade,
  cip        char(4) not null,
  level      smallint not null check (level between 1 and 8),
  grads      int not null check (grads >= 0),
  earn_1yr   int,
  earn_4yr   int,
  debt       int,
  online     boolean not null default false,
  primary key (college_id, cip, level)
);
create index if not exists college_programs_cip on college_programs (cip, level, grads desc);

create table if not exists study_fields (
  cip   char(4) primary key,
  title text not null
);

create table if not exists field_earnings (
  cip      char(4) not null,
  level    smallint not null,
  programs int not null,
  grads    int not null,
  earn_1yr int,
  earn_4yr int,
  debt     int,
  primary key (cip, level)
);

do $$
declare t text;
begin
  foreach t in array array['college_programs', 'study_fields', 'field_earnings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_app_admin()) with check (is_app_admin())', t || '_admin', t);
    execute format('grant select on %I to anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Colleges that teach any of these majors at these degree levels, with the
-- college's facts: every one in the home state, plus the biggest programs
-- nationwide. Scoring and prices are worked out in the app.
create or replace function programs_for(p_cips text[], p_levels int[], p_state text, p_online boolean default false, p_limit int default 250)
returns table (college_id int, cip text, level smallint, grads int, earn_1yr int, earn_4yr int, debt int, online boolean, college jsonb)
language sql stable set search_path = public as $$
  with m as (
    select p.* from college_programs p
     where p.cip = any(p_cips) and p.level = any(p_levels) and (p_online or not p.online)
  ), by_college as (
    select m.college_id, sum(m.grads) as g from m group by m.college_id
  ), picked as (
    select b.college_id from by_college b join colleges c on c.id = b.college_id where c.state = p_state
    union
    select t.college_id from (select b.college_id from by_college b order by b.g desc limit least(greatest(p_limit, 1), 500)) t
  )
  select m.college_id, m.cip::text, m.level, m.grads, m.earn_1yr, m.earn_4yr, m.debt, m.online, to_jsonb(c) - 'programs'
    from m join picked using (college_id) join colleges c on c.id = m.college_id;
$$;
revoke all on function programs_for(text[], int[], text, boolean, int) from public;
grant execute on function programs_for(text[], int[], text, boolean, int) to anon, authenticated;

-- Majors whose federal name matches what was typed (for searches the app's
-- own list doesn't cover), most graduates first.
create or replace function search_majors(p_query text, p_limit int default 8)
returns table (cip text, title text, grads bigint)
language sql stable set search_path = public as $$
  select f.cip::text, f.title, coalesce(sum(e.grads), 0)::bigint
    from study_fields f left join field_earnings e on e.cip = f.cip and e.level in (2, 3)
   where length(trim(p_query)) >= 3 and f.title ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%'
   group by f.cip, f.title
   order by 3 desc
   limit least(greatest(p_limit, 1), 20);
$$;
revoke all on function search_majors(text, int) from public;
grant execute on function search_majors(text, int) to anon, authenticated;
