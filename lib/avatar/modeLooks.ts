/** "Probeer een nieuwe look" grid on the Mode screen (step 8). Pure data; ids must exist in WARDROBE_ITEMS (tested). */
import type { CuratedLook } from './wardrobeItems';

export const TRY_LOOKS: CuratedLook[] = [
  { id: 'try-olive', name: 'Olijf', tagline: 'Overshirt en witte broek', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-ploeg-olive-jacket', bottom: 'bottom-white-cargo', shoes: 'shoes-nike-white' } },
  { id: 'try-coach', name: 'Coach', tagline: 'Zwart coachjack', items: { top: 'top-nike-black-tee', outerwear: 'outer-strideon-black-jacket', bottom: 'bottom-strideon-black-cargo', shoes: 'shoes-strideon-panda' } },
  { id: 'try-camel', name: 'Camel', tagline: 'Werkjack en zwarte broek', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-ploeg-tan-jacket', bottom: 'bottom-strideon-black-cargo', shoes: 'shoes-nike-white' } },
  { id: 'try-denim', name: 'Denim', tagline: 'Spijkerjack en zwart', items: { top: 'top-nike-black-tee', outerwear: 'outer-basisbes-denim-jacket', bottom: 'bottom-strideon-black-cargo', shoes: 'shoes-strideon-panda' } },
  { id: 'try-cream', name: 'Crème', tagline: 'Hoodie en joggingbroek', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-kast-cream-hoodie', bottom: 'bottom-kast-cream-joggers', shoes: 'shoes-nike-white' } },
  { id: 'try-jeans', name: 'Jeans', tagline: 'Zwart jack en lichte jeans', items: { top: 'top-blueberry-white-tee', outerwear: 'outer-carhartt-black', bottom: 'bottom-blueberry-jeans', shoes: 'shoes-strideon-panda' } },
];

/** Hero look of the Mode screen (reference: black hoodie, grey jeans, lowtops). */
export const MODE_HERO_ITEMS = { top: 'top-blueberry-white-tee', outerwear: 'outer-nike-swoosh-hoodie', bottom: 'bottom-basisbes-grey-jeans', shoes: 'shoes-strideon-panda' } as const;
