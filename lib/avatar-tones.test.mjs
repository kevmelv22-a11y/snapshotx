import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { ART_HAIR, HAIR_COLORS, SKIN_TONES, hairColorOf, hasToneChoice, skinToneOf, toneKeys, withAppearance, withHairColor, withSkinTone } from './avatar/tones.ts';
import { CLASSIC_HAIR, CLASSIC_SKIN } from './avatar/appearance.ts';
import { DEFAULT_OUTFIT, DEFAULT_FEMALE_OUTFIT, DEFAULT_HAIR, DEFAULT_SKIN } from './avatar/outfit.ts';
import { comboLayers } from './avatar/combo.ts';
import { WORN_BANDS } from './avatar/wornBandInfo.ts';
import { ORIGINAL_HAIR, WORN_TONES } from './avatar/wornToneInfo.ts';

const male = { ...DEFAULT_OUTFIT, colors: {} };
const female = { ...DEFAULT_FEMALE_OUTFIT, colors: { ...DEFAULT_FEMALE_OUTFIT.colors } };

test('palettes are the classic editor palettes (old saved choices keep working)', () => {
  assert.deepEqual(SKIN_TONES.map(t => t.hex), [...CLASSIC_SKIN]);
  assert.deepEqual(HAIR_COLORS.map(t => t.hex), [...CLASSIC_HAIR]);
  assert.deepEqual(SKIN_TONES.map(t => t.label), ['Licht', 'Warm', 'Getint', 'Bruin', 'Donker']);
});

test('defaults show the art as drawn: no overlays, no forced composite', () => {
  assert.equal(skinToneOf(male), 'warm');
  assert.equal(hairColorOf(male), 'darkbrown');
  assert.equal(hairColorOf(female), 'blonde', 'female start hair #D2A85E is the art blonde');
  assert.deepEqual(toneKeys(male), []);
  assert.deepEqual(toneKeys(female), []);
  assert.equal(hasToneChoice(male), false);
  assert.deepEqual(toneKeys({ ...male, colors: { skin: DEFAULT_SKIN, hair: DEFAULT_HAIR } }), [], 'legacy defaults = art tone');
  assert.equal(ORIGINAL_HAIR.male, ART_HAIR.male);
  assert.equal(ORIGINAL_HAIR.female, ART_HAIR.female);
});

test('picked tones become overlay keys; the art tone itself needs none but still counts as a choice', () => {
  const o = withHairColor(withSkinTone(male, 'dark'), 'blonde');
  assert.deepEqual(toneKeys(o), ['s-dark', 'h-blonde']);
  const warm = withSkinTone(male, 'warm');
  assert.deepEqual(toneKeys(warm), []);
  assert.equal(hasToneChoice(warm), true);
  assert.deepEqual(toneKeys(withHairColor(female, 'blonde')), [], 'blonde is the female art colour');
  assert.deepEqual(toneKeys(withHairColor(female, 'darkbrown')), ['h-darkbrown']);
});

test('looks / start look / character switch keep the picked tones', () => {
  const from = withHairColor(withSkinTone(male, 'tan'), 'auburn');
  const look = withAppearance({ ...female }, from);
  assert.deepEqual(toneKeys(look), ['s-tan', 'h-auburn']);
  assert.equal(look.top, female.top, 'clothes untouched');
  assert.equal(withAppearance(female, male), female, 'nothing picked: same object');
});

