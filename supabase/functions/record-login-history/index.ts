import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isIP } from "node:net";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !authorization) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  let payload: { device_id?: unknown; device_label?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders }); }
  if (typeof payload.device_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.device_id)) {
    return Response.json({ error: "Invalid device identifier" }, { status: 400, headers: corsHeaders });
  }

  const rawIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  const ip = rawIp && isIP(rawIp.trim()) ? rawIp.trim() : null;
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.from("sx_login_history").insert({
    user_id: user.id,
    device_id: payload.device_id,
    device_label: typeof payload.device_label === "string" ? payload.device_label.slice(0, 120) : null,
    ip_address: ip,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });
  if (error) return Response.json({ error: "Loginregistratie mislukt" }, { status: 500, headers: corsHeaders });
  return Response.json({ ok: true }, { headers: corsHeaders });
});
