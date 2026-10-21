import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRoleChange, grantableRoles, sortRoles } from './staff-roles.ts';

const base = { actorId: 'o1', actorRoles: ['OWNER'], targetId: 'u1', targetRoles: ['MODERATOR'], role: 'MODERATOR', grant: false, activeOwnerCount: 1 };

test('owners manage admin / senior / moderator, admins only moderator, moderators nothing', () => {
  assert.deepEqual(grantableRoles(['OWNER']), ['ADMIN', 'SENIOR MODERATOR', 'MODERATOR']);
  assert.deepEqual(grantableRoles(['ADMIN']), ['MODERATOR']);
  assert.deepEqual(grantableRoles(['MODERATOR', 'SENIOR MODERATOR']), []);
});

test('owner can revoke every role they can grant', () => {
  for (const role of ['ADMIN', 'SENIOR MODERATOR', 'MODERATOR']) assert.deepEqual(checkRoleChange({ ...base, role, targetRoles: [role] }), { ok: true });
});

test('admin cannot revoke admin / senior, nor touch an owner', () => {
  const admin = { ...base, actorId: 'a1', actorRoles: ['ADMIN'] };
  assert.equal(checkRoleChange({ ...admin, role: 'ADMIN', targetRoles: ['ADMIN'] }).ok, false);
  assert.equal(checkRoleChange({ ...admin, role: 'MODERATOR', targetRoles: ['MODERATOR'] }).ok, true);
  assert.equal(checkRoleChange({ ...admin, role: 'MODERATOR', targetRoles: ['OWNER', 'MODERATOR'] }).ok, false);
});

test('owner role: never granted, only own step-down, never the last active owner', () => {
  assert.equal(checkRoleChange({ ...base, role: 'OWNER', grant: true, targetRoles: [] }).ok, false);
  assert.equal(checkRoleChange({ ...base, role: 'OWNER', targetId: 'o2', targetRoles: ['OWNER'], activeOwnerCount: 2 }).ok, false);
  assert.match(checkRoleChange({ ...base, role: 'OWNER', targetId: 'o1', targetRoles: ['OWNER'], activeOwnerCount: 1 }).reason, /laatste actieve owner/);
  assert.deepEqual(checkRoleChange({ ...base, role: 'OWNER', targetId: 'o1', targetRoles: ['OWNER'], activeOwnerCount: 2 }), { ok: true });
});

test('no self changes for other roles, no duplicate grant, no revoke of a missing role', () => {
  assert.equal(checkRoleChange({ ...base, targetId: 'o1', role: 'ADMIN', targetRoles: ['OWNER', 'ADMIN'] }).ok, false);
  assert.equal(checkRoleChange({ ...base, grant: true }).reason, 'Rol is al toegekend.');
  assert.equal(checkRoleChange({ ...base, role: 'ADMIN' }).reason, 'Rol is niet toegekend.');
});

test('roles are sorted by seniority', () => {
  assert.deepEqual(sortRoles(['MODERATOR', 'OWNER', 'USER', 'ADMIN']), ['OWNER', 'ADMIN', 'MODERATOR']);
});
