import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url),'utf8');
function setup() {
  const c = vm.createContext({});
  for (const f of ['data','run_rules','gu_rules','build_rules']) vm.runInContext(read(`js/${f}.js`),c);
  const main = read('js/main.js');
  vm.runInContext(`globalThis.GU_BY_ID=Object.fromEntries(DATA.gu.map(g=>[g.id,g]));
    globalThis.state={owned:{moonlight_gu:1,small_light_gu:2},stones:60,cultivation:2,cultivationStage:0,
      aptitude:'bing',qiMax:10,qi:4,blood:5,bloodMax:10,journal:[],combatLoadout:['moonlight_gu','small_light_gu']};
    globalThis.isPreparing=()=>true;globalThis.isCombatPlanning=()=>true;globalThis.currentNode=()=>({type:'battle'});
    globalThis.recordEvent=()=>{};globalThis.toast=()=>{};globalThis.Sfx={success(){}};
    ${main.slice(main.indexOf('function recomputeQiMax('),main.indexOf('// 自定义只存组件'))}
    globalThis.act={${main.slice(main.indexOf('  forge(recipeId)'),main.indexOf('  produceLeaf(guId)'))}};`,c);
  return c;
}
test('forge replaces depleted equipped components, frees a slot and cannot duplicate output', () => {
  const c = setup();
  vm.runInContext('act.forge("moonlight_glow")',c);
  assert.equal(c.state.owned.moon_glow_gu,1);
  assert.equal(c.state.owned.small_light_gu,0);
  assert.equal(c.state.stones,50);
  assert.deepEqual([...c.state.combatLoadout],['moon_glow_gu']);
  vm.runInContext('act.forge("moonlight_glow")',c);
  assert.equal(c.state.owned.moon_glow_gu,1);
  assert.equal(c.state.stones,50);
});
test('slot purchases cap, refresh costs escalate and boons only settle once', () => {
  const c = setup();
  vm.runInContext('act.buyCombatSlot();act.buyCombatSlot();act.buyCombatSlot();act.buyCombatSlot()',c);
  assert.equal(c.state.combatSlotBonus,3);
  assert.equal(c.state.stones,0);
  c.state.stones=20;
  vm.runInContext('act.refreshShop();act.refreshShop()',c);
  assert.equal(c.state.stones,14);
  assert.equal(c.state.shopRefreshCount,2);
  c.state.pendingBuildBoon=true;
  vm.runInContext('act.chooseBuildBoon("focus");act.chooseBuildBoon("fortune")',c);
  assert.equal(c.state.buildBoons.length,1);
  assert.equal(c.state.qiMax,13);
  assert.equal(c.state.qi,7);
  assert.equal(c.state.stones,14);
  vm.runInContext('recomputeQiMax()',c);
  assert.equal(c.state.qiMax,13,'capacity recomputation preserves chosen growth');
});
