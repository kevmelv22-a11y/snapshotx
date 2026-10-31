-- 🎂 Verjaardagsfeest for friends (Snapchat-style): friends see 🎂 next to your name on your birthday.
-- NOT APPLIED YET — review first. Client: hooks/useFriendBirthdays.ts + lib/friend-birthdays.ts
-- (without this function the app simply shows no 🎂 for friends; nothing breaks).
--
-- Privacy:
--   * Only the month-day ("MM-DD") is returned, never the birth year or age.
--   * Only for accepted friends of the caller (sx_friends row caller → friend), never for strangers.
--   * Blocked in either direction → nothing.
--   * Only when the friend has Verjaardagsfeest on (user_metadata.birthday_party, default on = Snapchat default).
-- Birthdate lives in auth.users.raw_user_meta_data (Instellingen › Mijn account › Verjaardag), hence SECURITY DEFINER.

create or replace function public.sx_friend_birthdays(p_ids uuid[])
returns table (user_id uuid, birthday_md text, birthday_party boolean)
language sql stable security definer set search_path = '' as $$
  select u.id,
         substring(u.raw_user_meta_data->>'birthdate' from 6 for 5),
         true
  from auth.users u
  join public.sx_friends f on f.user_id = auth.uid() and f.friend_id = u.id
  where u.id = any(coalesce(p_ids, '{}'::uuid[]))
    and cardinality(p_ids) <= 500
    and (u.raw_user_meta_data->>'birthdate') ~ '^\d{4}-\d{2}-\d{2}$'
    and coalesce(u.raw_user_meta_data->>'birthday_party', 'true') <> 'false'
    and not exists (
      select 1 from public.sx_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = auth.uid())
    );
$$;

revoke all on function public.sx_friend_birthdays(uuid[]) from public, anon;
grant execute on function public.sx_friend_birthdays(uuid[]) to authenticated;
