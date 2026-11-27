import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { locationBody, parseLocation, formatCoords, accuracyText, mapsUrl, LOCATION_LABEL } from './chat-location.ts';
import { chatPreviewText } from './avatar/poses.ts';
import { quoteOf } from './chat-replies.ts';

test('location body: rounded to 4 decimals, validated, round-trips', () => {
  const b = locationBody(52.373123, 4.892611, 23.6);
  assert.equal(b, '[loc]{"lat":52.3731,"lng":4.8926,"acc":24}');
  assert.deepEqual(parseLocation(b), { lat: 52.3731, lng: 4.8926, acc: 24 });
  assert.equal(locationBody(91, 0), null); assert.equal(locationBody(NaN, 1), null);
  assert.equal(locationBody(1, 2, -5), '[loc]{"lat":1,"lng":2}');
  assert.equal(parseLocation('[loc]{"lat":"52","lng":4}'), null);
  assert.equal(parseLocation('[loc]{"lat":100,"lng":4}'), null);
  assert.equal(parseLocation('[loc]nope'), null);
  assert.equal(parseLocation('hoi [loc]{"lat":1,"lng":2}'), null);
});
test('location text: Dutch coords, accuracy, maps link per platform', () => {
  const l = { lat: 52.3731, lng: -4.8926, acc: 1500 };
  assert.equal(formatCoords(l), '52,3731° N, 4,8926° W');
  assert.equal(accuracyText(l), 'Ongeveer (±1,5 km)');
  assert.equal(accuracyText({ ...l, acc: 12 }), 'Nauwkeurig tot op ±12 m');
  assert.match(mapsUrl(l, 'ios'), /^https:\/\/maps\.apple\.com\/\?ll=52\.3731,-4\.8926/);
  assert.match(mapsUrl(l, 'android'), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=52\.3731,-4\.8926$/);
});
test('previews and quotes never show raw coordinates', () => {
  const b = locationBody(52.1, 5.1, 10);
  assert.equal(chatPreviewText(b), LOCATION_LABEL.preview);
  assert.equal(quoteOf({ kind: 'text', body: b }).excerpt, LOCATION_LABEL.preview);
});
test('chat screen: + opens the attach sheet with Mijn locatie sturen behind a confirm', async () => {
  const src = await readFile(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(src, /testID="chat-attach"/); assert.match(src, /key:'location'/);
  assert.match(src, /confirm\.ask\(\{title:'Je locatie sturen\?'/);
  assert.match(src, /<LocationBubble loc=\{loc\}/);
});
