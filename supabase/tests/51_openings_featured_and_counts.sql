\set ON_ERROR_STOP on
\o /dev/null
-- Featured listings and counts: everyone sees the Featured flag, counts only move on live listings.
insert into local_openings (id, kind, title, company_name, contact_name, contact_email, city, state, min_age, description, how_to_apply, show_until, status)
values ('00000000-0000-0000-0000-0000000051a1', 'job', 'Live one', 'A Co', 'A', 'a@example.com', 'Macon', 'GA', 18, repeat('Real work here. ', 3), 'Call', current_date + 30, 'approved'),
       ('00000000-0000-0000-0000-0000000051a2', 'job', 'Waiting one', 'B Co', 'B', 'b@example.com', 'Macon', 'GA', 18, repeat('Real work here. ', 3), 'Call', current_date + 30, 'pending');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select not featured from public_openings where title = 'Live one'), 'not featured by default';
end $$;
select count_opening('00000000-0000-0000-0000-0000000051a1', 'view');
select count_opening('00000000-0000-0000-0000-0000000051a1', 'view');
select count_opening('00000000-0000-0000-0000-0000000051a1', 'apply');
select count_opening('00000000-0000-0000-0000-0000000051a2', 'view');
select count_opening('00000000-0000-0000-0000-0000000051a1', 'nonsense');
do $$ begin
  begin
    update local_openings set featured_until = current_date + 30;
    raise exception 'FAIL: anon featured a listing';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  assert (select views || '/' || apply_clicks from local_openings where title = 'Live one') = '2/1', 'counts saved';
  assert (select views from local_openings where title = 'Waiting one') = 0, 'pending listings are not counted';
end $$;

update local_openings set featured_until = current_date + 30 where title = 'Live one';
set role anon;
do $$ begin
  assert (select featured from public_openings where title = 'Live one'), 'featured shows';
  assert not exists (select 1 from information_schema.columns where table_name = 'public_openings' and column_name in ('views', 'apply_clicks', 'featured_until', 'contact_email')),
    'counts and private details stay with the team';
end $$;
reset role;
update local_openings set featured_until = current_date - 1 where title = 'Live one';
do $$ begin
  assert (select not featured from public_openings where title = 'Live one'), 'featured ends on its date';
end $$;
delete from local_openings where id in ('00000000-0000-0000-0000-0000000051a1', '00000000-0000-0000-0000-0000000051a2');
\o
\echo OPENINGS FEATURED AND COUNTS CHECKS PASSED
