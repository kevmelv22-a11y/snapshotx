import assert from 'node:assert/strict';
import test from 'node:test';
import * as G from './group-chat.ts';
import { DemoClient } from './demo-client.ts';
import { MOCK_IDS } from './staff-mock.ts';

const ME = 'me', CR = 'creator';

test('isGroupThread: flag, name or >2 members', () => {
  assert.equal(G.isGroupThread({ memberCount: 2 }), false);
  assert.equal(G.isGroupThread({ title: '  ', memberCount: 2 }), false);
  assert.equal(G.isGroupThread({ title: 'Crew', memberCount: 2 }), true);
  assert.equal(G.isGroupThread({ memberCount: 3 }), true);
  assert.equal(G.isGroupThread({ isGroup: true, memberCount: 2 }), true);
});

test('normalizeGroupTitle trims, collapses spaces, caps at 80, rejects empty', () => {
  assert.equal(G.normalizeGroupTitle('  Weekend   crew '), 'Weekend crew');
  assert.equal(G.normalizeGroupTitle('x'.repeat(100)).length, G.GROUP_TITLE_MAX);
  for (const bad of ['', '   ', null, undefined, 42]) assert.equal(G.normalizeGroupTitle(bad), null);
  assert.equal(G.groupDisplayTitle(null, ['Aria', 'Eva', 'Cleo']), 'Aria, Eva en Cleo');
  assert.equal(G.groupDisplayTitle(' Crew ', ['Aria']), 'Crew');
  assert.equal(G.groupDisplayTitle('', []), 'Chat');
});

test('permissions: any member renames/adds, only the creator removes others (never self)', () => {
  const ids = [ME, CR, 'lisa'];
  assert.equal(G.canRename(true), true); assert.equal(G.canRename(false), false);
  assert.equal(G.canAddMembers(true, 19), true); assert.equal(G.canAddMembers(true, 20), false); assert.equal(G.canAddMembers(false, 3), false);
  assert.equal(G.canRemoveMember(CR, CR, 'lisa', ids), true);
  assert.equal(G.canRemoveMember(CR, CR, CR, ids), false);
  assert.equal(G.canRemoveMember(ME, CR, 'lisa', ids), false);
  assert.equal(G.canRemoveMember(CR, CR, 'stranger', ids), false);
  assert.equal(G.canRemoveMember(CR, null, 'lisa', ids), false);
});

