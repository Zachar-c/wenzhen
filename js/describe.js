// 描述真实数据表里的 effect 结构，供三个面板共用。普通脚本：全局函数。
function effectText(e) {
  if (!e) return '—';
  const one = (x) => {
    switch (x.kind) {
      case 'strike': {
        const consume = x.consume_status
          ? ` · 消耗${statusLabel(x.consume_status.name)}每层+${x.consume_status.per_stack}`
          : '';
        return `击伤 ${x.amount}${x.ignoreEvasion ? ' · 无视闪避（仍受反击与护甲影响）' : ''}${x.bleeding ? ' · 造伤后每回合失血2，重复命中累计上限4（适配）' : ''}${x.range_meters ? ` · 射程 ${x.range_meters}米` : ''}${consume}`;
      }
      case 'recipe_component': return '合炼组件 · 不单独催用';
      case 'production': return '整备耗真元催生生机叶 · 每节点一次 · 本体保留 · 试玩时间适配';
      case 'body_training': return '整备时逐步锻体 · 已得力量永久保留 · 同型不能重复叠加';
      case 'maintained': if ((x.modifiers || []).some(m => m.effect_id === 'injury_strength')) return '苦力增力 · 拳脚按失血比例追加常备力量（基础与永久锻体） · 治疗后回落 · 不直接伤敌 · 维持不耗元、占操控1 · 可停止 · 公式与费用为游戏适配'; if ((x.modifiers || []).some(m => m.attribute === 'attackDelay')) return `石臂防御 ${x.amount} · 成形后不付维持或承击费 · 拳脚+1，晚1回合结算 · 可主动停止 · 试玩参数`; return `持续防御 ${x.amount ?? (x.modifiers || []).filter(m => m.attribute === 'defense').reduce((n, m) => n + m.amount, 0)} · 每回合真元 ${x.upkeep_qi || 0} · 每次承击真元 ${x.hit_qi || 0} · 跨回合占操控 ${x.focus_cost || 0} · 可主动停止 · 试玩参数`;
      case 'shield': return `护体 ${x.amount}`;
      case 'grant_block': return `格挡 ${x.amount}`;
      case 'heal': return `恢复气血 ${x.amount}${x.strength_scaling ? ' + 当前自身力量加成（含苦力蛊随伤势变化；不计石臂重量，数值为游戏适配）' : ''}${x.consumable ? ' · 用后消失 · 每节点一次有效疗伤 · 试玩时间适配' : ''}`;
      case 'heal_and_strike': return `恢复气血 ${x.heal} · 击伤 ${x.amount}`;
      case 'add_temp_stat': return `${statName(x.stat)} +${x.amount}`;
      case 'support': return x.target_gu_id
        ? `本回合下一次${GU_BY_ID[x.target_gu_id]?.name || x.target_gu_id} ×${x.multiplier}${x.nonStacking ? ' · 同类不叠加' : ''} · 同催准备，不占行动`
        : `助${x.support_school} +${x.support_bonus}`;
      case 'essence_suppression': return `压制空窍份额 · 三转${x.percent_by_rank?.['3'] ?? 60}% / 四转${x.percent_by_rank?.['4'] ?? 30}% / 五转${x.percent_by_rank?.['5'] ?? 15}% · 丙等三转无法动用真元 · 不叠加，本遭遇持续 · 真元点数与回复为适配`;
      case 'status': return `标记 ${x.amount}`;
      case 'shift': return `位移 ${x.amount}`;
      case 'sword_intent': return `剑意 +${x.amount}`;
      case 'weaken_intent': return `弱化敌方意图 ${x.amount}`;
      case 'aptitude_up': return '使用后资质提升一档';
      case 'breakthrough_material': return '同阶舍利蛊 · 可用于小突破';
      default: return x.kind;
    }
  };
  let text = e.kind === 'composite' ? (e.parts || []).map(one).join(' · ') : one(e);
  if (e.delay) text += ` · 延迟 ${e.delay.turns || 1} 回合`;
  if (e.condition?.type === 'self_hp_below') {
    text += ` · 条件：气血低于 ${Math.round(Number(e.condition.threshold || 0.5) * 100)}%`;
  }
  return text;
}

