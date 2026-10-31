-- Follow-up to 20261031150000_map_privacy_server: the live DB already has app_private.sx_location_allows(uuid)
-- (from 20261019120000_sx_data_api_grants_rls, same semantics). Use that one in sx_locations_friends so both
-- migrations produce the identical policy, and drop the duplicate helper. Safe to re-run.
drop policy if exists sx_locations_friends on public.sx_locations;
create policy sx_locations_friends on public.sx_locations for select to authenticated using (
  user_id <> (select auth.uid())
  and sharing = true
  and updated_at > now() - interval '24 hours'
  and not ghost_forever
  and (ghost_until is null or ghost_until <= now())
  and app_private.sx_is_friend(user_id)
  and (share_audience = 'all'
       or (share_audience = 'selected' and app_private.sx_location_allows(user_id)))
);
drop function if exists app_private.sx_location_allowed_for_me(uuid);
