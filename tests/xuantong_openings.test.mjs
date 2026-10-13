import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {openLab} from './helpers/lab_browser.mjs';
const data={};vm.runInNewContext(fs.readFileSync(new URL('../js/data.js',import.meta.url),'utf8')+'; globalThis.exported=DATA;',data);
const D=data.exported;
test('八道开局数据、32只战蛊和8张首炼配方都在可玩数据中',()=>{
 assert.equal(D.xuantong.start_kits.length,8);
 assert.equal(D.gu.filter(g=>g.sourceClass==='original_xuantong').length,32);
 const map=Object.fromEntries(D.gu.map(g=>[g.id,g]));
 for(const kit of D.xuantong.start_kits){
  assert.equal(kit.gu_ids.length,3);
  assert.ok(kit.gu_ids.every(id=>map[id]?.rank===1));
  const r=D.recipes.find(r=>r.id===kit.known_formula_ids[0]);
  assert.ok(r,'first recipe missing for '+kit.school);
  assert.ok(r.inputs.every(id=>kit.gu_ids.includes(id)));
  assert.ok(Object.entries(r.materials).every(([name,amt])=>(kit.materialInventory[name]||0)>=amt));
  assert.equal(map[r.output].rank,2);
 }
});
test('选择晦明道后实际拥有原创蛊和蛊材、元石与可保存道途',async()=>{
 const lab=await openLab({seed:76,offline:true,viewport:[1280,900]});
 try{
  await lab.click('[data-opening-school="Y"]');
  let s=await lab.snapshot();
  assert.equal(s.openingPath,'Y');
  assert.equal(s.stones,100);
  assert.equal(s.owned.Y101,1);
  assert.equal(s.owned.Y102,1);
  assert.equal(s.materials['灯脂'],3);
  await lab.click('[data-start-run]');
  s=await lab.snapshot();
  assert.equal(s.openingPath,'Y');
  assert.equal(s.owned.moonlight_gu||0,0);
  await lab.reload();
  s=await lab.snapshot();
  assert.equal(s.openingPath,'Y');
 }finally{await lab.close();}
});

test('八道首炼必须真实消耗蛊材、活蛊和元石且失败时不改库存',()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js',import.meta.url),'utf8')+';globalThis.rules=GuRules;',context);
 const rule=context.rules;
 const byId=Object.fromEntries(D.gu.map(g=>[g.id,g]));
 for(const k of D.xuantong.start_kits){
  const formula=D.recipes.find(r=>r.id===k.known_formula_ids[0]);
  const initial={owned:Object.fromEntries(k.gu_ids.map(id=>[id,1])),materials:{...k.materialInventory},stones:k.yuan_stones,playerRank:2};
  const forged=rule.settleForge(formula,initial,byId);
  assert.equal(forged.ok,true,k.school);
  assert.equal(forged.stones,initial.stones-formula.stoneCost);
  assert.equal(forged.owned[formula.output],1);
  for(const [name,qty] of Object.entries(formula.materials))assert.equal(forged.materials[name],initial.materials[name]-qty);
  for(const id of formula.inputs)assert.equal(forged.owned[id],0);
  const absent={...initial,materials:{}};
  const failed=rule.settleForge(formula,absent,byId);
  assert.equal(failed.reason,'missing_materials');
  assert.deepEqual(JSON.parse(JSON.stringify(failed.owned)),absent.owned);
  assert.deepEqual(JSON.parse(JSON.stringify(failed.materials)),absent.materials);
 }
});