function statName(s) {
  return { force_power: '力', speed: '速', guard: '御' }[s] || s;
}

// 只解释正式效果之间的配合，不把库存命名为已经成型的打法。
function guPairingText(gu, owned = {}) {
  const effect = gu.battleEffect || gu.effect || {};
  if (effect.target_gu_id) return `${Number(owned[effect.target_gu_id] || 0) > 0 ? '可辅助已持有的' : '需要配合'}${GU_BY_ID[effect.target_gu_id]?.name || effect.target_gu_id}：先催辅助，再在同回合催目标蛊，×${effect.multiplier}；不能增幅其他攻击蛊，同类不叠加。`;
  const support = Object.values(GU_BY_ID).find(item => item.battleEffect?.target_gu_id === gu.id);
  if (support) return `${Number(owned[support.id] || 0) > 0 ? '可配合已持有的' : '可搭配'}${support.name}：先催辅助，再催${gu.name}，本回合下一击×${support.battleEffect.multiplier}；两次催蛊分别支付真元与操控。`;
  if (effect.kind === 'body_training') return '整备锻体提高永久力量，提升拳脚伤害及自力更生的疗效；取得锻体蛊后仍需实际锻体。';
  if (effect.strength_scaling) return '疗效随自身力量变化：永久锻体与战斗中苦力蛊的伤势增力均可提高回血；回血后苦力增力回落，石臂重量不计入疗效。';
  if ((effect.modifiers || []).some(item => item.effect_id === 'injury_strength')) return '永久锻体可提高常备力量；受伤时催苦力增加拳脚与自力更生疗效，回血后增力回落。苦力不直接伤敌，不要为增力把气血耗尽。';
  if (effect.bleeding) return '先命中并造成伤害才能留下伤口；被闪避、反击吞掉或未破防都不会造伤。面对闪避可保留标明无视闪避的攻击蛊应对；小光只增幅月光，不能增幅血月。';
  return '';
}

function statusLabel(s) {
  return { marked: '刻痕', sealed: '封印' }[s] || s;
}

// 线索只是可见征象的译名，不据此增加命中、伤害或反制效果。
const clueLabel = (id) => ({
  stone_dust: '石屑扬尘', steady_stance: '站姿稳固', lowered_shoulders: '肩背压低', wet_fang: '獠牙湿亮',
  mud_caked: '泥壳覆身', worn_tusks: '獠牙磨损', crackling_fur: '皮毛电光噼啪', hunched_gait: '弓背而行',
  coiled_shadows: '盘绕的阴影', scraped_scale: '鳞甲刮痕', bone_charms: '骨制护符', burnt_incense: '焚香余味',
  high_ground: '占据高处', steady_breath: '呼吸平稳', bloody_miasma: '血色瘴气', green_pupils: '碧绿瞳孔',
  charged_fur: '皮毛蓄电', crackling_air: '空气电响', wilting_aura: '衰败气息', slow_gaits: '步态迟缓',
  swollen_veins: '青筋鼓起', beating_drum: '鼓声震响', frosted_temples: '两鬓霜白', solemn_robe: '庄重袍服',
  blue_fur: '蓝色尸毛', corpse_army: '尸群列阵', locked_shieldwall: '盾墙相扣', even_line: '阵列齐整',
  droning_wings: '振翅嗡鸣', swarming_shadows: '群影涌动', hound_whistle: '猎犬哨声', crossbow_glint: '弩机寒光',
  corpse_bells: '尸铃摇响', paper_talismans: '纸符飘动', crimson_veins: '血色脉络', grave_fog: '坟地阴雾',
  bone_powder_trail: '骨粉拖痕', throwing_arc: '抛掷弧线', fresh_blood_scent: '新鲜血腥味', crouching_stalk: '伏低潜行',
  arcing_fur: '皮毛电弧', zigzag_pivots: '折返转向', calloused_grips: '掌心厚茧', braced_stance: '蓄力站姿',
  commanding_gesture: '指挥手势', docile_growl: '驯兽低吼', pale_blade_hum: '苍白刀光嗡鸣', fencing_stance: '持剑架势',
  blood_soaked_hide: '兽皮浸血', bone_grove: '骨林密布', white_ritual_robe: '白色祭袍', wielding_hand: '执持手势',
  hidden_stakes: '暗藏桩钉', shifting_mist: '雾气流转', crimson_palm_callus: '血色掌茧', stale_blood_stench: '陈血腥臭',
  crimson_drone_hum: '血色群虫嗡鸣', biting_mist: '蚀咬薄雾', iron_feather_glint: '铁羽闪光', crushing_talons: '沉重利爪',
  vast_wing_shadow: '巨大翼影', scaled_nape: '后颈覆鳞', hyena_frame: '鬣狗身形', calculating_eyes: '盘算的目光',
  distant_gate: '远处关隘', whip_crack: '鞭声脆响', chained_beasts: '锁链缚兽', soul_lantern_flicker: '魂灯闪烁',
  whisper_wind: '风中低语', blood_moon_trace: '血月痕迹', splitting_swarm: '虫群分散', mirage_step: '幻影步伐',
  echoed_voice: '声音回荡', tremor_lines: '地面震纹', sand_breath: '沙尘吐息',
}[id] || id);

