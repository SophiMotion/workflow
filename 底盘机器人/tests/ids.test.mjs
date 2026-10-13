import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { randomId } from '../shared/ids.mjs';

test('HTTPS uses the native UUID method with its crypto receiver', () => {
  const cryptoSource = { randomUUID() { assert.equal(this, cryptoSource); return 'native-uuid'; } };
  assert.equal(randomId(cryptoSource), 'native-uuid');
});

test('HTTP previews generate distinct UUID v4 IDs without randomUUID', () => {
  const cryptoSource = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const ids = Array.from({length: 100}, () => randomId(cryptoSource));
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(ids).size, ids.length);
});
