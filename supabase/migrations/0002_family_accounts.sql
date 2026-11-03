-- Parent-owned family accounts: sign-up, adding children, invite codes for
-- the student app, and parent-controlled permissions. All writes go through
-- these functions so the rules live in one place and every change is audited.

-- The app is for ages 13 and up (no accounts for under-13s).
create or replace function students_min_age() returns trigger language plpgsql as $$
begin
  if age(current_date, new.birth_date) < interval '13 years' then
    raise exception 'students must be at least 13 years old';
  end if;
  return new;
end $$;
create trigger students_min_age before insert or update of birth_date on students
  for each row execute function students_min_age();

create table family_invites (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  code         text not null unique,
  created_by   uuid not null,
  expires_at   timestamptz not null,
  accepted_by  uuid,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
alter table family_invites enable row level security;
create policy invites_parent_read on family_invites for select using (is_parent_of_family(family_id));

create trigger audit_family_invites after insert or update or delete on family_invites
  for each row execute function audit_row_change();

-- Permission keys a parent may change. Keep in sync with PERMISSIONS in packages/core.
create or replace function permission_keys() returns text[] language sql immutable as $$
  select array['enter_grades','ai_chat','see_income_and_costs','mark_done_without_approval','change_plan_without_approval']
$$;

create or replace function create_family(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'family name is required'; end if;
  insert into families (name) values (trim(p_name)) returning id into fid;
  insert into family_members (family_id, user_id, role) values (fid, auth.uid(), 'parent');
  return fid;
end $$;

create or replace function add_student(p_family uuid, p_first_name text, p_birth_date date, p_grade_level int, p_state char(2))
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not is_parent_of_family(p_family) then raise exception 'not allowed'; end if;
  insert into students (family_id, first_name, birth_date, grade_level, state)
  values (p_family, trim(p_first_name), p_birth_date, p_grade_level, upper(p_state)) returning id into sid;
  return sid;
end $$;

-- Returns a one-time 8-character code the child types into the student app. Valid 7 days.
create or replace function create_student_invite(p_student uuid) returns text
language plpgsql security definer set search_path = public as $$
declare fid uuid; c text;
begin
  select family_id into fid from students where id = p_student;
  if fid is null or not is_parent_of_family(fid) then raise exception 'not allowed'; end if;
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
  if exists (select 1 from family_members where family_id = inv.family_id and user_id = auth.uid()) then
    raise exception 'this account is already in the family';
  end if;
  insert into family_members (family_id, user_id, role, student_id) values (inv.family_id, auth.uid(), 'student', inv.student_id);
  update family_invites set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.student_id;
end $$;

create or replace function set_student_permission(p_student uuid, p_key text, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_parent_see_student(p_student) then raise exception 'not allowed'; end if;
  if not (p_key = any (permission_keys())) then raise exception 'unknown permission %', p_key; end if;
  update students set permissions = permissions || jsonb_build_object(p_key, p_value) where id = p_student;
end $$;
