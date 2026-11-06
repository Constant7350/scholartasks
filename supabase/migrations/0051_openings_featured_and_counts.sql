-- Local openings, part 2: "Featured" listings and simple counts for companies.
-- Featured: our team can show a listing first in its state until a date (free for now;
-- it is what companies would pay for later). Featured listings carry a "Featured" label.
-- Counts: how many times students opened a listing's details and pressed Apply. Numbers
-- only: nothing about who looked is stored.

alter table local_openings add column if not exists featured_until date;
alter table local_openings add column if not exists views int not null default 0;
alter table local_openings add column if not exists apply_clicks int not null default 0;

create or replace view public_openings as
  select id, kind, title, trade_slug, company_name, company_website, city, state, zip, min_age, pay, schedule,
         description, requirements, how_to_apply, apply_url, registered_apprenticeship, registered_verified,
         show_until, approved_at,
         coalesce(featured_until >= (now() at time zone 'America/New_York')::date, false) as featured
  from local_openings
  where status = 'approved' and show_until >= (now() at time zone 'America/New_York')::date;
grant select on public_openings to anon, authenticated;

-- A student opened a listing's details ('view') or pressed Apply ('apply'). Live listings only.
create or replace function count_opening(p_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'view' then
    update local_openings set views = views + 1 where id = p_id and status = 'approved';
  elsif p_kind = 'apply' then
    update local_openings set apply_clicks = apply_clicks + 1 where id = p_id and status = 'approved';
  end if;
end $$;
revoke all on function count_opening(uuid, text) from public;
grant execute on function count_opening(uuid, text) to anon, authenticated;
