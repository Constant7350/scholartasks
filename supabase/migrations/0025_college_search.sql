-- College search and "what it will cost us".
-- colleges: every operating college that mainly awards bachelor's degrees, plus
-- Georgia's two-year and technical colleges, from the U.S. Department of
-- Education's College Scorecard (public data, shared by every family; loaded
-- from supabase/seed/colleges.sql and refreshed each fall).
-- A family's college list can point at one of these colleges, record the
-- grants and scholarships in that college's aid offer, and the student's
-- outside scholarships, so the app can estimate a real yearly price.

create table if not exists colleges (
  id               int primary key,            -- Scorecard / IPEDS unit id
  name             text not null,
  city             text,
  state            text not null,
  url              text,
  price_calc_url   text,
  ownership        smallint not null check (ownership in (1, 2, 3)),   -- public, private nonprofit, for-profit
  degree           smallint,                   -- 2 associate, 3 bachelor's (most degrees awarded)
  size             int,
  admit_rate       numeric(4,3),
  sat_avg          int,
  act_mid          int,
  tuition_in       int,
  tuition_out      int,
  cost_attendance  int,
  avg_net_price    int,
  net_price        int[] not null default '{}', -- families earning 0-30k, 30-48k, 48-75k, 75-110k, 110k+
  grad_rate        numeric(4,3),
  earnings         int,
  median_debt      int,
  programs         jsonb not null default '{}'::jsonb,
  data_year        text,
  updated_at       timestamptz not null default now()
);
create index if not exists colleges_state on colleges (state);
create index if not exists colleges_name_lower on colleges (lower(name));

alter table colleges enable row level security;
drop policy if exists colleges_read on colleges;
drop policy if exists colleges_admin on colleges;
create policy colleges_read on colleges for select to anon, authenticated using (true);
create policy colleges_admin on colleges for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select on colleges to anon;
grant select, insert, update, delete on colleges to authenticated;

-- Candidates for the match quiz: colleges in the chosen states (all states when
-- null), of the chosen kind, ranked by how many of their degrees are in the
-- student's interest areas. Scoring and prices are worked out in the app.
create or replace function match_colleges(p_states text[], p_ownership int[], p_programs text[], p_limit int default 300)
returns setof colleges language sql stable set search_path = public as $$
  select c.* from colleges c
   where (p_states is null or c.state = any(p_states))
     and c.ownership = any(coalesce(p_ownership, array[1, 2]))
     and (coalesce(cardinality(p_programs), 0) = 0
          or exists (select 1 from unnest(p_programs) f where coalesce((c.programs ->> f)::numeric, 0) > 0))
   order by (select coalesce(sum((c.programs ->> f)::numeric), 0) from unnest(coalesce(p_programs, '{}')) f) desc,
            c.size desc nulls last
   limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function match_colleges(text[], int[], text[], int) from public;
grant execute on function match_colleges(text[], int[], text[], int) to authenticated;

-- A college on the list can point at its Scorecard record, and hold the grants
-- and scholarships from that college's aid offer (per year).
alter table student_colleges add column if not exists college_id int references colleges(id) on delete set null;
alter table student_colleges add column if not exists aid_offer int;
alter table student_colleges drop constraint if exists student_colleges_aid_offer_range;
alter table student_colleges add constraint student_colleges_aid_offer_range check (aid_offer is null or aid_offer between 0 and 200000);

-- Outside scholarships the student has won, per year (any college).
alter table students add column if not exists outside_awards int;
alter table students drop constraint if exists students_outside_awards_range;
alter table students add constraint students_outside_awards_range check (outside_awards is null or outside_awards between 0 and 200000);

create or replace function set_outside_awards(p_student uuid, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or is_student_self(p_student)) then
    raise exception 'not allowed';
  end if;
  update students set outside_awards = p_amount where id = p_student;
end $$;
revoke all on function set_outside_awards(uuid, int) from public;
grant execute on function set_outside_awards(uuid, int) to authenticated;
