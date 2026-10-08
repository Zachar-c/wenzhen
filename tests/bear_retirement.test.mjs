import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = (name) => fs.readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
const runtime = vm.createContext({});
vm.runInContext(source('run_rules'), runtime);
vm.runInContext(source('gu_rules'), runtime);
vm.runInContext(source('loot_rules'), runtime);
vm.runInContext(`${source('data')}\nglobalThis.DATA = DATA;`, runtime);
vm.runInContext(source('lab_save'), runtime);
const data = runtime.DATA;
const plain = (value) => JSON.parse(JSON.stringify(value));
const bearId = 'bear_strength_gu';
const bear = data.gu.find((gu) => gu.id === bearId);
const guById = Object.fromEntries(data.gu.map((gu) => [gu.id, gu]));

test('bear retirement keeps saved inventory quantities while disabling stale combat and healing semantics', () => {
  assert.ok(bear, 'retired definition remains available for old inventory references');
  assert.equal(bear.playable, false);

  const staleDefinition = {
    ...bear,
    playable: false,
    rank: 1,
    role: 'healing',
    combat: 'heal',
    effect: { kind: 'heal', consumable: true, amount: 2 },
    battleEffect: { kind: 'heal', amount: 2 },
  };
  assert.equal(runtime.GuRules.activationReason(staleDefinition, { playerRank: 1, thought: 3, trueQi: 20 }), 'gu_unavailable');
  assert.deepEqual(plain(runtime.GuRules.combatRoster([staleDefinition], { [bearId]: 2 }, {
    playerRank: 1, thought: 3, trueQi: 20,
  })), []);
  assert.equal(runtime.GuRules.killMoveGateMissReason({ recipe: [bearId], componentConditionOverride: true }, {
    [bearId]: staleDefinition,
  }), 'gu_unavailable');

  assert.equal(data.recipes.some((recipe) => recipe.output === bearId
    || (recipe.inputs || []).includes(bearId)), false, 'no live recipe produces or consumes the retired Gu');
});

test('retired bear is filtered from every loot candidate source, including legacy buckets', () => {
  const table = {
    gu_chance_pct: 100,
    forced_rarity: 'rare',
    gu_pool: {
      weights: { rare: 1 },
      by_rarity: { rare: [bearId, 'moonlight_gu'] },
    },
  };
  const stale = { ...bear, rarity: 'rare', playable: false };
  const live = { ...guById.moonlight_gu, rarity: 'rare', playable: true };
  const definitions = { [bearId]: stale, moonlight_gu: live };
  const args = {
    tick: 0, tier: 'elite', school: 'force',
    schoolPools: { force: [bearId, 'moonlight_gu'] },
    guById: definitions,
    carriedPool: [bearId],
    discoveryPool: [bearId],
    supportPool: [bearId],
    choiceCount: 3,
  };
  for (let seed = 1; seed <= 20; seed += 1) {
    const rolled = runtime.LootRules.rollGu(table, { ...args, seed });
    assert.equal(rolled.guId, 'moonlight_gu', `legacy rarity/school pool seed=${seed}`);
    const choices = runtime.LootRules.rollGuChoices(table, { ...args, seed });
    assert.ok(choices.guIds.length > 0, `live alternative remains selectable seed=${seed}`);
    assert.ok(!choices.guIds.includes(bearId), `dormant Gu leaked from a candidate source seed=${seed}`);
    assert.ok(choices.guIds.includes('moonlight_gu'), `legacy table alternative was lost seed=${seed}`);
  }
});

test('save roundtrip preserves old owned and wild bear quantities without reinterpreting them', () => {
  const state = {
    seed: 1, cultivation: 1, cultivationStage: 0, school: 'light', stones: 3,
    blood: 20, bloodMax: 20, lifeTime: 60, soul: 1, soulMax: 4,
    aptitude: 'bing', stage: 'one', owned: { [bearId]: 2 }, wild: { [bearId]: 3 },
    equipped: [], battle: null, qiMax: 20, qi: 16, thought: 2, thoughtMax: 2,
    journey: { difficulty: 'normal', graph: { roots: ['node'], nodes: [{ id: 'node', type: 'battle' }] },
      availableNodeIds: ['node'], completed: [], started: true },
    prepFor: null, reward: null, ending: null, shopSold: [], restUsed: false,
    journal: [], page: 'map', lootPity: 0, globalCodexIds: [], knownFacts: [], eventLog: [],
  };
  const decoded = runtime.LabSave.decode(runtime.LabSave.encode(state, 'bear-retirement'), 'bear-retirement');
  assert.equal(decoded.ok, true);
  assert.deepEqual(plain({ owned: decoded.state.owned, wild: decoded.state.wild }), {
    owned: { [bearId]: 2 }, wild: { [bearId]: 3 },
  });
});

test('inventory renders dormant bear as retained stock with unknown-use wording and sale option', () => {
  const journey = source('journey');
  const start = journey.indexOf('function inventoryCard(gu) {');
  const end = journey.indexOf('\nfunction gainInsightPanel()', start);
  assert.ok(start >= 0 && end > start, 'inventoryCard source boundaries remain identifiable');
  const cardContext = vm.createContext({
    state: { owned: { [bearId]: 2 } },
    RunFlow: { sellValue: (value) => Math.max(1, Math.floor(value / 2)) },
  });
  vm.runInContext(`${journey.slice(start, end)}\nglobalThis.renderInventoryCard = inventoryCard;`, cardContext);
  const card = cardContext.renderInventoryCard(bear);
  assert.match(card, /×2/);
  assert.match(card, /熊力蛊/);
  assert.match(card, /用途待核实/);
  assert.match(card, /data-sell-gu="bear_strength_gu"/);
  assert.doesNotMatch(card, /1 转|气血 \+2|疗伤/);
});


test('actual attunement and retired forge actions preserve old stock and resources', () => {
  const main = source('main');
  const state = { owned: { [bearId]: 2, jade_skin_gu: 1, white_boar_strength_gu: 1 }, wild: { [bearId]: 3 }, qi: 12, stones: 20 };
  const messages = [];
  const ctx = vm.createContext({ state, GU_BY_ID: guById, DATA: data, GuRules: runtime.GuRules,
    assertRunMutable: () => true, toast: message => messages.push(message) });
  const methods = ['attuneGu', 'forge'].map(name => {
    const start = main.indexOf(`  ${name}(`);
    const end = main.indexOf('\n  },', start);
    assert.ok(start >= 0 && end > start);
    return main.slice(start, end + 5);
  });
  vm.runInContext(`globalThis.act = {${methods.join('\n')}};`, ctx);
  ctx.act.attuneGu(bearId);
  ctx.act.forge('bear_split');
  assert.deepEqual(state, { owned: { [bearId]: 2, jade_skin_gu: 1, white_boar_strength_gu: 1 }, wild: { [bearId]: 3 }, qi: 12, stones: 20 });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /用途尚未核实/);
});
