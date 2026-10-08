import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

test('action route cards separate real gains, costs and gates without retired first-release steps', () => {
  const ctx = vm.createContext({});
  for (const file of ['data', 'run_rules', 'gu_rules', 'node_action_rules', 'journey'])
    vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), ctx);
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  vm.runInContext(main.slice(main.indexOf('function currentTravelSupplies('), main.indexOf('function rollVictoryLoot(')), ctx);
  Object.assign(ctx, { state: { stones: 3, qi: 6, blood: 10, owned: {}, wild: {}, knownFacts: [] }, nodeById: () => null });
  vm.runInContext('const GU_BY_ID = Object.fromEntries(DATA.gu.map(gu => [gu.id, gu]));', ctx);
  const rows = node => { ctx.node = node; return ctx.nodeRouteRows(node); };
  const market = rows({ type: 'market', choices: ['work', 'trade', 'leave'] });
  assert.match(market.find(([label]) => label === '可得')[1], /元石 3 枚[\s\S]*生机叶 ×1/);
  assert.equal(market.find(([label]) => label === '需付')[1], '旅途补给 元石 -3');
  ctx.state.stones = 2;
  assert.match(rows({ type: 'market', choices: ['work', 'trade'] }).find(([label]) => label === '门槛')[1], /还差 1枚/);
  const find = rows({ type: 'wild_gu', choices: ['collect_gu', 'harvest'], findGu: { guId: 'vitality_grass_gu', healthCost: 2 } });
  assert.match(find.find(([label]) => label === '可得')[1], /直接收入蛊仓/);
  assert.match(find.find(([label]) => label === '需付')[1], /气血 -2/);
  assert.doesNotMatch(JSON.stringify([...market, ...find]), /待炼化|炼化后|口粮|花瓣|猪肉/);
});

test('NORMAL_RUN: hazard route cost agrees with crossing and the next fight rewards trained fists', async () => {
  const lab = await openLab({ seed: 19 });
  try {
    await lab.click('[data-start-run]');
    const before = await lab.snapshot();
    const node = before.journey.graph.nodes.find(n => before.journey.availableNodeIds.includes(n.id) && n.type === 'hazard');
    await lab.click(`.route-card:has([data-choose-node="${node.id}"]) .route-facts summary`);
    const card = await lab.text(`.route-card:has([data-choose-node="${node.id}"])`);
    assert.match(card, /可得[\s\S]*探查[\s\S]*需付[\s\S]*穿越 真元 -1/);
    assert.doesNotMatch(card.split('需付')[0], /穿越 真元 -1/);
    assert.doesNotMatch(card, /穿越：\s*需付/, 'empty gain text does not leave an unexplained action heading');
    await lab.click(`[data-choose-node="${node.id}"]`);
    await lab.click('[data-node-action="scout"]');
    await lab.click('[data-node-action="cross"]');
    assert.equal((await lab.snapshot()).qi, before.qi - 1);
    await lab.click('[data-prep-tab="gu"]');
    assert.match(await lab.text('#panel-prep'), /1 转[\s\S]*防御/);
    assert.doesNotMatch(await lab.text('#panel-prep'), /Defense/);
    await lab.click('[data-train-body="white_boar_strength_gu"]');
    await lab.click('[data-prep-continue]');
    const mapped = await lab.snapshot();
    const fight = mapped.journey.graph.nodes.find(n => mapped.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
    await lab.click(`[data-choose-node="${fight.id}"]`);
    assert.match(await lab.text('[data-basic-attack]'), /力量 4/);
    await lab.click('[data-basic-attack]');
    assert.match(await lab.text('[data-reaction-intel]'), /已失效/);
    await lab.click('[data-basic-attack]');
    assert.equal((await lab.snapshot()).page, 'reward');
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});

test('route choices use actual enemy reward tier and preserve hidden rank and exact rewards', () => {
  const ctx = vm.createContext({ state: { journey: { graph: { segmentCount: 5 } } },
    NodeActionRules: { nodeTypes: [], typeLabel: type => type }, nodeEnemyIds: node => node.enemyIds,
    enemyById: () => ({ name: '敌手', rank: 3 }),
    nodeTypeLabel: type => type, DATA: { enemies: ['a', 'b'].map(id => ({ id, name: '敌手', rank: 3, tier: 'elite' })), battle: { stoneRewards: { base_by_tier: { elite: 8 }, layer_step_pct: 25 } } },
  });
  for (const file of ['run_rules', 'describe', 'journey'])
    vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), ctx);
  const html = vm.runInContext("mapNodeCard({id:'n',type:'elite',name:'双敌',enemyIds:['a','b'],stage:'three',layer:3,segment:3,depth:0}, '', new Set(['n']), new Set())", ctx);
  assert.match(html, /胜后按精英档结算/);
  assert.match(html, /2 名敌手同回合行动/);
  assert.match(html, /蛊虫不保证出/);
  assert.doesNotMatch(html, /3转|\+12/);
  assert.match(html, /data-choose-node="n"/);
});

