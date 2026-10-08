import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['run_rules.js', 'node_action_rules.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8'), context);
}
const rules = context.NodeActionRules;
const plain = (value) => JSON.parse(JSON.stringify(value));

const saveContext = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/lab_save.js', import.meta.url), 'utf8'), saveContext);
const LabSave = saveContext.LabSave;
const CONTENT = 'travel-soul-debt';

function sampleState(overrides = {}) {
  return {
    seed: 101,
    journey: {
      difficulty: 'normal',
      graph: { nodes: [], roots: [] },
      availableNodeIds: [], completed: [], started: true,
    },
    owned: {}, stones: 3, blood: 10, shopSold: [], equipped: [],
    journal: [], eventLog: [], page: 'map',
    travelSoulDebt: { cost: 2, eventId: 'echo_cave', title: '残响叩穴', nodeId: 'L2D0N0' },
    ...overrides,
  };
}

const debtEvent = {
  id: 'echo_cave', title: '残响叩穴', health_cost: 1, stone_gain: 2,
  delayed_soul_cost: 2, delayed_trigger: 'next_travel',
};

test('accepting a delayed-cost event applies immediate changes and records debt without spending soul', () => {
  const before = { health: 7, stones: 4, soul: 1 };
  const result = rules.resolveEvent('accept_event', debtEvent, before);
  assert.equal(result.ok, true);
  assert.equal(result.healthAfter, 6);
  assert.equal(result.stoneAfter, 6);
  assert.equal(before.soul, 1);
  assert.deepEqual(plain(result.soulDebt), { eventId: 'echo_cave', title: '残响叩穴', cost: 2 });

  const cards = plain(rules.eventCards(debtEvent, { health: 7, soul: 1 }));
  assert.equal(cards[0].available, true, 'acceptance remains possible so the player can prepare or heal before travel');
  assert.ok(cards[0].risk.some((line) => line.includes('继续赶路') && line.includes('2 点魂魄')));
  assert.ok(cards[0].risk.some((line) => line.includes('归零败北')));
});

test('leaving a delayed-cost event creates no debt', () => {
  const result = rules.resolveEvent('leave', debtEvent, { health: 7, stones: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.accepted, false);
  assert.equal(result.healthAfter, 7);
  assert.equal(result.stoneAfter, 4);
  assert.equal(result.soulDebt ?? null, null);
});

test('only next-travel delayed costs without curses are supported', () => {
  assert.equal(rules.resolveEvent('accept_event', { ...debtEvent, curse_id: 'essence_bloat' }, { health: 7 }).reason, 'unsupported_event');
  assert.equal(rules.resolveEvent('accept_event', { ...debtEvent, delayed_trigger: 'after_battle' }, { health: 7 }).reason, 'unsupported_event');
  assert.equal(rules.resolveEvent('accept_event', { ...debtEvent, delayed_soul_cost: 0, delayed_trigger: 'after_battle' }, { health: 7 }).ok, true);
});

test('settling soul debt clamps at zero, reports paid amount and fatality, and clears the debt', () => {
  const debt = { eventId: 'echo_cave', title: '残响叩穴', cost: 2 };
  assert.deepEqual(plain(rules.settleSoulDebt(debt, 5)), {
    soulBefore: 5, soulAfter: 3, cost: 2, paid: 2, fatal: false, debt: null,
  });
  assert.deepEqual(plain(rules.settleSoulDebt(debt, 1)), {
    soulBefore: 1, soulAfter: 0, cost: 2, paid: 1, fatal: true, debt: null,
  });
  assert.equal(context.RunRules.soulDefeated(0), true);
  assert.deepEqual(debt, { eventId: 'echo_cave', title: '残响叩穴', cost: 2 }, 'settlement does not mutate the saved debt');
});

test('pending debt round-trips through saves and older saves may omit it', () => {
  const state = sampleState();
  const restored = LabSave.decode(LabSave.encode(state, CONTENT), CONTENT);
  assert.equal(restored.ok, true);
  assert.deepEqual(plain(restored.state.travelSoulDebt), state.travelSoulDebt);

  const older = sampleState();
  delete older.travelSoulDebt;
  assert.equal(LabSave.decode(LabSave.encode(older, CONTENT), CONTENT).ok, true);
});

test('save decoding rejects malformed pending debt costs and identifiers', () => {
  for (const debt of [
    { cost: 0, eventId: 'echo_cave', title: '残响叩穴', nodeId: 'L2D0N0' },
    { cost: -1, eventId: 'echo_cave', title: '残响叩穴', nodeId: 'L2D0N0' },
    { cost: 1.5, eventId: 'echo_cave', title: '残响叩穴', nodeId: 'L2D0N0' },
    { cost: 1, eventId: '', title: '残响叩穴', nodeId: 'L2D0N0' },
    { cost: 1, eventId: 'echo_cave', title: '', nodeId: 'L2D0N0' },
    { cost: 1, eventId: 'echo_cave', title: '残响叩穴', nodeId: '' },
  ]) {
    assert.equal(LabSave.decode(LabSave.encode(sampleState({ travelSoulDebt: debt }), CONTENT), CONTENT).ok, false, JSON.stringify(debt));
  }
});
