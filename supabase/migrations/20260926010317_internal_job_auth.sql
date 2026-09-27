-- A dedicated 256-bit invocation token, separate from the Supabase service
-- role key. The token is generated inside Postgres and never enters SQL source.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'snapshotx_job_token') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'snapshotx_job_token',
      'Server-only push webhook and media cleanup invocation token'
    );
  end if;
end $$;

-- Service-role Edge Functions may retrieve only these named secrets. The RPC
-- is in the exposed schema solely because PostgREST must reach it; EXECUTE is
-- revoked from PUBLIC, anon, and authenticated in the same migration.
create function public.sx_internal_job_token() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'snapshotx_job_token'
$$;
revoke all on function public.sx_internal_job_token() from public, anon, authenticated;
grant execute on function public.sx_internal_job_token() to service_role;

create function public.sx_internal_push_token() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'snapshotx_expo_access_token'
$$;
revoke all on function public.sx_internal_push_token() from public, anon, authenticated;
grant execute on function public.sx_internal_push_token() to service_role;
