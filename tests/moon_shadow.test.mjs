import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('../js/run_rules.js'), context);
vm.runInContext(read('../js/gu_rules.js'), context);
const rules = context.GuRules;
const plain = value => JSON.parse(JSON.stringify(value));
const effect = { kind: 'essence_suppression', percent_by_rank: { 3: 60, 4: 30, 5: 15 } };

test('enemy essence cap and regeneration follow suppression at ranks 3 to 5', () => {
  const cases = [
    { rank: 3, max: 10, percent: 60, reservePct: 45, limit: 0, regen: 0 },
    { rank: 4, max: 12, percent: 30, reservePct: 45, limit: 4, regen: 1 },
    { rank: 5, max: 14, percent: 15, reservePct: 45, limit: 9, regen: 3 },
  ];
  for (const row of cases) {
    const target = { grade: 'cultivator', rank: row.rank, essenceSuppressionPct: row.percent };
    assert.deepEqual(plain(rules.enemyEssenceState(target)), {
      max: row.max, limit: row.limit, current: row.limit, regen: row.regen,
      percent: row.percent, reservePct: row.reservePct,
    });
    assert.equal(rules.enemyEssenceState({ ...target, essence: 0 }).current, 0);
  }
  assert.equal(rules.enemyEssenceState({ grade: 'cultivator', rank: 3, essence: 90 }).current, 10,
    'unsuppressed essence defaults to the cap and aptitude defaults to bing');
  assert.equal(rules.enemyEssenceState({ grade: 'cultivator', rank: 4, aptitude: 'ding' }).max, 11);
  const jia = rules.enemyEssenceState({ grade: 'cultivator', rank: 3, aptitude: 'jia', essenceSuppressionPct: 60 });
  assert.equal(jia.reservePct, 85);
  assert.ok(jia.limit > 0 && jia.regen > 0, 'high-grade three-turn reserve remains usable and regenerates');
  assert.equal(rules.enemyEssenceState({ grade: 'beast', rank: 4 }), null);
});

test('moon shadow gates unsupported targets and repeated suppression, then makes a cost-free plan', () => {
  for (const target of [
    { grade: 'beast', rank: 4 },
    { grade: 'cultivator', rank: 2 },
    { grade: 'cultivator', rank: 6 },
  ]) assert.equal(rules.gateMissReason(effect, { target }), 'suppression_target_unsupported');
  assert.equal(rules.gateMissReason(effect, {
    target: { grade: 'cultivator', rank: 4, essenceSuppressionPct: 30 },
  }), 'suppression_already_active');
  assert.equal(rules.gateMissReason(effect, { target: { grade: 'cultivator', rank: 5 } }), '');

  for (const [rank, percent] of [[3, 60], [4, 30], [5, 15]]) {
    const plan = rules.effectPlan(effect, { target: { grade: 'cultivator', rank } });
    assert.deepEqual(plain(plan), {
      damage: 0, heal: 0, block: 0, statuses: [], swordIntent: 0,
      support: null, inspect: false, suppressCounter: false, armorBreak: 0,
      ignoreEvasion: false, essenceSuppressionPct: percent,
    });
  }
});

test('enemy intent cost charges Gu sources and hostile fallbacks only', () => {
  const enemy = { attackSource: 'gu' };
  const guById = { a: { trueQiCost: 2 }, b: { essence_cost: 3 } };
  assert.equal(rules.enemyIntentCost(enemy, { kind: 'damage', guRefs: ['a', 'b'] }, guById), 5);
  assert.equal(rules.enemyIntentCost(enemy, { true_qi_cost: 4, guRefs: ['a', 'b'] }, guById), 4,
    'declared adapted cost takes precedence over component costs');
  assert.equal(rules.enemyIntentCost(enemy, { kind: 'damage', damage: 1 }), 1);
  for (const key of ['damage', 'soul_drain', 'life_cost', 'essence_burn']) {
    assert.equal(rules.enemyIntentCost(enemy, { [key]: 1 }), 1, `${key} fallback`);
  }
  assert.equal(rules.enemyIntentCost(enemy, { kind: 'seal' }), 1);
  assert.equal(rules.enemyIntentCost(enemy, { kind: 'heal' }), 0);
  assert.equal(rules.enemyIntentCost({ attackSource: 'innate' }, { kind: 'damage', true_qi_cost: 8 }), 0);
  assert.equal(rules.enemyIntentCost(enemy, { attackSource: 'innate', kind: 'damage' }), 0,
    'intent source overrides enemy default');
  assert.throws(() => rules.enemyIntentCost(enemy, { guRefs: ['missing'] }), /unknown Gu/);
});

