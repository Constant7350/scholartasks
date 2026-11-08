-- Practice competitions (Constant, 2026-11-08): a challenge can now be a timed practice-question
-- competition in one class instead of an essay. Our team announces it (class, grades, dates,
-- gift card prizes), it is open to every student in those grades (free accounts too), and the
-- app scores it, so nobody has to grade:
--   * every student gets the same fresh set of questions (AI writes them, a second AI pass
--     checks every answer key, our team approves), shown only once the student starts
--   * harder questions count more (Strong 3, Advanced 4, Expert 5 points)
--   * ties go to the student who finished faster
--   * answers and the answer key stay hidden until the competition closes
--   * winners are never named in public; prizes use the same gift card pick-up as the essays

alter table challenges add column if not exists kind text not null default 'essay';
do $$ begin
  alter table challenges add constraint challenges_kind check (kind in ('essay', 'practice'));
exception when duplicate_object then null; end $$;
alter table challenges add column if not exists time_minutes int not null default 30;
do $$ begin
  alter table challenges add constraint challenges_time check (time_minutes between 5 and 120);
exception when duplicate_object then null; end $$;

alter table challenge_entries add column if not exists started_at timestamptz;
alter table challenge_entries add column if not exists finished_at timestamptz;
alter table challenge_entries add column if not exists answered int not null default 0;
alter table challenge_entries add column if not exists correct int not null default 0;
alter table challenge_entries add column if not exists points int not null default 0;

