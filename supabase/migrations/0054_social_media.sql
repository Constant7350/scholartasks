-- Social media for the ScholarTasks team (/admin/marketing, "Social media" tab).
-- One place for short videos (TikTok, Instagram Reels, YouTube Shorts) and written
-- posts (Facebook, Instagram, X, Threads, LinkedIn, Nextdoor): AI-written weekly
-- drafts, the team's edits, who is on camera, the finished video file, and where
-- and when it was posted. Team only (app_admins). Nothing here is about families.
--
-- People on camera: a student under 18 can only be in a video that is scheduled or
-- posted once a parent's permission is on file (parent name + date). Names are kept
-- for the team only and are never shown in posts unless show_name is turned on.

create table if not exists social_people (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 80),
  is_minor      boolean not null default true,
  parent_name   text check (parent_name is null or length(parent_name) <= 120),
  consent_on    date,
  consent_note  text check (consent_note is null or length(consent_note) <= 1000),
  show_name     boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint social_people_consent_whole check (consent_on is null or not is_minor or length(trim(coalesce(parent_name, ''))) > 0)
);

create table if not exists social_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('video', 'post')),
  network     text not null check (network in ('tiktok', 'reels', 'shorts', 'facebook', 'instagram', 'x', 'threads', 'linkedin', 'nextdoor')),
  week_of     date not null,
  topic       text check (topic is null or length(topic) <= 200),
  title       text not null check (length(title) between 1 and 200),
  hook        text check (hook is null or length(hook) <= 400),
  body        text not null default '' check (length(body) <= 8000),
  caption     text check (caption is null or length(caption) <= 2200),
  hashtags    text check (hashtags is null or length(hashtags) <= 500),
  shot_notes  text check (shot_notes is null or length(shot_notes) <= 2000),
  status      text not null default 'draft' check (status in ('draft', 'approved', 'filmed', 'scheduled', 'posted', 'skip')),
  person_id   uuid references social_people(id) on delete set null,
  video_path  text check (video_path is null or length(video_path) <= 300),
  video_link  text check (video_link is null or (video_link ~ '^https://[^\s]{4,}$' and length(video_link) <= 500)),
  post_on     date,
  post_url    text check (post_url is null or (post_url ~ '^https://[^\s]{4,}$' and length(post_url) <= 500)),
  posted_at   timestamptz,
  note        text check (note is null or length(note) <= 1000),
  ai_written  boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists social_items_week on social_items (week_of desc, kind);

-- Settings for the weekly writer (one row).
create table if not exists social_settings (
  id               int primary key default 1 check (id = 1),
  auto_weekly      boolean not null default true,
  videos_per_week  int not null default 3 check (videos_per_week between 0 and 5),
  networks         text[] not null default array['facebook', 'instagram', 'x', 'nextdoor']
                   check (networks <@ array['facebook', 'instagram', 'x', 'threads', 'linkedin', 'nextdoor']),
  host_note        text not null default 'A high school senior who is applying to college and for scholarships right now.'
                   check (length(host_note) <= 600),
  focus_note       text check (focus_note is null or length(focus_note) <= 600),
  updated_at       timestamptz not null default now()
);
insert into social_settings (id) values (1) on conflict (id) do nothing;

-- A minor can't be in a scheduled or posted video until a parent's permission is on file.
create or replace function social_items_guard() returns trigger
language plpgsql set search_path = public as $$
declare p social_people;
begin
  new.updated_at := now();
  if new.status = 'posted' and new.posted_at is null then new.posted_at := now(); end if;
  if new.status <> 'posted' then new.posted_at := null; end if;
  if new.kind = 'video' and new.status in ('scheduled', 'posted') and new.person_id is not null then
    select * into p from social_people where id = new.person_id;
    if p.is_minor and p.consent_on is null then
      raise exception 'A parent''s permission must be on file before a video with % is scheduled or posted.', p.name;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists social_items_guard on social_items;
create trigger social_items_guard before insert or update on social_items
  for each row execute function social_items_guard();

alter table social_people enable row level security;
alter table social_items enable row level security;
alter table social_settings enable row level security;
drop policy if exists social_people_team on social_people;
drop policy if exists social_items_team on social_items;
drop policy if exists social_settings_team on social_settings;
create policy social_people_team on social_people for all using (is_app_admin()) with check (is_app_admin());
create policy social_items_team on social_items for all using (is_app_admin()) with check (is_app_admin());
create policy social_settings_team on social_settings for all using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on social_people, social_items to authenticated;
grant select, update on social_settings to authenticated;

-- Private bucket for finished videos: 50 MB per file (the Supabase free-plan limit).
-- Bigger files can be kept as a Google Drive or Dropbox link instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-videos', 'social-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists social_videos_team on storage.objects;
create policy social_videos_team on storage.objects for all to authenticated
  using (bucket_id = 'social-videos' and public.is_app_admin())
  with check (bucket_id = 'social-videos' and public.is_app_admin());
