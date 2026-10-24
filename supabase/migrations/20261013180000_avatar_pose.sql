-- Roadmap step 8 (avatar): profile pose stored next to the saved outfit. NOT APPLIED; review first.
-- The app works without it (stores/avatarPose.ts keeps the pose locally in AsyncStorage).
-- Pose ids must match lib/avatar/poses.ts (AVATAR_POSES). Safe to re-run.
alter table public.sx_avatar_outfits
  add column if not exists pose text not null default 'stand';

alter table public.sx_avatar_outfits
  drop constraint if exists sx_avatar_outfits_pose_check;
alter table public.sx_avatar_outfits
  add constraint sx_avatar_outfits_pose_check
  check (pose in ('stand','wave','thumbs','laugh','cheer','peace','shrug','wink','surprised'));
-- Existing RLS on sx_avatar_outfits (owner write, friends read via sx_friend_avatar_outfits) covers the new column;
-- extending the friends RPC to also return `pose` is a follow-up once friends' profile headers show poses.
