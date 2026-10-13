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
 assert.equal(g.run('FOES.length'),7);
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
 assert.equal(g.run('GU.length'),29);
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

test('知几蛊 from Library cannot attack on first visible enemy move',()=>{
 const g=session();g.run('init("观复")');
 g.run('state.equip=[];const x=owned("G112");state.gu.push(x);state.equip=[x.id];startBattle()');
 g.run('for(let i=0;i<8;i++)step()');
 assert.equal(g.run('battle.totals.damageBySource["知几蛊"]||0'),0);
});
test('知几蛊 acts after second same declared attack, not fabricated precognition',()=>{
 const g=session();g.run('init("观复")');
 g.run('state.equip=[];const x=owned("G112");state.gu.push(x);state.equip=[x.id];startBattle()');
 g.run('for(let i=0;i<18&&battle;i++)step()');
 const result=g.run('battle?.totals.damageBySource["知几蛊"]||state.lastResult?.stats.damageBySource["知几蛊"]||0');
 assert.ok(result>0);
});
test('M2 research Gu remains nonstarter but is in shop offer population',()=>{
 const g=session();g.run('init("观复")');
 assert.equal(g.run('state.gu.some(x=>x.gu==="G112")'),false);
 assert.equal(g.run('GU.some(x=>x.id==="G112")'),true);
 assert.equal(g.run('GM.G112.school'),'观复');
});

test('知几蛊 does not trigger against alternating sword feints, even after many cycles',()=>{
 const g=session();g.run('init("观复");startBattle();quick();resolveSpoils("claim")');
 assert.equal(g.run('state.round'),2);
 assert.equal(g.run('chooseTarget(2)'),true);
 g.run('state.equip=[];const x=owned("G112");state.gu.push(x);state.equip=[x.id];startBattle()');
 g.run('for(let i=0;i<65&&battle;i++)step()');
 const dmg=g.run('battle?.totals.damageBySource["知几蛊"]||state.lastResult?.stats.damageBySource["知几蛊"]||0');
 assert.equal(dmg,0,'alternating different declared moves must not trigger the repeated-move Gu');
});

test('merchant sourcing pays once for a specific Library Gu and preserves the four-slot economy',()=>{
 const g=session();g.run('init("观复")');
 assert.equal(g.run('seekGu("G112")'),true);
 assert.equal(g.run('state.gold'),11);
 assert.equal(g.run('state.seekUsed'),true);
 assert.equal(g.run('state.shelf.length'),4);
 assert.equal(g.run('state.shelf.filter(x=>x?.gu==="G112"&&x?.seek).length'),1);
 assert.equal(g.run('seekGu("G112")'),false);
 assert.equal(g.run('state.gold'),11);
 g.run('reroll()');
 assert.equal(g.run('state.shelf.filter(x=>x?.gu==="G112"&&x?.seek).length'),1);
 const slot=g.run('state.shelf.findIndex(x=>x?.gu==="G112"&&x?.seek)');
 assert.equal(g.run('buy('+slot+')'),undefined);
 assert.equal(g.run('state.gold'),7);
 assert.equal(g.run('state.gu.some(x=>x.gu==="G112")'),true);
});
test('merchant lead cannot be exploited through invalid IDs, locked offers or insufficient gold',()=>{
 const g=session();g.run('init("百兵")');
 assert.equal(g.run('seekGu("__proto__")'),false);
 assert.equal(g.run('state.gold'),13);
 g.run('state.gold=5');
 assert.equal(g.run('seekGu("G112")'),false);
 assert.equal(g.run('state.gold'),5);
 g.run('state.gold=13;state.shelf.forEach(x=>x.lock=true)');
 assert.equal(g.run('seekGu("G112")'),false);
 assert.equal(g.run('state.seekUsed'),false);
});
test('merchant sourcing survives reload without allowing second commission',()=>{
 const g=session();g.run('init("观复");seekGu("G112")');
 const resumed=session(g.store.get('wenzhen_m2_v1'));
 assert.equal(resumed.run('state.seekUsed'),true);
 assert.equal(resumed.run('seekGu("G112")'),false);
 assert.equal(resumed.run('state.shelf.some(x=>x?.gu==="G112"&&x?.seek)'),true);
});

