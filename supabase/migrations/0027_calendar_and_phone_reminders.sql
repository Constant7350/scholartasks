-- Calendar feed: a private link a person adds once to Google Calendar, Apple
-- Calendar or Outlook, which then shows every college deadline and to-do date
-- and keeps itself up to date. The link holds a long random token (calendar
-- apps can't sign in); anyone with it can read the dates, so the person can
-- make a new link any time, which turns the old one off.

create table if not exists calendar_feeds (
  user_id     uuid primary key default auth.uid(),
  token       text not null unique default left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 48),
  created_at  timestamptz not null default now()
);
alter table calendar_feeds enable row level security;
drop policy if exists calendar_feeds_self on calendar_feeds;
create policy calendar_feeds_self on calendar_feeds for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- People read or delete their own link; new links are made only by my_calendar_token().
grant select, delete on calendar_feeds to authenticated;

-- Get (or make) my feed link's token.
create or replace function my_calendar_token(p_new boolean default false) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  if p_new then delete from calendar_feeds where user_id = auth.uid(); end if;
  insert into calendar_feeds (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into t from calendar_feeds where user_id = auth.uid();
  return t;
end $$;
revoke all on function my_calendar_token(boolean) from public;
grant execute on function my_calendar_token(boolean) to authenticated;

-- Every open dated item for the students this feed's owner may see: parents
-- (unless an adult student turned parent access off) and the student
-- themselves. Called only by the server with the secret key.
create or replace function calendar_items(p_token text)
returns table (item_type text, item_id uuid, student_first_name text, title text, due_on date, url text, done boolean)
language sql stable security definer set search_path = public as $$
  with me as (select user_id from calendar_feeds where token = p_token and length(p_token) >= 32),
  kids as (
    select s.id, s.first_name from students s
      join family_members m on m.family_id = s.family_id
      join me on me.user_id = m.user_id
     where (m.role = 'parent' and coalesce(s.adult_consents_parent_access, true))
        or (m.role = 'student' and m.student_id = s.id)
  )
  select 'task', t.id, k.first_name, t.title, t.due_on, t.url, t.status = 'done'
    from tasks t join kids k on k.id = t.student_id
   where t.due_on is not null and t.status <> 'dismissed' and t.due_on >= current_date - 60
  union all
  select 'college', c.id, k.first_name, c.name || ' application (' || c.plan || ')', c.deadline, null,
         c.status not in ('considering', 'applying')
    from student_colleges c join kids k on k.id = c.student_id
   where c.deadline is not null and c.approved and c.status <> 'withdrawn' and c.deadline >= current_date - 60;
$$;
revoke all on function calendar_items(text) from public, anon, authenticated;
grant execute on function calendar_items(text) to service_role;
