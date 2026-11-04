-- Grade rescue plans: when a grade falls below the family's standard, the
-- student answers a short check-in and the AI drafts a step-by-step plan.
-- Plans are saved so the student and parent can tick steps off and check back.

create table if not exists rescue_plans (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  course      text not null check (length(trim(course)) between 1 and 120),
  grade       text not null check (grade in ('A', 'B', 'C', 'D', 'F')),
  answers     jsonb not null default '{}'::jsonb,
  plan        jsonb not null,
  done_steps  int[] not null default '{}',
  status      text not null default 'active' check (status in ('active', 'done')),
  check_back  date,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists rescue_plans_student on rescue_plans (student_id, created_at);

alter table rescue_plans enable row level security;
drop policy if exists rescue_parent on rescue_plans;
drop policy if exists rescue_self_read on rescue_plans;
drop policy if exists rescue_self_insert on rescue_plans;
create policy rescue_parent on rescue_plans for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy rescue_self_read on rescue_plans for select using (is_student_self(student_id));
create policy rescue_self_insert on rescue_plans for insert with check (student_may(student_id, 'ai_chat'));
grant select, insert, delete on rescue_plans to authenticated;

drop trigger if exists audit_rescue_plans on rescue_plans;
create trigger audit_rescue_plans after insert or update or delete on rescue_plans
  for each row execute function audit_row_change();

-- Ticking steps off or closing a plan: the student or a parent.
create or replace function set_rescue_progress(p_plan uuid, p_done_steps int[], p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  select student_id into s from rescue_plans where id = p_plan;
  if s is null or not (can_parent_see_student(s) or is_student_self(s)) then
    raise exception 'not allowed';
  end if;
  update rescue_plans set done_steps = coalesce(p_done_steps, '{}'), status = p_status where id = p_plan;
end $$;

revoke all on function set_rescue_progress(uuid, int[], text) from public;
grant execute on function set_rescue_progress(uuid, int[], text) to authenticated;
