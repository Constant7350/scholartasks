-- AI counselor: a per-person daily message allowance, so a runaway tab or a
-- shared login can't run up the AI bill. The chat itself is not stored.

create table ai_usage (
  user_id   uuid not null,
  day       date not null,
  messages  int  not null default 0,
  primary key (user_id, day)
);
alter table ai_usage enable row level security;
create policy ai_usage_self_read on ai_usage for select using (user_id = auth.uid());
grant select on ai_usage to authenticated;

-- Called by the server before each AI reply. Checks that the caller may chat
-- about this student (a parent who can see them, or the student with the
-- "AI chat" permission), then counts the message. Returns false when today's
-- allowance is used up.
create or replace function ai_take_turn(p_student uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if auth.uid() is null or not (can_parent_see_student(p_student) or student_may(p_student, 'ai_chat')) then
    raise exception 'not allowed';
  end if;
  insert into ai_usage (user_id, day, messages)
    values (auth.uid(), (now() at time zone 'America/New_York')::date, 1)
    on conflict (user_id, day) do update set messages = ai_usage.messages + 1
    returning messages into used;
  if used > p_limit then
    update ai_usage set messages = messages - 1
      where user_id = auth.uid() and day = (now() at time zone 'America/New_York')::date;
    return false;
  end if;
  return true;
end $$;

revoke all on function ai_take_turn(uuid, int) from public;
grant execute on function ai_take_turn(uuid, int) to authenticated;
