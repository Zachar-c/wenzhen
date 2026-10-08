import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../js/main.js');

test('generated bitter enemy loadout reaches the formal entry with its real Gu effect', () => {
  const context = vm.createContext({});
  vm.runInContext(`${read('../js/data.js')};globalThis.data = DATA;`, context);
  const gu = context.data.gu.find(entry => entry.id === 'force_atk_4_02_gu');
  assert.equal(gu.battleEffect.kind, 'maintained');
  assert.equal(gu.trueQiCost, 2);
  assert.equal(gu.battleEffect.modifiers[0].effect_id, 'injury_strength');
  for (const [id, guId] of [['force_path_adept', gu.id]]) {
    const enemy = context.data.enemies.find(entry => entry.id === id);
    assert.ok(enemy.guLoadout.required.includes(guId), 'generator must preserve the source loadout');
    assert.ok(enemy.guRefs.includes(guId), 'carried Gu must be visible');
    assert.equal(enemy.attackSource, 'gu');
  }
});

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `extract ${startMarker}`);
  return source.slice(start, end).trim();
}

test('legacy bitter enemy migrates once, keeps battle state, then plans its Gu', () => {
  const version = 'current';
  let savedVersion = 'legacy';
  let savedState = {
    seed: 17,
    battle: { nodeId: 'node-1', turn: 4, log: [], enemies: [{
      id: 'force_path_adept', name: '苦力蛊师', grade: 'cultivator', rank: 4,
      hp: 6, hpMax: 10, essence: 3, depleted: true, portrait: 'old-force.png',
      attackSource: 'innate', plannedAction: { kind: 'basic_attack', label: '拳脚攻击' },
    }] },
    journey: { completed: ['old-node'], nodeId: 'node-1' },
    cultivation: 4, cultivationStage: 1, aptitude: 'bing', qiMax: 12,
    qi: 7, blood: 11, stones: 23, owned: { moon_shadow_gu: 1 },
    equipped: [], journal: [],
  };
  let writes = 0;
  const storage = {};
  const gu = { id: 'force_atk_4_02_gu', rank: 4, trueQiCost: 2, thoughtCost: 1,
    battleEffect: { kind: 'maintained', focus_cost: 1, modifiers: [{ attribute: 'attack', amount: 1, effect_id: 'injury_strength' }] } };
  const context = vm.createContext({
    DATA: { contentVersion: version, compatibleContentVersions: ['legacy'], enemies: [{
      id: 'force_path_adept', grade: 'cultivator', aptitude: 'ding',
      guLoadout: { required: [gu.id] },
    }] },
    GU_BY_ID: { [gu.id]: gu },
    LabSave: {
      read: () => ({ ok: true, state: JSON.parse(JSON.stringify(savedState)),
        legacyContentVersion: savedVersion === version ? '' : savedVersion }),
      write: (_storage, state, contentVersion) => {
        writes += 1;
        savedState = JSON.parse(JSON.stringify(state));
        savedVersion = contentVersion;
        return { ok: true };
      },
    },
    GuRules: {
      solidCareState: () => ({}), careState: () => ({}),
      enemyEssenceState: enemy => ({ current: enemy.essence }),
      activationReason: () => '',
    },
    currentKillMoves: () => [],
    saveStorage: () => storage,
    fresh: () => { throw new Error('valid legacy save must not be replaced'); },
  });
  vm.runInContext(read('../js/run_rules.js'), context);
  vm.runInContext(read('../js/human_rules.js'), context);
  vm.runInContext(`let state; let bootSaveIssue = null; let saveWriteBlockedUntilNewRun = false;
    function saveStorage() { return null; }
    function contentVersion() { return DATA.contentVersion; }
    function compatibleSaveVersions() { return DATA.compatibleContentVersions; }
    ${extract(main, 'function recomputeQiMax() {', '\n// 自定义只存组件')}
    ${extract(main, 'function bootFromSave() {', '\nlet state;')}
    ${extract(main, 'function pluginHumanPlan(b, enemy) {', '\nfunction resolvePluginHumanTurn')}
    globalThis.__boot = bootFromSave;
    globalThis.__getState = () => state;
    globalThis.__plan = pluginHumanPlan;`, context);

  context.__boot();
  let enemy = context.__getState().battle.enemies[0];
  assert.equal(enemy.hp, 6);
  assert.equal(enemy.essence, 3, 'migration does not charge the first activation retroactively');
  assert.equal(enemy.depleted, true);
  assert.equal(enemy.portrait, 'old-force.png');
  assert.equal(enemy.human.guInstances[0].state, 'held');
  assert.equal(enemy.plannedAction.kind, 'gu', 'restored intent shows the same Gu the enemy will actually use');
  assert.equal(writes, 1, 'legacy schema is persisted once');
  assert.ok(!context.__getState().journal.some(line => /饲养|口粮|猪肉|月兰/.test(line)), 'legacy restore must not announce a retired food system');

  context.__boot();
  enemy = context.__getState().battle.enemies[0];
  assert.equal(writes, 1, 'second restore does not migrate or write again');
  assert.equal(enemy.essence, 3);
  assert.equal(enemy.human.guInstances.length, 1, 'second restore reuses migrated actor');
  assert.equal(enemy.depleted, true);
  assert.equal(enemy.portrait, 'old-force.png');
  assert.equal(context.__plan(context.__getState().battle, enemy).kind, 'gu',
    'an injured migrated foe prepares bitter strength instead of a zero-damage punch');
  assert.equal(enemy.attackSource, 'gu', 'battle UI must report the newly migrated Gu loadout');
  savedState.battle.enemies[0].human.baseline.essenceMax = 11;
  const oldPlan = JSON.stringify(savedState.battle.enemies[0].plannedAction);
  context.__boot();
  enemy = context.__getState().battle.enemies[0];
  assert.equal(enemy.human.baseline.essenceMax, 17);
  assert.equal(enemy.essence, 3, 'existing actors receive the new capacity without a free refill');
  assert.equal(JSON.stringify(enemy.plannedAction), oldPlan, 'keep the preannounced action');
  assert.equal(context.__getState().battle.turn, 4);
  assert.equal(writes, 2);
  context.__boot();
  assert.equal(writes, 2, 'capacity migration is persisted only once');
});
