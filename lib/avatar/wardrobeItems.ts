/**
 * Wardrobe catalogue for the avatarkast screen. Brand names are invented SnapShot X labels (no real brands,
 * no logos); graphics are own designs (wave mark, two stripes, star, stitched patch).
 * Item ids are stable storage keys (saved outfits in AsyncStorage / sx_avatar_outfits, unlocked items) and
 * are never shown in the UI; some still contain the old placeholder names and are kept for compatibility.
 * Prices are mock prices: buying only unlocks the item locally, no payment is made.
 */
import type { CategoryTab, HairStyle, Layer, WardrobeCategory, WardrobeItem } from './outfit';

export type { WardrobeItem } from './outfit';

const item = (id: string, category: WardrobeCategory, brand: string, name: string, priceCents: number | null, colors: string[], preview: WardrobeItem['preview'], featured = false): WardrobeItem =>
  ({ id, category, brand, name, priceCents, colors, preview, featured });

export const WARDROBE_ITEMS: WardrobeItem[] = [
  // ---- shirts / tops
  item('top-blueberry-white-tee', 'top', 'Basisbes', 'Wit basic T-shirt', null, ['#F5F5F7'], { variant: 'tee' }),
  item('top-nike-black-tee', 'top', 'Strideon', 'Zwart golf-T-shirt', null, ['#1E1E21', '#FFFFFF'], { variant: 'tee', graphic: 'wave' }),
  item('top-bf-plaid-shirt', 'top', 'Kast Studio', 'Geruit flanel overhemd', 149, ['#F4F4F4', '#1C1C1E'], { variant: 'shirt', pattern: 'plaid' }, true),
  item('top-bf-skull-tee', 'top', 'Kast Studio', 'Skull-T-shirt', 99, ['#18181B', '#EDEDED'], { variant: 'tee', graphic: 'skull' }),
  item('top-bf-pumpkin-tee', 'top', 'Kast Studio', 'Pompoen-T-shirt', null, ['#2B2B2E', '#F28A1E'], { variant: 'tee', graphic: 'pumpkin' }),
  item('top-carhartt-longsleeve', 'top', 'Ploeg & Co', 'Zwarte longsleeve', null, ['#202023', '#C9A44C'], { variant: 'longsleeve', graphic: 'patch' }),
  item('top-clubsportif-rugby', 'top', 'CLUB VELDE', 'Rugbypolo', 249, ['#1D2333', '#7C1E2C', '#F1EDE6'], { variant: 'polo', pattern: 'stripes' }, true),
  item('top-bf-beige-tee', 'top', 'Kast Studio', 'Beige oversized tee', null, ['#D8C7A6'], { variant: 'tee' }),
  item('top-lacoste-polo', 'top', 'MAISON ORLÉ', 'Piqué polo', 199, ['#2F6B4F', '#F5F5F5'], { variant: 'polo', graphic: 'star' }),
  item('top-snapnation-movements', 'top', 'FLITS CREW', 'Movements-T-shirt', 129, ['#141416', '#E9E4D8'], { variant: 'tee', graphic: 'skull' }),
  item('top-overtime-jersey', 'top', 'VERLENGING', 'Basketbaljersey', null, ['#2851A3', '#F2F2F2'], { variant: 'tank', graphic: 'stripes2' }),
  item('top-adidas-longsleeve', 'top', 'trivo', 'Trainingsshirt', null, ['#3B3F47', '#FFFFFF'], { variant: 'longsleeve', graphic: 'stripes2' }),

  // ---- trousers / bottoms
  item('bottom-white-cargo', 'bottom', 'Kast Studio', 'Witte cargobroek', null, ['#E4E4E7'], { variant: 'cargo' }),
  item('bottom-blueberry-jeans', 'bottom', 'Basisbes', 'Baggy jeans', null, ['#5B7BA6'], { variant: 'jeans' }),
  item('bottom-adidas-track', 'bottom', 'trivo', 'Trainingsbroek', null, ['#1E1E22', '#FFFFFF'], { variant: 'joggers', graphic: 'stripes2' }),
  item('bottom-carhartt-doubleknee', 'bottom', 'Ploeg & Co', 'Double knee werkbroek', 299, ['#8A6A43'], { variant: 'workpant' }, true),
  item('bottom-bf-shorts', 'bottom', 'Kast Studio', 'Zwarte short', null, ['#26262A'], { variant: 'shorts' }),
  item('bottom-miumiu-skirt', 'bottom', 'LUNE LUNE', 'Geplooide rok', 349, ['#B9B9C2'], { variant: 'skirt' }),
  item('bottom-nike-joggers', 'bottom', 'Strideon', 'Grijze joggingbroek', null, ['#9A9AA2', '#FFFFFF'], { variant: 'joggers', graphic: 'wave' }),

  // ---- dresses
  item('dress-festive-red-gown', 'dress', 'Festive Fashion', 'Rode galajurk', 199, ['#B3121F', '#E33A44'], { variant: 'gown' }, true),
  item('dress-bf-mummy-wrap', 'dress', 'Kast Studio', 'Mummy Wrap-jurk', 99, ['#E3DDCD', '#B9B19C'], { variant: 'gown', pattern: 'wrap' }),
  item('dress-bf-white-tulle', 'dress', 'Kast Studio', 'Witte tulejurk', 149, ['#F7F7F9', '#E2E2EA'], { variant: 'tulle' }),
  item('dress-dressx-hearts', 'dress', 'PIXELWEAR', 'Roze hartjesjurk', 179, ['#F4A6C8', '#E2477F'], { variant: 'mini', pattern: 'hearts' }),
  item('dress-miumiu-slip', 'dress', 'LUNE LUNE', 'Zwarte slipdress', 299, ['#1B1B1F'], { variant: 'slip' }),
  item('dress-bf-mint-maxi', 'dress', 'Kast Studio', 'Mint maxi-jurk', null, ['#9FD3B8', '#6FAE8E'], { variant: 'slip', pattern: 'swirl' }),

  // ---- shoes
  item('shoes-nike-white', 'shoes', 'Strideon', 'Witte sneakers', null, ['#F4F4F6', '#D9D9DE'], { variant: 'sneaker', graphic: 'wave' }),
  item('shoes-adidas-bw', 'shoes', 'trivo', 'Zwart-witte sneakers', null, ['#1D1D21', '#F4F4F6'], { variant: 'sneaker', graphic: 'stripes2' }),
  item('shoes-balenciaga-fluffy', 'shoes', 'BALDERO', 'Roze fluffy boots', 349, ['#F2B6CF'], { variant: 'fluffy' }, true),
  item('shoes-versace-chunky', 'shoes', 'AURELIO', 'Witte chunky sneakers', 299, ['#F6F6F8', '#D4AF37'], { variant: 'chunky' }),
  item('shoes-blueberry-bunny', 'shoes', 'Basisbes', 'Konijnensloffen', null, ['#F3EEF0', '#F2A9BE'], { variant: 'bunny' }),
  item('shoes-ugg-classic', 'shoes', 'WOLKJE', 'Wollen boots', 249, ['#C59A6A'], { variant: 'boot' }),
  item('shoes-crocs-clog', 'shoes', 'klompz', 'Rubberen klomp', null, ['#4BA3E3'], { variant: 'clog' }),
  item('shoes-carhartt-work', 'shoes', 'Ploeg & Co', 'Werkschoenen', 199, ['#C08A3E'], { variant: 'workboot' }),

  // ---- socks
  item('socks-nike-white', 'socks', 'Strideon', 'Witte sportsokken', null, ['#F4F4F6', '#1C1C1E'], { variant: 'crew', graphic: 'wave' }),
  item('socks-adidas-stripes', 'socks', 'trivo', 'Gestreepte sokken', null, ['#F4F4F6', '#1C1C1E'], { variant: 'long', graphic: 'stripes2' }),
  item('socks-festive-xmas', 'socks', 'Festive Fashion', 'Kerstsokken', 49, ['#C3162B', '#F4F4F6'], { variant: 'long', pattern: 'stripes' }),
  item('socks-bf-black-high', 'socks', 'Kast Studio', 'Hoge zwarte sokken', null, ['#1E1E22'], { variant: 'long' }),

  // ---- bags
  item('bag-prada-red-backpack', 'bag', 'ROSSANO', 'Rode rugzak', 399, ['#B31B22', '#1B1B1E'], { variant: 'backpack' }, true),
  item('bag-prada-orange', 'bag', 'ROSSANO', 'Oranje schoudertas', 349, ['#E8742A', '#1B1B1E'], { variant: 'shoulder' }),
  item('bag-coach-pink', 'bag', 'LINDEHOF', 'Roze handtas', 299, ['#F09BBE', '#C9A35A'], { variant: 'handbag' }),
  item('bag-coach-white', 'bag', 'LINDEHOF', 'Witte bowlingtas', 299, ['#F3F1EE', '#3A3A3D'], { variant: 'bowling' }),
  item('bag-coach-brown', 'bag', 'LINDEHOF', 'Bruine leren tas', 279, ['#7A4A2C', '#C9A35A'], { variant: 'handbag' }),
  item('bag-adidas-sport', 'bag', 'trivo', 'Zwart-rode sporttas', null, ['#1C1C1F', '#D3242C'], { variant: 'duffel', graphic: 'stripes2' }),
  item('bag-miumiu-mini', 'bag', 'LUNE LUNE', 'Mini bowlingtas', 249, ['#B0794E', '#E9E3DA'], { variant: 'bowling' }),

  // ---- jackets / outerwear
  item('outer-nike-swoosh-hoodie', 'outerwear', 'Strideon', 'Zwarte golf-hoodie', null, ['#1B1B1E', '#F4F4F6'], { variant: 'hoodie', graphic: 'wave' }),
  item('outer-paramount-emperor-robe', 'outerwear', 'Sterrenzaal', 'Emperor Robe', 200, ['#F5F3EE', '#D9A934'], { variant: 'cape' }, true),
  item('outer-bf-grunge-rose', 'outerwear', 'Kast Studio', 'Grunge Rose Zip-up Hoodie', 29, ['#F4F3F1', '#151517'], { variant: 'zip', pattern: 'roses' }, true),
  item('outer-blueberry-blue-hoodie', 'outerwear', 'Basisbes', 'Blauwe hoodie', null, ['#3E6FD1', '#FFFFFF'], { variant: 'hoodie' }),
  item('outer-blueberry-black-vest', 'outerwear', 'Basisbes', 'Zwarte bodywarmer', null, ['#1E1E22'], { variant: 'vest', pattern: 'quilt' }),
  item('outer-dressx-green', 'outerwear', 'PIXELWEAR', 'Groen patroonjack', 259, ['#2F6B47', '#9ACB6A', '#14301F'], { variant: 'jacket', pattern: 'swirl' }),
  item('outer-carhartt-camo', 'outerwear', 'Ploeg & Co', 'Camo werkjack', 299, ['#5D6B3A', '#3A4325', '#8C8456'], { variant: 'jacket', pattern: 'camo' }),
  item('outer-carhartt-black', 'outerwear', 'Ploeg & Co', 'Zwart werkjack', null, ['#222225', '#C9A44C'], { variant: 'jacket', graphic: 'patch' }),
  item('outer-versace-baroque', 'outerwear', 'AURELIO', 'Barok bomberjack', 499, ['#141416', '#D4AF37'], { variant: 'bomber', pattern: 'baroque' }),
  item('outer-lacoste-puffer', 'outerwear', 'MAISON ORLÉ', 'Pufferjas', 349, ['#F4F2EE', '#E8742A'], { variant: 'puffer', pattern: 'quilt' }),
  item('outer-overtime-varsity', 'outerwear', 'VERLENGING', 'Varsity-jack', 299, ['#1F5E3B', '#E9E5DC', '#C72F3B'], { variant: 'varsity', pattern: 'patches' }),
  item('outer-bf-fur-coat', 'outerwear', 'Kast Studio', 'Imitatiebontjas', 199, ['#EDE3D3'], { variant: 'fur' }),

  // ---- hats
  item('hat-bf-beanie', 'hat', 'Kast Studio', 'Gebreide muts', null, ['#2B2B2F'], { variant: 'beanie' }),
  item('hat-nike-cap', 'hat', 'Strideon', 'Sportpet', null, ['#F2F2F4', '#1C1C1E'], { variant: 'cap', graphic: 'wave' }),
  item('hat-balenciaga-bucket', 'hat', 'BALDERO', 'Bucket hat', 249, ['#1C1C1F'], { variant: 'bucket' }),
  item('hat-prada-fedora', 'hat', 'ROSSANO', 'Fedora', 299, ['#5A4632', '#1B1B1E'], { variant: 'fedora' }),

  // ---- microphones / accessories
  item('acc-snapnation-mic', 'accessory', 'FLITS CREW', 'Handmicrofoon', null, ['#2A2A2E', '#BFC3C9'], { variant: 'mic' }),
  item('acc-paramount-gold-mic', 'accessory', 'Sterrenzaal', 'Gouden microfoon', 149, ['#D4AF37', '#F3E3A2'], { variant: 'mic' }, true),
  item('acc-overtime-headset', 'accessory', 'VERLENGING', 'Headset', null, ['#232326', '#9EA3AA'], { variant: 'headset' }),

  // ---- glasses
  item('glasses-bf-round', 'glasses', 'Kast Studio', 'Ronde bril', null, ['#2A2A2E'], { variant: 'round' }),
  item('glasses-prada-shades', 'glasses', 'ROSSANO', 'Zonnebril', 249, ['#121214'], { variant: 'shades' }),
  item('glasses-versace-aviator', 'glasses', 'AURELIO', 'Gouden pilotenbril', 299, ['#D4AF37', '#5A3E2B'], { variant: 'aviator' }),
  item('glasses-miumiu-cateye', 'glasses', 'LUNE LUNE', 'Cat-eye bril', 229, ['#E6B7C9'], { variant: 'cateye' }),

  // ---- step 8 additions (new ids only; existing ids above are storage keys and never change)
  item('top-strideon-neon-tee', 'top', 'Strideon', 'Neon golf-T-shirt', null, ['#C6F432', '#1C1C1E'], { variant: 'tee', graphic: 'wave' }),
  item('top-trivo-heart-tee', 'top', 'trivo', 'Hartjes-T-shirt', 79, ['#F7F2EC', '#E2477F'], { variant: 'tee', graphic: 'heart' }),
  item('top-rossano-silk-shirt', 'top', 'ROSSANO', 'Zijden overhemd', 279, ['#3B2A5E', '#D9C9F2'], { variant: 'shirt', pattern: 'swirl' }, true),
  item('top-kast-stripe-longsleeve', 'top', 'Kast Studio', 'Gestreepte longsleeve', null, ['#F2EFE8', '#26324F'], { variant: 'longsleeve', pattern: 'stripes' }),
  // Eredivisie-clubshirts (free, both character sets)
  item('top-psv-jersey', 'top', 'PSV', 'Rood-wit gestreept PSV-thuisshirt', null, ['#E1061B', '#FFFFFF'], { variant: 'tee', pattern: 'stripes' }),
  item('top-feyenoord-jersey', 'top', 'Feyenoord', 'Rood-wit gedeeld Feyenoord-thuisshirt', null, ['#E1061B', '#FFFFFF'], { variant: 'tee' }),
  item('top-az-jersey', 'top', 'AZ', 'Rood AZ-thuisshirt', null, ['#D8141E', '#FFFFFF'], { variant: 'tee' }),
  item('top-twente-jersey', 'top', 'FC Twente', 'Rood FC Twente-thuisshirt met witte kraag', null, ['#D2141C', '#FFFFFF'], { variant: 'tee' }),
  item('top-utrecht-jersey', 'top', 'FC Utrecht', 'Wit-rood FC Utrecht-thuisshirt', null, ['#FFFFFF', '#D8141E'], { variant: 'tee' }),
  // Internationale clubshirts (free, both character sets)
  item('top-barcelona-jersey', 'top', 'FC Barcelona', 'Blauwgrana voetbalshirt', null, ['#A50044', '#004D98'], { variant: 'tee', pattern: 'stripes' }),
  item('top-realmadrid-jersey', 'top', 'Real Madrid', 'Wit voetbalshirt', null, ['#FFFFFF', '#FEBE10'], { variant: 'tee' }),
  item('top-manutd-jersey', 'top', 'Manchester United', 'Rood voetbalshirt', null, ['#DA291C', '#000000'], { variant: 'tee' }),
  item('top-besiktas-jersey', 'top', 'Beşiktaş', 'Zwart-wit gestreept voetbalshirt', null, ['#000000', '#FFFFFF'], { variant: 'tee', pattern: 'stripes' }),
  item('top-fenerbahce-jersey', 'top', 'Fenerbahçe', 'Geel-blauw gestreept voetbalshirt', null, ['#FFED00', '#163962'], { variant: 'tee', pattern: 'stripes' }),
  item('top-galatasaray-jersey', 'top', 'Galatasaray', 'Geel-rood gedeeld voetbalshirt', null, ['#FDB912', '#A90432'], { variant: 'tee' }),
  item('top-groningen-jersey', 'top', 'FC Groningen', 'Groen-wit gestreept FC Groningen-thuisshirt', null, ['#00813E', '#FFFFFF'], { variant: 'tee', pattern: 'stripes' }),
  item('top-sparta-jersey', 'top', 'Sparta Rotterdam', 'Rood-wit gestreept Sparta-thuisshirt', null, ['#D8141E', '#FFFFFF'], { variant: 'tee', pattern: 'stripes' }),
  item('top-heerenveen-jersey', 'top', 'sc Heerenveen', 'Blauw-wit gestreept Heerenveen-thuisshirt', null, ['#0055A4', '#FFFFFF', '#E1061B'], { variant: 'tee', pattern: 'stripes' }),
  item('top-acmilan-jersey', 'top', 'AC Milan', 'Rood-zwart gestreept voetbalshirt', null, ['#D0102B', '#000000'], { variant: 'tee', pattern: 'stripes' }),
  item('top-juventus-jersey', 'top', 'Juventus', 'Zwart-wit gestreept Juventus-shirt', null, ['#000000', '#FFFFFF'], { variant: 'tee', pattern: 'stripes' }),
  item('top-inter-jersey', 'top', 'Inter', 'Blauw-zwart gestreept voetbalshirt', null, ['#0068A8', '#000000'], { variant: 'tee', pattern: 'stripes' }),
  // Landenshirts (free, both character sets)
  item('top-italie-jersey', 'top', 'Italië', 'Blauw Italië-shirt', null, ['#1F5BC6', '#FFFFFF'], { variant: 'tee' }),
  item('top-nederland-jersey', 'top', 'Nederland', 'Oranje Nederland-shirt', null, ['#FF6A13', '#1B1B1E'], { variant: 'tee' }),
  item('top-duitsland-jersey', 'top', 'Duitsland', 'Wit Duitsland-shirt', null, ['#FFFFFF', '#1B1B1E'], { variant: 'tee' }),
  item('top-turkije-jersey', 'top', 'Turkije', 'Rood Turkije-shirt', null, ['#E30A17', '#FFFFFF'], { variant: 'tee' }),
  item('top-spanje-jersey', 'top', 'Spanje', 'Rood Spanje-shirt', null, ['#C60B1E', '#FFC400'], { variant: 'tee' }),
  item('top-marokko-jersey', 'top', 'Marokko', 'Rood Marokko-shirt', null, ['#C1272D', '#006233'], { variant: 'tee' }),
  item('bottom-trivo-shorts', 'bottom', 'trivo', 'Sportshort', null, ['#2851A3', '#FFFFFF'], { variant: 'shorts', graphic: 'stripes2' }),
  item('bottom-rossano-plaid-skirt', 'bottom', 'ROSSANO', 'Ruitrok', 229, ['#7C1E2C', '#1B1B1E'], { variant: 'skirt', pattern: 'plaid' }),
  item('bottom-strideon-black-cargo', 'bottom', 'Strideon', 'Zwarte cargobroek', 129, ['#1E1E22'], { variant: 'cargo' }),
  item('dress-lune-stars', 'dress', 'LUNE LUNE', 'Sterrenjurk', 199, ['#1D2333', '#F3E3A2'], { variant: 'mini', pattern: 'hearts' }),
  item('shoes-klompz-pink', 'shoes', 'klompz', 'Roze klomp', null, ['#F2A9BE'], { variant: 'clog' }),
  item('shoes-klompz-neon', 'shoes', 'klompz', 'Neon klomp', 59, ['#C6F432'], { variant: 'clog' }, true),
  item('shoes-strideon-runner', 'shoes', 'Strideon', 'Oranje hardloopschoenen', 149, ['#FF7A1A', '#F4F4F6'], { variant: 'sneaker', graphic: 'wave' }),
  item('outer-trivo-track-jacket', 'outerwear', 'trivo', 'Trainingsjack', null, ['#1F5E3B', '#FFFFFF'], { variant: 'zip', graphic: 'stripes2' }),
  item('outer-rossano-trench', 'outerwear', 'ROSSANO', 'Lichte trenchcoat', 449, ['#C8B08A', '#5A4632'], { variant: 'jacket' }, true),
  item('hat-trivo-beanie', 'hat', 'trivo', 'Gestreepte muts', null, ['#D3242C'], { variant: 'beanie' }),
  item('hat-klompz-bucket', 'hat', 'klompz', 'Gele bucket hat', 39, ['#FFE436'], { variant: 'bucket' }),
  item('bag-strideon-backpack', 'bag', 'Strideon', 'Sportrugzak', null, ['#2B2B2F', '#C6F432'], { variant: 'backpack' }),
  item('outer-ploeg-olive-jacket', 'outerwear', 'Ploeg & Co', 'Olijfgroen overshirt', null, ['#5E6B45', '#3E472C'], { variant: 'jacket' }),
  item('outer-strideon-black-jacket', 'outerwear', 'Strideon', 'Zwart coachjack', 149, ['#1B1B1E', '#F4F4F6'], { variant: 'jacket', graphic: 'wave' }),
  item('outer-ploeg-tan-jacket', 'outerwear', 'Ploeg & Co', 'Camel werkjack', 199, ['#B98A57', '#7A5A36'], { variant: 'jacket' }),
  item('outer-basisbes-denim-jacket', 'outerwear', 'Basisbes', 'Spijkerjack', null, ['#4F78A8', '#35587F'], { variant: 'jacket' }),
  item('outer-kast-cream-hoodie', 'outerwear', 'Kast Studio', 'Crème hoodie', null, ['#E9DFCB', '#CDBFA5'], { variant: 'hoodie' }),
  item('bottom-kast-cream-joggers', 'bottom', 'Kast Studio', 'Crème joggingbroek', null, ['#DCCFB6'], { variant: 'joggers' }),
  item('bottom-basisbes-grey-jeans', 'bottom', 'Basisbes', 'Grijze baggy jeans', null, ['#8A8D93'], { variant: 'jeans' }),
  item('shoes-strideon-panda', 'shoes', 'Strideon', 'Zwart-witte lowtops', 119, ['#F4F4F6', '#1C1C1E'], { variant: 'sneaker', graphic: 'wave' }, true),
  item('shoes-royaums-kilian-black', 'shoes', 'Royaums', 'Kilian zwart met studs', 179, ['#1C1C1E', '#F4F4F6'], { variant: 'sneaker' }, true),
  item('shoes-royaums-kilian-grey', 'shoes', 'Royaums', 'Kilian grijs met studs', 179, ['#5F6166', '#F4F4F6'], { variant: 'sneaker' }),
  item('shoes-royaums-luisa-white', 'shoes', 'Royaums', 'Luisa wit met driehoekstuds', 159, ['#F4F4F6', '#C41822'], { variant: 'sneaker' }),
  item('top-ploeg-burgundy-knit', 'top', 'Ploeg & Co', 'Bordeaux kabeltrui', null, ['#6E1A24', '#4A1018'], { variant: 'crew' }),
  item('outer-trivo-windbreaker', 'outerwear', 'trivo', 'Retro windjack', null, ['#1E2B4F', '#F07A1E', '#FFFFFF'], { variant: 'zip' }),
  item('glasses-trivo-sport', 'glasses', 'trivo', 'Sportzonnebril', 99, ['#FF5B95'], { variant: 'shades' }),
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
  curly: 'Krullen', short: 'Kort', wavy: 'Golvend', buzz: 'Buzzcut', long: 'Lang', afro: 'Afro', bun: 'Knot', curtain: 'Curtain', 'curtain-short': 'Curtain kort', kuif: 'Kuif', twists: 'Twists',
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
