-- Smarter answer reuse. The exact lookup only catches questions worded almost
-- the same way. These two functions let the counselor show a small, cheap
-- model the closest approved questions; if one asks the same thing, its
-- reviewed answer is served instead of paying for a full answer.

-- The approved questions most like this one (questions only, no answers).
create or replace function answer_bank_candidates(p_student uuid, p_question text, p_limit int default 25)
returns table (id uuid, question text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare st char(2);
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  st := chat_state(p_student);
  return query
    select a.id, a.question from answer_bank a
    where a.status = 'approved' and a.state = st
    order by greatest(similarity(lower(a.question), lower(p_question)),
                      word_similarity(lower(p_question), lower(a.question))) desc,
             a.hits desc
    limit least(greatest(p_limit, 1), 40);
end $$;

-- The answer for one approved question, counted as a use.
create or replace function answer_bank_take(p_student uuid, p_id uuid)
returns table (id uuid, question text, answer text)
language plpgsql security definer set search_path = public as $$
declare st char(2);
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  st := chat_state(p_student);
  return query
    update answer_bank b set hits = b.hits + 1
    where b.id = p_id and b.status = 'approved' and b.state = st
    returning b.id, b.question, b.answer;
end $$;

revoke all on function answer_bank_candidates(uuid, text, int) from public;
revoke all on function answer_bank_take(uuid, uuid) from public;
grant execute on function answer_bank_candidates(uuid, text, int) to authenticated;
grant execute on function answer_bank_take(uuid, uuid) to authenticated;