function guReasonLabel(reason) {
  return {
    production_visit_used: '本次整备已催生',
    not_preparing: '整备时可催生',
    gu_unavailable: '未持有该蛊',
    target_out_of_range: '目标超出射程，先接近',
    healing_recovery: '本节点已用生机叶，尚在疗伤间隔',
    health_full: '气血已满，不消耗蛊虫或真元',
    resource_component_unsupported: '产叶或消耗蛊须单独使用',
    already_active: '正在催动',
    defense_group_active: '同类持续蛊已催动，请先停止',
    insufficient_essence: '真元不足',
    maintained_component_unsupported: '持续蛊须单独催动',
    unknown_gu: '未找到该蛊',
    gu_consumed: '本场已消耗',
    gu_sealed: '已封印',
    gu_used_this_turn: '本回合已用',
    insufficient_qi_quality: '真元质量不足',
    action_limit_reached: '本回合行动数已尽',
    insufficient_thought: '本回合操控余量不足',
    insufficient_true_qi: '真元不足',
    condition_miss: '条件未满足',
    consume_status_missing: '缺少可消耗的状态层数',
    delay_shape_rejected: '延迟效果结构非法',
    trigger_unsupported: '触发方式未实现',
    suppression_target_unsupported: '只对三至五转蛊师',
    suppression_already_active: '已受月影压制，不重复付费',
  }[reason] || reason || '';
}

// 杀招展示必须从组件 battleEffect 合成结果生成（L0 2026-09-25 权威语义）。
// 预制 m.effect 只作兼容元数据，不再直接上屏。
function killMoveEffectText(move, guById = {}) {
  if (typeof GuRules === 'undefined' || !GuRules.killMoveEffectPlan) {
    return effectText(move?.effect);
  }
  const plan = GuRules.killMoveEffectPlan(move, guById, {});
  if (plan.unavailableReason) return guReasonLabel(plan.unavailableReason);
  const parts = [];
  if (plan.heal) parts.push(`恢复气血 ${plan.heal}`);
  if (plan.block) parts.push(`护体 ${plan.block}`);
  if (plan.damage) parts.push(`击伤 ${plan.damage}`);
  if (plan.swordIntent) parts.push(`剑意 +${plan.swordIntent}`);
  if (plan.intentWeaken) parts.push(`弱化敌方意图 ${plan.intentWeaken}`);
  for (const st of plan.statuses || []) parts.push(`标记 ${st.amount || 1}`);
  if (plan.support) parts.push(`助${plan.support.school} +${plan.support.bonus}`);
  if (plan.inspect) parts.push('查验');
  if (plan.suppressCounter) parts.push('压制反制');
  if (plan.armorBreak) parts.push(`破甲 ${plan.armorBreak}`);
  if (plan.ignoreEvasion) parts.push('必中');
  if (plan.delayTurns) parts.push(`延迟 ${plan.delayTurns} 回合`);
  let text = parts.length ? parts.join(' · ') : '—';
  const conditions = [];
  for (const definitionId of move?.recipe || []) {
    const gu = guById[definitionId] || {};
    const effect = gu.v1_effect || gu.battleEffect || null;
    if (effect?.condition?.type === 'self_hp_below') {
      conditions.push(`${gu.name || definitionId}：气血低于 ${Math.round(Number(effect.condition.threshold || 0.5) * 100)}%`);
    }
  }
  if (conditions.length && !move?.componentConditionOverride) {
    text += ` · 继承条件：${conditions.join('；')}`;
  }
  if (move?.componentConditionOverride) {
    text += ' · 已覆盖组件条件';
  }
  return text;
}

