-- The AI scholarship finder: new awards it finds on official sites are saved
-- as status 'found'. Families never see them. The AI checker (weekly, or
-- "Check all now" on /admin/scholarships) reads each official page; confirmed
-- awards become 'approved', anything unclear waits for a person.
alter table scholarships drop constraint if exists scholarships_status_check;
alter table scholarships add constraint scholarships_status_check check (status in ('pending', 'approved', 'retired', 'found'));

-- Where the finder found it, so the team can see the source.
alter table scholarships add column if not exists found_from text check (found_from is null or length(found_from) <= 300);

-- Same rule as before (school-only awards stay with that school), and 'found' stays with the team.
drop policy if exists scholarships_read on scholarships;
create policy scholarships_read on scholarships for select to authenticated using (
  is_app_admin()
  or (status in ('pending', 'approved') and (school_id is null
       or school_id in (select my_linked_school_ids())
       or is_school_staff(school_id)))
);
