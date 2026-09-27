// Scheduled Edge Function. Deletes only media paths with no unexpired
// message/story references, including paths shared by multiple snaps.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'snapshotx-media';
const BATCH = 200;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// verify_jwt is disabled for this function: the cron job supplies a dedicated
// Vault-generated token. No user JWT or public client can run Storage cleanup.
async function authorizedServerCall(req: Request): Promise<boolean> {
  const supplied = req.headers.get('x-snapshotx-job-key') || '';
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const { data: expected, error } = await supabase.rpc('sx_internal_job_token');
  if (error || typeof expected !== 'string') {
    console.error('Server invocation token unavailable', error?.message);
    return false;
  }
  let difference = supplied.length ^ expected.length;
  for (let i = 0; i < Math.max(supplied.length, expected.length); i++) {
    difference |= (supplied.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (!await authorizedServerCall(req)) return new Response('unauthorized', { status: 401 });
  try {
    const { data, error } = await supabase.rpc('sx_expired_media_paths', { p_limit: BATCH });
    if (error) throw error;
    const paths: string[] = (data || []).map((row: { media_path: string }) => row.media_path);
    if (!paths.length) return Response.json({ pathsDeleted: 0 });

    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;

    const deletedAt = new Date().toISOString();
    const messages = await supabase.from('sx_messages')
      .update({ media_deleted_at: deletedAt }).in('media_path', paths)
      .lt('expires_at', deletedAt).is('media_deleted_at', null);
    if (messages.error) throw messages.error;
    const stories = await supabase.from('sx_stories')
      .update({ media_deleted_at: deletedAt }).in('media_path', paths)
      .lt('expires_at', deletedAt).is('media_deleted_at', null);
    if (stories.error) throw stories.error;

    return Response.json({ pathsDeleted: paths.length });
  } catch (error) {
    console.error(error);
    return new Response('error', { status: 500 });
  }
});
