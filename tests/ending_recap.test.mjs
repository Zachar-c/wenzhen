import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

test('ending recap attributes recorded choices without claiming inventory was used', () => {
  const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('function buildRunRecap()'), source.indexOf('function saveEndingArchive('));
  const state = { cultivation: 4, cultivationStage: 3, owned: { moonlight_gu: 2 },
    journey: { graph: {}, completed: ['rest', 'fight'] }, eventLog: [
      { action: 'breakthrough', reason: 'small_breakthrough_sari' },
      { action: 'breakthrough', reason: 'rank_4_breakthrough' },
      { action: 'refine_gu', reason: 'refinement_failed_destroyed_inputs' },
      { action: 'shop', reason: 'shop_soul_nourishment' },
      { action: 'battle_retreat' },
      { action: 'battle_loot', reason: 'loot_gu_gained', targets: ['moonlight_gu'] },
      { action: 'battle_loot', reason: 'build_insight_offered', targets: ['moonlight_gu'] },
      { action: 'battle_loot', reason: 'loot_gu_declined' },
      { action: 'shop', reason: 'shop_purchase' },
      { action: 'shop', reason: 'shop_gu_fang_unlock_completed' },
      { action: 'choose_action', reason: 'gu_purchased' },
      { action: 'choose_action', reason: 'gu_found' },
      { action: 'choose_action', reason: 'event_accepted', after: { gu_acquired: 'moonlight_gu' } },
      { action: 'choose_action', reason: 'event_accepted', after: { gu_acquired: null } },
      { action: 'choose_action', reason: 'event_left', after: { gu_acquired: null } },
      { action: 'sell_gu', reason: 'gu_sold', targets: ['moonlight_gu'] },
    ] };
  const ctx = vm.createContext({ state, DATA: { nodeTypes: [], gu: [{ id: 'moonlight_gu', name: '月光蛊', rank: 1 }] },
    RunFlow: { stageLabel: () => '四转巅峰', nodeById: (_, id) => ({ type: id === 'rest' ? 'rest' : 'battle' }) },
    NodeActionRules: { typeLabels: () => ({ rest: '休整' }) } });
  vm.runInContext(block, ctx);
  const lines = ctx.buildRunRecap().join(' / ');
  assert.match(lines, /元石 1 次，舍利蛊 1 次/);
  assert.match(lines, /休整 1 次/);
  assert.match(lines, /付费养魂 1 次/);
  assert.match(lines, /战利得蛊 1 次，坊市购蛊 1 次，旅途补给 1 次，奇遇\/遗藏得蛊 1 次，药圃搜得 1 次；售蛊 1 次/);
  assert.doesNotMatch(lines, /炼蛊|失败 1 次/, 'new recaps do not restore retired refinement statistics from old events');
  assert.match(lines, /月光蛊 ×2/);
  assert.match(lines, /库存记录，不代表战斗使用次数/);
  assert.doesNotMatch(lines, /交锋 ·/);
  assert.doesNotMatch(lines, /养成 ·/);
  delete state.eventLog;
  const legacy = ctx.buildRunRecap().join(' / ');
  assert.match(legacy, /旧档缺少本局事件记录，取得渠道与售出次数无法追溯/);
  assert.doesNotMatch(legacy, /战利得蛊 \d+ 次/);
  assert.match(legacy, /月光蛊 ×2/);
});

test('ending recap aggregates recorded combat and cultivation actions without inferring hits or kill-move components', () => {
  const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('function buildRunRecap()'), source.indexOf('function saveEndingArchive('));
  const state = { cultivation: 2, cultivationStage: 0, owned: { moonlight_gu: 2, jade_skin_gu: 1 },
    journey: { graph: {}, completed: [] }, eventLog: [
      { action: 'use_gu', after: { gu_id: 'moonlight_gu', instance_id: 'moonlight_gu::1' } },
      { action: 'use_gu', after: { gu_id: 'moonlight_gu', instance_id: 'moonlight_gu::2' } },
      { action: 'use_gu', after: { gu_id: 'jade_skin_gu', instance_id: 'jade_skin_gu::1' } },
      { action: 'use_gu', after: { gu_id: 'missing_gu', instance_id: 'missing_gu::1' } },
      { action: 'use_kill_move', targets: ['moonlight_gu', 'jade_skin_gu'] },
      { action: 'basic_attack' },
      { action: 'basic_attack' },
      { action: 'body_training' },
      { action: 'produce_gu' },
      { action: 'consume_healing_gu' },
      { action: 'self_healing', after: { healed: 4, cost: 3 } },
      { action: 'self_healing', after: { healed: 2, cost: 3 } },
      { action: 'choose_action', reason: 'event_accepted', targets: ['miasma_meditation'], after: { health_paid: 2, essence_recovered: 3 } },
      { action: 'choose_action', reason: 'event_left', targets: ['miasma_meditation'], after: { health_paid: 0, essence_recovered: 0 } },
      { action: 'choose_action', reason: 'event_accepted', targets: ['herbalist_escort'], after: { health_paid: 2, essence_recovered: 0 } },
    ] };
  const ctx = vm.createContext({ state, DATA: { nodeTypes: [], gu: [
    { id: 'moonlight_gu', name: '月光蛊', rank: 1 },
    { id: 'jade_skin_gu', name: '玉皮蛊', rank: 1 },
  ] }, RunFlow: { stageLabel: () => '二转初阶', nodeById: () => null },
  NodeActionRules: { typeLabels: () => ({}) } });
  vm.runInContext(block, ctx);
  const lines = ctx.buildRunRecap().join(' / ');
  assert.match(lines, /交锋 · 单蛊催动 月光蛊 2 次、玉皮蛊 1 次；拳脚出手 2 次（出手次数，不代表命中）/);
  assert.doesNotMatch(lines, /杀招同催/);
  assert.match(lines, /养成 · 永久锻体 1 次，产叶 1 次、耗叶疗伤 1 次/);
  assert.match(lines, /整备自疗 2 次（气血 \+6，真元 -6）/);
  assert.doesNotMatch(lines, /missing_gu|未知蛊/);
  assert.doesNotMatch(lines, /月光蛊 3 次/);
  assert.match(lines, /瘴口调息 · 接纳 1 次，放弃 1 次；已付气血 2，恢复真元 3/);
  assert.match(lines, /药师托运 · 接纳 1 次，放弃 0 次；已付气血 2/);
});

