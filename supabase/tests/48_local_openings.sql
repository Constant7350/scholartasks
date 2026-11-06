\set ON_ERROR_STOP on
\o /dev/null
-- Local openings: companies submit without an account, only the team sees pending listings and
-- private contact details, everyone sees approved ones, three reports hide a listing.
insert into auth.users values ('00000000-0000-0000-0000-0000000046a1', 'student46@example.com');
insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000046b1');

set role anon;
select submit_opening(jsonb_build_object(
  'kind', 'apprenticeship', 'title', 'Electrical apprentice', 'trade_slug', 'electrician', 'company_name', 'Peach State Electric',
  'contact_name', 'Dana', 'contact_email', ' Dana@Example.com ', 'contact_phone', '478-555-0100', 'city', 'Macon', 'state', 'ga', 'min_age', 18,
  'description', 'Learn residential wiring on the job with a licensed electrician.', 'how_to_apply', 'Email jobs@example.com',
  'registered_apprenticeship', true, 'rapids_number', '2024-GA-1', 'show_until', '2099-01-01'));
do $$ begin
  assert (select count(*) from public_openings) = 0, 'pending listings stay hidden';
  begin
    perform 1 from local_openings;
    raise exception 'FAIL: anon read the listings table';
  exception when insufficient_privilege then null; end;
  begin
    insert into local_openings (kind, title, company_name, contact_name, contact_email, city, state, min_age, description, how_to_apply, show_until)
    values ('job', 'Sneaky', 'X', 'X', 'x@x.com', 'X', 'GA', 18, repeat('x', 40), 'x', current_date + 5);
    raise exception 'FAIL: anon inserted straight into the table';
  exception when insufficient_privilege then null; end;
end $$;
-- Five a day per email.
select submit_opening(jsonb_build_object('kind', 'job', 'title', 'Shop helper ' || g, 'company_name', 'Peach State Electric', 'contact_name', 'Dana',
  'contact_email', 'dana@example.com', 'city', 'Macon', 'state', 'GA', 'min_age', 16, 'description', repeat('Helping in the shop. ', 3), 'how_to_apply', 'Call us'))
from generate_series(1, 4) g;
do $$ begin
  begin
    perform submit_opening(jsonb_build_object('kind', 'job', 'title', 'One too many', 'company_name', 'P', 'contact_name', 'D',
      'contact_email', 'DANA@example.com', 'city', 'Macon', 'state', 'GA', 'min_age', 18, 'description', repeat('x', 40), 'how_to_apply', 'Call'));
    raise exception 'FAIL: sixth listing in a day accepted';
  exception when raise_exception then
    if sqlerrm not like 'too many%' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  assert (select show_until from local_openings where title = 'Electrical apprentice') = current_date + 180, 'show until is capped at 180 days';
  assert (select contact_email || state from local_openings where title = 'Electrical apprentice') = 'dana@example.comGA', 'email and state cleaned';
end $$;

-- A student can't approve; the team can.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000046a1', false);
update local_openings set status = 'approved';
do $$ begin
  assert (select count(*) from public_openings) = 0, 'students cannot approve';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000046b1', false);
do $$ begin
  assert (select count(*) from local_openings) = 5, 'the team sees every listing';
end $$;
update local_openings set status = 'approved', approved_at = now(), registered_verified = true where title = 'Electrical apprentice';

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public_openings) = 1, 'approved listing shows to everyone';
  assert (select registered_verified from public_openings), 'verified badge shows';
end $$;
-- The public view has no private contact columns.
do $$ begin
  assert not exists (select 1 from information_schema.columns where table_name = 'public_openings' and column_name in ('contact_email', 'contact_phone', 'contact_name', 'review_note')),
    'private contact details stay private';
end $$;

-- Reports: three hide the listing.
select report_opening((select id from public_openings), 'Asked me to pay a fee');
select report_opening((select id from public_openings), 'Same here');
do $$ begin
  assert (select count(*) from public_openings) = 1, 'two reports keep it up';
  begin
    perform report_opening((select id from public_openings), ' ');
    raise exception 'FAIL: empty report accepted';
  exception when raise_exception then
    if sqlerrm not like 'Please say%' then raise; end if;
  end;
end $$;
select report_opening((select id from public_openings), 'Third report');
do $$ begin
  assert (select count(*) from public_openings) = 0, 'three reports hide it';
  begin
    perform 1 from opening_reports;
    raise exception 'FAIL: anon read reports';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Ended listings drop off.
update local_openings set status = 'approved', show_until = current_date - 1 where title = 'Electrical apprentice';
do $$ begin
  assert (select count(*) from public_openings) = 0, 'ended listings are hidden';
  assert (select count(*) from opening_reports) = 3, 'reports kept for the team';
end $$;
\o
\echo LOCAL OPENINGS CHECKS PASSED
