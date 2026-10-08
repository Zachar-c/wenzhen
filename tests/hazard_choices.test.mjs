import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = (file) => fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

const rulesContext = vm.createContext({});
for (const file of ['run_rules.js', 'run_flow.js', 'node_action_rules.js']) {
  vm.runInContext(source(file), rulesContext);
}
const rules = rulesContext.NodeActionRules;
const flow = rulesContext.RunFlow;

function hazard(id, skipEffect, nextIds = ['next_a', 'next_b']) {
  return { id, type: 'hazard', skipEffect, nextIds, choices: ['scout', 'cross', 'withdraw'] };
}

function actualNodeActionFixture(node, { knownFacts = [], intel = [] } = {}) {
  const main = source('main.js');
  const start = main.indexOf('  resolveNodeAction(choiceId) {');
  const end = main.indexOf('\n  // 休整节点的一步', start);
  assert.ok(start >= 0 && end > start, 'resolveNodeAction source block must remain extractable');
  const method = main.slice(start, end).trim().replace(/,$/, '');
  const calls = { draw: 0, prep: 0, assert: 0, current: 0, toast: 0 };
  const context = vm.createContext({
    state: { stones: 4, qi: 3, qiMax: 8, knownFacts: [...knownFacts], journal: [], eventLog: [] },
    NODE_ACTION_TYPES: rules.nodeTypes,
    NodeActionRules: rules,
    currentNode: () => { calls.current += 1; return node; },
    assertRunMutable: () => { calls.assert += 1; return true; },
    scoutedRouteSoulFacts: () => [...intel],
    actionLabel: (id) => id,
    toast() { calls.toast += 1; },
    draw() { calls.draw += 1; },
    recordEvent(action, after, reason, targets) {
      context.state.eventLog.push({ action, after, reason, targets });
    },
    Sfx: { success() {} },
    nodeById: (id) => ({ id, name: id }),
    act: {
      openPrep() { calls.prep += 1; },
    },
  });
  vm.runInContext(`globalThis.resolveNodeAction = ({ ${method} }).resolveNodeAction;`, context);
  return { context, calls, method };
}

test('hazard action results match each declared effect and preserve a mandatory sole exit', () => {
  const route = hazard('route', 'lose_route');
  assert.deepEqual(plain(rules.hazardOutcome(route, 'cross')), {
    closes: [], reveal: false, loseNewIntel: false, pressure: false,
  });
  assert.deepEqual(plain(rules.hazardOutcome(route, 'withdraw')), {
    closes: ['next_a'], reveal: false, loseNewIntel: false, pressure: false,
  });
  const soleExit = hazard('route', 'lose_route', ['only_exit']);
  const fallout = rules.hazardOutcome(soleExit, 'leave');
  assert.deepEqual(plain(fallout.closes), []);
  const advanced = flow.journeyAdvanceResult({
    nodeId: 'route', node: { ...soleExit, blockedNextIds: fallout.closes },
    started: true, alreadyEnded: false, hasUnfinishedBattle: false,
  });
  assert.deepEqual(plain(advanced.nextIds), ['only_exit']);

  assert.equal(rules.hazardOutcome(hazard('cave', 'lose_clue'), 'cross').reveal, true);
  assert.equal(rules.hazardOutcome(hazard('cave', 'lose_clue'), 'withdraw').loseNewIntel, true);
  assert.equal(rules.hazardOutcome(hazard('marsh', 'gain_pursuit'), 'leave').pressure, true);
});

test('hazard nodes without a skip effect keep legacy behavior in cards and outcomes', () => {
  const oldHazard = { id: 'old', type: 'hazard', nextIds: ['exit'] };
  assert.equal(rules.hasHazardEffect(oldHazard), false);
  const cards = [{ id: 'cross', gain: ['old text'], risk: [] }];
  assert.deepEqual(plain(rules.hazardCards(oldHazard, cards)), plain(cards));
  assert.deepEqual(plain(rules.hazardOutcome(oldHazard, 'withdraw')), {
    closes: [], reveal: false, loseNewIntel: false, pressure: false,
  });
  const advanced = flow.journeyAdvanceResult({
    nodeId: 'old', node: oldHazard,
    started: true, alreadyEnded: false, hasUnfinishedBattle: false,
  });
  assert.deepEqual(plain(advanced.nextIds), ['exit']);
});

