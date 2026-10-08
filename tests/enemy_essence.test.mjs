import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../js/main.js');
const guRulesSource = read('../js/gu_rules.js');
const runRulesSource = read('../js/run_rules.js');

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `extract ${startMarker}`);
  return source.slice(start, end).trim();
}

function battleFixture(enemy) {
  const state = { blood: 30, bloodMax: 30, qi: 20, qiMax: 20, soul: 10, lifeTime: 50, cultivation: 3 };
  const battle = {
    enemies: [enemy], targetId: enemy.id, turn: 1, log: [], block: 0, swordIntent: 0,
    guUsedThisTurn: {}, guSealed: {}, actionsUsed: 0, turnSupports: {}, delayedEffects: [],
  };
  const context = vm.createContext({
    state,
    DATA: { battle: { markScratchPerLayer: 0, markScratchCap: 0 } },
    GU_BY_ID: {},
    aliveEnemies: b => b.enemies.filter(item => item.hp > 0),
    enemyNeedsApproach: () => false,
    currentCombatRoster: () => [],
    receivePlayerHit: (_b, damage) => ({ damage, absorbed: 0 }),
    fireDelayedEffects: () => false,
    act: { _pickIntent() {} },
    Sfx: { hurt() {}, lose() {}, win() {} },
    BattleFx: { selfDamage() {}, shieldHit() {}, essenceBurn() {} },
  });
  vm.runInContext(runRulesSource, context);
  vm.runInContext(guRulesSource, context);
  vm.runInContext(`globalThis.__enemyTurn = ${extract(main, 'function enemyTurn(b) {', '\nfunction buildDeathReport')}`, context);
  return { context, state, battle };
}

test('enemyTurn charges a Gu intent once, then regenerates once', () => {
  for (const [rank, initial, cost] of [[3, 6, 2], [4, 8, 3]]) {
    const enemy = { id: `cultivator_${rank}`, name: '蛊师', grade: 'cultivator', rank,
      essence: initial, attackSource: 'gu', enemyIntent: { id: 'strike', label: '蛊招', damage: 1, true_qi_cost: cost },
      hp: 10, statuses: {}, flags: {}, lastFired: {} };
    const { context, battle } = battleFixture(enemy);
    const before = context.GuRules.enemyEssenceState(enemy);
    context.__enemyTurn(battle);
    assert.equal(enemy.essence, Math.min(before.limit, before.current - cost + before.regen),
      `rank ${rank}: cost and recovery each happen once`);
  }
});

test('insufficient essence skips every intent effect but still regenerates once', () => {
  const enemy = { id: 'low_essence', name: '蛊师', grade: 'cultivator', rank: 3, essence: 1,
    attackSource: 'gu', enemyIntent: { id: 'seal_and_drain', label: '封魂招', kind: 'seal', seal_turns: 2,
      true_qi_cost: 2, damage: 4, soul_drain: 3, life_cost: 4, essence_burn: 5 },
    hp: 10, statuses: {}, flags: {}, lastFired: {} };
  const { context, state, battle } = battleFixture(enemy);
  const before = context.GuRules.enemyEssenceState(enemy);
  context.__enemyTurn(battle);
  assert.equal(enemy.essence, Math.min(before.limit, before.current + before.regen),
    'rank-three regeneration occurs after the failed cast');
  assert.equal(state.blood, 30);
  assert.equal(state.soul, 10);
  assert.equal(state.lifeTime, 50);
  assert.equal(state.qi, 20);
  assert.deepEqual(battle.guSealed, {});
  assert.equal(enemy.lastFired.seal_and_drain, undefined);
});

test('damage reports retain pre-hit blood and actual damage after blocking', () => {
  for (const [blood, block, taken] of [[10, 4, 0], [10, 2, 2], [2, 0, 4]]) {
    const enemy = { id: 'beast', name: '兽', rank: 1, attackSource: 'innate',
      enemyIntent: { id: 'claw', label: '爪击', damage: 4 }, hp: 10, statuses: {}, flags: {}, lastFired: {} };
    const { context, state, battle } = battleFixture(enemy);
    state.blood = blood;
    battle.block = block;
    context.__enemyTurn(battle);
    assert.equal(battle.lastBlow.damage, taken);
    assert.equal(battle.lastBlow.bloodBefore, blood);
    assert.equal(state.blood, Math.max(0, blood - taken));
  }
});

