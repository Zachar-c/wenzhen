import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../js/main.js');

function rules() {
  const ctx = vm.createContext({});
  vm.runInContext(read('../js/gu_rules.js'), ctx);
  return ctx.GuRules;
}

function battleFixture({ enemies, targetId = enemies[0]?.id, turn = 2, delayedEffects = [] }) {
  const b = { enemies, targetId, turn, delayedEffects, turnSupports: {}, swordIntent: 0,
    log: [], block: 0, over: null };
  const state = { blood: 20, bloodMax: 20 };
  const ctx = vm.createContext({
    state, GuRules: rules(),
    RunRules: { delayDueTurn: (current, delay) => current + delay },
    targetOf: battle => battle.enemies.find(enemy => enemy.id === battle.targetId && enemy.hp > 0),
    aliveEnemies: battle => battle.enemies.filter(enemy => enemy.hp > 0),
    BattleFx: { damage() {}, win() {} }, Sfx: { win() {} },
    openBattleOutcome() {},
    applyEffectPlan(battle, target, plan, label) {
      target.hp -= Number(plan.damage || 0);
      battle.log.push(`${target.name} ${label} 伤 ${Number(plan.damage || 0)}`);
    },
  });
  const start = main.indexOf('function scheduleEffect(');
  const end = main.indexOf('\nfunction finishPlayerAction(', start);
  assert.ok(start >= 0 && end > start, 'delay functions exist');
  vm.runInContext(`${main.slice(start, end)}; globalThis.__schedule=scheduleEffect; globalThis.__fire=fireDelayedEffects;`, ctx);
  return { b, state, ctx, schedule: ctx.__schedule, fire: ctx.__fire };
}

const strike = (amount, turns = 1) => ({ kind: 'strike', amount, delay: { turns } });

test('delayed strike stays on the selected second enemy when the first remains alive', () => {
  const first = { id: 'first', name: '甲', hp: 20, statuses: {} };
  const selected = { id: 'selected', name: '乙', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [first, selected], targetId: selected.id });
  f.schedule(f.b, strike(4), 'fire', '火攻');
  f.b.targetId = first.id;
  f.b.turn = 3;
  f.fire(f.b);
  assert.equal(first.hp, 20);
  assert.equal(selected.hp, 16);
  assert.equal(f.b.delayedEffects.length, 0);
});

test('dead target fizzles without consuming a future queue', () => {
  const dead = { id: 'dead', name: '倒下的甲', hp: 0, statuses: {} };
  const alive = { id: 'alive', name: '乙', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [dead, alive], targetId: alive.id, turn: 3,
    delayedEffects: [{ dueTurn: 4, targetId: 'alive', targetName: '乙', label: '未来招',
      effect: { kind: 'strike', amount: 2 }, plan: { damage: 2, statuses: [], delayTurns: 0 } }] });
  f.b.delayedEffects.unshift({ dueTurn: 3, targetId: 'dead', targetName: '倒下的甲', label: '已到期',
    effect: { kind: 'strike', amount: 5 }, plan: { damage: 5, statuses: [], delayTurns: 0 } });
  f.fire(f.b);
  assert.equal(alive.hp, 20, 'an expired strike must not be redirected');
  assert.equal(f.b.delayedEffects.length, 1);
  assert.equal(f.b.delayedEffects[0].label, '未来招');
  assert.match(f.b.log.join(' '), /倒下的甲已倒下，本击落空/);
});

test('multiple delayed strikes retain independent targets and fire in queue order', () => {
  const a = { id: 'a', name: '甲', hp: 20, statuses: {} };
  const b = { id: 'b', name: '乙', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [a, b], targetId: 'a' });
  f.schedule(f.b, strike(3), 'fire', '先招');
  f.b.targetId = 'b';
  f.schedule(f.b, strike(5), 'fire', '后招');
  f.b.turn = 3;
  f.fire(f.b);
  assert.equal(a.hp, 17);
  assert.equal(b.hp, 15);
  assert.equal(f.b.delayedEffects.length, 0);
});

test('queued plan snapshots same-turn support even after support state is cleared', () => {
  const target = { id: 'a', name: '甲', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [target], targetId: 'a', turn: 1 });
  f.b.turnSupports.fire = 4;
  f.schedule(f.b, strike(3), 'fire', '火攻');
  assert.equal(f.b.delayedEffects[0].plan.damage, 7);
  f.b.turnSupports = {};
  f.b.turn = 2;
  f.fire(f.b);
  assert.equal(target.hp, 13);
});

