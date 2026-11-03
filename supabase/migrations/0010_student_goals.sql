-- Goals: the family sets the student's GPA goal and the lowest grade they are
-- happy with in a core class (their "standard"). The scorecard and the AI
-- counselor measure against these. Not every student aims for straight A's.

alter table students
  add column if not exists goal_gpa numeric(3,2) check (goal_gpa between 1.00 and 4.50),
  add column if not exists min_grade text not null default 'B' check (min_grade in ('A', 'B', 'C', 'D'));

create or replace function set_student_goal(p_student uuid, p_goal_gpa numeric, p_min_grade text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or student_may(p_student, 'enter_grades')) then
    raise exception 'not allowed';
  end if;
  update students set goal_gpa = p_goal_gpa, min_grade = p_min_grade where id = p_student;
end $$;

revoke all on function set_student_goal(uuid, numeric, text) from public;
grant execute on function set_student_goal(uuid, numeric, text) to authenticated;
