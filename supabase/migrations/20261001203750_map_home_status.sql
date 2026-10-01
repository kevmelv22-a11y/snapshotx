-- A user's own voluntary status, visible only through sx_locations' existing
-- friend-only RLS policy while location sharing is enabled and fresh.
alter table public.sx_locations
  add column home_confirmed boolean not null default false;

alter table public.sx_locations
  add constraint sx_locations_home_requires_sharing
  check (not home_confirmed or sharing);
