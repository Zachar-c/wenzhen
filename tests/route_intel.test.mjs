import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

function loadJourney() {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../js/data.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(readFileSync(new URL('../js/journey.js', import.meta.url), 'utf8'), ctx);
  const enemies = vm.runInContext('DATA.enemies', ctx);
  const nodes = [
    { id: 'scout', type: 'market', nextIds: ['wolf', 'safe'] },
    { id: 'wolf', type: 'battle', enemyIds: ['thunder_crown_wolf'] },
    { id: 'safe', type: 'battle', enemyIds: ['beast_swarm'] },
    { id: 'future', type: 'battle', enemyIds: ['thunder_crown_wolf'] },
  ];
  Object.assign(ctx, {
    state: { soul: 3, knownFacts: [], journey: { graph: { segmentCount: 5 } } },
    nodeById: id => nodes.find(node => node.id === id),
    nodeEnemyIds: node => node.enemyIds || [],
    enemyById: id => enemies.find(enemy => enemy.id === id),
  });
  return { ctx, enemies, nodes };
}

test('scout facts cover only immediate combat successors and keep soul facts', () => {
  const { ctx } = loadJourney();
  assert.deepEqual(Array.from(vm.runInContext("scoutedRouteSoulFacts({nextIds:['wolf','safe']})", ctx)), [
    'route_soul_intel:wolf:0', 'route_battle_intel:wolf',
    'route_soul_intel:safe:0', 'route_battle_intel:safe',
  ]);
});

test('route battle intel reveals authored intent and counter labels only for its marked node', () => {
  const { ctx, enemies } = loadJourney();
  const wolf = enemies.find(enemy => enemy.id === 'thunder_crown_wolf');
  assert.ok(wolf.intent?.label);
  assert.ok(wolf.reactions?.some(reaction => reaction.label));

  for (const unrelatedFact of ['route_scouted', 'bought_information', 'route_battle_intel:other']) {
    ctx.state.knownFacts = [unrelatedFact];
    const unknown = vm.runInContext("routeBattleIntel({id:'wolf'}, [enemyById('thunder_crown_wolf')])", ctx);
    assert.equal(unknown.known, false, unrelatedFact);
    assert.doesNotMatch(unknown.text, /雷冠撕咬|雷光护甲/);
  }

  ctx.state.knownFacts = ['route_battle_intel:wolf'];
  const known = vm.runInContext("routeBattleIntel({id:'wolf'}, [enemyById('thunder_crown_wolf')])", ctx);
  assert.equal(known.known, true);
  assert.match(known.text, new RegExp(wolf.intent.label));
  for (const reaction of wolf.reactions.filter(item => item.label)) assert.ok(known.text.includes(reaction.label));
  assert.doesNotMatch(known.text, /\+\s*\d|\d+\s*(?:点伤害|伤害)|免费压制|免费打断/);

  const otherNode = vm.runInContext("routeBattleIntel({id:'future'}, [enemyById('thunder_crown_wolf')])", ctx);
  assert.equal(otherNode.known, false);
});

test('route battle intel remains available after known facts are refreshed from a save', () => {
  const { ctx } = loadJourney();
  // A reload hydrates the same persisted knownFacts array; only the node-scoped fact grants detail.
  ctx.state.knownFacts = ['route_battle_intel:wolf'];
  const savedFacts = JSON.parse(JSON.stringify(ctx.state.knownFacts));
  ctx.state = { soul: 3, knownFacts: savedFacts, journey: { graph: { segmentCount: 5 } } };
  const result = vm.runInContext("routeBattleIntel({id:'wolf'}, [enemyById('thunder_crown_wolf')])", ctx);
  assert.equal(result.known, true);
  assert.match(result.text, /雷冠撕咬/);
  assert.match(result.text, /雷光护甲/);
});

