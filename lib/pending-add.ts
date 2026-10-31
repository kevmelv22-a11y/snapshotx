/** A friend code opened while signed out (QR / snapshot-x.nl/add link) — reopened right after login. In-memory on purpose. */
let pending: string | null = null;
export function setPendingAdd(code: string | null) { pending = code; }
export function peekPendingAdd(): string | null { return pending; }
