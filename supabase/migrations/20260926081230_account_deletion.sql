-- Applied with approval on 2026-09-26 as remote migration 20260926083312_account_deletion.
-- The Edge Function removes Storage objects first, then calls these service-only
-- RPCs and finally auth.admin.deleteUser. No user can invoke purge from the app.
create table app_private.sx_deletion_pending (
  user_id uuid primary key,
  requested_at timestamptz not null default now()
);
alter table app_private.sx_deletion_pending enable row level security;
revoke all on app_private.sx_deletion_pending from public, anon, authenticated;
grant usage on schema app_private to service_role;
grant select, insert, delete on app_private.sx_deletion_pending to service_role;

create function app_private.sx_account_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and exists (select 1 from auth.users u where u.id = (select auth.uid()))
    and not exists (select 1 from app_private.sx_deletion_pending d
      where d.user_id = (select auth.uid()));
$$;
revoke all on function app_private.sx_account_active() from public, anon;
grant execute on function app_private.sx_account_active() to authenticated;

-- A JWT may outlive Auth deletion. Do not allow orphan Storage uploads.
drop policy sx_media_upload on storage.objects;
create policy sx_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'snapshotx-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select app_private.sx_account_active()));

create function public.sx_mark_account_deletion(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$
  insert into app_private.sx_deletion_pending(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
$$;
revoke all on function public.sx_mark_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.sx_mark_account_deletion(uuid) to service_role;

create function public.sx_finish_account_deletion(p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$
  delete from app_private.sx_deletion_pending where user_id = p_user_id;
$$;
revoke all on function public.sx_finish_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.sx_finish_account_deletion(uuid) to service_role;

-- Server-side list only. Objects are removed through the Storage API, never SQL.
create function public.sx_account_storage_paths(p_user_id uuid, p_limit integer default 100)
returns table(bucket_id text, object_name text)
language sql stable security invoker set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where o.owner_id = p_user_id::text or o.owner = p_user_id
    or (o.bucket_id = 'snapshotx-media' and split_part(o.name, '/', 1) = p_user_id::text)
  order by o.bucket_id, o.name limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.sx_account_storage_paths(uuid,integer) from public, anon, authenticated;
grant execute on function public.sx_account_storage_paths(uuid,integer) to service_role;

-- Keep conversations and sanctions issued by departing staff, but remove the
-- personal actor reference. The actual user's authored content is deleted.
alter table public.sx_threads alter column created_by drop not null;
alter table public.sx_threads drop constraint sx_threads_created_by_fkey;
alter table public.sx_threads add constraint sx_threads_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.sx_receipts drop constraint sx_receipts_user_id_fkey;
alter table public.sx_receipts add constraint sx_receipts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.sx_story_reactions drop constraint sx_story_reactions_user_id_fkey;
alter table public.sx_story_reactions add constraint sx_story_reactions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.sx_story_views drop constraint sx_story_views_viewer_id_fkey;
alter table public.sx_story_views add constraint sx_story_views_viewer_id_fkey
  foreign key (viewer_id) references auth.users(id) on delete cascade;
alter table public.sx_reports drop constraint sx_reports_reviewer_id_fkey;
alter table public.sx_reports add constraint sx_reports_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;
alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
alter table public.user_roles drop constraint user_roles_granted_by_fkey;
alter table public.user_roles add constraint user_roles_granted_by_fkey
  foreign key (granted_by) references public.profiles(id) on delete set null;
alter table public.bans alter column issued_by drop not null;
alter table public.bans drop constraint bans_issued_by_fkey;
alter table public.bans add constraint bans_issued_by_fkey
  foreign key (issued_by) references public.profiles(id) on delete set null;
alter table public.suspensions alter column issued_by drop not null;
alter table public.suspensions drop constraint suspensions_issued_by_fkey;
alter table public.suspensions add constraint suspensions_issued_by_fkey
  foreign key (issued_by) references public.profiles(id) on delete set null;
alter table public.warnings alter column issued_by drop not null;
alter table public.warnings drop constraint warnings_issued_by_fkey;
alter table public.warnings add constraint warnings_issued_by_fkey
  foreign key (issued_by) references public.profiles(id) on delete set null;

create function public.sx_purge_account_data(p_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from app_private.sx_deletion_pending d where d.user_id = p_user_id) then
    raise exception 'account deletion was not requested';
  end if;

  -- Remove the user's authored reports, reports about their content, and
  -- corresponding cases. Preserve unrelated sanctions with a null case link.
  update public.bans set case_id = null where case_id in (
    select c.id from public.moderation_cases c join public.reports r on r.id = c.report_id
    where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  update public.warnings set case_id = null where case_id in (
    select c.id from public.moderation_cases c join public.reports r on r.id = c.report_id
    where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  update public.suspensions set case_id = null where case_id in (
    select c.id from public.moderation_cases c join public.reports r on r.id = c.report_id
    where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  update public.appeals set case_id = null where case_id in (
    select c.id from public.moderation_cases c join public.reports r on r.id = c.report_id
    where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  delete from public.audit_logs a where a.entity_id in (
    select r.id from public.reports r where r.reporter_id = p_user_id
      or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id)
    union
    select c.id from public.moderation_cases c join public.reports r on r.id = c.report_id
    where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  delete from public.moderation_cases c where c.report_id in (
    select r.id from public.reports r where r.reporter_id = p_user_id
      or r.reported_user_id = p_user_id
      or r.message_id in (select id from public.messages where sender_id = p_user_id)
      or r.story_id in (select id from public.stories where owner_id = p_user_id));
  delete from public.reports r where r.reporter_id = p_user_id or r.reported_user_id = p_user_id
    or r.message_id in (select id from public.messages where sender_id = p_user_id)
    or r.story_id in (select id from public.stories where owner_id = p_user_id);

  update public.sx_reports set reviewer_id = null, review_note = null,
    reviewed_at = null, status = 'open' where reviewer_id = p_user_id;
  delete from public.audit_logs a where a.entity_type = 'sx_report' and a.entity_id in (
    select r.id from public.sx_reports r where r.reporter_id = p_user_id
      or r.message_id in (select id from public.sx_messages where sender_id = p_user_id)
      or r.story_id in (select id from public.sx_stories where owner_id = p_user_id));
  delete from public.sx_reports r where r.reporter_id = p_user_id
    or r.message_id in (select id from public.sx_messages where sender_id = p_user_id)
    or r.story_id in (select id from public.sx_stories where owner_id = p_user_id);
  delete from public.audit_logs a where a.actor_id = p_user_id or a.entity_id = p_user_id
    or a.metadata::text like '%' || p_user_id::text || '%';
  delete from public.notifications n where n.recipient_id = p_user_id
    or n.actor_id = p_user_id or n.entity_id = p_user_id
    or n.payload::text like '%' || p_user_id::text || '%';

  delete from public.sx_messages where sender_id = p_user_id;
  delete from public.sx_stories where owner_id = p_user_id;
  delete from public.sx_receipts where user_id = p_user_id;
  delete from public.sx_story_views where viewer_id = p_user_id;
  delete from public.sx_story_reactions where user_id = p_user_id;
  -- Keep the thread shell: deleting it would cascade other people's messages.
  update public.sx_threads set title = null, created_by = null where created_by = p_user_id;
  delete from public.sx_members where user_id = p_user_id;

  delete from public.messages where sender_id = p_user_id;
  delete from public.stories where owner_id = p_user_id;
  delete from public.private_stories where owner_id = p_user_id;
  delete from public.memories where owner_id = p_user_id;
  -- A legacy conversation has no creator column. Only clear titles where the
  -- departing user is the sole member; retain other members' content.
  update public.conversations c set title = null where exists (
    select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = p_user_id)
    and not exists (select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id <> p_user_id);
  delete from public.conversation_members where user_id = p_user_id;
end $$;
revoke all on function public.sx_purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.sx_purge_account_data(uuid) to service_role;
