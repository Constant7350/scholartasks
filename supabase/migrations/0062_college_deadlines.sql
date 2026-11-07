-- College application deadlines that fill in by themselves (Constant, 2026-11-07).
-- The College Scorecard has no application deadlines, so the team keeps them here as a month and
-- day (they repeat each year). The app shows the college's own date when it is here, otherwise the
-- typical date for the plan type (Early Action Nov 1, Regular Decision Jan 1, and so on), marked
-- as typical so the family checks the college's site. Everyone can read; only the team writes.
-- plan values match the college list: EA, ED, ED2, REA, RD, priority, plus aid_priority for the
-- financial aid priority date shown on the FAFSA page.

create table if not exists college_deadlines (
  college_id  int  not null references colleges (id) on delete cascade,
  plan        text not null check (plan in ('EA', 'ED', 'ED2', 'REA', 'RD', 'priority', 'aid_priority')),
  month       int  not null check (month between 1 and 12),
  day         int  not null check (day between 1 and 31),
  note        text check (length(note) <= 200),          -- e.g. "Georgia residents" or "scholarship consideration"
  source      text check (length(source) <= 300),        -- where the team saw it (admissions page)
  checked_on  date not null default current_date,        -- when the team last confirmed it
  primary key (college_id, plan)
);
alter table college_deadlines enable row level security;
drop policy if exists college_deadlines_read on college_deadlines;
drop policy if exists college_deadlines_admin on college_deadlines;
create policy college_deadlines_read on college_deadlines for select to anon, authenticated using (true);
create policy college_deadlines_admin on college_deadlines for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select on college_deadlines to anon;
grant select, insert, update, delete on college_deadlines to authenticated;

-- Starter rows for the Georgia colleges most families list first. Dates repeat each year;
-- the team re-checks them each summer on the admissions pages (source).
insert into college_deadlines (college_id, plan, month, day, note, source)
select v.college_id, v.plan, v.month, v.day, v.note, v.source
  from (values
    (139959, 'EA', 10, 15, null, 'https://www.admissions.uga.edu/apply/'),
    (139959, 'RD', 1, 1, null, 'https://www.admissions.uga.edu/apply/'),
    (139755, 'EA', 10, 15, 'Early Action 1: Georgia residents', 'https://admission.gatech.edu/first-year/deadlines/'),
    (139755, 'RD', 1, 4, null, 'https://admission.gatech.edu/first-year/deadlines/'),
    (139658, 'ED', 11, 1, null, 'https://apply.emory.edu/apply/first-year/deadlines.html'),
    (139658, 'ED2', 1, 1, null, 'https://apply.emory.edu/apply/first-year/deadlines.html'),
    (139658, 'RD', 1, 1, null, 'https://apply.emory.edu/apply/first-year/deadlines.html')
  ) as v (college_id, plan, month, day, note, source)
 where exists (select 1 from colleges c where c.id = v.college_id)
on conflict (college_id, plan) do nothing;
