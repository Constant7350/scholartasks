-- Grades 6 and 7: parents can add students aged 10 to 12 in grades 6 to 8 as
-- parent-managed profiles. Until the student turns 13 there is no student
-- sign-in (no join code) and no AI, so ScholarTasks never collects
-- information from a child under 13 (COPPA). Students 13 and older are unchanged.

create or replace function is_under_13(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select age(current_date, birth_date) < interval '13 years' from students where id = p_student), false);
$$;
grant execute on function is_under_13(uuid) to authenticated;

create or replace function students_min_age() returns trigger language plpgsql as $$
begin
  if age(current_date, new.birth_date) < interval '13 years' then
    if age(current_date, new.birth_date) < interval '10 years' or new.grade_level > 8 then
      raise exception 'students must be at least 13 years old, or 10 to 12 in grades 6 to 8';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists students_min_age on students;
create trigger students_min_age before insert or update of birth_date, grade_level on students
  for each row execute function students_min_age();

create or replace function create_student_invite(p_student uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare fid uuid; c text;
begin
  select family_id into fid from students where id = p_student;
  if fid is null or not is_parent_of_family(fid) then raise exception 'not allowed'; end if;
  if is_under_13(p_student) then
    raise exception 'under 13: students get their own sign-in when they turn 13';
  end if;
  if exists (select 1 from family_members where student_id = p_student) then
    raise exception 'this student already has an app account';
  end if;
  -- Unambiguous alphabet: no 0/O or 1/I/L.
  c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
        from (select gen_random_bytes(8) as b) r, generate_series(0, 7) as i);
  update family_invites set expires_at = now() where student_id = p_student and accepted_at is null and expires_at > now();
  insert into family_invites (family_id, student_id, code, created_by, expires_at)
  values (fid, p_student, c, auth.uid(), now() + interval '7 days');
  return c;
end $$;

create or replace function accept_student_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv family_invites;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into inv from family_invites
   where code = upper(trim(p_code)) and accepted_at is null and expires_at > now()
   for update;
  if inv.id is null then raise exception 'invite code is invalid or expired'; end if;
  if is_under_13(inv.student_id) then raise exception 'under 13: students get their own sign-in when they turn 13'; end if;
  if exists (select 1 from family_members where family_id = inv.family_id and user_id = auth.uid()) then
    raise exception 'this account is already in the family';
  end if;
  insert into family_members (family_id, user_id, role, student_id) values (inv.family_id, auth.uid(), 'student', inv.student_id);
  update family_invites set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.student_id;
end $$;

-- No AI for students under 13 (parents included, so nothing about the child goes to an AI service).
create or replace function ai_take_turn(p_student uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int; fid uuid;
begin
  if not exists (select 1 from user_settings where user_id = auth.uid() and ai_consent_at is not null) then
    raise exception 'ai consent needed';
  end if;
  if p_student is not null and is_under_13(p_student) then raise exception 'not allowed: under 13'; end if;
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  insert into ai_usage (user_id, day, messages)
    values (auth.uid(), (now() at time zone 'America/New_York')::date, 1)
    on conflict (user_id, day) do update set messages = ai_usage.messages + 1
    returning messages into used;
  if used > p_limit then
    update ai_usage set messages = messages - 1
      where user_id = auth.uid() and day = (now() at time zone 'America/New_York')::date;
    fid := ai_family_for(p_student);
    if fid is null then return false; end if;
    update ai_credits set balance = balance - 1, updated_at = now()
      where family_id = fid and balance > 0;
    return found;
  end if;
  return true;
end $$;
