import assert from 'node:assert/strict';
import test from 'node:test';
import { actionConfirmText, auditLinkedToReport, buildReportActionArgs, describeSnapshot, reportActions, reportOutcomeLabel } from './staff-reports.ts';

const U = '00000000-0000-4000-8000-0000000000b1';
const msgReport = { id: 'r1', status: 'open', message_id: 'm1', story_id: null, reported_user_id: U,
  content_snapshot: { type: 'message', kind: 'text', body: 'Je bent een sukkel', has_media: false, sender_id: U } };
const storyReport = { id: 'r2', status: 'reviewing', message_id: null, story_id: 's1', reported_user_id: U,
  content_snapshot: { type: 'story', media_type: 'video', caption: 'Kijk', visibility: 'everyone', has_media: true } };

test('message snapshot shows the reported text', () => {
  const v = describeSnapshot(msgReport);
  assert.equal(v.title, 'Tekstbericht');
  assert.equal(v.text, 'Je bent een sukkel');
  assert.equal(v.media, null);
  assert.equal(v.missing, false);
});

test('story snapshot shows caption, media type and visibility', () => {
  const v = describeSnapshot(storyReport);
  assert.equal(v.title, 'Story');
  assert.equal(v.text, 'Kijk');
  assert.equal(v.media, 'Video-story');
  assert.deepEqual(v.meta, ['Openbaar']);
});

test('media-only snap and legacy report without snapshot', () => {
  const snap = describeSnapshot({ message_id: 'm', story_id: null, content_snapshot: { type: 'message', kind: 'snap', body: null, has_media: true, view_once: true } });
  assert.equal(snap.text, null);
  assert.match(snap.media, /Snap/);
  assert.deepEqual(snap.meta, ['Eenmalig bekijken']);
  const legacy = describeSnapshot({ message_id: 'm', story_id: null, content_snapshot: null });
  assert.equal(legacy.missing, true);
});

test('available actions depend on status, reported user and remaining content', () => {
  assert.deepEqual(reportActions(msgReport).map(a => [a.action, a.enabled]), [['warn', true], ['delete_content', true], ['ban_user', true]]);
  const noUser = reportActions({ ...msgReport, reported_user_id: null });
  assert.equal(noUser.find(a => a.action === 'ban_user').enabled, false);
  assert.equal(noUser.find(a => a.action === 'delete_content').enabled, true);
  const gone = reportActions({ ...msgReport, message_id: null });
  assert.equal(gone.find(a => a.action === 'delete_content').why, 'Content bestaat niet meer.');
  assert.ok(reportActions({ ...msgReport, status: 'resolved' }).every(a => !a.enabled));
});

test('RPC args for report actions are validated and linked to the report id', () => {
  assert.deepEqual(buildReportActionArgs(msgReport, 'ban_user', '  herhaald beledigen ', 60),
    { ok: true, args: { p_report_id: 'r1', p_action: 'ban_user', p_reason: 'herhaald beledigen', p_duration_minutes: 60 } });
  assert.deepEqual(buildReportActionArgs(msgReport, 'ban_user', 'permanent weg', null).args.p_duration_minutes, null);
  assert.equal(buildReportActionArgs(msgReport, 'warn', 'kort').ok, false);
  assert.equal(buildReportActionArgs(msgReport, 'warn', 'lang genoeg nu', 60).error, 'Een duur geldt alleen voor bans.');
  assert.equal(buildReportActionArgs(msgReport, 'ban_user', 'lang genoeg nu', 600000).ok, false);
  assert.equal(buildReportActionArgs({ ...msgReport, status: 'dismissed' }, 'warn', 'lang genoeg nu').error, 'Melding is al afgehandeld.');
  assert.deepEqual(buildReportActionArgs(storyReport, 'delete_content', 'ongepaste story').args,
    { p_report_id: 'r2', p_action: 'delete_content', p_reason: 'ongepaste story', p_duration_minutes: null });
});

test('audit rows are linked to a report via entity or metadata.report_id', () => {
  assert.ok(auditLinkedToReport({ action: 'sx_staff_report_action', entity_type: 'sx_report', entity_id: 'r1', metadata: {} }, 'r1'));
  assert.ok(auditLinkedToReport({ action: 'sx_staff_ban_create', entity_type: 'sx_staff_ban', entity_id: 'b9', metadata: { report_id: 'r1' } }, 'r1'));
  assert.ok(!auditLinkedToReport({ action: 'sx_staff_ban_create', entity_type: 'sx_staff_ban', entity_id: 'b9', metadata: { report_id: 'r2' } }, 'r1'));
  assert.ok(!auditLinkedToReport({ action: 'sx_staff_chat_open', entity_type: 'sx_thread', entity_id: 'r1', metadata: null }, 'r1'));
});

test('outcome label and confirm copy', () => {
  assert.equal(reportOutcomeLabel({ status: 'resolved', action_taken: 'ban_user' }), 'Afgehandeld · Gebruiker bannen');
  assert.equal(reportOutcomeLabel({ status: 'dismissed', action_taken: null }), 'Afgewezen');
  assert.equal(actionConfirmText('ban_user', '@bart', '24 uur').destructive, true);
  assert.match(actionConfirmText('ban_user', '@bart', '24 uur').message, /@bart.*24 uur/);
  assert.equal(actionConfirmText('warn', '@bart').destructive, false);
});
