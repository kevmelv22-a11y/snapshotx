import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Regression (2026-10-20): "Stuur het eerste bericht ✦" rendered upside down on iOS because it was the
// ListEmptyComponent of an inverted FlatList. The empty hint must be rendered outside the inverted list.
test('ChatView: inverted message list has no ListEmptyComponent; empty hint rendered outside it', () => {
  const src = readFileSync(new URL('../components/chat/ChatView.tsx', import.meta.url), 'utf8');
  const list = src.slice(src.indexOf('<FlatList'), src.indexOf('renderItem=', src.indexOf('<FlatList')));
  assert.match(list, /\binverted\b/);
  assert.doesNotMatch(list, /ListEmptyComponent/);
  assert.match(src, /p\.rows\.length===0&&<View[^>]*testID="chat-empty"/);
});
