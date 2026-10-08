import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const rules = context.GuRules;
const dataContext = vm.createContext({});
vm.runInContext(
  fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8') + ';globalThis.DATA = DATA;',
  dataContext,
);
const data = dataContext.DATA;
const plain = (value) => JSON.parse(JSON.stringify(value));

const gu = (overrides = {}) => ({
  rank: 1,
  trueQiCost: 1,
  thoughtCost: 1,
  lowRankException: false,
  ...overrides,
});

test('gu activation blocks a higher-rank gu unless it declares an exception', () => {
  const player = { playerRank: 1, trueQi: 10, thought: 3, usedThisTurn: false };
  assert.equal(rules.activationReason(gu({ rank: 2 }), player), 'insufficient_qi_quality');
  assert.equal(
    rules.activationReason(gu({ rank: 2, lowRankException: true }), player),
    '',
  );
});

test('gu activation reports exhausted resources and one-use-per-turn state', () => {
  const base = { playerRank: 3, trueQi: 3, thought: 2, usedThisTurn: false };
  assert.equal(rules.activationReason(gu({ trueQiCost: 4 }), base), 'insufficient_true_qi');
  assert.equal(rules.activationReason(gu({ thoughtCost: 3 }), base), 'insufficient_thought');
  assert.equal(rules.activationReason(gu({ thoughtCost: 0 }), { ...base, thought: 0 }), '');
  assert.equal(rules.activationReason(gu(), { ...base, usedThisTurn: true }), 'gu_used_this_turn');
  assert.equal(rules.activationReason(gu({ sealed: true }), base), 'gu_sealed');
});

test('combat roster includes every owned combat gu without a slot cap', () => {
  const roster = rules.combatRoster([
    gu({ id: 'alpha_gu', combat: 'strike' }),
    gu({ id: 'beta_gu', combat: 'shield' }),
    gu({ id: 'utility_gu', combat: '' }),
    gu({ id: 'unowned_gu', combat: 'strike' }),
  ], { alpha_gu: 1, beta_gu: 1, utility_gu: 1 });

  assert.deepEqual(plain(roster).map((entry) => entry.id), ['alpha_gu', 'beta_gu']);
});

test('combat roster expands duplicate definitions into separate instances', () => {
  const roster = rules.combatRoster(
    [gu({ id: 'alpha_gu', combat: 'strike' })],
    { alpha_gu: 2 },
    {
      playerRank: 1,
      trueQi: 10,
      thought: 2,
      usedInstances: { 'alpha_gu::1': true },
    },
  );

  assert.deepEqual(
    plain(roster).map((entry) => entry.instanceId),
    ['alpha_gu::1', 'alpha_gu::2'],
  );
  assert.equal(roster[0].activationReason, 'gu_used_this_turn');
  assert.equal(roster[1].activationReason, '');
});

test('wild gu attunement pays rank-scaled essence and moves one instance to refined', () => {
  const result = rules.attuneWild({ small_light_gu: 2 }, { small_light_gu: 1 }, 20, 'small_light_gu', 1);
  assert.equal(result.ok, true);
  assert.equal(result.cost, 4);
  assert.equal(result.wild.small_light_gu, 1);
  assert.equal(result.owned.small_light_gu, 2);
  assert.equal(result.trueQi, 16);
  assert.equal(rules.attuneCost(2), 6);
});

test('wild gu attunement rejects missing targets and insufficient essence without spending', () => {
  const missing = rules.attuneWild({}, {}, 20, 'small_light_gu', 1);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'attune_target_missing');
  const poor = rules.attuneWild({ small_light_gu: 1 }, {}, 3, 'small_light_gu', 1);
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'insufficient_essence');
  assert.equal(poor.cost, 4);
});

test('kill move recipes resolve one unused instance per required gu', () => {
  const move = { recipe: ['alpha_gu', 'beta_gu'] };
  assert.deepEqual(
    rules.killMoveRecipeInstances(move, { alpha_gu: 2, beta_gu: 1 }, { 'alpha_gu::1': true }, {}),
    ['alpha_gu::2', 'beta_gu::1'],
  );
  assert.deepEqual(
    rules.killMoveRecipeInstances(move, { alpha_gu: 2, beta_gu: 1 }, { 'beta_gu::1': true }, {}),
    ['alpha_gu::1', null],
  );
});

