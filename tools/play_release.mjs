import { openLab } from '../tests/helpers/lab_browser.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dataContext = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/data.js', import.meta.url), 'utf8') + ';globalThis.DATA = DATA;', dataContext);
const DATA = dataContext.DATA;

const args = process.argv.slice(2);
const option = name => args.find((arg, i) => arg === name && args[i + 1]) ? args[args.indexOf(name) + 1] : undefined;
const entry = option('--entry') || process.env.WENZHEN_ENTRY;
const edge = option('--edge') || process.env.WENZHEN_EDGE;
const seed = Number(option('--seed') || 3);
const style = option('--style') || 'moon';
if (!['moon', 'blood', 'force'].includes(style)) throw new Error('--style must be moon, blood, or force');
const lab = await openLab({ ...(entry ? { entry } : {}), ...(edge ? { edge } : {}), seed });
const phaseRows = [];
const guUsed = new Set();
const guGained = new Set();
const failures = [];
const prepHealing = [];
const breakthroughs = [];
let priorCultivation = null;
let priorQiMax = null;
let archiveReview = '';
let laterReload = false;
const keep = new Set(['moonlight_gu', 'small_light_gu', 'jade_skin_gu', 'stone_shell_gu', 'vitality_leaf_gu', 'white_boar_strength_gu', 'moon_glow_gu', 'moon_ray_gu', 'white_jade_gu', 'aptitude_gu', 'blood_atk_3_11_gu', 'force_atk_4_02_gu', 'force_heal_3_03_gu']);
const click = async selector => { try { await lab.click(selector); return true; } catch { return false; } };
const record = (label, s) => {
  const node=s.journey?.graph?.nodes?.find(n=>n.id===s.journey.nodeId);
  const row = `${label}: ${node?.id||'无节点'} / ${node?.segment||s.cultivation}段，${s.cultivation}转/${s.cultivationStage}阶，真元上限${s.qiMax}，魂${s.soul}，元石${s.stones}，气血${s.blood}/${s.bloodMax}`;
  if (phaseRows.at(-1) !== row) phaseRows.push(row);
  if (priorCultivation !== null && s.cultivation !== priorCultivation) {
    breakthroughs.push({ fromRank: priorCultivation, toRank: s.cultivation, qiMaxBefore: priorQiMax, qiMaxAfter: s.qiMax, node: node?.id || null });
  }
  priorCultivation = s.cultivation;
  priorQiMax = s.qiMax;
};

