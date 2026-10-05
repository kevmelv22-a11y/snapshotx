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
  top: ['Paarse trui', 'Koraal jas', 'Nachtblauw pak', 'Gouden hoodie', 'Zwarte smoking', 'Mint trui'],
  bottoms: ['Donkere broek', 'Lichte broek', 'Paarse broek', 'Rok'],
  shoes: ['Witte sneakers', 'Zwarte schoenen', 'Gele sneakers'],
  accessory: ['Geen', 'Ster', 'Ruimtevleugels', 'Bril', 'Duivelhoorns en zwarte vleugels'],
} as const;

export const defaultAvatar: AvatarAppearance = {
  skin: 1, hair: 3, hairstyle: 0, top: 4, bottoms: 0, shoes: 1, accessory: 4,
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