test('generated moon shadow and human enemy data retain suppression and rank grade', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${read('../js/data.js')}; globalThis.__data = DATA;`, ctx);
  const moonShadow = ctx.__data.gu.find(gu => gu.id === 'moon_shadow_gu');
  const sourceGu = JSON.parse(read('../data/gu.json')).find(gu => gu.id === 'moon_shadow_gu');
  const sourceEnemies = JSON.parse(read('../data/enemies.json'));
  assert.deepEqual(plain(sourceGu.v1_effect), effect);
  assert.deepEqual(plain(moonShadow.battleEffect), effect);
  assert.ok(sourceEnemies.some(enemy => enemy.grade === 'cultivator' && enemy.rank >= 3));
  assert.ok(ctx.__data.enemies.some(enemy => enemy.grade === 'cultivator' && enemy.rank >= 3),
    'ranked human opponents remain tagged as cultivators in projected data');
});

function makeUseGuFixture() {
  const dataContext = vm.createContext({});
  vm.runInContext(`${read('../js/data.js')}; globalThis.__data = DATA;`, dataContext);
  const gu = dataContext.__data.gu.find(item => item.id === 'moon_shadow_gu');
  const foe = { id: 'fixture_human', grade: 'cultivator', rank: 4, hp: 20, hpMax: 20,
    essence: 12, essenceSuppressionPct: 0, statuses: {}, flags: {} };
  const state = { cultivation: 4, aptitude: 'bing', qi: 12, thought: 3, blood: 20,
    bloodMax: 20, lifeTime: 60, leafRecoveryNodeId: null, owned: { moon_shadow_gu: 1 },
    journey: { nodeId: 'fixture' }, battle: { enemies: [foe], targetId: foe.id,
      turn: 1, actionsUsed: 0, actionLimit: 2, over: null, guUsedThisTurn: {},
      guSealed: {}, turnSupports: {}, log: [] } };
  const ctx = vm.createContext({
    state, GuRules: rules, RunRules: context.RunRules, GU_BY_ID: { moon_shadow_gu: gu },
    DATA: { killMovesEnabled: false },
    assertRunMutable: () => true,
    targetOf: battle => battle.enemies.find(enemy => enemy.id === battle.targetId),
    aliveEnemies: battle => battle.enemies.filter(enemy => enemy.hp > 0),
    currentCombatRoster: () => [{ ...gu, id: gu.id, instanceId: 'moon_shadow_gu::1' }],
    currentKillMoves: () => [], fedGuOwned: () => state.owned,
    guTargetOutOfRange: () => false,
    isDirectStrike: () => false,
    openBattleOutcome() {}, toast(reason) { state.lastToast = reason; },
    guReasonLabel: reason => reason, recordEvent() {}, finishPlayerAction() {},
    applyEffectPlan(_battle, target, plan) {
      target.essenceSuppressionPct = Math.max(target.essenceSuppressionPct || 0,
        Number(plan.essenceSuppressionPct || 0));
    },
    Sfx: { fail() {}, hit() {}, click() {}, win() {}, lose() {} },
  });
  const mainSource = read('../js/main.js');
  const start = mainSource.indexOf('  useGu(');
  const end = mainSource.indexOf('\n  },', start);
  assert.ok(start >= 0 && end > start, 'extract the production useGu action');
  vm.runInContext(`globalThis.__action = {${mainSource.slice(start, end + 5)}};`, ctx);
  return { ctx, state, foe };
}

test('actual Gu action applies suppression once; a repeat gate does not spend resources', () => {
  const { ctx, state, foe } = makeUseGuFixture();
  ctx.__action.useGu('moon_shadow_gu::1');
  assert.equal(foe.essenceSuppressionPct, 30);
  assert.equal(state.qi, 9);
  assert.equal(state.thought, 2);
  assert.equal(foe.hp, 20, 'the debuff deals no damage');

  state.battle.guUsedThisTurn = {};
  state.battle.actionsUsed = 0;
  ctx.__action.useGu('moon_shadow_gu::1');
  assert.equal(state.lastToast, 'suppression_already_active');
  assert.equal(state.qi, 9, 'rejected repeat does not spend essence');
  assert.equal(state.thought, 2, 'rejected repeat does not spend thought');
  assert.equal(state.battle.log.filter(line => line.includes('催动')).length, 1);
});
