// Step 9: scheduled Edge Function (NOT DEPLOYED). Runs the row cleanup, then the
// existing cleanup-media function removes now-unreferenced Storage objects.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req: Request) => {
  const key = req.headers.get('x-snapshotx-job-key') || '';
  const { data: expected } = await supabase.rpc('sx_internal_job_token');
  if (!/^[a-f0-9]{64}$/i.test(key) || key !== expected) return new Response('forbidden', { status: 403 });
  const { data, error } = await supabase.schema('app_private').rpc('sx_disappear_cleanup');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, deleted: data });
});
