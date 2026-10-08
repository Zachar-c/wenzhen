import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('first release keeps a useful ranked roster, closed acquisition pools and no retired systems', () => {
  const c = vm.createContext({});
  vm.runInContext(`${read('js/data.js')}\n${read('js/run_rules.js')}\n${read('js/human_rules.js')}\n${read('js/gu_rules.js')}\n${read('js/loot_rules.js')}\n${read('js/shop_rules.js')}\n${read('js/node_action_rules.js')}\nglobalThis.api={DATA,GuRules,NodeActionRules,LootRules,ShopRules};`, c);
  const {DATA:d,GuRules:g,NodeActionRules:n} = c.api;
  assert.equal(d.gu.length,20); assert.equal(d.gu.filter(x=>!x.labOnly).length,19);
  assert.equal(d.recipes.length,0); assert.equal(d.killMoves.length,0); assert.equal(d.killMovesEnabled,false);
  const ids=new Set(d.releaseGuIds);
  for (const gu of d.gu) { assert.ok(gu.rank>=1&&gu.rank<=5); assert.ok(gu.battleEffect||gu.effect?.kind); }
  for (const offer of d.shopOffers.filter(x=>x.gu_id)) assert.ok(ids.has(offer.gu_id));
  for (const table of Object.values(d.loot.tables)) for (const id of Object.values(table.gu_pool.by_rarity).flat()) assert.ok(ids.has(id));
  const byId=Object.fromEntries(d.gu.map(gu=>[gu.id,gu]));
  vm.runInContext(read('js/describe.js'),c);
  for (const clue of new Set(d.enemies.flatMap(enemy=>enemy.clues || []))) {
    assert.notEqual(vm.runInContext(`clueLabel(${JSON.stringify(clue)})`,c),clue,'release clues have readable labels');
  }
  const evasive=d.enemies.find(enemy=>enemy.id==='kuangdian_wolf');
  for (const id of ['moonlight_gu','moon_ray_gu','moon_glow_gu']) {
    const effect=byId[id].battleEffect;
    assert.match(c.effectText(effect),/无视闪避/);
    const plan=g.effectPlan(effect);
    assert.equal(g.resolveProblemHit(evasive,plan,plan.damage).damage,plan.damage);
  }
  assert.ok(!c.effectText({kind:'strike',amount:3}).includes('无视闪避'));
  for (let layer=1;layer<=5;layer++) {
    const table=c.api.LootRules.layerTable(d.loot.tables,d.loot.pacingLayers,'boss',layer,byId);
    for (const id of Object.values(table.gu_pool.by_rarity).flat()) assert.ok(byId[id].rank<=Math.min(5,layer+1));
    assert.ok(c.api.ShopRules.stock(d.shopOffers,{seed:3,nodeKey:`segment-${layer}`,pacingLayers:d.loot.pacingLayers,layer,school:d.loot.school,reservedGuIds:[d.flow.aptitudeGuId]}).length);
  }
  const unknown=c.api.LootRules.rollGuChoices({gu_chance_pct:100,gu_pool:{weights:{common:100},by_rarity:{common:['moonlight_gu','retired_gu']}}},
    {seed:1,tick:1,tier:'common',guById:{moonlight_gu:byId.moonlight_gu},supportPool:['retired_gu'],choiceCount:3});
  assert.deepEqual([...unknown.guIds],['moonlight_gu']);
  const blood=d.gu.find(x=>x.id==='blood_atk_3_11_gu');
  assert.equal(blood.rank,3); assert.ok(d.shopOffers.some(o=>o.gu_id===blood.id && o.kind==='purchase'));
  const bloodPlan=g.effectPlan(blood.battleEffect);
  assert.equal(bloodPlan.damage,3); assert.equal(bloodPlan.bleeding,2);
  assert.ok(c.api.ShopRules.offerIsStocked(d.shopOffers,'soul_pill',{seed:3,nodeKey:'L1B',pacingLayers:d.loot.pacingLayers,layer:1,school:d.loot.school}),'paid soul preparation must be offered before segment two');
  const self=d.gu.find(x=>x.id==='force_heal_3_03_gu');
  assert.equal(g.effectPlan(self.battleEffect,{strengthBonus:3}).heal,4);
  assert.equal(g.activationReason({...self,effect:self.battleEffect},{health:10,healthMax:10}),'health_full');
  for (const id of ['huajiu_cache','sealed_silk_reliquary']) {
    const e=d.events.find(x=>x.id===id); assert.ok(ids.has(e.gu_reward_id));
    const accepted=n.resolveEvent('accept_event',e,{health:10,stones:0});
    assert.ok(accepted.accepted); assert.ok(accepted.text.includes(e.gu_reward_name));
    assert.equal(n.resolveEvent('leave',e,{health:10,stones:0}).accepted,false);
  }
  const main=read('js/main.js');
  vm.runInContext(`${main.slice(main.indexOf('function resumePage('),main.indexOf('function continueRun('))}
    globalThis.state={journey:{started:true},ending:{outcome:'victory'},battle:{over:'胜'}};`,c);
  assert.equal(vm.runInContext('resumePage()',c),'ending','finished runs restore their result instead of a completed battle/map');
  const loot=main.slice(main.indexOf('function rollVictoryLoot('),main.indexOf('function ',main.indexOf('function rollVictoryLoot(')+15));
  assert.ok(loot.includes('guById: releaseGuById')); assert.ok(!loot.includes('guById: GU_BY_ID'));
  // Exercise the actual acquisition handler, including its resolved-node guard.
  const start=main.indexOf('  resolveNodeAction(choiceId) {');
  const end=main.indexOf('  resolveRestAction(choiceId) {',start);
  vm.runInContext(`globalThis.assertRunMutable=()=>true; globalThis.Sfx={success(){}};
    globalThis.toast=()=>{}; globalThis.recordEvent=()=>{};
    globalThis.state={owned:{},blood:10,stones:10,qi:4,qiMax:4,journal:[],knownFacts:[],prepFor:null};
    globalThis.node={id:'cache',type:'event',name:'遗藏',event:DATA.events.find(x=>x.id==='huajiu_cache')};
    globalThis.currentNode=()=>node; globalThis.NODE_ACTION_TYPES=NodeActionRules.nodeTypes;
    globalThis.currentTravelSupplies=()=>({ok:true,cost:3,stones:state.stones-3,bought:['生机叶 ×1']});
    globalThis.act={${main.slice(start,end)} openPrep(){state.prepFor=node.id;}};`,c);
  vm.runInContext(`act.resolveNodeAction('leave');`,c);
  assert.equal(c.state.owned.moon_glow_gu,undefined);
  vm.runInContext(`state.prepFor=null;act.resolveNodeAction('accept_event');act.resolveNodeAction('accept_event');`,c);
  assert.equal(c.state.owned.moon_glow_gu,1); assert.equal(c.state.blood,8);
  vm.runInContext(`state.prepFor=null;node={id:'market',type:'market',name:'市集',choices:['trade']};act.resolveNodeAction('trade');`,c);
  assert.equal(c.state.owned.vitality_leaf_gu,1); assert.equal(c.state.stones,12);
  const applyStart=main.indexOf('function applyEffectPlan(');
  const applyEnd=main.indexOf('function scheduleEffect(',applyStart);
  vm.runInContext(`globalThis.BattleFx={damage(){},pulse(){},countered(){}};globalThis.resolveProblemHit=(b,e,p)=>({damage:p.damage});${main.slice(applyStart,applyEnd)}
    globalThis.foe={id:'test',name:'敌手',hp:20,statuses:{}};
    globalThis.battle={log:[],turn:1};`,c);
  c.plan=bloodPlan;
  vm.runInContext(`applyEffectPlan(battle,foe,plan,'血月蛊');applyEffectPlan(battle,foe,plan,'血月蛊');applyEffectPlan(battle,foe,plan,'血月蛊');`,c);
  assert.equal(c.foe.statuses.bleeding,4);
  vm.runInContext(`globalThis.CombatCore={toCoreEnemy:e=>e,resolveDirectStrike:e=>({enemy:e,swallowed:true})};foe.statuses={};applyEffectPlan(battle,foe,plan,'血月蛊');`,c);
  assert.equal(c.foe.statuses.bleeding,undefined,'swallowed attack causes no wound');
  const turnStart=main.indexOf('function enemyTurn(b) {');
  const phaseStart=main.indexOf('  for (const enemy of aliveEnemies(b)) {',turnStart+35);
  const turnPrefix=main.slice(turnStart,phaseStart);
  vm.runInContext(`globalThis.aliveEnemies=b=>b.enemies.filter(e=>e.hp>0);
    globalThis.tickBlood=function(b){${turnPrefix.slice(turnPrefix.indexOf('{')+1)}return false;};
    battle.enemies=[{id:'wounded',name:'敌手',hp:2,statuses:{bleeding:4}}];tickBlood(battle);`,c);
  assert.equal(c.battle.enemies[0].hp,0); assert.equal(c.battle.over,'胜');
  // The real actor planner and caster must pay, heal themselves and stop a blood wound.
  const plannerStart=main.indexOf('function pluginHumanPlan(');
  const plannerEnd=main.indexOf('// 敌方回合 +',plannerStart);
  c.GU_BY_ID=byId;
  vm.runInContext(`${main.slice(plannerStart,plannerEnd)}
    globalThis.enemy={id:'medic',name:'力道蛊师',hp:5,hpMax:10,statuses:{bleeding:4},distanceMeters:0,
      human:HumanRules.actor({id:'medic',rank:4,guInstances:[HumanRules.guInstance('force_heal_3_03_gu',1)]})};
    globalThis.healBattle={nodeId:'battle',turn:2,block:0,log:[]};
    enemy.human.essence=10;enemy.human.thought=3;
    enemy.plannedAction=pluginHumanPlan(healBattle,enemy);resolvePluginHumanTurn(healBattle,enemy);`,c);
  assert.equal(c.enemy.plannedAction.guId,self.id);
  assert.equal(c.enemy.hp,6); assert.equal(c.enemy.human.essence,7); assert.equal(c.enemy.human.thought,2);
  assert.equal(c.enemy.statuses.bleeding,undefined);
  assert.ok(c.healBattle.log.join(' ').includes('止血'));
  vm.runInContext(`enemy.human.essence=2;enemy.statuses.bleeding=4;`,c);
  assert.equal(vm.runInContext(`pluginHumanPlan(healBattle,enemy).kind`,c),'basic_attack','unaffordable healing cannot be planned');
  vm.runInContext(`enemy.human.essence=10;enemy.human.guInstances[0].sealed=true;enemy.distanceMeters=20;
    resolvePluginHumanTurn(healBattle,enemy);`,c);
  assert.equal(c.enemy.hp,6); assert.equal(c.enemy.statuses.bleeding,4); assert.equal(c.enemy.human.essence,10);
  assert.equal(c.enemy.distanceMeters,10,'failed self-healing must not become a ranged fist attack');
  vm.runInContext(`enemy.human.guInstances[0].sealed=false;enemy.distanceMeters=0;enemy.grade='cultivator';enemy.rank=3;enemy.human.rank=3;
    globalThis.guReasonLabel=x=>x;globalThis.intentText=x=>x?.label||'';
    ${main.slice(main.indexOf('function enemyNeedsApproach('),main.indexOf('function currentCombatRoster('))}
    applyEffectPlan(healBattle,enemy,GuRules.effectPlan(GU_BY_ID.moon_shadow_gu.battleEffect,{target:enemy}),'月影蛊');`,c);
  assert.equal(c.enemy.human.essence,0);
  assert.ok(vm.runInContext(`rangedIntentText(enemy)`,c).includes('失效 · 改为拳脚'));
  vm.runInContext(`enemy.distanceMeters=20;`,c);
  assert.ok(vm.runInContext(`rangedIntentText(enemy)`,c).includes('逼近 10 米 · 本回合不攻击'));
  // Self-reliance reads strength before healing; stone weight is not personal strength.
  vm.runInContext(`enemy.distanceMeters=0;enemy.rank=4;enemy.human.rank=4;delete enemy.essenceSuppressionPct;
    enemy.hp=5;enemy.human.essence=12;enemy.human.thought=3;
    enemy.human.guInstances.push(HumanRules.guInstance('force_atk_4_02_gu',1),HumanRules.guInstance('stone_shell_gu',1));
    HumanRules.addModifier(enemy.human,{attribute:'attack',amount:3,persistence:'session_permanent',
      sourceGuDefinitionId:'white_boar_strength_gu',sourceGuInstanceId:'white_boar_strength_gu::1',sourceEffectId:'body_training'});
    HumanRules.startMaintained(enemy.human,'stone_shell_gu::1',{startCost:1,upkeepCost:0,
      modifiers:[{attribute:'attack',amount:1,sourceEffectId:'stone_arms_weight'}]});`,c);
  assert.equal(vm.runInContext(`HumanRules.basicStrikePlan(enemy.human,{hp:enemy.hp,hpMax:enemy.hpMax}).personalStrength`,c),6);
  vm.runInContext(`HumanRules.startMaintained(enemy.human,'force_atk_4_02_gu::1',{startCost:2,upkeepCost:0,
    modifiers:[{attribute:'attack',amount:0,sourceEffectId:'injury_strength'}]});`,c);
  assert.equal(vm.runInContext(`HumanRules.basicStrikePlan(enemy.human,{hp:enemy.hp,hpMax:enemy.hpMax}).personalStrength`,c),9);
  vm.runInContext(`enemy.plannedAction=pluginHumanPlan(healBattle,enemy);resolvePluginHumanTurn(healBattle,enemy);`,c);
  assert.equal(c.enemy.hp,10); assert.equal(c.enemy.human.essence,6);
  assert.equal(vm.runInContext(`HumanRules.basicStrikePlan(enemy.human,{hp:enemy.hp,hpMax:enemy.hpMax}).personalStrength`,c),6);
  const healingStart=main.indexOf('  healSelf(guId) {');
  vm.runInContext(`${main.slice(main.indexOf('function selfHealingPreview('),main.indexOf('function leafProductionPreview('))}
    globalThis.draw=()=>{};
    state={page:'prep',prepFor:'rest',journey:{nodeId:'rest'},owned:{force_heal_3_03_gu:1},
      cultivation:3,qi:6,thoughtMax:3,blood:3,bloodMax:10,journal:[],modifierLedger:enemy.human.modifierLedger};
    act={${main.slice(healingStart,main.indexOf('  trainBody(guId) {',healingStart))}};`,c);
  assert.equal(vm.runInContext(`selfHealingPreview(GU_BY_ID.force_heal_3_03_gu).healed`,c),4,'out of battle, only permanent strength remains');
  vm.runInContext(`act.healSelf('force_heal_3_03_gu');`,c);
  assert.equal(c.state.blood,7); assert.equal(c.state.qi,3); assert.equal(c.state.owned.force_heal_3_03_gu,1);
  vm.runInContext(`act.healSelf('force_heal_3_03_gu');act.healSelf('force_heal_3_03_gu');`,c);
  assert.equal(c.state.blood,10); assert.equal(c.state.qi,0,'full-health repeat must not charge');
  vm.runInContext(`state.blood=5;`,c);
  assert.equal(vm.runInContext(`selfHealingPreview(GU_BY_ID.force_heal_3_03_gu).reason`,c),'insufficient_true_qi');
  vm.runInContext(`state.qi=6;state.cultivation=2;`,c);
  assert.equal(vm.runInContext(`selfHealingPreview(GU_BY_ID.force_heal_3_03_gu).reason`,c),'insufficient_qi_quality');
  vm.runInContext(`state.cultivation=3;state.page='map';act.healSelf('force_heal_3_03_gu');`,c);
  assert.equal(c.state.blood,5); assert.equal(c.state.qi,6);
  vm.runInContext(`state.page='prep';delete state.owned.force_heal_3_03_gu;act.healSelf('force_heal_3_03_gu');`,c);
  assert.equal(c.state.blood,5); assert.equal(c.state.qi,6);
  const html=read('lab.html'); assert.ok(!/src="js\/(alchemy|killmove)\.js"/.test(html));
});

