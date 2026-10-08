import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['run_rules.js', 'run_flow.js', 'node_action_rules.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8'), context);
}
vm.runInContext(fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8') + ';globalThis.DATA = DATA;', context);

const { RunFlow, NodeActionRules, DATA } = context;
test('formal one-to-five pools exclude six-rank eagles and retain two fifth-rank elites', () => {
  const byId = new Map(DATA.enemies.map(enemy => [enemy.id, enemy]));
  for (const id of ['dragon_eagle', 'wild_iron_crown_eagle']) {
    assert.equal(byId.get(id).rank, 6, 'keep the entity for existing saves');
  }
  for (const pools of Object.values(DATA.flow.poolsBySegment)) {
    for (const id of Object.values(pools).flat()) assert.ok(byId.get(id).rank <= 5, id);
  }
  assert.deepEqual(Array.from(DATA.flow.poolsBySegment['5'].elite).sort(),
    ['blood_droplet_swarm', 'jiaodian_bei']);
});
const pools = Object.fromEntries([1, 2, 3, 4, 5].map((segment) => [String(segment), {
  battle: [`c${segment}`], elite: [`e${segment}`], boss: [`b${segment}`],
}]));
const enemyById = Object.fromEntries([1, 2, 3, 4, 5].flatMap((segment) => [
  [`c${segment}`, { id: `c${segment}` }], [`e${segment}`, { id: `e${segment}` }], [`b${segment}`, { id: `b${segment}` }],
]));

test('stage is a minimum segment: advanced templates wait, while basic and unstaged stay available', () => {
  const templates = [
    ...['one', 'two', 'three', 'four', 'five'].map((stage, index) => ({
      id: `stage_${stage}`, stage, type: 'market', choices: ['work'],
    })),
    { id: 'generic', type: 'hazard', choices: ['leave'] },
  ];
  const graph = RunFlow.generateGraph({ seed: 901, pools, enemyById, nonCombatTemplates: templates });
  for (let segment = 1; segment <= 5; segment += 1) {
    const assigned = graph.nodes.filter((node) => node.segment === segment && node.routeTemplateId);
    assert.equal(assigned.length, graph.prepPerSegment);
    for (const node of assigned) {
      const template = templates.find((entry) => entry.id === node.routeTemplateId);
      const unlockSegment = ['one', 'two', 'three', 'four', 'five'].indexOf(template.stage) + 1;
      assert.ok(!template.stage || unlockSegment <= segment);
    }
  }
  const segmentIds = new Map([1, 2, 3, 4, 5].map((segment) => [segment,
    new Set(graph.nodes.filter((node) => node.segment === segment && node.routeTemplateId).map((node) => node.routeTemplateId))]));
  assert.ok([...segmentIds.get(1)].some((id) => ['stage_one', 'generic'].includes(id)));
  assert.ok([...segmentIds.get(5)].some((id) => ['stage_one', 'generic'].includes(id)));
  assert.ok(![...segmentIds.get(1)].includes('stage_two'));
  assert.ok(![...segmentIds.get(4)].includes('stage_five'));
  for (const node of graph.nodes) {
    for (const nextId of node.nextIds) assert.ok(RunFlow.nodeById(graph, nextId), `${node.id} -> ${nextId}`);
  }
});

test('real DATA event templates retain at least one ready event and stage mapping is honored', () => {
  const events = DATA.events;
  const eventById = new Map(events.map((event) => [event.id, event]));
  const templates = DATA.nodes.filter((node) => NodeActionRules.nodeTypes.includes(node.type));
  const eventTemplates = templates.filter((node) => node.type === 'event');
  assert.ok(eventTemplates.length > 0);
  for (const template of eventTemplates) {
    const ready = (template.eventPool || [template.eventId || template.id])
      .map((id) => eventById.get(id))
      .filter((event) => NodeActionRules.supportsEvent(event));
    assert.ok(ready.length > 0, `${template.id} must not become an empty event template`);
  }

  const stageNames = ['one', 'two', 'three', 'four', 'five'];
  const counts = stageNames.map((stage) => templates.filter((node) => node.stage === stage
    && (node.type !== 'event' || (node.eventPool || [node.eventId || node.id])
      .some((id) => {
        const event = eventById.get(id);
        return NodeActionRules.supportsEvent(event);
      }))).length);
  assert.deepEqual(counts, [5, 5, 1, 1, 1]);
  const meditation = templates.find((node) => node.id === 'poison_fog_vein');
  assert.ok(meditation, 'new fifth-stage template is present');
  assert.equal(meditation.stage, 'five');
  assert.equal(meditation.eventId, 'miasma_meditation');
  assert.ok(events.some((event) => event.id === meditation.eventId), 'template resolves its exact event ID');
  const graph = RunFlow.generateGraph({
    seed: 101,
    pools: Object.fromEntries([1, 2, 3, 4, 5].map((segment) => [String(segment), {
      battle: [`c${segment}`], elite: [`e${segment}`], boss: [`b${segment}`],
    }])),
    enemyById: Object.fromEntries([1, 2, 3, 4, 5].flatMap((segment) => [
      [`c${segment}`, { id: `c${segment}` }], [`e${segment}`, { id: `e${segment}` }], [`b${segment}`, { id: `b${segment}` }],
    ])),
    nonCombatTemplates: templates,
    events,
  });
  for (let segment = 1; segment <= 5; segment += 1) {
    assert.equal(graph.nodes.filter((node) => node.segment === segment && node.routeTemplateId).length, graph.prepPerSegment);
  }
  assert.ok(!graph.nodes.some((node) => node.segment < 5 && node.routeTemplateId === meditation.id),
    'fifth-stage meditation does not appear in earlier segments');
  assert.ok(graph.nodes.some((node) => node.segment === 5
    && ['toxic_mountain_path', 'flooded_cave', 'village_short_work', 'ridge_market'].includes(node.routeTemplateId)),
  'early-stage hazards and markets remain eligible in the final segment');

  const invalidStageGraph = RunFlow.generateGraph({
    seed: 1, pools: {}, enemyById: {},
    nonCombatTemplates: [{ id: 'unknown_stage', stage: 'six', type: 'market', choices: ['work'] }],
  });
  assert.equal(invalidStageGraph.nodes.some((node) => node.routeTemplateId === 'unknown_stage'), false,
    'unknown declared stages are rejected');
});
