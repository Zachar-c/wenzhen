import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const mainSource = read('../js/main.js');

function loadRules() {
  const ctx = vm.createContext({});
  vm.runInContext(read('../js/run_rules.js'), ctx);
  vm.runInContext(read('../js/gu_rules.js'), ctx);
  return { run: ctx.RunRules, gu: ctx.GuRules };
}

function loadData() {
  const ctx = vm.createContext({});
  vm.runInContext(`${read('../js/data.js')}; globalThis.__DATA = DATA;`, ctx);
  return ctx.__DATA;
}

function actionFixture(methodName, { distance = 21 } = {}) {
  const moonRay = { id: 'moon_ray_gu', name: '月痕蛊', rank: 2, trueQiCost: 2,
    thoughtCost: 1, battleEffect: { kind: 'strike', amount: 3, range_meters: 20 } };
  const move = { id: 'fixture_move', label: 'fixture move', playable: true,
    recipe: ['moon_ray_gu'], true_qi_cost: 2, thought_cost: 1 };
  const foe = { id: 'foe', name: '敌手', hp: 12, hpMax: 12, distanceMeters: distance,
    reactions: [{ trigger: 'direct_strike', window: 'before_damage', label: '反击' }],
    revealed: false, flags: {}, statuses: {} };
  const state = { cultivation: 2, qi: 8, thought: 4, blood: 20, bloodMax: 20,
    equipped: [move.id], owned: { moon_ray_gu: 1 }, journey: { nodeId: 'node' },
    battle: { enemies: [foe], targetId: foe.id, turn: 1, actionsUsed: 0, actionLimit: 2,
      over: null, guUsedThisTurn: {}, guSealed: {}, killMoveUsedThisTurn: {},
      turnSupports: {}, swordIntent: 0, log: [], buffs: {} } };
  const effects = { toast: [], finish: 0, events: 0 };
  const ctx = vm.createContext({
    state,
    DATA: { killMovesEnabled: true },
    GU_BY_ID: { moon_ray_gu: moonRay },
    RunRules: loadRules().run,
    HumanRules: { BASELINE: { attack: 3 }, basicStrikePlan: () => ({ damage: 3, delayTurns: 0 }) },
    assertRunMutable: () => true,
    targetOf: battle => battle.enemies.find(enemy => enemy.id === battle.targetId),
    aliveEnemies: battle => battle.enemies.filter(enemy => enemy.hp > 0),
    currentKillMoves: () => [move],
    fedGuOwned: () => state.owned,
    currentCombatRoster: () => [{ ...moonRay, instanceId: 'moon_ray_gu::1' }],
    currentGuCare: () => ({ hungry: false }),
    guReasonLabel: reason => reason,
    liveReactions: () => [{ label: '反击', counter_status: 'bound' }],
    statusZh: status => status,
    isDirectStrike: effect => effect?.effect?.kind === 'strike',
    finishPlayerAction: () => { effects.finish += 1; },
    openBattleOutcome() {},
    recordEvent() { effects.events += 1; },
    resolveProblemHit() { throw new Error('out-of-range action must return before hit resolution'); },
    applyEffectPlan() { throw new Error('out-of-range action must return before effect resolution'); },
    scheduleEffect() { throw new Error('out-of-range action must return before scheduling'); },
    Sfx: { fail() {}, hit() {}, click() {}, win() {}, lose() {} },
    $: () => null,
    toast: message => effects.toast.push(message),
  });
  vm.runInContext(read('../js/gu_rules.js'), ctx);
  vm.runInContext(`
    ${mainSource.slice(mainSource.indexOf('function guTargetOutOfRange'), mainSource.indexOf('function currentCombatRoster'))}
  `, ctx);
  const start = mainSource.indexOf(`  ${methodName}(`);
  const end = mainSource.indexOf('\n  },', start);
  assert.ok(start >= 0 && end > start, `found actual ${methodName} method`);
  vm.runInContext(`const action = {${mainSource.slice(start, end + 5)}}; globalThis.__action = action;`, ctx);
  return { ctx, foe, state, effects, move };
}

test('distance helpers normalize missing values and approach without mutating input', () => {
  const { run } = loadRules();
  assert.equal(run.distanceMeters(undefined), 0, 'old encounters default to melee distance');
  assert.equal(run.distanceMeters(-4), 0);
  assert.equal(run.distanceMeters(12.9), 12);
  assert.equal(run.approachDistance(5), 0, 'approach clamps at contact');
  assert.equal(run.approachDistance(25, 10), 15);
  assert.equal(run.approachDistance(25, 0), 25);
});

