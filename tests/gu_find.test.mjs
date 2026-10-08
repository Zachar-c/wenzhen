import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8'), context);
const rules = context.GuRules;
const dataContext = vm.createContext({});
vm.runInContext(
  fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8') + ';globalThis.DATA = DATA;',
  dataContext,
);
const data = dataContext.DATA;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('finding unbound Gu rejects unknown Gu and lethal or fatal search costs without mutation', () => {
  const wild = { vitality_grass_gu: 2 };
  const unknown = rules.findUnboundGu(
    { guId: 'missing_gu', healthCost: 2 },
    { vitality_grass_gu: {} },
    wild,
    8,
  );
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'invalid_gu_find');
  assert.deepEqual(plain(unknown.wild), wild);
  assert.equal(unknown.healthAfter, 8);

  for (const health of [2, 1]) {
    const fatal = rules.findUnboundGu(
      { guId: 'vitality_grass_gu', healthCost: 2 },
      { vitality_grass_gu: {} },
      wild,
      health,
    );
    assert.equal(fatal.ok, false);
    assert.equal(fatal.reason, 'insufficient_health');
    assert.equal(fatal.healthAfter, health);
    assert.deepEqual(plain(fatal.wild), wild);
  }

  assert.deepEqual(wild, { vitality_grass_gu: 2 });
});

test('finding unbound Gu costs health and adds one pending instance without changing inputs', () => {
  const find = { guId: 'vitality_grass_gu', healthCost: 2 };
  const byId = Object.fromEntries(data.gu.map((gu) => [gu.id, gu]));
  const wild = { vitality_grass_gu: 1, moonlight_gu: 2 };
  const result = rules.findUnboundGu(find, byId, wild, 7);

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'unbound_gu_found');
  assert.equal(result.healthBefore, 7);
  assert.equal(result.healthCost, 2);
  assert.equal(result.healthAfter, 5);
  assert.deepEqual(plain(result.wild), { vitality_grass_gu: 2, moonlight_gu: 2 });
  assert.deepEqual(find, { guId: 'vitality_grass_gu', healthCost: 2 });
  assert.deepEqual(wild, { vitality_grass_gu: 1, moonlight_gu: 2 });
});

test('found Gu remains pending until attunement transfers one instance and spends essence', () => {
  const byId = Object.fromEntries(data.gu.map((gu) => [gu.id, gu]));
  const found = rules.findUnboundGu(
    { guId: 'vitality_grass_gu', healthCost: 2 },
    byId,
    { vitality_grass_gu: 0 },
    7,
  );
  assert.equal(found.ok, true);
  assert.equal(found.wild.vitality_grass_gu, 1);

  const ownedBefore = { moonlight_gu: 1 };
  const essenceBefore = 20;
  const refined = rules.attuneWild(
    found.wild,
    ownedBefore,
    essenceBefore,
    'vitality_grass_gu',
    byId.vitality_grass_gu.rank,
  );
  assert.equal(refined.ok, true);
  assert.equal(refined.wild.vitality_grass_gu, 0);
  assert.equal(refined.owned.vitality_grass_gu, 1);
  assert.equal(refined.owned.moonlight_gu, 1);
  assert.equal(refined.trueQi, essenceBefore - refined.cost);
  assert.equal(found.wild.vitality_grass_gu, 1);
  assert.deepEqual(ownedBefore, { moonlight_gu: 1 });
  assert.equal(rules.attuneWild({}, {}, essenceBefore, 'vitality_grass_gu', byId.vitality_grass_gu.rank).ok, false);
});

test('run save roundtrip preserves found, refined, health, and essence fields', () => {
  const saveContext = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../js/lab_save.js', import.meta.url), 'utf8'), saveContext);
  const save = saveContext.LabSave;
  const state = {
    seed: 1,
    cultivation: 1,
    cultivationStage: 0,
    school: 'light',
    stones: 3,
    blood: 5,
    bloodMax: 24,
    lifeTime: 60,
    soul: 1,
    soulMax: 4,
    aptitude: 'bing',
    stage: 'one',
    owned: { moonlight_gu: 1, vitality_grass_gu: 1 },
    wild: { vitality_grass_gu: 0, moonlight_gu: 2 },
    equipped: [],
    battle: null,
    qiMax: 20,
    qi: 16,
    thought: 2,
    thoughtMax: 2,
    journey: { difficulty: 'normal', graph: { roots: ['find'], nodes: [{ id: 'find', type: 'wild_gu', choices: ['collect_gu'],
      findGu: { guId: 'vitality_grass_gu', healthCost: 2, sourceNote: 'game adaptation' } }] }, availableNodeIds: ['find'], completed: [], started: true },
    prepFor: null,
    reward: null,
    ending: null,
    shopSold: [],
    restUsed: false,
    journal: [],
    page: 'map',
    lootPity: 0,
    globalCodexIds: [],
    knownFacts: [],
    eventLog: [],
  };

  const decoded = save.decode(save.encode(state, 'gu-find-test'), 'gu-find-test');
  assert.equal(decoded.ok, true);
  assert.deepEqual(plain(decoded.state.journey.graph.nodes[0].findGu), state.journey.graph.nodes[0].findGu);
  assert.deepEqual(plain({
    blood: decoded.state.blood,
    qi: decoded.state.qi,
    owned: decoded.state.owned,
    wild: decoded.state.wild,
  }), {
    blood: 5,
    qi: 16,
    owned: { moonlight_gu: 1, vitality_grass_gu: 1 },
    wild: { vitality_grass_gu: 0, moonlight_gu: 2 },
  });
});
