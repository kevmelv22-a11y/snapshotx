-- Step 9 (disappear): scheduled row cleanup mirroring lib/backend/disappear.ts. NOT APPLIED / NOT SCHEDULED.
-- Storage objects are removed afterwards by the existing cleanup-media edge function (unreferenced paths).
alter table public.sx_messages add column if not exists timer_s integer check (timer_s between 1 and 10);
alter table public.sx_messages add column if not exists saved boolean not null default false;

create or replace function app_private.sx_disappear_cleanup(p_now timestamptz default now())
returns table(kind text, deleted integer) language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  -- Viewed snaps: all recipients opened + timer (x2 if replayed) elapsed.
  delete from public.sx_messages m where m.kind = 'snap' and not m.saved
    and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.opened_at is null)
    and exists (select 1 from public.sx_receipts r where r.message_id = m.id)
    and (select max(r.opened_at + make_interval(secs => coalesce(m.timer_s,10) * (1 + r.replay_count))) from public.sx_receipts r where r.message_id = m.id) <= p_now;
  get diagnostics n = row_count; kind := 'snap_viewed'; deleted := n; return next;
  -- Unopened snaps: 30 days.
  delete from public.sx_messages m where m.kind = 'snap' and not m.saved and m.created_at + interval '30 days' <= p_now;
  get diagnostics n = row_count; kind := 'snap_unopened_30d'; deleted := n; return next;
  -- Stories: 24 h (expires_at default).
  delete from public.sx_stories s where s.expires_at <= p_now;
  get diagnostics n = row_count; kind := 'story_24h'; deleted := n; return next;
  -- Chat messages: expires_at set by sx_apply_retention trigger (20261013150000_chat_step4.sql).
  delete from public.sx_messages m where m.kind <> 'snap' and not m.saved and m.expires_at is not null and m.expires_at <= p_now;
  get diagnostics n = row_count; kind := 'chat_retention'; deleted := n; return next;
end $$;
revoke all on function app_private.sx_disappear_cleanup(timestamptz) from public, anon, authenticated;

-- To schedule (manually, after review):
-- select cron.schedule('sx-disappear-cleanup', '*/5 * * * *', $$select * from app_private.sx_disappear_cleanup()$$);
