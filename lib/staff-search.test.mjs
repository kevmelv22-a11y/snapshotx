import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUserSearchArgs, isIdPrefixQuery, isMissingBackend, normalizeSearchQuery, pageInfo, totalFromRows } from './staff-search.ts';

test('query is trimmed, whitespace collapsed and capped at 64 chars like the server', () => {
  assert.equal(normalizeSearchQuery('  bea   de  vries '), 'bea de vries');
  assert.equal(normalizeSearchQuery(null), '');
  assert.equal(normalizeSearchQuery('x'.repeat(100)).length, 64);
});

test('page -> limit/offset, with clamping', () => {
  assert.deepEqual(buildUserSearchArgs('bea'), { p_query: 'bea', p_limit: 25, p_offset: 0 });
  assert.deepEqual(buildUserSearchArgs('bea', 2), { p_query: 'bea', p_limit: 25, p_offset: 50 });
  assert.deepEqual(buildUserSearchArgs('', -3, 500), { p_query: '', p_limit: 50, p_offset: 0 });
  assert.deepEqual(buildUserSearchArgs('a', 1.7, 10), { p_query: 'a', p_limit: 10, p_offset: 10 });
});

test('wildcards are passed through untouched (escaped server-side)', () => {
  assert.equal(buildUserSearchArgs('100%_mod').p_query, '100%_mod');
});

test('id-prefix rule matches the SQL (4-36 hex/dash)', () => {
  assert.ok(isIdPrefixQuery('3fa8'));
  assert.ok(isIdPrefixQuery('3FA85F64-5717'));
  assert.ok(!isIdPrefixQuery('3fa'));
  assert.ok(!isIdPrefixQuery('bart'));
});

test('page info for the "1-25 van N" label and pager buttons', () => {
  assert.deepEqual(pageInfo(130, 0), { from: 1, to: 25, total: 130, page: 0, pages: 6, hasPrev: false, hasNext: true });
  assert.deepEqual(pageInfo(130, 5, 25, 5), { from: 126, to: 130, total: 130, page: 5, pages: 6, hasPrev: true, hasNext: false });
  assert.deepEqual(pageInfo(0, 3), { from: 0, to: 0, total: 0, page: 0, pages: 1, hasPrev: false, hasNext: false });
  assert.equal(pageInfo(130, 99).page, 5, 'page is clamped to the last page');
});

test('total_count comes from the first row (bigint may arrive as string)', () => {
  assert.equal(totalFromRows([{ total_count: '42' }, { total_count: '42' }]), 42);
  assert.equal(totalFromRows([{ total_count: 7 }]), 7);
  assert.equal(totalFromRows([]), 0);
  assert.equal(totalFromRows(null), 0);
});

test('missing RPC / column is detected so the panel can fall back before the migration is applied', () => {
  assert.ok(isMissingBackend({ code: 'PGRST202', message: 'Could not find the function public.sx_staff_search_users' }));
  assert.ok(isMissingBackend({ code: '42703', message: 'column sx_reports.content_snapshot does not exist' }));
  assert.ok(!isMissingBackend({ code: '42501', message: 'not authorized' }));
  assert.ok(!isMissingBackend(null));
});
