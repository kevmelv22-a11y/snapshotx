-- Report-linked staff messaging: one independent thread for the reporter and one for the reported user.
-- Source-only in this task. Apply only to a disposable test database after review; never run on production here.
begin;

create table if not exists public.sx_report_conversations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.sx_reports(id) on delete cascade,
  audience text not null check (audience in ('reporter','reported')),
  thread_id uuid not null unique references public.sx_threads(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, audience)
);
alter table public.sx_report_conversations
  add column if not exists creator_id uuid references auth.users(id) on delete cascade;
update public.sx_report_conversations rc set creator_id = t.created_by
  from public.sx_threads t where t.id = rc.thread_id and rc.creator_id is null;
alter table public.sx_report_conversations alter column creator_id set not null;
create index if not exists sx_report_conversations_recipient
  on public.sx_report_conversations(recipient_id, created_at desc);

-- Keep the existing receipt-based retention trigger from extending report messages
-- past 24 hours from send time when the recipient opens them later.
create or replace function app_private.sx_apply_retention() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m record; mode text; pending int;
begin
  if new.opened_at is null then return new; end if;
  select msg.id, msg.thread_id, msg.sender_id, msg.kind into m
    from public.sx_messages msg where msg.id = new.message_id;
  if m.kind in ('snap','system') then return new; end if;
  if exists (select 1 from public.sx_report_conversations rc where rc.thread_id=m.thread_id) then return new; end if;
  select t.retention_mode into mode from public.sx_threads t where t.id = m.thread_id;
  if mode = 'keep' then
    update public.sx_messages set expires_at = null where id = m.id;
  elsif mode = '24h' then
    update public.sx_messages set expires_at = greatest(coalesce(expires_at, now()), new.opened_at + interval '24 hours') where id = m.id;
  else
    select count(*) into pending from public.sx_members mem
      where mem.thread_id = m.thread_id and mem.user_id <> m.sender_id
        and not exists (select 1 from public.sx_receipts r where r.message_id = m.id and r.user_id = mem.user_id and r.opened_at is not null);
    if pending = 0 then update public.sx_messages set expires_at = now() + interval '10 minutes' where id = m.id; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.sx_apply_retention() from public, anon, authenticated;

-- Do not expose report-to-thread mappings through the client Data API.
alter table public.sx_report_conversations enable row level security;
revoke all on public.sx_report_conversations from public, anon, authenticated;

create or replace function app_private.sx_cleanup_report_conversation_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A report deletion also cascades through the mapping; delete the now-orphaned chat thread.
  -- If the thread itself initiated this cascade, it is already gone and no recursive delete is needed.
  if exists (select 1 from public.sx_threads where id = old.thread_id) then
    delete from public.sx_threads where id = old.thread_id;
  end if;
  return old;
end;
$$;
revoke all on function app_private.sx_cleanup_report_conversation_thread() from public, anon, authenticated;
drop trigger if exists sx_report_conversation_cleanup on public.sx_report_conversations;
create trigger sx_report_conversation_cleanup
  after delete on public.sx_report_conversations
  for each row execute function app_private.sx_cleanup_report_conversation_thread();

-- Keep report threads out of the generic staff-chat browser. Dedicated report RPCs
-- always bind reads and sends to the report id and audience in the audit trail.
create or replace function app_private.sx_staff_list_chats()
returns table(thread_id uuid, title text, created_at timestamptz, member_count bigint, last_message_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.sx_require_staff();
  return query
    select t.id, t.title, t.created_at,
      (select count(*) from public.sx_members m where m.thread_id=t.id),
      (select max(msg.created_at) from public.sx_messages msg where msg.thread_id=t.id)
    from public.sx_threads t
    where not exists (select 1 from public.sx_report_conversations rc where rc.thread_id=t.id)
    order by coalesce((select max(msg.created_at) from public.sx_messages msg where msg.thread_id=t.id), t.created_at) desc
    limit 200;
end;
$$;

create or replace function app_private.sx_staff_read_chat(p_thread_id uuid, p_reason text)
returns table(message_id uuid, sender_id uuid, kind text, body text, created_at timestamptz, is_deleted boolean)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app_private.sx_require_staff();
begin
  if char_length(trim(coalesce(p_reason,''))) < 10 or char_length(p_reason)>1000 then
    raise exception 'A reason of at least 10 characters is required';
  end if;
  if exists(select 1 from public.sx_report_conversations rc where rc.thread_id=p_thread_id) then
    raise exception 'report conversations must be opened from the report';
  end if;
  if not exists(select 1 from public.sx_threads t where t.id=p_thread_id) then raise exception 'chat not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,'sx_staff_chat_open','sx_thread',p_thread_id,
      app_private.sx_audit_meta(jsonb_build_object('reason',trim(p_reason),'old_status','not_opened_by_staff','new_status','opened_by_staff')));
  return query
    select m.id,m.sender_id,m.kind,
      case when m.media_deleted_at is not null then null else m.body end,
      m.created_at,(m.media_deleted_at is not null)
    from public.sx_messages m
    where m.thread_id=p_thread_id and (m.expires_at is null or m.expires_at>now())
    order by m.created_at asc limit 500;
