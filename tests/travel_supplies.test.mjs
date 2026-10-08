import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8'), context);
const rules = context.GuRules;
vm.runInContext(fs.readFileSync(new URL('../js/node_action_rules.js', import.meta.url), 'utf8'), context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('travel supplies quotes only packages that fit and charges their combined price', () => {
  const porkOnly = rules.travelSupplies({ petals: 20, steps: 0, hungry: false },
    { jade: 2, pork: 1, steps: 0, lastFed: {}, hungry: [] }, {}, 3, 0);
  assert.equal(porkOnly.ok, true);
  assert.equal(porkOnly.cost, 1);
  assert.deepEqual(plain(porkOnly.bought), ['整猪肉一份']);
  assert.equal(porkOnly.care.petals, 20);
  assert.equal(porkOnly.solidCare.pork, 2);
  assert.equal(porkOnly.stones, 2);

  const petalsOnly = rules.travelSupplies({ petals: 10, steps: 0, hungry: false },
    { jade: 2, pork: 2, steps: 0, lastFed: {}, hungry: [] }, {}, 1, 0);
  assert.equal(petalsOnly.ok, true);
  assert.equal(petalsOnly.cost, 1);
  assert.deepEqual(plain(petalsOnly.bought), ['月兰花瓣十片']);
  assert.equal(petalsOnly.care.petals, 20);
  assert.equal(petalsOnly.solidCare.pork, 2);

  const both = rules.travelSupplies({ petals: 10, steps: 0, hungry: false },
    { jade: 2, pork: 1, steps: 0, lastFed: {}, hungry: [] }, {}, 2, 0);
  assert.equal(both.ok, true);
  assert.equal(both.cost, 2);
  assert.deepEqual(plain(both.bought), ['月兰花瓣十片', '整猪肉一份']);
  assert.equal(both.stones, 0);
  assert.equal(both.care.petals, 20);
  assert.equal(both.solidCare.pork, 2);
});

test('travel supplies refuses the whole purchase when no package fits or the wallet is short', () => {
  const fullCare = { petals: 20, steps: 0, hungry: false };
  const fullSolid = { jade: 2, pork: 2, steps: 0, lastFed: {}, hungry: [] };
  const full = rules.travelSupplies(fullCare, fullSolid, {}, 3, 0);
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'supply_full');
  assert.equal(full.cost, 0);
  assert.deepEqual(plain(full.care), fullCare);
  assert.deepEqual(plain(full.solidCare), fullSolid);
  assert.equal(full.stones, 3);

  const petals = { petals: 10, steps: 0, hungry: false };
  const solid = { jade: 2, pork: 1, steps: 0, lastFed: {}, hungry: [] };
  const short = rules.travelSupplies(petals, solid, {}, 1, 0);
  assert.equal(short.ok, false);
  assert.equal(short.reason, 'insufficient_stone');
  assert.equal(short.cost, 2);
  assert.deepEqual(plain(short.bought), ['月兰花瓣十片', '整猪肉一份']);
  assert.deepEqual(plain(short.care), petals);
  assert.deepEqual(plain(short.solidCare), solid);
  assert.equal(short.stones, 1);
});

test('travel supplies can restore hungry petal and pork Gu through existing feeding rules', () => {
  const result = rules.travelSupplies({ petals: 3, steps: 5, hungry: true },
    { jade: 2, pork: 0, steps: 25, lastFed: { white_boar_strength_gu: 0 }, hungry: ['white_boar_strength_gu'] },
    { moonlight_gu: 1, white_boar_strength_gu: 1 }, 2, 25);
  assert.equal(result.ok, true);
  assert.equal(result.cost, 2);
  assert.deepEqual(plain(result.bought), ['月兰花瓣十片', '整猪肉一份']);
  assert.equal(result.care.petals, 9);
  assert.equal(result.care.hungry, false);
  assert.equal(result.solidCare.pork, 0);
  assert.deepEqual(plain(result.solidCare.hungry), []);
  assert.equal(result.stones, 0);
});

