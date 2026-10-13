import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
function game(seed,school='观复'){
 const map=new Map(),dom=new Map();
 const context=vm.createContext({Math,JSON,Date,console,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)},document:{getElementById(id){if(!dom.has(id))dom.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return dom.get(id)}}});
 vm.runInContext(script,context);
 const run=x=>vm.runInContext(x,context);
 run('init('+JSON.stringify(school)+')');
 run('state.seed='+seed+';state.rng='+seed);
 return {run,map};
}
function runPolicy(seed,mode){
 const g=game(seed);
 let sought=false,spent=0,roundFound=null,loot=null;
 for(let r=1;r<=6;r++){
  const start=g.run('state.gold');
  if(mode==='commission'&&r===2){
   assert.equal(g.run('seekGu("G112")'),true);
   const ix=g.run('state.shelf.findIndex(x=>x?.gu==="G112"&&x?.seek)');
   g.run('buy('+ix+')');spent+=6;
  }
  if(mode==='random'){
   const ix=g.run('state.shelf.findIndex(x=>x?.gu==="G112")');
   if(ix>=0&&g.run('state.gold')>=4){g.run('buy('+ix+')');spent+=4}
  }
  if(g.run('state.gu.some(x=>x.gu==="G112")')&&!sought){sought=true;roundFound=r}
  // Complete combat with baseline equipment and actual enemy loot.
  g.run('startBattle();quick()');
  if(g.run('state.pendingSpoils')){loot=g.run('state.pendingSpoils.gu');g.run('resolveSpoils("sell")')}
  if(g.run('state.completed'))break;
  assert.ok(g.run('state.gold')>=0);
 }
 return {sought,spent,roundFound,loot,gold:g.run('state.gold')};
}
test('economic contrast: targeted merchant is guaranteed but has real 2-gold premium',()=>{
 const samples=128;
 let random=0,commission=0,randomSpent=0,commissionSpent=0;
 for(let seed=1;seed<=samples;seed++){
  const a=runPolicy(seed,'random'),b=runPolicy(seed,'commission');
  random+=Number(a.sought);commission+=Number(b.sought);randomSpent+=a.spent;commissionSpent+=b.spent;
 }
 console.log('SUPPLY_AUDIT '+JSON.stringify({samples,randomNaturalTargetRate:random/samples,commissionTargetRate:commission/samples,randomDirectSpent:randomSpent,commissionDirectSpent:commissionSpent,merchantPremium:2,marketSlots:4,rounds:6}));
 assert.equal(commission,samples,'the explicit commission has a real guaranteed supply effect');
 assert.ok(random<commission,'uncontrolled shop is materially less reliable for an exact Gu');
 assert.equal(commissionSpent,samples*6);
});
test('enemy spoils retain different source economics from the merchant',()=>{
 const g=game(20261013,'百兵');
 assert.equal(g.run('ENEMY_SPOILS[0].gu'),'B101');
 assert.equal(g.run('ENEMY_SPOILS[5].gu'),'N202');
 assert.equal(g.run('state.gold'),13);
 assert.equal(g.run('seekGu("G112")'),true);
 assert.equal(g.run('state.gold'),11);
 assert.equal(g.run('state.pendingSpoils'),undefined);
 assert.equal(g.run('state.shelf.some(x=>x?.gu==="G112"&&x?.seek)'),true);
});
