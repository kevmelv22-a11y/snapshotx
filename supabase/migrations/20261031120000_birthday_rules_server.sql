-- APPLIED to udantesxduijzhhunadv on 2026-10-31 (as migration "birthday_rules_server"); verified via the Auth API.
-- Server-side enforcement of the Verjaardag rules (Instellingen › Mijn account › Verjaardag).
-- The birthdate lives in auth.users.raw_user_meta_data and is written by the app through
-- supabase.auth.updateUser({ data }) — so without this guard a modified client could skip the
-- limits in lib/birthday.ts. Same rules as the app (lib/birthday.ts + lib/auth-form.ts):
--   * max_changes = 2 birthdate changes (counter birthdate_changes is kept by the server)
--   * min_age = 13, never older than 120
--   * an account that is 13–17 (teen_max_age = 17) can't make itself 18+ (that goes via support)
--   * is_teen is recomputed by the server; the client can't flip it or reset the change counter
--   * a birthdate can't be removed once set
-- Only requests through the Auth API (role supabase_auth_admin = GoTrue) are checked, so support
-- can still correct a birthdate from the SQL editor (role postgres). Other metadata keys and every
-- other auth update (sign-in, email confirm, OAuth identity sync) pass through untouched.
-- Errors surface in the app as "Opslaan lukte niet" — the app validates the same rules first.

create or replace function public.sx_birthday_meta_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  min_age constant int := 13;
  teen_max_age constant int := 17;
  max_changes constant int := 2;
  o jsonb := '{}'::jsonb;
  n jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ob date; nb date; used int := 0; old_teen boolean;
begin
  if current_user <> 'supabase_auth_admin' then return new; end if;
  if jsonb_typeof(n) <> 'object' then return new; end if;
  if tg_op = 'UPDATE' then
    o := coalesce(old.raw_user_meta_data, '{}'::jsonb);
    if jsonb_typeof(o) <> 'object' then o := '{}'::jsonb; end if;
  end if;

  if (n->>'birthdate') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin nb := (n->>'birthdate')::date; exception when others then nb := null; end;
  end if;

  if tg_op = 'INSERT' then
    if nb is null then return new; end if;  -- no / odd birthdate (e.g. other sign-up flows): leave alone
    if extract(year from age(current_date + 1, nb)) < min_age then
      raise exception 'Je moet minimaal % jaar zijn om Snapshot X te gebruiken.', min_age using errcode = 'P0001';
    end if;
    new.raw_user_meta_data := (n - 'birthdate_changes')
      || jsonb_build_object('is_teen', extract(year from age(current_date, nb)) <= teen_max_age);
    return new;
  end if;

  if (o->>'birthdate') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin ob := (o->>'birthdate')::date; exception when others then ob := null; end;
  end if;
  if (o->>'birthdate_changes') ~ '^\d{1,6}(\.\d+)?$' then used := floor((o->>'birthdate_changes')::numeric)::int; end if;

  if (n->'birthdate') is not distinct from (o->'birthdate') then
    -- Birthdate unchanged: the change counter and the teen flag stay what the server had.
    n := n - 'birthdate_changes' - 'is_teen';
    if o ? 'birthdate_changes' then n := n || jsonb_build_object('birthdate_changes', o->'birthdate_changes'); end if;
    if o ? 'is_teen' then n := n || jsonb_build_object('is_teen', o->'is_teen'); end if;
    new.raw_user_meta_data := n;
    return new;
  end if;

  if nb is null then
    raise exception 'Ongeldige geboortedatum.' using errcode = 'P0001';
  end if;
  if used >= max_changes then
    raise exception 'Je hebt je geboortedatum al het maximale aantal keer gewijzigd.' using errcode = 'P0001';
  end if;
  if extract(year from age(current_date + 1, nb)) < min_age then
    raise exception 'Je moet minimaal % jaar zijn om Snapshot X te gebruiken.', min_age using errcode = 'P0001';
  end if;
  if extract(year from age(current_date, nb)) > 120 then
    raise exception 'Ongeldige geboortedatum.' using errcode = 'P0001';
  end if;
  old_teen := case
    when ob is not null then extract(year from age(current_date + 1, ob)) <= teen_max_age
    else coalesce(o->>'is_teen', 'false') = 'true' end;
  if old_teen and extract(year from age(current_date - 1, nb)) > teen_max_age then
    raise exception 'Je kunt jezelf niet ouder dan % maken.', teen_max_age using errcode = 'P0001';
  end if;

  new.raw_user_meta_data := (n - 'birthdate_changes' - 'is_teen') || jsonb_build_object(
    'birthdate_changes', used + 1,
    'is_teen', extract(year from age(current_date, nb)) <= teen_max_age);
  return new;
end $$;

revoke all on function public.sx_birthday_meta_guard() from public, anon, authenticated;
grant execute on function public.sx_birthday_meta_guard() to supabase_auth_admin;

drop trigger if exists sx_birthday_meta_guard on auth.users;
create trigger sx_birthday_meta_guard
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sx_birthday_meta_guard();
