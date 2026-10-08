import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
test('small and big breakthroughs increase reserves, including fifth-rank relics, without free essence', () => {
  const c = vm.createContext({});
  for (const file of ['data', 'run_rules', 'run_flow', 'human_rules']) vm.runInContext(read(`js/${file}.js`), c);
  const main = read('js/main.js');
  const handler = main.slice(main.indexOf('  breakthrough(mode'), main.indexOf('  useAptitudeGu()'));
  const recompute = main.slice(main.indexOf('function recomputeQiMax('), main.indexOf('// 自定义只存组件'));
  vm.runInContext(`${recompute}
    globalThis.assertRunMutable=()=>true;globalThis.recordEvent=()=>{};
    globalThis.Sfx={success(){}};globalThis.toast=()=>{};globalThis.draw=()=>{};
    globalThis.STAGE_BY_RANK=['','one','two','three','four','five'];
    globalThis.act={${handler}};`, c);
  for (let rank = 1; rank <= 5; rank++) {
    c.rank = rank;
    vm.runInContext(`globalThis.state={cultivation:rank,cultivationStage:0,aptitude:'jia',
      stones:200,owned:{[DATA.flow.sariByRank[rank]]:1},qi:2,journal:[]};recomputeQiMax();`, c);
    for (let stage = 1; stage <= 3; stage++) {
      const before = c.state.qiMax;
      vm.runInContext(`act.breakthrough('${stage === 1 ? 'sari' : 'stone'}')`, c);
      assert.equal(c.state.cultivationStage, stage);
      assert.equal(c.state.qiMax, before + 1);
      assert.equal(c.state.qi, 2);
      assert.ok(c.state.journal[0].includes(`${before} → ${before + 1}`));
      c.stage = stage;
      assert.equal(vm.runInContext('HumanRules.base(rank,"jia",stage).essenceMax', c), c.state.qiMax);
    }
    const before = c.state.qiMax;
    vm.runInContext('act.breakthrough("stone")', c);
    assert.equal(c.state.qiMax, before + (rank < 5 ? 1 : 0));
    assert.equal(c.state.qi, 2);
    assert.equal(c.state.owned[vm.runInContext('DATA.flow.sariByRank[rank]', c)], 0);
  }
});

test('loading old active saves updates capacity and the battle baseline without replenishing or rewriting endings', () => {
  const c = vm.createContext({});
  vm.runInContext(read('js/run_rules.js'), c);
  const main = read('js/main.js');
  const boot = main.slice(main.indexOf('function bootFromSave('), main.indexOf('function fresh('));
  const recompute = main.slice(main.indexOf('function recomputeQiMax('), main.indexOf('// 自定义只存组件'));
  vm.runInContext(`${recompute}${boot}
    globalThis.saved={cultivation:5,cultivationStage:3,aptitude:'jia',qiMax:16,qi:4,
      wild:{},owned:{},guCare:{},solidCare:{},battle:{enemies:[],playerHuman:{baseline:{essenceMax:16},essence:4}}};
    globalThis.LabSave={read:()=>({ok:true,state:saved}),write:()=>({ok:true})};
    globalThis.saveStorage=()=>null;globalThis.contentVersion=()=>'';
    globalThis.compatibleSaveVersions=()=>[];globalThis.currentKillMoves=()=>[];
    bootFromSave();globalThis.loadedState=state;`, c);
  assert.equal(c.loadedState.qiMax, 27);
  assert.equal(c.loadedState.qi, 4);
  assert.equal(c.loadedState.battle.playerHuman.baseline.essenceMax, 27);
  assert.equal(c.loadedState.battle.playerHuman.essence, 4);
  vm.runInContext('saved.qiMax=16;saved.ending={outcome:"victory"};bootFromSave()', c);
  assert.equal(c.loadedState.qiMax, 16, 'completed runs keep their recorded resources');
});

test('dedicated markets stock unlocked goods while ordinary preparation stays limited and prices match', () => {
  const c = vm.createContext({});
  for (const file of ['data', 'run_rules', 'shop_rules']) vm.runInContext(read(`js/${file}.js`), c);
  const journey = read('js/journey.js');
  vm.runInContext(`${journey.slice(journey.indexOf('function currentShopContext('), journey.indexOf('function canBuyOffer('))}
    globalThis.state={seed:9,school:DATA.loot.school};globalThis.node={id:'market',segment:4,type:'market'};
    globalThis.currentNode=()=>node;globalThis.currentSegment=()=>4;
    globalThis.market=currentShopContext();
    globalThis.marketStock=ShopRules.stock(DATA.shopOffers,market);
    globalThis.pool=ShopRules.goodsPool(DATA.shopOffers,market);
    globalThis.price=offerCost(DATA.shopOffers.find(o=>o.gu_id==='force_atk_4_02_gu'));
    node.type='battle';globalThis.ordinary=currentShopContext();
    globalThis.ordinaryStock=ShopRules.stock(DATA.shopOffers,ordinary);
    globalThis.ordinaryPrice=offerCost(DATA.shopOffers.find(o=>o.gu_id==='force_atk_4_02_gu'));`, c);
  assert.deepEqual([...c.marketStock].sort(), [...c.pool].sort());
  assert.ok(c.marketStock.length > c.ordinaryStock.length);
  assert.equal(c.price, c.ordinaryPrice);
  for (const id of ['force_atk_4_02_gu', 'force_heal_3_03_gu', 'blood_atk_3_11_gu']) {
    c.guId = id;
    assert.ok(vm.runInContext('marketStock.some(id=>DATA.shopOffers.find(o=>o.id===id).gu_id===guId)', c));
  }
});
