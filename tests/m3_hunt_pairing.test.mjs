// M3-B choice audit: two genuinely different final-round hunts over eight schools.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
const schools=['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复'];
function simulate(school,index){
 const store=new Map(),dom=new Map(),ctx=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',insertAdjacentHTML(){}});return dom.get(id)}}});
 vm.runInContext(script,ctx);const run=x=>vm.runInContext(x,ctx);
 run('init('+JSON.stringify(school)+')');
 run('state.round=6;state.targetIndex='+index);
 assert.equal(run('HUNTS[5].includes(targetIndex())'),true);
 run('startBattle();quick()');
 const result=JSON.parse(JSON.stringify(run('state.lastResult')));
 return {school,foe:result.foe,won:result.won,tick:result.tick,hp:result.hp,damage:result.stats.damageDealt,regen:result.log.filter(x=>x.includes('枯根傀儡再生')).length,blocked:result.log.filter(x=>x.includes('阻断枯根再生')).length};
}
test('M3-B hunt choice varies in actual fight outcomes, not merely illustrated enemy labels',()=>{
 const rows=schools.flatMap(school=>[5,6].map(index=>simulate(school,index)));
 console.log('M3_B_HUNT_CHOICES '+JSON.stringify(rows));
 assert.equal(rows.length,16);
 assert.equal(new Set(rows.map(r=>r.foe)).size,2);
 assert.ok(rows.some(r=>r.foe==='枯根傀儡'&&r.regen>0));
 assert.ok(rows.some(r=>r.foe==='枯根傀儡'&&r.blocked>0));
 assert.ok(rows.every(r=>r.tick<=120),'every enemy must respect finite battle duration');
});
