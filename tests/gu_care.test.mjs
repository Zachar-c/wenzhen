import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8'), context);
const rules = context.GuRules;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('care defaults preserve old saves and completed-node progress', () => {
  assert.deepEqual(plain(rules.careState()), { petals: 20, steps: 0, hungry: false });
  assert.deepEqual(plain(rules.careState(undefined, 7)), { petals: 20, steps: 7, hungry: false });
  assert.deepEqual(plain(rules.careState({ petals: 9, hungry: true }, 12)), { petals: 9, steps: 12, hungry: true });
});

test('care charges four petals per Moonlight Gu instance at each five-node boundary', () => {
  const owned = { moonlight_gu: 2 };
  let care = rules.careState(undefined, 0);
  care = rules.advanceCare(care, owned, 4);
  assert.deepEqual(plain(care), { petals: 20, steps: 4, hungry: false });
  care = rules.advanceCare(care, owned, 5);
  assert.deepEqual(plain(care), { petals: 12, steps: 5, hungry: false });
  care = rules.advanceCare(care, owned, 10);
  assert.deepEqual(plain(care), { petals: 4, steps: 10, hungry: false });
});

test('care is idempotent at the same completion count and catches up whole elapsed days', () => {
  const care = { petals: 20, steps: 0, hungry: false };
  const once = rules.advanceCare(care, { moonlight_gu: 1 }, 5);
  assert.deepEqual(plain(once), { petals: 16, steps: 5, hungry: false });
  assert.deepEqual(plain(rules.advanceCare(once, { moonlight_gu: 1 }, 5)), plain(once));
  assert.deepEqual(plain(rules.advanceCare(once, { moonlight_gu: 1 }, 16)), { petals: 8, steps: 16, hungry: false });
});

test('insufficient petals do not go negative and ownership loss clears hunger', () => {
  const hungry = rules.advanceCare({ petals: 3, steps: 0, hungry: false }, { moonlight_gu: 1 }, 5);
  assert.deepEqual(plain(hungry), { petals: 3, steps: 5, hungry: true });
  assert.deepEqual(plain(rules.advanceCare(hungry, {}, 10)), { petals: 3, steps: 10, hungry: false });
});

test('care purchase buys ten petals and automatically feeds a hungry Gu', () => {
  const fed = rules.buyCare({ petals: 3, steps: 5, hungry: true }, { moonlight_gu: 1 }, 4);
  assert.equal(fed.ok, true);
  assert.equal(fed.stones, 3);
  assert.deepEqual(plain(fed.care), { petals: 9, steps: 5, hungry: false });

  const capped = rules.buyCare({ petals: 10, steps: 0, hungry: false }, { moonlight_gu: 1 }, 2);
  assert.equal(capped.ok, true);
  assert.equal(capped.stones, 1);
  assert.deepEqual(plain(capped.care), { petals: 20, steps: 0, hungry: false });
});

test('hungry six Gu can buy beyond the normal stock cap to cover the 24-petal daily ration', () => {
  let care = { petals: 0, steps: 10, hungry: true };
  let stones = 3;
  for (const expected of [10, 20]) {
    const result = rules.buyCare(care, { moonlight_gu: 6 }, stones);
    assert.equal(result.ok, true);
    care = result.care;
    stones = result.stones;
    assert.equal(care.petals, expected);
    assert.equal(care.hungry, true);
  }
  const fed = rules.buyCare(care, { moonlight_gu: 6 }, stones);
  assert.equal(fed.ok, true);
  assert.equal(fed.stones, 0);
  assert.deepEqual(plain(fed.care), { petals: 6, steps: 10, hungry: false });
});

test('care purchase failure leaves stock, stones, and hunger untouched', () => {
  for (const [stones, care] of [[0, { petals: 7, steps: 5, hungry: true }], [2, { petals: 11, steps: 5, hungry: false }]]) {
    const result = rules.buyCare(care, { moonlight_gu: 2 }, stones);
    assert.equal(result.ok, false);
    assert.deepEqual(plain(result.care), care);
    assert.equal(result.stones, stones);
  }
});

test('NORMAL_RUN: five completed route nodes consume one ration and persist after reload', async () => {
  const lab = await openLab({ seed: 20261007 });
  try {
    await lab.click('[data-start-run]');
    for (let completed = 0; completed < 5; completed += 1) {
      const snap = await lab.snapshot();
      const available = new Set(snap.journey.availableNodeIds);
      const node = snap.journey.graph.nodes.find((candidate) => available.has(candidate.id) && candidate.type !== 'boss');
      assert.ok(node, `route offers a non-boss node before completion ${completed + 1}`);
      await lab.click(`[data-choose-node="${node.id}"]`);
      const entered = await lab.snapshot();
      if (entered.battle) {
        await lab.click('[data-retreat]');
      } else {
        if (node.type === 'hazard') await lab.click('[data-node-action="withdraw"]');
        else if (node.type === 'rest') await lab.click('[data-node-action="node.leave"]');
        else await lab.click('[data-node-action]:not([disabled])');
        const afterAction = await lab.snapshot();
        if (afterAction.page === 'prep') await lab.click('[data-prep-continue]');
      }
    }

    const fed = await lab.snapshot();
    assert.equal(fed.journey.completed.length, 5);
    assert.deepEqual(fed.guCare, { petals: 16, steps: 5, hungry: false });
    await lab.reload();
    const restored = await lab.snapshot();
    assert.deepEqual(restored.guCare, { petals: 16, steps: 5, hungry: false });
    assert.equal(restored.journey.completed.length, 5);
  } finally {
    await lab.close();
  }
});
