import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/run_rules.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../js/shop_rules.js', import.meta.url), 'utf8'), context);

test('changing the node key refresh salt produces a new deterministic shelf', () => {
  const offers = Array.from({ length: 12 }, (_, index) => ({
    id: `gu_${index}`,
    kind: 'purchase',
    tier: 1,
    gu_id: `gu_${index}`,
  }));
  const base = { seed: 20261012, pacingLayers: { 1: { shop_max_tier: 1 } }, layer: 1 };
  const first = context.ShopRules.stock(offers, { ...base, nodeKey: 'rest_1.refresh.0' });
  const firstAgain = context.ShopRules.stock(offers, { ...base, nodeKey: 'rest_1.refresh.0' });
  const refreshed = context.ShopRules.stock(offers, { ...base, nodeKey: 'rest_1.refresh.1' });

  assert.deepEqual(first, firstAgain);
  assert.notDeepEqual(first, refreshed);
  assert.equal(new Set(refreshed).size, refreshed.length);
  assert.ok(refreshed.every((id) => offers.some((offer) => offer.id === id)));
});
