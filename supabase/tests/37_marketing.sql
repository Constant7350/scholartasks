\set ON_ERROR_STOP on
\o /dev/null
-- Only the ScholarTasks team can read or change the marketing plan's progress.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000037a1', false);
do $$ begin
  begin
    perform save_marketing_step('beta-families', 'done', 'x');
    raise exception 'FAIL: non-team saved a marketing step';
  exception when raise_exception then
    if sqlerrm not like 'This is for the ScholarTasks team%' then raise; end if;
  end;
  begin
    perform marketing_numbers();
    raise exception 'FAIL: non-team read marketing numbers';
  exception when raise_exception then
    if sqlerrm not like 'This is for the ScholarTasks team%' then raise; end if;
  end;
  if (select count(*) from marketing_steps) <> 0 then raise exception 'FAIL: non-team can see steps'; end if;
end $$;
reset role;

insert into app_admins (user_id) values ('00000000-0000-0000-0000-0000000037b1');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000037b1', false);
select save_marketing_step('beta-families', 'doing', '  ');
select save_marketing_step('beta-families', 'done', 'Invited 30 families');
do $$ begin
  if (select status || '|' || note from marketing_steps where step_id = 'beta-families') <> 'done|Invited 30 families'
    then raise exception 'FAIL: step not saved'; end if;
  if (marketing_numbers() ->> 'families') is null then raise exception 'FAIL: no numbers'; end if;
  begin
    perform save_marketing_step('beta-families', 'maybe', null);
    raise exception 'FAIL: bad status accepted';
  exception when check_violation then null; end;
end $$;
reset role;
\o
\echo MARKETING PLAN CHECKS PASSED
