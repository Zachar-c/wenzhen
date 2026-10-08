import test from 'node:test';
import assert from 'node:assert/strict';
import { openLab } from './helpers/lab_browser.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const COMBAT = new Set(['battle', 'elite', 'boss']);
const GARDEN_BUILDS = new Set(['garden', 'shadow', 'late_accept', 'late_leave']);
const KEEP = new Set([
  'moonlight_gu', 'small_light_gu', 'jade_skin_gu', 'stone_shell_gu',
  'vitality_leaf_gu', 'white_boar_strength_gu', 'white_jade_gu', 'moon_glow_gu', 'moon_ray_gu', 'trail_stone_gu',
]);

async function clickIfReady(lab, selector) {
  try { await lab.click(selector); return true; }
  catch { return false; }
}

function summary(s) {
  return {
    page: s.page, rank: `${s.cultivation}转/${s.cultivationStage}`, aptitude: s.aptitude,
    stones: s.stones, blood: `${s.blood}/${s.bloodMax}`, qi: `${s.qi}/${s.qiMax}`,
    petals: s.guCare?.petals, hungry: s.guCare?.hungry,
    node: s.journey?.nodeId, completed: s.journey?.completed?.length,
    battle: s.battle && {
      turn: s.battle.turn, enemy: s.battle.enemies.map(e => `${e.name} ${e.hp}/${e.hpMax}`).join('、'),
      intent: s.battle.enemies.map(e => e.enemyIntent?.label || e.intent?.label).join('、'),
      over: s.battle.over,
    }, ending: s.ending?.outcome || s.ending?.kind || null,
  };
}

async function resolveFight(lab, build, trace) {
  let thunderArmorSettled = false;
  for (let action = 0; action < 70; action += 1) {
    let s = await lab.snapshot();
    if (s.reward || s.ending || !s.battle || s.battle.over) return s;
    const alive = s.battle.enemies.filter(e => e.hp > 0);
    // When 雷冠头狼 brings an ally, remove the unarmored ally first. The
    // doubled Moonlight hit can finish 狂电狼 before it gets another turn;
    // blindly keeping the default 雷冠 target wastes that hit on 雷光护甲.
    const target = (alive.length > 1
      ? alive.find(e => e.id !== 'thunder_crown_wolf')
      : null)
      || alive.find(e => e.id === s.battle.targetId)
      || alive[0];
    if (!target) return s;
    if (s.battle.targetId !== target.id) {
      if (!await clickIfReady(lab, `[data-target="${target.id}"]`)) return s;
      s = await lab.snapshot();
    }
    const key = `[data-use-gu="`;
    const has = id => Number(s.owned?.[id] || 0) > 0
      && (s.battle.playerHuman?.guInstances || []).some(g => g.instanceId.startsWith(`${id}::`) && !g.sealed);
    let did = false;

    // Treat only through the visible Gu control, when the player has actually lost health.
    if (s.blood <= s.bloodMax - 3 && Number(s.owned.vitality_leaf_gu || 0) > 0) {
      did = await clickIfReady(lab, `${key}vitality_leaf_gu::1"]`);
      if (!did) did = await clickIfReady(lab, `${key}vitality_leaf_gu::2"]`);
    }

    // Preserve paid Jade Skin for emergency use: its per-hit and upkeep costs compound in long fights.
    const incoming = Math.max(...alive.map(e =>
      Number(e?.enemyIntent?.damage ?? e?.intent?.damage ?? 0)));
    const shadowPercent = { 3: 60, 4: 30, 5: 15 }[Number(target.rank)];
    const shadowIntentCost = Number(target.enemyIntent?.true_qi_cost ?? target.intent?.true_qi_cost ?? 0);
    const shadowTestable = build === 'shadow' && s.cultivation >= 4
      && s.owned?.moon_shadow_gu > 0 && alive.length === 1
      && target.grade === 'cultivator' && shadowPercent
      && !Number(target.essenceSuppressionPct || 0)
      && shadowIntentCost >= 3 && incoming <= 3;
    let shadowApplied = trace.find(row => row.action === 'shadow:applied'
      && row.nodeId === s.journey.nodeId && row.enemy === target.id);
    // Stone Shell has no upkeep or hit cost. In a multi-enemy fight, spend
    // this turn to establish it before taking the full combined enemy response.
    if (!did && incoming >= 3 && (alive.length > 1 || s.blood <= s.bloodMax - 2)
        && !s.battle.playerHuman?.maintainedGu?.some(g => g.active)
        && s.qi >= 1 && has('stone_shell_gu')) {
      did = await clickIfReady(lab, `${key}stone_shell_gu::1"]`);
    }
    const stoneShellActive = () => s.battle.playerHuman?.maintainedGu?.some(g =>
      g.active && g.instanceId?.startsWith('stone_shell_gu::'));
    if (!did && shadowTestable && !stoneShellActive() && s.qi >= 1 && has('stone_shell_gu')) {
      did = await clickIfReady(lab, `${key}stone_shell_gu::1"]`);
    }
    if (!did && shadowTestable && stoneShellActive() && !shadowApplied && s.qi >= 3 && has('moon_shadow_gu')) {
      const beforeHp = target.hp;
      const beforeBlock = Number(s.battle.block || 0);
      did = await clickIfReady(lab, `${key}moon_shadow_gu::1"]`);
      if (did) {
        let after = await lab.snapshot();
        let afterTarget = after.battle.enemies.find(enemy => enemy.id === target.id);
        assert.equal(afterTarget.essenceSuppressionPct, shadowPercent);
        assert.equal(afterTarget.hp, beforeHp, 'moon shadow applies no damage');
        assert.equal(Number(after.battle.block || 0), beforeBlock, 'moon shadow adds no block');
        const capText = await lab.text('#log');
        const capMatch = capText.match(new RegExp(`真元压制 ${shadowPercent}% · 可用上限 (\\d+)/(\\d+)，每回合回复 (\\d+)`));
        assert.ok(capMatch, `battle log shows the rank ${target.rank} essence cap and regeneration`);
        assert.ok(afterTarget.essence <= Number(capMatch[1]));
        const expectedAfterReload = { id: afterTarget.id, essence: afterTarget.essence,
          essenceSuppressionPct: afterTarget.essenceSuppressionPct };
        await lab.reload();
        after = await lab.snapshot();
        afterTarget = after.battle.enemies.find(enemy => enemy.id === target.id);
        assert.deepEqual({ id: afterTarget.id, essence: afterTarget.essence,
          essenceSuppressionPct: afterTarget.essenceSuppressionPct }, expectedAfterReload,
        'suppression and current enemy essence survive reload');
        assert.match(await lab.text('#log'), new RegExp(`真元压制 ${shadowPercent}% · 可用上限`));
        const qiAfter = after.qi;
        const thoughtAfter = after.thought;
        const shadowButton = `${key}moon_shadow_gu::1"]`;
        assert.ok(await lab.text(shadowButton), 'the already applied Gu remains visible');
        assert.equal(await clickIfReady(lab, shadowButton), false, 'repeated suppression control is unavailable');
        const blockedRepeat = await lab.snapshot();
        assert.equal(blockedRepeat.qi, qiAfter);
        assert.equal(blockedRepeat.thought, thoughtAfter);
        shadowApplied = { action: 'shadow:applied', nodeId: s.journey.nodeId, enemy: target.id, rank: target.rank,
          percent: shadowPercent, waitRounds: 0, blocked: false, startedTurn: s.battle.turn,
          essence: afterTarget.essence, state: summary(blockedRepeat) };
        trace.push(shadowApplied);
        if (process.env.WENZHEN_SHADOW_SCREENSHOT) {
          await sleep(1200);
          await lab.shoot(process.env.WENZHEN_SHADOW_SCREENSHOT);
        }
        s = blockedRepeat;
      }
    }
    if (!did && shadowApplied && !shadowApplied.blocked && !shadowApplied.waitTimedOut) {
      const log = s.battle.log.join(' ');
      if (log.includes('真元不足，无法催动')) {
        shadowApplied.blocked = true;
        shadowApplied.totalWaitTurns = 1 + shadowApplied.waitRounds;
        trace.push({ action: 'shadow:cost_blocked', enemy: shadowApplied.enemy,
          waitTurns: shadowApplied.totalWaitTurns, state: summary(s) });
      } else if (s.battle.enemies.length === 1 && shadowApplied.waitRounds < 3) {
        did = await clickIfReady(lab, '[data-end-turn]');
        if (did) {
          s = await lab.snapshot();
          shadowApplied.waitRounds += 1;
          if (s.battle.log.join(' ').includes('真元不足，无法催动')) {
            shadowApplied.blocked = true;
            shadowApplied.totalWaitTurns = 1 + shadowApplied.waitRounds;
            trace.push({ action: 'shadow:cost_blocked', enemy: shadowApplied.enemy,
              waitTurns: shadowApplied.totalWaitTurns, state: summary(s) });
          }
        }
      } else {
        shadowApplied.waitTimedOut = true;
        trace.push({ action: 'shadow:wait_timeout', enemy: shadowApplied.enemy,
          state: summary(s) });
      }
    }

    if (!did && build === 'jade' && incoming >= 3 && s.qi >= 5
        && has('white_jade_gu') && !s.battle.playerHuman?.maintainedGu?.some(g => g.instanceId?.startsWith('white_jade_gu::') && g.active)) {
      did = await clickIfReady(lab, `${key}white_jade_gu::1"]`);
      if (did) trace.push({ action: 'used:white_jade_gu', state: summary(await lab.snapshot()) });
    }
    if (!did && build === 'ray' && target.hp <= 3 && !s.guCare?.hungry && s.qi >= 2 && has('moon_ray_gu')) did = await clickIfReady(lab, `${key}moon_ray_gu::1"]`);
    if (!did && ['jade', 'ray'].includes(build) && target.problemAxis !== 'evasion' && Number(s.modifierLedger?.filter(x => x.attribute === 'attack').reduce((n,x) => n + Number(x.amount || 0), 0)) >= 3) {
      did = await clickIfReady(lab, '[data-basic-attack]');
      if (did) trace.push({ action: 'used:permanent_strength', state: summary(await lab.snapshot()) });
    }
    // Small Light prepares a doubled Moonlight strike without consuming the turn action.
    if (!did && has('small_light_gu') && has('moonlight_gu') && s.qi >= 3
        && !s.battle.turnSupports?.guTargets?.moonlight_gu) {
      did = await clickIfReady(lab, `${key}small_light_gu::1"]`);
      // Small Light is a free preparation action; use the boosted strike in this same turn.
      if (did) {
        s = await lab.snapshot();
        did = false;
      }
    }
    // Settle the known 雷冠反击 with a basic strike once the other threats
    // are gone. It costs no essence, but consumes this turn and takes an enemy response.
    if (!did && target.id === 'thunder_crown_wolf' && !thunderArmorSettled) {
      did = await clickIfReady(lab, '[data-basic-attack]');
      if (did) thunderArmorSettled = true;
    }
    const fed = !s.guCare?.hungry;
    if (!did && fed && has('moon_ray_gu') && s.qi >= 2) {
      did = await clickIfReady(lab, `${key}moon_ray_gu::1"]`);
      if (did && target.distanceMeters > 10) {
        const shot = await lab.snapshot();
        const afterTarget = shot.battle.enemies.find(e => e.id === target.id);
        assert.equal(afterTarget.hp, target.hp - 3, 'long-range shot retains Moonlight power');
        assert.equal(shot.blood, s.blood, 'out-of-range guard closes instead of striking');
        assert.equal(afterTarget.distanceMeters, target.distanceMeters - 5);
        trace.push({action: 'ray:long_shot', beforeDistance: target.distanceMeters, state: summary(shot)});
        if (!trace.some(x => x.action === 'ray:distance_reload')) {
          await lab.reload();
          assert.deepEqual((await lab.snapshot()).battle.enemies.map(e => ({id:e.id, hp:e.hp, distance:e.distanceMeters})), shot.battle.enemies.map(e => ({id:e.id, hp:e.hp, distance:e.distanceMeters})));
          assert.match(await lab.text('[data-distance]'), new RegExp(`距离 ${shot.battle.enemies.find(e=>e.id===target.id).distanceMeters} 米`));
          await sleep(400);
          if (process.env.WENZHEN_RANGE_SCREENSHOT) await lab.shoot(process.env.WENZHEN_RANGE_SCREENSHOT);
          trace.push({action:'ray:distance_reload'});
        }
      }
    }
    if (!did && target.distanceMeters > 0) {
      did = await clickIfReady(lab, '[data-approach]');
      if (did) trace.push({action: 'range:approach', state: summary(await lab.snapshot())});
    }
    if (!did && fed && has('moon_glow_gu') && s.qi >= 4 && target.hp > 0) {
      did = await clickIfReady(lab, `${key}moon_glow_gu::1"]`);
    }
    if (!did && fed && has('moonlight_gu') && s.qi >= 2 && target.hp > 0) {
      did = await clickIfReady(lab, `${key}moonlight_gu::1"]`);
    }
    if (!did) did = await clickIfReady(lab, '[data-basic-attack]');
    if (!did) did = await clickIfReady(lab, '[data-end-turn]');
    if (!did) {
      return s;
    }
    s = await lab.snapshot();
    if (s.reward || s.ending || !s.battle || s.battle.over) return s;
    await sleep(15);
  }
  return await lab.snapshot();
}

