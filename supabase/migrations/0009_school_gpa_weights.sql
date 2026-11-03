-- Each school weights its own GPA differently (often +1 for AP/IB/dual
-- enrollment and +0.5 for honors). The family sets their school's weighting
-- so the scorecard can show a weighted school GPA beside HOPE and unweighted.

alter table students
  add column if not exists weight_rigor numeric(3,2) not null default 1.00 check (weight_rigor between 0 and 2),
  add column if not exists weight_honors numeric(3,2) not null default 0.50 check (weight_honors between 0 and 2);

create or replace function set_school_weights(p_student uuid, p_rigor numeric, p_honors numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or student_may(p_student, 'enter_grades')) then
    raise exception 'not allowed';
  end if;
  update students set weight_rigor = p_rigor, weight_honors = p_honors where id = p_student;
end $$;

revoke all on function set_school_weights(uuid, numeric, numeric) from public;
grant execute on function set_school_weights(uuid, numeric, numeric) to authenticated;
