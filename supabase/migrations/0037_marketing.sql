-- Marketing plan tracker for the ScholarTasks team (/admin/marketing).
-- The plan itself (audience, messages, steps) lives in the app code
-- (apps/web/app/admin/marketing/plan.ts). This table only remembers which
-- steps are done and the team's short notes, so everyone sees the same progress.
-- Team only (app_admins). Nothing here is about families or students.

create table if not exists marketing_steps (
  step_id     text primary key check (length(step_id) between 2 and 60),
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skip')),
  note        text check (note is null or length(note) <= 1000),
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table marketing_steps enable row level security;
drop policy if exists marketing_steps_team on marketing_steps;
create policy marketing_steps_team on marketing_steps
  for all using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on marketing_steps to authenticated;

-- Save one step's status and note (team only).
create or replace function save_marketing_step(p_step text, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  insert into marketing_steps (step_id, status, note, updated_by, updated_at)
  values (p_step, p_status, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), now())
  on conflict (step_id) do update
    set status = excluded.status, note = excluded.note,
        updated_by = excluded.updated_by, updated_at = now();
end $$;
grant execute on function save_marketing_step(text, text, text) to authenticated;

-- The live numbers the plan's goals are measured against (team only, counts only).
create or replace function marketing_numbers() returns jsonb
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return jsonb_build_object(
    'families',        (select count(*) from families),
    'families_30d',    (select count(*) from families where created_at > now() - interval '30 days'),
    'students',        (select count(*) from students),
    'paying_families', (select count(distinct family_id) from billing_subscriptions
                         where kind = 'family' and status in ('active', 'trialing')),
    'schools',         (select count(*) from schools where status = 'approved'),
    'school_students', (select count(*) from school_links where status = 'active'),
    'ai_users_7d',     (select count(distinct user_id) from ai_usage where day > current_date - 7)
  );
end $$;
grant execute on function marketing_numbers() to authenticated;
