import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const recipes = readJson('data/refinement_recipes.json').recipes;
const releaseIds = new Set(readJson('data/release_gu.json'));
const gu = readJson('data/gu.json');
const guById = Object.fromEntries(gu.map(item => [item.id, item]));
const context = vm.createContext({});
vm.runInContext(`${readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8')}\nglobalThis.rules=GuRules;`, context);
const rules = context.rules;
const supported = recipes.filter(r => r.web_release === true && !r.retired
  && releaseIds.has(r.output_gu_id) && r.input_gu_ids.every(id => releaseIds.has(id)));

test('首版只开放输入输出均已核验的月芒与白玉固定配方', () => {
  assert.deepEqual(supported.map(r => r.id).sort(), ['moonlight_glow', 'white_jade_basic']);
  assert.deepEqual(supported.find(r => r.id === 'moonlight_glow').input_gu_ids,
    ['moonlight_gu', 'small_light_gu', 'small_light_gu']);
  assert.equal(supported.find(r => r.id === 'moonlight_glow').output_gu_id, 'moon_glow_gu');
  assert.deepEqual(supported.find(r => r.id === 'white_jade_basic').input_gu_ids,
    ['jade_skin_gu', 'white_boar_strength_gu']);
  assert.equal(supported.find(r => r.id === 'white_jade_basic').output_gu_id, 'white_jade_gu');
  assert.ok(supported.every(r => r.success_roll_max === 100));
});

test('settleForge consumes the exact inputs and stone cost and produces the output', () => {
  const recipe = supported.find(r => r.id === 'moonlight_glow');
  const before = { owned: { moonlight_gu: 1, small_light_gu: 2 }, stones: 12, playerRank: 2 };
  const result = rules.settleForge(recipe, before, guById);
  assert.equal(result.ok, true);
  assert.equal(result.successRate, 100);
  assert.deepEqual(JSON.parse(JSON.stringify(result.owned)), { moonlight_gu: 0, small_light_gu: 0, moon_glow_gu: 1 });
  assert.equal(result.stones, 2);
  assert.deepEqual(before, { owned: { moonlight_gu: 1, small_light_gu: 2 }, stones: 12, playerRank: 2 });
});

test('settleForge rejects missing Gu, stones, rank, unsafe rates and retired recipes without mutating inputs', () => {
  const recipe = supported.find(r => r.id === 'moonlight_glow');
  const state = { owned: { moonlight_gu: 1, small_light_gu: 1 }, stones: 12, playerRank: 2 };
  for (const [patch, reason] of [
    [{}, 'missing_ingredients'],
    [{ owned: { moonlight_gu: 1, small_light_gu: 2 }, stones: 9 }, 'insufficient_stones'],
    [{ owned: { moonlight_gu: 1, small_light_gu: 2 }, playerRank: 1 }, 'insufficient_rank'],
  ]) {
    const result = rules.settleForge(recipe, { ...state, ...patch }, guById);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
  }
  assert.equal(rules.settleForge({ ...recipe, success_roll_max: 90 }, state, guById).ok, false);
  assert.equal(rules.settleForge({ ...recipe, retired: true }, state, guById).ok, false);
  assert.equal(rules.settleForge(recipe, { ...state, owned: { moonlight_gu: '1', small_light_gu: 2 } }, guById).ok, false);
  assert.deepEqual(state, { owned: { moonlight_gu: 1, small_light_gu: 1 }, stones: 12, playerRank: 2 });
});
