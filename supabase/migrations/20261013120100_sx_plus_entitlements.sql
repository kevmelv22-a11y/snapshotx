-- Snapshot X+ entitlements. NOT APPLIED. Review before running against any project.
-- Server-side validation: rows are written ONLY by a service-role Edge Function that verifies
-- App Store Server Notifications v2 (signed JWS) / Google Play RTDN + purchases.subscriptionsv2.get,
-- or by audited staff grants. Clients may read their own rows; they can never insert/update/delete.
create table if not exists public.sx_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('plus')),
  source text not null check (source in ('app_store','play','promo','staff')),
  product_id text,
  store_txn_id text,
  status text not null check (status in ('active','grace','expired','revoked','refunded')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  grace_until timestamptz,
  will_renew boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (source, store_txn_id)
);
create index if not exists sx_entitlements_user_idx on public.sx_entitlements(user_id);

create table if not exists public.sx_purchase_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  event_type text not null,
  store_txn_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- Per-user X+ perk preferences (cosmetic; gated at read time by sx_has_tier).
create table if not exists public.sx_plus_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_icon text not null default 'default' check (app_icon in ('default','galaxy','neon','zon','nacht')),
  bff_pin_id uuid references auth.users(id) on delete set null,
  chat_wallpapers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sx_entitlements enable row level security;
alter table public.sx_purchase_events enable row level security;
alter table public.sx_plus_prefs enable row level security;
create policy sx_entitlements_read_own on public.sx_entitlements for select to authenticated using (user_id = auth.uid());
-- sx_purchase_events: no client policies (append-only, service role only).
create policy sx_plus_prefs_own on public.sx_plus_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.sx_entitlements from anon, authenticated;
revoke all on public.sx_purchase_events from anon, authenticated;

create schema if not exists app_private;
create or replace function app_private.sx_has_tier(uid uuid, want text default 'plus')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sx_entitlements e
    where e.user_id = uid and e.tier = want and e.status not in ('revoked','refunded')
      and e.starts_at <= now()
      and (e.expires_at is null and e.status = 'active' or e.expires_at > now() or e.grace_until > now())
  );
$$;
revoke all on function app_private.sx_has_tier(uuid, text) from public;

-- Public "is X+" flag for badges / priority replies (no billing details exposed).
create or replace function public.sx_is_plus(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select app_private.sx_has_tier(uid, 'plus') $$;
grant execute on function public.sx_is_plus(uuid) to authenticated;
