import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import * as H from './help-center.ts';

test('every category has articles with unique ids and Dutch questions', () => {
  const ids = H.HELP_CATEGORIES.flatMap(c => c.articles.map(a => a.id));
  assert.ok(H.HELP_CATEGORIES.length >= 5);
  assert.equal(new Set(ids).size, ids.length, 'article ids are unique');
  for (const c of H.HELP_CATEGORIES) for (const a of c.articles) {
    assert.ok(a.q.length > 5 && a.a.length >= 1, a.id);
    for (const p of a.a) assert.doesNotMatch(p, /TODO|lorem/i);
  }
});

test('article actions point at real app routes', () => {
  for (const c of H.HELP_CATEGORIES) for (const a of c.articles) if (a.action) {
    const f = new URL(`../app${a.action.route}.tsx`, import.meta.url);
    assert.ok(existsSync(f), `${a.id} → ${a.action.route} exists`);
  }
});

test('search is accent/case-insensitive, needs all words and ranks question matches first', () => {
  assert.deepEqual(H.searchHelp('   '), []);
  const pw = H.searchHelp('WACHTWOORD vergeten').map(h => h.article.id);
  assert.equal(pw[0], 'wachtwoord-vergeten');
  assert.ok(H.searchHelp('ghost').some(h => h.article.id === 'ghost'));
  assert.ok(H.searchHelp('avg').some(h => h.article.id === 'download'));
  assert.equal(H.searchHelp('xyzzy qwerty').length, 0);
  assert.ok(H.searchHelp('naaktfoto’s').some(h => h.article.id === 'chantage'), 'curly apostrophe folds');
  assert.ok(H.searchHelp("naaktfoto's").some(h => h.article.id === 'chantage'), 'straight apostrophe matches too');
  assert.equal(H.findArticle('blokkeren')?.category.id, 'veiligheid');
  assert.equal(H.findArticle('nope'), null);
});

test('supportMailto builds a mailto to support with encoded subject/body and context', () => {
  const url = H.supportMailto({ topic: 'plus', message: 'Mijn X+ is weg & ik betaalde', handle: '@kevin', version: '1.0.0', platform: 'ios 18' });
  assert.match(url, /^mailto:support@snapshot-x\.nl\?subject=/);
  assert.doesNotMatch(url, /\+| /, 'spaces are %20, no raw spaces or plus signs');
  const q = new URLSearchParams(url.split('?')[1].replace(/\+/g, '%2B'));
  assert.equal(q.get('subject'), 'Snapshot X support: Snapshot X+ en betalingen');
  const body = q.get('body');
  assert.match(body, /^Mijn X\+ is weg & ik betaalde\n\n—\n/);
  assert.match(body, /Gebruikersnaam: @kevin\n/);
  assert.match(body, /App: Snapshot X 1\.0\.0/);
  assert.match(body, /Toestel: ios 18$/);
  const bare = new URLSearchParams(H.supportMailto({ topic: 'bug' }).split('?')[1]).get('body');
  assert.match(bare, /^Beschrijf hier je vraag/);
  assert.doesNotMatch(bare, /Gebruikersnaam|Toestel/);
});

test('crisis lines are Dutch numbers with tel: links; settings links to /help; layout registers it', () => {
  assert.deepEqual(H.CRISIS_LINES.map(l => l.number), ['112', '0800-0113', '0800-0432']);
  for (const l of H.CRISIS_LINES) assert.equal(l.tel, 'tel:' + l.number.replace(/-/g, ''));
  const settings = readFileSync(new URL('../app/settings.tsx', import.meta.url), 'utf8');
  assert.match(settings, /row\('Help en support'[^)]*\)=>router\.push\('\/help'\)/);
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /name="help" options=\{\{headerShown:false/);
  const meta = readFileSync(new URL('../docs/app-store/METADATA_NL.md', import.meta.url), 'utf8');
  assert.match(meta, /Support-URL \| https:\/\/snapshot-x\.expo\.app\/help/);
});