async function resolveNodeAction(lab, s, build, trace) {
  if (s.page !== 'node-action') return s;
  const event = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId)?.event;
  const lateCurrent = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId);
  const lateEvent = build.startsWith('late_') && event
    && ['herbalist_escort', 'miasma_meditation'].includes(event.id);
  if (lateEvent) {
    if (event.id === 'miasma_meditation' && process.env.WENZHEN_LATE_SCREENSHOT) {
      await sleep(1200);
      await lab.shoot(process.env.WENZHEN_LATE_SCREENSHOT);
    }
    const isHerbalist = event.id === 'herbalist_escort';
    const accepting = build === 'late_accept';
    if (isHerbalist && accepting) {
      assert.ok(lateCurrent.segment >= 4, 'the herbalist commission is stage-four or later content');
      const before = s;
      await lab.click('[data-node-action="accept_event"]');
      s = await lab.snapshot();
      assert.equal(s.blood, before.blood - 2);
      assert.equal(s.stones, before.stones + 10);
      assert.equal(s.qi, before.qi);
      assert.equal(s.travelSoulDebt?.cost, 1);
      assert.equal(s.travelSoulDebt?.eventId, event.id);
      let record = s.eventLog.findLast(e => e.action === 'choose_action' && e.reason === 'event_accepted' && e.targets.includes(event.id));
      assert.ok(record, 'the herbalist commission is recorded as accepted');
      trace.push({ action: 'late:herbalist_accepted', node: lateCurrent.id,
        healthLoss: before.blood - s.blood, stoneGain: s.stones - before.stones,
        before: summary(before), state: summary(s) });
      await lab.reload();
      const restored = await lab.snapshot();
      assert.deepEqual(restored.travelSoulDebt, s.travelSoulDebt);
      assert.deepEqual(restored.eventLog.findLast(e => e.action === 'choose_action' && e.reason === 'event_accepted' && e.targets.includes(event.id)), record);
      assert.equal(await clickIfReady(lab, '[data-node-action="accept_event"]'), false,
        'the accepted event action cannot be repeated after refresh');
      trace.push({ action: 'late:herbalist_refreshed', node: lateCurrent.id, state: summary(restored) });
      return restored;
    }
    if (isHerbalist && !accepting) {
      assert.ok(lateCurrent.segment >= 4, 'the herbalist commission is stage-four or later content');
      const before = s;
      await lab.click('[data-node-action="leave"]');
      s = await lab.snapshot();
      assert.equal(s.blood, before.blood);
      assert.equal(s.stones, before.stones);
      assert.equal(s.qi, before.qi);
      assert.equal(s.travelSoulDebt, null);
      assert.ok(s.eventLog.some(e => e.action === 'choose_action' && e.reason === 'event_left' && e.targets.includes(event.id)));
      trace.push({ action: 'late:herbalist_left', node: lateCurrent.id, state: summary(s) });
      await lab.reload();
      const restored = await lab.snapshot();
      assert.equal(restored.travelSoulDebt, null);
      assert.equal(restored.blood, before.blood);
      trace.push({ action: 'late:herbalist_refreshed', node: lateCurrent.id, state: summary(restored) });
      return restored;
    }
    if (!isHerbalist && accepting) {
      assert.equal(lateCurrent.segment, 5);
      const previousLayerIds = s.journey.graph.nodes
        .filter(node => node.segment === 5 && node.depth === lateCurrent.depth - 1)
        .map(node => node.id);
      const previousNode = trace.findLast(row => previousLayerIds.includes(row.selected))?.selected;
      assert.ok(previousNode, 'the normal map path reached the layer before the fog event');
      assert.ok(trace.some(row => row.action === 'produced:vitality_leaf_gu' && row.prep === previousNode),
        'nine-leaf production spends true qi in the preparation immediately before the fog event');
      assert.ok(s.qi < s.qiMax, 'normal 九叶生机草 production leaves room for the event gain');
      const before = s;
      await lab.click('[data-node-action="accept_event"]');
      s = await lab.snapshot();
      assert.equal(s.blood, before.blood - 2);
      assert.equal(s.qi, Math.min(s.qiMax, before.qi + 6));
      assert.equal(s.qi, s.qiMax, 'the accepted +6 essence effect is capped at the player maximum');
      assert.equal(s.stones, before.stones);
      assert.equal(s.travelSoulDebt, null);
      assert.ok(s.eventLog.some(e => e.action === 'choose_action' && e.reason === 'event_accepted' && e.targets.includes(event.id)));
      trace.push({ action: 'late:miasma_accepted', node: lateCurrent.id,
        healthLoss: before.blood - s.blood, essenceGain: s.qi - before.qi,
        before: summary(before), state: summary(s) });
      await lab.reload();
      const restored = await lab.snapshot();
      assert.equal(restored.blood, s.blood);
      assert.equal(restored.qi, s.qi);
      assert.ok(restored.eventLog.some(e => e.action === 'choose_action' && e.reason === 'event_accepted' && e.targets.includes(event.id)));
      trace.push({ action: 'late:miasma_refreshed', node: lateCurrent.id, state: summary(restored) });
      return restored;
    }
    assert.equal(lateCurrent.segment, 5);
    assert.equal(s.qi, s.qiMax, 'the preceding ordinary battle restores true qi to full');
    assert.match(await lab.text('.node-action-choices'), /真元已满/);
    const before = s;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal(await clickIfReady(lab, '[data-node-action="accept_event"]'), false,
        'full-essence event acceptance stays disabled');
      const rejected = await lab.snapshot();
      assert.equal(rejected.page, 'node-action');
      assert.equal(rejected.blood, before.blood);
      assert.equal(rejected.qi, before.qi);
      assert.equal(rejected.stones, before.stones);
      assert.deepEqual(rejected.eventLog, before.eventLog);
    }
    trace.push({ action: 'late:miasma_rejected_full', node: lateCurrent.id, state: summary(before) });
    await lab.reload();
    s = await lab.snapshot();
    assert.equal(s.qi, s.qiMax);
    assert.match(await lab.text('.node-action-choices'), /真元已满/);
    assert.equal(await clickIfReady(lab, '[data-node-action="accept_event"]'), false);
    const refreshed = await lab.snapshot();
    assert.equal(refreshed.blood, before.blood);
    assert.equal(refreshed.qi, before.qi);
    assert.deepEqual(refreshed.eventLog, before.eventLog);
    await lab.click('[data-node-action="leave"]');
    s = await lab.snapshot();
    assert.equal(s.blood, before.blood);
    assert.equal(s.qi, before.qi);
    assert.equal(s.stones, before.stones);
    assert.equal(s.travelSoulDebt, null);
    assert.ok(s.eventLog.some(e => e.action === 'choose_action' && e.reason === 'event_left' && e.targets.includes(event.id)));
    trace.push({ action: 'late:miasma_left_after_rejections', node: lateCurrent.id, state: summary(s) });
    await lab.reload();
    const restored = await lab.snapshot();
    assert.equal(restored.blood, s.blood);
    assert.equal(restored.qi, s.qi);
    assert.equal(restored.travelSoulDebt, null);
    return restored;
  }
  if (build === 'debt' && event?.delayed_soul_cost === 1 && !trace.some(x => x.action === 'debt:accepted')) {
    assert.match(await lab.text('.node-action-choices'), /继续赶路时损失 1 点魂魄/);
    const before = s;
    await lab.click('[data-node-action="accept_event"]');
    s = await lab.snapshot();
    assert.equal(s.blood, before.blood - event.health_cost);
    assert.equal(s.stones, before.stones + event.stone_gain);
    assert.equal(s.soul, before.soul, 'acceptance defers soul cost');
    assert.equal(s.travelSoulDebt.cost, 1);
    trace.push({action: 'debt:accepted', state: summary(s)});
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).travelSoulDebt, s.travelSoulDebt);
    assert.match(await lab.text('[data-prep-continue]'), /魂魄 -1/);
    await lab.click('[data-prep-tab="shop"]');
    if (!await clickIfReady(lab, '[data-buy-offer="soul_pill"]')) {
      await lab.click('[data-prep-tab="gu"]');
      await lab.click('[data-sell-gu="jade_skin_gu"]');
      await lab.click('[data-prep-tab="shop"]');
      await lab.click('[data-buy-offer="soul_pill"]');
    }
    const nourished = await lab.snapshot();
    assert.equal(nourished.soul, s.soul + 1);
    assert.equal(nourished.soulMax, s.soulMax + 1);
    assert.ok(nourished.stones < s.stones + 5, 'nourishment costs actual stones even after an optional sale');
    trace.push({action: 'debt:nourished', state: summary(nourished)});
    return nourished;
  }
  const current = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId);
  if (current?.type === 'hazard' && current.skipEffect) {
    await clickIfReady(lab, '[data-node-action="scout"]');
    if (!await clickIfReady(lab, '[data-node-action="cross"]')) await lab.click('[data-node-action="withdraw"]');
  } else if (current?.type === 'rest') {
    await clickIfReady(lab, '[data-node-action="node.rest_heal"]');
    await clickIfReady(lab, '[data-node-action="node.leave"]');
  } else {
    const choices = GARDEN_BUILDS.has(build) && !s.owned.vitality_grass_gu && !s.wild?.vitality_grass_gu ? ['collect_gu', 'work', 'harvest', 'meditate', 'scout', 'trade', 'leave'] : ['work', 'harvest', 'meditate', 'scout', 'trade', 'leave'];
    for (const id of choices) {
      if (id === 'collect_gu' && s.journey.graph.nodes.find(n => n.id === s.journey.nodeId)?.findGu) {
        assert.equal(await lab.text('[data-node-action="collect_gu"]'), '搜查 · 气血 -2');
        if (process.env.WENZHEN_GARDEN_SCREENSHOT) await lab.shoot(process.env.WENZHEN_GARDEN_SCREENSHOT);
      }
      if (await clickIfReady(lab, `[data-node-action="${id}"]`)) {
        if (id === 'collect_gu') {
          const found = await lab.snapshot();
          assert.ok(found.wild.vitality_grass_gu > 0);
          assert.equal(found.owned.vitality_grass_gu || 0, 0, 'found grass must first be attuned');
          assert.equal(found.blood, s.blood - 2);
          assert.equal(found.stones, s.stones);
          trace.push({action: 'found:vitality_grass_gu', state: summary(found)});
          await lab.reload();
          assert.deepEqual((await lab.snapshot()).wild, found.wild);
          assert.deepEqual((await lab.snapshot()).journey.graph.nodes.find(n => n.id === found.journey.nodeId)?.findGu,
            found.journey.graph.nodes.find(n => n.id === found.journey.nodeId)?.findGu);
        }
        break;
      }
    }
  }
  await sleep(30);
  return await lab.snapshot();
}