test('route soul information requires scouting or previous encounter; unknown stays unknown', () => {
  const foes = [{ id: 'soul', name: '敌手', rank: 3, tier: 'elite', hp: 7,
    intents: [{ id: 'soul_gnaw', soul_drain: 1 }] }];
  const ctx = vm.createContext({ state: { soul: 1, knownFacts: [], journey: { graph: { segmentCount: 5 } } },
    DATA: { enemies: foes }, NodeActionRules: { nodeTypes: [], typeLabel: type => type },
    nodeTypeLabel: type => type,
  });
  for (const file of ['run_rules', 'describe', 'journey'])
    vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), ctx);
  const card = () => vm.runInContext("mapNodeCard({id:'n',type:'elite',name:'敌手',enemyIds:['soul'],segment:2,depth:0}, '', new Set(['n']), new Set())", ctx);
  assert.match(card(), /data-route-soul-risk="unknown"/);
  assert.doesNotMatch(card(), /魂魄致命威胁|soul_gnaw|HP7|抽魂1/);
  for (const fact of ['route_scouted', 'bought_information', 'enemy_seen:soul', 'route_soul_intel:other:1']) {
    ctx.state.knownFacts = [fact];
    assert.match(card(), /data-route-soul-risk="unknown"/);
  }
  for (const fact of ['route_soul_intel:n:1', 'enemy_soul_seen:soul:1']) {
    ctx.state.knownFacts = [fact];
    assert.match(card(), /data-route-soul-risk="lethal"/);
    assert.match(card(), /魂魄致命威胁/);
    assert.doesNotMatch(card(), /soul_gnaw|HP7|抽魂1/);
  }
  ctx.state.soul = 2;
  assert.match(card(), /data-route-soul-risk="risk"/);
  ctx.state.knownFacts = ['enemy_seen:other'];
  assert.match(card(), /data-route-soul-risk="unknown"/);
  ctx.state.knownFacts = ['route_soul_intel:n:0'];
  assert.match(card(), /data-route-soul-risk="risk"/); // 旧侦察0也核对真实意图
  foes[0].intents = [{ id: 'strike', damage: 1 }];
  assert.match(card(), /data-route-soul-risk="none"/);
  // 曾遭遇记录不会泄露尚未看见的后续阶段抽魂。
  foes[0].intents = [{ id: 'strike', damage: 1 }];
  foes[0].phases = [{ intents: [{ id: 'hidden_soul', soul_drain: 2 }] }];
  ctx.state.knownFacts = ['enemy_seen:soul'];
  assert.match(card(), /data-route-soul-risk="unknown"/);
});

test('scouting reads the actual shipped enemy intent shape', () => {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../js/data.js', import.meta.url), 'utf8'), ctx);
  const foes = vm.runInContext('DATA.enemies', ctx);
  assert.equal(foes.find(foe => foe.id === 'demon_path_adept').intent.soul_drain, 1);
  const nodes = [{ id: 'soul', type: 'battle', enemyIds: ['demon_path_adept'] },
    { id: 'safe', type: 'battle', enemyIds: ['ridge_hound'] }];
  vm.runInContext(readFileSync(new URL('../js/journey.js', import.meta.url), 'utf8'), ctx);
  Object.assign(ctx, { state: { soul: 1, knownFacts: [] },
    nodeById: id => nodes.find(node => node.id === id), nodeEnemyIds: node => node.enemyIds,
    enemyById: id => foes.find(foe => foe.id === id) });
  assert.deepEqual(Array.from(vm.runInContext("scoutedRouteSoulFacts({nextIds:['soul','safe']})", ctx)),
    ['route_soul_intel:soul:1', 'route_battle_intel:soul', 'route_soul_intel:safe:0', 'route_battle_intel:safe']);
  ctx.state.knownFacts = ['route_soul_intel:soul:1'];
  assert.equal(vm.runInContext("routeSoulRisk({id:'soul'}, []).kind", ctx), 'lethal');
});

test('NORMAL_RUN: unknown route warning is visible before committing to combat and survives refresh', async () => {
  const lab = await openLab({ seed: 7 });
  try {
    await lab.click('[data-start-run]');
    const before = await lab.snapshot();
    const node = before.journey.graph.nodes.find(n => before.journey.availableNodeIds.includes(n.id)
      && ['battle', 'elite', 'boss'].includes(n.type));
    assert.ok(node);
    const selector = `[data-choose-node="${node.id}"]`;
    assert.match(await lab.text(selector), /魂魄风险未知/);
    assert.equal(before.battle, null);
    await lab.reload();
    if ((await lab.snapshot()).page === 'hall') await lab.click('[data-continue-run]');
    assert.match(await lab.text(selector), /魂魄风险未知/);
    assert.equal((await lab.snapshot()).journey.nodeId, null);
    await lab.click(selector);
    const entered = await lab.snapshot();
    for (const foe of entered.battle.enemies) assert.ok(entered.knownFacts.includes(`enemy_seen:${foe.id}`));
  } finally { await lab.close(); }
});
