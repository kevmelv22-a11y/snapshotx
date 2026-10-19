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
  assert.deepEqual(HAIRSTYLES.male.map(h => h.label), ['Krullen', 'Kort', 'Golvend', 'Fade', 'Afro']);
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
