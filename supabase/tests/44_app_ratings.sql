\set ON_ERROR_STOP on
\o /dev/null
-- Rate ScholarTasks: one rating per person, only through rate_app(); people see only their own, the team sees all.
insert into auth.users values ('00000000-0000-0000-0000-0000000044a1', 'rater1@example.com'),
                              ('00000000-0000-0000-0000-0000000044a2', 'rater2@example.com');
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000044b1');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000044a1', false);
select rate_app(3, '  Hard to find the menu ', 'ios');
select rate_app(5, 'Love it', 'ios');
do $$ begin
  assert (select count(*) from app_ratings) = 1, 'rating again replaces the first one';
  assert (select stars || '|' || note || '|' || platform from app_ratings) = '5|Love it|ios', 'rating saved';
  begin
    perform rate_app(6, null, 'web');
    raise exception 'FAIL: 6 stars accepted';
  exception when raise_exception then
    if sqlerrm not like 'Pick 1 to 5%' then raise; end if;
  end;
  begin
    insert into app_ratings (user_id, stars) values ('00000000-0000-0000-0000-0000000044a2', 1);
    raise exception 'FAIL: wrote a rating for someone else';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000044a2', false);
select rate_app(4, '', 'something-else');
do $$ begin
  assert (select count(*) from app_ratings) = 1, 'people see only their own rating';
  assert (select note is null and platform = 'web' from app_ratings), 'blank note saved as none, unknown platform as web';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000044b1', false);
do $$ begin
  assert (select count(*) from app_ratings) = 2, 'the team sees every rating';
end $$;
reset role;

-- Deleting the login deletes the rating.
delete from auth.users where id = '00000000-0000-0000-0000-0000000044a1';
do $$ begin
  assert (select count(*) from app_ratings) = 1, 'rating removed with the account';
end $$;
\o
\echo APP RATING CHECKS PASSED
