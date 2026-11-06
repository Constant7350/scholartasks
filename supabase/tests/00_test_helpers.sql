\set ON_ERROR_STOP on
-- Test only: a fresh consent signature for the current user (the website saves real ones
-- after Face ID or an email code; see migration 0055).
create or replace function public.test_sign(p_kind text, p_student uuid default null, p_target text default null) returns void
language plpgsql security definer as $$
begin
  insert into consent_signatures (user_id, kind, target_id, student_id, signed_name, signature, wording, verified_by)
  values (auth.uid(), p_kind, p_target, p_student, 'Test Parent', 'data:image/png;base64,' || repeat('A', 300), 'Test consent wording', 'email_code');
end $$;
grant execute on function public.test_sign(text, uuid, text) to public;
grant execute on function public.test_sign(text, uuid, text) to authenticated;
\echo TEST HELPERS READY
