import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from './snap-sound.ts';

test('encode / parse round trip; voice only on video', () => {
  assert.equal(S.encodeSound({ music: 'zomerzon', voice: 'helium' }, 'video'), 'm:zomerzon;v:helium');
  assert.equal(S.encodeSound({ music: 'zomerzon', voice: 'helium' }, 'photo'), 'm:zomerzon');
  assert.equal(S.encodeSound({ music: null, voice: 'reus' }, 'video'), 'v:reus');
  assert.equal(S.encodeSound(S.NO_SOUND, 'video'), null);
  assert.equal(S.encodeSound({ music: 'nope', voice: null }, 'video'), null);
  assert.deepEqual(S.parseSound('m:zomerzon;v:helium'), { music: 'zomerzon', voice: 'helium' });
  assert.deepEqual(S.parseSound('m:onbekend;v:reus'), { music: null, voice: 'reus' });
  assert.deepEqual(S.parseSound(null), S.NO_SOUND);
  for (const t of S.MUSIC_TRACKS) for (const f of S.VOICE_FILTERS) assert.deepEqual(S.parseSound(S.encodeSound({ music: t.id, voice: f.id }, 'video')), { music: t.id, voice: f.id });
});

test('values always match the DB check constraint', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../supabase/migrations/20261120050000_snap_sound.sql', import.meta.url), 'utf8');
  const re = new RegExp(/sound ~ '([^']+)'/.exec(sql)[1]);
  for (const t of S.MUSIC_TRACKS) for (const f of S.VOICE_FILTERS) {
    assert.match(S.encodeSound({ music: t.id, voice: f.id }, 'video'), re);
    assert.match(S.encodeSound({ music: t.id, voice: null }, 'video'), re);
    assert.match(S.encodeSound({ music: null, voice: f.id }, 'video'), re);
  }
});

test('rate + label + missing-column retry', async () => {
  assert.equal(S.playbackRateFor({ music: null, voice: null }), 1);
  assert.ok(S.playbackRateFor({ music: null, voice: 'helium' }) > 1);
  assert.ok(S.playbackRateFor({ music: null, voice: 'reus' }) < 1);
  assert.equal(S.soundLabel({ music: 'zomerzon', voice: 'helium' }), '♪ Zomerzon · 🎈 Helium');
  assert.equal(S.soundLabel(S.NO_SOUND), '');
  const rows = [];
  const res = await S.insertWithSound(async r => { rows.push(r); return rows.length === 1 ? { error: { code: 'PGRST204', message: "Could not find the 'sound' column of 'sx_messages' in the schema cache" } } : { error: null }; }, { a: 1, sound: 'm:zomerzon' });
  assert.equal(res.error, null); assert.equal(rows.length, 2); assert.equal('sound' in rows[1], false);
  const other = await S.insertWithSound(async () => ({ error: { code: '42501', message: 'rls' } }), { sound: 'm:zomerzon' });
  assert.ok(other.error);
});