const schoolLabel = (s) => ({
  light: '光道', moon: '月道', blood: '血道', force: '力道', earth: '土道',
  water: '水道', qi: '气道', wood: '木道', fire: '火道', wisdom: '智道',
  human: '人道', sword: '剑道', gold: '金道', bone: '骨道', wind: '风道',
}[s] || s || '—');

// 构筑角色有两套键：buildRole/DEFAULT_BUILD_ROLE 的大写键与数据表 role 的小写键，
// 只在上屏时翻译；规则层（GuRules.buildRoleOf）保持原始键，测试按原始键断言。
const buildRoleLabel = (role) => ({
  attack: '攻击', healing: '治疗', defense: '防御', recon: '侦查',
  movement: '机动', support: '辅助', logistics: '后勤',
  Core: '核心', Defense: '防御', Information: '情报', Support: '辅助', Transform: '蜕变',
  Finisher: '终结', Resource: '资源',
}[role] || role || '—');

// 已有竖版卡牌按蛊虫 ID 对应；尚无专属卡面的道具保留原图。
const GU_CARD_ART_IDS = new Set([
  'moonlight_gu', 'small_light_gu', 'moon_glow_gu', 'moon_ray_gu',
  'white_boar_strength_gu', 'jade_skin_gu', 'stone_shell_gu', 'white_jade_gu',
  'vitality_grass_gu', 'moon_shadow_gu', 'gold_atk_2_11_gu', 'gold_atk_2_12_gu',
  'force_atk_4_02_gu', 'force_heal_3_03_gu', 'blood_atk_3_11_gu',
]);
function guArt(gu, compact = false) {
  const definition = GU_BY_ID[gu?.id] || gu;
  if (!definition?.icon) return '';
  const src = GU_CARD_ART_IDS.has(definition.id)
    ? `assets/gu/cards/${definition.id}_card.png.webp`
    : `assets/gu/${definition.icon}.png`;
  return `<img class="gu-art${compact ? ' gu-art-compact' : ''}" data-gu-art="${definition.id}" src="${src}" alt="" decoding="async">`;
}

