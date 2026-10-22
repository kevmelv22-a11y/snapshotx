-- Snapshot X+ app icons v2: replace placeholder ids (galaxy/neon/zon/nacht) with the 10 real icons.
-- NOT applied to any live project. Old placeholder choices fall back to 'default'.
alter table public.sx_plus_prefs drop constraint if exists sx_plus_prefs_app_icon_check;
update public.sx_plus_prefs set app_icon = 'default'
  where app_icon not in ('default','bliksem','vuurijs','ringen','lens','schild','neonspook','glas','gloed','snapx','boog');
alter table public.sx_plus_prefs add constraint sx_plus_prefs_app_icon_check
  check (app_icon in ('default','bliksem','vuurijs','ringen','lens','schild','neonspook','glas','gloed','snapx','boog'));