test('NORMAL_RUN: scouting a real route reveals the selected successor battle and survives reload', async () => {
  const lab = await openLab({ seed: 7 });
  try {
    await lab.click('[data-start-run]');
    const initial = await lab.snapshot();
    const scoutNode = initial.journey.graph.nodes.find(node => initial.journey.availableNodeIds.includes(node.id)
      && node.choices?.includes('scout'));
    assert.ok(scoutNode, 'seed 7 starts with an ordinary scout action');
    await lab.click(`[data-choose-node="${scoutNode.id}"]`);
    await lab.click('[data-node-action="scout"]');
    let state = await lab.snapshot();
    assert.equal(state.stones, initial.stones, 'normal scout does not spend stones');
    const successors = scoutNode.nextIds.map(id => state.journey.graph.nodes.find(node => node.id === id))
      .filter(node => ['battle', 'elite', 'boss'].includes(node.type));
    for (const node of successors) assert.ok(state.knownFacts.includes(`route_battle_intel:${node.id}`));
    if (state.page === 'node-action') {
      assert.equal(scoutNode.type, 'hazard');
      await lab.click('[data-node-action="cross"]');
    }
    await lab.click('[data-prep-continue]');

    state = await lab.snapshot();
    const nextBattle = state.journey.graph.nodes.find(node => state.journey.availableNodeIds.includes(node.id)
      && ['battle', 'elite', 'boss'].includes(node.type)
      && state.knownFacts.includes(`route_battle_intel:${node.id}`));
    assert.ok(nextBattle, 'scouting marks an immediate combat successor');
    const selector = `[data-choose-node="${nextBattle.id}"]`;
    const cardText = await lab.text(selector);
    assert.match(cardText, /招式/);
    const shippedEnemies = JSON.parse(readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
    const expectedFoes = nextBattle.enemyIds.map(id => shippedEnemies.find(foe => foe.id === id)).filter(Boolean);
    for (const foe of expectedFoes) {
      if (foe.intent?.label) assert.ok(cardText.includes(foe.intent.label));
      for (const intent of foe.intents || []) if (intent.label) assert.ok(cardText.includes(intent.label));
      for (const reaction of foe.reactions || []) if (reaction.label) assert.ok(cardText.includes(reaction.label));
    }
    await lab.click(selector);
    state = await lab.snapshot();
    assert.ok(state.battle.enemies.length > 0);
    assert.ok(state.battle.enemies.every(enemy => enemy.revealed === true));
    await lab.reload();
    state = await lab.snapshot();
    assert.ok(state.knownFacts.includes(`route_battle_intel:${nextBattle.id}`));
    assert.ok(state.battle.enemies.every(enemy => enemy.revealed === true));
  } finally { await lab.close(); }
});

test('NORMAL_RUN: buying route information spends two stones and reveals a successor battle', async () => {
  const lab = await openLab({ seed: 3 });
  try {
    await lab.click('[data-start-run]');
    const initial = await lab.snapshot();
    const market = initial.journey.graph.nodes.find(node => initial.journey.availableNodeIds.includes(node.id)
      && node.type === 'market' && node.choices?.includes('buy_information'));
    assert.ok(market, 'seed 3 starts with an ordinary market offering information');
    const screenshots = path.join(process.env.TEMP || '.', `wenzhen-route-intel-buy-information-${process.pid}.png`);
    await lab.click(`[data-choose-node="${market.id}"]`);
    await lab.click('[data-node-action="buy_information"]');
    let state = await lab.snapshot();
    assert.equal(state.stones, initial.stones - 2);
    const successors = market.nextIds.map(id => state.journey.graph.nodes.find(node => node.id === id))
      .filter(node => ['battle', 'elite', 'boss'].includes(node.type));
    for (const node of successors) assert.ok(state.knownFacts.includes(`route_battle_intel:${node.id}`));
    await lab.click('[data-prep-continue]');

    state = await lab.snapshot();
    const nextBattle = state.journey.graph.nodes.find(node => state.journey.availableNodeIds.includes(node.id)
      && ['battle', 'elite', 'boss'].includes(node.type)
      && state.knownFacts.includes(`route_battle_intel:${node.id}`));
    assert.ok(nextBattle);
    await lab.shoot(screenshots);
    const selector = `[data-choose-node="${nextBattle.id}"]`;
    const cardText = await lab.text(selector);
    assert.match(cardText, /招式/);
    const shippedEnemies = JSON.parse(readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
    const expectedFoes = nextBattle.enemyIds.map(id => shippedEnemies.find(foe => foe.id === id)).filter(Boolean);
    for (const foe of expectedFoes) {
      if (foe.intent?.label) assert.ok(cardText.includes(foe.intent.label));
      for (const intent of foe.intents || []) if (intent.label) assert.ok(cardText.includes(intent.label));
      for (const reaction of foe.reactions || []) if (reaction.label) assert.ok(cardText.includes(reaction.label));
    }
    await lab.click(selector);
    state = await lab.snapshot();
    assert.ok(state.battle.enemies.length > 0);
    assert.ok(state.battle.enemies.every(enemy => enemy.revealed === true));
    await lab.reload();
    state = await lab.snapshot();
    assert.ok(state.knownFacts.includes(`route_battle_intel:${nextBattle.id}`));
    assert.ok(state.battle.enemies.every(enemy => enemy.revealed === true));
    console.log(`BUY_INFORMATION_MAP_SCREENSHOT=${screenshots}`);
  } finally { await lab.close(); }
});