// 卡面只摘要规则；完整条件保留在可展开的详情中。
function guEffectSummary(effect) {
  const e = effect || {};
  let parts;
  switch (e.kind) {
    case 'strike': parts = [`⚔ 伤害 ${e.amount}`, ...(e.range_meters ? [`射程 ${e.range_meters}m`] : []), ...(e.ignoreEvasion ? ['无视闪避'] : []), ...(e.bleeding ? ['流血 2/回合 · 上限4'] : [])]; break;
    case 'support': parts = [`${GU_BY_ID[e.target_gu_id]?.name || e.support_school || '辅助'} ×${e.multiplier || e.support_bonus}`, '本回合 · 不叠加']; break;
    case 'body_training': parts = [`力量 +${e.amount}`, `永久 · 上限 +${e.cap}`]; break;
    case 'production': parts = [`生机叶 +${e.amount}`, '每处整备一次']; break;
    case 'heal': parts = [`♡ 恢复 ${e.amount}${e.strength_scaling ? ' + 自身力量' : ''}`, ...(e.consumable ? ['消耗1片 · 每节点一次'] : [])]; break;
    case 'maintained': {
      const injury = (e.modifiers || []).some(m => m.effect_id === 'injury_strength');
      const slow = (e.modifiers || []).some(m => m.attribute === 'attackDelay');
      parts = injury ? ['受伤增力', '回血后回落 · 占操控1'] : [`◇ 防御 ${e.amount}`, ...(slow ? ['拳脚 +1 · 延迟1回合'] : [`维持真元 ${e.upkeep_qi || 0}/回合`, `承击真元 ${e.hit_qi || 0}/次`, `占操控 ${e.focus_cost || 0}`])];
      break;
    }
    case 'essence_suppression': parts = ['压制敌方真元', '三转60% · 四转30% · 五转15%']; break;
    case 'breakthrough_material': parts = ['小境界突破', '同转数使用']; break;
    case 'aptitude_up': parts = ['资质 ↑ 一档', '原创机缘']; break;
    default: parts = [effectText(e)];
  }
  if (e.delay) parts.push(`延迟 ${e.delay.turns || 1} 回合`);
  if (e.condition?.type === 'self_hp_below') parts.push(`气血 < ${Math.round(Number(e.condition.threshold || .5) * 100)}%`);
  return parts.map(part => {
    const tokens = [
      [/^⚔ 伤害 (.*)$/, 'battle'], [/^◇ 防御 (.*)$/, 'shield'], [/^♡ 恢复 (.*)$/, 'heart'],
      [/^力量 (.*)$/, 'fist'], [/^射程 (.*)$/, 'route'], [/^占操控 (.*)$/, 'eye'],
      [/^维持真元 (.*)$/, 'clock'], [/^承击真元 (.*)$/, 'shield'],
    ];
    for (const [pattern, icon] of tokens) {
      const match = part.match(pattern);
      if (match) return visualValue(icon, match[1].replace(' + 自身力量', ' + ✊'), part);
    }
    const symbolic = { '无视闪避': '🎯', '小境界突破': '↑', '同转数使用': '＝',
      '每处整备一次': '1×', '受伤增力': '♡↓ → ✊↑', '回血后回落 · 占操控1': '♡↑ → ✊↓ · ◎1',
      '压制敌方真元': '✦↓', '资质 ↑ 一档': '↑', '原创机缘': '◇',
    }[part];
    if (symbolic) return `<span title="${part}" aria-label="${part}">${symbolic}</span>`;
    const target = e.kind === 'support' && e.target_gu_id && GU_BY_ID[e.target_gu_id];
    if (target && part.includes('×')) return `<span class="effect-pairing" title="${part}" aria-label="${part}">${guArt(target, true)} ×${e.multiplier}</span>`;
    return `<span>${part}</span>`;
  }).join('');
}

function guFace(gu, compact = false) {
  const definition = GU_BY_ID[gu.id] || gu;
  const cost = gu.trueQiCost ?? definition.trueQiCost;
  const thought = gu.thoughtCost ?? definition.thoughtCost;
  return `<span class="gu-face${compact ? ' compact' : ''}">${guArt(gu, compact)}
    <span class="card-rank">${definition.rank} 转</span>
    <span class="card-caption"><strong>${definition.name}</strong><span class="card-cost">${visualValue('spark', cost || 0, '真元消耗')}${visualValue('eye', thought || 0, '操控消耗')}${Number(gu.lifeCost || definition.lifeCost || 0) > 0 ? `<span>寿元 −${gu.lifeCost || definition.lifeCost}</span>` : ''}</span></span>
  </span>`;
}