async function fight() {
  for (let n = 0; n < 60; n++) {
    let s = await lab.snapshot();
    if (s.reward || s.ending || !s.battle || s.battle.over) return s;
    const alive = s.battle.enemies.filter(e => e.hp > 0);
    if (!alive.length) return s;
    const target = (alive.length > 1 ? alive.find(e => e.id !== 'thunder_crown_wolf') : null)
      || alive.find(e => e.id === s.battle.targetId) || alive[0];
    if (s.battle.targetId !== target.id) await click(`[data-target="${target.id}"]`);
    s = await lab.snapshot();
    let moved = false;
    const have = id => Number(s.owned?.[id] || 0) > 0
      && s.battle.playerHuman?.guInstances?.some(g => g.instanceId === `${id}::1` && !g.sealed);
    const use = async id => {
      if (s.qi < 1 || !have(id)) return false;
      const ok = await click(`[data-use-gu="${id}::1"]`);
      const after = ok ? await lab.snapshot() : s;
      const cast = after.eventLog?.slice(s.eventLog?.length || 0)
        .some(event => event.action === 'use_gu' && event.after?.gu_id === id);
      if (cast) { guUsed.add(id); moved = true; }
      return !!cast;
    };
    if (style === 'force' && s.blood <= s.bloodMax - 4 && s.qi >= 3
        && have('force_heal_3_03_gu')) moved = await use('force_heal_3_03_gu');
    if (!moved && s.blood <= s.bloodMax - 3) moved = await use('vitality_leaf_gu');
    const damage = Math.max(...alive.map(e => Number(e.enemyIntent?.damage ?? e.intent?.damage ?? 0)));
    if (!moved && damage >= 3 && s.qi >= 1 && have('stone_shell_gu')
        && !s.battle.playerHuman?.maintainedGu?.some(g => g.active)) moved = await use('stone_shell_gu');
    if (!moved && damage >= 3 && s.qi >= 5 && have('jade_skin_gu')
        && !s.battle.playerHuman?.maintainedGu?.some(g => g.active)) moved = await use('jade_skin_gu');
    if (!moved && damage >= 3 && s.qi >= 5 && have('white_jade_gu')
        && !s.battle.playerHuman?.maintainedGu?.some(g => g.active)) moved = await use('white_jade_gu');
    if (!moved && damage >= 3 && s.qi >= 5 && have('white_jade_gu')
        && !s.battle.playerHuman?.maintainedGu?.some(g => g.active && g.instanceId.startsWith('white_jade_gu::'))) moved = await use('white_jade_gu');
    const basicText = await lab.text('button[data-basic-attack] .cost');
    const basicDamage = Number(basicText.match(/力量\s*(\d+)/)?.[1] || 0);
    const basicDelayed = basicText.includes('敌人先行动');
    const evading = target.problemAxis === 'evasion';
    const armored = target.problemAxis === 'armor';
    const hardToHit = evading || armored;
    const forced = s.battle.playerHuman?.maintainedGu?.some(g => g.active && g.instanceId.startsWith('force_atk_4_02_gu::'));
    if (style === 'force' && !moved && s.blood <= s.bloodMax - 2 && s.cultivation >= 4
        && s.qi >= 2 && have('force_atk_4_02_gu') && !forced) moved = await use('force_atk_4_02_gu');
    if (!moved && style === 'force' && s.blood <= s.bloodMax - 4 && s.qi >= 3
        && have('force_heal_3_03_gu')) moved = await use('force_heal_3_03_gu');
    if (!moved && style === 'blood' && !evading && !armored && have('blood_atk_3_11_gu') && s.cultivation>=3 && s.qi>=2 && Number(target.statuses?.bleeding || 0)<4 && target.hp>4) moved=await use('blood_atk_3_11_gu');
    if (!moved && style === 'force' && Number(target.distanceMeters || 0)===0 && !hardToHit) moved=await click('[data-basic-attack]');
    if (!moved && style === 'moon' && Number(target.distanceMeters || 0)>10 && have('moon_ray_gu') && s.cultivation>=2 && s.qi>=2) moved=await use('moon_ray_gu');
    const moonGlow = DATA.gu.find(g => g.id === 'moon_glow_gu')?.battleEffect?.amount || 0;
    if (!moved && have('moon_glow_gu') && s.qi>=4 && !evading
        && (style !== 'force' || armored && basicDamage <= Number(target.armorValue || 0))
        && (!armored || moonGlow > Number(target.armorValue || 0))) moved=await use('moon_glow_gu');
    const moonSupport = s.battle.turnSupports?.guTargets?.moonlight_gu;
    const supportFallback = style === 'moon' || style === 'blood' || style === 'force' && hardToHit;
    if (!moved && supportFallback && s.qi >= 3 && have('small_light_gu') && have('moonlight_gu')
        && !moonSupport && (!armored || 6 > Number(target.armorValue || 0))) {
      moved = await use('small_light_gu');
      if (moved) { s = await lab.snapshot(); moved = false; }
    }
    const moonlightDamage = Number(DATA.gu.find(g => g.id === 'moonlight_gu')?.battleEffect?.amount || 0)
      * (s.battle.turnSupports?.guTargets?.moonlight_gu ? 2 : 1);
    if (!moved && (evading || style === 'moon' || style === 'blood' || style === 'force' && hardToHit)
        && s.qi >= 2 && have('moonlight_gu') && target.hp > 0
        && (!armored || moonlightDamage > Number(target.armorValue || 0))) moved = await use('moonlight_gu');
    if (!moved && evading && s.qi >= 2 && have('moon_ray_gu') && s.cultivation >= 2 && target.hp > 0) moved = await use('moon_ray_gu');
    if (!moved && style === 'blood' && !hardToHit && s.qi >= 2 && have('moonlight_gu') && target.hp > 0) moved = await use('moonlight_gu');
    const basicWorks = (!evading || basicDamage <= Number(target.evasionBreakpoint ?? 2))
      && (!armored || basicDamage > Number(target.armorValue || 0))
      && (!basicDelayed || s.blood > damage);
    if (!moved && style === 'force' && Number(target.distanceMeters || 0)===0 && basicWorks) moved=await click('[data-basic-attack]');
    if (!moved && style === 'moon' && have('moon_glow_gu') && s.qi>=4 && target.hp>0 && !hardToHit) moved=await use('moon_glow_gu');
    if (!moved && target.distanceMeters > 0) moved = await click('[data-approach]');
    if (!moved && basicWorks) moved = await click('[data-basic-attack]');
    if (!moved) moved = await click('[data-end-turn]');
    if (!moved) return s;
    await new Promise(r => setTimeout(r, 15));
  }
  return await lab.snapshot();
}