async function buyMoonShadowWhenAvailable(lab, s, trace) {
  if (s.cultivation < 4 || trace.some(row => row.action === 'bought:moon_shadow_gu')) return s;
  const card = 'article.shop-offer:has([data-buy-offer="purchase_moon_shadow_300"])';
  const text = await lab.text(card);
  if (!text || /本店未上架|已购入/.test(text)) return s;
  const priceText = await lab.text(`${card} .so-foot`);
  const price = Number(priceText.match(/(\d+)\s*元石/)?.[1]);
  assert.ok(price > 0, `visible moon shadow offer has a layer price: ${priceText}`);

  let latest = await lab.snapshot();
  if (latest.stones < price) {
    await lab.click('[data-prep-tab="gu"]');
    for (const [id, count] of Object.entries(latest.owned || {})) {
      if (count <= 0 || KEEP.has(id) || id === 'vitality_grass_gu') continue;
      while (latest.stones < price && Number(latest.owned?.[id] || 0) > 0) {
        if (!await clickIfReady(lab, `[data-sell-gu="${id}"]`)) break;
        latest = await lab.snapshot();
        trace.push({ prep: latest.journey.nodeId, action: `shadow:sold-surplus:${id}`, state: summary(latest) });
      }
      if (latest.stones >= price) break;
    }
    await lab.click('[data-prep-tab="shop"]');
    latest = await lab.snapshot();
  }
  if (latest.stones < price) return latest;

  const before = latest;
  if (!await clickIfReady(lab, '[data-buy-offer="purchase_moon_shadow_300"]')) return latest;
  latest = await lab.snapshot();
  assert.equal(latest.owned.moon_shadow_gu, Number(before.owned.moon_shadow_gu || 0) + 1);
  assert.equal(before.stones - latest.stones, price, 'purchase pays the price shown at this layer');
  const purchase = latest.eventLog.at(-1);
  assert.equal(purchase.action, 'shop');
  assert.equal(purchase.reason, 'shop_purchase');
  assert.ok(purchase.targets.includes('purchase_moon_shadow_300'));
  assert.equal(purchase.after.cost, price);
  trace.push({ prep: latest.journey.nodeId, action: 'bought:moon_shadow_gu', price, state: summary(latest) });
  return latest;
}

