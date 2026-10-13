import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
function setup(saved){
 const store=new Map(saved?[['wenzhen_m1_v1',saved]]:[]);
 const elements=new Map();
 const ctx=vm.createContext({Date,Math,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',insertAdjacentHTML(){},scrollTop:0});return elements.get(id)}}});
 vm.runInContext(src,ctx);
 return {run:x=>vm.runInContext(x,ctx),store};
}
test('locked offer persists into next round',()=>{
 const x=setup();x.run('init("百兵");lock(0)');
 const id=x.run('state.shelf[0].id');
 x.run('beginRound()');
 assert.equal(x.run('state.shelf[0].id'),id);
 assert.equal(x.run('state.shelf[0].lock'),true);
});
test('combat refresh recovers original fight and does not regrant income',()=>{
 const x=setup();x.run('init("百兵");startBattle()');
 const saved=x.store.get('wenzhen_m1_v1');
 assert.equal(JSON.parse(saved).inBattle,true);
 const y=setup(saved);
 assert.equal(y.run('battle.foe.id'),'rogue');
 assert.equal(y.run('state.gold'),13);
 y.run('quick()');
 assert.equal(y.run('state.inBattle'),false);
});
test('periodic damage does not amplify owner mark',()=>{
 const x=setup();x.run('init("执枢");startBattle();battle.tick=2;mark("owner","z",8);battle.foe.hp=18;direct(1,"root",{periodic:true,consumeWeak:false})');
 assert.equal(x.run('battle.foe.hp'),17);
});
