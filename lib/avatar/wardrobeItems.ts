/**
 * Wardrobe catalogue for the Bitmoji-kast screen. Brand names are plain text labels only (no logos).
 * Prices are mock prices: buying only unlocks the item locally, no payment is made.
 */
import type { CategoryTab, HairStyle, Layer, WardrobeCategory, WardrobeItem } from './outfit';

export type { WardrobeItem } from './outfit';

const item = (id: string, category: WardrobeCategory, brand: string, name: string, priceCents: number | null, colors: string[], preview: WardrobeItem['preview'], featured = false): WardrobeItem =>
  ({ id, category, brand, name, priceCents, colors, preview, featured });

export const WARDROBE_ITEMS: WardrobeItem[] = [
  // ---- shirts / tops
  item('top-blueberry-white-tee', 'top', 'blueberry', 'Wit basic T-shirt', null, ['#F5F5F7'], { variant: 'tee' }),
  item('top-nike-black-tee', 'top', 'Nike', 'Zwart swoosh-T-shirt', null, ['#1E1E21', '#FFFFFF'], { variant: 'tee', graphic: 'swoosh' }),
  item('top-bf-plaid-shirt', 'top', 'Bitmoji Fashion', 'Geruit flanel overhemd', 149, ['#F4F4F4', '#1C1C1E'], { variant: 'shirt', pattern: 'plaid' }, true),
  item('top-bf-skull-tee', 'top', 'Bitmoji Fashion', 'Skull-T-shirt', 99, ['#18181B', '#EDEDED'], { variant: 'tee', graphic: 'skull' }),
  item('top-bf-pumpkin-tee', 'top', 'Bitmoji Fashion', 'Pompoen-T-shirt', null, ['#2B2B2E', '#F28A1E'], { variant: 'tee', graphic: 'pumpkin' }),
  item('top-carhartt-longsleeve', 'top', 'carhartt', 'Zwarte longsleeve', null, ['#202023', '#C9A44C'], { variant: 'longsleeve', graphic: 'logo' }),
  item('top-clubsportif-rugby', 'top', 'CLUB SPORTIF', 'Rugbypolo', 249, ['#1D2333', '#7C1E2C', '#F1EDE6'], { variant: 'polo', pattern: 'stripes' }, true),
  item('top-bf-beige-tee', 'top', 'Bitmoji Fashion', 'Beige oversized tee', null, ['#D8C7A6'], { variant: 'tee' }),
  item('top-lacoste-polo', 'top', 'LACOSTE', 'Piqué polo', 199, ['#2F6B4F', '#F5F5F5'], { variant: 'polo', graphic: 'crest' }),
  item('top-snapnation-movements', 'top', 'SNAP NATION', 'Movements-T-shirt', 129, ['#141416', '#E9E4D8'], { variant: 'tee', graphic: 'skull' }),
  item('top-overtime-jersey', 'top', 'OVERTIME', 'Basketbaljersey', null, ['#2851A3', '#F2F2F2'], { variant: 'tank', graphic: 'stripes3' }),
  item('top-adidas-longsleeve', 'top', 'adidas', 'Trainingsshirt', null, ['#3B3F47', '#FFFFFF'], { variant: 'longsleeve', graphic: 'stripes3' }),

  // ---- trousers / bottoms
  item('bottom-white-cargo', 'bottom', 'Bitmoji Fashion', 'Witte cargobroek', null, ['#E4E4E7'], { variant: 'cargo' }),
  item('bottom-blueberry-jeans', 'bottom', 'blueberry', 'Baggy jeans', null, ['#5B7BA6'], { variant: 'jeans' }),
  item('bottom-adidas-track', 'bottom', 'adidas', 'Trainingsbroek', null, ['#1E1E22', '#FFFFFF'], { variant: 'joggers', graphic: 'stripes3' }),
  item('bottom-carhartt-doubleknee', 'bottom', 'carhartt', 'Double knee werkbroek', 299, ['#8A6A43'], { variant: 'workpant' }, true),
  item('bottom-bf-shorts', 'bottom', 'Bitmoji Fashion', 'Zwarte short', null, ['#26262A'], { variant: 'shorts' }),
  item('bottom-miumiu-skirt', 'bottom', 'MIU MIU', 'Geplooide rok', 349, ['#B9B9C2'], { variant: 'skirt' }),
  item('bottom-nike-joggers', 'bottom', 'Nike', 'Grijze joggingbroek', null, ['#9A9AA2', '#FFFFFF'], { variant: 'joggers', graphic: 'swoosh' }),

  // ---- dresses
  item('dress-festive-red-gown', 'dress', 'Festive Fashion', 'Rode galajurk', 199, ['#B3121F', '#E33A44'], { variant: 'gown' }, true),
  item('dress-bf-mummy-wrap', 'dress', 'Bitmoji Fashion', 'Mummy Wrap-jurk', 99, ['#E3DDCD', '#B9B19C'], { variant: 'gown', pattern: 'wrap' }),
  item('dress-bf-white-tulle', 'dress', 'Bitmoji Fashion', 'Witte tulejurk', 149, ['#F7F7F9', '#E2E2EA'], { variant: 'tulle' }),
  item('dress-dressx-hearts', 'dress', 'DRESSX', 'Roze hartjesjurk', 179, ['#F4A6C8', '#E2477F'], { variant: 'mini', pattern: 'hearts' }),
  item('dress-miumiu-slip', 'dress', 'MIU MIU', 'Zwarte slipdress', 299, ['#1B1B1F'], { variant: 'slip' }),
  item('dress-bf-mint-maxi', 'dress', 'Bitmoji Fashion', 'Mint maxi-jurk', null, ['#9FD3B8', '#6FAE8E'], { variant: 'slip', pattern: 'swirl' }),

  // ---- shoes
  item('shoes-nike-white', 'shoes', 'Nike', 'Witte sneakers', null, ['#F4F4F6', '#D9D9DE'], { variant: 'sneaker', graphic: 'swoosh' }),
  item('shoes-adidas-bw', 'shoes', 'adidas', 'Zwart-witte sneakers', null, ['#1D1D21', '#F4F4F6'], { variant: 'sneaker', graphic: 'stripes3' }),
  item('shoes-balenciaga-fluffy', 'shoes', 'BALENCIAGA', 'Roze fluffy boots', 349, ['#F2B6CF'], { variant: 'fluffy' }, true),
  item('shoes-versace-chunky', 'shoes', 'VERSACE', 'Witte chunky sneakers', 299, ['#F6F6F8', '#D4AF37'], { variant: 'chunky' }),
  item('shoes-blueberry-bunny', 'shoes', 'blueberry', 'Konijnensloffen', null, ['#F3EEF0', '#F2A9BE'], { variant: 'bunny' }),
  item('shoes-ugg-classic', 'shoes', 'UGG', 'Classic boots', 249, ['#C59A6A'], { variant: 'boot' }),
  item('shoes-crocs-clog', 'shoes', 'crocs', 'Classic clog', null, ['#4BA3E3'], { variant: 'clog' }),
  item('shoes-carhartt-work', 'shoes', 'carhartt', 'Werkschoenen', 199, ['#C08A3E'], { variant: 'workboot' }),

  // ---- socks
  item('socks-nike-white', 'socks', 'Nike', 'Witte sportsokken', null, ['#F4F4F6', '#1C1C1E'], { variant: 'crew', graphic: 'swoosh' }),
  item('socks-adidas-stripes', 'socks', 'adidas', 'Gestreepte sokken', null, ['#F4F4F6', '#1C1C1E'], { variant: 'long', graphic: 'stripes3' }),
  item('socks-festive-xmas', 'socks', 'Festive Fashion', 'Kerstsokken', 49, ['#C3162B', '#F4F4F6'], { variant: 'long', pattern: 'stripes' }),
  item('socks-bf-black-high', 'socks', 'Bitmoji Fashion', 'Hoge zwarte sokken', null, ['#1E1E22'], { variant: 'long' }),

  // ---- bags
  item('bag-prada-red-backpack', 'bag', 'PRADA', 'Rode rugzak', 399, ['#B31B22', '#1B1B1E'], { variant: 'backpack' }, true),
  item('bag-prada-orange', 'bag', 'PRADA', 'Oranje schoudertas', 349, ['#E8742A', '#1B1B1E'], { variant: 'shoulder' }),
  item('bag-coach-pink', 'bag', 'COACH', 'Roze handtas', 299, ['#F09BBE', '#C9A35A'], { variant: 'handbag' }),
  item('bag-coach-white', 'bag', 'COACH', 'Witte bowlingtas', 299, ['#F3F1EE', '#3A3A3D'], { variant: 'bowling' }),
  item('bag-coach-brown', 'bag', 'COACH', 'Bruine leren tas', 279, ['#7A4A2C', '#C9A35A'], { variant: 'handbag' }),
  item('bag-adidas-sport', 'bag', 'adidas', 'Zwart-rode sporttas', null, ['#1C1C1F', '#D3242C'], { variant: 'duffel', graphic: 'stripes3' }),
  item('bag-miumiu-mini', 'bag', 'MIU MIU', 'Mini bowlingtas', 249, ['#B0794E', '#E9E3DA'], { variant: 'bowling' }),

  // ---- jackets / outerwear
  item('outer-nike-swoosh-hoodie', 'outerwear', 'Nike', 'Zwarte swoosh-hoodie', null, ['#1B1B1E', '#F4F4F6'], { variant: 'hoodie', graphic: 'swoosh' }),
  item('outer-paramount-emperor-robe', 'outerwear', 'Paramount', 'Emperor Robe', 200, ['#F5F3EE', '#D9A934'], { variant: 'cape' }, true),
  item('outer-bf-grunge-rose', 'outerwear', 'Bitmoji Fashion', 'Grunge Rose Zip-up Hoodie', 29, ['#F4F3F1', '#151517'], { variant: 'zip', pattern: 'roses' }, true),
  item('outer-blueberry-blue-hoodie', 'outerwear', 'blueberry', 'Blauwe hoodie', null, ['#3E6FD1', '#FFFFFF'], { variant: 'hoodie' }),
  item('outer-blueberry-black-vest', 'outerwear', 'blueberry', 'Zwarte bodywarmer', null, ['#1E1E22'], { variant: 'vest', pattern: 'quilt' }),
  item('outer-dressx-green', 'outerwear', 'DRESSX', 'Groen patroonjack', 259, ['#2F6B47', '#9ACB6A', '#14301F'], { variant: 'jacket', pattern: 'swirl' }),
  item('outer-carhartt-camo', 'outerwear', 'carhartt', 'Camo werkjack', 299, ['#5D6B3A', '#3A4325', '#8C8456'], { variant: 'jacket', pattern: 'camo' }),
  item('outer-carhartt-black', 'outerwear', 'carhartt', 'Zwart werkjack', null, ['#222225', '#C9A44C'], { variant: 'jacket', graphic: 'logo' }),
  item('outer-versace-baroque', 'outerwear', 'VERSACE', 'Barok bomberjack', 499, ['#141416', '#D4AF37'], { variant: 'bomber', pattern: 'baroque' }),
  item('outer-lacoste-puffer', 'outerwear', 'LACOSTE', 'Pufferjas', 349, ['#F4F2EE', '#E8742A'], { variant: 'puffer', pattern: 'quilt' }),
  item('outer-overtime-varsity', 'outerwear', 'OVERTIME', 'Varsity-jack', 299, ['#1F5E3B', '#E9E5DC', '#C72F3B'], { variant: 'varsity', pattern: 'patches' }),
  item('outer-bf-fur-coat', 'outerwear', 'Bitmoji Fashion', 'Imitatiebontjas', 199, ['#EDE3D3'], { variant: 'fur' }),

  // ---- hats
  item('hat-bf-beanie', 'hat', 'Bitmoji Fashion', 'Gebreide muts', null, ['#2B2B2F'], { variant: 'beanie' }),
  item('hat-nike-cap', 'hat', 'Nike', 'Sportpet', null, ['#F2F2F4', '#1C1C1E'], { variant: 'cap', graphic: 'swoosh' }),
  item('hat-balenciaga-bucket', 'hat', 'BALENCIAGA', 'Bucket hat', 249, ['#1C1C1F'], { variant: 'bucket' }),
  item('hat-prada-fedora', 'hat', 'PRADA', 'Fedora', 299, ['#5A4632', '#1B1B1E'], { variant: 'fedora' }),

  // ---- microphones / accessories
  item('acc-snapnation-mic', 'accessory', 'SNAP NATION', 'Handmicrofoon', null, ['#2A2A2E', '#BFC3C9'], { variant: 'mic' }),
  item('acc-paramount-gold-mic', 'accessory', 'Paramount', 'Gouden microfoon', 149, ['#D4AF37', '#F3E3A2'], { variant: 'mic' }, true),
  item('acc-overtime-headset', 'accessory', 'OVERTIME', 'Headset', null, ['#232326', '#9EA3AA'], { variant: 'headset' }),

  // ---- glasses
  item('glasses-bf-round', 'glasses', 'Bitmoji Fashion', 'Ronde bril', null, ['#2A2A2E'], { variant: 'round' }),
  item('glasses-prada-shades', 'glasses', 'PRADA', 'Zonnebril', 249, ['#121214'], { variant: 'shades' }),
  item('glasses-versace-aviator', 'glasses', 'VERSACE', 'Gouden pilotenbril', 299, ['#D4AF37', '#5A3E2B'], { variant: 'aviator' }),
  item('glasses-miumiu-cateye', 'glasses', 'MIU MIU', 'Cat-eye bril', 229, ['#E6B7C9'], { variant: 'cateye' }),
];

