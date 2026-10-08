import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
const rulesContext = vm.createContext({});
for (const file of ['run_rules.js', 'node_action_rules.js']) vm.runInContext(read(file), rulesContext);
const rules = rulesContext.NodeActionRules;
const event = { id: 'miasma_meditation', title: '瘴口调息', health_cost: 2, essence_gain: 6 };
const plain = value => JSON.parse(JSON.stringify(value));

test('essence event restores only available capacity; full and low-health accepts are rejected', () => {
  const partial = rules.resolveEvent('accept_event', event, { health: 8, essence: 8, essenceMax: 10 });
  assert.equal(partial.ok, true);
  assert.equal(partial.healthAfter, 6);
  assert.equal(partial.essenceAfter, 10);
  assert.equal(partial.essenceAfter - partial.essenceBefore, 2);

  const fullCards = rules.eventCards(event, { health: 8, essence: 10, essenceMax: 10 });
  assert.equal(fullCards[0].available, false);
  assert.equal(fullCards[0].blockReason, '真元已满，无需冒险调息。');
  assert.equal(rules.resolveEvent('accept_event', event, { health: 8, essence: 10, essenceMax: 10 }).reason, 'essence_full');
  assert.equal(rules.resolveEvent('accept_event', event, { health: 2, essence: 2, essenceMax: 10 }).reason, 'insufficient_health');

  const left = rules.resolveEvent('leave', event, { health: 8, stones: 4, essence: 3, essenceMax: 10 });
  assert.equal(left.accepted, false);
  assert.deepEqual(plain([left.healthAfter, left.stoneAfter, left.essenceAfter]), [8, 4, 3]);
});

function actualActionFixture({ health = 8, essence = 8, essenceMax = 10 } = {}) {
  const node = { id: 'poison_fog_vein', type: 'event', eventId: event.id, event };
  const state = { blood: health, stones: 4, qi: essence, qiMax: essenceMax, prepFor: null,
    knownFacts: [], journal: [], eventLog: [] };
  const calls = { prep: 0, draw: 0, toast: [] };
  const main = read('main.js');
  const start = main.indexOf('  resolveNodeAction(choiceId) {');
  const end = main.indexOf('\n  // 休整节点的一步', start);
  assert.ok(start >= 0 && end > start, 'extract actual resolveNodeAction');
  const method = main.slice(start, end).trim().replace(/,$/, '');
  const context = vm.createContext({
    state, NODE_ACTION_TYPES: rules.nodeTypes, NodeActionRules: rules,
    currentNode: () => node,
    assertRunMutable: () => true,
    toast: (message) => calls.toast.push(message),
    draw: () => { calls.draw += 1; },
    recordEvent(action, after, reason, targets) { state.eventLog.push({ action, after, reason, targets }); },
    Sfx: { success() {} },
    act: { openPrep() { calls.prep += 1; state.prepFor = node.id; } },
  });
  vm.runInContext(`globalThis.resolveNodeAction = ({ ${method} }).resolveNodeAction;`, context);
  return { context, state, calls };
}

test('actual node action applies capped essence once and logs the recovered amount with event ID', () => {
  const { context, state, calls } = actualActionFixture();
  context.resolveNodeAction('accept_event');
  context.resolveNodeAction('accept_event');
  assert.equal(state.blood, 6);
  assert.equal(state.qi, 10);
  assert.equal(state.eventLog.length, 1);
  assert.equal(state.eventLog[0].after.essence_recovered, 2);
  assert.deepEqual(plain(state.eventLog[0].targets), ['miasma_meditation']);
  assert.equal(state.eventLog[0].reason, 'event_accepted');
  assert.equal(calls.prep, 1);
});

test('actual node action refuses full-essence accept without paying health or recording an event', () => {
  const { context, state, calls } = actualActionFixture({ health: 8, essence: 10 });
  context.resolveNodeAction('accept_event');
  assert.equal(state.blood, 8);
  assert.equal(state.qi, 10);
  assert.equal(state.eventLog.length, 0);
  assert.equal(calls.prep, 0);
  assert.deepEqual(calls.toast, ['真元已满，无需冒险调息。']);
});