test('every composite face/hand band has overlays for every tone, and hair overlays on every head', () => {
  for (const g of ['male', 'female']) {
    const set = WORN_BANDS[g], tones = WORN_TONES[g];
    for (const [id, it] of Object.entries(set.items)) {
      if (!it.bands.head) continue;
      const t = tones[`${id}/head`] ?? {};
      for (const s of SKIN_TONES) if (s.id !== 'warm') assert.ok(t[`s-${s.id}`], `${g} ${id} head s-${s.id}`);
      if (it.cat === 'hat') continue; // some hats hide all hair
      for (const h of HAIR_COLORS) if (h.id !== ART_HAIR[g]) assert.ok(t[`h-${h.id}`], `${g} ${id} head h-${h.id}`);
    }
    // the start looks: every layer that shows skin has its overlays
    const o = g === 'male' ? male : female;
    for (const l of comboLayers(o, set, g)) if (l.band === 'head' || l.band === 'torso') assert.ok(tones[`${l.item}/${l.band}`]?.['s-dark'], `${g} ${l.item}/${l.band}`);
  }
});

test('generated require map points at existing overlay files', () => {
  const src = readFileSync(new URL('./wornTones.ts', import.meta.url), 'utf8');
  const files = [...src.matchAll(/require\('\.\.\/(assets\/avatar-art\/worn-tones\/[^']+)'\)/g)].map(m => m[1]);
  assert.ok(files.length > 1000);
  for (const f of files) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
});

import { HAIRSTYLES, ART_HAIRSTYLE, hairStyleOf, styleLayerOf, withHairStyle } from './avatar/tones.ts';
import { comboStyle } from './avatar/combo.ts';
import { WORN_STYLES } from './avatar/wornStyleInfo.ts';

test('Kapsel: art style is the default and draws no layer; unknown / other-set values fall back', () => {
  assert.equal(HAIRSTYLES.male[0].id, ART_HAIRSTYLE.male.id);
  assert.equal(HAIRSTYLES.female[0].id, ART_HAIRSTYLE.female.id);
  assert.equal(hairStyleOf(male), 'curly');
  assert.equal(styleLayerOf(male), null);
  assert.equal(hasToneChoice(male), false);
  assert.equal(styleLayerOf(withHairStyle(male, 'afro')), 'afro');
  assert.equal(hasToneChoice(withHairStyle(male, 'afro')), true, 'a Kapsel forces the composite');
  assert.equal(hairStyleOf(withHairStyle(male, 'bun')), 'curly', 'no such male style');
  assert.equal(styleLayerOf(withHairStyle(female, 'afro')), null, 'male style on the female set');
  assert.deepEqual(HAIRSTYLES.male.map(h => h.label), ['Krullen', 'Kort', 'Golvend', 'Fade', 'Afro', 'Curtain', 'Curtain kort', 'Kuif', 'Twists', 'Hanenkam', 'Man bun']);
});

test('Kapsel carries over looks / character switches only where the set has it', () => {
  const from = withHairStyle(male, 'wavy');
  assert.equal(withAppearance({ ...male, hairStyle: 'curly' }, from).hairStyle, 'wavy');
  assert.equal(withAppearance(female, from), female, 'female set has no wavy layer: unchanged');
});

test('every male Kapsel has a layer with skin + hair overlays; hats win', () => {
  const set = WORN_BANDS.male, S = WORN_STYLES.male, avail = Object.keys(S.styles);
  for (const h of HAIRSTYLES.male.slice(1)) {
    const st = S.styles[h.id]; assert.ok(st, h.id);
    for (const s of SKIN_TONES) if (s.id !== 'warm') assert.ok(st.tones[`s-${s.id}`], `${h.id} s-${s.id}`);
    for (const c of HAIR_COLORS) assert.ok(st.tones[`h-${c.id}`], `${h.id} h-${c.id}`);
  }
  for (const [id, it] of Object.entries(set.items)) if (it.bands.head && it.cat !== 'hat') assert.ok(S.keep[id], `keep ${id}`);
  const o = withHairStyle(male, 'afro');
  assert.equal(comboStyle(o, comboLayers(o, set, 'male'), set, avail), 'afro');
  const hatId = Object.keys(set.items).find(id => set.items[id].cat === 'hat' && set.items[id].bands.head);
  const withHat = { ...o, hat: hatId };
  assert.equal(comboStyle(withHat, comboLayers(withHat, set, 'male'), set, avail), null);
});

// ---- Female Kapsels (Lang stijl, Knot, Bob) ----
import { kapselBlocked, HAIR_BANDS } from './avatar/combo.ts';
import { parseOutfit, reconcile, sameOutfit, sanitizeOutfit } from './avatar/outfit.ts';
import { WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';

const FS = WORN_STYLES.female;
const femaleSupports = (item, band) => band === 'head' ? !!FS.keep[item] : !!FS.clean[`${item}/${band}`];
const fAvail = Object.keys(FS.styles);

test('female Kapsel list: art style first, then Lang stijl, Knot, Bob (Dutch labels)', () => {
  assert.deepEqual(HAIRSTYLES.female.map(h => h.id), ['wavy', 'long', 'bun', 'short']);
  assert.deepEqual(HAIRSTYLES.female.map(h => h.label), ['Lang golvend', 'Lang stijl', 'Knot', 'Bob']);
  assert.equal(styleLayerOf(female), null, 'start look = art hair, no layer');
  for (const h of HAIRSTYLES.female.slice(1)) {
    assert.equal(hairStyleOf(withHairStyle(female, h.id)), h.id);
    assert.equal(styleLayerOf(withHairStyle(female, h.id)), h.id);
    assert.equal(hasToneChoice(withHairStyle(female, h.id)), true, 'a Kapsel forces the composite');
  }
  assert.equal(hairStyleOf(withHairStyle(female, 'afro')), 'wavy', 'male-only style falls back to the art style');
});

test('every female Kapsel has a layer with skin overlays and hair overlays for every non-art colour', () => {
  for (const h of HAIRSTYLES.female.slice(1)) {
    const st = FS.styles[h.id]; assert.ok(st, h.id);
    for (const s of SKIN_TONES) if (s.id !== 'warm') assert.ok(st.tones[`s-${s.id}`], `${h.id} s-${s.id}`);
    for (const c of HAIR_COLORS) {
      if (c.id === ART_HAIR.female) assert.equal(st.tones[`h-${c.id}`], undefined, 'the edits keep the art blonde: drawn as is');
      else assert.ok(st.tones[`h-${c.id}`], `${h.id} h-${c.id}`);
    }
  }
});

test('female hair-free bands: every supported item has a keep band and clean top bands with skin overlays', () => {
  const items = Object.keys(FS.keep);
  assert.ok(items.includes('top-nike-black-tee'), 'the female start top');
  assert.ok(items.length >= 6);
  for (const id of items) {
    const it = WORN_BANDS.female.items[id];
    assert.ok(FS.clean[`${id}/torso`], `${id} torso`);
    for (const s of SKIN_TONES) if (s.id !== 'warm') assert.ok(FS.clean[`${id}/torso`][`s-${s.id}`], `${id} torso s-${s.id}`);
    if (it.bands.jacket) assert.ok(FS.clean[`${id}/jacket`], `${id} jacket cutout`);
  }
  const src = readFileSync(new URL('./wornStyles.ts', import.meta.url), 'utf8');
  const files = [...src.matchAll(/require\('\.\.\/(assets\/avatar-art\/worn-(?:styles|clean)\/female\/[^']+)'\)/g)].map(m => m[1]);
  assert.ok(files.some(f => f.includes('worn-clean')));
  for (const f of files) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
});

test('female Kapsel shows with hair-free clothes (start cap counts as no hat), else the art hair stays', () => {
  const set = WORN_BANDS.female;
  const bun = withHairStyle(female, 'bun');
  assert.equal(bun.hat, 'hat-nike-cap');
  const L = o => comboLayers(o, set, 'female');
  assert.equal(comboStyle(bun, L(bun), set, fAvail, femaleSupports), 'bun', 'start look + Knot');
  assert.equal(kapselBlocked(bun, L(bun), set, fAvail, femaleSupports), null);
  for (const l of L(bun)) if (HAIR_BANDS.includes(l.band)) assert.ok(femaleSupports(l.item, l.band), `${l.item}/${l.band}`);
  const hoodie = { ...bun, outerwear: 'outer-blueberry-blue-hoodie', worn: 'outer-blueberry-blue-hoodie' };
  assert.equal(comboStyle(hoodie, L(hoodie), set, fAvail, femaleSupports), 'bun', 'supported jacket');
  const skull = { ...bun, top: 'top-bf-skull-tee', worn: 'top-bf-skull-tee', torso: 'top-bf-skull-tee' };
  assert.equal(comboStyle(skull, L(skull), set, fAvail, femaleSupports), null, 'top with baked hair only: art hair');
  assert.equal(kapselBlocked(skull, L(skull), set, fAvail, femaleSupports), 'clothes');
  const hatId = Object.keys(set.items).find(id => set.items[id].cat === 'hat' && set.items[id].bands.head && id !== 'hat-nike-cap');
  const hat = { ...bun, hat: hatId };
  assert.equal(comboStyle(hat, L(hat), set, fAvail, femaleSupports), null, 'hats win');
  assert.equal(kapselBlocked(hat, L(hat), set, fAvail, femaleSupports), 'hat');
  assert.equal(kapselBlocked(female, L(female), set, fAvail, femaleSupports), null, 'no Kapsel picked');
  // male: no supports predicate, unchanged behaviour
  const afro = withHairStyle(male, 'afro');
  assert.equal(comboStyle(afro, comboLayers(afro, WORN_BANDS.male, 'male'), WORN_BANDS.male, Object.keys(WORN_STYLES.male.styles)), 'afro');
});

test('female Kapsel is saved with the per-account outfit (save, account row, reconcile, dirty check)', () => {
  const picked = withHairColor(withSkinTone(withHairStyle(female, 'bun'), 'brown'), 'black');
  assert.equal(sameOutfit(picked, female), false, 'a Kapsel change makes the editor dirty');
  const saved = sanitizeOutfit(picked, WARDROBE_ITEMS, [], female);
  assert.equal(saved.hairStyle, 'bun');
  assert.equal(saved.gender, 'female');
  const row = parseOutfit(JSON.parse(JSON.stringify(saved)), WARDROBE_ITEMS);
  assert.equal(row.hairStyle, 'bun', 'account row keeps the Kapsel');
  assert.deepEqual(row.colors, saved.colors);
  assert.ok(sameOutfit(row, saved));
  const t = iso => new Date(iso).toISOString();
  const remote = { outfit: withHairStyle(row, 'short'), unlocked: [], updatedAt: t('2026-10-20T08:00:00Z') };
  const r = reconcile({ outfit: saved, unlocked: [], updatedAt: t('2026-10-20T07:00:00Z') }, remote);
  assert.equal(r.outfit.hairStyle, 'short', 'newest account copy (Bob) wins');
  for (const h of HAIRSTYLES.female) assert.equal(parseOutfit({ ...saved, hairStyle: h.id }, WARDROBE_ITEMS).hairStyle, h.id, h.id);
});

// ---- Female Kapsel quality: skin overlays fit their bands, the tee hem, club jerseys ----
import { inflateSync } from 'node:zlib';
/** Minimal PNG reader (8-bit RGBA or palette + tRNS, non-interlaced): enough for the band art. */
function readPng(file) {
  const b = readFileSync(new URL(`../${file}`, import.meta.url)); let p = 8, w = 0, h = 0, ct = 0, plte = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len); p += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); assert.equal(d[8], 8, `${file}: 8-bit`); ct = d[9]; assert.equal(d[12], 0, `${file}: not interlaced`); }
    else if (type === 'PLTE') plte = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d);
  }
  const bpp = ct === 6 ? 4 : ct === 3 ? 1 : assert.fail(`${file}: colour type ${ct}`), raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = y && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      px[y * stride + x] = (row[x] + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255;
    }
  }
  const alpha = (x, y) => ct === 6 ? px[(y * w + x) * 4 + 3] : (trns && px[y * w + x] < trns.length ? trns[px[y * w + x]] : 255);
  return { w, h, alpha };
}
const pngSize = file => { const b = readFileSync(new URL(`../${file}`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('female hair-free bands: every skin overlay rect has the size of its overlay image (generated info is current)', () => {
  // a stale wornStyleInfo (rects from an older tones run) stretched the arm overlays off the arms: dark face, light arms
  for (const [key, tones] of Object.entries(FS.clean)) {
    const [item, band] = key.split('/'), r = WORN_BANDS.female.items[item].bands[band];
    assert.deepEqual(pngSize(`assets/avatar-art/worn-clean/female/${item}-${band}.png`), [r[2], r[3]], `${key} band size`);
    for (const [t, o] of Object.entries(tones)) {
      assert.deepEqual(pngSize(`assets/avatar-art/worn-clean/female/${item}-${band}--${t}.png`), [o[2], o[3]], `${key} ${t}`);
      assert.ok(o[0] >= 0 && o[1] >= 0 && o[0] + o[2] <= r[2] && o[1] + o[3] <= r[3], `${key} ${t} inside the band`);
    }
  }
  const tee = FS.clean['top-nike-black-tee/torso']['s-dark'], r = WORN_BANDS.female.items['top-nike-black-tee'].bands.torso;
  assert.ok(tee[2] >= 0.8 * r[2], 'the dark-skin overlay spans both arms, not just the neck / chin hand');
});

test('female tee: the shirt runs on to its own hem over the trousers (no faded strip at the waist)', () => {
  const r = WORN_BANDS.female.items['top-nike-black-tee'].bands.torso, legs = WORN_BANDS.female.items['bottom-basisbes-grey-jeans'].bands.legs;
  for (const file of ['assets/avatar-art/worn-bands/female/top-nike-black-tee-torso.png', 'assets/avatar-art/worn-clean/female/top-nike-black-tee-torso.png']) {
    const im = readPng(file);
    // canvas rows 380-391 were a 12px fade (build.py band line) right above the real hem; the trousers start at legs[1]
    for (const cx of [140, 180, 220]) for (let cy = 380; cy <= 389; cy++) assert.equal(im.alpha(cx - r[0], cy - r[1]), 255, `${file} (${cx},${cy})`);
    assert.ok(legs[1] < 380, 'the trousers band lies under the hem');
    assert.equal(im.alpha(180 - r[0], 420 - r[1]), 0, `${file}: below the hem the trousers show`);
  }
});

test('female Kapsel with a club jersey: the art hair stays (no hair-free jersey art yet) and the picker says why', () => {
  const set = WORN_BANDS.female, jerseys = Object.keys(set.items).filter(id => /^top-.*-jersey$/.test(id) && id !== 'top-overtime-jersey');
  assert.ok(jerseys.length >= 11, `club jerseys: ${jerseys}`);
  for (const id of jerseys) for (const h of HAIRSTYLES.female.slice(1)) {
    const o = { ...withHairStyle(female, h.id), top: id, worn: id, torso: id }, l = comboLayers(o, set, 'female');
    assert.ok(l.some(x => x.item === id && x.band === 'torso'), `${id} drawn`);
    assert.equal(comboStyle(o, l, set, fAvail, femaleSupports), null, `${id} + ${h.id}: art hair, no half-clean mix`);
    assert.equal(kapselBlocked(o, l, set, fAvail, femaleSupports), 'clothes', `${id} + ${h.id}: hint`);
  }
  const back = { ...withHairStyle(female, 'short') }; // back on the tee: the Kapsel shows again
  assert.equal(comboStyle(back, comboLayers(back, set, 'female'), set, fAvail, femaleSupports), 'short');
});
