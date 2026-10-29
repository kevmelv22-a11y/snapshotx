-- Melden 2.0 (App Store guideline 1.2): Snapchat-style report reasons and reporting a whole account.
--   * sx_reports.category: the reason the reporter picked (lib/report-reasons.ts REPORT_REASONS ids).
--   * sx_reports.target_user_id: account report from the friend profile (Account melden), no message/story.
--     The capture trigger fills reported_user_id + a 'profile' content_snapshot for it, so the staff console's
--     warn/ban actions work exactly as for message/story reports (category 'Account').
-- NOT APPLIED. Apply after 20261028210000_wallpaper_photo_cleanup.sql (independent of the chat migrations, but
-- needs 20261012090100_staff_panel_1b.sql: reported_user_id, content_snapshot, sx_report_capture).
-- App fallback until applied: message/story reports retry with the legacy columns; account reports show
-- "Account melden wordt nog klaargezet op de server".

alter table public.sx_reports add column if not exists category text;
alter table public.sx_reports add column if not exists target_user_id uuid references auth.users(id) on delete set null;
alter table public.sx_reports drop constraint if exists sx_reports_category_check;
alter table public.sx_reports add constraint sx_reports_category_check check (category is null or category in
  ('nudity','harassment','hate','threat','self_harm','drugs','impersonation','spam','other'));
alter table public.sx_reports drop constraint if exists sx_report_one_target;
alter table public.sx_reports add constraint sx_report_one_target check (num_nonnulls(message_id, story_id, target_user_id) <= 1);
create index if not exists sx_reports_target_user on public.sx_reports(target_user_id, created_at desc) where target_user_id is not null;

grant insert (category, target_user_id) on public.sx_reports to authenticated;

-- Insert policy: unchanged for messages (member of the chat) and stories; new branch for accounts (an existing
-- profile that is not yourself).
drop policy if exists sx_reports_send on public.sx_reports;
create policy sx_reports_send on public.sx_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid()) and status = 'open' and
  reviewer_id is null and review_note is null and reviewed_at is null and
  (
    (message_id is not null and exists (
      select 1 from public.sx_messages m where m.id = message_id
        and app_private.sx_is_member(m.thread_id)
    )) or
    (story_id is not null and exists (
      select 1 from public.sx_stories s where s.id = story_id
    )) or
    (target_user_id is not null and target_user_id <> (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = target_user_id
    ))
  )
);

create or replace function app_private.sx_profile_snapshot(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('type','profile','user_id',p.id,'display_name',p.display_name,'username',p.username,
    'captured_at',now())
  from public.profiles p where p.id=p_user_id;
$$;
revoke all on function app_private.sx_profile_snapshot(uuid) from public, anon, authenticated;

-- Same server-side capture as 1B, plus accounts. A message/story report never keeps a client-set target_user_id.
create or replace function app_private.sx_report_capture()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.reported_user_id := null;
  new.content_snapshot := null;
  new.action_taken := null; new.action_ref := null; new.actioned_at := null;
  if new.message_id is not null then
    new.target_user_id := null;
    select m.sender_id into new.reported_user_id from public.sx_messages m where m.id=new.message_id;
    new.content_snapshot := app_private.sx_message_snapshot(new.message_id);
  elsif new.story_id is not null then
    new.target_user_id := null;
    select s.owner_id into new.reported_user_id from public.sx_stories s where s.id=new.story_id;
    new.content_snapshot := app_private.sx_story_snapshot(new.story_id);
  elsif new.target_user_id is not null then
    new.reported_user_id := new.target_user_id;
    new.content_snapshot := app_private.sx_profile_snapshot(new.target_user_id);
  end if;
  return new;
end;
$$;
revoke all on function app_private.sx_report_capture() from public, anon, authenticated;
