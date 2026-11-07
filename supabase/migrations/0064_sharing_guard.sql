-- Sharing guard (Constant, 2026-11-07): keep a family account to one household without bothering
-- honest families. Nothing here blocks anyone automatically except the student ceiling, and the
-- team can lift that for a big family at no charge.
--   1. Up to 6 students per family account (families.student_limit; the team can raise it).
--   2. A light sign-in record for parents and students 13 and older: a random device id, a one-way
--      hash of the network address (never the address itself) and the day. Kept 90 days. No
--      location. Students under 13 have no sign-in of their own, so nothing is kept for them.
--   3. A team-only view of accounts with many students, or with students whose devices were never
--      on the same network as a parent's device. A person looks before anything is said to a family.

alter table families add column if not exists student_limit int not null default 6 check (student_limit between 1 and 30);

create or replace function students_family_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  select student_limit into lim from families where id = new.family_id for update;
  select count(*) into n from students where family_id = new.family_id;
  if n >= coalesce(lim, 6) then
    raise exception 'family student limit reached (%)', coalesce(lim, 6);
  end if;
  return new;
end $$;
drop trigger if exists students_family_limit on students;
create trigger students_family_limit before insert on students for each row execute function students_family_limit();

create table if not exists signin_seen (
  user_id    uuid not null,
  family_id  uuid not null references families (id) on delete cascade,
  role       text not null check (role in ('parent', 'student')),
  student_id uuid references students (id) on delete cascade,
  device_id  text not null check (length(device_id) between 8 and 64),
  net_hash   text not null check (length(net_hash) between 8 and 64),
  day        date not null default current_date,
  primary key (user_id, device_id, net_hash, day)
);
create index if not exists signin_seen_family on signin_seen (family_id, day);
alter table signin_seen enable row level security;
-- Nobody reads or writes it from the app; only the server (service role) and the team functions below.
revoke all on signin_seen from anon, authenticated;
grant select, insert, delete on signin_seen to service_role;

-- Drops sign-in records older than 90 days. Run weekly by the server.
create or replace function prune_signin_seen() returns int language sql security definer set search_path = public as $$
  with d as (delete from signin_seen where day < current_date - 90 returning 1) select count(*)::int from d;
$$;
revoke all on function prune_signin_seen() from public, anon, authenticated;
grant execute on function prune_signin_seen() to service_role;

-- Team only: accounts worth a look. "apart" = students who signed in during the last 90 days on
-- networks where no parent of the family ever signed in.
create or replace function family_account_flags()
returns table (family_id uuid, family_name text, students int, student_limit int, students_signed_in int, apart int, last_seen date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  return query
  with kids as (select s.family_id, count(*)::int as n from students s group by s.family_id),
  seen as (select * from signin_seen where day >= current_date - 90),
  parent_nets as (select distinct x.family_id, x.net_hash from seen x where x.role = 'parent'),
  student_users as (select distinct x.family_id, x.student_id from seen x where x.role = 'student'),
  apart as (
    select su.family_id, count(*)::int as n from student_users su
     where not exists (select 1 from seen x join parent_nets p on p.family_id = x.family_id and p.net_hash = x.net_hash
                        where x.family_id = su.family_id and x.student_id = su.student_id)
     group by su.family_id
  )
  select f.id, f.name, coalesce(k.n, 0), f.student_limit,
         (select count(*)::int from student_users su where su.family_id = f.id),
         coalesce(a.n, 0),
         (select max(x.day) from seen x where x.family_id = f.id)
    from families f
    left join kids k on k.family_id = f.id
    left join apart a on a.family_id = f.id
   where coalesce(k.n, 0) >= 5 or coalesce(a.n, 0) > 0
   order by coalesce(a.n, 0) desc, coalesce(k.n, 0) desc;
end $$;
revoke all on function family_account_flags() from public, anon;
grant execute on function family_account_flags() to authenticated;

-- Team only: raise (or lower) a family's student ceiling, e.g. for a big family that emailed us.
create or replace function set_family_student_limit(p_family uuid, p_limit int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  update families set student_limit = p_limit where id = p_family;
end $$;
revoke all on function set_family_student_limit(uuid, int) from public, anon;
grant execute on function set_family_student_limit(uuid, int) to authenticated;