test('NORMAL_RUN: ordinary battle defeat attributes the real loss and survives reload in the archive', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 103 });
  try {
    await lab.click('[data-start-run]');
    let s = await lab.snapshot();
    const available = new Set(s.journey.availableNodeIds);
    const node = s.journey.graph.nodes.find(n => available.has(n.id) && n.type === 'battle');
    assert.ok(node, 'fresh seed offers an ordinary battle');
    await lab.click(`[data-choose-node="${node.id}"]`);
    s = await lab.snapshot();
    assert.ok(s.battle && !s.battle.over);

    await lab.click('[data-use-gu="small_light_gu::1"]');
    s = await lab.snapshot();
    assert.ok(s.battle && !s.battle.over, 'Small Light is used during a live encounter');

    for (let turn = 0; turn < 30 && !s.ending; turn += 1) {
      assert.ok(s.battle && !s.battle.over, `battle must remain active until defeat, turn ${turn + 1}`);
      await lab.click('[data-end-turn]');
      s = await lab.snapshot();
    }
    assert.equal(s.ending?.outcome, 'defeat');
    assert.match(s.ending.recap.join(' / '), /战利得蛊 0 次，坊市购蛊 0 次/);
    assert.match(s.ending.recap.join(' / '), /交锋 · 单蛊催动 小光蛊 1 次/);
    assert.match(s.ending.detail, /败因：.+ · .+（伤 \d+/);
    assert.ok(s.ending.deathReport?.lastBlow?.attacker, 'death report names the damaging enemy');
    assert.ok(s.ending.deathReport.lastBlow.damage > 0, 'death report records positive damage');

    const recap = s.ending.recap;
    await lab.reload();
    s = await lab.snapshot();
    assert.equal(s.ending.outcome, 'defeat');
    assert.deepEqual(s.ending.recap, recap);
    await lab.click('[data-tab="hall"]');
    assert.match(await lab.text('.archive-run'), /败局/);
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'), /小光蛊 1 次/);
    assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});

test('NORMAL_RUN: voluntary boss retreat retains its recap after reload and in the archive', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 3 });
  try {
    await lab.click('[data-start-run]');
    for (let depth = 0; depth < 10; depth += 1) {
      const s = await lab.snapshot();
      const node = s.journey.graph.nodes.find(n => s.journey.availableNodeIds.includes(n.id) && ['battle', 'elite'].includes(n.type));
      assert.ok(node);
      await lab.click(`[data-choose-node="${node.id}"]`);
      await lab.click('[data-retreat]');
    }
    const s = await lab.snapshot();
    const boss = s.journey.graph.nodes.find(n => s.journey.availableNodeIds.includes(n.id) && n.type === 'boss');
    assert.ok(boss);
    await lab.click(`[data-choose-node="${boss.id}"]`);
    await lab.click('[data-retreat]');
    const end = await lab.snapshot();
    assert.equal(end.ending.outcome, 'retreat');
    assert.match(await lab.text('[data-run-recap]'), /此生修行/);
    assert.equal(end.ending.recap.length, 4);
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).ending.recap, end.ending.recap);
    assert.match(await lab.text('[data-run-recap]'), /放弃战利撤退/);
    await lab.click('[data-tab="hall"]');
    assert.match(await lab.text('.archive-run'), /此生修行/);
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'), /放弃战利撤退/);
    assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});
