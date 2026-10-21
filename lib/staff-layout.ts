/**
 * Responsive staff-console top bar (app/staff/index.tsx). On narrow phones the brand title, bell,
 * profile pill and refresh button did not fit and overlapped; this decides what to collapse.
 */
export type StaffHeaderLayout = {
  wide: boolean; // sidebar + header search (desktop/tablet)
  profile: 'full' | 'role' | 'icon'; // role + e-mail | role only | icon only (role/e-mail in a11y label)
  gap: number;
  padding: number;
};

export const STAFF_WIDE_MIN = 900;

export function staffHeaderLayout(width: number): StaffHeaderLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 390;
  if (w >= STAFF_WIDE_MIN) return { wide: true, profile: 'full', gap: 12, padding: 18 };
  if (w >= 560) return { wide: false, profile: 'full', gap: 10, padding: 14 };
  if (w >= 420) return { wide: false, profile: 'role', gap: 8, padding: 12 };
  return { wide: false, profile: 'icon', gap: 8, padding: 12 };
}