async function prepare(lab, s, training, trace, build) {
  if (s.page !== 'prep') return s;
  const prepNode = s.journey.graph.nodes.find(node => node.id === s.journey.nodeId);
  const fogEvent = s.journey.graph.nodes.find(node => node.event?.id === 'miasma_meditation');
  const preserveFullQiForFog = build === 'late_leave' && s.cultivation === 5
    && prepNode?.nextIds?.includes(fogEvent?.id);
  if (GARDEN_BUILDS.has(build) && !preserveFullQiForFog
      && s.wild?.vitality_grass_gu > 0 && !s.owned.vitality_grass_gu) {
    await lab.click('[data-prep-tab="alchemy"]');
    const before = await lab.snapshot();
    if (await clickIfReady(lab, '[data-attune="vitality_grass_gu"]')) {
      const attuned = await lab.snapshot();
      assert.equal(attuned.qi, before.qi - 6);
      assert.equal(attuned.wild.vitality_grass_gu, before.wild.vitality_grass_gu - 1);
      assert.equal(attuned.owned.vitality_grass_gu, 1);
      trace.push({ action: 'attuned:vitality_grass_gu', state: summary(attuned) });
    }
  }
  await clickIfReady(lab, '[data-prep-tab="gu"]');
  if (GARDEN_BUILDS.has(build) && !preserveFullQiForFog
      && (await lab.snapshot()).owned.vitality_grass_gu > 0) {
    const before = await lab.snapshot();
    if (await clickIfReady(lab, '[data-produce-leaf="vitality_grass_gu"]')) {
      const grown = await lab.snapshot();
      assert.equal(grown.qi, before.qi - 2);
      assert.equal(grown.owned.vitality_grass_gu, before.owned.vitality_grass_gu);
      trace.push({ prep: before.journey.nodeId, action: 'produced:vitality_leaf_gu', state: summary(grown) });
    }
    const grown = await lab.snapshot();
    if (grown.blood < grown.bloodMax && await clickIfReady(lab, '[data-use-leaf="vitality_leaf_gu"]'))
      trace.push({ action: 'treated:vitality_leaf_gu', state: summary(await lab.snapshot()) });
    if ((await lab.snapshot()).owned.vitality_leaf_gu > 2 && await clickIfReady(lab, '[data-sell-gu="vitality_leaf_gu"]'))
      trace.push({ action: 'sold:vitality_leaf_gu', state: summary(await lab.snapshot()) });
  }
  if (!preserveFullQiForFog && training.count < 3 && Number(s.owned.white_boar_strength_gu || 0) > 0) {
    if (await clickIfReady(lab, '[data-train-body="white_boar_strength_gu"]')) {
      training.count += 1;
      trace.push({ prep: s.journey.nodeId, action: 'white_boar_training', state: summary(await lab.snapshot()) });
    }
  }
  await lab.click('[data-prep-tab="shop"]');
  let latest = await lab.snapshot();
  if (build === 'shadow') latest = await buyMoonShadowWhenAvailable(lab, latest, trace);
  const candidates = [];
  if ((build === 'shadow' ? latest.soul < 3 : latest.soul < latest.soulMax || latest.soulMax < 3)) candidates.push('soul_pill');
  if ((build !== 'ray' || latest.owned.moon_ray_gu) && Number(latest.owned.aptitude_gu || 0) === 0 && ['bing', 'yi'].includes(latest.aptitude))
    candidates.push('lab_shop_aptitude_gu');
  if (build !== 'shadow' && Number(latest.owned.vitality_leaf_gu || 0) < 1 && latest.blood <= latest.bloodMax - 2)
    candidates.push('purchase_vitality_leaf');
  if (Number(latest.owned.stone_shell_gu || 0) === 0) candidates.push('purchase_stone_shell');
  for (const id of candidates) {
    if (await clickIfReady(lab, `[data-buy-offer="${id}"]`)) {
      latest = await lab.snapshot();
      trace.push({ prep: latest.journey.nodeId, action: `bought:${id}`, state: summary(latest) });
      break;
    }
  }
  latest = await lab.snapshot();
  if (Number(latest.owned.aptitude_gu || 0) > 0) {
    await clickIfReady(lab, '[data-prep-tab="gu"]');
    await clickIfReady(lab, '[data-use-aptitude]');
    latest = await lab.snapshot();
  }
  const savingForMoonShadow = build === 'shadow' && latest.cultivation >= 4
    && !trace.some(row => row.action === 'bought:moon_shadow_gu');
  if (!savingForMoonShadow) {
    await clickIfReady(lab, '[data-break="sari"]');
    if (build !== 'ray' || latest.cultivation < 2 || latest.owned.moon_ray_gu) await clickIfReady(lab, '[data-break="stone"]');
  }
  // Preserve one copy of the combat kit; only sell redundant non-kit Gu when a next break is blocked.
  const breakReady = await lab.text('[data-break="stone"]');
  if (latest.stones < 15 && !/冲击下一转/.test(breakReady)) {
    await lab.click('[data-prep-tab="gu"]');
    for (const [id, count] of Object.entries(latest.owned || {})) {
      const surplus = (!KEEP.has(id)
        && !(GARDEN_BUILDS.has(build) && id === 'vitality_grass_gu')
        && !(build === 'shadow' && id === 'moon_shadow_gu')) || (id === 'jade_skin_gu' && count > 1)
        || (id === 'white_boar_strength_gu' && training.count >= 3 && build !== 'jade');
      if (count > 0 && surplus) {
        if (await clickIfReady(lab, `[data-sell-gu="${id}"]`)) {
          latest = await lab.snapshot();
          trace.push({ prep: latest.journey.nodeId, action: `sold-surplus:${id}`, state: summary(latest) });
        }
      }
    }
  }
  latest = await lab.snapshot();

  if (build === 'ray' && latest.cultivation >= 2 && latest.owned.moonlight_gu > 0 && !latest.owned.moon_ray_gu) {
    if (!trace.some(x => x.action === 'ray:sold_jade') && latest.owned.jade_skin_gu && latest.stones < 15) {
      await lab.click('[data-prep-tab="gu"]');
      if (await clickIfReady(lab, '[data-sell-gu="jade_skin_gu"]')) trace.push({action:'ray:sold_jade', state:summary(await lab.snapshot())});
    }
    if (!latest.owned.trail_stone_gu) {
      await lab.click('[data-prep-tab="shop"]');
      if (await clickIfReady(lab, '[data-buy-offer="purchase_trail_stone"]')) trace.push({action: 'bought:trail_stone_gu', state: summary(await lab.snapshot())});
    }
    await lab.click('[data-prep-tab="alchemy"]');
    if (await clickIfReady(lab, '[data-forge="moonlight_ray"]')) {
      const forged = await lab.snapshot();
      assert.equal(forged.owned.moonlight_gu || 0, 0);
      assert.equal(forged.owned.trail_stone_gu || 0, 0);
      assert.equal(forged.owned.moon_ray_gu, 1);
      trace.push({action: 'forged:moonlight_ray', state: summary(forged)});
      await lab.reload();
      assert.equal((await lab.snapshot()).owned.moon_ray_gu, 1);
    }
  }
  latest = await lab.snapshot();

  // The rank-2 recipe is performed through the ordinary alchemy controls.
  // Attune one wild Small Light only after reaching rank 2, then forge the
  // guaranteed fixed recipe when all three inputs and its ten-stone price exist.
  if (!preserveFullQiForFog && !['jade', 'ray'].includes(build) && latest.cultivation >= 2 && Number(latest.owned.moonlight_gu || 0) > 0
      && Number(latest.owned.small_light_gu || 0) < 2
      && Number(latest.wild?.small_light_gu || 0) > 0) {
    await lab.click('[data-prep-tab="alchemy"]');
    const before = await lab.snapshot();
    if (await clickIfReady(lab, '[data-attune="small_light_gu"]')) {
      latest = await lab.snapshot();
      trace.push({ prep: latest.journey.nodeId, action: 'attuned:small_light_gu',
        before: summary(before), state: summary(latest),
        event: latest.eventLog?.at(-1)?.action || null });
    }
  }
  latest = await lab.snapshot();
  if (!preserveFullQiForFog && !['jade', 'ray'].includes(build) && latest.cultivation >= 2 && Number(latest.owned.moonlight_gu || 0) > 0
      && Number(latest.owned.small_light_gu || 0) >= 2 && latest.stones >= 10) {
    await lab.click('[data-prep-tab="alchemy"]');
    const before = await lab.snapshot();
    if (await clickIfReady(lab, '[data-forge="moonlight_glow"]')) {
      latest = await lab.snapshot();
      trace.push({ prep: latest.journey.nodeId, action: 'forged:moonlight_glow',
        before: summary(before), state: summary(latest),
        event: latest.eventLog?.at(-1)?.action || null });
    }
  }
  latest = await lab.snapshot();

  if (!preserveFullQiForFog && build === 'jade' && training.count >= 3 && latest.cultivation >= 2
      && latest.owned.white_boar_strength_gu > 0 && latest.owned.jade_skin_gu > 0 && latest.stones >= 15) {
    await lab.click('[data-prep-tab="alchemy"]');
    if (await clickIfReady(lab, '[data-forge="white_jade_basic"]')) {
      latest = await lab.snapshot();
      trace.push({ action: 'forged:white_jade_basic', state: summary(latest), ledger: latest.modifierLedger });
    }
  }
  latest = await lab.snapshot();
  if (latest.solidCare?.hungry?.length) {
    await lab.click('[data-prep-tab="gu"]');
    for (const food of ['pork', 'jade']) {
      if (await clickIfReady(lab, `[data-buy-solid-food="${food}"]`))
        trace.push({ action: `bought:${food}`, state: summary(await lab.snapshot()) });
    }
  }
  // Keep enough food for the next five-node interval. Buying is an ordinary
  // preparation action and pays the visible one-stone price per ten petals.
  const foodNeed = 4 * Number(latest.owned.moonlight_gu || 0)
    + 8 * Number(latest.owned.moon_glow_gu || 0)
    + 4 * Number(latest.owned.moon_ray_gu || 0);
  if (foodNeed > 0 && latest.guCare
      && (latest.guCare.hungry || latest.guCare.petals < foodNeed)) {
    await lab.click('[data-prep-tab="gu"]');
    for (let buy = 0; buy < 2; buy += 1) {
      latest = await lab.snapshot();
      if (!latest.guCare?.hungry && latest.guCare?.petals >= foodNeed) break;
      const before = summary(latest);
      if (!await clickIfReady(lab, '[data-buy-gu-food]')) break;
      latest = await lab.snapshot();
      trace.push({ prep: latest.journey.nodeId, action: 'bought:moon_orchid_petals',
        before, state: summary(latest), event: latest.eventLog?.at(-1)?.action || null });
    }
  }
  const pending = (await lab.snapshot()).travelSoulDebt;
  const soulBeforeTravel = (await lab.snapshot()).soul;
  await lab.click('[data-prep-continue]');
  const afterTravel = await lab.snapshot();
  if (pending) {
    assert.equal(afterTravel.soul, soulBeforeTravel - pending.cost);
    assert.equal(afterTravel.travelSoulDebt, null);
    assert.equal(afterTravel.eventLog.filter(e => e.action === 'travel_soul_debt').length, 1);
    trace.push({action: 'debt:settled', state: summary(afterTravel)});
    await lab.reload();
    assert.equal((await lab.snapshot()).soul, afterTravel.soul);
    assert.equal((await lab.snapshot()).travelSoulDebt, null);
  }
  return afterTravel;
}

