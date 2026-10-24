-- Step 9 (push): device metadata on the existing push token table (public.sx_push_tokens, schema.sql). NOT APPLIED.
create table if not exists public.sx_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null, updated_at timestamptz not null default now(), primary key(user_id,token)
);
alter table public.sx_push_tokens
  add column if not exists platform text check (platform in ('ios','android','web')),
  add column if not exists device_id text,
  add column if not exists created_at timestamptz not null default now();
alter table public.sx_push_tokens add constraint sx_push_tokens_format check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$') not valid;
-- A token belongs to one user at a time (device handed over / re-login).
create unique index if not exists sx_push_tokens_token_uniq on public.sx_push_tokens(token);
alter table public.sx_push_tokens enable row level security;
drop policy if exists sx_push_tokens_own on public.sx_push_tokens;
create policy sx_push_tokens_own on public.sx_push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Per-kind opt-out (snap, chat, screenshot, friend_request) + previews.
alter table public.sx_preferences
  add column if not exists push_kinds text[] not null default array['snap','chat','screenshot','friend_request'],
  add column if not exists push_previews boolean not null default false;
