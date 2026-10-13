-- Character set chosen at registration (Man / Vrouw): picks the male or female pre-rendered avatar art and
-- the start look. NOT APPLIED automatically; review before running.
alter table public.profiles
  add column if not exists gender text not null default 'male';

do $$ begin
  alter table public.profiles add constraint profiles_gender_check check (gender in ('male', 'female'));
exception when duplicate_object then null; end $$;

-- Backfill from the sign-up metadata (supabase.auth.signUp options.data.gender).
update public.profiles p
   set gender = u.raw_user_meta_data->>'gender'
  from auth.users u
 where u.id = p.id and u.raw_user_meta_data->>'gender' in ('male', 'female') and p.gender is distinct from u.raw_user_meta_data->>'gender';

-- New profiles copy the choice from the auth user's metadata (independent of the existing new-user trigger).
create or replace function public.sx_profile_gender_from_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare g text;
begin
  select raw_user_meta_data->>'gender' into g from auth.users where id = new.id;
  if g in ('male', 'female') then new.gender := g; end if;
  return new;
end $$;
revoke all on function public.sx_profile_gender_from_auth() from public, anon, authenticated;

drop trigger if exists sx_profile_gender_from_auth on public.profiles;
create trigger sx_profile_gender_from_auth before insert on public.profiles
  for each row execute function public.sx_profile_gender_from_auth();