for (const {seed, build} of [{seed:3,build:'moon'}, {seed:11,build:'moon'}, {seed:3,build:'jade'}, {seed:3,build:'garden'}, {seed:11,build:'garden'}, {seed:1,build:'debt'}, {seed:3,build:'ray'}, {seed:3,build:'shadow'}, {seed:8,build:'late_accept'}, {seed:8,build:'late_leave'}]) {
test(`NORMAL_RUN: seed ${seed} ${build} develops a common Gu build through the full five-rank journey`, async () => {
  const lab = await openLab({ seed, viewport: [1280, 800] });
  const trace = [];
  const training = { count: 0 };
  let failure = '';
  try {
    await lab.click('[data-start-run]');
    let s = await lab.snapshot();
    for (let guard = 0; guard < 240 && !s.ending; guard += 1) {
      if (s.page === 'battle') {
        trace.push({ entered: s.journey.nodeId, enemy: s.battle?.enemies.map(e => e.id), state: summary(s) });
        const fightNode = s.journey.nodeId;
        s = await resolveFight(lab, build, trace);
        trace.push({ fight: fightNode, result: summary(s),
          lastLog: s.ending?.deathReport?.last3 || s.reward?.battleLog?.slice(-4)
            || s.battle?.log?.slice(-4) || [] });
        if (s.battle?.over === '败') { failure = 'combat_defeat'; break; }
        if (s.reward) {
          const rewardNode = s.journey.nodeId;
          const choices = s.reward.guChoices || [];
          const currentLeaves = Number(s.owned?.vitality_leaf_gu || 0);
          const selected = (s.blood <= s.bloodMax - 2 && currentLeaves < 2
            ? choices.find(id => id === 'vitality_leaf_gu') : null)
            || (!Number(s.owned?.stone_shell_gu || 0)
              ? choices.find(id => id === 'stone_shell_gu') : null)
            || choices.find(id => id === 'jade_skin_gu')
            || choices.find(id => !KEEP.has(id));
          if (selected) await lab.click(`[data-reward-gu="${selected}"]`);
          else await lab.click(choices.length ? '[data-reward-skip]' : '[data-reward-continue]');
          s = await lab.snapshot();
          if (s.page !== 'prep') { failure = `reward_did_not_open_prep:${s.page}`; break; }
          trace.push({ reward: rewardNode, state: summary(s) });
        }
      } else if (s.page === 'node-action') {
        s = await resolveNodeAction(lab, s, build, trace);
      } else if (s.page === 'prep') {
        s = await prepare(lab, s, training, trace, build);
      } else if (s.page === 'map') {
        const available = s.journey.availableNodeIds || [];
        if (!available.length) { failure = 'map_has_no_available_nodes'; break; }
        const nodes = available.map(id => s.journey.graph.nodes.find(n => n.id === id)).filter(Boolean);
        // Recover first when wounded; otherwise prefer a viable non-combat
        // opportunity before taking the first ordinary fight.
        const node = s.blood <= s.bloodMax - 3
          ? nodes.find(n => n.type === 'rest')
            || nodes.find(n => n.type === 'wild_gu' || n.type === 'seclusion')
            || (s.blood <= 5 ? nodes.find(n => !COMBAT.has(n.type)) : null)
          : null;
        const debtNode = build === 'debt' && !trace.some(x => x.action === 'debt:accepted') ? nodes.find(n => n.type === 'event' && n.event?.delayed_soul_cost === 1) : null;
        const saferDebtRoute = s.soul < 3 ? nodes.find(n => !COMBAT.has(n.type)) : null;
        const rangeNode = build === 'ray' && s.owned.moon_ray_gu > 0 ? nodes.find(n => n.enemyIds?.includes('range_gate_guard')) : null;
        const lateEventNode = build.startsWith('late_')
          ? nodes.find(n => build === 'late_accept'
            ? (s.cultivation === 4 && n.event?.id === 'herbalist_escort')
              || (s.cultivation === 5 && n.event?.id === 'miasma_meditation')
            : (s.cultivation === 4 && !trace.some(x => x.action === 'late:herbalist_left') && n.event?.id === 'herbalist_escort')
              || (s.cultivation === 5 && n.event?.id === 'miasma_meditation'))
          : null;
        const fogEvent = s.journey.graph.nodes.find(n => n.event?.id === 'miasma_meditation');
        const fogCapBattle = build === 'late_leave' && !trace.some(x => x.action === 'late:fog_cap_battle')
          && fogEvent && s.cultivation === 5
          ? nodes.find(n => n.segment === 5 && n.depth === fogEvent.depth - 1 && n.type === 'battle') : null;
        const shadowShop = build === 'shadow' && s.cultivation >= 4 && !trace.some(x => x.action === 'bought:moon_shadow_gu')
          ? nodes.find(n => n.type === 'market') : null;
        const shadowFight = build === 'shadow' && trace.some(x => x.action === 'bought:moon_shadow_gu')
          && !trace.some(x => x.action === 'shadow:cost_blocked')
          ? nodes.find(n => n.type === 'battle' && n.enemyIds?.includes('sword_qi_adept')) : null;
        const recipeFundingFight = build === 'ray' && !s.owned.moon_ray_gu && s.cultivation >= 2 && s.soul >= 2 ? nodes.find(n => n.type === 'battle') : null;
        const selectedNode = lateEventNode || fogCapBattle || rangeNode || debtNode || shadowShop || node || shadowFight || recipeFundingFight || saferDebtRoute
          || nodes.find(n => n.type === 'wild_gu' || n.type === 'seclusion' || n.type === 'rest')
          || nodes.find(n => n.type === 'battle')
          || nodes.find(n => COMBAT.has(n.type)) || nodes[0];
        if (!selectedNode) { failure = 'available_node_missing_from_graph'; break; }
        trace.push({ map: s.journey.nodeId, available: nodes.map(n => ({ id: n.id, type: n.type })), selected: selectedNode.id });
        if (selectedNode === fogCapBattle) trace.push({ action: 'late:fog_cap_battle', node: selectedNode.id });
        await lab.click(`[data-choose-node="${selectedNode.id}"]`);
        s = await lab.snapshot();
      } else if (s.reward) {
        await lab.click(s.reward.guChoices?.length ? '[data-reward-skip]' : '[data-reward-continue]');
        s = await lab.snapshot();
      } else {
        failure = `unexpected_page:${s.page}`;
        break;
      }
      await sleep(15);
    }
    const final = await lab.snapshot();
    const rankHistory = [...new Set(trace.filter(row => row.entered).map(row => row.state.rank))];
    const report = {
      fullFiveRankVictory: Boolean(final.ending?.outcome === 'victory'
        && final.cultivation === 5 && [2, 3, 4, 5].every(rank =>
          rankHistory.some(value => value.startsWith(`${rank}转/`)))),
      ending: final.ending, failure: failure || null, trainedVisits: training.count,
      final: summary(final), rankHistory, owned: final.owned, trace,
      growthAndCare: trace.filter(row => /^(attuned:|forged:|bought:moon_orchid_petals)/.test(row.action || '')),
      moonShadowEvidence: trace.filter(row => String(row.action || '').startsWith('shadow:') || row.action === 'bought:moon_shadow_gu'),
      browserErrors: lab.logs().filter(x => x.includes('[exception]')),
    };
    console.log(`[LONGRUN_REPORT] ${JSON.stringify(report)}`);
    assert.ok(report.fullFiveRankVictory,
      `seed=${seed} 未完成普通一至五转完整长局；实际到达层级与败因：${JSON.stringify(report)}`);
    assert.equal(report.browserErrors.length, 0, `浏览器异常：${JSON.stringify(report.browserErrors)}`);
    assert.match(await lab.text('[data-run-recap]'), /合炼成功 1 次/);
    const recap = final.ending.recap;
    const guUses = final.eventLog.filter(event => event.action === 'use_gu');
    assert.ok(guUses.length > 0, 'normal combat records actual Gu activations');
    const attackCount = final.eventLog.filter(event => event.action === 'basic_attack').length;
    assert.ok(recap.some(line => line.includes(`拳脚出手 ${attackCount} 次（出手次数，不代表命中）`)));
    await lab.reload();
    assert.equal((await lab.snapshot()).ending.outcome, 'victory');
    assert.deepEqual((await lab.snapshot()).ending.recap, recap);
    await lab.click('[data-tab="hall"]');
    assert.match(await lab.text('.archive-run'), /胜局/);
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'), build === 'jade' ? /白玉蛊/ : build === 'ray' ? /月痕蛊/ : /月芒蛊/);
    if (build === 'ray') {
      for (const action of ['bought:trail_stone_gu', 'forged:moonlight_ray', 'ray:long_shot']) assert.ok(trace.some(x => x.action === action), action);
    }
    if (build === 'shadow') {
      for (const action of ['bought:moon_shadow_gu', 'shadow:applied', 'shadow:cost_blocked']) {
        assert.ok(trace.some(row => row.action === action), `normal shadow route must execute ${action}`);
      }
      assert.ok(final.owned.vitality_grass_gu > 0, 'surplus sales preserve the vitality grass Gu');
      const shadowUses = guUses.filter(event => event.after.gu_id === 'moon_shadow_gu');
      const applications = trace.filter(row => row.action === 'shadow:applied');
      assert.equal(shadowUses.length, applications.length,
        'each real suppression has one matching Gu use event');
      assert.ok(applications.length >= 1);
      assert.ok(recap.some(line => line.includes('月影蛊')));
      const blocked = trace.find(row => row.action === 'shadow:cost_blocked');
      assert.ok(blocked.waitTurns >= 2 && blocked.waitTurns <= 4,
        `waited 2-4 ordinary turns for the cost gate: ${JSON.stringify(blocked)}`);
    }
  if (GARDEN_BUILDS.has(build)) {
      for (const action of ['found:vitality_grass_gu', 'attuned:vitality_grass_gu', 'produced:vitality_leaf_gu', 'treated:vitality_leaf_gu', 'sold:vitality_leaf_gu'])
        assert.ok(trace.some(x => x.action === action), `normal garden route must execute ${action}`);
      assert.ok(final.owned.vitality_grass_gu > 0);
      const productions = final.eventLog.filter(event => event.action === 'produce_gu').length;
      const treatments = final.eventLog.filter(event => event.action === 'consume_healing_gu').length;
      assert.ok(recap.some(line => line.includes(`产叶 ${productions} 次、耗叶疗伤 ${treatments} 次`)));
    }
    if (build === 'debt') {
      for (const action of ['debt:accepted', 'debt:nourished', 'debt:settled']) assert.ok(trace.some(x => x.action === action), action);
      assert.equal(final.travelSoulDebt, null);
      assert.match(recap.join(' '), /赶路已付魂魄 1，未结代价 0/);
    }
    if (build === 'late_accept') {
      for (const action of ['late:herbalist_accepted', 'late:herbalist_refreshed', 'debt:settled',
        'late:miasma_accepted', 'late:miasma_refreshed']) assert.ok(trace.some(row => row.action === action), action);
      assert.equal(final.travelSoulDebt, null);
      assert.equal(final.eventLog.filter(e => e.action === 'travel_soul_debt' && e.reason === 'debt_settled').length, 1);
      assert.equal(final.eventLog.filter(e => e.action === 'choose_action' && e.reason === 'event_accepted'
        && e.targets.includes('herbalist_escort')).length, 1);
      assert.equal(final.eventLog.filter(e => e.action === 'choose_action' && e.reason === 'event_accepted'
        && e.targets.includes('miasma_meditation')).length, 1);
      assert.match(recap.join(' '), /赶路已付魂魄 1，未结代价 0/);
      const herbalAccepted = trace.find(row => row.action === 'late:herbalist_accepted');
      const fogAccepted = trace.find(row => row.action === 'late:miasma_accepted');
      assert.equal(herbalAccepted.healthLoss, 2);
      assert.equal(herbalAccepted.stoneGain, 10);
      assert.equal(fogAccepted.healthLoss, 2);
      assert.ok(fogAccepted.essenceGain > 0 && fogAccepted.essenceGain <= 6);
      assert.ok(recap.includes(`药师托运 · 接纳 1 次，放弃 0 次；已付气血 ${herbalAccepted.healthLoss}`));
      assert.ok(recap.includes(`瘴口调息 · 接纳 1 次，放弃 0 次；已付气血 ${fogAccepted.healthLoss}，恢复真元 ${fogAccepted.essenceGain}`));
    }
    if (build === 'late_leave') {
      for (const action of ['late:herbalist_left', 'late:herbalist_refreshed', 'late:fog_cap_battle',
        'late:miasma_rejected_full', 'late:miasma_left_after_rejections']) assert.ok(trace.some(row => row.action === action), action);
      assert.equal(final.travelSoulDebt, null);
      assert.equal(final.eventLog.filter(e => e.action === 'travel_soul_debt').length, 0);
      assert.equal(final.eventLog.filter(e => e.action === 'choose_action' && e.reason === 'event_accepted'
        && ['herbalist_escort', 'miasma_meditation'].some(id => e.targets.includes(id))).length, 0);
      assert.equal(final.eventLog.filter(e => e.action === 'choose_action' && e.reason === 'event_left'
        && e.targets.includes('herbalist_escort')).length, 1);
      assert.equal(final.eventLog.filter(e => e.action === 'choose_action' && e.reason === 'event_left'
        && e.targets.includes('miasma_meditation')).length, 1);
      assert.ok(recap.includes('药师托运 · 接纳 0 次，放弃 1 次；已付气血 0'));
      assert.ok(recap.includes('瘴口调息 · 接纳 0 次，放弃 1 次；已付气血 0'));
    }
    if (build === 'jade') {
      assert.ok(trace.some(x => x.action === 'forged:white_jade_basic'));
      assert.ok(trace.some(x => x.action === 'used:white_jade_gu'));
      assert.ok(trace.some(x => x.action === 'used:permanent_strength'));
      const jadeUses = guUses.filter(event => event.after.gu_id === 'white_jade_gu').length;
      assert.ok(jadeUses > 0, 'maintained defense activations are recorded');
      assert.ok(recap.some(line => line.includes(`白玉蛊 ${jadeUses} 次`)));
    }
    assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
  } finally {
    await lab.close();
  }
});
}


