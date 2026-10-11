import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/build_rules.js', import.meta.url), 'utf8'), context);
const rules = context.BuildRules;
test('slots cap and repeated refresh costs preserve resource pressure', () => {
  assert.equal(rules.slots(0), 3);
  assert.equal(rules.slots(9), 6);
  assert.equal(rules.refreshCost(0), 2);
  assert.equal(rules.refreshCost(3), 8);
});
test('automatic choices respect healing priority, counters, support budget and distance', () => {
  const attack = {id:'moon',instanceId:'moon::1',battleEffect:{kind:'strike'},plan:{damage:4},trueQiCost:2,thoughtCost:1};
  const heal = {id:'leaf',battleEffect:{kind:'heal'},plan:{heal:4}};
  const support = {id:'light',battleEffect:{kind:'support'},plan:{support:{targetGuId:'moon'}},trueQiCost:1,thoughtCost:1,availableQi:3,availableThought:3};
  const base = {candidates:[attack,heal,support],healthRatio:0.5,strategy:'balanced',distance:0};
  assert.equal(rules.choose(base).gu, heal);
  assert.equal(rules.choose({...base,healthRatio:1,counter:true}).kind,'basic');
  assert.equal(rules.choose({...base,healthRatio:1}).gu,support);
  assert.equal(rules.choose({...base,healthRatio:1,candidates:[attack,{...support,availableQi:2}]}).gu,attack);
  assert.equal(rules.choose({...base,candidates:[],distance:20}).kind,'approach');
});