-- The question set. Team only: students get questions (never the key) through the functions below.
create table if not exists challenge_questions (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  n             int not null,
  topic         text not null check (length(trim(topic)) between 2 and 60),
  level         smallint not null default 4 check (level between 3 and 5),
  question      text not null check (length(trim(question)) between 5 and 1000),
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer_index  int not null check (answer_index between 0 and 3),
  explanation   text check (explanation is null or length(explanation) <= 1000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  unique (challenge_id, n)
);
alter table challenge_questions enable row level security;
drop policy if exists challenge_questions_team on challenge_questions;
create policy challenge_questions_team on challenge_questions for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on challenge_questions to authenticated;

-- Each answer, team only (so a student can't read their running score mid-competition).
create table if not exists challenge_answers (
  entry_id     uuid not null references challenge_entries(id) on delete cascade,
  n            int not null,
  choice       int not null check (choice between 0 and 3),
  correct      boolean not null,
  points       int not null,
  answered_at  timestamptz not null default now(),
  primary key (entry_id, n)
);
alter table challenge_answers enable row level security;
drop policy if exists challenge_answers_team on challenge_answers;
create policy challenge_answers_team on challenge_answers for select to authenticated using (is_app_admin());
grant select on challenge_answers to authenticated;

-- The entry guard from 0057, now also keeping the competition columns server-only.
create or replace function challenge_entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c challenges; st students; rpc boolean := coalesce(current_setting('st.challenge_rpc', true), '') = 'on';
        team boolean := is_app_admin(); grow int; secs numeric;
begin
  select * into c from challenges where id = new.challenge_id;
  if tg_op = 'INSERT' then
    select * into st from students where id = new.student_id;
    if c.id is null or c.status <> 'open' or now() < c.opens_at or now() > c.closes_at then raise exception 'This challenge isn''t open for entries right now.'; end if;
    if st.grade_level not between c.grade_min and c.grade_max then
      raise exception 'This challenge is for grades % to %.', c.grade_min, c.grade_max;
    end if;
    new.status := 'draft'; new.result := null; new.place := null; new.certificate_code := null; new.claimed_at := null;
    new.submitted_at := null; new.active_seconds := 0; new.writing_days := 0; new.saves := 0; new.big_jumps := 0;
    new.paste_blocked := 0; new.coach_checks := 0; new.body := coalesce(new.body, '');
    new.started_at := null; new.finished_at := null; new.answered := 0; new.correct := 0; new.points := 0;
    if c.kind = 'practice' then new.body := ''; end if;
    if length(new.body) > 400 then raise exception 'Type your essay here in the app. Pasting isn''t allowed in the challenge.'; end if;
    new.team_family := challenge_is_team_family(new.student_id);
    new.words := challenge_word_count(new.body);
    return new;
  end if;

  -- UPDATE
  new.id := old.id; new.challenge_id := old.challenge_id; new.student_id := old.student_id;
  new.created_at := old.created_at; new.team_family := old.team_family;
  if not rpc then
    -- Status, results, certificates and competition scores only change through the functions.
    new.status := old.status; new.submitted_at := old.submitted_at; new.result := old.result;
    new.place := old.place; new.certificate_code := old.certificate_code; new.claimed_at := old.claimed_at;
    new.coach_checks := old.coach_checks;
    new.started_at := old.started_at; new.finished_at := old.finished_at;
    new.answered := old.answered; new.correct := old.correct; new.points := old.points;
    if c.kind = 'practice' then new.body := old.body; end if;
  end if;
  if old.status <> 'draft' and not rpc then
    if new.body is distinct from old.body or new.title is distinct from old.title or new.ideas is distinct from old.ideas
       or new.outline is distinct from old.outline or new.checklist is distinct from old.checklist then
      raise exception 'This essay was already sent in, so it can''t be changed.';
    end if;
    new.active_seconds := old.active_seconds; new.paste_blocked := old.paste_blocked;
  elsif not rpc and old.status = 'draft' then
    if new.body is distinct from old.body and (c.status <> 'open' or now() > c.closes_at) then
      raise exception 'This challenge has closed, so the essay can''t be changed now.';
    end if;
    secs := extract(epoch from now() - old.updated_at);
    new.active_seconds := least(greatest(new.active_seconds, old.active_seconds), old.active_seconds + ceil(secs)::int + 5);
    new.paste_blocked := greatest(new.paste_blocked, old.paste_blocked);
    if new.body is distinct from old.body then
      grow := length(new.body) - length(old.body);
      if grow > 2000 then raise exception 'Type your essay here in the app. Pasting isn''t allowed in the challenge.'; end if;
      if grow > 300 then new.big_jumps := old.big_jumps + 1; else new.big_jumps := old.big_jumps; end if;
      new.saves := old.saves + 1;
      if old.last_wrote_on is distinct from (now() at time zone 'America/New_York')::date then
        new.writing_days := old.writing_days + 1;
        new.last_wrote_on := (now() at time zone 'America/New_York')::date;
      else
        new.writing_days := old.writing_days; new.last_wrote_on := old.last_wrote_on;
      end if;
    else
      new.big_jumps := old.big_jumps; new.saves := old.saves; new.writing_days := old.writing_days; new.last_wrote_on := old.last_wrote_on;
    end if;
  end if;
  if not team and not rpc then
    new.big_jumps := greatest(new.big_jumps, old.big_jumps);
  end if;
  new.words := challenge_word_count(new.body);
  new.updated_at := now();
  return new;
end $$;

-- Finishes a started competition entry: totals the answers, gives it a certificate code.
create or replace function challenge_practice_close_entry(p_entry uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; c challenges; code text;
begin
  select * into e from challenge_entries where id = p_entry for update;
  if e.status <> 'draft' then return e.certificate_code; end if;
  select * into c from challenges where id = e.challenge_id;
  loop
    code := challenge_new_code();
    exit when not exists (select 1 from challenge_entries where certificate_code = code);
  end loop;
  perform set_config('st.challenge_rpc', 'on', true);
  update challenge_entries set status = 'submitted', submitted_at = now(), result = 'finisher', certificate_code = code,
         finished_at = least(now(), e.started_at + make_interval(mins => c.time_minutes)),
         answered = (select count(*) from challenge_answers a where a.entry_id = p_entry),
         correct = (select count(*) filter (where a.correct) from challenge_answers a where a.entry_id = p_entry),
         points = (select coalesce(sum(a.points), 0) from challenge_answers a where a.entry_id = p_entry)
   where id = p_entry;
  perform set_config('st.challenge_rpc', 'off', true);
  return code;
end $$;
revoke all on function challenge_practice_close_entry(uuid) from public, anon, authenticated;

-- The student starts (or comes back to) the competition: returns the questions, never the key.
create or replace function challenge_practice_start(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; c challenges; ends timestamptz;
begin
  select * into e from challenge_entries where id = p_entry for update;
  if not found or not is_student_self(e.student_id) then raise exception 'Only the student can take this competition, from their own login.'; end if;
  select * into c from challenges where id = e.challenge_id;
  if c.kind <> 'practice' then raise exception 'That isn''t a practice competition.'; end if;
  if e.status <> 'draft' then raise exception 'You already finished this competition.'; end if;
  if c.status <> 'open' or now() > c.closes_at then raise exception 'This competition has closed.'; end if;
  if not exists (select 1 from challenge_permissions where challenge_id = e.challenge_id and student_id = e.student_id) then
    raise exception 'A parent or guardian needs to sign permission first.';
  end if;
  if not exists (select 1 from challenge_questions where challenge_id = c.id and status = 'approved') then
    raise exception 'The questions aren''t ready yet. Please check back soon.';
  end if;
  if e.started_at is null then
    perform set_config('st.challenge_rpc', 'on', true);
    update challenge_entries set started_at = now() where id = p_entry returning * into e;
    perform set_config('st.challenge_rpc', 'off', true);
  end if;
  ends := e.started_at + make_interval(mins => c.time_minutes);
  if now() > ends then
    perform challenge_practice_close_entry(p_entry);
    raise exception 'Time is up, so your answers were sent in.';
  end if;
  return jsonb_build_object('ends_at', ends, 'questions', coalesce((
    select jsonb_agg(jsonb_build_object('n', q.n, 'topic', q.topic, 'level', q.level, 'question', q.question, 'options', q.options,
                                        'picked', (select a.choice from challenge_answers a where a.entry_id = p_entry and a.n = q.n)) order by q.n)
      from challenge_questions q where q.challenge_id = c.id and q.status = 'approved'), '[]'::jsonb));
end $$;
revoke all on function challenge_practice_start(uuid) from public, anon;
grant execute on function challenge_practice_start(uuid) to authenticated;

-- One answer per question, only while the student's time runs. Right or wrong stays hidden.
create or replace function challenge_practice_answer(p_entry uuid, p_n int, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; c challenges; q challenge_questions; ok boolean;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not is_student_self(e.student_id) then raise exception 'Only the student can answer.'; end if;
  select * into c from challenges where id = e.challenge_id;
  if e.status <> 'draft' or e.started_at is null then raise exception 'This competition isn''t running for you.'; end if;
  if c.status <> 'open' or now() > c.closes_at or now() > e.started_at + make_interval(mins => c.time_minutes) + interval '15 seconds' then
    raise exception 'Time is up.';
  end if;
  select * into q from challenge_questions where challenge_id = c.id and n = p_n and status = 'approved';
  if not found then raise exception 'That question wasn''t found.'; end if;
  if p_choice not between 0 and 3 then raise exception 'Pick one of the answers.'; end if;
  ok := p_choice = q.answer_index;
  insert into challenge_answers (entry_id, n, choice, correct, points) values (p_entry, p_n, p_choice, ok, case when ok then q.level else 0 end)
  on conflict (entry_id, n) do nothing;
end $$;
revoke all on function challenge_practice_answer(uuid, int, int) from public, anon;
grant execute on function challenge_practice_answer(uuid, int, int) to authenticated;

-- The student finishes (or the timer runs out). Returns the certificate code.
create or replace function challenge_practice_finish(p_entry uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e challenge_entries; code text;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not is_student_self(e.student_id) then raise exception 'Only the student can finish.'; end if;
  if e.started_at is null then raise exception 'Start the competition first.'; end if;
  code := challenge_practice_close_entry(p_entry);
  insert into audit_log (actor_id, family_id, student_id, action, target, target_id, details)
  values (auth.uid(), (select family_id from students where id = e.student_id), e.student_id, 'challenge_submitted', 'challenge_entries', p_entry::text,
          jsonb_build_object('challenge_id', e.challenge_id, 'kind', 'practice'));
  return code;
end $$;
revoke all on function challenge_practice_finish(uuid) from public, anon;
grant execute on function challenge_practice_finish(uuid) to authenticated;

-- After the competition closes: the student's answers next to the key, to learn from.
create or replace function challenge_practice_review(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare e challenge_entries; c challenges;
begin
  select * into e from challenge_entries where id = p_entry;
  if not found or not (is_student_self(e.student_id) or can_parent_see_student(e.student_id)) then return null; end if;
  select * into c from challenges where id = e.challenge_id;
  if c.status = 'open' and now() <= c.closes_at then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('n', q.n, 'topic', q.topic, 'level', q.level, 'question', q.question, 'options', q.options,
                                        'answer_index', q.answer_index, 'explanation', q.explanation, 'picked', a.choice) order by q.n)
      from challenge_questions q left join challenge_answers a on a.entry_id = p_entry and a.n = q.n
     where q.challenge_id = c.id and q.status = 'approved'), '[]'::jsonb);
end $$;
revoke all on function challenge_practice_review(uuid) from public, anon;
grant execute on function challenge_practice_review(uuid) to authenticated;

-- Team: the standings, best first (points, then the faster finish). Names are for contacting
-- families only; winners are never named in public.
create or replace function challenge_practice_results(p_challenge uuid) returns table (
  entry_id uuid, rank int, first_name text, grade_level int, state text, parent_emails text, team_family boolean,
  points int, correct int, answered int, seconds int, result text, place int, certificate_code text
) language plpgsql security definer set search_path = public stable as $$
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  return query
    select e.id, (row_number() over (order by e.points desc, (e.finished_at - e.started_at), e.finished_at, e.id))::int,
           s.first_name, s.grade_level, s.state::text,
           (select string_agg(u.email::text, ', ') from family_members m join auth.users u on u.id = m.user_id
             where m.family_id = s.family_id and m.role = 'parent'),
           e.team_family, e.points, e.correct, e.answered,
           extract(epoch from e.finished_at - e.started_at)::int, e.result, e.place, e.certificate_code
      from challenge_entries e join students s on s.id = e.student_id
     where e.challenge_id = p_challenge and e.status = 'submitted'
     order by 2;
end $$;
revoke all on function challenge_practice_results(uuid) from public, anon;
grant execute on function challenge_practice_results(uuid) to authenticated;

-- Team: after it closes, finish anyone still mid-way, then mark the top students as winners
-- (one per prize, team families skipped) and everyone else as finishers.
create or replace function challenge_practice_award(p_challenge uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c challenges; r record; won int := 0; winners int;
begin
  if not is_app_admin() then raise exception 'This is for the ScholarTasks team.'; end if;
  select * into c from challenges where id = p_challenge;
  if c.kind <> 'practice' then raise exception 'That isn''t a practice competition.'; end if;
  if c.status = 'open' and now() <= c.closes_at then raise exception 'Close the competition first.'; end if;
  for r in select id from challenge_entries where challenge_id = p_challenge and status = 'draft' and started_at is not null loop
    perform challenge_practice_close_entry(r.id);
  end loop;
  winners := (select count(*) from jsonb_array_elements(c.prizes) p where (p ->> 'place')::int >= 1);
  perform set_config('st.challenge_rpc', 'on', true);
  for r in select e.id, e.team_family, e.answered from challenge_entries e
            where e.challenge_id = p_challenge and e.status = 'submitted'
            order by e.points desc, (e.finished_at - e.started_at), e.finished_at, e.id loop
    if not r.team_family and r.answered > 0 and won < winners then
      won := won + 1;
      update challenge_entries set result = 'winner', place = won where id = r.id;
    else
      update challenge_entries set result = 'finisher', place = null where id = r.id;
    end if;
  end loop;
  perform set_config('st.challenge_rpc', 'off', true);
  insert into audit_log (actor_id, action, target, target_id, details)
  values (auth.uid(), 'challenge_awarded', 'challenges', p_challenge::text, jsonb_build_object('winners', won));
  return won;
end $$;
revoke all on function challenge_practice_award(uuid) from public, anon;
grant execute on function challenge_practice_award(uuid) to authenticated;

-- Competition winners are never named in public, whatever was ticked.
create or replace function challenge_permissions_private() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select kind from challenges where id = new.challenge_id) = 'practice' then new.public_name_ok := false; end if;
  return new;
end $$;
drop trigger if exists challenge_permissions_private on challenge_permissions;
create trigger challenge_permissions_private before insert or update on challenge_permissions
  for each row execute function challenge_permissions_private();
