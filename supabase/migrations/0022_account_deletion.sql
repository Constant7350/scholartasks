-- Delete your account from inside the app (Apple App Store 5.1.1(v) and Google Play
-- both require it). Called only by the server (service_role) after it has checked
-- who is signed in; the server then removes the sign-in itself.
--
-- * The last parent in a family: the whole family is deleted (students, grades,
--   plans, tasks, scholarships... everything cascades), and the students' sign-ins
--   are returned so the server removes them too.
-- * A parent when another parent remains: only this parent leaves the family.
-- * A student: only their sign-in goes; the student's record stays with the
--   family because the parent owns it.
-- The audit log keeps a record that the account was deleted.

create or replace function delete_account(p_user uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  m record;
  logins uuid[] := array[p_user];
begin
  if p_user is null then raise exception 'not signed in'; end if;

  for m in select family_id, role from family_members where user_id = p_user loop
    if m.role = 'parent' and not exists (
      select 1 from family_members where family_id = m.family_id and role = 'parent' and user_id <> p_user
    ) then
      if exists (
        select 1 from billing_subscriptions
        where family_id = m.family_id and status in ('active', 'trialing', 'past_due') and not cancel_at_period_end
      ) then
        raise exception 'Please cancel your paid plan first (Menu, Plan and billing), then delete the account.';
      end if;
      logins := logins || array(select user_id from family_members where family_id = m.family_id and role = 'student');
      insert into audit_log (actor_id, family_id, action, target, target_id, details)
      values (p_user, m.family_id, 'account_delete', 'families', m.family_id::text, '{}'::jsonb);
      delete from families where id = m.family_id;
    else
      delete from family_members where family_id = m.family_id and user_id = p_user;
    end if;
  end loop;

  -- Only remove a student's sign-in if it isn't still part of another family.
  logins := array(
    select distinct u from unnest(logins) u
    where u = p_user or not exists (select 1 from family_members where user_id = u)
  );

  delete from user_settings where user_id = any(logins);
  delete from reminder_log  where user_id = any(logins);
  delete from ai_usage      where user_id = any(logins);
  delete from app_admins    where user_id = any(logins);

  insert into audit_log (actor_id, action, target, target_id, details)
  values (p_user, 'account_delete', 'auth.users', p_user::text, jsonb_build_object('sign_ins_removed', cardinality(logins)));
  return logins;
end $$;

revoke all on function delete_account(uuid) from public, anon, authenticated;
grant execute on function delete_account(uuid) to service_role;
