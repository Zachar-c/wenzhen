import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
function game(){
 const store=new Map(),nodes=new Map();
 const ctx=vm.createContext({Date,Math,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval(){},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 document:{getElementById(k){if(!nodes.has(k))nodes.set(k,{innerHTML:'',scrollTop:0,insertAdjacentHTML(where,html){this.innerHTML+=html}});return nodes.get(k)}}});
 vm.runInContext(source,ctx);
 return {run:x=>vm.runInContext(x,ctx),nodes,store};
}
test('battle DOM exposes intent, equipped Gu state and current cumulative outcome',()=>{
 const g=game();g.run('init("百兵");startBattle();step();step();step()');
 const html=g.nodes.get('app').innerHTML;
 assert.match(html,/class="combat-stage/);
 assert.match(html,/敌方意图/);
 assert.match(html,/蛊组运转/);
 assert.match(html,/已造成/);
 assert.match(html,/foe-portrait/);
 assert.match(html,/battle-gu/);
});
test('shop hint tells exactly which synergy a purchase will add without granting resources',()=>{
 const g=game();g.run('init("玄牝");state.shelf[0].gu="T103";render()');
 const html=g.nodes.get('app').innerHTML;
 assert.match(html,/新增联动：含芽\+火筹/);
 assert.match(html,/野猪|散修/);
 assert.equal(g.run('state.gold'),13);
 assert.equal(g.run('state.gu.length'),3);
});
test('damage attribution equals actual enemy HP lost, not overkill',()=>{
 const g=game();g.run('init("百兵");startBattle();quick()');
 const result=JSON.parse(JSON.stringify(g.run('state.lastResult')));
 assert.equal(result.won,true);
 assert.equal(result.stats.damageDealt,18);
 assert.equal(Object.values(result.stats.damageBySource).reduce((s,x)=>s+x,0),18);
 assert.ok(result.stats.shieldAbsorbed>=0);
 assert.ok(result.stats.damageTaken<=30);
 assert.match(g.nodes.get('app').innerHTML,/主要来源/);
});
test('Gu shield absorption is attributed to the exact instance ID',()=>{
 const g=game();g.run('init("观复");startBattle()');
 for(let i=0;i<=8;i++)g.run('step()');
 const totals=JSON.parse(JSON.stringify(g.run('battle.totals')));
 assert.ok(totals.shieldAbsorbed>0);
 assert.ok(Object.keys(totals.absorbedByInstance).some(k=>k.startsWith('G102:')));
 assert.equal(Object.values(totals.absorbedByInstance).reduce((a,b)=>a+b,0),totals.shieldAbsorbed);
});
test('all initial eight-school battles produce a persisted causal report',()=>{
 for(const school of ['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复']){
  const g=game();g.run('init('+JSON.stringify(school)+');startBattle();quick()');
  const result=JSON.parse(JSON.stringify(g.run('state.lastResult')));
  assert.equal(result.won,true,school);
  assert.equal(result.stats.damageDealt,18,school);
  assert.ok(result.stats.damageBySource && Object.keys(result.stats.damageBySource).length>0,school);
  assert.ok(JSON.parse(g.store.get('wenzhen_m1_v1')).lastResult.stats,school);
 }
});
