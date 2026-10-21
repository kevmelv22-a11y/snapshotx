/**
 * 3D avatar rig description (pure, no three.js / RN imports, so it runs under `node --test`).
 * Maps the existing avatar data model (Outfit with wardrobe item ids, hairStyle, colours; PoseId) onto the
 * modular glTF built by assets/avatar3d/src/build_avatar.py: which mesh modules are visible, which material
 * gets which colour, which face variants are shown, and the bone rotations of each pose.
 */
import type { HairStyle, Outfit, WardrobeItem } from '../avatar/outfit';
import type { AvatarExpression, PoseId } from '../avatar/poses';

export type MeshModule = 'top_tee' | 'top_long' | 'outer_hoodie' | 'outer_jacket' | 'bottom_straight' | 'bottom_joggers' | 'shoes_sneaker';
/** Node name prefixes in avatar.glb for each module. */
export const MODULE_PREFIX: Record<MeshModule, string[]> = {
  top_tee: ['Top_tee'],
  top_long: ['Top_long'],
  outer_hoodie: ['Outer_hoodie'],
  outer_jacket: ['Outer_jacket'],
  bottom_straight: ['Bottom_straight'],
  bottom_joggers: ['Bottom_joggers'],
  shoes_sneaker: ['Shoes_sneaker'],
};
export const ALL_MODULES = Object.keys(MODULE_PREFIX) as MeshModule[];

/** glTF material names that are recoloured per avatar. */
export type MaterialSlot = 'Skin' | 'Lip' | 'Hair' | 'Brow' | 'Iris' | 'Top' | 'Outer' | 'OuterTrim' | 'String' | 'Bottom' | 'BottomSeam' | 'Shoe' | 'ShoeAccent' | 'Sole';

export const HAIR_NODES: Record<HairStyle, string[]> = {
  curly: ['Hair_curly'], afro: ['Hair_afro'], short: ['Hair_short'], buzz: ['Hair_buzz'], wavy: ['Hair_wavy'],
  long: ['Hair_long', 'Hair_longBack'], bun: ['Hair_bun', 'Hair_bunTop'],
  // 2D-art-only styles (worn-styles layers): the 3D fallback uses the closest mesh
  curtain: ['Hair_wavy'], 'curtain-short': ['Hair_short'],
};
export const ALL_HAIR_NODES = Object.values(HAIR_NODES).flat();

export const DEFAULT_EYES = '#5A3A22';
export const EYE_SWATCHES = ['#5A3A22', '#3B2618', '#7A5532', '#3F6E8F', '#4E7A4A', '#6B6F78'];

type ItemLookup = (id: string) => Pick<WardrobeItem, 'id' | 'category' | 'colors' | 'preview'> | undefined;

export type AvatarRig3D = {
  modules: MeshModule[];
  hair: HairStyle;
  colors: Partial<Record<MaterialSlot, string>>;
  /** Unsupported-in-3D items that were approximated (for diagnostics / remaining work). */
  approximated: string[];
};

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => ch(v).toString(16).padStart(2, '0')).join('').toUpperCase();
};
export { shade as shadeHex };

const JACKETISH = new Set(['jacket', 'bomber', 'varsity', 'zip', 'puffer', 'vest', 'fur', 'cape']);
const LONG_TOPS = new Set(['longsleeve', 'shirt']);