test('experimental light kill moves normalize components and derive all costs', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  const input = ['small_light_gu', 'moonlight_gu'];
  const result = rules.composeKillMove(input, byId);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.move.recipe), ['moonlight_gu', 'small_light_gu']);
  assert.equal(result.move.id, 'km_custom_moonlight_gu__small_light_gu');
  assert.equal(result.move.label, '月光蛊＋小光蛊');
  assert.equal(result.move.playable, true);
  assert.equal(result.move.experimental, true);
  assert.equal(result.move.tag, 'light');
  assert.equal(result.move.true_qi_cost, 3);
  assert.equal(result.move.thought_cost, 2);
  assert.equal(result.move.life_cost, 0);
  assert.deepEqual(input, ['small_light_gu', 'moonlight_gu']);
});

test('experimental light kill moves reject unknown, unverified and support-only recipes', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  assert.equal(rules.composeKillMove(['moonlight_gu', 'unknown'], byId).reason, 'unknown_component');
  assert.equal(rules.composeKillMove(['moonlight_gu', 'small_light_gu'], {
    ...byId, moonlight_gu: { ...byId.moonlight_gu, sourceClass: 'unverified' },
  }).reason, 'unverified_component');
  assert.equal(rules.composeKillMove(['small_light_gu', 'small_light_gu'], byId).reason, 'strike_required');
});

test('experimental light recipes have stable identity and reserve repeated instances separately', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  const first = rules.composeKillMove(['moonlight_gu', 'small_light_gu', 'moonlight_gu'], byId);
  const second = rules.composeKillMove(['small_light_gu', 'moonlight_gu', 'moonlight_gu'], byId);
  assert.equal(first.move.id, second.move.id);
  assert.deepEqual(plain(first.move.recipe), ['moonlight_gu', 'moonlight_gu', 'small_light_gu']);
  assert.deepEqual(
    plain(rules.killMoveRecipeInstances(first.move, { moonlight_gu: 1, small_light_gu: 1 })),
    ['moonlight_gu::1', null, 'small_light_gu::1'],
  );
  assert.deepEqual(
    plain(rules.killMoveRecipeInstances(first.move, { moonlight_gu: 2, small_light_gu: 1 })),
    ['moonlight_gu::1', 'moonlight_gu::2', 'small_light_gu::1'],
  );
});

test('small light does not amplify moon glow without moonlight and explains the inactive pairing', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  const result = rules.composeKillMove(['small_light_gu', 'moon_glow_gu'], byId);
  assert.equal(result.ok, true);
  assert.ok(result.notes.some(note => note.includes('只辅助月光蛊')));
  assert.equal(rules.killMoveEffectPlan(result.move, byId).damage,
    rules.effectPlan(byId.moon_glow_gu.battleEffect, { school: 'light', guId: 'moon_glow_gu' }).damage);
  const withMoonlight = rules.composeKillMove(['moonlight_gu', 'small_light_gu'], byId);
  assert.equal(rules.killMoveEffectPlan(withMoonlight.move, byId).damage, 6);
});

test('L0 kill move effect is composed from recipe components in order', () => {
  const guById = {
    alpha_gu: { school: 'force', v1_effect: { kind: 'strike', amount: 2 } },
    beta_gu: { school: 'blood', v1_effect: { kind: 'heal_and_strike', heal: 1, amount: 3 } },
  };
  const move = {
    recipe: ['alpha_gu', 'beta_gu'],
    // LEGACY prefab must not drive settlement
    effect: { kind: 'strike', amount: 99 },
    damage: 88,
  };
  const plan = rules.killMoveEffectPlan(move, guById, { school: 'force' });
  assert.equal(plan.damage, 5);
  assert.equal(plan.heal, 1);
  const flipped = rules.killMoveEffectPlan({ ...move, recipe: ['beta_gu', 'alpha_gu'] }, guById, {});
  assert.equal(flipped.damage, 5);
  assert.equal(flipped.heal, 1);
});

