import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as R from './staff-ai-reports.ts';

const row = (id, reason, at) => ({ id, reason, reply_text: 'x', prompt_text: null, detail: null, created_at: at, reporter_id: 'u', reporter_username: 'lisa' });
test('AI reports: clean, newest first, reason labels + counts', () => {
  assert.deepEqual(R.cleanAiReports(null), []);
  const rows = R.cleanAiReports([row('a', 'wrong', '2026-11-19T10:00:00Z'), { id: 1 }, row('b', 'offensive', '2026-11-20T10:00:00Z'), row('c', 'wrong', '2026-11-18T10:00:00Z')]);
  assert.deepEqual(rows.map(r => r.id), ['b', 'a', 'c']);
  assert.equal(R.aiReasonLabel('wrong'), 'Klopt niet / misleidend'); assert.equal(R.aiReasonLabel('??'), 'Iets anders');
  assert.deepEqual(R.aiReasonCounts(rows).map(c => `${c.reason}:${c.count}`), ['offensive:1', 'wrong:2']);
});
test('migration: staff-only read RPC, no anon, no data/policy changes; staff panel uses it', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261121000000_staff_ai_reports.sql', import.meta.url), 'utf8');
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /perform app_private\.sx_require_staff\(\);/);
  assert.match(sql, /revoke all on function public\.sx_staff_ai_reports\(integer\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.sx_staff_ai_reports\(integer\) to authenticated;/);
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\b(delete|update|insert|drop|truncate|alter)\b/i);
  const ui = await readFile(new URL('../app/staff/index.tsx', import.meta.url), 'utf8');
  assert.match(ui, /rpc\('sx_staff_ai_reports'/); assert.match(ui, /id: 'ai', label: AI_REPORTS_TEXT\.nav/);
});
