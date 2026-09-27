// Draft only: deploy after the account_deletion migration is approved and applied.
// verify_jwt=false: this function validates the caller's bearer token itself,
// because publishable API keys are not JWTs. The service-role key stays server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type ObjectPath = { bucket_id: string; object_name: string };

async function removeAccountFiles(userId: string) {
  // Each loop re-reads the first page, so removal can be safely retried.
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await admin.rpc('sx_account_storage_paths', {
      p_user_id: userId, p_limit: 100,
    });
    if (error) throw error;
    const paths = (data || []) as ObjectPath[];
    if (!paths.length) return;
    const buckets = [...new Set(paths.map((item) => item.bucket_id))];
    for (const bucket of buckets) {
      const names = paths.filter((item) => item.bucket_id === bucket).map((item) => item.object_name);
      const { error: removeError } = await admin.storage.from(bucket).remove(names);
      if (removeError) throw removeError;
    }
  }
  throw new Error('Too many files for one deletion request; retry or contact support');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { data: identity, error: identityError } = await admin.auth.getUser(token);
  if (identityError || !identity.user) return new Response('Unauthorized', { status: 401 });
  const userId = identity.user.id;
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== 'VERWIJDER') return new Response('Confirmation required', { status: 400 });

  try {
    const { error: markError } = await admin.rpc('sx_mark_account_deletion', { p_user_id: userId });
    if (markError) throw markError;
    await removeAccountFiles(userId);
    const { error: purgeError } = await admin.rpc('sx_purge_account_data', { p_user_id: userId });
    if (purgeError) throw purgeError;
    // The pending flag rejects fresh media uploads while the account still exists.
    await removeAccountFiles(userId);
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    const { error: finishError } = await admin.rpc('sx_finish_account_deletion', { p_user_id: userId });
    if (finishError) console.error('Account removed but deletion marker cleanup failed', finishError.message);
    return Response.json({ deleted: true });
  } catch (error) {
    // The account remains usable unless Auth deletion succeeded. Keep the pending
    // marker on failure so no new media is uploaded while a retry is arranged.
    console.error('Account deletion failed for user', userId, error);
    return Response.json({ deleted: false, error: 'Verwijderen is niet afgerond. Probeer opnieuw of neem contact op met support.' }, { status: 500 });
  }
});
