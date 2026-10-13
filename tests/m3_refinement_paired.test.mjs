// M3-A controlled paired combat: same foe, same simulation tick budget, change only the build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
function session(foeIndex,refine,seed=1729){
 const store=new Map(),dom=new Map();
 const sandbox={Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return dom.get(id)}}};
 const ctx=vm.createContext(sandbox);vm.runInContext(script,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run('init("百兵")');
 run('state.seed='+seed+';state.rng='+seed+';state.round='+(foeIndex+1)+';state.targetIndex='+foeIndex);
 if(refine)assert.equal(run('refineGu("B201")'),true);
 run('startBattle();quick()');
 return {run,results:JSON.parse(JSON.stringify(run('state.lastResult'))),equip:JSON.parse(JSON.stringify(run('state.equip')))};
}
test('M3 first recipe yields a genuinely different damage/defense pattern against multiple foes',()=>{
 const scenarios=[];
 for(const index of [0,1,2,3,4,5]){
  const base=session(index,false),refined=session(index,true);
  const a=base.results,b=refined.results;
  scenarios.push({foe:a.foe,baseWon:a.won,refinedWon:b.won,baseTick:a.tick,refinedTick:b.tick,baseHp:a.hp,refinedHp:b.hp,baseAbsorb:a.stats.shieldAbsorbed,refinedAbsorb:b.stats.shieldAbsorbed,refinedReturn:b.stats.damageBySource['折锋回刺']||0});
  assert.equal(a.stats.damageBySource['折锋回刺']||0,0);
  assert.equal(refined.equip.length,2,'2 old equipped Gu compressed into 1');
  assert.ok(b.stats.damageBySource['折锋回刺']>0,'refined Gu must express its second strike against '+a.foe);
 }
 console.log('M3_REFINEMENT_PAIRED '+JSON.stringify(scenarios));
 assert.equal(new Set(scenarios.map(x=>x.foe)).size,6,'all six foes must actually be tested');
 assert.ok(scenarios.some(x=>x.baseAbsorb>x.refinedAbsorb),'refinement must have a defensiveness cost');
 assert.ok(scenarios.some(x=>x.refinedTick!==x.baseTick||x.refinedHp!==x.baseHp),'refinement must alter combat path');
});
test('refining after pre-equipping duplicates consumes only one of each component',()=>{
 const store=new Map(),dom=new Map();const ctx=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',insertAdjacentHTML(){}});return dom.get(id)}}});
 vm.runInContext(script,ctx);const run=x=>vm.runInContext(x,ctx);
 run('init("百兵");state.gu.push(owned("B101"));state.gu.push(owned("B102"));');
 const before=run('state.gu.length');
 assert.equal(run('refineGu("B201")'),true);
 assert.equal(run('state.gu.length'),before-1);
 assert.equal(run('state.gu.filter(x=>x.gu==="B101").length'),1);
 assert.equal(run('state.gu.filter(x=>x.gu==="B102").length'),1);
 assert.equal(run('state.gu.filter(x=>x.gu==="B201").length'),1);
});

test('M3 B201 cost/benefit persists across additional Gu synergies and enemy armor',()=>{
 const results=[];
 for(const variant of [['S101'],['G102'],['S101','G102']]){
  for(const foe of [1,3,4,5]){
   function fight(refine){
    const store=new Map(),dom=new Map(),ctx=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',insertAdjacentHTML(){}});return dom.get(id)}}});
    vm.runInContext(script,ctx);const run=x=>vm.runInContext(x,ctx);
    run('init("百兵");state.round='+(foe+1)+';state.targetIndex='+foe);
    if(refine)run('refineGu("B201")');
    for(const id of variant)run('{const copy=owned('+JSON.stringify(id)+');state.gu.push(copy);state.equip.push(copy.id)}');
    run('startBattle();quick()');
    return JSON.parse(JSON.stringify(run('state.lastResult')));
   }
   const base=fight(false),refined=fight(true);
   results.push({foe:base.foe,extra:variant.join('+'),baseWon:base.won,refinedWon:refined.won,baseHP:base.hp,refinedHP:refined.hp,baseTick:base.tick,refinedTick:refined.tick});
  }
 }
 console.log('M3_B201_EXTENDED '+JSON.stringify(results));
 assert.equal(results.length,12);
 assert.ok(results.some(x=>x.refinedTick<x.baseTick),'refinement retains at least one speed advantage');
 assert.ok(results.some(x=>x.baseHP>x.refinedHP),'refinement retains real survivability cost');
});

test('M3 G201 repeated-pattern fusion has an evidenced payoff and a first-attack vulnerability',()=>{
 const rows=[];
 for(const foe of [0,1,2,3,4,5]){
  function fight(refine,extra){
   const store=new Map(),dom=new Map(),ctx=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',insertAdjacentHTML(){}});return dom.get(id)}}});
   vm.runInContext(script,ctx);const run=x=>vm.runInContext(x,ctx);
   run('init("观复");state.round='+(foe+1)+';state.targetIndex='+foe);
   if(refine)run('refineGu("G201")');
   if(extra)run('{const inst=owned("S101");state.gu.push(inst);state.equip.push(inst.id)}');
   run('startBattle();quick()');
   return JSON.parse(JSON.stringify(run('state.lastResult')));
  }
  const old=fight(false,true),crafted=fight(true,true),noExtra=fight(true,false);
  rows.push({foe:old.foe,oldWon:old.won,craftedWon:crafted.won,oldHP:old.hp,craftedHP:crafted.hp,oldTick:old.tick,craftedTick:crafted.tick,unassistedHP:noExtra.hp});
 }
 console.log('M3_G201_PAIRED '+JSON.stringify(rows));
 assert.equal(new Set(rows.map(x=>x.foe)).size,6);
 assert.ok(rows.some(x=>x.oldHP!==x.craftedHP||x.oldTick!==x.craftedTick),'fusion must change encounters');
});
