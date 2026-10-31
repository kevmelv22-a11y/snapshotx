-- Snapchat "Naam bewerken": give a friend your own name for them. Only YOU see it (chat list, chat header,
-- friendship profile); the friend never does. One row per (owner, friend); deleted with either account.
create table if not exists public.sx_friend_nicknames (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint sx_friend_nicknames_not_self check (owner_id <> friend_id),
  constraint sx_friend_nicknames_len check (char_length(btrim(nickname)) between 1 and 32 and nickname = btrim(nickname)),
  constraint sx_friend_nicknames_chars check (nickname !~ '[[:cntrl:]]')
);

alter table public.sx_friend_nicknames enable row level security;
revoke all on table public.sx_friend_nicknames from public, anon;
grant select, insert, update, delete on table public.sx_friend_nicknames to authenticated;

-- Own rows only; a nickname can only be set for someone who is (still) your friend.
drop policy if exists sx_friend_nicknames_read on public.sx_friend_nicknames;
create policy sx_friend_nicknames_read on public.sx_friend_nicknames for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sx_friend_nicknames_insert on public.sx_friend_nicknames;
create policy sx_friend_nicknames_insert on public.sx_friend_nicknames for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.sx_friends f where f.user_id = (select auth.uid()) and f.friend_id = sx_friend_nicknames.friend_id));
drop policy if exists sx_friend_nicknames_update on public.sx_friend_nicknames;
create policy sx_friend_nicknames_update on public.sx_friend_nicknames for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.sx_friends f where f.user_id = (select auth.uid()) and f.friend_id = sx_friend_nicknames.friend_id));
drop policy if exists sx_friend_nicknames_delete on public.sx_friend_nicknames;
create policy sx_friend_nicknames_delete on public.sx_friend_nicknames for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Same word filter as usernames / display names / group names (20261031030000_server_name_filter.sql).
create or replace function app_private.sx_friend_nickname_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  new.updated_at := now();
  if to_regprocedure('app_private.sx_name_violation(text)') is null then return new; end if;
  v := app_private.sx_name_violation(new.nickname);
  if v is not null then raise exception 'name_not_allowed:%', v using errcode = '22023', hint = 'nickname'; end if;
  return new;
end $$;
revoke all on function app_private.sx_friend_nickname_guard() from public, anon, authenticated;
drop trigger if exists sx_friend_nickname_guard on public.sx_friend_nicknames;
create trigger sx_friend_nickname_guard before insert or update of nickname on public.sx_friend_nicknames
  for each row execute function app_private.sx_friend_nickname_guard();

-- Banned accounts are locked out like every other user table.
do $$
begin
  if to_regprocedure('app_private.sx_request_is_banned()') is not null then
    execute 'drop policy if exists sx_active_ban_guard on public.sx_friend_nicknames';
    execute 'create policy sx_active_ban_guard on public.sx_friend_nicknames as restrictive for all to authenticated '
      || 'using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned())';
  end if;
end $$;