test('member limit: 20 including yourself', () => {
  assert.equal(G.GROUP_MAX_MEMBERS, 20);
  assert.equal(G.remainingSlots(5), 15); assert.equal(G.remainingSlots(25), 0);
  assert.equal(G.validateAdd(5, []), 'Kies minstens één vriend.');
  assert.equal(G.validateAdd(18, ['a', 'b']), null);
  assert.match(G.validateAdd(19, ['a', 'b']), /nog maar 1 persoon/);
  assert.match(G.validateAdd(20, ['a']), /vol \(max 20/);
  assert.equal(G.validateAdd(18, ['a', 'a', 'b']), null, 'duplicates count once');
  assert.equal(G.canSelectMore(18, 1), true); assert.equal(G.canSelectMore(18, 2), false);
  assert.deepEqual(G.addableFriends([{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: ME }], [ME]).map(f => f.id), ['a', 'b']);
});

test('system lines (Dutch) and the 👥 detector', () => {
  assert.equal(G.groupRenameText('Kevin', 'Strandclub'), 'Kevin heeft de groep hernoemd naar Strandclub');
  assert.equal(G.groupAddText('Kevin', ['Lisa']), 'Kevin heeft Lisa toegevoegd');
  assert.equal(G.groupAddText('Kevin', ['Lisa', 'Tim', 'Noor']), 'Kevin heeft Lisa, Tim en Noor toegevoegd');
  assert.equal(G.groupRemoveText('Kevin', 'Lisa'), 'Kevin heeft Lisa uit de groep verwijderd');
  assert.equal(G.groupLeaveText('Lisa'), 'Lisa heeft de groep verlaten');
  assert.equal(G.groupLeaveText('  '), 'Iemand heeft de groep verlaten');
  assert.ok(G.groupRenameText('K', 'x'.repeat(300)).length <= 200);
  for (const t of [G.groupRenameText('K', 'X'), G.groupAddText('K', ['L']), G.groupRemoveText('K', 'L'), G.groupLeaveText('L')]) assert.equal(G.isGroupChangeText(t), true, t);
  for (const t of ['Kevin heeft een screenshot gemaakt', 'Kevin bewaart chats in dit gesprek voortaan', null, '']) assert.equal(G.isGroupChangeText(t), false, String(t));
});

test('sortMembers: me, creator, then name', () => {
  const s = G.sortMembers([{ id: 'z', name: 'Zoë' }, { id: CR, name: 'Bram' }, { id: 'a', name: 'Aria' }, { id: ME, name: 'Kevin' }], ME, CR);
  assert.deepEqual(s.map(m => m.id), [ME, CR, 'a', 'z']);
});

test('groupErrorText maps RPC exceptions, falls back to null', () => {
  assert.match(G.groupErrorText({ message: G.GROUP_ERRORS.notCreator }), /Alleen de maker/);
  assert.match(G.groupErrorText({ message: `P0001: ${G.GROUP_ERRORS.full}` }), /vol/);
  assert.match(G.groupErrorText({ code: 'PGRST202', message: 'Could not find the function public.sx_leave_group' }), /database-update/);
  assert.equal(G.groupErrorText({ message: 'permission denied' }), null);
  assert.equal(G.groupErrorText(null), null);
});

// The web demo must behave like the SQL RPCs (same rules, same lines). Demo seed: Kevin created "Weekend crew"
// with Noor, Eva, Cleo and Aria; Kevin's friends are Aria, Eva, Cleo and Noor.
const CREW = 'c0000000-0000-4000-8000-000000000002';
// Group-change lines only (the demo seed also has Eva's unsent-chat line, which is a system row too).
const lines = (c) => c.m.table('sx_messages').filter(m => m.thread_id === CREW && m.kind === 'system' && !m.unsent_at).map(m => m.body);
const members = (c) => c.m.table('sx_members').filter(m => m.thread_id === CREW).map(m => m.user_id);

test('demo client: rename, remove, add back, limits and errors', async () => {
  const c = new DemoClient(), I = MOCK_IDS;
  let r = await c.rpc('sx_rename_group', { p_thread_id: CREW, p_title: '  Strand   club ' });
  assert.equal(r.error, null); assert.equal(r.data, 'Strand club');
  assert.equal((await c.rpc('sx_rename_group', { p_thread_id: CREW, p_title: '  ' })).error.message, G.GROUP_ERRORS.badTitle);
  r = await c.rpc('sx_remove_group_member', { p_thread_id: CREW, p_user_id: I.cleo });
  assert.equal(r.error, null); assert.ok(!members(c).includes(I.cleo));
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: CREW, p_user_id: I.owner })).error.message, G.GROUP_ERRORS.self);
  r = await c.rpc('sx_add_group_members', { p_thread_id: CREW, p_user_ids: [I.cleo, I.aria] });
  assert.equal(r.data, 1, 'Aria was already in'); assert.ok(members(c).includes(I.cleo));
  assert.equal((await c.rpc('sx_add_group_members', { p_thread_id: CREW, p_user_ids: [I.bram] })).error.message, G.GROUP_ERRORS.notFriend);
  assert.deepEqual(lines(c), ['Kevin heeft de groep hernoemd naar Strand club', 'Kevin heeft Cleo Jansen uit de groep verwijderd', 'Kevin heeft Cleo Jansen toegevoegd']);
  // 1-on-1 chats are not groups.
  assert.equal((await c.rpc('sx_rename_group', { p_thread_id: 'c0000000-0000-4000-8000-0000000000a1', p_title: 'X' })).error.message, G.GROUP_ERRORS.notGroup);
});

