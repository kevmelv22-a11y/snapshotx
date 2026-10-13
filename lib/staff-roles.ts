/** Pure mirror of the server rules in public.sx_manage_staff_role (UI only; the server decides). */
export type StaffRoleName = 'MODERATOR' | 'SENIOR MODERATOR' | 'ADMIN' | 'OWNER';
export const STAFF_ROLE_ORDER: StaffRoleName[] = ['OWNER', 'ADMIN', 'SENIOR MODERATOR', 'MODERATOR'];
export const STAFF_ROLE_LABEL: Record<StaffRoleName, string> = {
  OWNER: 'Owner', ADMIN: 'Admin', 'SENIOR MODERATOR': 'Senior moderator', MODERATOR: 'Moderator',
};

/** Roles the actor may grant to (and therefore also revoke from) someone else. */
export function grantableRoles(actorRoles: readonly string[]): StaffRoleName[] {
  if (actorRoles.includes('OWNER')) return ['ADMIN', 'SENIOR MODERATOR', 'MODERATOR'];
  if (actorRoles.includes('ADMIN')) return ['MODERATOR'];
  return [];
}

export type RoleChange = {
  actorId: string; actorRoles: readonly string[];
  targetId: string; targetRoles: readonly string[];
  role: StaffRoleName; grant: boolean;
  /** Owners that are active and not banned, including the actor. */
  activeOwnerCount: number;
};

export function checkRoleChange(c: RoleChange): { ok: true } | { ok: false; reason: string } {
  const self = c.actorId === c.targetId;
  const has = c.targetRoles.includes(c.role);
  if (c.role === 'OWNER') {
    if (c.grant) return { ok: false, reason: 'Owner wordt niet via de console toegekend.' };
    if (!self || !c.actorRoles.includes('OWNER')) return { ok: false, reason: 'Alleen een owner kan zelf de ownerrol neerleggen.' };
    if (c.activeOwnerCount <= 1) return { ok: false, reason: 'Je bent de laatste actieve owner; die rol kan niet weg.' };
    return { ok: true };
  }
  if (self) return { ok: false, reason: 'Je kunt je eigen rollen niet wijzigen.' };
  if (!grantableRoles(c.actorRoles).includes(c.role)) return { ok: false, reason: 'Deze rol mag jij niet beheren.' };
  if (!c.actorRoles.includes('OWNER') && c.targetRoles.includes('OWNER')) return { ok: false, reason: 'Rollen van een owner beheert alleen een owner.' };
  if (c.grant && has) return { ok: false, reason: 'Rol is al toegekend.' };
  if (!c.grant && !has) return { ok: false, reason: 'Rol is niet toegekend.' };
  return { ok: true };
}

export function sortRoles(roles: readonly string[]): StaffRoleName[] {
  return STAFF_ROLE_ORDER.filter(r => roles.includes(r));
}