test('M3 fixed recipe consumes exact two Gu instances, equips result, and is not repeatable',()=>{
 const g=session();g.run('init("百兵")');
 const gold=g.run('state.gold');
 assert.equal(g.run('availableRecipes().length'),1);
 assert.equal(g.run('refineGu("B201")'),true);
 assert.equal(g.run('state.gu.some(x=>x.gu==="B101"||x.gu==="B102")'),false);
 assert.equal(g.run('state.gu.some(x=>x.gu==="B201")'),true);
 assert.equal(g.run('state.equip.some(id=>state.gu.find(x=>x.id===id)?.gu==="B201")'),true);
 assert.equal(g.run('state.gold'),gold);
 assert.equal(g.run('refineGu("B201")'),false);
});
test('M3 crafted Gu cannot be commissioned through merchant or randomly purchased',()=>{
 const g=session();g.run('init("百兵")');
 assert.equal(g.run('seekGu("B201")'),false);
 assert.equal(g.run('state.gold'),13);
 assert.equal(g.run('M3_RECIPES[0].inputs.join(",")'),'B101,B102');
 assert.equal(g.run('state.shelf.some(x=>x.gu==="B201")'),false);
});
test('M3 return strike occurs on a later tick and has a real combat source',()=>{
 const g=session();g.run('init("百兵");refineGu("B201");startBattle()');
 g.run('step();step()');
 assert.equal(g.run('battle.totals.damageBySource["折锋回刺"]||0'),0);
 g.run('for(let n=0;n<8&&battle;n++)step()');
 assert.ok(g.run('battle?.totals.damageBySource["折锋回刺"]||state.lastResult?.stats.damageBySource["折锋回刺"]||0')>0);
});

test('Library G201 重息固定合炼消耗观复观察+防护，仅原有实例一只各一',()=>{
 const g=session();g.run('init("观复")');
 assert.equal(g.run('availableRecipes().some(r=>r.id==="G201")'),true);
 assert.equal(g.run('refineGu("G201")'),true);
 assert.equal(g.run('state.gu.filter(x=>x.gu==="G101"||x.gu==="G102").length'),0);
 assert.equal(g.run('state.gu.filter(x=>x.gu==="G201").length'),1);
 assert.equal(g.run('state.equip.length'),2);
 assert.equal(g.run('seekGu("G201")'),false);
 assert.equal(g.run('refineGu("G201")'),false);
});
test('重息蛊 protects only against a truly repeated revealed enemy move',()=>{
 const a=session();a.run('init("观复");refineGu("G201");startBattle()');
 a.run('for(let i=0;i<9&&battle;i++)step()');
 assert.equal(a.run('log.some(x=>x.includes("重息辨认旧式"))'),false);
 a.run('for(let i=0;i<12&&battle;i++)step()');
 assert.equal(a.run('log.some(x=>x.includes("重息辨认旧式"))'),true);
 const b=session();b.run('init("观复");refineGu("G201");state.round=3;state.targetIndex=2;startBattle()');
 b.run('for(let i=0;i<40&&battle;i++)step()');
 assert.equal(b.run('log.some(x=>x.includes("重息辨认旧式"))'),false,'alternating sword feint sequence may not be anticipated');
});

test('M3-B optional Root Puppet hunt is reachable on final round without adding fake nodes',()=>{
 const g=session();g.run('init("百兵")');
 g.run('state.round=6;render()');
 assert.equal(g.run('HUNTS[5].includes(6)'),true);
 assert.equal(g.run('chooseTarget(6)'),true);
 assert.equal(g.run('targetFoe().id'),'rootling');
 assert.equal(g.run('upcomingSpoils().gu'),'G112');
});
test('M3-B Root Puppet heals real damage periodically, but fire DoT suppresses regeneration',()=>{
 const heal=session();heal.run('init("百兵");state.round=6;state.targetIndex=6;state.equip=[state.gu.find(x=>x.gu==="B102").id];startBattle();battle.foe.hp-=12');
 heal.run('for(let t=0;t<=10;t++)step()');
 assert.equal(heal.run('log.some(x=>x.includes("枯根傀儡再生"))'),true);
 const burn=session();burn.run('init("参同");state.round=6;state.targetIndex=6;state.equip=[state.gu.find(x=>x.gu==="T103").id];startBattle();battle.foe.hp-=12');
 burn.run('for(let t=0;t<=10;t++)step()');
 assert.equal(burn.run('log.some(x=>x.includes("火筹灼烧阻断枯根再生"))'),true);
 assert.equal(burn.run('log.some(x=>x.includes("枯根傀儡再生"))'),false);
});

test('M3 repeated pattern supports existing 记痕蛊 counter only after actual G201 shield absorption',()=>{
 const g=session();g.run('init("观复");refineGu("G201");startBattle()');
 g.run('for(let i=0;i<=18&&battle;i++)step()');
 assert.equal(g.run('log.some(x=>x.includes("记痕反击"))'),true);
 assert.equal(g.run('battle?.totals.absorbedByInstance&&Object.keys(battle.totals.absorbedByInstance).some(x=>x.startsWith("G201:"))'),true);
});

test('M3 G201+G103 synergy remains visible after two original Gu are consumed',()=>{
 const g=session();g.run('init("观复");refineGu("G201")');
 assert.equal(g.run('synergyFor(equippedGu()).includes("重息→记痕：重复招式格挡成功后反击")'),true);
 assert.equal(g.run('synergyFor(equippedGu()).some(x=>x.includes("辨兆→听息"))'),false);
});
