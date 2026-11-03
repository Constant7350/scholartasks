-- Let families try the counselor before adding a student. With no student
-- chosen, a signed-in person who isn't on a student account can ask general
-- questions (Georgia for now). Students always chat about their own record,
-- so their parent's "AI chat" setting still applies.

create or replace function may_chat_about(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and case
    when p_student is null then not exists (select 1 from family_members m where m.user_id = auth.uid() and m.role = 'student')
    else can_parent_see_student(p_student) or student_may(p_student, 'ai_chat')
  end;
$$;

create or replace function chat_state(p_student uuid) returns char(2)
language sql stable security definer set search_path = public as $$
  select coalesce((select state from students where id = p_student), 'GA');
$$;

create or replace function ai_take_turn(p_student uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
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

create or replace function answer_bank_lookup(p_student uuid, p_question text)
returns table (id uuid, question text, answer text)
language plpgsql security definer set search_path = public, extensions as $$
declare st char(2);
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  st := chat_state(p_student);
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

create or replace function answer_bank_submit(p_student uuid, p_question text, p_answer text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare st char(2);
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  if not exists (select 1 from ai_usage where user_id = auth.uid() and day = (now() at time zone 'America/New_York')::date) then
    raise exception 'not allowed';
  end if;
  if (select count(*) from answer_bank where submitted_by = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    return;
  end if;
  st := chat_state(p_student);
  if exists (select 1 from answer_bank where state = st and status <> 'rejected'
             and similarity(lower(question), lower(p_question)) >= 0.6) then
    return;
  end if;
  insert into answer_bank (state, question, answer, submitted_by) values (st, p_question, p_answer, auth.uid());
end $$;

revoke all on function may_chat_about(uuid) from public;
revoke all on function chat_state(uuid) from public;
grant execute on function may_chat_about(uuid) to authenticated;
grant execute on function chat_state(uuid) to authenticated;
