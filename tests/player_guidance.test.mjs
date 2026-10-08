import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('player guidance follows real pairings and recorded defeat causes without inventing results', () => {
  const read = name => readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(['data', 'run_rules', 'human_rules', 'gu_rules', 'describe'].map(read).join('\n')
    + '\nconst GU_BY_ID = Object.fromEntries(DATA.gu.map(gu => [gu.id, gu]));', context);
  const hint = (id, owned = {}) => vm.runInContext(`guPairingText(GU_BY_ID[${JSON.stringify(id)}], ${JSON.stringify(owned)})`, context);
  assert.match(hint('moonlight_gu', { small_light_gu: 1 }), /已持有的小光蛊[\s\S]*分别支付真元与操控/);
  assert.match(hint('small_light_gu'), /需要配合月光蛊[\s\S]*不能增幅其他攻击蛊/);
  assert.equal(hint('moon_glow_gu', { small_light_gu: 1 }), '', 'Small Light is not advertised as a Moon Glow support');
  assert.match(hint('blood_atk_3_11_gu', { small_light_gu: 1 }), /造成伤害[\s\S]*不会造伤[\s\S]*不能增幅血月/);
  assert.match(hint('white_boar_strength_gu'), /仍需实际锻体/);
  assert.match(hint('force_atk_4_02_gu'), /回血后增力回落/);
  assert.match(hint('force_heal_3_03_gu'), /石臂重量不计入疗效/);
  assert.equal(vm.runInContext(`GuRules.effectPlan(GU_BY_ID.force_heal_3_03_gu.effect, {strengthBonus: 3}).heal`, context), 4);

  const journey = read('journey');
  vm.runInContext(journey.slice(journey.indexOf('function endingReviewLines('), journey.indexOf('function renderEnding(')), context);
  const review = ending => { context.ending = ending; return context.endingReviewLines(ending).join(' / '); };
  assert.match(review({ outcome: 'defeat', title: '异闻代价耗尽魂魄' }), /养魂[\s\S]*赶路魂魄代价/);
  assert.match(review({ outcome: 'defeat', deathReport: { cause: 'life_cost' } }), /寿元不足/);
  assert.match(review({ outcome: 'defeat', deathReport: { cause: 'info_tax' } }), /规则反噬[\s\S]*先观察/);
  const blood = review({ outcome: 'defeat', title: '气血耗尽', deathReport: {
    cause: 'blood', lastResourceBlow: { resource: 'soul' }, lastCounter: { label: '拳脚' },
  } });
  assert.match(blood, /当前气血[\s\S]*记录过攻击被反击吞掉/);
  assert.doesNotMatch(blood, /下局先留元石在坊市养魂/, 'an earlier soul hit does not become the final defeat cause');
  assert.match(review({ outcome: 'victory' }), /库存不代表/);
  assert.match(review({ outcome: 'retreat' }), /主动止步/);
  assert.equal(review({ outcome: 'unknown' }), '');

  const main = read('main');
  vm.runInContext(main.slice(main.indexOf('function buildDeathReport('), main.indexOf('function openBattleOutcome(')), context);
  assert.equal(context.buildDeathReport({ deathCause: 'info_tax', log: [] }).cause, 'info_tax');
  assert.equal(context.buildDeathReport({ log: [] }).cause, 'blood');
});

test('human intent preview distinguishes paid healing, approach and delayed punches from actual settlement', () => {
  const read = name => readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
  const c = vm.createContext({ recordEvent() {}, receivePlayerHit: (_b, damage) => ({damage, absorbed: 0}),
    BattleFx: { selfDamage() {}, shieldHit() {} } });
  vm.runInContext(['data', 'run_rules', 'human_rules', 'gu_rules', 'describe'].map(read).join('\n')
    + '\nconst GU_BY_ID = Object.fromEntries(DATA.gu.map(gu => [gu.id, gu]));', c);
  const main = read('main');
  vm.runInContext(main.slice(main.indexOf('function enemyNeedsApproach('), main.indexOf('function currentCombatRoster(')), c);
  vm.runInContext(main.slice(main.indexOf('function startMaintainedGu('), main.indexOf('function refreshHumanControl(')), c);
  vm.runInContext(main.slice(main.indexOf('function pluginHumanPlan('), main.indexOf('// 敌方回合 +')), c);
  vm.runInContext(`globalThis.state={blood:10,battle:{turn:3}};
    globalThis.b={turn:3,nodeId:'fight',log:[],block:0};
    globalThis.enemy={id:'medic',name:'蛊师',hp:5,hpMax:10,distanceMeters:0,statuses:{bleeding:2},
      human:HumanRules.actor({id:'medic',rank:4,guInstances:[HumanRules.guInstance('force_heal_3_03_gu',1),HumanRules.guInstance('stone_shell_gu',1)]})};
    enemy.plannedAction={kind:'gu',guId:'force_heal_3_03_gu',guInstanceId:'force_heal_3_03_gu::1',label:'自力更生蛊'};`, c);
  const preview = () => c.rangedIntentText(c.enemy);
  assert.match(preview(), /预计恢复气血 1 并止血[\s\S]*真元 3 · 操控 1[\s\S]*本回合不攻击/);
  const essence = c.enemy.human.essence;
  c.resolvePluginHumanTurn(c.b, c.enemy);
  assert.equal(c.enemy.hp, 6);
  assert.equal(c.enemy.human.essence, essence - 3);
  assert.equal(c.enemy.statuses.bleeding, undefined);
  assert.equal(c.state.blood, 10);
  c.enemy.human.guInstances[0].sealed = true;
  c.enemy.distanceMeters = 20;
  assert.match(preview(), /失效 · 逼近 10 米 · 本回合不攻击/);
  c.resolvePluginHumanTurn(c.b, c.enemy);
  assert.equal(c.enemy.distanceMeters, 10);
  assert.equal(c.state.blood, 10);
  vm.runInContext(`enemy.distanceMeters=0;
    enemy.plannedAction={kind:'gu',guId:'stone_shell_gu',guInstanceId:'stone_shell_gu::1',label:'石皮蛊'};`, c);
  assert.match(preview(), /催动 石皮蛊[\s\S]*本回合不攻击/);
  c.resolvePluginHumanTurn(c.b, c.enemy);
  c.enemy.plannedAction = {kind:'basic_attack'};
  assert.match(preview(), /第 4 回合落下 · 本回合不造成拳脚伤害/);
  c.resolvePluginHumanTurn(c.b, c.enemy);
  assert.equal(c.state.blood, 10, 'forming the delayed punch causes no immediate damage');
  c.b.turn = c.state.battle.turn = 4;
  assert.match(preview(), /拳脚 · 伤 4 · 本回合落下/);
  c.resolvePluginHumanTurn(c.b, c.enemy);
  assert.equal(c.state.blood, 6, 'the warned punch really lands for four damage');
  assert.equal(c.b.lastBlow.bloodBefore, 10);
  assert.equal(c.b.lastBlow.damage, 4);
});
