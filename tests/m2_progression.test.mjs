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
   assert.equal(g.run('state.lastResult.tick<=120'),true,school+'/'+round);
   assert.equal(g.run('state.lastResult.log.length>0'),true);
   if(round<6)assert.equal(g.run('state.completed'),false);
  }
  assert.equal(g.run('state.completed'),true,school);
  assert.equal(g.run('state.round'),6);
 }
});
test('chapter two preparation persists without duplicated reward on reload',()=>{
 const g=session();g.run('init("百兵");startBattle();quick();startBattle();quick();startBattle();quick()');
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