test('generated effects mirror Godot role fallback rank and self-support transforms', () => {
  const byId = Object.fromEntries(data.gu.map((entry) => [entry.id, entry]));
  // RUL-2026-09-26-001 换基：role 兜底镜像值随新 lab 曲线（attack/defense r5: 旧 6/7 → 新 4/4）。
  assert.equal(byId.light_atk_5_03_gu.battleEffect.amount, 4);
  // P5-B2：white_jade_gu 已收敛为显式 effect（shield 5，canon_driven_v1），
  // 镜像断言改用仍在 role 兜底上的 loot 蛊。
  assert.equal(byId.light_def_5_22_gu.battleEffect.amount, 4);
  assert.equal(byId.white_jade_gu.battleEffect.amount, 5);
  assert.equal(byId.white_jade_gu.sourceClass, 'canon_driven_v1');
  assert.equal(byId.light_rec_3_07_gu.battleEffect.support_school, 'light');
});

test('gu condition gates run before cost commit', () => {
  const effect = {
    kind: 'strike',
    amount: 4,
    condition: { type: 'self_hp_below', threshold: 0.5 },
  };
  assert.equal(rules.gateMissReason(effect, { hp: 50, hpMax: 100 }), 'condition_miss');
  assert.equal(rules.gateMissReason(effect, { hp: 49, hpMax: 100 }), '');
});

test('consume_status requires at least one live stack before cost commit', () => {
  const effect = {
    kind: 'strike',
    amount: 2,
    consume_status: { name: 'marked', per_stack: 1 },
  };
  assert.equal(rules.gateMissReason(effect, { statusStacks: {} }), 'consume_status_missing');
  assert.equal(rules.gateMissReason(effect, { statusStacks: { marked: 1 } }), '');
});

test('gu effect plan resolves strike support, shield, heal and composite effects', () => {
  const base = {
    damage: 0, heal: 0, block: 0, statuses: [], swordIntent: 0, support: null,
    inspect: false, suppressCounter: false, armorBreak: 0, ignoreEvasion: false,
  };
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'strike', amount: 2 }, { school: 'light', supports: { light: 3 } })),
    { ...base, damage: 5 },
  );
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'shield', amount: 3 })),
    { ...base, block: 3 },
  );
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'heal_and_strike', heal: 2, amount: 4 })),
    { ...base, damage: 4, heal: 2 },
  );
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'composite', parts: [{ kind: 'grant_block', amount: 5 }] })),
    { ...base, block: 5 },
  );
});

test('targeted non-stacking support multiplies only its declared gu and preserves school bonuses', () => {
  const supportEffect = {
    kind: 'support',
    target_gu_id: 'moonlight_gu',
    multiplier: 2,
    nonStacking: true,
  };
  const support = rules.effectPlan(supportEffect, { school: 'light', guId: 'small_light_gu' }).support;
  assert.deepEqual(plain(support), {
    school: 'light', bonus: 0, targetGuId: 'moonlight_gu', multiplier: 2, nonStacking: true,
  });

  const supports = { guTargets: { moonlight_gu: [support, { ...support }] } };
  assert.equal(rules.effectPlan(
    { kind: 'strike', amount: 3 }, { school: 'light', guId: 'moonlight_gu', supports },
  ).damage, 6); // two identical 2× supports still produce 2×, never 4×
  assert.equal(rules.effectPlan(
    { kind: 'strike', amount: 3 }, { school: 'light', guId: 'other_light_gu', supports },
  ).damage, 3); // targeted multiplier does not leak to other light gu
  assert.equal(rules.effectPlan(
    { kind: 'strike', amount: 3 }, {
      school: 'light', guId: 'moonlight_gu', supports: { ...supports, light: 3 },
    },
  ).damage, 9); // targeted multiplier coexists with legacy additive school support
});

test('ordinary same-school support remains additive without targeted support', () => {
  assert.equal(rules.effectPlan(
    { kind: 'strike', amount: 3 }, { school: 'light', guId: 'moonlight_gu', supports: { light: 2 } },
  ).damage, 5);
});

test('gu effect plan resolves delayed, consume-status and intent-weaken effects', () => {
  const base = {
    damage: 0, heal: 0, block: 0, statuses: [], swordIntent: 0, support: null,
    inspect: false, suppressCounter: false, armorBreak: 0, ignoreEvasion: false,
  };
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'strike', amount: 3, delay: { turns: 1 } })),
    { ...base, damage: 3, delayTurns: 1 },
  );
  assert.deepEqual(
    plain(rules.effectPlan(
      { kind: 'strike', amount: 2, consume_status: { name: 'marked', per_stack: 1 } },
      { statusStacks: { marked: 3 } },
    )),
    {
      ...base,
      damage: 5,
      consumeStatus: 'marked',
    },
  );
  assert.deepEqual(
    plain(rules.effectPlan({ kind: 'weaken_intent', amount: 2 })),
    { ...base, intentWeaken: 2 },
  );
});