end;
$$;

-- Replies sent from the ordinary Chat composer get the same 24-hour cap as staff messages.
create or replace function app_private.sx_report_message_expiry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sx_report_conversations rc where rc.thread_id = new.thread_id) then
    new.expires_at := now() + interval '24 hours';
  end if;
  return new;
end;
$$;
revoke all on function app_private.sx_report_message_expiry() from public, anon, authenticated;
drop trigger if exists sx_report_message_expiry on public.sx_messages;
create trigger sx_report_message_expiry
  before insert on public.sx_messages
  for each row execute function app_private.sx_report_message_expiry();

-- The retention preference cannot be changed for a report support thread.
create or replace function public.sx_set_retention(p_thread_id uuid, p_mode text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.sx_is_member(p_thread_id) then raise exception 'not a member'; end if;
  if exists (select 1 from public.sx_report_conversations rc where rc.thread_id=p_thread_id) then
    raise exception 'report conversations use fixed 24-hour expiry';
  end if;
  if p_mode not in ('after_view','24h','keep') then raise exception 'invalid mode'; end if;
  update public.sx_threads set retention_mode = p_mode where id = p_thread_id;
  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (p_thread_id, auth.uid(), 'system', left(coalesce(p_text, 'Verwijderinstelling gewijzigd'), 200), null);
end;
$$;
revoke all on function public.sx_set_retention(uuid, text, text) from public, anon;
grant execute on function public.sx_set_retention(uuid, text, text) to authenticated;

create or replace function app_private.sx_report_conversation_recipient(p_report_id uuid, p_audience text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_report public.sx_reports%rowtype;
begin
  if p_audience not in ('reporter','reported') then
    raise exception 'invalid conversation audience';
  end if;
  select * into v_report from public.sx_reports where id = p_report_id;
  if not found then raise exception 'report not found'; end if;
  if p_audience = 'reporter' then return v_report.reporter_id; end if;
  return v_report.reported_user_id;
end;
$$;
revoke all on function app_private.sx_report_conversation_recipient(uuid, text) from public, anon, authenticated;

create or replace function public.sx_staff_report_conversation(
  p_report_id uuid,
  p_audience text,
  p_reason text
)
returns table(
  thread_id uuid,
  recipient_id uuid,
  recipient_username text,
  recipient_display_name text,
  message_id uuid,
  sender_id uuid,
  kind text,
  body text,
  created_at timestamptz,
  is_deleted boolean
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.sx_require_staff();
  v_report public.sx_reports%rowtype;
  v_expected_recipient uuid;
  v_recipient uuid;
  v_thread uuid;
begin
  if p_audience is null or p_audience not in ('reporter','reported')
     or char_length(trim(coalesce(p_reason,''))) < 10 or char_length(p_reason) > 1000 then
    raise exception 'a reason of at least 10 characters and a valid audience are required';
  end if;
  select * into v_report from public.sx_reports where id = p_report_id for update;
  if not found then raise exception 'report not found'; end if;
  v_expected_recipient := app_private.sx_report_conversation_recipient(p_report_id, p_audience);
  select rc.thread_id, rc.recipient_id into v_thread, v_recipient
    from public.sx_report_conversations rc
   where rc.report_id = p_report_id and rc.audience = p_audience;
  if v_recipient is null then
    v_recipient := v_expected_recipient;
  elsif v_expected_recipient is null or v_expected_recipient <> v_recipient then
    raise exception 'report conversation recipient no longer matches the report';
  end if;
  if v_recipient is null then raise exception 'recipient is no longer available'; end if;
  if v_recipient = v_uid then raise exception 'staff cannot message themselves'; end if;
  if v_thread is not null and (
      not exists (select 1 from public.sx_members where thread_id = v_thread and user_id = v_uid)
      or not exists (select 1 from public.sx_members where thread_id = v_thread and user_id = v_recipient)
    ) then
    raise exception 'report conversation membership is invalid';
  end if;

  -- Every read/re-open is purpose-bound and audited. Message content is not copied to audit metadata.
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'sx_staff_report_conversation_open', 'sx_report', p_report_id,
      app_private.sx_audit_meta(jsonb_build_object('report_id', p_report_id, 'audience', p_audience, 'thread_id', v_thread,
        'recipient_id', v_recipient, 'reason', trim(p_reason))));

  return query
    select v_thread, v_recipient, p.username, p.display_name,
      m.id, m.sender_id, m.kind,
      case when m.media_deleted_at is not null then null else m.body end,
      m.created_at, coalesce(m.media_deleted_at is not null, false)
    from (select 1) as anchor
    left join public.profiles p on p.id = v_recipient
    left join lateral (
      select recent.*
      from (
        select msg.id, msg.sender_id, msg.kind, msg.body, msg.created_at, msg.media_deleted_at
          from public.sx_messages msg
         where v_thread is not null and msg.thread_id = v_thread
           and (msg.expires_at is null or msg.expires_at > now())
         order by msg.created_at desc
         limit 100
      ) recent
      order by recent.created_at asc
    ) m on true;
end;
$$;
revoke all on function public.sx_staff_report_conversation(uuid, text, text) from public, anon, authenticated;
grant execute on function public.sx_staff_report_conversation(uuid, text, text) to authenticated;

create or replace function public.sx_staff_send_report_message(
  p_report_id uuid,
  p_audience text,
  p_body text,
  p_reason text
)
returns table(thread_id uuid, message_id uuid, recipient_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.sx_require_staff();
  v_report public.sx_reports%rowtype;
  v_expected_recipient uuid;
  v_recipient uuid;
  v_thread uuid;
  v_message uuid;
begin
  if p_audience is null or p_audience not in ('reporter','reported')
     or char_length(trim(coalesce(p_body,''))) < 1 or char_length(p_body) > 2000
     or char_length(trim(coalesce(p_reason,''))) < 10 or char_length(p_reason) > 1000 then
    raise exception 'message must contain 1 to 2000 characters and include a reason of at least 10 characters';
  end if;
  -- Serialize creation for this report; the unique(report_id, audience) constraint is a second guard.
  select * into v_report from public.sx_reports where id = p_report_id for update;
  if not found then raise exception 'report not found'; end if;
  v_expected_recipient := app_private.sx_report_conversation_recipient(p_report_id, p_audience);
  select rc.thread_id, rc.recipient_id into v_thread, v_recipient
    from public.sx_report_conversations rc
   where rc.report_id = p_report_id and rc.audience = p_audience;
  if v_recipient is null then
    v_recipient := v_expected_recipient;
  elsif v_expected_recipient is null or v_expected_recipient <> v_recipient then
    raise exception 'report conversation recipient no longer matches the report';
  end if;
  if v_recipient is null then raise exception 'recipient is no longer available'; end if;
  if v_recipient = v_uid then raise exception 'staff cannot message themselves'; end if;

  if v_thread is null then
    insert into public.sx_threads(title, created_by, retention_mode)
      values (case when p_audience = 'reporter' then 'Support over je melding' else 'Bericht over een melding' end, v_uid, '24h')
      returning id into v_thread;
    insert into public.sx_members(thread_id, user_id)
      values (v_thread, v_uid), (v_thread, v_recipient);
    insert into public.sx_report_conversations(report_id, audience, thread_id, recipient_id, creator_id)
      values (p_report_id, p_audience, v_thread, v_recipient, v_uid);
  elsif not exists (select 1 from public.sx_members where thread_id = v_thread and user_id = v_uid)
     or not exists (select 1 from public.sx_members where thread_id = v_thread and user_id = v_recipient) then
    raise exception 'report conversation membership is invalid';
  end if;

  insert into public.sx_messages(thread_id, sender_id, kind, body, expires_at)
    values (v_thread, v_uid, 'text', trim(p_body), now() + interval '24 hours')
    returning id into v_message;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'sx_staff_report_message_sent', 'sx_report', p_report_id,
      app_private.sx_audit_meta(jsonb_build_object('report_id', p_report_id, 'audience', p_audience, 'thread_id', v_thread,
        'recipient_id', v_recipient, 'message_id', v_message,
        'character_count', char_length(trim(p_body)), 'reason', trim(p_reason))));

  return query select v_thread, v_message, v_recipient;
end;
$$;
revoke all on function public.sx_staff_send_report_message(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sx_staff_send_report_message(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
