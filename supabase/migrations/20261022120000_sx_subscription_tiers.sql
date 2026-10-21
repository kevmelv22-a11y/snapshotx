-- Snapshot X subscription tiers (X+, Gezin, Lens+, Platinum, Herinneringen 100 GB) + trial status.
-- NOT APPLIED. Review before running against any project. Do not run against production without sign-off.
alter table public.sx_entitlements drop constraint if exists sx_entitlements_tier_check;
alter table public.sx_entitlements add constraint sx_entitlements_tier_check check (tier in ('plus','family','lens','platinum','storage'));
alter table public.sx_entitlements drop constraint if exists sx_entitlements_status_check;
alter table public.sx_entitlements add constraint sx_entitlements_status_check check (status in ('active','trial','grace','expired','revoked','refunded'));
-- Family plan: owner + up to 2 members share the owner's entitlement.
create table if not exists public.sx_family_members (
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (owner_id, member_id)
);
alter table public.sx_family_members enable row level security;
create policy sx_family_members_read on public.sx_family_members for select to authenticated using (auth.uid() in (owner_id, member_id));
