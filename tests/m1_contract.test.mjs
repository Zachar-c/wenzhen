import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../js/m1_game.js', import.meta.url), 'utf8');
const spec = JSON.parse(fs.readFileSync(new URL('../data/m1_contract.json', import.meta.url), 'utf8'));
function harness(saved=null, meta=null){
  const store=new Map();
  if(saved)store.set('wenzhen_m1_v1',saved);
  if(meta)store.set('wenzhen_m1_meta',meta);
  const elements=new Map(), intervals=[];
  const ctx=vm.createContext({Math,Date,JSON,console,
    confirm:()=>true,setInterval:(fn,ms)=>{intervals.push(ms);return intervals.length},clearInterval:()=>{},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return elements.get(id)}}});
  vm.runInContext(script,ctx);
  return {run:x=>vm.runInContext(x,ctx),store,intervals};
}
const expression=x=>JSON.stringify(x);
function fight(school,round,purchase=false){
  const g=harness();
  g.run('init('+expression(school)+')');
  g.run('state.rng=0x12345678;state.seed=0x12345678;state.round='+round);
  if(purchase){
    // 固定教学第4槽，买入并装备；不引入临时战斗作弊。
    g.run('buy(3);equip(state.gu[state.gu.length-1].id)');
  }
  g.run('startBattle();quick()');
  return JSON.parse(JSON.stringify(g.run('state.lastResult')));
}
test('D2.8 manifest has 8 schools x 3, 3 foes, and agrees with runtime definitions',()=>{
  const g=harness();
  assert.equal(spec.gu.length,24);
  assert.equal(spec.foes.length,3);
  assert.equal(spec.schools.length,8);
  const gu=JSON.parse(JSON.stringify(g.run('GU')));
  assert.deepEqual(gu.map(({id,name,cd,first})=>({id,name:name.replace(/蛊$/u,''),cd,first})),
    spec.gu.map(({id,name,cd,first})=>({id,name,cd,first})));
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('FOES'))),spec.foes.map(({windPeriod,windOnTicks,feintRevealBeforeImpact,...foe})=>foe));
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('SCHOOLS'))),spec.schools);
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('EXTRA'))),spec.firstRunExtraBySchool);
  assert.equal(spec.battle.tickMs,500);
});
test('all 48 comparison runs are deterministic and purchase changes the trace',()=>{
  for(const school of spec.schools)for(let round=1;round<=3;round++){
    const a=fight(school,round,false),b=fight(school,round,true);
    assert.deepEqual(fight(school,round,false),a,school+'/'+round+' base');
    assert.deepEqual(fight(school,round,true),b,school+'/'+round+' buy');
    for(const result of [a,b]){
      assert.equal(result.foe,spec.foes[round-1].name);
      assert.ok(result.tick<=spec.battle.timeoutTick);
      assert.ok(result.log.length>0);
    }
    assert.notDeepEqual(a.log,b.log,school+'/'+round+' purchase should matter');
  }
});
test('first tutorial shelf does not consume RNG; first active refresh does',()=>{
  const g=harness();g.run('init("百兵")');
  assert.equal(g.run('state.rng'),g.run('state.seed||1'));
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('state.shelf.map(x=>x.gu)'))),['B101','B102','B103','T103']);
  g.run('reroll()');
  assert.notEqual(g.run('state.rng'),g.run('state.seed||1'));
  assert.equal(g.run('state.gold'),13);
});
test('physical normal playback uses the agreed 500ms tick',()=>{
  const g=harness();g.run('init("参同");startBattle()');
  assert.deepEqual(g.intervals,[500]);
});
test('same-name fire gu maintain independent dots and cooldowns',()=>{
  const g=harness();
  g.run('init("参同");state.shelf[0].gu="T103";buy(0);equip(state.gu[state.gu.length-1].id);startBattle()');
  g.run('step();step();step()'); // tick 0,1,2
  assert.equal(g.run('battle.states.filter(s=>s.type==="dot").length'),2);
  assert.equal(g.run('new Set(battle.states.filter(s=>s.type==="dot").map(s=>s.source)).size'),2);
  assert.equal(g.run('battle.instances.filter(x=>x.gu==="T103"&&x.ready===10).length'),2);
  g.run('step();step()'); // tick3,4
  assert.equal(g.run('log.filter(x=>x.includes("灼烧")).length'),2);
});
test('observed attack + actual G102 shield absorption schedules G103 next-tick counter',()=>{
  const g=harness();g.run('init("观复");startBattle()');
  for(let i=0;i<=9;i++)g.run('step()');
  assert.equal(g.run('log.some(x=>x.includes("记痕蛊 触发"))'),true);
  assert.equal(g.run('log.some(x=>x.startsWith("[9] 记痕反击"))'),true);
});
test('shield from other gu never triggers G103 on its own',()=>{
  const g=harness();g.run('init("观复");startBattle();battle.instances=battle.instances.filter(x=>x.gu!=="G102")');
  for(let i=0;i<=7;i++)g.run('step()');
  g.run('shield("OTHER:i42",4,10);step();step()');
  assert.equal(g.run('log.some(x=>x.includes("记痕反击"))'),false);
});
test('Z103 consumes bind but preserves initial reduction plus extra 2, then shield 2',()=>{
  const g=harness();g.run('init("执枢");startBattle()');
  g.run('battle.tick=7;battle.instances=battle.instances.filter(x=>x.gu==="Z103");battle.current={name:"模拟斩击",type:"normal",damage:8,windup:2,impact:8,id:"attack-synth",observed:false,evade:0,reduction:0};mark("bind","Z102:sim",8)');
  g.run('step()');
  assert.equal(g.run('battle.current.reduction'),4);
  assert.equal(g.run('has("bind")'),false);
  g.run('step()');
  assert.equal(g.run('battle.hp'),28);
});
test('synthetic interrupt cancels old hit, reschedules at +6 and grants 12-tick immunity',()=>{
 const g=harness();g.run('init("百兵");state.equip=[state.equip[1]];startBattle()');
 for(let i=0;i<=6;i++)g.run('step()');
 const old=g.run('battle.current.id');
 assert.equal(g.run('interrupt("test")'),true);
 assert.equal(g.run('battle.current'),null);
 assert.equal(g.run('battle.nextDeclare'),13);
 assert.equal(g.run('battle.interruptImmuneUntil'),19);
 assert.equal(g.run('battle.shields.filter(s=>s.source.startsWith("B102:")).every(s=>s.until===12)'),true);
 for(let i=7;i<=13;i++)g.run('step()');
 assert.notEqual(g.run('battle.current.id'),old);
 assert.equal(g.run('battle.current.impact'),15);
 assert.equal(g.run('interrupt("test")'),false);
});
test('combat reload only restarts same round and does not mint extra gold or RNG',()=>{
  const a=harness();
  a.run('init("百兵");reroll();startBattle()');
  const saved=a.store.get('wenzhen_m1_v1');
  const b=harness(saved);
  assert.equal(b.run('state.gold'),13);
  assert.equal(b.run('state.round'),1);
  assert.equal(b.run('state.rng'),a.run('state.rng'));
  assert.equal(b.run('battle.foe.id'),'rogue');
  b.run('quick()');
  assert.equal(b.run('state.inBattle'),false);
});
