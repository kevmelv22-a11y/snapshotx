import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ACCOUNT_REPORT_UNAVAILABLE, REPORT_REASONS, buildLegacyReportRow, buildReportRow, reasonsFor, reportError, reportReasonText, reportTitle, shouldFallBack, submitReport, targetFromParams } from './report-reasons.ts';
import { describeSnapshot, reportActions, reportCategory } from './staff-reports.ts';

const ME = '00000000-0000-4000-8000-0000000000a1', HIM = '00000000-0000-4000-8000-0000000000b2';

test('reasons: Snapchat-style list, impersonation only for accounts, ids match the migration check', () => {
  assert.ok(REPORT_REASONS.length >= 8);
  assert.ok(reasonsFor('account').some(r => r.id === 'impersonation'));
  assert.ok(!reasonsFor('message').some(r => r.id === 'impersonation'));
  assert.ok(!reasonsFor('story').some(r => r.id === 'impersonation'));
  const sql = readFileSync(new URL('../supabase/migrations/20261029030000_report_reasons_accounts.sql', import.meta.url), 'utf8');
  for (const r of REPORT_REASONS) assert.match(sql, new RegExp(`'${r.id}'`), r.id);
});

test('validation: a reason is required; "Iets anders" needs detail; detail max length', () => {
  assert.equal(reportError(null, ''), 'Kies waarom je dit meldt.');
  assert.equal(reportError('spam', ''), null);
  assert.match(reportError('other', 'kort'), /minstens 10/);
  assert.equal(reportError('other', 'Hij stuurt me steeds kettingbrieven'), null);
  assert.match(reportError('harassment', 'x'.repeat(801)), /langer dan 800/);
});

test('reason text always fits the sx_reports check (10..1000) and starts with the category', () => {
  for (const r of REPORT_REASONS) {
    const t = reportReasonText(r.id, '');
    assert.ok(t.length >= 10 && t.length <= 1000, r.id);
    assert.ok(t.startsWith(r.label));
  }
  assert.equal(reportReasonText('threat', '  stuur je adres  maar '), 'Bedreiging, geweld of gevaar: stuur je adres maar');
  assert.ok(reportReasonText('other', 'a'.repeat(2000)).length <= 1000);
});

test('rows: message/story/account targets fill the right columns', () => {
  assert.deepEqual(buildReportRow(ME, { kind: 'message', id: 'm1' }, 'hate', ''),
    { reporter_id: ME, message_id: 'm1', story_id: null, reason: 'Haatzaaiende uitlatingen', category: 'hate', target_user_id: null });
  const acc = buildReportRow(ME, { kind: 'account', id: HIM, name: 'Cleo' }, 'impersonation', 'gebruikt mijn foto');
  assert.equal(acc.target_user_id, HIM); assert.equal(acc.message_id, null); assert.equal(acc.story_id, null);
  assert.deepEqual(Object.keys(buildLegacyReportRow(ME, { kind: 'story', id: 's1' }, 'spam', '')).sort(), ['message_id', 'reason', 'reporter_id', 'story_id']);
});

test('route params: message > story > account; user_id alone is an account report', () => {
  assert.deepEqual(targetFromParams({ message_id: 'm1', user_id: HIM }), { kind: 'message', id: 'm1' });
  assert.deepEqual(targetFromParams({ story_id: 's1', user_id: HIM }), { kind: 'story', id: 's1' });
  assert.deepEqual(targetFromParams({ user_id: HIM, name: 'Cleo' }), { kind: 'account', id: HIM, name: 'Cleo' });
  assert.equal(targetFromParams({}), null);
  assert.equal(reportTitle('account'), 'Account melden');
});

test('submit: new columns first; legacy retry for message/story when the migration is missing', async () => {
  const missing = { code: 'PGRST204', message: "Could not find the 'category' column of 'sx_reports' in the schema cache" };
  assert.ok(shouldFallBack(missing));
  assert.ok(!shouldFallBack({ code: '23514', message: 'violates check constraint' }));
  const calls = [];
  const res = await submitReport(async row => { calls.push(row); return { error: calls.length === 1 ? missing : null }; }, ME, { kind: 'message', id: 'm1' }, 'nudity', '');
  assert.deepEqual(res, { error: null, legacy: true });
  assert.equal(calls.length, 2); assert.equal(calls[1].category, undefined); assert.equal(calls[1].reason, 'Naaktheid of seksuele inhoud');

  const ok = await submitReport(async () => ({ error: null }), ME, { kind: 'account', id: HIM }, 'spam', '');
  assert.deepEqual(ok, { error: null, legacy: false });
});

test('submit: an account report never falls back (live policy needs a message/story) and explains why', async () => {
  let n = 0;
  const res = await submitReport(async () => { n++; return { error: { code: 'PGRST204', message: 'Could not find the column' } }; }, ME, { kind: 'account', id: HIM }, 'harassment', '');
  assert.equal(n, 1);
  assert.equal(res.error.message, ACCOUNT_REPORT_UNAVAILABLE);
});

test('staff console: account reports get their own category and a profile snapshot; warn/ban possible, delete not', () => {
  const r = { id: 'r9', status: 'open', message_id: null, story_id: null, reported_user_id: HIM, target_user_id: HIM,
    content_snapshot: { type: 'profile', display_name: 'Cleo', username: 'cleo_echt' } };
  assert.equal(reportCategory(r), 'account');
  assert.equal(reportCategory({ ...r, target_user_id: undefined }), 'account');
  assert.equal(reportCategory({ message_id: 'm1', story_id: null, content_snapshot: { type: 'message', kind: 'text' } }), 'chat');
  const v = describeSnapshot(r);
  assert.equal(v.title, 'Account'); assert.equal(v.text, 'Cleo · @cleo_echt'); assert.equal(v.missing, false);
  const acts = Object.fromEntries(reportActions(r).map(a => [a.action, a.enabled]));
  assert.deepEqual(acts, { warn: true, delete_content: false, ban_user: true });
});