test('scouting an actual hazard stays on the action page and cannot be repeated', () => {
  const node = hazard('cave', 'lose_clue');
  const { context, calls, method } = actualNodeActionFixture(node, {
    knownFacts: ['route_battle_intel:already_known'],
    intel: ['route_battle_intel:already_known', 'route_battle_intel:newly_found'],
  });
  vm.runInContext("resolveNodeAction('scout')", context);
  assert.equal(context.state.eventLog.length, 1, `scout action did not resolve; calls=${JSON.stringify(calls)} method=${method.slice(0, 400)} state=${JSON.stringify(plain(context.state))}`);
  assert.equal(calls.prep, 0, 'scout must not open prep');
  assert.equal(calls.draw, 1, 'scout remains on and redraws the action page');
  assert.deepEqual(plain(context.state.knownFacts), [
    'route_battle_intel:already_known',
    'route_scouted',
    'hazard_scouted:cave',
    'route_battle_intel:newly_found',
  ]);
  assert.deepEqual(plain(node.scoutedFactsAdded), ['route_battle_intel:newly_found']);
  const eventCount = context.state.eventLog.length;
  vm.runInContext("resolveNodeAction('scout')", context);
  assert.equal(context.state.eventLog.length, eventCount, 'repeat scout must not add another action or intel event');
  assert.equal(calls.prep, 0);
  assert.equal(calls.draw, 1);
});

test('withdrawing from a clue hazard removes only intel newly learned at that hazard', () => {
  const node = hazard('cave', 'lose_clue');
  const { context, calls } = actualNodeActionFixture(node, {
    knownFacts: ['route_battle_intel:already_known'],
    intel: ['route_battle_intel:already_known', 'route_battle_intel:newly_found'],
  });
  vm.runInContext("resolveNodeAction('scout')", context);
  vm.runInContext("resolveNodeAction('withdraw')", context);
  assert.equal(calls.prep, 1);
  assert.ok(context.state.knownFacts.includes('route_battle_intel:already_known'));
  assert.ok(!context.state.knownFacts.includes('route_battle_intel:newly_found'));
  assert.ok(context.state.knownFacts.includes('hazard_scouted:cave'), 'the node-scoped marker remains to prevent a second scout');
});

test('travel pressure is paid once, synchronized as a bounded essence cost, and save data round-trips', () => {
  const pending = ['other_fact', 'hazard_pressure:marsh_a', 'hazard_pressure:marsh_b'];
  const settled = rules.settleTravelPressure(pending, 1);
  assert.deepEqual(plain(settled.sources), ['hazard_pressure:marsh_a', 'hazard_pressure:marsh_b']);
  assert.equal(settled.cost, 2);
  assert.equal(settled.paid, 1);
  assert.equal(settled.essence, 0);
  assert.deepEqual(plain(settled.knownFacts), ['other_fact']);
  const again = rules.settleTravelPressure(settled.knownFacts, settled.essence);
  assert.equal(again.cost, 0, 'cleared pressure must not be charged at a later encounter');
  assert.equal(again.essence, 0);

  const saveContext = vm.createContext({});
  vm.runInContext(source('lab_save.js'), saveContext);
  const state = {
    seed: 101,
    owned: {}, stones: 4, blood: 10, shopSold: [], equipped: [],
    journal: [], eventLog: [], page: 'node-action',
    journey: {
      difficulty: 'normal', graph: { roots: ['start'], nodes: [
        { id: 'start', type: 'hazard', skipEffect: 'lose_route', nextIds: ['a', 'b'],
          blockedNextIds: ['a'], scoutedFactsAdded: ['route_battle_intel:b'] },
      ] }, prepPerSegment: 10,
      availableNodeIds: ['b'], completed: [], started: true,
    },
    knownFacts: ['hazard_pressure:marsh_a', 'route_battle_intel:b'],
  };
  const content = 'hazard-choices';
  const restored = saveContext.LabSave.decode(saveContext.LabSave.encode(state, content), content);
  assert.equal(restored.ok, true);
  assert.deepEqual(plain(restored.state.journey.graph.nodes[0].blockedNextIds), ['a']);
  assert.deepEqual(plain(restored.state.journey.graph.nodes[0].scoutedFactsAdded), ['route_battle_intel:b']);
  assert.deepEqual(plain(restored.state.knownFacts), state.knownFacts);
});
