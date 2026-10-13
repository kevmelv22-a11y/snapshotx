-- Fix chat/story activity scoring when each table has a different owner column.
-- The previous CASE expression referenced NEW.owner_id in the sx_messages trigger,
-- whose row type only has sender_id.
create or replace function public.sx_mark_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_user_id uuid;
begin
  if tg_table_schema <> 'public' then
    raise exception 'unsupported_activity_schema: %', tg_table_schema;
  end if;

  if tg_table_name = 'sx_messages' then
    activity_user_id := new.sender_id;
  elsif tg_table_name = 'sx_stories' then
    activity_user_id := new.owner_id;
  else
    raise exception 'unsupported_activity_table: %', tg_table_name;
  end if;

  insert into public.sx_daily_activity(user_id, active_date)
  values (activity_user_id, (now() at time zone 'UTC')::date)
  on conflict do nothing;

  update public.profiles
    set activity_score = coalesce(activity_score, 0) + 1
    where id = activity_user_id;

  return new;
end;
$$;
