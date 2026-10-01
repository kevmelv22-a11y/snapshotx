export type AvatarAppearance = {
  skin: number;
  hair: number;
  hairstyle: number;
  top: number;
  bottoms: number;
  shoes: number;
  accessory: number;
};

export const avatarOptions = {
  skin: ['Licht', 'Warm', 'Getint', 'Bruin', 'Donker'],
  hair: ['Nachtzwart', 'Donkerbruin', 'Kastanje', 'Goudblond', 'Koper'],
  hairstyle: ['Kort', 'Golvend', 'Krullen', 'Pet'],
  top: ['Paarse trui', 'Koraal jas', 'Nachtblauw pak', 'Gouden hoodie', 'Zwarte blazer', 'Mint trui'],
  bottoms: ['Donkere broek', 'Lichte broek', 'Paarse broek', 'Rok'],
  shoes: ['Witte sneakers', 'Zwarte schoenen', 'Gele sneakers'],
  accessory: ['Geen', 'Ster', 'Ruimtevleugels', 'Bril'],
} as const;

export const defaultAvatar: AvatarAppearance = {
  skin: 0, hair: 0, hairstyle: 0, top: 0, bottoms: 0, shoes: 0, accessory: 0,
};

export function readAvatarAppearance(value: unknown): AvatarAppearance {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = {...defaultAvatar};
  for (const key of Object.keys(avatarOptions) as (keyof AvatarAppearance)[]) {
    const n = source[key];
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < avatarOptions[key].length) result[key] = n;
  }
  return result;
}
