import test from 'node:test';
import assert from 'node:assert/strict';
import { openLab } from './helpers/lab_browser.mjs';

test('first release: normal first encounter opens a focused prep page and saves its progress', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 1, viewport: [1280, 800] });
  try {
    await lab.click('.home-reference > summary');
    assert.match(await lab.text('[data-resource-guide]'), /护体与回血不能抵消抽魂/);
    await lab.click('[data-start-run]');
    let state = await lab.snapshot();
    assert.equal(state.page, 'map');
    await lab.click('#panel-map .visual-help:has(.guide-block)>summary');
    assert.ok((await lab.text('#panel-map .guide-block')).includes(`预计开场 ${state.qiMax}/${state.qiMax}`));
    const firstBattle = state.journey.graph.nodes.find(node =>
      state.journey.availableNodeIds.includes(node.id) && node.type === 'battle');
    assert.ok(firstBattle, 'the starting map exposes an ordinary battle');
    await lab.click(`[data-choose-node="${firstBattle.id}"]`);
    state = await lab.snapshot();
    assert.equal(state.page, 'battle');
    const firstIntel = await lab.text('.target-intent');
    assert.match(firstIntel, /伏肩扑咬（伤 2）/);
    assert.equal((firstIntel.match(/伏肩扑咬/g) || []).length, 1, 'the actual intent is shown once');
    assert.doesNotMatch(firstIntel, /预计 4 伤|迎击还是逐光/);
    assert.match(firstIntel, /观察.*不会消除反击/);
    await lab.click('.turn-help>summary');
    assert.match(await lab.text('[data-turn-guide]'), /行动用尽会自动结束回合/);
    await lab.click('.pick-group .combat-details>summary');
    assert.match(await lab.text('.pick-group .combat-details'), /无视闪避/);
    const target = state.battle.enemies[0];
    if (target.problemLabel) assert.ok((await lab.text('.target-phase')).includes(target.problemLabel));
    await lab.click('[data-observe]');
    state = await lab.snapshot();
    assert.equal(state.battle.turn, 2, 'observation consumes the action and advances the enemy turn');
    assert.equal(state.blood, 8, 'observation does not block the announced damage');
    assert.match(await lab.text('[data-reaction-intel]'), /反口撕咬 · 生效中/);
    assert.doesNotMatch(await lab.text('[data-reaction-intel]'), /尚未观察|未知/);
    assert.match(await lab.text('.forewarn'), /拳脚触发/);
    await lab.click('.combat-details summary');
    const clues = await lab.text('[data-enemy-clues]');
    assert.ok(clues.length);
    for (const id of target.clues) assert.ok(!clues.includes(id),'observed clues show translated labels');
    state = await lab.snapshot();
    const beforeTrigger = state;
    await lab.click('[data-basic-attack]');
    state = await lab.snapshot();
    assert.equal(state.qi, beforeTrigger.qi, 'triggering the reaction with fists costs no essence');
    assert.equal(state.battle.enemies[0].hp, beforeTrigger.battle.enemies[0].hp, 'reaction swallows this attack');
    assert.match(await lab.text('[data-reaction-intel]'), /反口撕咬 · 已失效/);
    assert.equal(await lab.text('.forewarn'), '', 'settled reaction no longer warns of swallowing');
    const beforeSupport = state;
    await lab.click('[data-use-gu="small_light_gu::1"]');
    state = await lab.snapshot();
    assert.equal(state.battle.turn, beforeSupport.battle.turn, 'Small Light leaves time to cast Moonlight');
    assert.equal(state.battle.actionsUsed, beforeSupport.battle.actionsUsed);
    assert.equal(state.qi, beforeSupport.qi - 1);
    assert.equal(state.thought, beforeSupport.thought - 1);
    assert.match(await lab.text('[data-use-gu="moonlight_gu::1"]'), /定向增幅已就绪/);

    for (let turn = 0; turn < 40 && state.page === 'battle'; turn += 1) {
      if (state.battle?.over) break;
      const canUseMoonlight = Number(state.owned?.moonlight_gu || 0) > 0 && state.qi >= 2;
      await lab.click(canUseMoonlight ? '[data-use-gu^="moonlight_gu::"]' : '[data-basic-attack]');
      state = await lab.snapshot();
    }
    state = await lab.snapshot();
    assert.equal(state.page, 'reward', `first encounter did not finish: ${JSON.stringify({ page: state.page, ending: state.ending, blood: state.blood, battle: state.battle?.enemies })}`);
    const rewardGu = state.reward?.guChoices?.[0];
    await lab.click(rewardGu ? `[data-reward-gu="${rewardGu}"]` : '[data-reward-continue]');
    state = await lab.snapshot();
    assert.equal(state.page, 'prep');
    assert.equal(state.journey.nodeId, firstBattle.id);
    const beforeGrowth = state;
    assert.ok((await lab.text('[data-growth-benefit]')).includes(`${state.qiMax} → ${state.qiMax + 1}`));
    await lab.click('[data-break="stone"]');
    state = await lab.snapshot();
    assert.equal(state.cultivationStage, 1);
    assert.equal(state.qiMax, beforeGrowth.qiMax + 1);
    assert.equal(state.qi, beforeGrowth.qi, 'breakthrough does not replenish current essence');
    assert.equal(state.stones, beforeGrowth.stones - 2);

    for (const selector of [
      '[data-buy-gu-food]', '[data-buy-solid-food]', '[data-forge]', '[data-km]',
      '[data-prep-tab="food"]', '[data-prep-tab="forge"]', '[data-prep-tab="killmove"]',
    ]) assert.equal(await lab.text(selector), '', `unexpected first-release control: ${selector}`);

    await lab.click('[data-prep-tab="shop"]');
    const beforeBuy = await lab.snapshot();
    let bought = false;
    try {
      await lab.click('article.shop-offer button:not([disabled])');
      bought = true;
    } catch { /* no affordable ordinary offer in this stock */ }
    if (bought) {
      const afterBuy = await lab.snapshot();
      assert.ok(afterBuy.stones < beforeBuy.stones || JSON.stringify(afterBuy.owned) !== JSON.stringify(beforeBuy.owned),
        'an enabled ordinary shop purchase changes inventory or currency');
      state = afterBuy;
    }

    await lab.click('[data-prep-tab="gu"]');
    const beforeSell = await lab.snapshot();
    await lab.click('.gu:has([data-gu-pairing]) .card-details>summary');
    assert.match(await lab.text('[data-gu-pairing]'), /先催辅助/);
    let sold = false;
    try {
      await lab.click('[data-sell-gu]');
      sold = true;
    } catch { /* no sellable Gu in the current inventory */ }
    if (sold) {
      const afterSell = await lab.snapshot();
      assert.ok(afterSell.stones > beforeSell.stones, 'an enabled Gu sale pays its listed value');
      state = afterSell;
    }

    assert.ok(bought, 'this seed must exercise a purchase');
    assert.ok(sold, 'this inventory must exercise a sale');
    await lab.click('[data-train-body="white_boar_strength_gu"]');
    state = await lab.snapshot();
    assert.ok(state.qi < state.qiMax, 'paid preparation leaves less than full essence for the map preview');
    const persisted = {
      page: state.page,
      completed: state.journey.completed,
      nodeId: state.journey.nodeId,
      stones: state.stones,
      owned: state.owned,
      reward: state.reward,
      qi: state.qi, qiMax: state.qiMax, cultivationStage: state.cultivationStage,
    };
    await lab.reload();
    const restored = await lab.snapshot();
    assert.deepEqual({
      page: restored.page,
      completed: restored.journey.completed,
      nodeId: restored.journey.nodeId,
      stones: restored.stones,
      owned: restored.owned,
      reward: restored.reward,
      qi: restored.qi, qiMax: restored.qiMax, cultivationStage: restored.cultivationStage,
    }, persisted);
    await lab.click('[data-prep-continue]');
    const advanced=await lab.snapshot();
    assert.equal(advanced.page,'map');
    await lab.click('#panel-map .visual-help:has(.guide-block)>summary');
    const mapGuide = await lab.text('#panel-map .guide-block');
    assert.ok(mapGuide.includes(`当前真元 ${advanced.qi}/${advanced.qiMax}`));
    assert.ok(mapGuide.includes(`预计开场 ${advanced.qiMax}/${advanced.qiMax}`));
    assert.equal(advanced.journey.nodeId,null);
    assert.ok(advanced.journey.completed.includes(firstBattle.id));
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).journey,advanced.journey);
    const nextBattle = advanced.journey.graph.nodes.find(node =>
      advanced.journey.availableNodeIds.includes(node.id) && node.type === 'battle');
    await lab.click(`[data-choose-node="${nextBattle.id}"]`);
    const nextEncounter = await lab.snapshot();
    assert.equal(nextEncounter.qi, advanced.qiMax);
    assert.equal(nextEncounter.battle.playerHuman.baseline.essenceMax, advanced.qiMax);
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
    console.log('[FIRST_RELEASE_BROWSER]', JSON.stringify({
      seed: 1, page: restored.page, completed: restored.journey.completed.length,
      bought, sold, stones: restored.stones, owned: restored.owned,
    }));
  } finally {
    await lab.close();
  }
});

