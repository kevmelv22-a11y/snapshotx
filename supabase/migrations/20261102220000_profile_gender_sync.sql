-- profiles.gender follows later character changes (avatar editor → supabase.auth.updateUser({data:{gender}})).
-- Before this, sx_profile_gender_from_auth only ran on profile INSERT, so friends kept seeing the old character art.
create or replace function public.sx_profile_gender_sync_from_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare g text := new.raw_user_meta_data->>'gender';
begin
  if g in ('male', 'female') and g is distinct from (old.raw_user_meta_data->>'gender') then
    update public.profiles set gender = g where id = new.id and gender is distinct from g;
  end if;
  return new;
end $$;
revoke all on function public.sx_profile_gender_sync_from_auth() from public, anon, authenticated;

drop trigger if exists sx_profile_gender_sync_from_auth on auth.users;
create trigger sx_profile_gender_sync_from_auth after update of raw_user_meta_data on auth.users
  for each row execute function public.sx_profile_gender_sync_from_auth();
