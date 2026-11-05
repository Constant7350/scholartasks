-- A parent removes one student from the family (for example a test student, or a
-- child added by mistake). Called only by the server (service_role) after it has
-- checked who is signed in; the server then removes the student's sign-in itself.
--
-- Deleting the student row removes everything about that student (grades, lists,
-- tasks, saved scholarships... all cascade) and the student's link to the family.
-- The student's sign-in is returned for removal only if it isn't part of another
-- family. The audit log keeps a record.

create or replace function remove_student(p_student uuid, p_user uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
  sname text;
  logins uuid[];
begin
  if p_user is null then raise exception 'not signed in'; end if;
  select family_id, first_name into fid, sname from students where id = p_student;
  if fid is null or not exists (
    select 1 from family_members where family_id = fid and user_id = p_user and role = 'parent'
  ) then
    raise exception 'Only a parent in this family can remove this student.';
  end if;

  logins := array(select user_id from family_members where student_id = p_student and role = 'student');

  insert into audit_log (actor_id, family_id, action, target, target_id, details)
  values (p_user, fid, 'student_remove', 'students', p_student::text,
          jsonb_build_object('first_name', sname, 'sign_ins', cardinality(logins)));

  delete from family_invites where student_id = p_student;
  delete from students where id = p_student;

  -- Only remove a sign-in that isn't still part of another family.
  logins := array(
    select distinct u from unnest(logins) u
    where not exists (select 1 from family_members where user_id = u)
  );
  delete from user_settings where user_id = any(logins);
  delete from reminder_log  where user_id = any(logins);
  delete from ai_usage      where user_id = any(logins);
  return logins;
end $$;

revoke all on function remove_student(uuid, uuid) from public, anon, authenticated;
grant execute on function remove_student(uuid, uuid) to service_role;