for (const decision of ['accept_without_nourishment', 'leave']) {
  test(`NORMAL_RUN: delayed soul event ${decision} preserves its consequence through reload`, async () => {
    const lab = await openLab({ seed: 1, viewport: [1280, 800] });
    const trace = [], training = { count: 0 };
    try {
      await lab.click('[data-start-run]');
      let s = await lab.snapshot();
      for (let step = 0; step < 80; step++) {
        const node = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId);
        if (s.page === 'node-action' && node?.event?.delayed_soul_cost === 1) break;
        assert.ok(!s.ending, `warmup ended before the authored soul event: ${JSON.stringify(summary(s))}`);
        if (s.page === 'battle') s = await resolveFight(lab, 'moon', trace);
        else if (s.page === 'reward') {
          const choices = s.reward.guChoices || [];
          const pick = choices.find(id => id === 'jade_skin_gu') || choices.find(id => !KEEP.has(id));
          await lab.click(pick ? `[data-reward-gu="${pick}"]` : choices.length ? '[data-reward-skip]' : '[data-reward-continue]');
          s = await lab.snapshot();
        } else if (s.page === 'node-action') s = await resolveNodeAction(lab, s, 'moon', trace);
        else if (s.page === 'prep') s = await prepare(lab, s, training, trace, 'moon');
        else if (s.page === 'map') {
          const available = s.journey.graph.nodes.filter(n => s.journey.availableNodeIds.includes(n.id));
          const next = available.find(n => n.type === 'event' && n.event?.delayed_soul_cost === 1)
            || available.find(n => ['wild_gu', 'seclusion', 'rest'].includes(n.type))
            || available.find(n => n.type === 'battle') || available[0];
          assert.ok(next);
          await lab.click(`[data-choose-node="${next.id}"]`);
          s = await lab.snapshot();
        } else assert.fail(`unexpected warmup page ${s.page}`);
      }
      const eventNode = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId);
      assert.equal(eventNode?.event?.delayed_soul_cost, 1);
      assert.equal(s.soul, 1, 'the first event is reached before higher-tier nourishment');
      const before = s;
      await lab.click(`[data-node-action="${decision === 'leave' ? 'leave' : 'accept_event'}"]`);
      const prepared = await lab.snapshot();
      assert.equal(prepared.soul, before.soul);
      assert.equal(prepared.stones, before.stones + (decision === 'leave' ? 0 : eventNode.event.stone_gain));
      assert.equal(prepared.blood, before.blood - (decision === 'leave' ? 0 : eventNode.event.health_cost));
      await lab.reload();
      assert.deepEqual((await lab.snapshot()).travelSoulDebt, prepared.travelSoulDebt);
      if (decision !== 'leave') assert.match(await lab.text('#panel-prep'), /直接赶路将魂魄耗尽败北/);
      if (process.env.WENZHEN_DEBT_SCREENSHOT && decision !== 'leave') { await sleep(400); await lab.shoot(process.env.WENZHEN_DEBT_SCREENSHOT); }
      await lab.click('[data-prep-continue]');
      const after = await lab.snapshot();
      assert.equal(after.travelSoulDebt, null);
      if (decision === 'leave') {
        assert.equal(after.soul, before.soul);
        assert.equal(after.page, 'map');
        assert.equal(after.eventLog.filter(e => e.action === 'travel_soul_debt').length, 0);
      } else {
        assert.equal(after.soul, 0);
        assert.equal(after.ending.outcome, 'defeat');
        assert.equal(after.ending.title, '异闻代价耗尽魂魄');
        assert.equal(after.eventLog.filter(e => e.action === 'travel_soul_debt').length, 1);
        assert.match(after.ending.recap.join(' '), /赶路已付魂魄 1，未结代价 0/);
      }
      await lab.reload();
      assert.equal((await lab.snapshot()).soul, after.soul);
      assert.equal((await lab.snapshot()).travelSoulDebt, null);
      if (decision !== 'leave') {
        assert.equal((await lab.snapshot()).ending.outcome, 'defeat');
        await lab.click('[data-tab="hall"]');
        await lab.click('.archive-run details:first-of-type summary');
        assert.match(await lab.text('.archive-run'), /异闻代价耗尽魂魄/);
      }
      assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
      console.log('[SOUL_EVENT_REPORT]', JSON.stringify({decision, seed: 1, node: eventNode.id, event: eventNode.event.id,
        before: {soul: before.soul, stones: before.stones, blood: before.blood},
        accepted: {soul: prepared.soul, stones: prepared.stones, blood: prepared.blood, debt: prepared.travelSoulDebt},
        after: {soul: after.soul, debt: after.travelSoulDebt, outcome: after.ending?.outcome || null}}));
    } finally { await lab.close(); }
  });
}


