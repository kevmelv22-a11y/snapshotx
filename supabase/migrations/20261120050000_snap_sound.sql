-- Snap sound: bundled music loop and/or voice filter (lib/snap-sound.ts). Plain metadata, no new access paths:
-- the existing RLS policies of sx_messages / sx_stories keep applying to the whole row.
alter table public.sx_messages add column if not exists sound text;
alter table public.sx_stories add column if not exists sound text;
do $$ begin
  alter table public.sx_messages add constraint sx_messages_sound_format check (sound is null or sound ~ '^(m:[a-z0-9-]{1,24}|v:[a-z0-9-]{1,24}|m:[a-z0-9-]{1,24};v:[a-z0-9-]{1,24})$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sx_stories add constraint sx_stories_sound_format check (sound is null or sound ~ '^(m:[a-z0-9-]{1,24}|v:[a-z0-9-]{1,24}|m:[a-z0-9-]{1,24};v:[a-z0-9-]{1,24})$');
exception when duplicate_object then null; end $$;