test('lab data exports every special V1 effect channel used by the rules', () => {
  const byId = Object.fromEntries(data.gu.map((entry) => [entry.id, entry]));
  for (const id of [
    'blood_atk_5_02_gu',
    'fire_atk_2_01_gu',
    'water_atk_3_05_gu',
    'wisdom_rec_1_20_gu',
    'wisdom_atk_3_13_gu',
  ]) {
    assert.ok(byId[id], `${id} must be present in the lab pool`);
  }
  assert.equal(byId.blood_atk_5_02_gu.lifeCost, 2);
  assert.equal(byId.fire_atk_2_01_gu.battleEffect.delay.turns, 1);
  assert.equal(byId.water_atk_3_05_gu.battleEffect.consume_status.name, 'marked');
  assert.equal(byId.wisdom_rec_1_20_gu.battleEffect.kind, 'status');
  assert.equal(byId.wisdom_atk_3_13_gu.battleEffect.kind, 'weaken_intent');
});

test('sword intent only boosts sword-school strikes', () => {
  assert.equal(
    rules.effectPlan({ kind: 'strike', amount: 2 }, { school: 'sword', swordIntent: 3 }).damage,
    5,
  );
  assert.equal(
    rules.effectPlan({ kind: 'strike', amount: 2 }, { school: 'light', swordIntent: 3 }).damage,
    2,
  );
});


test('joint targeted support is independent of recipe order, respects gates and does not mutate pending support', () => {
  const guById = {
    moon: { school: 'light', battleEffect: { kind: 'strike', amount: 3 } },
    small: { school: 'light', battleEffect: { kind: 'support', target_gu_id: 'moon', multiplier: 2, nonStacking: true } },
  };
  const context = { supports: { guTargets: {} } };
  for (const recipe of [['moon', 'small'], ['small', 'moon'], ['small', 'small', 'moon']]) {
    assert.equal(rules.killMoveEffectPlan({ recipe }, guById, context).damage, 6);
  }
  assert.deepEqual(context, { supports: { guTargets: {} } });
  guById.small.battleEffect.condition = { type: 'self_hp_below', threshold: 0.5 };
  assert.equal(rules.killMoveEffectPlan({ recipe: ['moon', 'small'] }, guById, { hp: 10, hpMax: 10 }).damage, 3);
});

test('maintained defense cannot silently become a one-shot kill-move substitute', () => {
  const guById = {
    guard: { id: 'guard', role: 'defense', battleEffect: { kind: 'shield', amount: 3 } },
    jade: { id: 'jade', role: 'defense', battleEffect: { kind: 'maintained', amount: 3 } },
  };
  assert.equal(rules.killMoveGateMissReason({ recipe: ['jade'], componentConditionOverride: true }, guById), 'maintained_component_unsupported');
  assert.ok(!rules.compatibleSubstitutes('guard', guById).includes('jade'));
  assert.equal(rules.killMoveVariants({ recipe: ['jade'] }, { jade: 1 }, guById).length, 0);
});


test('production Gu keeps its body and spends essence and one preparation visit', () => {
  const grass = data.gu.find(g => g.id === 'vitality_grass_gu');
  assert.equal(grass.rank, 2);
  assert.equal(grass.school, 'wood');
  assert.equal(grass.battleEffect, null);
  const c = { owned: { vitality_grass_gu: 1 }, playerRank: 2, trueQi: 5, visitId: 'node1' };
  const made = rules.produceGu(grass, c);
  assert.equal(made.ok, true);
  assert.equal(made.owned.vitality_grass_gu, 1);
  assert.equal(made.owned.vitality_leaf_gu, 1);
  assert.equal(made.trueQi, 3);
  assert.equal(c.owned.vitality_leaf_gu, undefined);
  assert.equal(rules.produceGu(grass, { ...c, playerRank: 1 }).reason, 'insufficient_qi_quality');
  assert.equal(rules.produceGu(grass, { ...c, trueQi: 1 }).reason, 'insufficient_true_qi');
  assert.equal(rules.produceGu(grass, { ...c, lastVisitId: 'node1' }).reason, 'production_visit_used');
  assert.equal(rules.produceGu(grass, { ...c, lastVisitId: 'node0' }).ok, true);
});