for (const { seed, effect, decision } of [
  {seed:7,effect:'lose_route',decision:'withdraw'},
  {seed:7,effect:'lose_route',decision:'cross'},
  {seed:2,effect:'lose_clue',decision:'withdraw'},
]) {
  test(`NORMAL_RUN: hazard ${effect} ${decision} changes actual travel choices and survives reload`, async () => {
    const lab = await openLab({ seed, viewport:[1280,800] });
    try {
      await lab.click('[data-start-run]');
      const initial = await lab.snapshot();
      const node = initial.journey.graph.nodes.find(n => initial.journey.availableNodeIds.includes(n.id) && n.skipEffect === effect);
      assert.ok(node);
      await lab.click(`[data-choose-node="${node.id}"]`);
      assert.match(await lab.text('.node-action-choices'), effect === 'lose_route' ? /失去紧接着的去处/ : /失去本处刚查得/);
      await lab.click('[data-node-action="scout"]');
      const scouted = await lab.snapshot();
      assert.equal(scouted.page, 'node-action');
      assert.equal(scouted.prepFor, null);
      assert.equal(scouted.qi, initial.qi);
      assert.equal(scouted.stones, initial.stones);
      const newFacts = scouted.journey.graph.nodes.find(n => n.id === node.id).scoutedFactsAdded;
      assert.ok(newFacts.some(f => f.startsWith('route_battle_intel:')));
      assert.equal(await clickIfReady(lab, '[data-node-action="scout"]'), false, 'second scout is disabled');
      await lab.reload();
      assert.equal((await lab.snapshot()).page, 'node-action');
      assert.deepEqual((await lab.snapshot()).knownFacts, scouted.knownFacts);
      await sleep(400);
      if (process.env.WENZHEN_HAZARD_SCREENSHOT && effect==='lose_route' && decision==='withdraw') await lab.shoot(process.env.WENZHEN_HAZARD_SCREENSHOT);
      await lab.click(`[data-node-action="${decision}"]`);
      const prep = await lab.snapshot();
      assert.equal(prep.page, 'prep');
      assert.equal(prep.qi, initial.qi - (decision === 'cross' ? 1 : 0));
      const blocked = effect === 'lose_route' && decision === 'withdraw' ? [node.nextIds[0]] : [];
      assert.deepEqual(prep.journey.graph.nodes.find(n => n.id === node.id).blockedNextIds, blocked);
      if (effect === 'lose_clue') for (const fact of newFacts) assert.equal(prep.knownFacts.includes(fact), false);
      await lab.reload();
      await lab.click('[data-prep-continue]');
      const next = await lab.snapshot();
      assert.deepEqual(next.journey.availableNodeIds, node.nextIds.filter(id => !blocked.includes(id)));
      assert.equal(next.journey.completed.filter(id => id === node.id).length, 1);
      await lab.reload();
      assert.deepEqual((await lab.snapshot()).journey.availableNodeIds, next.journey.availableNodeIds);
      assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
    } finally { await lab.close(); }
  });
}