test('moon-ray recipe and projected strike retain unchanged power with doubled reach', () => {
  const source = JSON.parse(read('../data/gu.json'));
  const recipes = JSON.parse(read('../data/refinement_recipes.json')).recipes;
  const base = source.find(gu => gu.id === 'moonlight_gu');
  const ray = source.find(gu => gu.id === 'moon_ray_gu');
  const recipe = recipes.find(item => item.id === 'moonlight_ray');
  assert.ok(base && ray && recipe, 'the source data defines both moon Gu and their recipe');
  assert.equal(base.v1_effect.amount, ray.v1_effect.amount, 'moon ray preserves moonlight damage');
  assert.equal(base.v1_effect.range_meters, 10);
  assert.equal(ray.v1_effect.range_meters, 20);
  assert.deepEqual(Array.from(recipe.input_gu_ids), ['moonlight_gu', 'trail_stone_gu']);
  assert.equal(recipe.output_gu_id, 'moon_ray_gu');
  assert.equal(recipe.stone_cost, 10);
  assert.ok(source.some(gu => gu.id === 'trail_stone_gu'));
  assert.equal(JSON.parse(read('../data/names.json')).gu.trail_stone_gu, '痕石蛊');
});

test('generated DATA carries moon-ray reach and the exact fixed recipe', () => {
  const data = loadData();
  const ray = data.gu.find(gu => gu.id === 'moon_ray_gu');
  const base = data.gu.find(gu => gu.id === 'moonlight_gu');
  const recipe = data.recipes.find(item => item.id === 'moonlight_ray');
  assert.ok(ray && base && recipe);
  assert.equal(ray.battleEffect.amount, base.battleEffect.amount);
  assert.equal(ray.battleEffect.range_meters, 20);
  assert.equal(base.battleEffect.range_meters, 10);
  assert.deepEqual(Array.from(recipe.inputs), ['moonlight_gu', 'trail_stone_gu']);
  assert.equal(recipe.stoneCost, 10);
});

test('composite strike reach uses the shortest damaging component and ignores support components', () => {
  const { gu } = loadRules();
  assert.equal(gu.strikeRange({ kind: 'composite', parts: [
    { kind: 'strike', amount: 3, range_meters: 20 },
    { kind: 'support', amount: 5, range_meters: 1 },
    { kind: 'strike', amount: 2, range_meters: 10 },
  ] }), 10);
  assert.equal(gu.strikeRange({ kind: 'composite', parts: [
    { kind: 'support', amount: 5, range_meters: 1 },
  ] }), null);
  assert.equal(gu.strikeRange({ kind: 'strike', amount: 3 }), 0);
  assert.equal(gu.strikeRange({ kind: 'support', amount: 3, range_meters: 100 }), null);
});

test('enemy approach recognizes resource damage and respects each human action range', () => {
  const ctx = vm.createContext({ GU_BY_ID: {
    defensive_gu: { battleEffect: { kind: 'maintained', amount: 3 } },
    ranged_gu: { battleEffect: { kind: 'strike', amount: 2, range_meters: 10 } },
  } });
  vm.runInContext(read('../js/gu_rules.js'), ctx);
  vm.runInContext(mainSource.slice(
    mainSource.indexOf('function guTargetOutOfRange'),
    mainSource.indexOf('function currentCombatRoster'),
  ), ctx);
  const needsApproach = enemy => ctx.enemyNeedsApproach(enemy);

  assert.equal(needsApproach({ distanceMeters: 20, attackRangeMeters: 0,
    enemyIntent: { damage: 0, essence_burn: 2 } }), true, 'true-qi damage is range checked');
  assert.equal(needsApproach({ distanceMeters: 20, attackRangeMeters: 0,
    enemyIntent: { damage: 0, life_cost: 1 } }), true, 'life loss is range checked');
  assert.equal(needsApproach({ distanceMeters: 20, attackRangeMeters: 0,
    enemyIntent: { damage: 0, essence_burn: 2, range_meters: 20 } }), false,
  'an authored ranged resource attack can still reach');

  assert.equal(needsApproach({ human: {}, distanceMeters: 5,
    plannedAction: { kind: 'basic_attack' } }), true, 'human punch remains melee');
  assert.equal(needsApproach({ human: {}, distanceMeters: 5,
    plannedAction: { kind: 'gu', guId: 'defensive_gu' } }), false,
  'defensive Gu is usable at any distance');
  assert.equal(needsApproach({ human: {}, distanceMeters: 15,
    plannedAction: { kind: 'gu', guId: 'ranged_gu' } }), true);
  assert.equal(needsApproach({ human: {}, distanceMeters: 10,
    plannedAction: { kind: 'gu', guId: 'ranged_gu' } }), false);
});

