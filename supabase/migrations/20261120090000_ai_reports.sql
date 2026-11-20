-- Mijn AI: in-app melding van een AI-antwoord (Google Play beleid voor generatieve AI: gebruikers moeten aanstootgevende
-- AI-inhoud in de app kunnen melden). AI-chats worden niet op de server bewaard, dus de melding bevat zelf het gemelde
-- antwoord (+ optioneel de vraag ervoor). Gebruikers mogen alleen een eigen melding toevoegen; lezen is alleen voor
-- service_role / staff via SQL (geen client-select).
create table if not exists public.sx_ai_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('offensive', 'harmful', 'sexual', 'wrong', 'other')),
  reply_text text not null check (char_length(reply_text) between 1 and 2000),
  prompt_text text check (prompt_text is null or char_length(prompt_text) <= 1000),
  detail text check (detail is null or char_length(detail) <= 800),
  created_at timestamptz not null default now()
);
create index if not exists sx_ai_reports_created_idx on public.sx_ai_reports(created_at desc);
alter table public.sx_ai_reports enable row level security;
revoke all on public.sx_ai_reports from anon, authenticated;
grant insert on public.sx_ai_reports to authenticated;
drop policy if exists sx_ai_reports_insert on public.sx_ai_reports;
create policy sx_ai_reports_insert on public.sx_ai_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
drop policy if exists sx_active_ban_guard on public.sx_ai_reports;
create policy sx_active_ban_guard on public.sx_ai_reports as restrictive for all to authenticated using (not app_private.sx_request_is_banned()) with check (not app_private.sx_request_is_banned());
