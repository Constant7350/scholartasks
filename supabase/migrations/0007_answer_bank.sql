-- Answer bank: general counselor answers (nothing about any one family) that
-- ScholarTasks staff review once and then reuse, so common questions are
-- answered instantly without paying for another AI call.

create extension if not exists pg_trgm schema extensions;

create table app_admins (
  user_id  uuid primary key,
  added_at timestamptz not null default now()
);
alter table app_admins enable row level security;
create policy app_admins_self_read on app_admins for select using (user_id = auth.uid());
grant select on app_admins to authenticated;

create or replace function is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;
grant execute on function is_app_admin() to authenticated;

create table answer_bank (
  id           uuid primary key default gen_random_uuid(),
  state        char(2) not null,
  question     text not null check (length(question) between 5 and 500),
  answer       text not null check (length(answer) between 20 and 6000),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  hits         int  not null default 0,
  submitted_by uuid,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index answer_bank_question_trgm on answer_bank using gin (lower(question) extensions.gin_trgm_ops);
alter table answer_bank enable row level security;
-- Only staff read and review the bank directly; families reach it through the functions below.
create policy answer_bank_admin on answer_bank for all using (is_app_admin()) with check (is_app_admin());
grant select, update, delete on answer_bank to authenticated;

-- Best approved answer for a question, if one is close enough. Same access
-- rule as the counselor itself.
create or replace function answer_bank_lookup(p_student uuid, p_question text)
returns table (id uuid, question text, answer text)
language plpgsql security definer set search_path = public, extensions as $$
declare st char(2);
begin
  if auth.uid() is null or not (can_parent_see_student(p_student) or student_may(p_student, 'ai_chat')) then
    raise exception 'not allowed';
  end if;
  select s.state into st from students s where s.id = p_student;
  return query
    update answer_bank b set hits = b.hits + 1
    where b.id = (
      select a.id from answer_bank a
      where a.status = 'approved' and a.state = st
        and similarity(lower(a.question), lower(p_question)) >= 0.6
      order by similarity(lower(a.question), lower(p_question)) desc, a.hits desc
      limit 1)
    returning b.id, b.question, b.answer;
end $$;

-- Suggest a general answer for review. Only people who used the counselor
-- today can suggest, at most 10 a day each, so the queue can't be flooded.
create or replace function answer_bank_submit(p_student uuid, p_question text, p_answer text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare st char(2);
begin
  if auth.uid() is null or not (can_parent_see_student(p_student) or student_may(p_student, 'ai_chat')) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from ai_usage where user_id = auth.uid() and day = (now() at time zone 'America/New_York')::date) then
    raise exception 'not allowed';
  end if;
  if (select count(*) from answer_bank where submitted_by = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    return;
  end if;
  select s.state into st from students s where s.id = p_student;
  -- Skip near-duplicates of anything already in the bank.
  if exists (select 1 from answer_bank where state = st and status <> 'rejected'
             and similarity(lower(question), lower(p_question)) >= 0.6) then
    return;
  end if;
  insert into answer_bank (state, question, answer, submitted_by) values (st, p_question, p_answer, auth.uid());
end $$;

revoke all on function answer_bank_lookup(uuid, text) from public;
revoke all on function answer_bank_submit(uuid, text, text) from public;
grant execute on function answer_bank_lookup(uuid, text) to authenticated;
grant execute on function answer_bank_submit(uuid, text, text) to authenticated;
