-- Staffpaneel › AI-meldingen: staff can read in-app reports of Mijn AI replies (public.sx_ai_reports, 20261120090000).
-- That table has no client SELECT policy (insert-own only), so reading goes through this staff-only, read-only RPC:
-- app_private.sx_require_staff() raises 42501 for anyone who is not an active, non-banned staff member.
-- No table, policy or data changes.
create or replace function public.sx_staff_ai_reports(p_limit integer default 100)
returns table(id uuid, reason text, reply_text text, prompt_text text, detail text, created_at timestamptz, reporter_id uuid, reporter_username text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform app_private.sx_require_staff();
  return query
    select r.id, r.reason, r.reply_text, r.prompt_text, r.detail, r.created_at, r.reporter_id, p.username::text
    from public.sx_ai_reports r left join public.profiles p on p.id = r.reporter_id
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;
revoke all on function public.sx_staff_ai_reports(integer) from public, anon;
grant execute on function public.sx_staff_ai_reports(integer) to authenticated;
