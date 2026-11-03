-- The Supabase project is created with "Automatically expose new tables" OFF,
-- so the API can reach only what is granted here. Signed-out visitors (anon)
-- get nothing; signed-in users (authenticated) get only what RLS then allows.

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on families, family_members, family_invites, audit_log to authenticated;
grant select, insert, update, delete on course_grades, tasks to authenticated;
grant select, update on students to authenticated;
grant update (name) on families to authenticated;

-- Functions the apps call directly.
grant execute on function
  create_family(text),
  add_student(uuid, text, date, int, char),
  create_student_invite(uuid),
  accept_student_invite(text),
  set_student_permission(uuid, text, boolean),
  set_adult_consent(uuid, boolean),
  log_access(uuid, text, jsonb),
  permission_keys()
to authenticated;

-- Helpers used inside row-level security policies must stay callable.
grant execute on function
  is_parent_of_family(uuid),
  can_parent_see_student(uuid),
  is_student_self(uuid),
  student_may(uuid, text)
to authenticated;
