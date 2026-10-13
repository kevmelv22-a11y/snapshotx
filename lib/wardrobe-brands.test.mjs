import assert from 'node:assert/strict';
import test from 'node:test';
import { CURATED_LOOKS, ITEMS_BY_ID, WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';
import { CATEGORIES, DEFAULT_OUTFIT } from './avatar/outfit.ts';

// Item ids before the brand clean-up (61fdd39). Saved outfits / unlocked items store these ids, so they must keep resolving.
const LEGACY_IDS = ['top-blueberry-white-tee','top-nike-black-tee','top-bf-plaid-shirt','top-bf-skull-tee','top-bf-pumpkin-tee','top-carhartt-longsleeve','top-clubsportif-rugby','top-bf-beige-tee','top-lacoste-polo','top-snapnation-movements','top-overtime-jersey','top-adidas-longsleeve','bottom-white-cargo','bottom-blueberry-jeans','bottom-adidas-track','bottom-carhartt-doubleknee','bottom-bf-shorts','bottom-miumiu-skirt','bottom-nike-joggers','dress-festive-red-gown','dress-bf-mummy-wrap','dress-bf-white-tulle','dress-dressx-hearts','dress-miumiu-slip','dress-bf-mint-maxi','shoes-nike-white','shoes-adidas-bw','shoes-balenciaga-fluffy','shoes-versace-chunky','shoes-blueberry-bunny','shoes-ugg-classic','shoes-crocs-clog','shoes-carhartt-work','socks-nike-white','socks-adidas-stripes','socks-festive-xmas','socks-bf-black-high','bag-prada-red-backpack','bag-prada-orange','bag-coach-pink','bag-coach-white','bag-coach-brown','bag-adidas-sport','bag-miumiu-mini','outer-nike-swoosh-hoodie','outer-paramount-emperor-robe','outer-bf-grunge-rose','outer-blueberry-blue-hoodie','outer-blueberry-black-vest','outer-dressx-green','outer-carhartt-camo','outer-carhartt-black','outer-versace-baroque','outer-lacoste-puffer','outer-overtime-varsity','outer-bf-fur-coat','hat-bf-beanie','hat-nike-cap','hat-balenciaga-bucket','hat-prada-fedora','acc-snapnation-mic','acc-paramount-gold-mic','acc-overtime-headset','glasses-bf-round','glasses-prada-shades','glasses-versace-aviator','glasses-miumiu-cateye'];

// Real-world brands (and our own placeholder trademarks) that must never be shown in the wardrobe.
const FORBIDDEN = /\b(nike|swoosh|adidas|prada|coach|carhartt|lacoste|versace|balenciaga|miu ?miu|ugg|crocs|dressx|paramount|overtime|bitmoji|snapchat|snap nation|blueberry|club sportif)\b/i;

test('every legacy wardrobe id still resolves (saved outfits stay backward compatible)', () => {
  for (const id of LEGACY_IDS) assert.ok(ITEMS_BY_ID.has(id), `missing legacy id ${id}`);
  assert.ok(WARDROBE_ITEMS.length >= LEGACY_IDS.length);
  assert.equal(new Set(WARDROBE_ITEMS.map(i => i.id)).size, WARDROBE_ITEMS.length, 'duplicate item id');
});

test('no real brand names or trademarks in user-facing wardrobe labels', () => {
  for (const item of WARDROBE_ITEMS) {
    assert.doesNotMatch(item.brand, FORBIDDEN, `brand of ${item.id}: ${item.brand}`);
    assert.doesNotMatch(item.name, FORBIDDEN, `name of ${item.id}: ${item.name}`);
  }
  for (const look of CURATED_LOOKS) assert.doesNotMatch(`${look.name} ${look.tagline}`, FORBIDDEN, look.id);
});

test('only own graphics are used (no swoosh / three stripes / crocodile crest / logo box)', () => {
  const allowed = new Set(['wave', 'skull', 'pumpkin', 'heart', 'patch', 'stripes2', 'star', undefined]);
  for (const item of WARDROBE_ITEMS) assert.ok(allowed.has(item.preview.graphic), `${item.id}: ${item.preview.graphic}`);
});

test('default outfit and curated looks only reference existing items', () => {
  for (const layer of CATEGORIES) { const id = DEFAULT_OUTFIT[layer]; if (id) assert.ok(ITEMS_BY_ID.has(id), `${layer}: ${id}`); }
  for (const look of CURATED_LOOKS) for (const id of Object.values(look.items)) assert.ok(ITEMS_BY_ID.has(id), `${look.id}: ${id}`);
});