test('dedicated market offers targeted purchases, keeps rank gates and persists a sold-out offer', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 1, viewport: [1280, 800] });
  try {
    await lab.click('[data-start-run]');
    let state = await lab.snapshot();
    const market = state.journey.graph.nodes.find(node => state.journey.availableNodeIds.includes(node.id) && node.type === 'market');
    assert.ok(market);
    await lab.click(`.route-card:has([data-choose-node="${market.id}"]) .route-facts summary`);
    assert.ok((await lab.text(`.route-card:has([data-choose-node="${market.id}"])`)).includes('本段已解锁的全部商品'));
    await lab.click(`[data-choose-node="${market.id}"]`);
    await lab.click('[data-node-action="leave"]');
    assert.ok((await lab.text('.pane-note')).includes('本段已解锁的全部商品'));
    for (const id of ['purchase_moonlight', 'lab_shop_gold_atk_2_12_gu', 'lab_shop_aptitude_gu', 'purchase_vitality_leaf']) await lab.click(`article.shop-offer:has([data-buy-offer="${id}"]) .card-details>summary`);
    const stock = await lab.text('.shop-grid');
    assert.ok(stock.includes('白豕蛊'));
    assert.ok(stock.includes('青铜舍利蛊'));
    assert.match(await lab.text('article.shop-offer:has([data-buy-offer="purchase_moonlight"])'), /已持有的小光蛊/);
    assert.doesNotMatch(stock, /推进：|只增加同名库存|不会自动装备/);
    const sariCard = await lab.text('article.shop-offer:has([data-buy-offer="lab_shop_gold_atk_2_12_gu"])');
    const growthCard = await lab.text('article.shop-offer:has([data-buy-offer="lab_shop_aptitude_gu"])');
    assert.match(sariCard, /青铜舍利蛊/);
    assert.match(growthCard, /提升至乙等/);
    assert.doesNotMatch(sariCard + growthCard, /战斗催动另付/);
    assert.match(await lab.text('article.shop-offer:has([data-buy-offer="purchase_vitality_leaf"])'), /购后元石 0[\s\S]*元石还差 2/);
    assert.equal(await lab.text('[data-buy-offer="purchase_blood_atk_3_11_gu"]'), '');
    state = await lab.snapshot();
    await lab.click('[data-buy-offer="purchase_vitality_leaf"]');
    const bought = await lab.snapshot();
    assert.equal(bought.stones, state.stones - 3);
    assert.equal(bought.owned.vitality_leaf_gu, state.owned.vitality_leaf_gu + 1);
    await assert.rejects(lab.click('[data-buy-offer="purchase_vitality_leaf"]'));
    await lab.reload();
    const restored = await lab.snapshot();
    assert.deepEqual(restored.shopSold, bought.shopSold);
    assert.equal(restored.stones, bought.stones);
    assert.equal(restored.owned.vitality_leaf_gu, bought.owned.vitality_leaf_gu);
    assert.ok((await lab.text('.pane-note')).includes('本段已解锁的全部商品'));
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});
