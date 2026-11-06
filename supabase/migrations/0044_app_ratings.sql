-- "Rate ScholarTasks" (/rate): each person gives 1 to 5 stars and an optional note.
-- One rating per person (rating again replaces it), so the average is fair.
-- People see only their own rating; the ScholarTasks team sees all of them on /admin/ratings.
-- Deleting an account deletes its rating (on delete cascade).

create table if not exists app_ratings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  note        text check (note is null or char_length(note) <= 2000),
  platform    text not null default 'web' check (platform in ('web', 'ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table app_ratings enable row level security;
drop policy if exists app_ratings_own on app_ratings;
create policy app_ratings_own on app_ratings for select using (user_id = auth.uid() or is_app_admin());
grant select on app_ratings to authenticated;
-- Saving goes through rate_app() only, so nobody can write someone else's rating.

create or replace function rate_app(p_stars int, p_note text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'Pick 1 to 5 stars.'; end if;
  insert into app_ratings (user_id, stars, note, platform)
  values (auth.uid(), p_stars, nullif(left(trim(coalesce(p_note, '')), 2000), ''),
          case when p_platform in ('ios', 'android') then p_platform else 'web' end)
  on conflict (user_id) do update
    set stars = excluded.stars, note = excluded.note, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function rate_app(int, text, text) from public, anon;
grant execute on function rate_app(int, text, text) to authenticated;
