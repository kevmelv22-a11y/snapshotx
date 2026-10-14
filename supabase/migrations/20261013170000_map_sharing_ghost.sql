-- Step 6 (kaart): audience per user (all / selected / none), timed ghost mode, selected-friend allow list.
-- NOT APPLIED. Review before running. `sharing` stays as the denormalised "visible to someone now" flag for older clients.
alter table public.sx_locations
  add column if not exists share_audience text not null default 'none' check (share_audience in ('all','selected','none')),
  add column if not exists ghost_until timestamptz,
  add column if not exists ghost_forever boolean not null default false;

update public.sx_locations set share_audience = case when sharing then 'all' else 'none' end;

create table if not exists public.sx_location_allowed (
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);
alter table public.sx_location_allowed enable row level security;
revoke all on public.sx_location_allowed from public, anon;
grant select, insert, delete on public.sx_location_allowed to authenticated;
create policy sx_location_allowed_owner on public.sx_location_allowed for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.sx_friends f where f.user_id = auth.uid() and f.friend_id = sx_location_allowed.friend_id));

-- Friends may read a location only when: not ghost, fresh (24 h), friends, and audience allows them.
drop policy if exists sx_locations_friends on public.sx_locations;
create policy sx_locations_friends on public.sx_locations for select to authenticated using (
  sharing = true
  and not ghost_forever
  and (ghost_until is null or ghost_until <= now())
  and updated_at > now() - interval '24 hours'
  and exists (select 1 from public.sx_friends f where f.user_id = auth.uid() and f.friend_id = sx_locations.user_id)
  and (share_audience = 'all'
       or (share_audience = 'selected' and exists (select 1 from public.sx_location_allowed a where a.owner_id = sx_locations.user_id and a.friend_id = auth.uid())))
);
