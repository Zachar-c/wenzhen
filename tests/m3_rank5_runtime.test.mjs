import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
const blueprints=JSON.parse(fs.readFileSync(new URL('../docs/design/m3_rank5_reverse_blueprints_v0.1.json',import.meta.url),'utf8'));
function session(m3=true){
 const storage=new Map(),elements=new Map();
 const document={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return elements.get(id)},querySelectorAll:()=>[]};
 const context=vm.createContext({Math,Date,JSON,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},URLSearchParams,location:{search:m3?'?m3=rank5':''},document,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}});
 vm.runInContext(script,context);
 return {run:s=>vm.runInContext(s,context),storage,elements};
}
const ids={百兵:['B201','B301','B401','B501'],观复:['G201','G301','G401','G501']};
const sources={百兵:['B202','B302','B402'],观复:['G202','G302','G402']};
const observedFrom=result=>result.log.filter(x=>x.includes('两次真实同招已验'));
function commission(g,id){
 assert.equal(g.run('seekGu('+JSON.stringify(id)+')'),true,'commission '+id);
 const ix=g.run('state.shelf.findIndex(x=>x?.gu==='+JSON.stringify(id)+')');
 assert.ok(ix>=0);
 g.run('buy('+ix+')');
 const owned=g.run('state.gu.filter(x=>x.gu==='+JSON.stringify(id)+').at(-1).id');
 g.run('equip('+JSON.stringify(owned)+')');
}
function completeLongRun(school){
 const g=session(true);g.run('init('+JSON.stringify(school)+')');
 const ladder=ids[school],supply=sources[school],records=[];let tier=0;
 for(let phase=1;phase<=16;phase++){
  assert.equal(g.run('state.round'),phase,'normal stage advancement');
  if(phase===1)commission(g,'T103');
  if(school==='观复'&&phase===2)commission(g,'B101');
  if(school==='观复'&&phase===3)commission(g,'S101');
  if([4,8,12].includes(phase)){
    const index=[4,8,12].indexOf(phase),price=[4,6,8][index];
    const before=g.run('state.gold');
    assert.equal(g.run('acquireM3Ingredient('+JSON.stringify(supply[index])+')'),true);
    assert.equal(before-g.run('state.gold'),price,'in-game gold cost must NOT be Library stone fee');
    assert.equal(g.run('acquireM3Ingredient('+JSON.stringify(supply[index])+')'),false,'once-per-round contract');
  }
  if(tier<4&&g.run('refineGu('+JSON.stringify(ladder[tier])+')'))tier++;
  const foe=g.run('targetFoe().id');
  g.run('startBattle();quick()');
  const result=JSON.parse(JSON.stringify(g.run('state.lastResult')));
  assert.ok(result.tick<=120);
  records.push({phase,foe,won:result.won,tick:result.tick,hp:result.hp,skills:result.log,rank:tier});
  if(g.run('state.pendingSpoils'))assert.equal(g.run('resolveSpoils("sell")'),true);
  assert.ok(g.run('state.gold')>=0);
  if(phase<16)assert.equal(g.run('state.completed'),false,'reached stage '+phase+' prematurely');
 }
 assert.equal(tier,4,school+' reaches five-rank fusion from actual paid sources');
 assert.equal(g.run('state.completed'),true);
 assert.equal(g.run('state.pastTargets.length'),16);
 assert.equal(new Set(records.map(x=>x.foe)).size,16,'repeated enemies cannot count as new long-run stages');
 assert.ok(g.run('state.gu.some(x=>x.gu==='+JSON.stringify(ladder[3])+')'));
 assert.ok(g.run('state.losses')<3,'full run must survive under a stated purchasable policy');
 return {g,records};
}
test('default M2 contract remains isolated; M3 is explicitly opt-in',()=>{
 const old=session(false);old.run('init("百兵")');
 assert.equal(old.run('GU.length'),29);assert.equal(old.run('TOTAL_ROUNDS'),6);
 assert.equal(old.run('STORE_KEY'),'wenzhen_m2_v1');
 assert.equal(old.run('refineGu("B301")'),false);
 const m3=session(true);m3.run('init("百兵")');
 assert.equal(m3.run('GU.length'),41);assert.equal(m3.run('TOTAL_ROUNDS'),16);
 assert.equal(m3.run('STORE_KEY'),'wenzhen_m3_rank5_v1');
 assert.equal(m3.run('M3_ONLY.has("Y201")'),false);
 assert.equal(m3.run('GM.Y201'),undefined,'rejected Y201 not resurrected');
 assert.equal(blueprints.meta.status,'DESIGN_ONLY_NOT_IN_RUNTIME');
 assert.equal(blueprints.meta.no_auto_import,true);
});
test('M3 staged sources cannot be accessed early, bypassed through shop or directly commissioned',()=>{
 const g=session(true);g.run('init("百兵")');
 for(const id of ['B202','B302','B402','G202','G302','G402','B501','G501']){
  assert.equal(g.run('seekGu('+JSON.stringify(id)+')'),false,id+' cannot be commissioned');
  assert.equal(g.run('state.shelf.some(x=>x?.gu==='+JSON.stringify(id)+')'),false,id+' not a natural shop offer');
 }
 assert.equal(g.run('acquireM3Ingredient("B202")'),false);
 assert.equal(g.run('acquireM3Ingredient("B402")'),false);
 assert.equal(g.run('refineGu("B301")'),false);
 assert.equal(g.run('state.gold'),13);
});
test('B501 is reachable in a genuine sixteen-encounter economic run with multiple live chained hits',()=>{
 const {records}=completeLongRun('百兵');
 const later=records.filter(x=>x.phase>=12).flatMap(x=>x.skills);
 assert.ok(later.some(x=>x.includes('第二段真命中且下一关节完好')),'B501 must verify continuation');
 assert.ok(later.some(x=>x.includes('变节折角·万节藏锋蛊')),'follow-up hit is actual combat damage');
});
test('G501 is reachable in a genuine sixteen-encounter economic run and its condition sometimes applies, sometimes fails',()=>{
 const {records}=completeLongRun('观复');
 assert.ok(records.filter(x=>x.phase>=12).some(x=>x.skills.some(y=>y.includes('精准化解下一次可见旧式'))));
 assert.ok(records.filter(x=>x.phase>=12).some(x=>!x.skills.some(y=>y.includes('精准化解下一次可见旧式'))),'rank 5 is not unconditional');
});
test('B501 hard counter requires genuine damaging disarm; no renewed attacks after weapon loss',()=>{
 const g=session(true);g.run('init("百兵")');
 g.run('state.gu=[owned("B501")];state.equip=[state.gu[0].id];state.round=8;state.targetIndex=7;startBattle();battle.foe.hp=180');
 g.run('quick()');
 const events=JSON.parse(JSON.stringify(g.run('state.lastResult.log')));
 assert.ok(events.some(x=>x.includes('真命中后缴械')));
 assert.equal(events.filter(x=>x.includes('万节藏锋蛊 触发')).length,1,'disarmed weapon cannot restart a new combo');
 assert.ok(events.some(x=>x.includes('第二段真命中')),'pre-disarm joint mechanics did fire');
});
test('G501 cannot predict first attack, alternating feints, or a different enemy without fresh evidence',()=>{
 const watcher=session(true);watcher.run('init("观复");state.gu=[owned("G501")];state.equip=[state.gu[0].id];state.round=9;state.targetIndex=8;startBattle()');
 watcher.run('for(let i=0;i<13;i++)step()');
 assert.equal(watcher.run('battle.forecastUsed'),false,'one resolved move is not two observations');
 watcher.run('quick()');
 const watch=JSON.parse(JSON.stringify(watcher.run('state.lastResult.log')));
 assert.equal(watch.filter(x=>x.includes('精准化解下一次可见旧式')).length,1,'single exact prediction');
 const changing=session(true);changing.run('init("观复");state.gu=[owned("G501")];state.equip=[state.gu[0].id];state.round=11;state.targetIndex=10;startBattle();quick()');
 const changed=JSON.parse(JSON.stringify(changing.run('state.lastResult.log')));
 assert.equal(changed.filter(x=>x.includes('精准化解下一次可见旧式')).length,0);
 assert.ok(changed.some(x=>x.includes('观复证据归零')));
});
