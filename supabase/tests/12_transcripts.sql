\set ON_ERROR_STOP on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
create temp table g (k text primary key, v text);
insert into g values ('family', create_family('The Okafors')::text);
insert into g values ('student', add_student((select v::uuid from g where k='family'), 'Ada', '2009-01-01', 11, 'GA')::text);
insert into g values ('other', add_student((select v::uuid from g where k='family'), 'Ben', '2011-01-01', 9, 'GA')::text);
insert into g values ('code', create_student_invite((select v::uuid from g where k='student')));

do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  perform set_student_school(s, '  North Atlanta High  ', 2027);
  assert (select high_school from students where id = s) = 'North Atlanta High', 'school trimmed and saved';
  assert (select grad_year from students where id = s) = 2027, 'grad year saved';
  -- Parent uploads a file and records it.
  insert into storage.objects (bucket_id, name) values ('transcripts', s || '/one.pdf');
  insert into transcript_files (student_id, storage_path, file_name, mime_type, size_bytes) values (s, s || '/one.pdf', 'Transcript.pdf', 'application/pdf', 1000);
  assert (select count(*) from transcript_files where student_id = s) = 1, 'parent sees the file';
  assert exists (select 1 from audit_log where target = 'transcript_files'), 'upload is audited';
  -- The file must sit in that student's folder.
  begin
    insert into transcript_files (student_id, storage_path, file_name, mime_type, size_bytes) values (s, (select v from g where k='other') || '/x.pdf', 'x.pdf', 'application/pdf', 10);
    raise exception 'FAIL: path in another folder accepted';
  exception when check_violation then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('transcripts', 'not-a-student/one.pdf');
    raise exception 'FAIL: upload outside a student folder';
  exception when insufficient_privilege then null; end;
end $$;

-- The student (grade entry on by default) can see, upload and delete their own files.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', false);
do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  perform accept_student_invite((select v from g where k='code'));
  assert (select count(*) from transcript_files) = 1, 'student sees own file';
  assert (select count(*) from storage.objects where bucket_id = 'transcripts') = 1, 'student sees own stored file';
  insert into storage.objects (bucket_id, name) values ('transcripts', s || '/two.pdf');
  insert into transcript_files (student_id, storage_path, file_name, mime_type, size_bytes) values (s, s || '/two.pdf', 'Report card.pdf', 'application/pdf', 500);
  begin
    insert into storage.objects (bucket_id, name) values ('transcripts', (select v from g where k='other') || '/sneak.pdf');
    raise exception 'FAIL: student uploaded to a sibling folder';
  exception when insufficient_privilege then null; end;
  delete from transcript_files where storage_path = s || '/two.pdf';
  delete from storage.objects where name = s || '/two.pdf';
  assert (select count(*) from transcript_files) = 1, 'student deleted own upload';
end $$;

-- With grade entry off, the student can still view but not upload.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_student_permission((select v::uuid from g where k='student'), 'enter_grades', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', false);
do $$
declare s uuid := (select v::uuid from g where k='student');
begin
  assert (select count(*) from transcript_files) = 1, 'view-only student still sees files';
  begin
    insert into storage.objects (bucket_id, name) values ('transcripts', s || '/three.pdf');
    raise exception 'FAIL: view-only student uploaded';
  exception when insufficient_privilege then null; end;
  begin
    perform set_student_school(s, 'Elsewhere', 2027);
    raise exception 'FAIL: view-only student changed school';
  exception when raise_exception then if sqlerrm <> 'not allowed' then raise; end if; end;
  delete from transcript_files;
  assert (select count(*) from transcript_files) = 1, 'view-only student could not delete';
end $$;

-- A stranger sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d9', false);
do $$ begin
  assert (select count(*) from transcript_files) = 0, 'stranger sees no rows';
  assert (select count(*) from storage.objects where bucket_id = 'transcripts') = 0, 'stranger sees no files';
end $$;
\o
\echo TRANSCRIPT CHECKS PASSED