/** Outfit (wardrobe ids) → visible modules + material colours. Unknown / unsupported items fall back to the closest module. */
export function rigFromOutfit(outfit: Outfit, lookup: ItemLookup): AvatarRig3D {
  const modules: MeshModule[] = [];
  const colors: Partial<Record<MaterialSlot, string>> = {};
  const approximated: string[] = [];
  const primary = (layer: keyof Outfit['colors'], item: { colors: string[] } | undefined, fallback: string) =>
    outfit.colors[layer] ?? item?.colors[0] ?? fallback;

  const dress = outfit.dress ? lookup(outfit.dress) : undefined;
  const top = outfit.top ? lookup(outfit.top) : undefined;
  const outer = outfit.outerwear ? lookup(outfit.outerwear) : undefined;
  const bottom = outfit.bottom ? lookup(outfit.bottom) : undefined;
  const shoes = outfit.shoes ? lookup(outfit.shoes) : undefined;

  // upper body
  const outerVariant = outer?.preview.variant;
  if (outer) {
    modules.push(outerVariant === 'hoodie' ? 'outer_hoodie' : 'outer_jacket');
    if (outerVariant !== 'hoodie' && !JACKETISH.has(outerVariant ?? '')) approximated.push(outer.id);
    const c = primary('outerwear', outer, '#1B1B1E');
    colors.Outer = c;
    colors.OuterTrim = outer.colors[1] && outerVariant !== 'hoodie' ? shade(c, -0.18) : shade(c, -0.12);
    colors.String = outer.colors[1] ?? '#EDEDED';
  }
  if (dress) {
    // no dress mesh yet: tee + straight trousers in the dress colour
    approximated.push(dress.id);
    if (outerVariant !== 'hoodie') modules.push('top_tee');
    colors.Top = primary('dress', dress, '#B3121F');
  } else if (outerVariant !== 'hoodie') {
    modules.push('top_tee');
    if (top && LONG_TOPS.has(top.preview.variant)) modules.push('top_long');
    if (top && !['tee', 'tank', 'polo', 'longsleeve', 'shirt'].includes(top.preview.variant)) approximated.push(top.id);
    colors.Top = top ? primary('top', top, '#F5F5F7') : '#F5F5F7';
  }

  // lower body
  const bVariant = dress ? 'straight' : bottom?.preview.variant;
  modules.push(bVariant === 'joggers' ? 'bottom_joggers' : 'bottom_straight');
  if (bottom && !['jeans', 'cargo', 'workpant', 'joggers'].includes(bottom.preview.variant)) approximated.push(bottom.id);
  const bc = dress ? primary('dress', dress, '#B3121F') : bottom ? primary('bottom', bottom, '#6E7178') : '#2B2D33';
  colors.Bottom = bc;
  colors.BottomSeam = shade(bc, bc === '#1E1E22' ? 0.08 : 0.14);

  // shoes
  modules.push('shoes_sneaker');
  if (shoes && shoes.preview.variant !== 'sneaker') approximated.push(shoes.id);
  const sc = shoes ? primary('shoes', shoes, '#F4F4F6') : '#F4F4F6';
  colors.Shoe = sc;
  colors.ShoeAccent = shoes?.colors[1] ?? shade(sc, -0.25);
  colors.Sole = '#F7F7F7';

  for (const k of ['hat', 'glasses', 'bag', 'accessory', 'socks'] as const) { const id = outfit[k]; if (id) approximated.push(id); }

  // body
  const skin = outfit.colors.skin ?? '#DD9A72';
  colors.Skin = skin;
  colors.Lip = shade(skin, -0.22);
  const hairC = outfit.colors.hair ?? '#8A5A2B';
  colors.Hair = hairC;
  colors.Brow = shade(hairC, -0.35);
  colors.Iris = outfit.colors.eyes ?? DEFAULT_EYES;
  return { modules, hair: outfit.hairStyle, colors, approximated };
}

/** Which node-name prefixes are visible for a rig (hair + modules); body nodes are always on. */
export function isNodeVisible(name: string, rig: Pick<AvatarRig3D, 'modules' | 'hair'>, face: FaceState): boolean {
  if (name.startsWith('Hair_')) return HAIR_NODES[rig.hair].includes(name);
  for (const m of ALL_MODULES) if (MODULE_PREFIX[m].some(p => name.startsWith(p))) return rig.modules.includes(m);
  if (name.startsWith('Mouth')) return face.mouth.includes(name);
  for (const side of ['L', 'R'] as const) {
    const closed = side === 'R' ? face.closedR : face.closedL;
    if (name === `LidClosed${side}` || name === `LidLine${side}`) return closed;
    if (['EyeWhite', 'Iris', 'Pupil', 'Glint', 'Lash', 'LidUpper'].some(p => name === p + side)) return !closed;
  }
  return true;
}

export type FaceState = { mouth: string[]; closedL: boolean; closedR: boolean };
export function faceFor(expression: AvatarExpression): FaceState {
  switch (expression) {
    case 'laugh': return { mouth: ['MouthLaugh', 'MouthLaughTeeth'], closedL: false, closedR: false };
    case 'surprised': return { mouth: ['MouthSurprised'], closedL: false, closedR: false };
    case 'neutral': return { mouth: ['MouthNeutral'], closedL: false, closedR: false };
    case 'wink': return { mouth: ['MouthSmile'], closedL: false, closedR: true };
    default: return { mouth: ['MouthSmile'], closedL: false, closedR: false };
  }
}

