import test from 'node:test';
import assert from 'node:assert/strict';
import { openLab } from './helpers/lab_browser.mjs';

test('normal new run prepares, automatically fights, resumes and spends on a refreshed shelf', async () => {
  const lab = await openLab({seed:1, offline:true, viewport:[1280,900], ...(process.env.WENZHEN_ENTRY ? {entry:process.env.WENZHEN_ENTRY} : {})});
  try {
    await lab.click('[data-start-run]');
    let s = await lab.snapshot();
    const node = s.journey.graph.nodes.find(n => s.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
    await lab.click(`[data-choose-node="${node.id}"]`);
    assert.match(await lab.text('[data-combat-loadout]'), /3\/3 槽/);
    await lab.click('[data-toggle-combat-gu="stone_shell_gu"]');
    await lab.click('[data-toggle-combat-gu="vitality_leaf_gu"]');
    s = await lab.snapshot();
    assert.ok(s.combatLoadout.includes('vitality_leaf_gu'));
    assert.ok(!s.combatLoadout.includes('stone_shell_gu'));
    await lab.shoot('output/build-20261012/first-preparation.png');
    await lab.click('[data-toggle-auto]');
    await new Promise(r => setTimeout(r, 280));
    await lab.click('[data-toggle-auto]');
    s = await lab.snapshot();
    assert.equal(s.battle.autoRunning, false);
    assert.ok(s.battle.autoSteps > 0);
    const turn = s.battle.turn;
    await lab.reload();
    s = await lab.snapshot();
    assert.equal(s.battle.turn, turn);
    assert.equal(s.battle.autoRunning, false);
    await lab.click('[data-toggle-auto]');
    await lab.reload();
    const resumed = await lab.snapshot();
    if (resumed.battle) {
      assert.equal(resumed.battle.autoRunning,true);
      assert.ok(resumed.battle.turn >= turn);
    }
    for (let i=0; i<100; i++) {
      s = await lab.snapshot();
      if (!s.battle) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.equal(s.page, 'reward', JSON.stringify({page:s.page,blood:s.blood,battle:s.battle}));
    assert.equal(s.battleWins, 1);
    assert.ok(s.reward.battleLog.some(line => line.includes('自动交锋')));
    await lab.shoot('output/build-20261012/automatic-victory.png');
    await lab.click(s.reward.guChoices.length ? '[data-reward-skip]' : '[data-reward-continue]');
    const before = await lab.snapshot();
    await lab.click('[data-refresh-shop]');
    s = await lab.snapshot();
    assert.equal(s.stones, before.stones-2);
    assert.equal(s.shopRefreshCount, 1);
    assert.deepEqual(s.shopSold, before.shopSold);
    assert.match(await lab.text('[data-refresh-shop]'), /4/);
    await lab.click('[data-prep-tab="alchemy"]');
    assert.match(await lab.text('#panel-prep [data-pane="alchemy"]'), /月芒|月光/, JSON.stringify(lab.logs()));
    await lab.reload();
    assert.equal((await lab.snapshot()).shopRefreshCount,1);
    await lab.shoot('output/build-20261012/preparation.png');
    assert.deepEqual(lab.logs().filter(line => line.includes('[exception]')),[]);
  } finally { await lab.close(); }
});
