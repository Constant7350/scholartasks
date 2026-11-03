-- Grades and test scores: students with "enter grades" permission can remove a
-- grade they mistyped and record their own SAT/ACT scores. Parents can do both.

create policy grades_self_delete on course_grades for delete
  using (student_may(student_id, 'enter_grades'));

alter table course_grades add constraint course_grades_course_len check (length(trim(course)) between 1 and 120);

create or replace function set_test_scores(p_student uuid, p_sat int, p_act int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or student_may(p_student, 'enter_grades')) then
    raise exception 'not allowed';
  end if;
  update students set sat = p_sat, act = p_act where id = p_student;
end $$;

grant execute on function set_test_scores(uuid, int, int) to authenticated;