/**
 * Bone rotations in degrees around CHARACTER axes (three.js space: +X = avatar's left, +Y up, +Z towards the camera),
 * applied in the bone's rest frame. Arms: +Z raises the left arm sideways, -Z the right arm; -X swings forward.
 */
export type BoneRot = [number, number, number];
export type Pose3D = { bones: Partial<Record<BoneName, BoneRot>>; expression: AvatarExpression };
export type BoneName = 'hips' | 'spine' | 'chest' | 'neck' | 'head' | 'upperArmL' | 'forearmL' | 'handL' | 'upperArmR' | 'forearmR' | 'handR' | 'thighL' | 'shinL' | 'thighR' | 'shinR';
export const BONE_NAMES: BoneName[] = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR', 'thighL', 'shinL', 'thighR', 'shinR'];

export type Pose3DId = PoseId | 'think';
const relaxed = { upperArmL: [4, 0, 6], forearmL: [-12, 0, 0], upperArmR: [4, 0, -6], forearmR: [-12, 0, 0] } as const;
export const POSES_3D: Record<Pose3DId, Pose3D> = {
  stand: { expression: 'smile', bones: { ...relaxed, head: [2, 0, 0] } as Pose3D['bones'] },
  // reference hero pose: right hand on the chin, left hand in the pocket, weight on one leg
  think: { expression: 'neutral', bones: { upperArmR: [-30, 60, 40], forearmR: [-120, 60, 0], handR: [20, 0, 0], upperArmL: [8, 0, 4], forearmL: [-30, 0, 4], head: [-2, -12, 6], neck: [0, 0, 2], hips: [0, 6, -2], thighL: [-2, 0, 2], thighR: [2, 0, -3] } },
  wave: { expression: 'smile', bones: { upperArmL: [0, 0, 128], forearmL: [0, 0, 30], upperArmR: relaxed.upperArmR as BoneRot, forearmR: relaxed.forearmR as BoneRot, head: [0, 0, -5] } },
  thumbs: { expression: 'smile', bones: { ...relaxed, upperArmR: [-40, 0, -10], forearmR: [-70, 0, 0], head: [0, 0, 4] } as Pose3D['bones'] },
  laugh: { expression: 'laugh', bones: { upperArmL: [-10, 0, 16], forearmL: [-60, 0, -10], upperArmR: [-10, 0, -16], forearmR: [-60, 0, 10], head: [-8, 0, -6], chest: [-4, 0, 0] } },
  cheer: { expression: 'laugh', bones: { upperArmL: [0, 0, 150], forearmL: [0, 0, 10], upperArmR: [0, 0, -150], forearmR: [0, 0, -10], head: [-8, 0, 0] } },
  peace: { expression: 'smile', bones: { ...relaxed, upperArmR: [-20, 0, -150], forearmR: [0, 0, -40], head: [0, 0, 7] } as Pose3D['bones'] },
  shrug: { expression: 'neutral', bones: { upperArmL: [0, 0, 22], forearmL: [-80, 30, 10], upperArmR: [0, 0, -22], forearmR: [-80, -30, -10], head: [0, 14, -8], chest: [0, 0, 0] } },
  wink: { expression: 'wink', bones: { ...relaxed, upperArmR: [-40, 0, -10], forearmR: [-70, 0, 0], head: [0, 0, 5] } as Pose3D['bones'] },
  surprised: { expression: 'surprised', bones: { upperArmL: [0, 0, 34], forearmL: [-40, 0, 30], upperArmR: [0, 0, -34], forearmR: [-40, 0, -30], head: [-6, 0, 0] } },
};
export function pose3D(id: unknown): Pose3D { return POSES_3D[(typeof id === 'string' && id in POSES_3D ? id : 'stand') as Pose3DId]; }

/** Stable cache key for rendered snapshots (stickers, chat, map pins, grid cards). */
export function snapshotKey(rig: AvatarRig3D, pose: Pose3DId, framing: string, size: number): string {
  const c = Object.entries(rig.colors).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}${v}`).join('');
  return `${rig.modules.join('+')}|${rig.hair}|${c}|${pose}|${framing}|${size}`;
}
