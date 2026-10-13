import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
function env(){
 const data=new Map(), elements=new Map();
 const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const document={getElementById(k){if(!elements.has(k))elements.set(k,{innerHTML:'',insertAdjacentHTML(){},scrollTop:0});return elements.get(k)}};
 const ctx=vm.createContext({document,localStorage,Date,Math,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},});
 vm.runInContext(code,ctx);
 return {ctx,run:s=>vm.runInContext(s,ctx),store:localStorage}
}
test('eight school starters and no legacy resource',()=>{
 for(const s of ['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复']){
  let e=env();e.run('init('+JSON.stringify(s)+')');
  assert.equal(e.run('state.gu.length'),3);assert.equal(e.run('state.gold'),13);
  assert.equal(e.run('state.equip.length'),3);assert.equal(e.run('state.shelf.length'),4);
  assert.equal(e.run('state.gu.every(x=>GM[x.gu].school===state.school)'),true)
 }
});
test('all 24 starter fights complete deterministically',()=>{
 for(const s of ['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复']){
  for(let round=1;round<=3;round++){
   let e=env();e.run('init('+JSON.stringify(s)+')');e.run('state.round='+round+';startBattle();quick()');
   assert.equal(e.run('battle===null'),true,s+' round '+round);
   assert.equal(e.run('state.lastResult.tick<=120'),true);
   assert.equal(e.run('state.lastResult.log.length>0'),true);
  }
 }
});
test('shop purchase, lock, reroll and load keep state',()=>{
 let e=env();e.run('init("百兵")');e.run('lock(0);buy(1)');
 assert.equal(e.run('state.gold'),9);
 e.run('reroll()');assert.equal(e.run('state.gold'),9);
 assert.equal(e.run('state.shelf[0].lock'),true);
 assert.equal(e.run('state.gu.length'),4);
 const saved=e.store.getItem('wenzhen_m1_v1');
 assert.equal(JSON.parse(saved).gold,9);
});
test('same seed and skill events replay identically',()=>{
 function run(){let e=env();e.run('init("百兵");startBattle();quick()');return JSON.parse(JSON.stringify(e.run('state.lastResult')))}
 assert.deepEqual(run(),run())
});
