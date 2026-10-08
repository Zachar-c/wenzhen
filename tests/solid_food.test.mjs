import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8'), context);
const rules = context.GuRules;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('solid food rules expose the three species, food, ration, and interval', () => {
  assert.deepEqual(plain(rules.solidGuIds), ['jade_skin_gu', 'white_jade_gu', 'white_boar_strength_gu']);
  assert.deepEqual(plain(rules.solidFoodRules), {
    jade_skin_gu: { food: 'jade', amount: 2, periodSteps: 50 },
    white_jade_gu: { food: 'jade', amount: 8, periodSteps: 100 },
    white_boar_strength_gu: { food: 'pork', amount: 1, periodSteps: 25 },
  });
});

test('jade skin, white jade, and white boar charge on their own elapsed-node periods', () => {
  const owned = { jade_skin_gu: 1, white_jade_gu: 1, white_boar_strength_gu: 1 };
  const start = rules.solidCareState(undefined, owned, 0);
  assert.deepEqual(plain(start), {
    jade: 2, pork: 1, steps: 0,
    lastFed: { jade_skin_gu: 0, white_jade_gu: 0, white_boar_strength_gu: 0 }, hungry: [],
  });
  const at25 = rules.advanceSolidCare(start, owned, 25);
  assert.equal(at25.pork, 0);
  assert.equal(at25.jade, 2);
  const at50 = rules.advanceSolidCare(at25, owned, 50);
  assert.equal(at50.jade, 0);
  const fed = rules.buySolidFood(at50, owned, 20, 'jade', 50);
  assert.equal(fed.ok, true);
  assert.equal(fed.stones, 8);
  assert.equal(fed.care.jade, 8);
  const at100 = rules.advanceSolidCare(fed.care, owned, 100);
  assert.equal(at100.jade, 6);
  assert.deepEqual(plain(at100.hungry), ['white_boar_strength_gu', 'white_jade_gu']);
});

test('multiple Gu and multiple copies consume per-instance rations', () => {
  const owned = { jade_skin_gu: 2, white_boar_strength_gu: 3 };
  const care = rules.advanceSolidCare({ jade: 10, pork: 5, steps: 0,
    lastFed: { jade_skin_gu: 0, white_boar_strength_gu: 0 } }, owned, 50);
  assert.equal(care.jade, 6);
  assert.equal(care.pork, 2);
  assert.deepEqual(plain(care.hungry), ['white_boar_strength_gu']);
});

test('shortage makes only the affected Gu hungry and avoids repeated charges', () => {
  const owned = { jade_skin_gu: 1, white_boar_strength_gu: 1 };
  const hungry = rules.advanceSolidCare({ jade: 1, pork: 0, steps: 0,
    lastFed: { jade_skin_gu: 0, white_boar_strength_gu: 0 } }, owned, 50);
  assert.deepEqual(plain(hungry.hungry), ['jade_skin_gu', 'white_boar_strength_gu']);
  assert.deepEqual(plain(rules.advanceSolidCare(hungry, owned, 100)), plain({ ...hungry, steps: 100 }));
});

test('purchase charges stones once and restores hungry Gu only when its ration is covered', () => {
  const owned = { jade_skin_gu: 4 };
  const hungry = rules.solidCareState({ jade: 0, pork: 1 }, owned, 20);
  hungry.hungry.push('jade_skin_gu');
  const insufficient = rules.buySolidFood(hungry, owned, 11, 'jade', 20);
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.reason, 'insufficient_stone');
  const fed = rules.buySolidFood(hungry, owned, 12, 'jade', 20);
  assert.equal(fed.ok, true);
  assert.equal(fed.care.jade, 0);
  assert.deepEqual(plain(fed.care.hungry), []);
  assert.equal(fed.care.lastFed.jade_skin_gu, 20);
  const secondPurchase = rules.buySolidFood(fed.care, owned, 20, 'jade', 20);
  assert.equal(secondPurchase.ok, true);
  assert.equal(secondPurchase.care.jade, 8);
  assert.equal(rules.buySolidFood(fed.care, owned, 20, 'beans', 20).reason, 'invalid_food');
});

