import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
function session(saved){
 const store=new Map(saved?[['wenzhen_m2_v1',saved]]:[]),dom=new Map();
 const context=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return dom.get(id)}}});
 vm.runInContext(script,context);return {run:s=>vm.runInContext(s,context),store,dom};
}
const schools=['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复'];
test('M2 is separate from M1 with six opponents and two acts',()=>{
 const g=session();g.run('init("百兵")');
 assert.equal(g.run('FOES.length'),6);
 assert.equal(g.run('TOTAL_ROUNDS'),6);
 assert.equal(g.run('state.gold'),13);
 assert.equal(g.store.has('wenzhen_m1_v1'),false);
 assert.equal(g.run('FOES[3].id'),'bandit');
 assert.equal(g.run('FOES[4].id'),'shadow');
 assert.equal(g.run('FOES[5].id'),'warden');
});
test('eight schools can run the full six-fight loop without runtime failure',()=>{
 for(const school of schools){
  const g=session();g.run('init('+JSON.stringify(school)+')');
  for(let round=1;round<=6;round++){
   assert.equal(g.run('state.round'),round,school+' entering '+round);
   g.run('startBattle();quick()');
   if(g.run('state.pendingSpoils'))g.run('resolveSpoils("claim")');
   assert.equal(g.run('state.lastResult.tick<=120'),true,school+'/'+round);
   assert.equal(g.run('state.lastResult.log.length>0'),true);
   if(round<6)assert.equal(g.run('state.completed'),false);
  }
  assert.equal(g.run('state.completed'),true,school);
  assert.equal(g.run('state.round'),6);
 }
});
test('chapter two preparation persists without duplicated reward on reload',()=>{
 const g=session();g.run('init("百兵")');for(let i=0;i<3;i++)g.run('startBattle();quick();if(state.pendingSpoils)resolveSpoils("claim")');
 assert.equal(g.run('state.round'),4);
 const gold=g.run('state.gold'),rng=g.run('state.rng'),saved=g.store.get('wenzhen_m2_v1');
 const b=session(saved);assert.equal(b.run('state.round'),4);
 assert.equal(b.run('state.gold'),gold);assert.equal(b.run('state.rng'),rng);
 assert.match(b.dom.get('app').innerHTML,/第二幕/);
});
test('M1 remains a separate unmodified entry and storage key',()=>{
 const m1=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
 assert.match(m1,/wenzhen_m1_v1/);
 assert.doesNotMatch(m1,/TOTAL_ROUNDS=6/);
 assert.match(fs.readFileSync(new URL('../m1.html',import.meta.url),'utf8'),/js\/m1_game.js/);
 assert.match(fs.readFileSync(new URL('../m2.html',import.meta.url),'utf8'),/js\/m2_game.js/);
});

test('enemy-sourced spoil must be claimed and never gives free 3-card selection',()=>{
 const g=session();g.run('init("百兵")');
 assert.match(g.dom.get('app').innerHTML,/可追夺的蛊/);
 g.run('startBattle();quick()');
 assert.equal(g.run('state.round'),1);
 assert.equal(g.run('state.pendingSpoils.gu'),'B101');
 assert.equal(g.run('resolveSpoils("claim")'),true);
 assert.equal(g.run('state.gu.length'),4);
 assert.equal(g.run('state.round'),2);
 assert.equal(g.run('resolveSpoils("claim")'),false);
});
test('spoil disposition is one-time and selling only grants gold',()=>{
 const g=session();g.run('init("百兵");startBattle();quick()');
 assert.equal(g.run('resolveSpoils("sell")'),true);
 assert.equal(g.run('state.gu.length'),3);
 assert.equal(g.run('state.gold'),20);
 assert.equal(g.run('resolveSpoils("sell")'),false);
});
test('when Gu storage is full, taking a spoil requires one chosen exchange',()=>{
 const g=session();g.run('init("百兵")');
 g.run('while(state.gu.length<12)state.gu.push(owned("B101"));startBattle();quick()');
 const second=session(g.store.get('wenzhen_m2_v1'));
 assert.equal(second.run('state.pendingSpoils.gu'),'B101');
 assert.match(second.dom.get('app').innerHTML,/蛊仓已满/);
 assert.equal(second.run('resolveSpoils("claim")'),false);
 const old=second.run('state.gu[0].id');
 assert.equal(second.run('resolveSpoils("claim",state.gu[0].id)'),true);
 assert.equal(second.run('state.gu.length'),12);
 assert.equal(second.run('state.equip.includes('+JSON.stringify(old)+')'),false);
});

