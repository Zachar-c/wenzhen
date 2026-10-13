import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/m1_game.js',import.meta.url),'utf8');
function game(){
 const storage=new Map();
 const elements=new Map();
 const context=vm.createContext({Math,Date,JSON,confirm:()=>true,setInterval:()=>1,clearInterval(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(){}});return elements.get(id)}}});
 vm.runInContext(source,context);
 return expression=>vm.runInContext(expression,context);
}
test('weakness is consumed only once and gives exactly 2 bonus damage',()=>{
 const run=game();
 run('init("百兵");startBattle();battle.tick=2;mark("weak","test",8);battle.foe.hp=18;direct(4,"test")');
 assert.equal(run('battle.foe.hp'),12);
 assert.equal(run('has("weak")'),false);
});
test('unknown school does not create invalid starting state',()=>{
 const run=game();run('init("不存在的道途")');assert.equal(run('state'),null);
});
test('lethal strike cannot leave an additional damage-over-time status',()=>{
 const run=game();
 run('init("参同");startBattle();battle.tick=2;battle.foe.hp=1;step()');
 assert.equal(run('battle===null'),true);
 const result=run('state.lastResult.log');
 assert.equal(result.some(x=>x.includes('状态 dot')),false);
});
