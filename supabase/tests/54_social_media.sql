\set ON_ERROR_STOP on
\o /dev/null
-- Only the ScholarTasks team can see or change social media drafts, people and settings,
-- and a student under 18 can't be in a scheduled or posted video without a parent's permission.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000054a1', false);
do $$ begin
  if (select count(*) from social_settings) <> 0 then raise exception 'FAIL: non-team can see social settings'; end if;
  begin
    insert into social_items (kind, network, week_of, title) values ('post', 'facebook', current_date, 'x');
    raise exception 'FAIL: non-team added a post';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000054b1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000054b1', false);
do $$
declare kid uuid; adult uuid; v uuid;
begin
  if (select videos_per_week from social_settings) <> 3 then raise exception 'FAIL: no default settings'; end if;
  insert into social_people (name) values ('Student A') returning id into kid;
  insert into social_people (name, is_minor) values ('Team member', false) returning id into adult;
  insert into social_items (kind, network, week_of, title, body, person_id) values ('video', 'tiktok', current_date, 'HOPE vs Zell', 'script', kid) returning id into v;
  update social_items set status = 'filmed' where id = v;
  begin
    update social_items set status = 'posted' where id = v;
    raise exception 'FAIL: posted a minor without permission';
  exception when raise_exception then
    if sqlerrm not like 'A parent''s permission must be on file%' then raise; end if;
  end;
  begin
    update social_people set consent_on = current_date where id = kid;
    raise exception 'FAIL: permission saved without a parent name';
  exception when check_violation then null; end;
  update social_people set consent_on = current_date, parent_name = 'Parent A' where id = kid;
  update social_items set status = 'posted', post_url = 'https://www.tiktok.com/@x/video/1' where id = v;
  if (select posted_at from social_items where id = v) is null then raise exception 'FAIL: posted time not set'; end if;
  update social_items set status = 'filmed' where id = v;
  if (select posted_at from social_items where id = v) is not null then raise exception 'FAIL: posted time kept'; end if;
  -- Adults don't need a parent's permission.
  update social_items set person_id = adult, status = 'scheduled' where id = v;
  begin
    update social_items set post_url = 'javascript:alert(1)' where id = v;
    raise exception 'FAIL: bad link accepted';
  exception when check_violation then null; end;
  begin
    update social_settings set networks = array['myspace'];
    raise exception 'FAIL: unknown network accepted';
  exception when check_violation then null; end;
end $$;
reset role;
\o
\echo SOCIAL MEDIA CHECKS PASSED
