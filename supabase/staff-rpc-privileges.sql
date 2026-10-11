begin;
create or replace function public.sx_staff_list_chats()
returns table(thread_id uuid,title text,created_at timestamptz,member_count bigint,last_message_at timestamptz)
language sql security definer set search_path = '' as $$ select * from app_private.sx_staff_list_chats() $$;
create or replace function public.sx_staff_read_chat(p_thread_id uuid,p_reason text)
returns table(message_id uuid,sender_id uuid,kind text,body text,created_at timestamptz,is_deleted boolean)
language sql security definer set search_path = '' as $$ select * from app_private.sx_staff_read_chat(p_thread_id,p_reason) $$;
create or replace function public.sx_staff_delete_message(p_message_id uuid,p_reason text)
returns void language sql security definer set search_path = '' as $$ select app_private.sx_staff_delete_message(p_message_id,p_reason) $$;
create or replace function public.sx_staff_create_ban(p_type text,p_user_id uuid,p_ip inet,p_device_id uuid,p_duration_minutes integer,p_reason text)
returns uuid language sql security definer set search_path = '' as $$ select app_private.sx_staff_create_ban(p_type,p_user_id,p_ip,p_device_id,p_duration_minutes,p_reason) $$;
create or replace function public.sx_staff_revoke_ban(p_ban_id uuid,p_reason text)
returns void language sql security definer set search_path = '' as $$ select app_private.sx_staff_revoke_ban(p_ban_id,p_reason) $$;

revoke all on function app_private.sx_staff_list_chats() from public, anon, authenticated;
revoke all on function app_private.sx_staff_read_chat(uuid,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_delete_message(uuid,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) from public, anon, authenticated;
revoke all on function app_private.sx_staff_revoke_ban(uuid,text) from public, anon, authenticated;
grant execute on function public.sx_staff_list_chats() to authenticated;
grant execute on function public.sx_staff_read_chat(uuid,text) to authenticated;
grant execute on function public.sx_staff_delete_message(uuid,text) to authenticated;
grant execute on function public.sx_staff_create_ban(text,uuid,inet,uuid,integer,text) to authenticated;
grant execute on function public.sx_staff_revoke_ban(uuid,text) to authenticated;
commit;
