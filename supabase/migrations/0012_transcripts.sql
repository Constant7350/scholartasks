-- School transcripts: the family keeps copies of the school's report cards and
-- transcripts here (private files, one folder per student), and fills in the
-- school details that go on the self-reported academic record.

alter table students
  add column if not exists high_school text check (length(trim(high_school)) between 1 and 120),
  add column if not exists grad_year int check (grad_year between 2020 and 2045);

create or replace function set_student_school(p_student uuid, p_high_school text, p_grad_year int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (can_parent_see_student(p_student) or student_may(p_student, 'enter_grades')) then
    raise exception 'not allowed';
  end if;
  update students set high_school = nullif(trim(p_high_school), ''), grad_year = p_grad_year where id = p_student;
end $$;

revoke all on function set_student_school(uuid, text, int) from public;
grant execute on function set_student_school(uuid, text, int) to authenticated;

-- One row per uploaded file. The file itself lives in the private
-- "transcripts" storage bucket at <student id>/<file>.
create table if not exists transcript_files (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null check (length(trim(file_name)) between 1 and 200),
  mime_type    text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  size_bytes   int  not null check (size_bytes between 1 and 10485760),
  label        text check (length(label) <= 80),
  uploaded_by  uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = student_id::text)
);
create index if not exists transcript_files_student on transcript_files (student_id, created_at);

alter table transcript_files enable row level security;
drop policy if exists transcripts_parent on transcript_files;
drop policy if exists transcripts_self_read on transcript_files;
drop policy if exists transcripts_self_insert on transcript_files;
drop policy if exists transcripts_self_delete on transcript_files;
create policy transcripts_parent on transcript_files for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy transcripts_self_read on transcript_files for select using (is_student_self(student_id));
create policy transcripts_self_insert on transcript_files for insert with check (student_may(student_id, 'enter_grades'));
create policy transcripts_self_delete on transcript_files for delete using (student_may(student_id, 'enter_grades'));
grant select, insert, delete on transcript_files to authenticated;

drop trigger if exists audit_transcript_files on transcript_files;
create trigger audit_transcript_files after insert or update or delete on transcript_files
  for each row execute function audit_row_change();

-- The student a storage path belongs to, or null if the folder isn't a student id.
create or replace function transcript_path_student(p_name text) returns uuid
language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;
grant execute on function transcript_path_student(text) to authenticated;

-- Private bucket: 10 MB per file, PDFs and photos only. Files are opened with
-- short-lived signed links, never public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transcripts', 'transcripts', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists transcripts_read on storage.objects;
drop policy if exists transcripts_upload on storage.objects;
drop policy if exists transcripts_remove on storage.objects;
create policy transcripts_read on storage.objects for select to authenticated
  using (bucket_id = 'transcripts' and (public.can_parent_see_student(public.transcript_path_student(name))
                                        or public.is_student_self(public.transcript_path_student(name))));
create policy transcripts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'transcripts' and (public.can_parent_see_student(public.transcript_path_student(name))
                                             or public.student_may(public.transcript_path_student(name), 'enter_grades')));
create policy transcripts_remove on storage.objects for delete to authenticated
  using (bucket_id = 'transcripts' and (public.can_parent_see_student(public.transcript_path_student(name))
                                        or public.student_may(public.transcript_path_student(name), 'enter_grades')));