test('informed hunt changes foe, acquisition and persists across reload',()=>{
 const g=session();g.run('init("百兵")');
 assert.match(g.dom.get('app').innerHTML,/本轮追猎/);
 assert.equal(g.run('chooseTarget(1)'),true);
 assert.equal(g.run('state.targetIndex'),1);
 assert.equal(g.run('targetFoe().id'),'boar');
 assert.equal(g.run('upcomingSpoils().gu'),'S102');
 const resumed=session(g.store.get('wenzhen_m2_v1'));
 assert.equal(resumed.run('state.targetIndex'),1);
 resumed.run('startBattle()');
 assert.equal(resumed.run('battle.foe.id'),'boar');
 assert.equal(resumed.run('chooseTarget(0)'),false);
 resumed.run('quick()');
 if(resumed.run('state.pendingSpoils'))assert.equal(resumed.run('state.pendingSpoils.gu'),'S102');
});
test('route selection rejects inaccessible foes, unresolved rewards and extra payouts',()=>{
 const g=session();g.run('init("百兵")');
 assert.equal(g.run('chooseTarget(5)'),false);
 assert.equal(g.run('state.round'),1);
 assert.equal(g.run('chooseTarget(1)'),true);
 const gold=g.run('state.gold');
 assert.equal(g.run('chooseTarget(1)'),true);
 assert.equal(g.run('state.gold'),gold);
 g.run('startBattle();quick()');
 if(g.run('state.pendingSpoils'))assert.equal(g.run('chooseTarget(0)'),false);
});

test('claimed Gu can replace one equipped slot immediately without destroying old Gu',()=>{
 const g=session();g.run('init("玄牝");startBattle();quick()');
 const former=g.run('state.equip[0]'),before=g.run('state.gu.length');
 assert.equal(g.run('resolveSpoils("claim",null,state.equip[0])'),true);
 assert.equal(g.run('state.gu.length'),before+1);
 assert.equal(g.run('state.gu.some(x=>x.id==='+JSON.stringify('')+'+state.equip[0])'),true);
 assert.equal(g.run('state.equip.includes('+JSON.stringify(former)+')'),false);
 assert.equal(g.run('state.gu.some(x=>x.id==='+JSON.stringify(former)+')'),true);
 assert.equal(g.run('state.equip.length'),3);
});
test('invalid slot swap never grants a free Gu or advances round',()=>{
 const g=session();g.run('init("百兵");startBattle();quick()');
 const gold=g.run('state.gold'),length=g.run('state.gu.length');
 assert.equal(g.run('resolveSpoils("claim",null,"unknown")'),false);
 assert.equal(g.run('state.gu.length'),length);
 assert.equal(g.run('state.gold'),gold);
 assert.equal(g.run('state.round'),1);
 assert.equal(g.run('state.pendingSpoils.gu'),'B101');
});

test('M2 new Gu are not starter Gu and have sourced acquisition',()=>{
 const g=session();g.run('init("百兵")');
 assert.equal(g.run('GU.length'),26);
 assert.equal(g.run('state.gu.some(x=>x.gu==="N201"||x.gu==="N202")'),false);
 assert.equal(g.run('ENEMY_SPOILS[4].gu'),'N201');
 assert.equal(g.run('ENEMY_SPOILS[5].gu'),'N202');
});
test('裂势 attacks only when enemy has announced its windup',()=>{
 const g=session();g.run('init("百兵")');
 g.run('state.equip=[];const x=owned("N201");state.gu.push(x);state.equip=[x.id];startBattle()');
 g.run('step()');
 assert.equal(g.run('battle.totals.damageBySource["裂势蛊"]||0'),0);
 g.run('for(let i=0;i<7;i++)step()');
 assert.ok(g.run('battle.totals.damageBySource["裂势蛊"]||0')>0);
});
test('饮锋 counters only on actual incoming HP damage',()=>{
 const g=session();g.run('init("百兵")');
 g.run('state.equip=[];const x=owned("N202");state.gu.push(x);state.equip=[x.id];startBattle()');
 g.run('for(let i=0;i<10;i++)step()');
 assert.ok(g.run('battle.totals.damageTaken')>0);
 assert.ok(g.run('battle.totals.damageBySource["饮锋反击"]||0')>0);
});