test('healing leaf consumes inventory, clamps actual healing and cannot stack within recovery', () => {
  const leaf = data.gu.find(g => g.id === 'vitality_leaf_gu');
  const roster = rules.combatRoster([leaf], { vitality_leaf_gu: 20 }, { playerRank: 1, trueQi: 0, thought: 3 });
  assert.equal(roster.length, 1, 'stacked leaves need one usable action, not twenty duplicate buttons');
  assert.equal(roster[0].count, 20);
  const unsealed = rules.combatRoster([leaf], { vitality_leaf_gu: 20 }, { playerRank: 1, trueQi: 0, thought: 3, sealedInstances: { 'vitality_leaf_gu::1': true } });
  assert.equal(unsealed[0].instanceId, 'vitality_leaf_gu::2');
  assert.equal(unsealed[0].activationReason, '');
  const c = { owned: { vitality_leaf_gu: 2 }, health: 9, healthMax: 10 };
  const used = rules.consumeHealingGu(leaf, c);
  assert.equal(used.healed, 1);
  assert.equal(used.health, 10);
  assert.equal(used.owned.vitality_leaf_gu, 1);
  assert.equal(c.owned.vitality_leaf_gu, 2);
  assert.equal(rules.consumeHealingGu(leaf, { ...c, healingLocked: true }).reason, 'healing_recovery');
  assert.equal(rules.consumeHealingGu(leaf, { ...c, health: 10 }).reason, 'health_full');
  assert.equal(rules.consumeHealingGu(leaf, { ...c, owned: {} }).reason, 'gu_unavailable');
});

// ---- P1 组合准入与解析口径（2026-10-03 B 包）----

test('sustained, consumable and production components are rejected with explicit reasons', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  // 准入白名单先生效：持续蛊、消耗叶、产叶蛊都不在自由同催白名单内
  for (const id of ['jade_skin_gu', 'white_jade_gu', 'vitality_leaf_gu', 'vitality_grass_gu']) {
    assert.equal(rules.composeKillMove(['moonlight_gu', id], byId).reason, 'unknown_component');
  }
  // 类别门槛对白名单内组件同样生效：一旦持续/资源语义进入白名单即被显式拒绝，
  // 不得拼成免费一次性效果（E:V1-016070 持续灌元、E:V1-016494/016496 叶用后消失）。
  const corrupted = {
    ...byId,
    moonlight_gu: { ...byId.moonlight_gu, battleEffect: { kind: 'maintained', amount: 3 } },
  };
  assert.equal(rules.composeKillMove(['moonlight_gu', 'small_light_gu'], corrupted).reason,
    'maintained_component_unsupported');
  const consumableMoonlight = {
    ...byId,
    moonlight_gu: { ...byId.moonlight_gu, battleEffect: { kind: 'heal', amount: 3, consumable: true } },
  };
  assert.equal(rules.composeKillMove(['moonlight_gu', 'small_light_gu'], consumableMoonlight).reason,
    'resource_component_unsupported');
  // 拒绝路径同样不得改写调用方输入
  const input = ['vitality_leaf_gu', 'moonlight_gu'];
  rules.composeKillMove(input, byId);
  assert.deepEqual(input, ['vitality_leaf_gu', 'moonlight_gu']);
});