function visualIcon(name, label = '') {
  const extra = { next: 'M5 12h14 M12 5l7 7-7 7', play: 'M8 4l12 8-12 8z',
    check: 'M4 12l5 5L20 6', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18z M12 7v5l4 2',
    fist: 'M5 12V7h3V4h3v3h3V5h3v4h3v6l-5 6H8L3 14z',
    leaf: 'M4 20L18 6 M4 16C1 4 14 2 21 3c0 10-4 17-13 15',
    crown: 'M3 7l5 5 4-8 4 8 5-5-2 13H5z', exit: 'M10 3H4v18h6 M9 12h12 M16 7l5 5-5 5',
    skull: 'M7 16v5h10v-5c6-5 3-13-5-13S1 11 7 16z M7 10h2 M15 10h2 M10 17h4',
    lock: 'M6 11h12v10H6z M8 11V7a4 4 0 018 0v4', target: 'M12 3a9 9 0 110 18 9 9 0 010-18z M12 8a4 4 0 110 8 4 4 0 010-8z',
  };
  const path = extra[name] || (typeof ICON !== 'undefined' ? ICON[name] : '') || extra.target;
  return `<svg class="visual-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
function visualValue(icon, value, label, danger = false) {
  return `<span class="visual-value${danger ? ' danger' : ''}" title="${label}" aria-label="${label}">${visualIcon(icon)}<b>${value}</b></span>`;
}

function nodeChoiceVisual(node, option) {
  const items = [];
  const add = (icon, value, label, danger = false) => items.push(visualValue(icon, value, label, danger));
  if (option.healthCost) add('heart', `−${option.healthCost}`, '立即气血代价', true);
  if (option.essenceCost) add('spark', `−${option.essenceCost}`, '真元消耗', true);
  if (option.stoneCost) add('coin', `−${option.stoneCost}`, '元石费用', true);
  if (option.stoneGain) add('coin', `+${option.stoneGain}`, '元石收益');
  if (option.recovery) {
    add('heart', `+${option.recovery.healthGain}`, '气血恢复');
    add('spark', `+${option.recovery.essenceGain}`, '真元恢复');
  }
  if (option.id === 'accept_event') {
    const e = node.event || {};
    if (e.gu_reward_id && GU_BY_ID[e.gu_reward_id]) items.push(`<span class="choice-gu-reward">${guArt(GU_BY_ID[e.gu_reward_id], true)}<b>+1</b></span>`);
    if (e.essence_gain) add('spark', `+${(NodeActionRules.resolveEvent('accept_event', e, {health: state.blood, stones: state.stones, essence: state.qi, essenceMax: state.qiMax}).essenceAfter ?? state.qi) - state.qi}`, '真元恢复');
    if (e.delayed_soul_cost) items.push(`${visualIcon('clock')}${visualValue('soul', `−${e.delayed_soul_cost}`, '继续行程时扣除魂魄', true)}${state.soul <= e.delayed_soul_cost ? visualValue('skull', '!', '未补养魂魄直接继续会败北', true) : ''}`);
  }
  if (['work', 'harvest', 'meditate'].includes(option.id)) {
    const result = NodeActionRules.resolve(option.id, {stones: state.stones, essence: state.qi, essenceMax: state.qiMax});
    if (result.stoneAfter > result.stoneBefore) add('coin', `+${result.stoneAfter - result.stoneBefore}`, '元石收益');
    if (result.essenceAfter > result.essenceBefore) add('spark', `+${result.essenceAfter - result.essenceBefore}`, '真元收益');
  }
  if (['scout', 'buy_information'].includes(option.id)) add('eye', '→', '揭示前路情报');
  if (option.id === 'collect_gu') {
    const find = currentGuFind(node);
    if (find?.guId && GU_BY_ID[find.guId]) items.push(`<span class="choice-gu-reward">${guArt(GU_BY_ID[find.guId], true)}<b>+1</b></span>`);
    else add('gu', '+1', '取得蛊虫');
  }
  if (option.id === 'trade') items.push(`<span class="choice-gu-reward">${guArt(GU_BY_ID.vitality_leaf_gu, true)}<b>+1</b></span>`);
  const hazard = NodeActionRules.hazardOutcome(node, option.id);
  if (hazard.closes.length) add('route', '×', '失去一条后继路线', true);
  if (hazard.loseNewIntel) add('eye', '×', '失去本处探查情报', true);
  if (hazard.pressure) items.push(`${visualIcon('clock')}${visualValue('spark', '−1', '下次交锋真元代价', true)}`);
  if (option.unknownNote) add('eye', '?', '尚有未明后果', true);
  if (!items.length) add(['leave', 'withdraw', 'node.leave'].includes(option.id) ? 'next' : 'check', '→', '继续');
  return `<div class="choice-visual" aria-label="选择后果">${items.join('')}</div>`;
}
