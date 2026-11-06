-- Groepsuitnodigingslink: snapshot-x.nl/g/<token> (7 dagen geldig, intrekbaar).
-- Any current member can create a link; anyone signed in can join via a valid token
-- unless blocked with the creator, already a member, or the group is full (max 20).

create table if not exists public.sx_group_invites (
  token text primary key,
  thread_id uuid not null references public.sx_threads(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz
);

create index if not exists sx_group_invites_thread_idx
  on public.sx_group_invites (thread_id) where revoked_at is null;

alter table public.sx_group_invites enable row level security;

-- Members may read their group's active invites (to show/copy the link again).
drop policy if exists sx_group_invites_member_read on public.sx_group_invites;
create policy sx_group_invites_member_read on public.sx_group_invites
  for select to authenticated
  using (
    revoked_at is null
    and expires_at > now()
    and exists (
      select 1 from public.sx_members m
      where m.thread_id = sx_group_invites.thread_id
        and m.user_id = (select auth.uid())
    )
  );

revoke all on public.sx_group_invites from public, anon;
grant select on public.sx_group_invites to authenticated;

create or replace function public.sx_create_group_invite(p_thread_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text;
  v_t public.sx_threads;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into v_t from public.sx_threads where id = p_thread_id for update;
  if not found then raise exception 'Not a member of this group'; end if;
  if not exists (select 1 from public.sx_members m where m.thread_id = p_thread_id and m.user_id = v_uid) then
    raise exception 'Not a member of this group';
  end if;
  if not (v_t.is_group or v_t.title is not null or (select count(*) from public.sx_members m where m.thread_id = p_thread_id) > 2) then
    raise exception 'Not a group chat';
  end if;

  -- Reuse an active invite created by me for this group (stable share link).
  select token into v_token from public.sx_group_invites
    where thread_id = p_thread_id and created_by = v_uid
      and revoked_at is null and expires_at > now()
    order by created_at desc limit 1;
  if v_token is not null then return v_token; end if;

  -- 32 hex chars without requiring pgcrypto (gen_random_uuid is built-in on PG13+/Supabase).
  v_token := left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 32);
  insert into public.sx_group_invites(token, thread_id, created_by)
  values (v_token, p_thread_id, v_uid);
  return v_token;
end;
$$;

revoke all on function public.sx_create_group_invite(uuid) from public, anon;
grant execute on function public.sx_create_group_invite(uuid) to authenticated;

create or replace function public.sx_revoke_group_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.sx_group_invites;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into v_inv from public.sx_group_invites where token = p_token for update;
  if not found then raise exception 'Invite not found'; end if;
  -- Creator or current group admin may revoke.
  if v_inv.created_by is distinct from v_uid
     and not exists (
       select 1 from public.sx_members m
       where m.thread_id = v_inv.thread_id and m.user_id = v_uid and m.role = 'admin'
     ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.sx_group_invites set revoked_at = now() where token = p_token and revoked_at is null;
end;
$$;

revoke all on function public.sx_revoke_group_invite(text) from public, anon;
grant execute on function public.sx_revoke_group_invite(text) to authenticated;

create or replace function public.sx_join_group_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.sx_group_invites;
  v_count integer;
  v_name text;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_token is null or length(btrim(p_token)) < 16 then raise exception 'Invite not found'; end if;

  select * into v_inv from public.sx_group_invites where token = btrim(p_token) for update;
  if not found or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'Invite expired or revoked';
  end if;

  if exists (select 1 from public.sx_members m where m.thread_id = v_inv.thread_id and m.user_id = v_uid) then
    return v_inv.thread_id;
  end if;

  if exists (
    select 1 from public.sx_blocks b
    where (b.blocker_id = v_uid and b.blocked_id = v_inv.created_by)
       or (b.blocker_id = v_inv.created_by and b.blocked_id = v_uid)
  ) then
    raise exception 'Interaction blocked';
  end if;

  select count(*) into v_count from public.sx_members where thread_id = v_inv.thread_id;
  if v_count >= 20 then raise exception 'Group is full'; end if;

  insert into public.sx_members(thread_id, user_id) values (v_inv.thread_id, v_uid)
  on conflict do nothing;

  select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Iemand')
    into v_name from public.profiles p where p.id = v_uid;
  insert into public.sx_messages(thread_id, sender_id, kind, body, media_path, expires_at)
  values (v_inv.thread_id, v_uid, 'system', left(coalesce(v_name, 'Iemand') || ' is via een uitnodigingslink lid geworden', 200), null, null);

  return v_inv.thread_id;
end;
$$;

revoke all on function public.sx_join_group_invite(text) from public, anon;
grant execute on function public.sx_join_group_invite(text) to authenticated;
