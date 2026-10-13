// Emit/verify deterministic 48-fixture M1 combat snapshots (24 starters + 24 after-purchase).
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const script=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
const c=JSON.parse(fs.readFileSync(new URL('../data/m1_contract.json',import.meta.url),'utf8'));
const rows=[];
for(const school of c.schools)for(let round=1;round<=3;round++)for(const purchased of [false,true]){
  const store=new Map(), el=new Map();
  const ctx=vm.createContext({Math,Date,JSON,confirm:()=>true,setInterval:()=>1,clearInterval:()=>{},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{getElementById(id){if(!el.has(id))el.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return el.get(id)}}});
  const run=x=>vm.runInContext(x,ctx);
  vm.runInContext(script,ctx);
  run('init('+JSON.stringify(school)+')');
  run('state.seed=0x12345678;state.rng=0x12345678;state.round='+round);
  if(purchased)run('buy(3);equip(state.gu[state.gu.length-1].id)');
  run('startBattle();quick()');
  const r=JSON.parse(JSON.stringify(run('state.lastResult')));
  const digest=crypto.createHash('sha256').update(r.log.join('\n')).digest('hex').slice(0,20);
  rows.push({school,round,load:purchased?'starter+shop4':'starter',won:r.won,tick:r.tick,hp:r.hp,logEvents:r.log.length,sha256_20:digest});
}
if(process.argv.includes('--verify')){
  const expected=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/m1_goldens.json',import.meta.url),'utf8'));
  assert.deepEqual(rows,expected,'M1 event goldens changed; review the engine diff and regenerate fixtures explicitly');
  console.log('Verified 48 fixed-seed battle goldens.');
}else console.log('M1_GOLDENS_JSON='+JSON.stringify(rows));
