-- Security advisor 0028 (anon_security_definer_function_executable): public.sx_is_plus(uuid) is SECURITY DEFINER
-- and was executable by PUBLIC/anon, so anyone without an account could ask "is user X a Snapshot X+ member?"
-- via /rest/v1/rpc/sx_is_plus. Signed-out visitors never need it (no RLS policy uses it; only the staff RPCs
-- sx_staff_user_moderation / sx_staff_set_plus call it, as their owner). Keep it for signed-in users + service role.
revoke execute on function public.sx_is_plus(uuid) from public;
revoke execute on function public.sx_is_plus(uuid) from anon;
grant execute on function public.sx_is_plus(uuid) to authenticated, service_role;
