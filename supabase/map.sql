create table public.sx_locations(user_id uuid primary key references auth.users(id) on delete cascade,latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),sharing boolean not null default false,updated_at timestamptz not null default now());
alter table public.sx_locations enable row level security;
revoke all on public.sx_locations from public,anon;
grant select,insert,update,delete on public.sx_locations to authenticated;
create policy sx_locations_self on public.sx_locations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy sx_locations_friends on public.sx_locations for select to authenticated using(sharing=true and updated_at>now()-interval '24 hours' and exists(select 1 from public.sx_friends f where f.user_id=auth.uid() and f.friend_id=sx_locations.user_id));
