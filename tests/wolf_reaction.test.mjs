/** Focused synthetic fixture for the Thunder Crown Wolf's sparked reaction. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

function loadRules() {
  const ctx = vm.createContext({});
  vm.runInContext(`${readFileSync(new URL('../js/rules.js', import.meta.url), 'utf8')};
    globalThis.__rules = { liveReactions, reactionSettled, statusZh };`, ctx);
  return ctx.__rules;
}

function makeActionFixture(actionName) {
  const rules = loadRules();
  const reaction = { id: 'thunder_reflex', trigger: 'direct_strike', window: 'before_damage',
    counter_status: 'sparked', label: '雷光护甲' };
  const foe = { id: 'thunder_crown_wolf', name: '雷冠头狼', hp: 20, hpMax: 20,
    revealed: false, reactions: [reaction], flags: {}, statuses: {} };
  const composed = { id: 'fixture_move', label: 'fixture_move', tag: 'moonlight', recipe: [],
    playable: true, true_qi_cost: 1, thought_cost: 1, effect: { kind: 'strike', amount: 2 } };
  const gu = { id: 'fixture_gu', name: 'fixture蛊', school: 'moonlight', rank: 1,
    trueQiCost: 1, thoughtCost: 1, battleEffect: { kind: 'strike', amount: 2 } };
  const state = { cultivation: 1, qi: 8, thought: 3, blood: 20, bloodMax: 20, lifeTime: 60,
    owned: { fixture_gu: 1 }, equipped: [composed.id],
    journey: { nodeId: 'fixture-node' }, battle: { enemies: [foe], targetId: foe.id, turn: 1, actionsUsed: 0, actionLimit: 2,
      over: null, guUsedThisTurn: {}, guSealed: {}, killMoveUsedThisTurn: {},
      turnSupports: {}, swordIntent: null, log: [], buffs: {} } };
  let finished = 0;
  const ctx = vm.createContext({ ...rules, state, DATA: { killMovesEnabled: true },
    GU_BY_ID: { fixture_gu: gu }, GuRules: {
      canActivate: () => true,
      killMoveRecipeInstances: () => [],
      killMoveGateMissReason: () => '',
      killMoveIsDirectStrike: () => true,
      killMoveEffectPlan: () => ({ damage: 2, heal: 0, block: 0, statuses: [] }),
      activationReason: () => '',
      gateMissReason: () => '',
      effectPlan: () => ({ damage: 2, heal: 0, block: 0, statuses: [] }),
    },
    HumanRules: { BASELINE: { attack: 3 }, basicStrikePlan: () => ({ damage: 3, delayTurns: 0 }) },
    RunRules: { spendLife: (v) => v, lifeDefeated: () => false },
    assertRunMutable: () => true, targetOf: b => b.enemies[0], aliveEnemies: b => b.enemies.filter(e => e.hp > 0),
    currentKillMoves: () => [composed], fedGuOwned: () => state.owned,
    currentCombatRoster: () => [{ ...gu, instanceId: 'fixture_gu::1' }],
    liveReactions: enemy => rules.liveReactions(enemy),
    statusZh: name => rules.statusZh(name),
    $: () => null,
    isDirectStrike: effect => effect?.effect?.kind === 'strike',
    resolveProblemHit: (_b, _e, plan) => ({ damage: plan.damage }),
    applyEffectPlan: (_b, enemy, plan) => { enemy.hp -= plan.damage; },
    finishPlayerAction: () => { finished += 1; }, openBattleOutcome() {},
    recordEvent() {}, Sfx: { fail() {}, hit() {}, click() {}, win() {}, lose() {} },
    toast() {}, guReasonLabel: s => s, state });
  const start = mainSource.indexOf(`  ${actionName}(`);
  const end = mainSource.indexOf('\n  },', start);
  assert.ok(start >= 0 && end > start, `found actual ${actionName} method`);
  vm.runInContext(`const action = {${mainSource.slice(start, end + 5)}}; globalThis.__action = action;`, ctx);
  return { ctx, state, foe, composed, finished: () => finished };
}

test('RULES_FIXTURE: sparked is a live direct-strike reaction until settled', () => {
  const rules = loadRules();
  const foe = { revealed: true, flags: {}, reactions: [{ trigger: 'direct_strike',
    window: 'before_damage', counter_status: 'sparked' }] };
  assert.equal(rules.liveReactions(foe).length, 1);
  foe.revealed = false;
  assert.equal(rules.liveReactions(foe).length, 1, 'unobserved armour is still physically active');
  foe.counterDisabled = true;
  assert.equal(rules.liveReactions(foe).length, 0, 'actual suppression disables the physical reaction');
  foe.counterDisabled = false;
  foe.flags.sparked = true;
  assert.equal(rules.liveReactions(foe).length, 0);
  assert.equal(rules.reactionSettled(foe, foe.reactions[0]), true);
  assert.equal(rules.statusZh('sparked'), '雷甲已触发');
});

test('BUILD_DATA_FIXTURE: Thunder Crown Wolf reaction remains projected in generated DATA', () => {
  const src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(`${src}; globalThis.__enemies = DATA.enemies;`, ctx);
  const wolf = ctx.__enemies.find(enemy => enemy.id === 'thunder_crown_wolf');
  assert.ok(wolf, 'wolf remains in generated enemy data');
  assert.ok(wolf.reactions.some(r => r.id === 'thunder_reflex' && r.counter_status === 'sparked'));
});

for (const [name, method] of [['basic attack', 'basicAttack'], ['Gu strike', 'useGu'], ['kill move', 'useMove']]) {
  test(`ACTION_FIXTURE: ${name} consumes 雷光护甲 once, then deals damage`, () => {
    const f = makeActionFixture(method);
    const invoke = () => {
      if (method === 'useGu') f.ctx.__action.useGu('fixture_gu::1');
      else if (method === 'useMove') f.ctx.__action.useMove(f.composed.id);
      else f.ctx.__action.basicAttack();
    };
    const initialHp = f.foe.hp;
    invoke();
    assert.equal(f.foe.hp, initialHp, 'first direct attack is swallowed');
    assert.equal(f.foe.flags.sparked, true);
    assert.equal(f.state.battle.lastCounter.counterId, '雷光护甲', 'surprise reaction is retained for ending attribution');
    assert.equal(f.foe.revealed, true, 'paying for a surprise reaction reveals its information');
    assert.ok(f.state.battle.log.some(line => line.includes('吞掉')));
    assert.ok(f.state.battle.log.some(line => line.includes('雷甲已触发')));
    // Each fixture is a short action-path check, not a simulated multi-turn run.
    f.state.battle.actionsUsed = 0;
    f.state.battle.guUsedThisTurn = {};
    f.state.battle.killMoveUsedThisTurn = {};
    invoke();
    assert.ok(f.foe.hp < initialHp, 'subsequent attack deals its normal damage');
    assert.equal(f.finished(), 2);
  });
}

test('NORMAL_RUN: reach Thunder Crown Wolf, trigger 雷甲, reload, and land the next punch', async () => {
  const lab = await openLab({ seed: 28 });
  try {
    await lab.click('[data-start-run]');

    // Reach the first boss using the real map and retreat button for each of its ten depths.
    for (let depth = 0; depth < 10; depth += 1) {
      const map = await lab.snapshot();
      const node = map.journey.graph.nodes.find(item =>
        map.journey.availableNodeIds.includes(item.id)
        && item.segment === 1 && item.depth === depth
        && ['battle', 'elite'].includes(item.type));
      assert.ok(node, `normal map offers a battle or elite at first-segment depth ${depth}`);
      await lab.click(`[data-choose-node="${node.id}"]`);
      assert.ok((await lab.snapshot()).battle, `${node.id} opens a normal battle`);
      await lab.click('[data-retreat]');
      assert.ok((await lab.snapshot()).journey.availableNodeIds.length,
        `real retreat advances beyond depth ${depth}`);
    }

    let snap = await lab.snapshot();
    const boss = snap.journey.graph.nodes.find(item =>
      snap.journey.availableNodeIds.includes(item.id) && item.segment === 1 && item.type === 'boss');
    assert.ok(boss, 'the first-segment boss is reachable after ten real retreats');
    await lab.click(`[data-choose-node="${boss.id}"]`);

    // Fight through visible Gu and attack buttons. Small Light prepares Moonlight when available.
    for (let action = 0; action < 12; action += 1) {
      snap = await lab.snapshot();
      if (snap.reward) break;
      assert.ok(snap.battle && !snap.battle.over, 'boss battle remains live while resolving');
      const support = await lab.text('[data-use-gu="small_light_gu::1"]');
      if (support && !snap.battle.turnSupports?.guTargets?.moonlight_gu) {
        try { await lab.click('[data-use-gu="small_light_gu::1"]'); } catch { /* Already prepared this turn. */ }
      }
      const moonlight = await lab.text('[data-use-gu="moonlight_gu::1"]');
      if (moonlight) {
        try { await lab.click('[data-use-gu="moonlight_gu::1"]'); }
        catch { await lab.click('[data-basic-attack]'); }
      } else {
        await lab.click('[data-basic-attack]');
      }
    }
    snap = await lab.snapshot();
    assert.ok(snap.reward, 'actual combat buttons defeat the first boss');
    await lab.click(snap.reward.guChoices?.length ? '[data-reward-skip]' : '[data-reward-continue]');
    assert.equal((await lab.snapshot()).page, 'prep', 'boss reward leads to the ordinary preparation screen');
    await lab.click('[data-prep-continue]');

    snap = await lab.snapshot();
    const segmentStart = snap.journey.graph.nodes.find(item => item.id === 'L2D0N0');
    assert.ok(segmentStart && snap.journey.availableNodeIds.includes(segmentStart.id));
    await lab.click('[data-choose-node="L2D0N0"]');
    await lab.click('[data-retreat]');
    snap = await lab.snapshot();
    const wolfNode = snap.journey.graph.nodes.find(item =>
      snap.journey.availableNodeIds.includes(item.id)
      && item.segment === 2 && item.enemyIds.length === 1
      && item.enemyIds[0] === 'thunder_crown_wolf');
    assert.ok(wolfNode, 'the shortest searched seed offers a reachable solo wolf');
    await lab.click(`[data-choose-node="${wolfNode.id}"]`);

    snap = await lab.snapshot();
    const wolf = () => snap.battle.enemies.find(enemy => enemy.id === 'thunder_crown_wolf');
    assert.ok(wolf() && snap.battle.enemies.length === 1, 'normal encounter contains only the wolf');
    const wolfId = wolf().id;
    if (snap.qi > 0 && await lab.text('[data-use-gu="jade_skin_gu::1"]')) {
      await lab.click('[data-use-gu="jade_skin_gu::1"]');
    }
    await lab.click('[data-observe]');
    snap = await lab.snapshot();
    const revealedHp = wolf().hp;
    assert.equal(wolf().revealed, true, 'normal Observe reveals the wolf reaction');
    await lab.click('details.combat-details summary');
    assert.match(await lab.text('#foe-box'), /雷光护甲.*会吞掉直接攻击/);

    await lab.click('[data-basic-attack]');
    snap = await lab.snapshot();
    assert.equal(wolf().hp, revealedHp, 'the first revealed direct strike is swallowed');
    assert.equal(wolf().flags.sparked, true);
    assert.match(await lab.text('#foe-box'), /雷甲已触发/);
    await lab.reload();
    snap = await lab.snapshot();
    assert.equal(snap.battle.enemies.find(enemy => enemy.id === wolfId).flags.sparked, true,
      'the settled reaction survives a normal reload');
    await lab.click('details.combat-details summary');
    assert.match(await lab.text('#foe-box'), /雷甲已触发/);

    const hpAfterReload = snap.battle.enemies.find(enemy => enemy.id === wolfId).hp;
    await lab.click('[data-basic-attack]');
    snap = await lab.snapshot();
    assert.ok(snap.battle.enemies.find(enemy => enemy.id === wolfId).hp < hpAfterReload,
      'the next punch deals damage after reload');
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});


test('CORE_FIXTURE: a suppressed counter remains disabled across Lab-to-core action conversion', () => {
  const ctx = vm.createContext({});
  for (const name of ['mvp_logic', 'combat_core'])
    vm.runInContext(readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8'), ctx);
  let enemy = { id: 'fixture', rank: 1, hp: 8, hpMax: 8, currentCounter: 'iron',
    counterDisabled: true, suppressed: true, damageReduction: 3 };
  for (let hit = 0; hit < 2; hit += 1) {
    const result = ctx.CombatCore.resolveDirectStrike(ctx.CombatCore.toCoreEnemy(enemy), { damage: 2 });
    assert.equal(result.swallowed, false);
    assert.equal(result.damage, 2);
    enemy = { ...enemy, ...result.enemy };
  }
  assert.equal(enemy.hp, 4);
});
