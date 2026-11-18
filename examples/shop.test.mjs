import { test } from 'node:test';
import assert from 'node:assert';

test('prices add up', () => {
  assert.strictEqual([12, 5, 30].reduce((a, b) => a + b, 0), 47);
});

test('basket has milk', () => {
  assert.ok(['bread', 'milk', 'cheese'].includes('milk'));
});