test('selling a species clears its care state and newly owned species starts at current progress', () => {
  const before = rules.solidCareState({ jade: 3, pork: 2, steps: 9,
    lastFed: { jade_skin_gu: 4, white_boar_strength_gu: 3 }, hungry: ['jade_skin_gu', 'white_boar_strength_gu'] },
  { jade_skin_gu: 1, white_boar_strength_gu: 1 }, 10);
  const afterSale = rules.advanceSolidCare(before, { white_boar_strength_gu: 1 }, 11);
  assert.deepEqual(plain(afterSale.lastFed), { white_boar_strength_gu: 3 });
  assert.deepEqual(plain(afterSale.hungry), ['white_boar_strength_gu']);
  const newlyHeld = rules.solidCareState(afterSale, { jade_skin_gu: 1, white_boar_strength_gu: 1 }, 30);
  assert.deepEqual(plain(newlyHeld.lastFed), { jade_skin_gu: 30, white_boar_strength_gu: 3 });
  assert.deepEqual(plain(newlyHeld.hungry), ['white_boar_strength_gu']);
});

test('old saves get initial stock and current last-fed markers without historical debit', () => {
  const owned = { jade_skin_gu: 3, white_jade_gu: 2, white_boar_strength_gu: 4 };
  const initialized = rules.solidCareState(undefined, owned, 120);
  assert.equal(initialized.jade, 2);
  assert.equal(initialized.pork, 1);
  assert.deepEqual(plain(initialized.lastFed), {
    jade_skin_gu: 120, white_jade_gu: 120, white_boar_strength_gu: 120,
  });
  assert.deepEqual(plain(rules.advanceSolidCare(initialized, owned, 120)), plain(initialized));
});

test('actual combat ownership excludes hungry solid Gu and keeps permanent strength and inventory', () => {
  const source = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function fedGuOwned()');
  const end = source.indexOf('function rollVictoryLoot(', start);
  const state = { owned: { jade_skin_gu: 1, white_jade_gu: 1, white_boar_strength_gu: 1, moonlight_gu: 1 },
    journey: { completed: [] }, solidCare: { jade: 0, pork: 0, steps: 0,
      lastFed: { jade_skin_gu: 0, white_jade_gu: 0, white_boar_strength_gu: 0 },
      hungry: ['white_jade_gu', 'white_boar_strength_gu'] },
    modifierLedger: [{ attribute: 'attack', amount: 3, persistence: 'session_permanent' }] };
  const before = plain(state);
  const ctx = vm.createContext({ state, GuRules: rules, currentGuCare: () => ({ hungry: false }) });
  vm.runInContext(source.slice(start, end), ctx);
  assert.deepEqual(plain(ctx.fedGuOwned()), { jade_skin_gu: 1, white_jade_gu: 0, white_boar_strength_gu: 0, moonlight_gu: 1 });
  assert.deepEqual(state, before);
});

test('actual body training preview refuses a hungry White Boar without modifying its permanent gains', () => {
  const source = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function heldPlayerGuInstances()');
  const end = source.indexOf('function leafProductionPreview(', start);
  const ctx = vm.createContext({ GuRules: rules, state: {
    owned: { white_boar_strength_gu: 1 }, cultivation: 1, qi: 5, stones: 5, prepFor: 'prep2',
    modifierLedger: [{ attribute: 'attack', amount: 1, persistence: 'session_permanent' }],
  }, currentSolidCare: () => ({ hungry: ['white_boar_strength_gu'] }) });
  vm.runInContext(fs.readFileSync(new URL('../js/run_rules.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(new URL('../js/human_rules.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(source.slice(start, end), ctx);
  const before = plain(ctx.state);
  const result = ctx.bodyTrainingPreview({ id: 'white_boar_strength_gu', trueQiCost: 1, feedingCost: 1,
    effect: { kind: 'body_training', attribute: 'attack', amount: 1, cap: 3 } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'gu_hungry');
  assert.deepEqual(plain(ctx.state), before);
});