test('NORMAL_RUN: marsh bypass pressure persists through a non-combat stop, pays once at combat and is archived', async () => {
  const lab = await openLab({ seed:3, viewport:[1280,800] });
  const trace=[], training={count:0};
  try {
    await lab.click('[data-start-run]');
    let s=await lab.snapshot();
    for(let step=0;step<150;step++) {
      const node=s.journey.graph.nodes.find(n=>n.id===s.journey.nodeId);
      if(s.page==='node-action' && node?.skipEffect==='gain_pursuit') break;
      assert.ok(!s.ending, 'normal warmup must reach a marsh');
      if(s.page==='battle') s=await resolveFight(lab,'moon',trace);
      else if(s.page==='reward') {
        const choices=s.reward.guChoices||[];
        const pick=choices.find(id=>id==='jade_skin_gu')||choices.find(id=>!KEEP.has(id));
        await lab.click(pick?`[data-reward-gu="${pick}"]`:choices.length?'[data-reward-skip]':'[data-reward-continue]');s=await lab.snapshot();
      } else if(s.page==='prep') s=await prepare(lab,s,training,trace,'moon');
      else if(s.page==='node-action') s=await resolveNodeAction(lab,s,'moon',trace);
      else if(s.page==='map') {
        const nodes=s.journey.graph.nodes.filter(n=>s.journey.availableNodeIds.includes(n.id));
        const target=nodes.find(n=>n.skipEffect==='gain_pursuit')||(s.soul<3?nodes.find(n=>!COMBAT.has(n.type)):null)||nodes.find(n=>['rest','wild_gu','seclusion'].includes(n.type))||nodes.find(n=>n.type==='battle')||nodes[0];
        await lab.click(`[data-choose-node="${target.id}"]`);s=await lab.snapshot();
      } else assert.fail(`unexpected warmup page ${s.page}`);
    }
    const marsh=s.journey.graph.nodes.find(n=>n.id===s.journey.nodeId);
    assert.equal(marsh.skipEffect,'gain_pursuit');
    await lab.click('[data-node-action="withdraw"]');
    assert.ok((await lab.snapshot()).knownFacts.includes(`hazard_pressure:${marsh.id}`));
    assert.match(await lab.text('[data-travel-pressure]'), /下次交锋开场真元少 1/);
    await lab.reload();
    await lab.click('[data-prep-continue]');
    s=await lab.snapshot();
    const safe=s.journey.graph.nodes.find(n=>s.journey.availableNodeIds.includes(n.id)&&!COMBAT.has(n.type));
    assert.ok(safe, 'normal generated successor supplies a non-combat stop');
    await lab.click(`[data-choose-node="${safe.id}"]`);
    s=await resolveNodeAction(lab,await lab.snapshot(),'moon',trace);
    assert.ok(s.knownFacts.includes(`hazard_pressure:${marsh.id}`));
    assert.equal(s.eventLog.filter(e=>e.action==='travel_pressure_paid').length,0);
    await lab.click('[data-prep-continue]');s=await lab.snapshot();
    const fight=s.journey.graph.nodes.find(n=>s.journey.availableNodeIds.includes(n.id)&&COMBAT.has(n.type));
    await lab.click(`[data-choose-node="${fight.id}"]`);
    s=await lab.snapshot();
    assert.equal(s.qi,s.qiMax-1);
    assert.equal(s.battle.playerHuman.essence,s.qi);
    assert.equal(s.knownFacts.includes(`hazard_pressure:${marsh.id}`),false);
    assert.equal(s.eventLog.filter(e=>e.action==='travel_pressure_paid').length,1);
    assert.equal(s.eventLog.find(e=>e.action==='travel_pressure_paid').after.paid,1);
    await lab.reload();
    assert.equal((await lab.snapshot()).qi,s.qi);
    assert.equal((await lab.snapshot()).eventLog.filter(e=>e.action==='travel_pressure_paid').length,1);
    for(let stop=0;stop<30;stop++) {
      s=await lab.snapshot();if(s.ending)break;
      if(s.page==='battle') await lab.click('[data-retreat]');
      else if(s.page==='prep') await lab.click('[data-prep-continue]');
      else if(s.page==='map') {
        const n=s.journey.graph.nodes.find(n=>s.journey.availableNodeIds.includes(n.id)&&COMBAT.has(n.type));
        await lab.click(`[data-choose-node="${n.id}"]`);
      } else assert.fail(`unexpected retirement page ${s.page}`);
    }
    s=await lab.snapshot();assert.equal(s.ending.outcome,'retreat');
    assert.match(s.ending.recap.join(' '),/追赶已付真元 1，未结 0/);
    await lab.reload();await lab.click('[data-tab="hall"]');
    await lab.click('.archive-run details:first-of-type summary');
    assert.match(await lab.text('.archive-run'),/追赶已付真元 1，未结 0/);
    assert.equal(lab.logs().filter(x=>x.includes('[exception]')).length,0);
  } finally {await lab.close();}
});
