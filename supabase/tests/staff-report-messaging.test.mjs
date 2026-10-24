import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/20261024120000_staff_report_messaging.sql', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../../app/staff/index.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../../components/staff/ReportConversationModal.tsx', import.meta.url), 'utf8');
const mock = readFileSync(new URL('../../lib/staff-mock.ts', import.meta.url), 'utf8');
const chatList = readFileSync(new URL('../../lib/chat-list.ts', import.meta.url), 'utf8');

function functionBody(name) {
  const marker = `create or replace function public.${name}(`;
  const start = migration.indexOf(marker);
  assert.notEqual(start, -1, `${name} exists`);
  const end = migration.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `${name} body closes`);
  return migration.slice(start, end);
}

test('report conversation table has one isolated reporter and reported-user thread per report', () => {
  assert.match(migration, /audience text not null check \(audience in \('reporter','reported'\)\)/);
  assert.match(migration, /unique \(report_id, audience\)/);
  assert.match(migration, /thread_id uuid not null unique references public\.sx_threads/);
  assert.match(migration, /creator_id uuid references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.sx_report_conversations from public, anon, authenticated/i);
  assert.match(migration, /sx_cleanup_report_conversation_thread/);
  assert.match(migration, /sx_report_message_expiry/);
  assert.match(migration, /if exists \(select 1 from public\.sx_report_conversations rc where rc\.thread_id=m\.thread_id\) then return new; end if;/);
  assert.match(migration, /greatest\(coalesce\(expires_at, now\(\)\), new\.opened_at \+ interval '24 hours'\)/);
  assert.match(migration, /fixed 24-hour expiry/);
  assert.match(migration, /where not exists \(select 1 from public\.sx_report_conversations rc where rc\.thread_id=t\.id\)/);
  assert.match(migration, /report conversations must be opened from the report/);
});

test('recipient resolution uses the reporter id and the server-captured reported_user_id', () => {
  const helper = migration.slice(migration.indexOf('create or replace function app_private.sx_report_conversation_recipient('), migration.indexOf('\n$$;', migration.indexOf('create or replace function app_private.sx_report_conversation_recipient(')));
  assert.match(helper, /return v_report\.reporter_id/);
  assert.match(helper, /return v_report\.reported_user_id/);
  assert.doesNotMatch(helper, /p_reporter_id/);
});

test('conversation reads require staff authorization, a purpose reason, bounded reads, and an audit row', () => {
  const read = functionBody('sx_staff_report_conversation');
  assert.match(read, /sx_require_staff\(\)/);
  assert.match(read, /char_length\(trim\(coalesce\(p_reason,''\)\)\) < 10/);
  assert.match(read, /sx_staff_report_conversation_open/);
  assert.match(read, /app_private\.sx_audit_meta/);
  assert.match(read, /limit 100/);
  assert.match(read, /msg\.media_deleted_at/);
  assert.match(read, /msg\.expires_at is null or msg\.expires_at > now\(\)/);
  assert.doesNotMatch(read, /media_path/);
});

test('staff sends are authorized, bounded, expire after 24 hours and do not audit message text', () => {
  const send = functionBody('sx_staff_send_report_message');
  assert.match(send, /sx_require_staff\(\)/);
  assert.match(send, /char_length\(trim\(coalesce\(p_body,''\)\)\) < 1/);
  assert.match(send, /char_length\(p_body\) > 2000/);
  assert.match(send, /char_length\(trim\(coalesce\(p_reason,''\)\)\) < 10/);
  assert.match(send, /now\(\) \+ interval '24 hours'/);
  assert.match(send, /report_id, p_audience/);
  const audit = send.slice(send.indexOf("'sx_staff_report_message_sent'"));
  assert.match(audit, /recipient_id/);
  assert.match(audit, /character_count/);
  assert.match(audit, /'reason', trim\(p_reason\)/);
  assert.doesNotMatch(audit, /jsonb_build_object\([^;]*['"](?:body|message_body)['"]\s*,\s*p_body/s);
});

test('the latest staffconsole exposes distinct audience actions and routes them through the secure modal', () => {
  assert.match(screen, /ReportConversationModal/);
  assert.match(screen, /onMessage=/);
  assert.match(screen, /Bericht aan melder/);
  assert.match(screen, /Bericht aan gemelde gebruiker/);
  assert.match(modal, /sx_staff_report_conversation/);
  assert.match(modal, /sx_staff_send_report_message/);
  assert.match(modal, /p_reason: reasonRef\.current\.trim\(\)/);
  assert.match(modal, /minimaal 10 tekens/);
  assert.match(modal, /Berichten in dit tijdelijke gesprek verlopen na 24 uur/);
  assert.match(modal, /isStaffMock\(\)/);
  assert.match(mock, /sx_staff_report_conversation/);
  assert.match(mock, /sx_staff_send_report_message/);
  assert.match(chatList, /isReportSupport/);
  assert.match(modal, /Berichten vervallen na 24 uur|Berichten in dit tijdelijke gesprek verlopen na 24 uur/);
});