test('demo client: max 20 members, non-creator cannot remove, leaving hands over and hides the thread', async () => {
  const c = new DemoClient(), I = MOCK_IDS;
  const extra = Array.from({ length: 16 }, (_, i) => `f${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`);
  extra.forEach(id => { c.m.table('profiles').push({ id, display_name: `Vriend ${id.slice(0, 3)}` }); c.m.table('sx_friends').push({ user_id: I.owner, friend_id: id }); });
  assert.equal((await c.rpc('sx_add_group_members', { p_thread_id: CREW, p_user_ids: extra })).error.message, G.GROUP_ERRORS.full);
  assert.equal((await c.rpc('sx_add_group_members', { p_thread_id: CREW, p_user_ids: extra.slice(0, 15) })).data, 15);
  assert.equal(members(c).length, 20);
  c.m.table('sx_threads').find(t => t.id === CREW).created_by = I.aria;
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: CREW, p_user_id: I.eva })).error.message, G.GROUP_ERRORS.notAllowed);
  c.m.table('sx_threads').find(t => t.id === CREW).created_by = I.owner;
  assert.equal((await c.rpc('sx_leave_group', { p_thread_id: CREW })).error, null);
  assert.ok(!members(c).includes(I.owner));
  assert.notEqual(c.m.table('sx_threads').find(t => t.id === CREW).created_by, I.owner, 'creator role handed over');
  assert.equal(lines(c).at(-1), 'Kevin heeft de groep verlaten');
  assert.equal((await c.rpc('sx_leave_group', { p_thread_id: CREW })).error.message, G.GROUP_ERRORS.notMember);
  const mine = await c.from('sx_members').select('thread_id').eq('user_id', I.owner);
  assert.ok(!mine.data.some(x => x.thread_id === CREW), 'group gone from my chat list');
});

// Remove rights (migration 20261027200000_group_remove_rights.sql): admin + can_remove_members.
const AD = 'admin', MOD = 'mod', BOB = 'bob', ALL = [AD, MOD, BOB, 'zoe'];
const R = { adminId: AD, memberIds: ALL, removers: [MOD] };

test('canRemoveMember: admin or remover, never the admin, never yourself', () => {
  assert.equal(G.canRemoveMember(AD, AD, BOB, ALL, [MOD]), true, 'admin removes a member');
  assert.equal(G.canRemoveMember(AD, AD, MOD, ALL, [MOD]), true, 'admin removes a remover');
  assert.equal(G.canRemoveMember(MOD, AD, BOB, ALL, [MOD]), true, 'remover removes a member');
  assert.equal(G.canRemoveMember(MOD, AD, AD, ALL, [MOD]), false, 'admin is never removable');
  assert.equal(G.canRemoveMember(BOB, AD, 'zoe', ALL, [MOD]), false, 'plain member has no rights');
  assert.equal(G.canRemoveMember(MOD, AD, MOD, ALL, [MOD]), false, 'not yourself');
  assert.equal(G.canRemoveMember(AD, AD, AD, ALL, []), false, 'admin cannot remove itself');
  assert.equal(G.canRemoveMember('outsider', AD, BOB, ALL, ['outsider']), false, 'non-member remover');
  assert.equal(G.canRemoveMember(MOD, null, BOB, ALL, [MOD]), false, 'no admin known');
  assert.equal(G.hasRemoveRights(MOD, R), true); assert.equal(G.hasRemoveRights(BOB, R), false); assert.equal(G.hasRemoveRights(AD, R), true);
  assert.equal(G.roleOf(AD, AD), 'admin'); assert.equal(G.roleOf(BOB, AD), 'member');
});

test('canGrantRights: admin only, never on itself or the admin', () => {
  assert.equal(G.canGrantRights(AD, AD, BOB, ALL), true);
  assert.equal(G.canGrantRights(AD, AD, AD, ALL), false);
  assert.equal(G.canGrantRights(MOD, AD, BOB, ALL), false, 'removers cannot grant');
  assert.equal(G.canGrantRights(BOB, AD, 'zoe', ALL), false);
  assert.equal(G.canGrantRights(AD, AD, 'stranger', ALL), false);
});

