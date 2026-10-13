import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const folder=new URL('../docs/research/library/',import.meta.url);
const spec=JSON.parse(fs.readFileSync(new URL('gu_catalog_v0.6.json',folder),'utf8'));
test('Library research catalog is complete, original and DESIGN_ONLY',()=>{
 assert.equal(spec.meta.version,'0.6');
 assert.equal(spec.meta.execution_status,'DESIGN_ONLY__NOT_IMPORT_TO_GAME_AUTOMATICALLY');
 assert.equal(spec.nodes.length,256);
 assert.equal(spec.recipes.length,192);
 assert.equal(spec.school_defs.length,8);
 assert.equal(new Set(spec.nodes.map(x=>x.id)).size,256);
 assert.equal(spec.school_defs.every(x=>x.starter.length===3),true);
});
test('M2 starter identity remains consistent with imported v0.6, without importing high ranks',()=>{
 const m2=fs.readFileSync(new URL('../js/m2_game.js',import.meta.url),'utf8');
 const guBlock=m2.split("const GU=[")[1].split("].map(([id,name,school")[0];
 const matches=[...guBlock.matchAll(/\["([A-Z]\d{3})","([^"]+)","([^"]+)"/g)].map(x=>({id:x[1],name:x[2]}));
 const known=new Map(spec.nodes.map(x=>[x.id,x.name]));
 for(const g of matches.filter(x=>known.has(x.id)))assert.equal(g.name,known.get(g.id));
 assert.match(m2,/N201/);
 assert.equal(known.has('N201'),false);
 assert.equal(known.has('N202'),false);
});