export const ITEMS_BY_ID: ReadonlyMap<string, WardrobeItem> = new Map(WARDROBE_ITEMS.map(i => [i.id, i]));

export type CategoryInfo = { tab: CategoryTab; label: string };

/** Order of the horizontally scrollable category icon row. */
export const CATEGORY_TABS: CategoryInfo[] = [
  { tab: 'featured', label: 'Uitgelicht' },
  { tab: 'all', label: 'Alles' },
  { tab: 'top', label: 'Shirts' },
  { tab: 'bottom', label: 'Broeken' },
  { tab: 'dress', label: 'Jurken' },
  { tab: 'shoes', label: 'Schoenen' },
  { tab: 'socks', label: 'Sokken' },
  { tab: 'bag', label: 'Tassen' },
  { tab: 'outerwear', label: 'Jassen' },
  { tab: 'hat', label: 'Hoeden' },
  { tab: 'accessory', label: 'Microfoons' },
  { tab: 'glasses', label: 'Brillen' },
];

/** Categories that show the green Deselecteren / Sorteren / Filter chips. */
export const CHIP_CATEGORIES: readonly CategoryTab[] = ['top', 'dress', 'shoes', 'outerwear'];

const BASE_SWATCHES = ['#F5F5F7', '#8E8E93', '#1C1C1E', '#F9D3DA', '#6B3A82', '#E9DCC8', '#8F827C'];
const SHIRT_TINTS = ['#2F6FD6', '#9CC3F0', '#2E7D4F', '#A8DCC0'];
const HAIR_SWATCHES = ['#8A5A2B', '#1E1A19', '#4A2C1B', '#D9B35F', '#B4532A', '#E7A3C2', '#7E5BC0'];

