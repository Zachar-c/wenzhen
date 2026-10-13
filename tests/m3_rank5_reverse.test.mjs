import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const design=read('../docs/design/m3_rank5_reverse_blueprints_v0.1.json');
const catalog=read('../docs/research/library/gu_catalog_v0.6.json');
const byNode=new Map(catalog.nodes.map(n=>[n.id,n]));
test('top-down five-rank goals cover all eight schools and cannot leak directly to gameplay',()=>{
 assert.equal(design.meta.status,'DESIGN_ONLY_NOT_IN_RUNTIME');
 assert.equal(design.meta.no_auto_import,true);
 assert.equal(design.endpoints.length,8);
 assert.equal(new Set(design.endpoints.map(x=>x.school)).size,8);
 for(const e of design.endpoints){
  assert.equal(e.rank,5);
  assert.equal(byNode.get(e.endpoint_id)?.rank,5);
  assert.equal(byNode.get(e.endpoint_id)?.name,e.endpoint_name);
  for(const key of ['ultimate_effect','activation_required','player_reason','hard_counter','causal_chain'])assert.ok(e[key]?.length>=8,e.endpoint_id+' missing '+key);
 }
 const live=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
 for(const e of design.endpoints)assert.equal(new RegExp('\\["'+e.endpoint_id+'","').test(live),false,'future rank5 must not be smuggled into M2 shop/runtime');
});
test('every backwards dependency is a real v0.6 ranked recipe without invented formula IDs',()=>{
 const recipes=new Map(catalog.recipes.map(x=>[x.id,x]));
 for(const e of design.endpoints){
  assert.deepEqual(e.reverse_ladder.map(x=>x.rank),[5,4,3,2]);
  let top=e.endpoint_id;
  for(const step of e.reverse_ladder){
   assert.equal(step.output,top);
   assert.equal(byNode.get(step.output).rank,step.rank);
   const known=recipes.get(step.source_formula);
   assert.ok(known,'unknown recipe '+step.source_formula);
   assert.equal(known.output,step.output);
   assert.equal(known.status,'C_DESIGN');
   assert.equal(known.live_allowed,false);
   assert.deepEqual(step.inputs.map(x=>x.id),known.inputs.map(x=>x.id));
   assert.ok(step.inputs.every(x=>byNode.get(x.id)?.rank===step.rank-1),'wrong lower rank '+step.output);
   assert.deepEqual(step.archive_materials,known.materials);
   assert.equal(step.archive_stone_fee,known.stone_fee);
   top=step.inputs[0].id;
  }
 }
 assert.equal(design.endpoints.reduce((a,x)=>a+x.reverse_ladder.length,0),32);
});
