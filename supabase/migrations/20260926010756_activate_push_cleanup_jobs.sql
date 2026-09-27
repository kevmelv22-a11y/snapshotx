-- pg_net-backed webhook, configured in SQL so its header reads Vault at call
-- time. Only metadata reaches the Edge Function; no chat text or media path.
create function app_private.sx_enqueue_message_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://udantesxduijzhhunadv.supabase.co/functions/v1/push-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-snapshotx-job-key',
      (select decrypted_secret from vault.decrypted_secrets
       where name = 'snapshotx_job_token')
    ),
    body := jsonb_build_object(
      'type', 'INSERT', 'schema', 'public', 'table', 'sx_messages',
      'record', jsonb_build_object(
        'id', new.id, 'thread_id', new.thread_id,
        'sender_id', new.sender_id, 'kind', new.kind
      )
    ),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- A push queue failure must not prevent the underlying chat message.
  raise warning 'SnapShot X push enqueue failed: %', SQLERRM;
  return new;
end $$;
revoke all on function app_private.sx_enqueue_message_push()
  from public, anon, authenticated;
create trigger sx_message_push_webhook
after insert on public.sx_messages for each row
execute function app_private.sx_enqueue_message_push();

-- The command stores only the Vault secret name. Cron reads the token when
-- each job runs; no service-role key or token is embedded in cron.job.
select cron.schedule('snapshotx-media-cleanup', '*/30 * * * *', $job$
  select net.http_post(
    url := 'https://udantesxduijzhhunadv.supabase.co/functions/v1/cleanup-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-snapshotx-job-key',
      (select decrypted_secret from vault.decrypted_secrets
       where name = 'snapshotx_job_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