/** Colour strip on the right side; depends on the active layer. */
export const SKIN_SWATCHES = ['#F3CDB0', '#EBB48F', '#DD9A72', '#C47E55', '#9C5E3C', '#74432A', '#4E2C1C'];

export function swatchesFor(layer: Layer | null): string[] {
  if (!layer) return [];
  if (layer === 'hair') return HAIR_SWATCHES;
  if (layer === 'skin') return SKIN_SWATCHES;
  if (layer === 'top') return [...BASE_SWATCHES, ...SHIRT_TINTS];
  return BASE_SWATCHES;
}

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  curly: 'Krullen', short: 'Kort', wavy: 'Golvend', buzz: 'Buzzcut', long: 'Lang', afro: 'Afro', bun: 'Knot',
};

export type CuratedLook = { id: string; name: string; tagline: string; items: Partial<Record<WardrobeCategory, string>> };

/** Complete outfits for the Mode tab; each id must exist in WARDROBE_ITEMS (checked by lib/wardrobe-outfit.test.mjs). */
export const CURATED_LOOKS: CuratedLook[] = [
  { id: 'look-street', name: 'Street classic', tagline: 'Hoodie, cargo en witte sneakers', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-nike-swoosh-hoodie', bottom: 'bottom-white-cargo', shoes: 'shoes-nike-white' } },
  { id: 'look-emperor', name: 'Keizerlijk', tagline: 'Emperor Robe met gouden details', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-paramount-emperor-robe', bottom: 'bottom-white-cargo', shoes: 'shoes-versace-chunky' } },
  { id: 'look-grunge', name: 'Grunge rose', tagline: 'Rozenhoodie en baggy jeans', items: { top: 'top-bf-skull-tee', outerwear: 'outer-bf-grunge-rose', bottom: 'bottom-blueberry-jeans', shoes: 'shoes-adidas-bw', glasses: 'glasses-prada-shades' } },
  { id: 'look-gala', name: 'Gala', tagline: 'Rode galajurk met handtas', items: { dress: 'dress-festive-red-gown', shoes: 'shoes-versace-chunky', bag: 'bag-coach-pink', glasses: 'glasses-miumiu-cateye' } },
  { id: 'look-sport', name: 'Sportief', tagline: 'Trainingspak en sporttas', items: { top: 'top-adidas-longsleeve', bottom: 'bottom-adidas-track', shoes: 'shoes-adidas-bw', socks: 'socks-adidas-stripes', bag: 'bag-adidas-sport', hat: 'hat-nike-cap' } },
  { id: 'look-work', name: 'Werkplaats', tagline: 'Camo jack en double knee', items: { top: 'top-carhartt-longsleeve', outerwear: 'outer-carhartt-camo', bottom: 'bottom-carhartt-doubleknee', shoes: 'shoes-carhartt-work', hat: 'hat-bf-beanie' } },
  { id: 'look-winter', name: 'Winter', tagline: 'Puffer, muts en boots', items: { top: 'top-bf-beige-tee', outerwear: 'outer-lacoste-puffer', bottom: 'bottom-nike-joggers', shoes: 'shoes-ugg-classic', hat: 'hat-bf-beanie' } },
  { id: 'look-stage', name: 'Op het podium', tagline: 'Varsity-jack en gouden microfoon', items: { top: 'top-nike-black-tee', outerwear: 'outer-overtime-varsity', bottom: 'bottom-blueberry-jeans', shoes: 'shoes-nike-white', accessory: 'acc-paramount-gold-mic' } },
];
