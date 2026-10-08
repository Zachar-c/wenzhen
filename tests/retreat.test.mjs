/** Retreat action contract: isolated action fixtures plus one real UI flow. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const MAIN = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const GU_RULES = readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

function methodSource(name, nextName) {
  const start = MAIN.indexOf(`  ${name}(`);
  const end = MAIN.indexOf(`  ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `main.js must define act.${name} before act.${nextName}`);
  return MAIN.slice(start, end).trim().replace(/,$/, '');
}

function loadHungryGuFixture() {
  const state = {
    guCare: { petals: 0, steps: 0, hungry: true }, journey: { completed: [], nodeId: 'battle-node' },
    owned: { moonlight_gu: 1 }, cultivation: 1, qi: 7, thought: 4, blood: 10,
    battle: { over: null, actionsUsed: 0, actionLimit: 2, guUsedThisTurn: {}, guSealed: {} },
    lowRankGu: {}, leafRecoveryNodeId: null,
  };
  const messages = [];
  const ctx = vm.createContext({
    state, act: {}, DATA: { gu: [{ id: 'moonlight_gu', rank: 1, name: '月光蛊' }] }, GU_BY_ID: {},
    GuRules: null,
    currentGuCare: () => ctx.GuRules.careState(state.guCare, state.journey.completed.length),
    currentSolidCare: () => ctx.GuRules.solidCareState(state.solidCare, state.owned, state.journey.completed.length),
    fedGuOwned: () => ctx.currentGuCare().hungry ? { ...state.owned, moonlight_gu: 0 } : state.owned,
    currentCombatRoster: () => ctx.fedGuOwned().moonlight_gu > 0
      ? [{ id: 'moonlight_gu', instanceId: 'moonlight_gu::1', rank: 1, trueQiCost: 1, thoughtCost: 1 }]
      : [],
    assertRunMutable: () => true,
    targetOf: () => ({ id: 'target', statuses: {} }),
    aliveEnemies: () => [{ id: 'target' }],
    toast: (message) => messages.push(message),
    openBattleOutcome() {},
  });
  vm.runInContext(GU_RULES, ctx);
  const useGu = methodSource('useGu', 'buyOffer');
  vm.runInContext(`act = { ${useGu} };`, ctx);
  return { state, messages, act: ctx.act };
}

function loadRetreatFixture({ type = 'battle', nextIds = ['next'], over = null, noBattle = false, ending = null, completed = [] } = {}) {
  const node = { id: 'here', name: '当前节点', type, nextIds: [...nextIds] };
  const battle = noBattle ? null : {
    nodeId: 'here', over, turn: 3, enemies: [{ id: 'foe', hp: 4 }], log: ['记录'],
    consumables: { leaf: 2 },
  };
  const state = {
    journey: { started: true, nodeId: 'here', graph: { nodes: [node] }, availableNodeIds: [], completed: [...completed] },
    battle, reward: null, ending, page: 'battle', prepFor: null,
    qi: 2, blood: 7, stones: 11, soul: 5, lifeTime: 18,
    owned: { moonlight_gu: 1 }, guCare: { petals: 20, steps: completed.length, hungry: false },
    consumables: { leaf: 2 }, journal: [], eventLog: [],
  };
  const events = [];
  const savedEndings = [];
  let outcomeCalls = 0;
  const ctx = vm.createContext({
    state,
    act: {},
    RunFlow: {
      journeyAdvanceResult({ nodeId, node: current, started, alreadyEnded, hasUnfinishedBattle }) {
        if (alreadyEnded || !started || !nodeId || !current || hasUnfinishedBattle) return { ok: false, kind: 'blocked' };
        return current.nextIds.length
          ? { ok: true, kind: 'continue', nextIds: current.nextIds }
          : { ok: true, kind: 'victory_ending', title: '五段行程已走完' };
      },
      graphContentError: () => 'missing_node',
    },
    currentNode: () => state.journey.graph.nodes.find((item) => item.id === state.journey.nodeId) || null,
    currentGuCare: () => ctx.GuRules.careState(state.guCare, state.journey.completed.length),
    currentSolidCare: () => ctx.GuRules.solidCareState(state.solidCare, state.owned, state.journey.completed.length),
    assertRunMutable: () => !state.ending,
    recordEvent: (...args) => events.push(args),
    saveEndingArchive: (value) => savedEndings.push(value),
    showPage: (page) => { state.page = page; },
    draw() {}, toast() {},
    Sfx: { click() {}, lose() {}, win() {} },
    openBattleOutcome: () => { outcomeCalls += 1; },
  });
  vm.runInContext(GU_RULES, ctx);
  const retreat = methodSource('retreatBattle', 'endBattle');
  const complete = methodSource('completeCurrentNode', 'advanceJourney');
  const end = methodSource('endJourney', 'restartRun');
  vm.runInContext(`act = { ${retreat}, ${complete}, ${end} };`, ctx);
  return { state, events, savedEndings, get outcomeCalls() { return outcomeCalls; }, act: ctx.act };
}

test('ACTION_FIXTURE: ordinary retreat keeps paid resources and advances the current node once', () => {
  const fixture = loadRetreatFixture();
  const { state, events, act } = fixture;
  const before = Object.fromEntries(['qi', 'blood', 'stones', 'soul', 'lifeTime'].map((key) => [key, state[key]]));
  const beforeConsumables = structuredClone(state.consumables);

  act.retreatBattle();

  for (const [key, value] of Object.entries(before)) assert.equal(state[key], value, `${key} is retained`);
  assert.deepEqual(state.consumables, beforeConsumables);
  assert.equal(state.battle, null);
  assert.equal(state.reward, null);
  assert.deepEqual(Array.from(state.journey.availableNodeIds), ['next']);
  assert.deepEqual(Array.from(state.journey.completed), ['here']);
  assert.ok(events.some(([kind]) => kind === 'battle_retreat'), 'retreat is recorded as its own event');
  assert.ok(state.journal.some((line) => line.includes('撤退')));
  assert.notEqual(state.ending?.outcome, 'victory');

  const afterFirst = structuredClone(state);
  act.retreatBattle();
  assert.equal(JSON.stringify(state), JSON.stringify(afterFirst), 'repeat retreat after clearing the battle is inert');
});

test('ACTION_FIXTURE: retreat completing the fifth node advances one day of Moonlight Gu care', () => {
  const fixture = loadRetreatFixture({ completed: ['a', 'b', 'c', 'd'] });
  fixture.act.retreatBattle();
  assert.equal(fixture.state.journey.completed.length, 5);
  assert.deepEqual(plain(fixture.state.guCare), { petals: 16, steps: 5, hungry: false });
  assert.ok(fixture.events.some(([kind, , status]) => kind === 'gu_care' && status === 'gu_fed'));
});

test('ACTION_FIXTURE: hungry Moonlight Gu is absent from the normal combat roster and cannot be activated', () => {
  const fixture = loadHungryGuFixture();
  const before = { qi: fixture.state.qi, thought: fixture.state.thought, actionsUsed: fixture.state.battle.actionsUsed };
  fixture.act.useGu('moonlight_gu::1');
  assert.equal(fixture.messages.at(-1), '未找到该蛊');
  assert.deepEqual({ qi: fixture.state.qi, thought: fixture.state.thought, actionsUsed: fixture.state.battle.actionsUsed }, before);
  assert.equal(fixture.state.guCare.hungry, true);
});

test('ACTION_FIXTURE: boss retreat ends as retreat, including a terminal node without successors', () => {
  for (const options of [
    { type: 'boss', nextIds: ['unexpected-next'] },
    { type: 'battle', nextIds: [] },
  ]) {
    const fixture = loadRetreatFixture(options);
    fixture.act.retreatBattle();
    assert.equal(fixture.state.ending?.outcome, 'retreat');
    assert.equal(fixture.state.ending?.title, '主动止步');
    assert.equal(fixture.state.battle, null);
    assert.equal(fixture.state.reward, null);
    assert.ok(fixture.savedEndings.length > 0);
    assert.notEqual(fixture.state.ending?.outcome, 'victory');
    assert.notEqual(fixture.state.ending?.outcome, 'defeat');
  }
});

test('ACTION_FIXTURE: already settled battles use ordinary outcome settlement', () => {
  for (const over of ['胜', '败']) {
    const fixture = loadRetreatFixture({ over });
    fixture.act.retreatBattle();
    assert.equal(fixture.outcomeCalls, 1, `${over} goes through normal battle settlement`);
    assert.equal(fixture.state.battle.over, over);
    assert.equal(fixture.state.journey.availableNodeIds.length, 0);
  }
});

test('ACTION_FIXTURE: depleted blood, soul, or lifespan settles as defeat instead of escaping', () => {
  for (const [resource, cause] of [['blood', 'blood'], ['soul', 'soul'], ['lifeTime', 'life_cost']]) {
    const fixture = loadRetreatFixture();
    fixture.state[resource] = 0;
    fixture.act.retreatBattle();
    assert.equal(fixture.state.battle.over, '败');
    assert.equal(fixture.state.battle.deathCause, cause);
    assert.equal(fixture.outcomeCalls, 1);
    assert.deepEqual(Array.from(fixture.state.journey.availableNodeIds), []);
    assert.ok(!fixture.events.some(([kind]) => kind === 'battle_retreat'));
  }
});

test('ACTION_FIXTURE: missing, mismatched, unstarted, dead-run and repeated retreat are inert', () => {
  const missing = loadRetreatFixture({ noBattle: true });
  missing.act.retreatBattle();
  assert.equal(missing.state.journey.nodeId, 'here');
  assert.deepEqual(Array.from(missing.state.journey.availableNodeIds), []);

  const mismatch = loadRetreatFixture();
  mismatch.state.battle.nodeId = 'elsewhere';
  const mismatchBefore = structuredClone(mismatch.state);
  mismatch.act.retreatBattle();
  assert.deepEqual(mismatch.state, mismatchBefore);

  const dead = loadRetreatFixture({ ending: { outcome: 'defeat' } });
  const deadBefore = structuredClone(dead.state);
  dead.act.retreatBattle();
  assert.deepEqual(dead.state, deadBefore);

  const unstarted = loadRetreatFixture();
  unstarted.state.journey.started = false;
  const unstartedBefore = structuredClone(unstarted.state);
  unstarted.act.retreatBattle();
  assert.deepEqual(unstarted.state, unstartedBefore);
});

test('NORMAL_RUN: visible retreat button advances a real battle to its existing successors and survives reload', async () => {
  const lab = await openLab({ seed: 20261007 });
  try {
    await lab.click('[data-start-run]');
    const map = await lab.snapshot();
    const node = map.journey.graph.nodes.find((item) =>
      map.journey.availableNodeIds.includes(item.id) && item.type === 'battle' && item.nextIds?.length);
    assert.ok(node, 'fresh run offers a battle node with successors');
    await lab.click(`[data-choose-node="${node.id}"]`);
    const before = await lab.snapshot();
    assert.equal(before.battle?.nodeId, node.id);
    assert.ok(before.battle && !before.battle.over, 'battle is live before the retreat button is used');
    await lab.click('[data-use-gu="small_light_gu::1"]');
    const paidQi = await lab.snapshot();
    assert.equal(paidQi.qi, before.qi - 1, 'a real Gu action pays true qi before retreat');
    assert.ok(paidQi.battle && !paidQi.battle.over, 'paid Gu action leaves the encounter active');
    await lab.click('[data-observe]');
    const observed = await lab.snapshot();
    assert.ok(observed.battle && !observed.battle.over, 'observe leaves this encounter unsettled');
    assert.equal(observed.battle.enemies.find((enemy) => enemy.id === observed.battle.targetId).revealed, true);
    assert.ok(observed.battle.log.some((line) => line.includes('已看破')), 'observe cost is recorded before retreat');
    const paidState = Object.fromEntries(['qi', 'blood', 'stones', 'soul', 'lifeTime'].map((key) => [key, observed[key]]));
    const screenshot = path.join(process.env.TEMP || '.', 'wenzhen-retreat-button.png');
    await lab.shoot(screenshot);
    assert.match(await lab.text('[data-retreat-cost]'), /没有战利/);

    await lab.click('[data-retreat]');
    const after = await lab.snapshot();
    assert.equal(after.battle, null);
    assert.equal(after.reward, null);
    assert.equal(after.ending, null);
    assert.deepEqual(Array.from(after.journey.availableNodeIds), Array.from(node.nextIds));
    for (const [key, value] of Object.entries(paidState)) assert.equal(after[key], value, `${key} receives no refund or victory refill`);
    assert.ok(after.eventLog.some((event) => event.action === 'battle_retreat'));

    await lab.reload();
    const restored = await lab.snapshot();
    assert.equal(restored.battle, null);
    assert.deepEqual(Array.from(restored.journey.availableNodeIds), Array.from(node.nextIds));
    assert.equal(restored.page, 'map', 'reload resumes at the route after a completed retreat');
  } finally {
    await lab.close();
  }
});

test('NORMAL_RUN: repeated route retreats stop at the first boss and archive an active retreat', async () => {
  const lab = await openLab({ seed: 20261008 });
  try {
    await lab.click('[data-start-run]');
    let snap = await lab.snapshot();
    let routeRetreats = 0;
    let boss = null;

    for (let step = 0; step < 12; step += 1) {
      const available = new Set(snap.journey.availableNodeIds);
      boss = snap.journey.graph.nodes.find((item) =>
        available.has(item.id) && item.segment === 1 && item.type === 'boss');
      if (boss) break;

      const node = snap.journey.graph.nodes.find((item) =>
        available.has(item.id) && item.segment === 1 && ['battle', 'elite'].includes(item.type));
      assert.ok(node, `first segment offers a reachable battle or elite before its boss at step ${step + 1}`);
      await lab.click(`[data-choose-node="${node.id}"]`);
      snap = await lab.snapshot();
      assert.equal(snap.battle?.nodeId, node.id);
      assert.ok(!snap.battle.over);
      await lab.click('[data-retreat]');
      snap = await lab.snapshot();
      assert.equal(snap.ending, null, 'ordinary retreat continues the journey');
      assert.equal(snap.battle, null);
      routeRetreats += 1;
    }

    assert.ok(boss, 'the first layer boss becomes reachable after the ten route depths');
    assert.equal(routeRetreats, 10, 'normal difficulty has ten route nodes before the layer boss');
    await lab.click(`[data-choose-node="${boss.id}"]`);
    snap = await lab.snapshot();
    assert.equal(snap.battle?.nodeId, boss.id);
    assert.match(await lab.text('[data-retreat]'), /撤退并止步本局/);
    await lab.click('[data-retreat]');

    const ended = await lab.snapshot();
    assert.equal(ended.ending?.outcome, 'retreat');
    assert.equal(ended.ending?.title, '主动止步');
    assert.ok(Number.isFinite(ended.ending?.turn), 'ending retains the boss battle turn');
    assert.equal(ended.reward, null);
    assert.notEqual(ended.ending?.outcome, 'victory');

    await lab.reload();
    const restored = await lab.snapshot();
    assert.equal(restored.ending?.outcome, 'retreat');
    assert.equal(restored.reward, null);
    await lab.click('[data-tab="hall"]');
    assert.match(await lab.text('#run-context'), /主动止步/);
    assert.doesNotMatch(await lab.text('#run-context'), /败局/);
    assert.match(await lab.text('[data-hall-ending]'), /主动止步/);
    assert.doesNotMatch(await lab.text('[data-hall-ending]'), /败局/);
    assert.match(await lab.text('.archive-list'), /主动止步/);
    assert.doesNotMatch(await lab.text('.archive-list'), /败局/);
  } finally {
    await lab.close();
  }
});
