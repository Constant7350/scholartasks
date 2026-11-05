-- Compare aid offers: the parts of each college's award letter, per year, so
-- families can see free money, loans and work-study side by side. aid_offer
-- (grants and scholarships) stays the number the cost estimate uses; the page
-- keeps it equal to aid_offer_detail.grants.
create or replace function aid_offer_detail_ok(d jsonb) returns boolean
language sql immutable set search_path = public as $$
  select d is null or (
    jsonb_typeof(d) = 'object'
    and length(d::text) <= 2000
    and not exists (
      select 1 from jsonb_each(d) e
      where e.key not in ('coa', 'grants', 'student_loans', 'parent_loans', 'work_study', 'notes')
         or (e.key = 'notes' and (jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 500))
         or (e.key <> 'notes' and jsonb_typeof(e.value) <> 'null'
             and (jsonb_typeof(e.value) <> 'number' or (e.value)::numeric < 0 or (e.value)::numeric > 300000))
    )
  )
$$;

alter table student_colleges add column if not exists aid_offer_detail jsonb;
alter table student_colleges drop constraint if exists student_colleges_aid_offer_detail_ok;
alter table student_colleges add constraint student_colleges_aid_offer_detail_ok check (aid_offer_detail_ok(aid_offer_detail));
