-- Server-side name filter (App Store guideline 1.2): mirrors lib/name-filter.ts so a modified client cannot
-- set offensive or impersonating usernames, display names or group titles.
-- NOT APPLIED YET — review first. Keep the word lists in sync with lib/name-filter.ts
-- (lib/name-filter-sql.test.mjs checks that).
--
-- Behaviour:
--   * profiles UPDATE (username / display_name changed) and sx_threads INSERT/UPDATE (title changed)
--     → raise 'name_not_allowed:<offensive|reserved>' (errcode 22023); the app shows a Dutch text.
--   * profiles INSERT (sx_ensure_profile at signup) → never fails signup: a bad username becomes
--     user_<8 hex>, a bad display name falls back to the username.
--   * No check when there is no end-user JWT (service role, SQL editor, staff tooling, migrations)
--     and unchanged values are never re-checked, so existing rows keep working.

create schema if not exists app_private;

create or replace function app_private.sx_name_violation(p_raw text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  block_anywhere text[] := array['fuck','motherf','nigger','nigga','faggot','whore','porn','hitler','pedophile','paedo',
                                 'kanker','klootzak','teringl','tyfus','neuken','kutwijf','hoerenzoon','mongool'];
  block_word text[] := array['cunt','dick','cock','shit','bitch','slut','rape','rapist','retard','nazi','pedo','sex','kkk',
                             'kut','lul','pik','slet','hoer','hoeren','kech','flikker','debiel','kkr','kanka','tering'];
  reserved_anywhere text[] := array['snapshotx','snapchat'];
  reserved_word text[] := array['admin','administrator','support','staff','moderator','mod','official','officieel','helpdesk',
                                'security','beveiliging','root','system','systeem','team'];
  base text; norm text; compact text; compacts text[]; words text[]; norm_words text[]; w text; b text;
begin
  if p_raw is null or btrim(p_raw) = '' then return null; end if;
  -- NFKD + strip combining accents + lowercase (same as normalizeName before the leet step).
  base := lower(regexp_replace(normalize(p_raw, NFKD), '[\u0300-\u036f]', '', 'g'));
  norm := translate(base, '0134578@$!€|', 'oieastbasiei');
  norm_words := array(select x from unnest(regexp_split_to_array(norm, '[^a-z]+')) x where x <> '');
  words := '{}';
  foreach w in array norm_words || array(select x from unnest(regexp_split_to_array(base, '[^a-z]+')) x where x <> '') loop
    words := words || w || regexp_replace(w, '(.)\1+', '\1', 'g');
  end loop;
  compact := regexp_replace(norm, '[^a-z]', '', 'g');
  compacts := array[compact, regexp_replace(compact, '(.)\1+', '\1', 'g')];
  -- Initials like "k.u.t" / "f u c k" count as one word too.
  if cardinality(norm_words) > 1 and not exists (select 1 from unnest(norm_words) x where length(x) <> 1) then
    words := words || compacts;
  end if;
  foreach b in array block_anywhere loop
    if compacts[1] like '%' || b || '%' or compacts[2] like '%' || b || '%' then return 'offensive'; end if;
  end loop;
  if words && block_word then return 'offensive'; end if;
  foreach b in array reserved_anywhere loop
    if compacts[1] like '%' || b || '%' or compacts[2] like '%' || b || '%' then return 'reserved'; end if;
  end loop;
  if words && reserved_word then return 'reserved'; end if;
  return null;
end $$;
revoke all on function app_private.sx_name_violation(text) from public, anon, authenticated;

create or replace function app_private.sx_profiles_name_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if auth.uid() is null then return new; end if;  -- service role / SQL editor / staff tooling
  if tg_op = 'INSERT' then
    if app_private.sx_name_violation(new.username) is not null then
      new.username := 'user_' || left(replace(new.id::text, '-', ''), 8);
    end if;
    if app_private.sx_name_violation(new.display_name) is not null then
      new.display_name := new.username;
    end if;
    return new;
  end if;
  if new.username is distinct from old.username then
    v := app_private.sx_name_violation(new.username);
    if v is not null then raise exception 'name_not_allowed:%', v using errcode = '22023', hint = 'username'; end if;
  end if;
  if new.display_name is distinct from old.display_name then
    v := app_private.sx_name_violation(new.display_name);
    if v is not null then raise exception 'name_not_allowed:%', v using errcode = '22023', hint = 'display'; end if;
  end if;
  return new;
end $$;
revoke all on function app_private.sx_profiles_name_guard() from public, anon, authenticated;

drop trigger if exists sx_profiles_name_guard on public.profiles;
create trigger sx_profiles_name_guard before insert or update of username, display_name on public.profiles
  for each row execute function app_private.sx_profiles_name_guard();

create or replace function app_private.sx_threads_title_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if auth.uid() is null then return new; end if;
  if new.title is null or (tg_op = 'UPDATE' and new.title is not distinct from old.title) then return new; end if;
  v := app_private.sx_name_violation(new.title);
  if v is not null then raise exception 'name_not_allowed:%', v using errcode = '22023', hint = 'group'; end if;
  return new;
end $$;
revoke all on function app_private.sx_threads_title_guard() from public, anon, authenticated;

drop trigger if exists sx_threads_title_guard on public.sx_threads;
create trigger sx_threads_title_guard before insert or update of title on public.sx_threads
  for each row execute function app_private.sx_threads_title_guard();
