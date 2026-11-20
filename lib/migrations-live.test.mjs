import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// docs/engineering/MIGRATIONS_LIVE.md must mention every repo migration that is NOT live under its own name, and the
// staff_ai_reports migration (21 nov) must be listed as live — so the launch checklist never points at stale "open" migrations again.
test('migration inventory doc covers the not-live-by-name files and the newest migration', async () => {
  const doc = await readFile(new URL('../docs/engineering/MIGRATIONS_LIVE.md', import.meta.url), 'utf8');
  const files = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort();
  for (const f of ['20261007150000_avatar_outfits', '20261010110000_staff_console_quick_fixes', '20261012090000_staff_moderation_consolidated', '20261013190000_push_tokens_devices', '20261013190100_media_buckets', '20261019120000_sx_data_api_grants_rls'])
    assert.ok(doc.includes(f), f);
  assert.ok(files.some(f => f.startsWith('20261121000000_staff_ai_reports')) && doc.includes('staff_ai_reports'));
  const meta = await readFile(new URL('../docs/app-store/METADATA_NL.md', import.meta.url), 'utf8');
  assert.doesNotMatch(meta, /\[ \] Openstaande Supabase-migraties/);
  assert.match(meta, /5\.1\.2\(i\)/);
});
