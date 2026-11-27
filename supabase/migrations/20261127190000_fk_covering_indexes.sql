-- Covering indexes for the Snapshot X foreign keys flagged by the performance advisor (lint 0001_unindexed_foreign_keys).
-- Hot paths: chat list (sx_members.user_id, sx_receipts.user_id, sx_messages.sender_id), friends (sx_friends.friend_id),
-- stories (sx_stories.owner_id, sx_story_views.viewer_id); the others speed up ON DELETE cascades when an account is deleted.
-- Index-only: no table, policy, grant or data change. Idempotent (if not exists). pw_* (Postwacht) tables are not touched.

create index if not exists sx_ai_reports_reporter_id_idx on public.sx_ai_reports (reporter_id);
create index if not exists sx_family_members_member_id_idx on public.sx_family_members (member_id);
create index if not exists sx_friend_nicknames_friend_id_idx on public.sx_friend_nicknames (friend_id);
create index if not exists sx_friends_friend_id_idx on public.sx_friends (friend_id);
create index if not exists sx_group_invites_created_by_idx on public.sx_group_invites (created_by);
create index if not exists sx_hidden_suggestions_other_id_idx on public.sx_hidden_suggestions (other_id);
create index if not exists sx_highlight_comment_likes_user_id_idx on public.sx_highlight_comment_likes (user_id);
create index if not exists sx_highlight_comments_user_id_idx on public.sx_highlight_comments (user_id);
create index if not exists sx_highlight_likes_user_id_idx on public.sx_highlight_likes (user_id);
create index if not exists sx_highlight_shares_story_id_idx on public.sx_highlight_shares (story_id);
create index if not exists sx_highlight_shares_user_id_idx on public.sx_highlight_shares (user_id);
create index if not exists sx_members_user_id_idx on public.sx_members (user_id);
create index if not exists sx_messages_saved_by_idx on public.sx_messages (saved_by);
create index if not exists sx_messages_sender_id_idx on public.sx_messages (sender_id);
create index if not exists sx_plus_prefs_bff_pin_id_idx on public.sx_plus_prefs (bff_pin_id);
create index if not exists sx_purchase_events_user_id_idx on public.sx_purchase_events (user_id);
create index if not exists sx_push_recipient_deliveries_user_id_idx on public.sx_push_recipient_deliveries (user_id);
create index if not exists sx_reactions_user_id_idx on public.sx_reactions (user_id);
create index if not exists sx_receipts_user_id_idx on public.sx_receipts (user_id);
create index if not exists sx_reports_reviewer_id_idx on public.sx_reports (reviewer_id);
create index if not exists sx_shared_stories_created_by_idx on public.sx_shared_stories (created_by);
create index if not exists sx_shared_story_members_added_by_idx on public.sx_shared_story_members (added_by);
create index if not exists sx_staff_bans_issued_by_idx on public.sx_staff_bans (issued_by);
create index if not exists sx_staff_bans_revoked_by_idx on public.sx_staff_bans (revoked_by);
create index if not exists sx_staff_warnings_issued_by_idx on public.sx_staff_warnings (issued_by);
create index if not exists sx_staff_warnings_report_id_idx on public.sx_staff_warnings (report_id);
create index if not exists sx_stories_owner_id_idx on public.sx_stories (owner_id);
create index if not exists sx_story_reactions_user_id_idx on public.sx_story_reactions (user_id);
create index if not exists sx_story_views_viewer_id_idx on public.sx_story_views (viewer_id);
create index if not exists sx_thread_mutes_thread_id_idx on public.sx_thread_mutes (thread_id);
create index if not exists sx_threads_created_by_idx on public.sx_threads (created_by);