test('innate intents do not spend essence; suppression caps rank-three and rank-four recovery', () => {
  const innate = { id: 'innate', name: '兽', grade: 'cultivator', rank: 3, essence: 6,
    attackSource: 'innate', enemyIntent: { id: 'claw', label: '爪击', damage: 1, true_qi_cost: 4 },
    hp: 10, statuses: {}, flags: {}, lastFired: {} };
  const f = battleFixture(innate);
  const beforeInnate = f.context.GuRules.enemyEssenceState(innate);
  f.context.__enemyTurn(f.battle);
  assert.equal(innate.essence, Math.min(beforeInnate.limit, beforeInnate.current + beforeInnate.regen),
    'innate attack ignores any Gu cost field and regenerates normally');

  for (const [rank, pct, limit, regen] of [[3, 60, 0, 0], [4, 30, 6, 1]]) {
    const enemy = { id: `suppressed_${rank}`, name: '蛊师', grade: 'cultivator', rank,
      essence: 99, essenceSuppressionPct: pct, attackSource: 'gu',
      enemyIntent: { id: 'unaffordable', label: '昂贵蛊招', damage: 1, true_qi_cost: 99 },
      hp: 10, statuses: {}, flags: {}, lastFired: {} };
    const g = battleFixture(enemy);
    const capped = g.context.GuRules.enemyEssenceState(enemy);
    assert.equal(capped.limit, limit);
    assert.equal(capped.regen, regen);
    g.context.__enemyTurn(g.battle);
    assert.equal(enemy.essence, limit, `rank ${rank}: recovery cannot exceed suppression cap`);
  }
});

function migrationFixture(enemy) {
  const oldState = {
    battle: { enemies: [enemy] },
    journey: { completed: ['old-node'], nodeId: 'current-node' },
    cultivation: 4, cultivationStage: 0, aptitude: 'bing', qiMax: 12,
    qi: 7, blood: 11, stones: 23, owned: { moon_shadow_gu: 1 },
    guCare: { petals: 6 }, solidCare: { meat: 2 }, equipped: [], journal: [],
  };
  const writes = [];
  const context = vm.createContext({
    DATA: { contentVersion: 'current', compatibleContentVersions: [], enemies: [{
      id: 'legacy_foe', grade: 'cultivator', aptitude: 'ding', intent: { id: 'base', true_qi_cost: 2 },
      phases: [{ intents: [{ id: 'phase', true_qi_cost: 4 }] }],
    }] },
    LabSave: {
      read: () => ({ ok: true, state: oldState }),
      write: (_storage, state, version) => { writes.push({ state, version }); return { ok: true }; },
    },
    GuRules: null,
    RunRules: null,
    HumanRules: {},
    currentKillMoves: () => [],
    fresh: () => { throw new Error('valid legacy save should not be replaced'); },
  });
  vm.runInContext(runRulesSource, context);
  vm.runInContext(guRulesSource, context);
  vm.runInContext(`let state; let bootSaveIssue = null; let saveWriteBlockedUntilNewRun = false;
    function saveStorage() { return null; }
    function contentVersion() { return DATA.contentVersion; }
    function compatibleSaveVersions() { return DATA.compatibleContentVersions; }
    ${extract(main, 'function recomputeQiMax() {', '\n// 自定义只存组件')}
    ${extract(main, 'function bootFromSave() {', '\nlet state;')}
    globalThis.__bootFromSave = bootFromSave;
    globalThis.__getState = () => state;`, context);
  return { context, oldState, writes };
}

test('boot migration initializes missing essence and intent costs without changing run progress', () => {
  const enemy = { id: 'legacy_foe', rank: 4, hp: 6, hpMax: 9,
    intent: { id: 'base' }, enemyIntent: { id: 'phase' }, phases: [{ intents: [{ id: 'phase' }] }] };
  const { context, oldState } = migrationFixture(enemy);
  context.__bootFromSave();
  assert.equal(enemy.grade, 'cultivator');
  assert.equal(enemy.aptitude, 'ding');
  assert.equal(enemy.essence, 17, 'rank-four default essence uses the restored aptitude');
  assert.equal(enemy.intent.true_qi_cost, 2);
  assert.equal(enemy.enemyIntent.true_qi_cost, 4);
  assert.equal(enemy.phases[0].intents[0].true_qi_cost, 4);
  assert.equal(oldState.qi, 7);
  assert.equal(oldState.blood, 11);
  assert.deepEqual(oldState.journey.completed, ['old-node']);
  assert.equal(oldState.journey.nodeId, 'current-node');
});

test('boot migration preserves stored suppressed essence and does not refill it', () => {
  const enemy = { id: 'legacy_foe', rank: 4, grade: 'cultivator', aptitude: 'jia', essence: 2,
    essenceSuppressionPct: 30, hp: 6, hpMax: 9, intent: { id: 'base', true_qi_cost: 2 } };
  const { context } = migrationFixture(enemy);
  context.__bootFromSave();
  assert.equal(enemy.essence, 2);
});