test('memberActions: menus for admin, remover, member, yourself and the admin', () => {
  const L = (me, t) => G.memberActions(me, t, R).map(k => G.MEMBER_ACTION[k]);
  assert.deepEqual(L(AD, BOB), ['Profiel bekijken', 'Bericht sturen', 'Rechten geven: kan leden verwijderen', 'Verwijderen uit groep']);
  assert.deepEqual(L(AD, MOD), ['Profiel bekijken', 'Bericht sturen', 'Rechten ontnemen: kan leden verwijderen', 'Verwijderen uit groep']);
  assert.deepEqual(L(MOD, BOB), ['Profiel bekijken', 'Bericht sturen', 'Verwijderen uit groep']);
  assert.deepEqual(L(MOD, AD), ['Profiel bekijken', 'Bericht sturen']);
  assert.deepEqual(L(BOB, 'zoe'), ['Profiel bekijken', 'Bericht sturen']);
  assert.deepEqual(L(BOB, BOB), ['Profiel bekijken']);
  assert.deepEqual(L(AD, AD), ['Profiel bekijken']);
  assert.deepEqual(G.memberActions(AD, '', R), []);
  assert.equal(G.removeConfirmText('Eva'), 'Weet je zeker dat je Eva uit de groep wilt verwijderen?');
  assert.equal(G.groupErrorText({ message: G.GROUP_ERRORS.adminProtected }), 'De beheerder van de groep kan niet worden verwijderd.');
  assert.equal(G.isGroupChangeText(G.groupRightsText('Kevin', 'Eva', true)), true);
  assert.equal(G.isGroupChangeText(G.groupRightsText('Kevin', 'Eva', false)), true);
});

test('demo client: rights — grant, remover removes, admin protected, realtime DELETE', async () => {
  const c = new DemoClient(), I = MOCK_IDS, FEST = 'c0000000-0000-4000-8000-0000000000a4';
  const events = [];
  c.channel('t').on('postgres_changes', { event: '*', schema: 'public', table: 'sx_members' }, e => events.push(e)).subscribe();
  assert.equal((await c.rpc('sx_set_can_remove_members', { p_thread_id: CREW, p_user_id: I.cleo, p_value: true })).data, true);
  assert.ok(c.m.table('sx_members').find(m => m.thread_id === CREW && m.user_id === I.cleo).can_remove_members);
  assert.equal((await c.rpc('sx_set_can_remove_members', { p_thread_id: CREW, p_user_id: I.cleo, p_value: false })).data, false);
  // Kevin is a plain member of Aria's Festival squad: no grant, no remove, admin untouchable.
  assert.equal((await c.rpc('sx_set_can_remove_members', { p_thread_id: FEST, p_user_id: I.eva, p_value: true })).error.message, G.GROUP_ERRORS.notAdmin);
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: FEST, p_user_id: I.eva })).error.message, G.GROUP_ERRORS.notAllowed);
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: FEST, p_user_id: I.aria })).error.message, G.GROUP_ERRORS.adminProtected);
  // Admin gives Kevin... (simulate Aria granting): then Kevin may remove Eva but still not Aria.
  c.m.table('sx_members').find(m => m.thread_id === FEST && m.user_id === I.owner).can_remove_members = true;
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: FEST, p_user_id: I.eva })).error, null);
  assert.ok(!c.m.table('sx_members').some(m => m.thread_id === FEST && m.user_id === I.eva));
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: FEST, p_user_id: I.aria })).error.message, G.GROUP_ERRORS.adminProtected);
  assert.equal((await c.rpc('sx_remove_group_member', { p_thread_id: FEST, p_user_id: I.owner })).error.message, G.GROUP_ERRORS.self);
  await new Promise(r => setTimeout(r, 20));
  assert.ok(events.some(e => e.eventType === 'DELETE' && e.old?.user_id === I.eva), 'realtime DELETE for the removed member');
});