async function prepare(s) {
  if (s.page !== 'prep') return s;
  if (s.owned?.force_heal_3_03_gu && s.cultivation >= 3 && s.blood < s.bloodMax && s.qi >= 3) {
    await click('[data-prep-tab="gu"]');
    const before = s;
    if (await click('[data-heal-self="force_heal_3_03_gu"]')) {
      s = await lab.snapshot();
      const count = s.owned.force_heal_3_03_gu;
      if (s.blood <= before.blood || s.qi !== before.qi - 3 || count !== before.owned.force_heal_3_03_gu) failures.push('整备自疗回血/扣费/库存不一致');
      await lab.reload();
      const restored = await lab.snapshot();
      const reloadOk = restored.blood === s.blood && restored.qi === s.qi && restored.owned.force_heal_3_03_gu === count;
      if (!reloadOk) failures.push('整备自疗刷新后状态不一致');
      prepHealing.push({node:s.journey.nodeId,rank:s.cultivation,before:{blood:before.blood,qi:before.qi},after:{blood:s.blood,qi:s.qi},count,reloadOk});
      s = restored;
    }
  }
  const offerId = guId => DATA.shopOffers.find(offer => offer.gu_id === guId)?.id;
  const displayedPrice = async offerId => {
    const text = await lab.text(`article:has(button[data-buy-offer="${offerId}"]) .so-foot`);
    const match = text.match(/(\d+) 元石/);
    return !match || /本店未上架|已购入|已售罄/.test(text) ? null : Number(match[1]);
  };
  const buy = async id => {
    const cost = await displayedPrice(id);
    if (cost == null || s.stones < cost || !await click(`[data-buy-offer="${id}"]`)) return false;
    const stonesBefore = s.stones;
    s = await lab.snapshot();
    return s.stones < stonesBefore;
  };
  const sellDuplicates = async needed => {
    await click('[data-prep-tab="gu"]');
    if (s.owned?.stone_shell_gu && s.owned?.jade_skin_gu && s.stones < needed) {
      await click('[data-sell-gu="jade_skin_gu"]');
      s = await lab.snapshot();
    }
    for (const [id, count] of Object.entries(s.owned || {})) {
      if (count < 2 || id === 'vitality_leaf_gu'
          || id === DATA.flow.sariByRank?.[s.cultivation]) continue;
      while (Number(s.owned?.[id] || 0) > 1 && s.stones < needed
          && await click(`[data-sell-gu="${id}"]`)) s = await lab.snapshot();
      if (s.stones >= needed) break;
    }
    await click('[data-prep-tab="shop"]');
    s = await lab.snapshot();
  };

  await click('[data-prep-tab="gu"]');
  if (s.owned?.vitality_grass_gu) await click('[data-produce-leaf="vitality_grass_gu"]');
  if (s.owned?.aptitude_gu && s.aptitude !== 'jia') await click('[data-use-aptitude]');
  await click('[data-prep-tab="shop"]');
  s = await lab.snapshot();

  // The live card decides supply, sale state, and the layer-priced amount.
  while (s.soul < 3) {
    const cost = await displayedPrice('soul_pill');
    if (cost == null) break;
    if (s.stones < cost) {
      await sellDuplicates(cost);
      if (s.stones < cost) break;
    }
    if (!await buy('soul_pill')) break;
  }
  const order = DATA.flow.aptitudeOrder;
  const nextAptitude = DATA.flow.aptitudeGateByTargetRank[Math.min(5, s.cultivation + 1)];
  if (s.soul >= 3 && s.cultivationStage === 3 && order.indexOf(s.aptitude) < order.indexOf(nextAptitude) && !s.owned?.aptitude_gu) {
    const id = offerId('aptitude_gu');
    const cost = await displayedPrice(id);
    if (cost != null) { await sellDuplicates(cost); await buy(id); }
  }
  if (style === 'force' && s.cultivation >= 3 && !s.owned?.force_heal_3_03_gu) {
    await buy(offerId('force_heal_3_03_gu'));
  }
  if (style === 'blood' && s.soul >= 3 && s.cultivation >= 3 && !s.owned?.blood_atk_3_11_gu) {
    const id = offerId('blood_atk_3_11_gu');
    if (await buy(id)) guGained.add('blood_atk_3_11_gu');
  }
  if (style === 'blood' && s.cultivation >= 2
      && !s.owned?.blood_atk_3_11_gu && !s.owned?.moon_glow_gu && !s.owned?.moon_ray_gu) {
    for (const guId of ['moon_glow_gu', 'moon_ray_gu']) {
      if (await buy(offerId(guId))) break;
    }
  }
  if (style === 'force' && !s.owned?.force_atk_4_02_gu) {
    await buy(offerId('force_atk_4_02_gu'));
  }
  if (style === 'moon' && s.soul >= 3 && s.cultivation >= 2
      && !s.owned?.moon_glow_gu && !s.owned?.moon_ray_gu && !s.owned?.white_jade_gu) {
    for (const guId of ['moon_glow_gu', 'moon_ray_gu', 'white_jade_gu']) {
      if (await buy(offerId(guId))) break;
    }
  }

  await click('[data-prep-tab="gu"]');
  s = await lab.snapshot();
  if (s.owned?.aptitude_gu && s.aptitude !== 'jia') await click('[data-use-aptitude]');
  for (let i = 0; i < 3 && s.owned?.white_boar_strength_gu; i++) {
    if (!await click('[data-train-body="white_boar_strength_gu"]')) break;
    s = await lab.snapshot();
  }
  const trained = (s.modifierLedger || [])
    .filter(row => row.sourceEffectId === 'body_training')
    .reduce((total, row) => total + row.amount, 0);
  if (trained >= 3) {
    while (s.owned?.white_boar_strength_gu > 0
        && await click('[data-sell-gu="white_boar_strength_gu"]')) s = await lab.snapshot();
  }

  // Save for stocked soul supply before optional rank-up spending.
  await click('[data-prep-tab="shop"]');
  if ((s.cultivation < 5 || s.cultivationStage < 3) && (s.soul >= 3 || await displayedPrice('soul_pill') == null)) {
    await click('[data-break="sari"]');
    await click('[data-break="stone"]');
  }
  s = await lab.snapshot();
  if (s.cultivation < 5 && s.stones < 15) {
    await click('[data-prep-tab="gu"]');
    for (const [id, count] of Object.entries(s.owned || {})) {
      if (count < 2 || (keep.has(id) && !['white_boar_strength_gu', 'jade_skin_gu'].includes(id))
          || id === DATA.flow.sariByRank?.[s.cultivation]) continue;
      while (Number(s.owned?.[id] || 0) > 1 && await click(`[data-sell-gu="${id}"]`)) s = await lab.snapshot();
    }
    await click('[data-prep-tab="shop"]');
    await click('[data-break="stone"]');
  }

  await click('[data-prep-tab="gu"]');
  s = await lab.snapshot();
  if (s.owned?.vitality_grass_gu) await click('[data-produce-leaf="vitality_grass_gu"]');
  if (s.blood < s.bloodMax && s.owned?.vitality_leaf_gu) await click('[data-use-leaf="vitality_leaf_gu"]');
  await click('[data-prep-continue]');
  return await lab.snapshot();
}
try {
  await lab.click('[data-start-run]');
  let s = await lab.snapshot();
  record('开局', s);
  for (let step = 0; step < 240 && !s.ending; step++) {
    if (s.page === 'battle') {
      s = await fight();
      if (s.reward) {
        const gained = s.reward.guChoices || [];
        if (gained.length) {
          const sari = DATA.flow.sariByRank?.[s.cultivation];
          const preferred = style === 'force'
            ? ['force_atk_4_02_gu', 'force_heal_3_03_gu', 'white_boar_strength_gu', 'stone_shell_gu', 'white_jade_gu', 'jade_skin_gu', 'vitality_leaf_gu', 'aptitude_gu', sari]
            : style === 'blood'
              ? ['blood_atk_3_11_gu', 'force_heal_3_03_gu', 'moonlight_gu', 'jade_skin_gu', 'vitality_leaf_gu', 'aptitude_gu', sari]
              : ['moon_glow_gu', 'moon_ray_gu', 'moonlight_gu', 'white_jade_gu', 'vitality_leaf_gu', 'aptitude_gu', sari];
          const wanted = preferred;
          const choice = gained.find(id => wanted.includes(id) && !Number(s.owned?.[id] || 0))
            || [...gained].sort((a, b) => Number(DATA.gu.find(g => g.id === b)?.value || 0) - Number(DATA.gu.find(g => g.id === a)?.value || 0))[0];
          await click(`[data-reward-gu="${choice}"]`);
          guGained.add(choice);
        }
        else await click('[data-reward-continue]');
        s = await lab.snapshot();
      }
    } else if (s.page === 'prep') {
      if (s.cultivation >= 4 && !laterReload) {
        const saved = ({page,owned,stones,blood,qi,cultivation,cultivationStage,aptitude,soul,modifierLedger,journey}) =>
          JSON.stringify({page,owned,stones,blood,qi,cultivation,cultivationStage,aptitude,soul,modifierLedger,journey});
        await lab.reload();
        const restored = await lab.snapshot();
        if (saved(restored) !== saved(s)) { failures.push('高转整备刷新后状态不一致'); break; }
        s = restored; laterReload = true;
        record('高转刷新续档',s);
      }
      const before = s;
      s = await prepare(s);
      record('整备', s);
      if (s.page === 'prep' && s.journey?.nodeId === before.journey?.nodeId
          && s.stones === before.stones && s.cultivation === before.cultivation
          && s.cultivationStage === before.cultivationStage) {
        failures.push(`整备无法继续：节点${s.journey?.nodeId}，魂${s.soul}，元石${s.stones}`);
        break;
      }
    } else if (s.page === 'node-action') {
      const node = s.journey.graph.nodes.find(n => n.id === s.journey.nodeId);
      const choices = node?.choices || [];
      if (node?.type === 'rest') {
        await click('[data-node-action="node.rest_heal"]');
        if ((await lab.snapshot()).page === 'node-action') await click('[data-node-action="node.leave"]');
      } else if (node?.type==='event') {
        const e=node.event;
        if (!e?.delayed_soul_cost && (e?.gu_reward_id || e?.stone_gain>0) && s.blood>Number(e.health_cost || 0)) await click('[data-node-action="accept_event"]');
        else await click('[data-node-action="leave"]');
      } else {
        const ordered = ['collect_gu', 'work', 'harvest', 'meditate', 'cultivate', 'scout', 'leave'];
        let acted = false;
        for (const action of ordered) {
          if (choices.includes(action) && await click(`[data-node-action="${action}"]`)) { acted = true; break; }
        }
        if (!acted) await click('[data-node-action="leave"]');
      }
      s = await lab.snapshot();
    } else if (s.page === 'map') {
      const nodes = s.journey.graph.nodes.filter(n => s.journey.availableNodeIds.includes(n.id));
      const combat = n => ['battle', 'elite', 'boss'].includes(n.type);
      const needsStyleGu = style === 'force'
        ? (s.cultivation >= 3 && !s.owned?.force_heal_3_03_gu || s.cultivation >= 4 && !s.owned?.force_atk_4_02_gu)
        : style === 'blood' && s.cultivation >= 3 && !s.owned?.blood_atk_3_11_gu;
      const needsForceGu = style === 'force' && s.cultivation >= 3 && !s.owned?.force_atk_4_02_gu;
      const node = (needsForceGu && nodes.find(n => n.type === 'elite'))
        || nodes.find(n => n.event?.gu_reward_id === 'force_heal_3_03_gu' && s.blood > Number(n.event.health_cost || 0))
        || (needsStyleGu && nodes.find(n => n.type === 'market'))
        || (s.cultivation >= 4 && s.cultivation < 5 && s.stones < 60
          && s.blood >= Math.ceil(s.bloodMax * 0.7) && nodes.find(n => n.type === 'battle'))
        || nodes.find(n => n.type === 'rest')
        || nodes.find(n => ['garden', 'herb', 'meditation', 'seclusion', 'market', 'cultivation', 'wild_gu'].includes(n.type))
        || (s.stones < 12 && s.blood >= Math.ceil(s.bloodMax * 0.7) && nodes.find(n => n.type === 'battle'))
        || nodes.find(n => !combat(n))
        || nodes.find(n => n.type === 'battle') || nodes[0];
      if (!node) { failures.push('地图无可选节点'); break; }
      await lab.click(`[data-choose-node="${node.id}"]`);
      s = await lab.snapshot();
      record(`进入${node.type}`, s);
    } else if (s.ending) break;
    else { failures.push(`未知页面 ${s.page}`); break; }
    if (s.ending) record(`结局 ${s.ending.outcome || s.ending.kind || '未知'}`, s);
    else if (!['map', 'prep', 'battle', 'node-action', 'reward'].includes(s.page)) { failures.push(`流程停在 ${s.page}`); break; }
  }
  if (!s.ending) failures.push(`未结束：${s.page}，${s.cultivation}转，节点${s.journey?.nodeId || '无'}`);
  else {
    await click('[data-ending-hall]');
    archiveReview=await lab.text('.archive-section');
    if(!archiveReview.includes('修行旧录') || !archiveReview.includes(`种子 ${seed}`)) failures.push(`结局后旧录未能确认显示本局种子${seed}`);
    await lab.reload();
    await click('[data-ending-hall]');
    if(await lab.text('.archive-section') !== archiveReview) failures.push('结局旧录刷新后不一致');
  }
} catch (error) {
  failures.push(error?.stack || String(error));
} finally {
  const final = await lab.snapshot().catch(() => null);
  const actionCounts = { basicAttacks: 0, guUses: {} };
  for (const event of final?.eventLog || []) {
    if (event.action === 'battle_loot' && event.reason === 'loot_gu_gained') for (const id of event.targets || []) guGained.add(id);
    if (event.action === 'choose_action' && event.after?.gu_acquired) guGained.add(event.after.gu_acquired);
    if (event.action === 'use_gu') {
      const id = event.after?.gu_id;
      if (keep.has(id)) guUsed.add(id);
      if (id) actionCounts.guUses[id] = (actionCounts.guUses[id] || 0) + 1;
    }
    if (event.action === 'basic_attack') actionCounts.basicAttacks += 1;
  }
  const exceptions = lab.logs().filter(line => line.includes('[exception]'));
  console.log(JSON.stringify({ seed, style, entry: lab.url(), result: phaseRows, breakthroughs, gainedGu: [...guGained], usedGu: [...guUsed], actionCounts, prepHealing, archiveReview, recap: final?.ending?.recap,
    ending: final?.ending?.outcome || final?.ending?.kind || null, laterReload,
    failure: failures, browserExceptions: exceptions }, null, 2));
  await lab.close();
}