for (const [label, method, invoke] of [
  ['basic attack', 'basicAttack', action => action.ctx.__action.basicAttack()],
  ['Gu strike', 'useGu', action => action.ctx.__action.useGu('moon_ray_gu::1')],
  ['kill move', 'useMove', action => action.ctx.__action.useMove(action.move.id)],
]) {
  test(`${label} out-of-range guard leaves costs, action, and counter state untouched`, () => {
    const f = actionFixture(method);
    invoke(f);
    assert.equal(f.state.qi, 8);
    assert.equal(f.state.thought, 4);
    assert.equal(f.state.battle.actionsUsed, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(f.state.battle.guUsedThisTurn)), {});
    assert.deepEqual(JSON.parse(JSON.stringify(f.state.battle.killMoveUsedThisTurn)), {});
    assert.equal(f.foe.revealed, false);
    assert.deepEqual(JSON.parse(JSON.stringify(f.foe.flags)), {});
    assert.equal(f.effects.finish, 0);
    assert.equal(f.effects.events, 0);
    assert.ok(f.effects.toast.length > 0, 'player receives a reach explanation');
  });
}

test('approachTarget changes only the selected foe, costs one action, and uses actual action flow', () => {
  const source = mainSource;
  const start = source.indexOf('  approachTarget() {');
  const end = source.indexOf('\n  },', start);
  const rules = loadRules();
  const foes = [{ id: 'near', distanceMeters: 5 }, { id: 'far', distanceMeters: 25 }];
  const state = { battle: { enemies: foes, targetId: 'near', actionsUsed: 0, actionLimit: 2, over: null, log: [] } };
  let finished = 0;
  const ctx = vm.createContext({ state, RunRules: rules.run,
    assertRunMutable: () => true,
    targetOf: battle => battle.enemies.find(enemy => enemy.id === battle.targetId),
    finishPlayerAction: () => { finished += 1; },
  });
  assert.ok(start >= 0 && end > start, 'found actual approachTarget method');
  vm.runInContext(`const action = {${source.slice(start, end + 5)}}; globalThis.__action = action;`, ctx);
  ctx.__action.approachTarget();
  assert.equal(foes[0].distanceMeters, 0);
  assert.equal(foes[1].distanceMeters, 25, 'other enemies retain their individual distance');
  assert.equal(state.battle.actionsUsed, 1);
  assert.equal(finished, 1, 'approach enters the standard player-action completion hook');
});

test('per-enemy distances survive the same JSON round trip used by saves', () => {
  const battle = { enemies: [{ id: 'one', distanceMeters: 7 }, { id: 'two', distanceMeters: 19 }] };
  const restored = JSON.parse(JSON.stringify({ battle })).battle;
  assert.deepEqual(restored.enemies.map(enemy => enemy.distanceMeters), [7, 19]);
});

test('range gate guard enters only the second-segment encounter pool', () => {
  const data = loadData();
  const rawEnemies = JSON.parse(read('../data/enemies.json'));
  const guardSource = rawEnemies.find(enemy => enemy.id === 'range_gate_guard');
  assert.equal(guardSource.min_segment, 2);
  assert.equal(guardSource.start_distance_meters, 20);
  const pools = data.flow.poolsBySegment;
  assert.ok(pools['2'].battle.includes('range_gate_guard'));
  for (const segment of ['1', '3', '4', '5']) {
    assert.equal(pools[segment].battle.includes('range_gate_guard'), false,
      `range gate guard is absent from segment ${segment} battles`);
  }
});

test('second-segment shop reserves a purchasable trail stone Gu for the moon-ray recipe', () => {
  const data = loadData();
  const ctx = vm.createContext({
    state: { seed: 17, school: 'light' },
    DATA: data,
    currentNode: () => ({ id: 'segment-two-shop', segment: 2 }),
    currentSegment: () => 1,
  });
  const journeySource = read('../js/journey.js');
  const start = journeySource.indexOf('function currentShopContext()');
  const end = journeySource.indexOf('\nfunction offerCost(', start);
  assert.ok(start >= 0 && end > start, 'found actual currentShopContext function');
  vm.runInContext(journeySource.slice(start, end), ctx);
  vm.runInContext(read('../js/run_rules.js'), ctx);
  vm.runInContext(read('../js/shop_rules.js'), ctx);
  const shopContext = ctx.currentShopContext();
  assert.ok(Array.from(shopContext.reservedGuIds).includes('trail_stone_gu'));

  const purchase = data.shopOffers.find(offer => offer.id === 'purchase_trail_stone');
  const recipe = data.recipes.find(item => item.id === 'moonlight_ray');
  assert.equal(purchase.gu_id, 'trail_stone_gu');
  assert.ok(recipe.inputs.includes(purchase.gu_id));
  assert.ok(ctx.ShopRules.stock(data.shopOffers, {
    ...shopContext,
    pacingLayers: data.loot.pacingLayers,
  }).includes(purchase.id), 'actual second-segment stock honors the reserved material Gu');
});