test('delayed queue target and plan survive JSON save roundtrip', () => {
  const target = { id: 'a', name: '甲', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [target], targetId: 'a', turn: 1 });
  f.schedule(f.b, strike(3), 'fire', '火攻');
  const restored = JSON.parse(JSON.stringify({ battle: f.b })).battle;
  assert.equal(restored.delayedEffects[0].targetId, 'a');
  assert.equal(restored.delayedEffects[0].targetName, '甲');
  assert.equal(restored.delayedEffects[0].plan.damage, 3);
});

test('legacy queue without target and plan keeps first-live-target fallback', () => {
  const first = { id: 'first', name: '甲', hp: 20, statuses: {} };
  const selected = { id: 'selected', name: '乙', hp: 20, statuses: {} };
  const f = battleFixture({ enemies: [first, selected], targetId: selected.id, turn: 3,
    delayedEffects: [{ dueTurn: 3, label: '旧招', school: 'fire', effect: { kind: 'strike', amount: 2 } }] });
  f.fire(f.b);
  assert.equal(first.hp, 18);
  assert.equal(selected.hp, 20);
});

test('terminal resolution clears all remaining delayed queues', () => {
  const target = { id: 'a', name: '甲', hp: 2, statuses: {} };
  const f = battleFixture({ enemies: [target], targetId: 'a', turn: 3 });
  f.schedule(f.b, strike(3), 'fire', '终结招');
  f.schedule(f.b, strike(1, 3), 'fire', '未到期招');
  f.b.turn = 4;
  assert.equal(f.fire(f.b), true);
  assert.equal(f.b.over, '胜');
  assert.equal(f.b.delayedEffects.length, 0);
});

test('useMove queues the delayed component plan instead of a prebuilt move effect', () => {
  const guById = { fire_atk_2_01_gu: { id: 'fire_atk_2_01_gu', rank: 2,
    v1_effect: strike(3), school: 'fire' } };
  const target = { id: 'target', name: '目标', hp: 20, statuses: {}, distanceMeters: 0 };
  const move = { id: 'fixture_move', label: '组件杀招', playable: true, recipe: ['fire_atk_2_01_gu'],
    true_qi_cost: 1, thought_cost: 1, tag: 'fire', effect: { kind: 'strike', amount: 99 } };
  const guRules = { ...rules() };
  const state = { battle: { enemies: [target], targetId: target.id, turn: 1, actionsUsed: 0,
    actionLimit: 2, turnSupports: {}, swordIntent: 0, delayedEffects: [], log: [],
    killMoveUsedThisTurn: {}, guUsedThisTurn: {}, guSealed: {} },
    equipped: [move.id], owned: { fire_atk_2_01_gu: 1 }, qi: 5, thought: 3,
    blood: 20, bloodMax: 20, lifeTime: 80, soul: 10, cultivation: 2 };
  const ctx = vm.createContext({ state, DATA: { killMovesEnabled: true }, GU_BY_ID: guById, GuRules: guRules,
    RunRules: { delayDueTurn: (turn, delay) => turn + delay, lifeDefeated: () => false },
    assertRunMutable: () => true, targetOf: b => b.enemies.find(e => e.id === b.targetId && e.hp > 0),
    aliveEnemies: b => b.enemies.filter(e => e.hp > 0), currentKillMoves: () => [move],
    fedGuOwned: () => state.owned, currentGuCare: () => ({ hungry: false }),
    moveTargetOutOfRange: () => false, guReasonLabel: String, toast() {},
    recordEvent() {}, finishPlayerAction() {}, liveReactions: () => [], openBattleOutcome() {},
    Sfx: { win() {}, fail() {} }, BattleFx: { damage() {} },
  });
  const start = main.indexOf('  useMove(id) {');
  const end = main.indexOf('\n  },', start);
  assert.ok(start >= 0 && end > start, 'useMove exists');
  const scheduleStart = main.indexOf('function scheduleEffect(');
  const scheduleEnd = main.indexOf('\nfunction finishPlayerAction(', scheduleStart);
  vm.runInContext(`${main.slice(scheduleStart, scheduleEnd)}\n globalThis.act={${main.slice(start, end + 5)}};`, ctx);
  ctx.GuRules.killMoveRecipeInstances = () => ['fire_atk_2_01_gu::1'];
  ctx.GuRules.killMoveGateMissReason = () => '';
  ctx.GuRules.killMoveIsDirectStrike = () => false;
  ctx.GuRules.killMoveEffectPlan = () => ({ damage: 6, delayTurns: 1, statuses: [] });
  ctx.act.useMove(move.id);
  assert.equal(state.battle.delayedEffects.length, 1);
  assert.equal(state.battle.delayedEffects[0].plan.damage, 6);
  assert.equal(state.battle.delayedEffects[0].effect.amount, undefined,
    'queue carries a plan from components, not the prebuilt 99-damage move effect');
});