test('kill move gates read every effect channel for sustained and resource components', () => {
  const guById = {
    strike: { battleEffect: { kind: 'strike', amount: 2 } },
    maint_effect_only: { effect: { kind: 'maintained', amount: 2 }, battleEffect: null, v1_effect: null },
    maint_battle_only: { battleEffect: { kind: 'maintained', amount: 2 } },
    leaf_battle_only: { battleEffect: { kind: 'heal', amount: 3, consumable: true }, effect: { kind: 'heal', amount: 3, consumable: false } },
    prod_effect_only: { effect: { kind: 'production' } },
    train_effect_only: { effect: { kind: 'body_training', trigger: 'out_of_combat' } },
  };
  assert.equal(rules.killMoveGateMissReason({ recipe: ['strike', 'maint_effect_only'] }, guById),
    'maintained_component_unsupported');
  assert.equal(rules.killMoveGateMissReason({ recipe: ['strike', 'maint_battle_only'] }, guById),
    'maintained_component_unsupported');
  assert.equal(rules.killMoveGateMissReason({ recipe: ['strike', 'leaf_battle_only'] }, guById),
    'resource_component_unsupported');
  assert.equal(rules.killMoveGateMissReason({ recipe: ['strike', 'prod_effect_only'] }, guById),
    'resource_component_unsupported');
  // 锻体（body_training）无战斗投影，不触发杀招类别门槛；由替代排除与 compose 白名单守住
  assert.equal(rules.killMoveGateMissReason({ recipe: ['strike', 'train_effect_only'] }, guById), '');
  assert.deepEqual(Array.from(rules.compatibleSubstitutes('train_effect_only', guById)), []);
  assert.ok(!rules.compatibleSubstitutes('strike', guById).includes('train_effect_only'));
  const plan = rules.killMoveEffectPlan({ recipe: ['strike', 'maint_effect_only'] }, guById);
  assert.equal(plan.unavailableReason, 'maintained_component_unsupported');
  assert.equal(plan.damage, 0);
  // 类别门槛先于 componentConditionOverride，覆盖也不能把持续蛊拼进杀招
  assert.equal(rules.killMoveGateMissReason(
    { recipe: ['strike', 'maint_effect_only'], componentConditionOverride: true }, guById,
  ), 'maintained_component_unsupported');
});

test('composition admission stays evidence-gated for unrelated canon projections', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  // 硬气/木攻/人道查验/月影等 canon 投影没有与月光同催协同的原著锚点，
  // 不得因同为 canon_driven_v1 或同标签自动进入白名单（gu-relations §七协同实例仅小光×月光）。
  for (const id of ['wood_atk_1_05_gu', 'qi_atk_1_01_gu', 'human_atk_1_01_gu', 'moon_shadow_gu']) {
    assert.equal(rules.composeKillMove(['moonlight_gu', id], byId).reason, 'unknown_component');
  }
});

test('compose costs stay the sum of component fields, with duplicates reserving separate instances', () => {
  const byId = Object.fromEntries(data.gu.map(entry => [entry.id, entry]));
  const result = rules.composeKillMove(['moonlight_gu', 'moonlight_gu', 'small_light_gu'], byId);
  assert.equal(result.ok, true);
  // 费用守恒：按组件字段合计（月光2+月光2+小光1 真元；操控各1；无寿元字段）
  assert.equal(result.move.true_qi_cost, 5);
  assert.equal(result.move.thought_cost, 3);
  assert.equal(result.move.life_cost, 0);
  // 每柄月刃各获得一次小光定向增幅（×2），两只月光即 3×2＋3×2＝12
  assert.equal(rules.killMoveEffectPlan(result.move, byId).damage, 12);
  assert.deepEqual(
    plain(rules.killMoveRecipeInstances(result.move, { moonlight_gu: 2, small_light_gu: 1 })),
    ['moonlight_gu::1', 'moonlight_gu::2', 'small_light_gu::1'],
  );
  assert.equal(rules.killMoveRecipeInstances(result.move, { moonlight_gu: 1, small_light_gu: 1 })[1], null);
  // 白名单当前全为光道，tag 派生结果与历史存档一致
  assert.equal(result.move.tag, 'light');
});

test('kill move plan inherits component conditions and skips gated components', () => {
  const guById = {
    strike: { battleEffect: { kind: 'strike', amount: 4, condition: { type: 'self_hp_below', threshold: 0.5 } } },
    plain: { battleEffect: { kind: 'strike', amount: 2 } },
  };
  const move = { recipe: ['plain', 'strike'] };
  assert.equal(rules.killMoveGateMissReason(move, guById, { hp: 100, hpMax: 100 }), 'condition_miss');
  assert.equal(rules.killMoveGateMissReason(move, guById, { hp: 10, hpMax: 100 }), '');
  assert.equal(rules.killMoveEffectPlan(move, guById, { hp: 100, hpMax: 100 }).damage, 2);
  assert.equal(rules.killMoveEffectPlan(move, guById, { hp: 10, hpMax: 100 }).damage, 6);
  // 显式 override 才允许突破组件条件（L0 2026-09-25 默认继承）
  assert.equal(rules.killMoveEffectPlan(
    { ...move, componentConditionOverride: true }, guById, { hp: 100, hpMax: 100 },
  ).damage, 6);
});