test('node choice shows the actual supply quotation, missing stone count and full-inventory refusal', () => {
  const care = { petals: 10, steps: 0, hungry: false };
  const solid = { jade: 2, pork: 1, steps: 0, lastFed: {}, hungry: [] };
  const quoted = rules.travelSupplies(care, solid, {}, 1, 0);
  const card = context.NodeActionRules.option('trade', { stones: 1, tradeSupply: quoted });
  assert.equal(card.available, false);
  assert.equal(card.stoneCost, 2);
  assert.match(card.blockReason, /还差 1枚/);
  assert.deepEqual(plain(card.gain), ['购入月兰花瓣十片。', '购入整猪肉一份。']);
  const full = rules.travelSupplies({ ...care, petals: 20 }, { ...solid, pork: 2 }, {}, 10, 0);
  const fullCard = context.NodeActionRules.option('trade', { stones: 10, tradeSupply: full });
  assert.equal(fullCard.available, false);
  assert.equal(fullCard.stoneCost, 0);
  assert.deepEqual(plain(fullCard.gain), []);
  assert.match(fullCard.blockReason, /都已备足/);
});

test('NORMAL_RUN: seed 3 buys the fitting pork ration at its opening market and keeps it through reload and the old record', async () => {
  const lab = await openLab({ seed: 3 });
  try {
    await lab.click('[data-start-run]');
    const initial = await lab.snapshot();
    assert.equal(initial.stones, 3);
    assert.equal(initial.guCare.petals, 20);
    assert.equal(initial.solidCare.pork, 1);
    const market = initial.journey.graph.nodes.find((node) => initial.journey.availableNodeIds.includes(node.id)
      && node.type === 'market' && node.choices?.includes('trade'));
    assert.ok(market, 'seed 3 starts with a market that offers trade');

    await lab.click(`[data-choose-node="${market.id}"]`);
    assert.match(await lab.text('#panel-node-action'), /旅途补给/);
    assert.equal(await lab.text('[data-node-action="trade"]'), '购入补给 · 1元石');
    await lab.click('[data-node-action="trade"]');
    let state = await lab.snapshot();
    assert.equal(state.page, 'prep');
    assert.equal(state.stones, initial.stones - 1);
    assert.equal(state.guCare.petals, 20);
    assert.equal(state.solidCare.pork, 2);
    assert.match(state.journal.join('\n'), /旅途补给.*整猪肉一份/);
    await lab.reload();
    state = await lab.snapshot();
    assert.equal(state.stones, initial.stones - 1);
    assert.equal(state.solidCare.pork, 2);
    assert.match(state.journal.join('\n'), /旅途补给.*整猪肉一份/);
    assert.equal(state.eventLog.some((event) => event.action === 'choose_action'
      && event.reason === 'action_trade_supplies'), true);

    // Complete the journey through existing route actions and voluntary retreat so the purchase reaches old-record storage.
    await lab.click('[data-prep-continue]');
    for (let depth = 0; depth < 40; depth += 1) {
      const current = await lab.snapshot();
      const node = current.journey.graph.nodes.find((candidate) => current.journey.availableNodeIds.includes(candidate.id)
        && candidate.type !== 'boss');
      if (!node) break;
      await lab.click(`[data-choose-node="${node.id}"]`);
      const entered = await lab.snapshot();
      if (entered.battle) {
        await lab.click('[data-retreat]');
      } else {
        if (node.type === 'rest') {
          await lab.click('[data-node-action="node.rest_heal"]');
          await lab.click('[data-node-action="node.leave"]');
        } else {
          await lab.click('[data-node-action="leave"]');
        }
        const afterAction = await lab.snapshot();
        if (afterAction.page === 'prep') await lab.click('[data-prep-continue]');
      }
    }
    state = await lab.snapshot();
    const boss = state.journey.graph.nodes.find((node) => state.journey.availableNodeIds.includes(node.id) && node.type === 'boss');
    assert.ok(boss, 'seed 3 reaches its final boss');
    await lab.click(`[data-choose-node="${boss.id}"]`);
    await lab.click('[data-retreat]');
    await lab.click('[data-ending-hall]');
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'), /补购口粮 1 次/);
    await lab.reload();
    await lab.click('[data-tab="hall"]');
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'), /补购口粮 1 次/);
    assert.equal(lab.logs().filter((line) => line.includes('[exception]')).length, 0);
  } finally {
    await lab.close();
  }
});
