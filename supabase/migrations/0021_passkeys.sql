-- Face ID / fingerprint sign-in (passkeys).
--
-- A passkey is a key pair made by the phone or computer. The private half
-- never leaves the device and is unlocked with Face ID, Touch ID, a
-- fingerprint or the device PIN. We keep only the public half, so a copy of
-- this table can't be used to sign in. Only the server (secret key) adds
-- passkeys or records a sign-in; people can see and remove their own.

create table if not exists passkeys (
  id            text primary key,                    -- credential id (base64url)
  user_id       uuid not null references auth.users(id) on delete cascade,
  public_key    text not null,                       -- base64url COSE public key
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_name   text not null default 'This device' check (length(device_name) <= 80),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists passkeys_user on passkeys (user_id);

-- One-time challenges for adding a passkey or signing in. Each is used once
-- (the server deletes it as it checks it) and expires after five minutes.
create table if not exists passkey_challenges (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('register', 'login')),
  challenge   text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '5 minutes'
);
create index if not exists passkey_challenges_expires on passkey_challenges (expires_at);

alter table passkeys           enable row level security;
alter table passkey_challenges enable row level security;

drop policy if exists passkeys_own_read on passkeys;
create policy passkeys_own_read on passkeys for select using (user_id = auth.uid());
drop policy if exists passkeys_own_delete on passkeys;
create policy passkeys_own_delete on passkeys for delete using (user_id = auth.uid());

revoke all on passkeys, passkey_challenges from anon, authenticated;
grant select, delete on passkeys to authenticated;
grant select, insert, update, delete on passkeys, passkey_challenges to service_role;

-- Adding, using and removing a passkey goes in the audit trail.
drop trigger if exists passkeys_audit on passkeys;
create trigger passkeys_audit after insert or update or delete on passkeys
  for each row execute function audit_row_change();
