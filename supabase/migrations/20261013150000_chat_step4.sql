-- Step 4 (chat): per-chat retention, system messages (screenshot / retention change), message reactions.
-- NOT APPLIED to any project yet. Typing uses Realtime Broadcast (no schema). Streaks are computed client-side
-- from snap messages for now (see lib/chat-features.ts computeStreak); a server table + cron is a later step.

-- 1. Retention per thread.
alter table public.sx_threads
  add column if not exists retention_mode text not null default '24h'
  check (retention_mode in ('after_view','24h','keep'));
comment on column public.sx_threads.retention_mode is 'after_view = delete after all recipients viewed (+10 min grace); 24h = 24 h after viewed; keep = never.';

-- 2. System messages (no media, server/client generated lines like "X heeft een screenshot gemaakt").
alter table public.sx_messages drop constraint if exists sx_messages_kind_check;
alter table public.sx_messages add constraint sx_messages_kind_check
  check (kind in ('text','photo','video','voice','snap','system'));
alter table public.sx_messages add constraint sx_messages_system_no_media
  check (kind <> 'system' or (media_path is null and body is not null and length(body) <= 200));
alter table public.sx_messages add column if not exists duration_ms integer check (duration_ms is null or duration_ms between 0 and 60000);

-- 3. Viewing a message sets its expiry according to the thread setting (snaps keep their own sx_claim_snap logic).
create or replace function app_private.sx_apply_retention() returns trigger language plpgsql security definer set search_path = '' as $$
declare m record; mode text; pending int;
begin
  if new.opened_at is null then return new; end if;
  select msg.id, msg.thread_id, msg.sender_id, msg.kind into m from public.sx_messages msg where msg.id = new.message_id;
  if m.kind in ('snap','system') then return new; end if;
  select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id;
  if mode = 'keep' then
    update public.sx_messages set expires_at = null where id = m.id;
  elsif mode = '24h' then
    update public.sx_messages set expires_at = greatest(coalesce(expires_at, now()), new.opened_at + interval '24 hours') where id = m.id;
  else -- after_view: once every other member has opened it
    select count(*) into pending from public.sx_members mem
      where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
        and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null);
    if pending = 0 then update public.sx_messages set expires_at = now() + interval '10 minutes' where id = m.id; end if;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_apply_retention() from public, anon, authenticated;
drop trigger if exists sx_receipts_retention on public.sx_receipts;
create trigger sx_receipts_retention after insert or update of opened_at on public.sx_receipts
  for each row execute function app_private.sx_apply_retention();

-- 4. Change the setting (any member) + post a system line atomically.
create or replace function public.sx_set_retention(p_thread_id uuid, p_mode text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.sx_is_member(p_thread_id) then raise exception 'not a member'; end if;
  if p_mode not in ('after_view','24h','keep') then raise exception 'invalid mode'; end if;
  update public.sx_threads set retention_mode = p_mode where id = p_thread_id;
  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (p_thread_id, auth.uid(), 'system', left(coalesce(p_text, 'Verwijderinstelling gewijzigd'), 200), null);
end $$;
revoke all on function public.sx_set_retention(uuid, text, text) from public, anon;
grant execute on function public.sx_set_retention(uuid, text, text) to authenticated;

-- 5. Reactions: one emoji per user per message.
create table if not exists public.sx_reactions (
  message_id uuid not null references public.sx_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','😮','😢','🔥','👍','👎')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.sx_reactions enable row level security;
revoke all on public.sx_reactions from public, anon;
grant select, insert, update, delete on public.sx_reactions to authenticated;
create policy sx_reactions_read on public.sx_reactions for select to authenticated
  using (app_private.sx_is_member((select thread_id from public.sx_messages where id = message_id)));
create policy sx_reactions_write on public.sx_reactions for insert to authenticated
  with check (user_id = auth.uid() and app_private.sx_is_member((select thread_id from public.sx_messages where id = message_id)));
create policy sx_reactions_update on public.sx_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sx_reactions_delete on public.sx_reactions for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.sx_reactions;
