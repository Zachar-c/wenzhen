// 路线、节点图、整备页与终局页。状态转换仍全部收口到 main.js 的 act。
const STAGE_LABEL = { one: '一转', two: '二转', three: '三转', four: '四转', five: '五转' };
const APTITUDE_LABEL = { jia: '甲等', yi: '乙等', bing: '丙等', ding: '丁等' };

// 整备页页签。选中项必须活过整页重绘，否则卖蛊后会弹回坊市。
let prepTab = 'shop';
const PREP_TABS = [
  { id: 'shop', label: '坊市' },
  { id: 'gu', label: '蛊仓' },
];

function guById(id) {
  return (typeof GU_BY_ID !== 'undefined' && GU_BY_ID[id]) || DATA.gu.find((g) => g.id === id) || null;
}

function nodeById(id) {
  if (!id) return null;
  return RunFlow.nodeById(state.journey.graph, id);
}

function currentNode() {
  return nodeById(state.journey.nodeId);
}

function npcById(id) {
  return DATA.npcs.find((n) => n.id === id) || null;
}

function eventById(id) {
  return DATA.events.find((e) => e.id === id) || null;
}

// 节点类型中文名优先取 Godot 侧 data/names.json 的 types 分区（DATA.nodeTypes）；该分区缺
// rest 键（数据缺口，覆盖页已登记），回退名由 NodeActionRules.typeLabel 提供
// （来源 scripts/presentation/display_text.gd:54）。
// battle/elite/boss 是原型自己的战斗节点分层，不在该分区内，走回退。
function nodeTypeLabel(type) {
  return NodeActionRules.typeLabel(type, DATA.nodeTypes)
    || ({ battle: '战斗', elite: '精英', boss: '层主' }[type])
    || type || '未知';
}

function actionLabel(action) {
  return DATA.actions[action] || action;
}

function stageLabel(stage) {
  return STAGE_LABEL[stage] || stage || '—';
}

function nodeEnemyIds(node) {
  if (!node) return [];
  return [...new Set([...(node.enemyIds || []), node.enemyKind, ...(node.enemyKinds || [])].filter(Boolean))];
}

function enemyById(id) {
  return DATA.enemies.find((e) => e.id === id) || null;
}

function currentSegment() {
  return Number(currentNode()?.segment || 1);
}

function journeyProgress() {
  const graph = state?.journey?.graph || {};
  const segmentCount = Math.max(1, Number(graph.segmentCount) || 5);
  const nodesPerSegment = Math.max(0, Number(graph.prepPerSegment) || 0);
  const completed = new Set(state?.journey?.completed || []);
  const completedNodes = [...completed].map((id) => RunFlow.nodeById(graph, id)).filter(Boolean);
  const activeNode = currentNode();
  const nextNode = (state?.journey?.availableNodeIds || [])
    .map((id) => RunFlow.nodeById(graph, id)).find(Boolean) || null;
  const lastCompleted = completedNodes.length ? completedNodes[completedNodes.length - 1] : null;
  const positionNode = activeNode || nextNode || lastCompleted;
  const visitedNodes = completed.size + (activeNode && !completed.has(activeNode.id) ? 1 : 0);
  const totalNodes = segmentCount * (nodesPerSegment + 1);
  const passedSegments = new Set(completedNodes.filter((node) => node.type === 'boss').map((node) => Number(node.segment)));
  const activeSegment = Math.max(1, Math.min(segmentCount,
    Number(positionNode?.segment) || Math.min(segmentCount, passedSegments.size + 1)));
  return { segmentCount, nodesPerSegment, visitedNodes, totalNodes, activeSegment, passedSegments, positionNode };
}

function segmentProgressMarkup(activeSegment = 1) {
  const progress = journeyProgress();
  return `<ol class="segment-progress" aria-label="五段修行进度">${Array.from({ length: progress.segmentCount }, (_, index) => {
    const segment = index + 1;
    const passed = progress.passedSegments.has(segment);
    const current = segment === Number(activeSegment) && !passed;
    const status = passed ? 'done' : current ? 'current' : 'future';
    const ariaCurrent = current ? ' aria-current="step"' : '';
    const label = passed ? '已过' : current ? '当前' : '未至';
    return `<li class="segment-step ${status}"${ariaCurrent}><span>第 ${segment} 段</span><b>${segmentTitle(segment)}</b><em>${label}</em></li>`;
  }).join('')}</ol>`;
}

function journeyNodeStep(node, graph = state?.journey?.graph || {}) {
  if (!node) return '选择下一站';
  if (node.type === 'boss') return '挑战本段层主';
  const total = Math.max(1, Number(graph.prepPerSegment) || 1);
  return `路途节点 ${Number(node.depth || 0) + 1} / ${total}`;
}

// 选中节点后该回到哪一页：战斗/结算/未解析的节点动作/统一整备。
function currentNodePage() {
  if (state.battle) return 'battle';
  if (state.reward) return 'reward';
  const node = currentNode();
  if (node && NodeActionRules.nodeTypes.includes(node.type) && state.prepFor !== node.id) return 'node-action';
  return 'prep';
}

function segmentTitle(segment) {
  return DATA.flow.segmentTitles?.[String(segment)] || `第 ${segment} 段`;
}

// 性能：只绘当前页。showPage / draw 都经这里，避免一次动作重建全部面板。
function renderJourneyPage(page) {
  if (page === 'hall') renderHall(document.querySelector('#panel-hall'));
  else if (page === 'map') renderMap(document.querySelector('#panel-map'));
  else if (page === 'node-action') renderNodeActions(document.querySelector('#panel-node-action'));
  else if (page === 'prep') renderPrep(document.querySelector('#panel-prep'));
  else if (page === 'reward') renderReward(document.querySelector('#panel-reward'));
  else if (page === 'ending') renderEnding(document.querySelector('#panel-ending'));
}

// ── 上下文引导（2026-10-03）────────────────────────────────────────────
// 每屏突出「此刻真的能做的事」，最多三条；全是读现有 state 与既有规则函数得到的，
// 不新增 act 接口、不改规则与数值、也不替玩家选路。cap 只给「参考清单」类块放宽。
function guideBlock(title, items, cap = 3) {
  const lines = (items || []).filter(Boolean).slice(0, cap);
  if (!lines.length) return '';
  return `<section class="guide-block" data-guide><div class="kicker">${title}</div>`
    + `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul></section>`;
}

// 整备工具「在哪用」：按实际持有给入口；没有的写清取得路径（缺什么从哪来，不是推荐）。
function prepToolLines() {
  const owned = Object.values(GU_BY_ID).filter((gu) => Number(state.owned[gu.id] || 0) > 0);
  const trainers = owned.filter((gu) => gu.effect?.kind === 'body_training');
  const herbs = owned.filter((gu) => gu.effect?.kind === 'production' || gu.effect?.consumable);
  const selfHealers = owned.filter((gu) => gu.effect?.kind === 'heal' && gu.effect.strength_scaling);
  return [
    trainers.length
      ? `永久锻体 · ${trainers.map((gu) => `${gu.name}（真元 ${gu.trueQiCost} · 费用 ${gu.feedingCost} 元石 → 力量 +${gu.effect.amount}，同型上限 +${gu.effect.cap}）`).join('、')}，入口在「蛊仓」页，每次整备一次。`
      : '永久锻体 · 尚未持有锻体蛊（白豕蛊）；取得后在「蛊仓」页锻体。',
    herbs.length
      ? `草与叶 · ${herbs.map((gu) => (gu.effect?.kind === 'production'
        ? `${gu.name} 本体保留、真元 ${gu.trueQiCost} 产叶 ${gu.effect.amount}`
        : `${gu.name} 疗伤 ${gu.effect.amount}，用掉一片`)).join('；')}；两者都在「蛊仓」页按持有数量使用。`
      : '草与叶 · 尚未持有九叶生机草或生机叶；它们从行程、坊市与战后奖励取得。',
    ...selfHealers.map((gu) => `${gu.name} · 战斗与整备时均可自疗；蛊仓整备自疗按当前自身力量计算，不消耗蛊虫，真元 ${gu.trueQiCost}。`),
  ];
}

// 「缺什么」按四种原因分开写恢复路径，避免把修为、库存、真元/操控混成一句「资源不足」。
function gapRecoveryLines(next) {
  return [
    next.kind === 'max'
      ? '缺修为 · 已到当前修炼上限；继续靠行程与坊市积累蛊虫与元石。'
      : next.kind === 'big'
        ? `缺修为 · 整备「修炼突破」花元石并达到资质门槛；资质不足用资质机缘提升。舍利蛊不能替代大突破。当前目标「${next.targetLabel}」需 ${next.stoneCost} 元石。`
        : `缺修为 · 整备「修炼突破」花元石，或用 1 只当前转数同阶舍利蛊完成小突破。当前目标「${next.targetLabel}」需 ${next.stoneCost} 元石。`,
    '缺库存 · 蛊虫从行程、坊市与战后奖励取得；卖蛊按价值 50% 返还。',
    '缺真元 / 操控 · 操控每真实回合刷新；真元逐回合恢复，并扣持续蛊的维持与承击费，休整节点再补 2 点——新交锋按战前间歇折算补满真元，再扣绕行追赶损耗（试玩适配）。',
  ];
}

function renderHall(root) {
  if (!root) return;
  const difficulty = state.journey.difficulty || 'normal';
  const preset = DATA.flow.difficulties[difficulty] || DATA.flow.difficulties.normal;
  const started = !!state.journey.started;
  const progress = journeyProgress();
  const inProgress = typeof isInProgressRun === 'function' ? isInProgressRun() : false;
  const saveIssue = typeof bootSaveIssue !== 'undefined' ? bootSaveIssue : null;
  const saveStatus = typeof lastSaveStatus !== 'undefined' ? lastSaveStatus : { ok: true, reason: '' };
  const archiveResult = globalThis.LabSave?.readArchive
    ? LabSave.readArchive(typeof saveStorage === 'function' ? saveStorage() : null)
    : { ok: false, reason: 'archive_unavailable' };
  const archivedRuns = archiveResult.ok ? archiveResult.runs : [];
  const archiveWins = archivedRuns.filter((run) => run.outcome === 'victory').length;
  const recentRuns = archivedRuns.slice(0, 5);
  const cannotRead = saveIssue === 'unreadable';
  const storageDown = saveIssue === 'storage_error' || saveStatus.ok === false;
  const saveLine = cannotRead
    ? '<div class="hall-save bad">无法读取存档 · 原文已保留 · 请明确选择重新开局</div>'
    : storageDown
      ? '<div class="hall-save bad">存储不可用 · 本局无法续玩 · 不会假称已保存</div>'
      : inProgress
        ? '<div class="hall-save ok">本局会自动保存 · 刷新后可继续</div>'
        : started
          ? '<div class="hall-save">本局已结束 · 可直接开始新局</div>'
          : '';
  // 首屏引导按真实 state 分支：老玩家看到的只是一行状态，不是强制教程关卡。
  const hallSteps = cannotRead
    ? ['存档原文已保留但读不出来：点「开始新局」明确重开；旧进度无法恢复。']
    : storageDown
      ? ['存储不可用：本局无法续玩，现在开局也不会被保存；先确认浏览器允许本地存储。']
      : inProgress
        ? ['行程已自动保存：点「继续当前局」回到离开时的节点；要重头走再点「开始新局」（会先确认）。',
          progress.positionNode ? `当前停在「${progress.positionNode.name}」（第 ${progress.activeSegment} 段）；先看下一站可走节点上的风险与代价再动手。` : '']
        : started
          ? ['上一局已结束：点「开始新局」从头走，或在下方「修行旧录」里用同一颗种子复走。']
          : ['先选难度再点「开始新局」：三个难度只改每段路途节点数与总节数（见下方按钮），五段结构与层主不变。',
            '开局自带六只一转蛊。',
            '第一站通常是第 1 段的路途节点：战斗给元石与蛊虫，休整补气血与真元，市集与异闻各付代价。'];
  root.innerHTML = `
    <div class="hall-grid">
      <section class="hall-main">
        <div class="eyebrow">问真 · 五段问道</div>
        <h1>问真</h1>
        <p class="hall-copy">在随机山境中择路而行，识破对手意图，以蛊虫与有限资源走完五境。每段路途都会通向一位层主；遭遇、异闻、坊市与整备共同构成一条修行。进度会自动保存，离开后仍可回来续修。</p>
        ${saveLine}
        ${guideBlock('此刻可以做什么', hallSteps)}
        ${state.ending ? `
        <div class="hall-ending" data-hall-ending>
          <div class="kicker">终局摘要 · ${state.ending.outcome === 'victory' ? '胜局' : state.ending.outcome === 'retreat' ? '主动止步' : '败局'}</div>
          <h2>${state.ending.title}</h2>
          <p>${state.ending.detail}</p>
          <div class="resource-row">
            <span>${state.ending.outcome === 'victory' ? '胜局' : state.ending.outcome === 'retreat' ? '主动止步' : '败局'}</span>
            <span>回合 ${state.ending.turn || 0}</span>
            <span>行程 ${progress.visitedNodes} / ${progress.totalNodes}</span>
          </div>
        </div>` : ''}
        <div class="difficulty-row">
          ${Object.entries(DATA.flow.difficulties).map(([key, value]) => `
            <button class="${key === difficulty ? 'on' : ''}" data-difficulty="${key}" aria-pressed="${key === difficulty}">
              <b>${value.label}</b><span>每段 ${value.prepPerSegment} 个路途节点 + 层主 · 全程 ${5 * (value.prepPerSegment + 1)} 节</span>
          </button>`).join('')}
        </div>
        ${inProgress ? '<p class="difficulty-note">更换难度或开新局会放弃当前行程；系统会在切换前再次确认。</p>' : ''}
        <div class="hall-loop" data-hall-loop>
          <div class="kicker">一局怎么走</div>
          <p>选难度开局 → 每段先走路途节点（战斗 / 精英 / 休整 / 市集 / 寻蛊 / 险地 / 异闻）→ 战后结算领蛊 → 整备（坊市买蛊、蛊仓锻体、修炼突破）→ 走满本段再挑战层主。五段走尽，本局结束。</p>
        </div>
        <div class="hall-starting-kit" data-starting-kit>
          <div class="kicker">新局行囊 · 六类开局工具</div>
          <ul class="kit-list">${Object.entries(READY.owned).map(([id, count]) => {
            const gu = guById(id);
            return `<li><b>${gu?.name || id}</b> ×${count}<span>${gu ? effectText(gu.effect) : ''}</span></li>`;
          }).join('')}</ul>
          <p class="muted">更多蛊虫通过行程、坊市、战后奖励与奇遇遗藏取得；高转蛊要先到对应修为才能催动，持有不等于可用。</p>
        </div>
        <div class="hall-save-limits" data-save-limits>
          <div class="kicker">存档边界</div>
          <p>只保留一个进行中存档：自动保存、刷新可继续；换浏览器或清理浏览器数据不会迁移。开新局或改难度会放弃当前行程（会先确认）。结局后局内资源按规则清空，只留旧录。</p>
        </div>
        <div class="hall-actions">
          ${inProgress ? '<button class="primary" data-continue-run>继续当前局</button>' : ''}
          <button class="${inProgress ? 'ghost' : 'primary'}" data-start-run>${inProgress ? '开始新局' : started ? '重新开局' : '开始新局'}</button>
          ${started && !state.ending ? '<button class="ghost" data-go-map>查看当前行程</button>' : ''}
        </div>
      </section>
      <aside class="hall-side">
        <div class="kicker">${started ? '修行行程' : '入世前 · 本局规模'}</div>
        <div class="hall-big">${started ? progress.visitedNodes : progress.totalNodes}<span>${started ? `/ ${progress.totalNodes}` : ' 个必经节点'}</span></div>
        <div class="hall-node">${state.ending
          ? `${state.ending.outcome === 'victory' ? '五境走尽' : '止步于此'} · ${state.ending.title}`
          : currentNode()
            ? `${nodeTypeLabel(currentNode().type)} · ${currentNode().name}`
            : started && state.journey.availableNodeIds?.length
              ? `前方 ${state.journey.availableNodeIds.length} 条道路 · 选择下一站`
              : started && progress.positionNode
              ? `下一站 · ${nodeTypeLabel(progress.positionNode.type)} · ${progress.positionNode.name}`
              : started ? '等待选择下一节点' : '五段修行 · 每段终有层主'}
        </div>
        <div class="hall-progress-label">${state.ending ? '本局结果已记入修行旧录' : started ? '已踏过的节点（含当前遭遇）' : `${preset.label} · 种子 ${state.seed}`}</div>
        ${started ? `<div class="journey-meter" role="meter" aria-label="本局行程进度" aria-valuemin="0" aria-valuemax="${progress.totalNodes}" aria-valuenow="${progress.visitedNodes}"><i style="width:${Math.min(100, progress.visitedNodes / Math.max(1, progress.totalNodes) * 100)}%"></i></div>` : ''}
        ${segmentProgressMarkup(progress.activeSegment)}
        <div class="hall-preset">${preset.label} · ${progress.totalNodes} 个必经节点 · 种子 ${state.seed}</div>
      </aside>
    </div>
    <h2 style="margin-top:28px">本局记录</h2>
    ${state.journal.length
      ? `<div class="journal">${state.journal.slice(0, 8).map((line, i) => `<div><span>${String(state.journal.length - i).padStart(2, '0')}</span>${line}</div>`).join('')}</div>`
      : '<div class="empty">还没有记录。开局后，节点结算、奖励与整备会写在这里。</div>'}
    <section class="archive-section">
      <div class="section-head">
        <div><div class="kicker">跨局留存 · 最近 ${Math.min(archivedRuns.length, 5)} 局</div><h2>修行旧录</h2></div>
        <div class="archive-total">已记 ${archivedRuns.length} 局 · 胜局 ${archiveWins}</div>
      </div>
      ${state.ending?.archiveSaved === false ? '<p class="hall-save bad">本局结局未能写入旧录；当前局仍可查看。</p>' : ''}
      ${!archiveResult.ok
        ? '<div class="empty">旧录暂不可读取，原始存档仍留在此浏览器中。</div>'
        : recentRuns.length
          ? `<div class="archive-list">${recentRuns.map((run) => archiveRunCard(run)).join('')}</div>`
          : '<div class="empty">完成一局修行后，种子、路线与结局会留在这里。</div>'}
    </section>`;

  root.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.difficulty === state.journey.difficulty) return;
      if (typeof requestDifficultyChange === 'function') {
        requestDifficultyChange(button.dataset.difficulty);
        return;
      }
      state = fresh(button.dataset.difficulty);
      draw();
    });
  });
  root.querySelector('[data-continue-run]')?.addEventListener('click', () => {
    if (typeof continueRun === 'function') continueRun();
  });
  root.querySelector('[data-start-run]').addEventListener('click', () => act.startRun(state.journey.difficulty || 'normal'));
  root.querySelector('[data-go-map]')?.addEventListener('click', () => showPage('map'));
  root.querySelectorAll('[data-run-seed]').forEach((button) => {
    button.addEventListener('click', () => act.startRun(button.dataset.difficulty, button.dataset.runSeed));
  });
}

function archiveRunCard(run) {
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const difficulty = DATA.flow.difficulties?.[run.difficulty]?.label || run.difficulty || '未知难度';
  const ended = run.endedAt ? new Date(run.endedAt) : null;
  const date = ended && Number.isFinite(ended.getTime())
    ? ended.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '日期未知';
  const route = (Array.isArray(run.trail) ? run.trail : []).map((node) =>
    `<span>${safe(node.segment)} · ${safe(node.type)} · ${safe(node.name)}</span>`).join('');
  const journal = (Array.isArray(run.journal) ? run.journal : []).map((line) => `<li>${safe(line)}</li>`).join('');
  return `<article class="archive-run ${run.outcome === 'victory' ? 'won' : 'lost'}">
    <div class="archive-run-head">
      <div><div class="kicker">${run.outcome === 'victory' ? '胜局' : run.outcome === 'retreat' ? '主动止步' : '败局'} · ${safe(run.rank || '')}</div>
        <h3>${safe(run.title || '无题')}</h3></div>
      <button class="ghost archive-replay" data-run-seed="${safe(run.seed)}" data-difficulty="${safe(run.difficulty)}">复走种子 ${safe(run.seed)}</button>
    </div>
    <p>${safe(run.detail || '')}</p>
    ${run.recap?.length ? `<details><summary>此生修行</summary><ul>${run.recap.map(line => `<li>${safe(line)}</li>`).join('')}</ul></details>` : ''}
    <div class="archive-meta"><span>${difficulty}</span><span>${date}</span><span>行程 ${Number(run.visitedNodes ?? run.completedNodes) || 0}/${Number(run.totalNodes) || 0}</span></div>
    <details><summary>查看路线与局内记录</summary>
      <div class="archive-trail">${route || '<span>没有路线记录</span>'}</div>
      ${journal ? `<ul class="archive-journal">${journal}</ul>` : ''}
    </details>
  </article>`;
}

function renderMap(root) {
  if (!root) return;
  const selected = state.journey.nodeId;
  const available = new Set(state.journey.availableNodeIds || []);
  const completed = new Set(state.journey.completed || []);
  const firstAvailable = available.size ? RunFlow.nodeById(state.journey.graph, [...available][0]) : null;
  const segment = selected ? Number(currentNode().segment) : Number(firstAvailable?.segment || 1);
  const current = currentNode();
  const candidates = [...available]
    .map((id) => RunFlow.nodeById(state.journey.graph, id))
    .filter(Boolean)
    .sort((a, b) => a.depth - b.depth || a.slot - b.slot);
  const pathNodes = (state.journey.graph.nodes || [])
    .filter((node) => completed.has(node.id) && node.segment === segment)
    .sort((a, b) => a.depth - b.depth || a.slot - b.slot);
  const depthText = journeyNodeStep(current || candidates[0], state.journey.graph);
  const totalDepth = state.journey.graph.prepPerSegment;
  const returnLabel = { battle: '返回战斗', reward: '返回战后结算', 'node-action': '返回节点抉择', prep: '返回整备' }[currentNodePage()];
  // 路线屏只讲「此刻已知」：进战显示敌手状态，观察才揭示线索与反击。
  const openingEssence = NodeActionRules.settleTravelPressure(state.knownFacts, state.qiMax);
  const mapSteps = [
    selected
      ? `已选「${current?.name || '当前节点'}」：点「${returnLabel}」继续处理它；要改路就在后继卡里另选一张。`
      : '',
    candidates.length
      ? `可走 ${candidates.length} 条道路：先按卡上的「风险 / 需付 / 收获」择路；进战可见敌手气血与意图，观察可揭示线索与反击。`
      : '',
    state.blood < state.bloodMax
      ? `气血 ${state.blood}/${state.bloodMax} 未满：休整节点按上限三成回复气血；战斗中气血归零即败局，没有免费治疗。`
      : `气血已满 ${state.blood}/${state.bloodMax}：休整不会增加气血，真元 +2 也不超过上限；可比较其他道路的元石与蛊虫收益。`,
    `当前真元 ${state.qi}/${state.qiMax}：新交锋按战前间歇补满，再扣绕行追赶损耗 ${openingEssence.paid}，按当前状态预计开场 ${openingEssence.essence}/${state.qiMax}（游戏适配）。途中整备与事件仍使用当前真元；战斗内逐回合恢复，持续蛊另付维持与承击费。`,
  ];
  root.innerHTML = `
    <div class="section-head">
      <div>
        <div class="kicker">第 ${segment} 段 · ${segmentTitle(segment)} · ${depthText}</div>
        <h2>${selected ? '当前行止' : '选择下一站'}</h2>
      </div>
      <div class="legend"><span class="dot current"></span>当前 <span class="dot done"></span>已过 <span class="dot locked"></span>可走</div>
    </div>
    ${segmentProgressMarkup(segment)}
    <div class="map-help">每段要走过 ${totalDepth} 个路途节点，再迎战层主。选择下一站的风险与收益；后续仍可择路。已走节点会保留在本局旧录中。</div>
    ${guideBlock('此时可做的决定', mapSteps, 4)}
    ${pathNodes.length ? `<div class="journey-trail">${pathNodes.map((node, i) => `<span class="${node.id === selected ? 'now' : i < pathNodes.length - 1 ? 'done' : ''}">${node.depth + 1}. ${nodeTypeLabel(node.type)}</span>`).join('')}</div>` : ''}
    ${current ? `<div class="map-nodes map-choices">${mapNodeCard(current, selected, new Set(), completed)}</div>` : ''}
    ${!current && candidates.length ? `<h3 class="map-choice-title">当前可走后继</h3><div class="map-nodes map-choices">${candidates.map((node) => mapNodeCard(node, selected, available, completed)).join('')}</div>` : ''}
    ${selected ? `<div class="leave-row"><button class="primary" data-return-node>${{ battle: '返回战斗', reward: '返回战后结算', 'node-action': '返回节点抉择', prep: '返回整备' }[currentNodePage()]}</button></div>` : ''}`;

  root.querySelectorAll('[data-choose-node]').forEach((button) => {
    button.addEventListener('click', () => act.chooseNode(button.dataset.chooseNode));
  });
  root.querySelector('[data-return-node]')?.addEventListener('click', () => {
    showPage(currentNodePage());
  });
}

// 选路卡只列「此刻真的看得见」的事实：战斗节点给敌手数与敌手名，动作节点给可得与需付。
// 敌手修为、气血、问题轴仍需进战观察。魂魄风险只消费侦查/购买情报或曾遭遇事实。
// 元石收益也不写死数字——本包的界面口径只到「按哪一档结算」，数字留给战后结算页。
function authoredSoulDrainAmount(foes) {
  const drains = foes.flatMap(foe => [
    ...(foe.intent ? [foe.intent] : []), ...(foe.intents || []),
    ...(foe.phases || []).flatMap(phase => [
      ...(phase.intent ? [phase.intent] : []), ...(phase.intents || []),
    ]),
  ]).map(intent => Number(intent.soul_drain || 0));
  return Math.max(0, ...drains);
}

function scoutedRouteSoulFacts(node) {
  return (node.nextIds || []).map(id => nodeById(id)).filter(next =>
    next && ['battle', 'elite', 'boss'].includes(next.type)).map(next => {
    const foes = nodeEnemyIds(next).map(id => enemyById(id)).filter(Boolean);
    return [`route_soul_intel:${next.id}:${authoredSoulDrainAmount(foes)}`, `route_battle_intel:${next.id}`];
  }).flat();
}

function routeBattleIntel(node, foes) {
  if (!(state.knownFacts || []).includes(`route_battle_intel:${node.id}`))
    return { known: false, text: '招式与反制尚未查明；可在前路节点侦察或购入情报' };
  const labels = foes.map(foe => {
    const intents = [...(foe.intent ? [foe.intent] : []), ...(foe.intents || [])];
    const attacks = [...new Set([...intents.map(intent => intent.label), ...(foe.guLoadout?.required || []).map(id => GU_BY_ID[id]?.name)].filter(Boolean))];
    const counters = [...new Set((foe.reactions || []).map(reaction => reaction.label).filter(Boolean))];
    return `${foe.name}：${attacks.join('、') || '未发现已登记招式'}${counters.length ? `；反制 ${counters.join('、')}` : '；未发现已登记反制'}`;
  });
  return { known: true, text: `已侦察 · ${labels.join(' / ')}。进战前已知其反制，仍需实际应对` };
}

function routeSoulRisk(node, foes) {
  const facts = new Set(state.knownFacts || []);
  const prefix = `route_soul_intel:${node.id}:`;
  const scopedIntel = [...facts].filter(fact => fact.startsWith(prefix));
  const drains = scopedIntel.map(fact => Number(fact.slice(prefix.length)));
  // 有该节点的侦察记录才核对实际意图；修复旧存档曾漏单意图而写入的0，不扩大情报范围。
  if (scopedIntel.length) drains.push(authoredSoulDrainAmount(foes));
  for (const foe of foes) {
    const seenPrefix = `enemy_soul_seen:${foe.id}:`;
    drains.push(...[...facts].filter(fact => fact.startsWith(seenPrefix)).map(fact => Number(fact.slice(seenPrefix.length))));
  }
  if (drains.some(amount => amount > 0 && amount >= Number(state.soul))) {
    return { kind: 'lethal', text: '魂魄致命威胁 · 已知抽魂可耗尽当前魂魄；先考虑绕行或抢杀' };
  }
  if (drains.some(amount => amount > 0)) {
    return { kind: 'risk', text: '已知魂魄威胁 · 护体与回血无法抵消抽魂；可先考虑其他路线' };
  }
  if (!scopedIntel.length) {
    return { kind: 'unknown', text: '尚未侦查 · 魂魄风险未知；撤退会放弃战利，层主撤退会结束本局，先核对路线与应对方案' };
  }
  return { kind: 'none', text: '已知情报中未发现抽魂意图' };
}

function mapNodeCard(node, selected, available, completed) {
  const isSelected = node.id === selected;
  const isAvailable = available.has(node.id);
  const isDone = completed.has(node.id);
  const stateClass = isSelected ? 'current' : isDone ? 'done' : isAvailable ? 'available' : 'locked';
  const combat = ['battle', 'elite', 'boss'].includes(node.type);
  const foes = combat ? nodeEnemyIds(node).map((id) => enemyById(id)).filter(Boolean) : [];
  const soulRisk = combat ? routeSoulRisk(node, foes) : null;
  // 与 main.js 的 rollVictoryLoot 同一条公式：档位取实际敌人的 tier。
  // 不能按 node.type 推——后期单敌节点也会抽到 elite 敌手，档位与实付不一致就是骗人。
  const settlement = combat ? RunRules.resolveBattleTier(foes) : '';
  const rows = combat
    ? [
      // 单敌节点的名字已经写在卡片标题里，再列一遍只会把卡片顶到下缘之下。
      ...(foes.length > 1 ? [['对手', `${foes.length} 名 · ${foes.map((foe) => foe.name).join('、')}`]] : []),
      ['风险', node.type === 'boss'
        ? (Number(node.segment) === Number(state.journey.graph.segmentCount) ? '五境终战 · 击败即结束本局' : '本段终战 · 击败才开下一境')
        : foes.length > 1 ? `${foes.length} 名敌手同回合行动` : '单敌交锋'],
      ['需付', '催蛊耗真元与操控，拳脚不消耗两者 · 操控每回合刷新、真元逐回合恢复 · 气血归零即败局'],
      ['情报', soulRisk.text],
      ['招式', routeBattleIntel(node, foes).text],
      ['收获', `胜后按${{ common: '普通', elite: '精英', boss: '层主' }[settlement]}档结算 · 蛊虫不保证出`],
    ]
    : nodeRouteRows(node);
  const summary = combat ? '' : node.summary;
  const tag = isAvailable ? 'button' : 'article';
  const attrs = isAvailable
    ? ` type="button" data-choose-node="${node.id}"${soulRisk ? ` data-route-soul-risk="${soulRisk.kind}" data-route-battle-intel="${routeBattleIntel(node, foes).known ? 'known' : 'unknown'}"` : ''} aria-label="进入${nodeTypeLabel(node.type)}：${node.name}。${rows.map(([, text]) => text).join('。')}"`
    : '';
  return `<${tag} class="map-node type-${node.type} ${stateClass}${isAvailable ? ' available' : ''}"${attrs}>
    <span class="rn-top"><span>${node.type === 'boss' ? '层主' : `L${node.segment} · ${node.depth + 1}`}</span><em>${nodeTypeLabel(node.type)}</em></span>
    <span class="rn-name">${node.name}</span>
    ${summary ? `<span class="rn-summary">${summary}</span>` : ''}
    <dl class="rn-facts">${rows.map(([label, text]) => `<div><dt>${label}</dt><dd>${text}</dd></div>`).join('')}</dl>
    ${isAvailable ? `<span class="map-enter">进入</span>` : `<span class="rn-state">${isSelected ? '当前' : isDone ? '已过' : '未选'}</span>`}
  </${tag}>`;
}

// 动作节点的选路事实，全部取自 NodeActionRules 的同一批门禁数据，页面不自算收益。
function nodeRouteRows(node) {
  if (node.type === NodeActionRules.eventNodeType) {
    const event = node.event || {};
    const gain = Number(event.stone_gain || 0);
    const essenceGain = Number(event.essence_gain || 0);
    const cost = Number(event.health_cost || 0);
    const soulCost = Number(event.delayed_soul_cost || 0);
    return [
      ['内容', event.title || '异闻'],
      ['可得', [event.gu_reward_id ? `${event.gu_reward_name} ×1（${event.gu_reward_rank}转）` : '', gain ? `元石 +${gain}` : '', essenceGain ? `真元最多 +${essenceGain}（不超过上限）` : ''].filter(Boolean).join(' · ') || '只记事实'],
      ['需付', [cost ? `气血 -${cost} · 当场结算` : '', soulCost ? `魂魄 -${soulCost} · 整备后赶路支付` : ''].filter(Boolean).join(' · ') || '不取可安全离开'],
    ];
  }
  if (node.type === NodeActionRules.restNodeType) {
    const recovery = NodeActionRules.restRecovery({
      health: state.blood, healthMax: state.bloodMax, essence: state.qi, essenceMax: state.qiMax,
    });
    return [
      ['内容', '歇脚恢复'],
      ['可得', `气血 +${recovery.healthGain} · 真元 +${recovery.essenceGain}`],
      ['需付', '一次收益门禁 · 取后才能离开'],
    ];
  }
  const cards = nodeHazardCards(node, NodeActionRules.options({
    choices: node.choices, stones: state.stones, essence: state.qi, tradeSupply: currentTravelSupplies(), guFind: currentGuFind(node),
  })).filter((option) => NodeActionRules.actionIds.includes(String(option.id)) || option.id === 'leave');
  const doable = cards.filter((option) => option.available);
  const priced = doable.filter((option) => option.stoneCost > 0 || option.essenceCost > 0);
  const blocked = cards.filter((option) => !option.available);
  return [
    ['内容', doable.map((option) => option.title || actionLabel(option.id)).join(' · ') || '只能离开'],
    ['可得', priced.length
      ? priced.map((option) => `${option.title || actionLabel(option.id)} ${nodeActionCostText(option)}`).join(' · ')
      : '不耗资源的行动即可取得'],
    ['需付', blocked.length
      ? `${blocked.map((option) => option.title || actionLabel(option.id)).join('、')} 当前不可用`
      : '全部行动当前可付'],
    ...(node.type === 'market' ? [['坊市', '整备供应本段已解锁的全部商品，可定向买蛊；仍需支付标价']] : []),
  ];
}

// 节点动作页底注（lab 侧说明文案，不是 Godot 原文）。
const NODE_ACTION_HELP = '做工 +3 元石、采集 +2 元石；购买情报耗 2 元石，探查免费，均查明紧接着的战斗招式与反制。旅途补给按卡面货物收费并交付。穿越耗 1 点真元，静修恢复 1 点真元。险地探查后仍需选择穿越或退回，绕行后果按卡面结算；其他选择进入整备。';
const REST_ACTION_HELP = '休整节点是一次收益门禁：先取「歇脚恢复」（气血按上限的 30% 向下取整、至少 1 点，真元 +2，均不超上限），「离开休整」才会解禁；本次探访只能取一项收益。数值来源 rest_rules.gd:121-141。';

// 节点动作页（险地 / 市集 / 野蛊 / 休整 / 静修 / 异闻）：标准节点列模板 choices 的 standard action 卡
// （另按 :44-45 补一张 leave 卡）；休整节点出自己的一套卡（歇脚恢复 + 离开休整，后者是两步交互的门禁）。
// 规则、门禁、文案全部来自 js/node_action_rules.js，页面不另算。
function nodeHazardCards(node, cards) {
  return NodeActionRules.hazardCards(node, cards, { knownFacts: state.knownFacts,
    names: Object.fromEntries((node.nextIds || []).map(id => [id, nodeById(id)?.name || id])) });
}

function renderNodeActions(root) {
  if (!root) return;
  const node = currentNode();
  if (!node || !NodeActionRules.nodeTypes.includes(node.type) || state.prepFor === node.id) {
    root.innerHTML = '<div class="empty">当前没有待处理的节点动作。</div>';
    return;
  }
  const isRest = node.type === NodeActionRules.restNodeType;
  const isEvent = node.type === NodeActionRules.eventNodeType;
  let cards = isRest
    ? NodeActionRules.restCards({
        summary: node.summary,
        used: state.restUsed === true,
        health: state.blood,
        healthMax: state.bloodMax,
        essence: state.qi,
        essenceMax: state.qiMax,
      })
    : isEvent
      ? NodeActionRules.eventCards(node.event, { health: state.blood, soul: state.soul, essence: state.qi, essenceMax: state.qiMax })
      : NodeActionRules.options({
        choices: node.choices,
        stones: state.stones,
        essence: state.qi,
        tradeSupply: currentTravelSupplies(),
        guFind: currentGuFind(node),
      });
  cards = nodeHazardCards(node, cards);
  root.innerHTML = `
    <div class="section-head">
      <div>
        <div class="kicker">${segmentTitle(node.segment)} · ${nodeTypeLabel(node.type)} · ${journeyNodeStep(node)}</div>
        <h2>${node.name}</h2>
      </div>
    </div>
    <div class="node-action-choices">${cards.map((option) => `
      <article class="node-action-choice ${isEvent ? 'event-choice' : ''} ${option.available ? 'ready' : ''}">
        <div class="na-head"><b>${option.title || actionLabel(option.id)}</b><span>${nodeActionCostText(option)}</span></div>
        ${option.summary || node.summary ? `<p class="na-summary">${option.summary || node.summary}</p>` : ''}
        ${(option.gain || []).map((line) => `<p>${line}</p>`).join('')}
        ${(option.risk || []).map((line) => `<p class="risk">${line}</p>`).join('')}
        ${option.unknownNote ? `<p class="na-unknown"><span>未明</span>${option.unknownNote}</p>` : ''}
        ${option.available ? '' : `<p class="blocked">${option.blockReason}</p>`}
        ${(option.remedy || []).map((line) => `<p class="remedy">${line}</p>`).join('')}
        <button class="${option.available ? 'primary' : ''}" ${option.available ? '' : 'disabled'} data-node-action="${option.id}">${option.available ? option.buttonLabel || '执行' : '不可用'}</button>
      </article>`).join('')}</div>
    <div class="map-help">${isRest ? REST_ACTION_HELP : isEvent ? '接下机缘先结算气血与元石；列明的赶路魂魄代价在整备后继续时支付，可在离开前养魂。不取则无此代价。事件与具体点数属于游戏适配。' : NODE_ACTION_HELP}</div>`;
  root.querySelectorAll('[data-node-action]').forEach((button) => {
    button.addEventListener('click', () => act.resolveNodeAction(button.dataset.nodeAction));
  });
}

// 成本文案口径同 display_text.gd:455-462（元石 X / 真元 Y），无成本显示「无消耗」。
function nodeActionCostText(option) {
  const parts = [];
  if (Number(option.healthCost) > 0) parts.push(`气血 -${option.healthCost}`);
  if (option.essenceCost > 0) parts.push(`真元 -${option.essenceCost}`);
  if (option.stoneCost > 0) parts.push(`元石 -${option.stoneCost}`);
  if (Number(option.stoneGain) > 0) parts.push(`元石 +${option.stoneGain}`);
  return parts.length ? parts.join(' · ') : '无消耗';
}

function currentShopContext() {
  const node = currentNode();
  return {
    seed: state.seed,
    nodeKey: node?.id || 'free_shop',
    pacingLayers: DATA.loot.pacingLayers,
    layer: node?.segment || currentSegment(),
    school: state.school,
    // 专门市集让玩家能定向购买；普通整备沿用随机货架。
    slotOverride: node?.type === 'market' ? DATA.shopOffers.length : 0,
    // 固定保留已有成长商品，不随本次购入/使用改变整张货架。
    // 每个节点都是独立收费来源；不增加槽数、不赠蛊、不免除层价。
    reservedGuIds: [DATA.flow.aptitudeGuId].filter(Boolean),
  };
}

function offerCost(offer) {
  const base = Number(offer.stone_cost || 0);
  return ShopRules.layerPrice(DATA.loot.pacingLayers, currentShopContext().layer, base);
}

function offerStocked(offer) {
  return ShopRules.offerIsStocked(DATA.shopOffers, offer.id, currentShopContext());
}

function canBuyOffer(offer) {
  if (state.shopSold.includes(offer.id)) return false;
  if (typeof GuRules !== 'undefined' && !GuRules.isLiveShopOffer(offer)) return false;
  if (!offerStocked(offer)) return false;
  if (offerCost(offer) > state.stones) return false;
  if (offer.kind === 'gu_fang_unlock' && state.globalCodexIds.includes(offer.gu_id)) return false;
  if (offer.kind === 'soul_boost') return RunRules.soulNourishment(state.soul, state.soulMax, offer).ok;
  return ['purchase', 'gu_fang_unlock'].includes(offer.kind);
}

function shopKindLabel(kind) {
  return { purchase: '蛊', gu_fang_unlock: '方', soul_boost: '养魂' }[kind] || '服';
}

function shopGuName(guId) {
  const known = DATA.shopOffers.find((offer) => offer.gu_id === guId && offer.gu_name);
  return (guById(guId) || {}).name || known?.gu_name || '无名蛊';
}

function shopTradeName(offer) {
  if (offer.kind === 'gu_fang_unlock') return `古方·${shopGuName(offer.gu_id)}`;
  return '神秘交易';
}

function offerName(offer) {
  if (offer.name) return offer.name;
  if (offer.kind === 'purchase' && offer.gu_id) return shopGuName(offer.gu_id);
  return shopTradeName(offer);
}

function offerDetail(offer) {
  if (offer.kind === 'soul_boost') {
    const result = RunRules.soulNourishment(state.soul, state.soulMax, offer);
    const action = !result.ok ? '魂魄已满，达到本服务供给上限'
      : result.reason === 'soul_recovered' ? `修复魂伤至 ${result.soul}/${result.soulMax}`
      : `壮魂至 ${result.soul}/${result.soulMax}`;
    return `${action} · 每坊市一份，立即使用。胆识蛊修复壮魂、气囊封装来自 Wiki；价格、点数及最多 ${offer.soul_cap} 点是游戏适配，原著无通用安全阈值。`;
  }
  if (offer.kind === 'gu_fang_unlock') return '持方即知产物，免未知损失';
  if (offer.gu_id) {
    const gu = guById(offer.gu_id);
    return gu ? `${gu.rank} 转 · ${schoolLabel(gu.school)} · ${effectText(gu.effect)}` : '蛊虫货物';
  }
  return '尚未说明的交易';
}

function shopStock() {
  const context = currentShopContext();
  const goods = ShopRules.stock(DATA.shopOffers, context)
    .map((id) => DATA.shopOffers.find((offer) => offer.id === id))
    .filter(Boolean);
  const services = DATA.shopOffers.filter((offer) => ShopRules.serviceKinds.includes(offer.kind)
    && (typeof GuRules === 'undefined' || GuRules.isLiveShopOffer(offer))
    && ShopRules.offerIsStocked(DATA.shopOffers, offer.id, context));
  return [...goods, ...services];
}

// 购入或领取前复用现有构筑洞察；只读，不授予蛊或改写库存。
  // 三条轴不得混写：修为门槛、进战费用和局内一次性元石。
function guChoicePreview(guId, purchaseCost = null) {
  const gu = guById(guId);
  if (!gu) return '';
  const owned = { ...state.owned, [guId]: Number(state.owned[guId] || 0) + 1 };
  const insight = GuRules.gainInsight(guId, {
    owned, recipes: [], killMoves: [], guById: GU_BY_ID,
  });
  const purchase = purchaseCost !== null;
  const remaining = state.stones - Number(purchaseCost || 0);
  const rank = Number(gu.rank) || 1;
  const rankOk = GuRules.canActivate(state.cultivation, rank, gu.lowRankException);
  const rows = [];
  const money = [];
  if (purchase) {
    if (remaining < 0) {
      money.push(`购入还差 ${-remaining} 元石`);
    } else {
      money.push(`购后元石 ${remaining}（本次支出 ${purchaseCost}）`);
      const next = RunFlow.nextBreakthrough({
        rank: state.cultivation, stageIndex: state.cultivationStage,
        stones: remaining, aptitude: state.aptitude, owned,
      }, DATA.flow);
      if (next.kind === 'max') money.push('修为已到当前上限');
      else {
        const shortfall = Math.max(0, next.stoneCost - remaining);
        const gate = next.kind === 'big' && !next.aptitudeOk
          ? `；资质仍不足，需${({ ding: '丁等', bing: '丙等', yi: '乙等', jia: '甲等' })[next.requiredApt] || next.requiredApt}`
          : next.canSari ? '；也可使用已持有的同阶舍利' : '';
        money.push(`下一突破 · ${next.targetLabel}：需 ${next.stoneCost} 元石 · ${shortfall ? `元石还差 ${shortfall}` : '元石足够'}${gate}`);
      }
    }
  }
  const decisions = insight.decisions.filter((d) => !['forge', 'keep', 'sell', 'killmove'].includes(d.kind)).slice(0, 2);
  const aptitudeOrder = DATA.flow.aptitudeOrder || [];
  const aptitudeIndex = aptitudeOrder.indexOf(state.aptitude);
  const raisedAptitude = aptitudeOrder[aptitudeIndex + 1];
  const growthOnly = ['aptitude_up', 'breakthrough_material'].includes(gu.effect?.kind);
  const cast = gu.effect?.kind === 'aptitude_up'
    ? aptitudeIndex < 0 || !raisedAptitude ? '资质已达上限 · 无法继续提升'
      : `整备「资质机缘」栏使用 · 消耗一只，从${APTITUDE_LABEL[state.aptitude]}提升至${APTITUDE_LABEL[raisedAptitude]}，更新容量并补满真元`
    : gu.effect?.kind === 'breakthrough_material'
      ? rank === Number(state.cultivation)
        ? '整备「修炼突破」使用 · 消耗一只同阶舍利完成小突破，不能替代大突破'
        : `整备小突破专用 · 需修为恰为 ${rank} 转时使用，当前不同阶；不能替代大突破`
    : !String(gu.combat || '') || gu.combat === 'none'
      ? gu.effect?.kind === 'body_training' ? '整备「蛊仓」锻体，按修为、锻体元石与真元条件使用'
        : gu.effect?.kind === 'production' ? '整备「蛊仓」产叶，按修为与真元条件使用'
          : '没有战斗催动入口 · 请按本蛊的专用条件使用'
    : rankOk
    ? gu.effect?.kind === 'body_training' ? '修为已达 · 可在整备时锻体'
      : gu.effect?.kind === 'production' ? '修为已达 · 可在整备时产叶'
        : gu.effect?.kind === 'heal' && gu.effect.strength_scaling ? '修为已达 · 战斗与整备时均可自疗'
          : '修为已达 · 进战后按真元与操控条件催动'
    : `修为尚缺 ${rank - state.cultivation} 转 · 取得后也要先到 ${rank} 转才能催动（小突破可花元石或用同阶舍利；大突破需元石与资质门槛，资质不足时用资质机缘）`;
  rows.push(growthOnly ? cast : `${cast}（需 ${rank} 转 · 当前 ${state.cultivation} 转）`);
  if (gu.labOnly) rows.push('实验定义 · 通用资质提升适配，不代表原著中同名蛊的事实');
  const battleCost = [];
  if (Number(gu.trueQiCost || 0) > 0) battleCost.push(`真元 ${gu.trueQiCost}`);
  if (Number(gu.thoughtCost || 0) > 0) battleCost.push(`操控 ${gu.thoughtCost}`);
  if (battleCost.length && gu.effect?.kind !== 'body_training' && gu.effect?.kind !== 'production') {
    rows.push(`战斗催动另付 ${battleCost.join(' · ')}，与元石无关${gu.effect?.strength_scaling ? `；整备自疗仅扣真元 ${gu.trueQiCost}，不补回真元` : ''}`);
  }
  const target = gu.battleEffect?.target_gu_id;
  const invested = (state.modifierLedger || []).filter(row => row.sourceGuDefinitionId === gu.id && row.sourceEffectId === 'body_training').reduce((total, row) => total + Number(row.amount || 0), 0);
  const synergy = target ? `${Number(state.owned[target] || 0) > 0 ? '可辅助已持有的' : '需要配合'}${guById(target)?.name || target}：×${gu.battleEffect.multiplier}，同类不叠加`
    : gu.effect?.kind === 'production' ? `本体保留；每节点整备真元${gu.trueQiCost}产叶${gu.effect.amount}。叶片可疗伤或卖出。`
      : gu.effect?.consumable ? '一片一次有效疗伤；自用消耗库存，也可出售。'
        : gu.effect?.kind === 'body_training' ? `已得永久力量 +${invested}/${gu.effect.cap}（试玩参数）；多买同型不增加上限。` : '';
  // 一条事实一行，标签只在本组第一行出现：组内再用「·」相连会把两件事读成一件事。
  const rowsHtml = (label, lines) => lines.map((text, index) => `<div class="bf-row">`
    + `<span class="bf-k${index ? ' bf-cont' : ''}">${index ? '' : label}</span>`
    + `<span class="bf-v">${text}</span></div>`).join('');
  return `<div class="choice-insight">
    <div class="bf-row bf-held"><span class="bf-k">库存</span><span class="bf-v">已有 ×${Number(state.owned[guId] || 0)}${purchase ? ` · 挂牌 ${purchaseCost} 元石` : ''}</span></div>
    ${rowsHtml(growthOnly ? '成长' : '催动', rows)}
    ${rowsHtml('资金', money)}
    ${rowsHtml('用法', synergy ? [synergy] : [])}
    ${rowsHtml('其他', decisions.map((d) => d.detail))}
    ${!synergy && !decisions.length
      ? rowsHtml('说明', ['只增加同名库存；先确认当前是否用得上。']) : ''}
  </div>`;
}

function shopOfferCard(offer) {
  const sold = state.shopSold.includes(offer.id);
  const can = canBuyOffer(offer);
  const reason = sold
    ? '已购入 · 本轮不再上架'
    : !offerStocked(offer)
      ? '本店未上架'
      : offerCost(offer) > state.stones
        ? `还差 ${offerCost(offer) - state.stones} 元石`
        : '';
  return `<article class="shop-offer ${can ? 'ready' : ''}">
    <div class="so-kind">${shopKindLabel(offer.kind)}</div>
    <div class="so-name">${offerName(offer)}</div>
    <div class="so-detail">${offerDetail(offer)}</div>
    ${!sold && offer.kind === 'purchase' && offer.gu_id ? guChoicePreview(offer.gu_id, offerCost(offer)) : ''}
    <div class="so-foot"><span>${offerCost(offer)} 元石</span><span>${reason}</span></div>
    <button ${can ? '' : 'disabled'} data-buy-offer="${offer.id}">${sold ? '已售罄' : '购入'}</button>
  </article>`;
}

// 蛊仓卡片：与坊市、炼蛊台共用 .gu 卡片外观。
// 早先这里是全宽单行列表——14 行、每行为了右侧一个「卖」按钮横跨整个页面宽度，
// 既占地方又难扫（2026-09-20）。
function inventoryCard(gu) {
  const count = Number(state.owned[gu.id] || 0);
  if (count <= 0) return '';
  const price = RunFlow.sellValue(gu.value);
  if (gu.playable === false) return `<article class="gu"><span class="cnt">×${count}</span><img src="assets/gu/${gu.icon}.png" alt=""><div class="gn">${gu.name}</div><div class="gm">旧存货 · 用途待核实</div><div class="ge">${gu.effectNote}</div><div class="gu-foot"><span>旧估价 · 卖 ${price}</span><button class="ghost" data-sell-gu="${gu.id}">卖出</button></div></article>`;
  const training = gu.effect?.kind === 'body_training' ? bodyTrainingPreview(gu) : null;
  const production = gu.effect?.kind === 'production' ? leafProductionPreview(gu) : null;
  const selfHealing = gu.effect?.kind === 'heal' && gu.effect.strength_scaling
    ? selfHealingPreview(gu) : null;
  const leafReason = gu.effect?.consumable ? GuRules.consumeHealingGu(gu, { owned: state.owned, health: state.blood, healthMax: state.bloodMax, healingLocked: state.leafRecoveryNodeId === state.journey.nodeId }) : null;
  // Canon 标注：canon 与游戏转数分叉/状态待核时显示原著口径（CanRuntime 投影，非游戏数值）。
  const canon = typeof Canon !== 'undefined' ? Canon.canonAlert(gu.id, gu.rank) : '';
  // POC：月光蛊本体/收藏投影贴图挂载；非 POC 蛊回退原 icon，渲染路径不变。
  const pocArt = typeof MOONLIGHT_POC !== 'undefined' ? MOONLIGHT_POC.cardArt(gu.id) : '';
  const pocToggle = pocArt
    ? `<button class="ghost poc-mode-btn" data-poc-moon-mode title="切换本体 / 收藏投影">${MOONLIGHT_POC.toggleLabel()}</button>`
    : '';
  return `<article class="gu ${gu.rank > 1 ? 'r2' : ''} ${pocArt ? 'poc-moon-card' : ''}">
    <span class="cnt">×${count}</span>
    ${pocArt || `<img src="assets/gu/${gu.icon}.png" alt="">`}
    <div class="gn">${gu.name}${pocToggle}</div>
    <div class="gm">${gu.rank} 转 · ${buildRoleLabel(GuRules.buildRoleOf(gu, GU_BY_ID))} · ${schoolLabel(gu.school)} · 值 ${gu.value}</div>
    <div class="ge">${effectText(gu.effect)}</div>
    ${gu.effectNote ? `<details class="gc"><summary>原著与试玩</summary>${gu.effectNote}</details>` : ''}
    ${gu.labOnly ? '<div class="gc">原创机缘道具 · 提升资质，不对应原著同名蛊虫</div>' : ''}
    ${canon ? `<div class="gc">⟡ ${canon}</div>` : ''}
    ${training ? `<div class="choice-insight">一猪之力进度 ${Math.round(training.current / gu.effect.cap * 100)}% · 已得力量保留</div><button data-train-body="${gu.id}" ${training.ok ? '' : 'disabled'}>${training.ok ? `锻体 · 真元 ${gu.trueQiCost} · 费用 ${gu.feedingCost}元石` : ({repeated_visit: '本次整备已锻体', cap_reached: '已达一猪之力上限', insufficient_essence: '真元不足', insufficient_stone: '锻体元石不足', not_preparing: '进入整备后可锻体', gu_unavailable: '未持有可用蛊虫', gu_hungry: '当前不可锻体'}[training.reason] || '暂不可锻体')}</button><div class="muted">试玩参数：每次整备力量 +${gu.effect.amount}，同型上限 +${gu.effect.cap}；原著未给出此数值。</div>` : ''}
    ${production ? `<button data-produce-leaf="${gu.id}" ${production.ok ? '' : 'disabled'}>${production.ok ? `催生叶片 · 真元 ${production.cost} → 生机叶 ${production.produced}` : guReasonLabel(production.reason)}</button><div class="muted">每节点整备一次；耗真元并占用生产时间为试玩适配。</div>` : ''}
    ${selfHealing ? `<div class="muted">${selfHealing.ok
      ? `整备可自疗 · 气血 +${selfHealing.healed} · 真元 ${selfHealing.cost}`
      : `暂不可自疗 · ${selfHealing.reason === 'not_preparing' ? '仅整备节点可用' : guReasonLabel(selfHealing.reason) || selfHealing.reason}`}</div><button data-heal-self="${gu.id}" ${selfHealing.ok ? '' : 'disabled'}>${selfHealing.ok ? `自疗 · 气血 +${selfHealing.healed} · 真元 ${selfHealing.cost}` : selfHealing.reason === 'not_preparing' ? '仅整备节点可用' : guReasonLabel(selfHealing.reason) || '暂不可自疗'}</button><div class="muted">战斗内也可自疗；整备自疗保留蛊虫，仅扣真元 ${gu.trueQiCost}（当前 ${state.qi}）。</div>` : ''}
    ${leafReason ? `<button data-use-leaf="${gu.id}" ${leafReason.ok ? '' : 'disabled'}>${leafReason.ok ? `疗伤 · 气血 +${leafReason.healed} · 消耗1片` : guReasonLabel(leafReason.reason)}</button><div class="muted">留作自用，或出售换取元石。</div>` : ''}
    <div class="gu-foot"><span>卖 ${price}</span><button class="ghost" data-sell-gu="${gu.id}">卖出</button></div>
  </article>`;
}

function gainInsightPanel() {
  const insight = state.lastGainInsight;
  if (!insight || !insight.decisions?.length) return '';
  const lines = insight.decisions.filter(d => !['forge', 'killmove'].includes(d.kind)).map((d) => `<li><b>${d.label}</b> · ${d.detail}</li>`).join('');
  return `
    <section class="insight-panel" style="margin:16px 0;padding:12px 14px;border:1px solid var(--line,#ccc);border-radius:8px">
      <div class="kicker">构筑关联 · ${insight.name}（${insight.role}）</div>
      <ul style="margin:8px 0 0 18px">${lines}</ul>
      <div class="gm" style="margin-top:6px">主动选择：保留或出售，不会自动装备。</div>
    </section>`;
}

function renderPrep(root) {
  if (!root) return;
  const node = currentNode();
  if (!node) {
    root.innerHTML = '<div class="empty">当前没有待整备节点。</div>';
    return;
  }
  const next = RunFlow.nextBreakthrough({
    rank: state.cultivation,
    stageIndex: state.cultivationStage,
    stones: state.stones,
    aptitude: state.aptitude,
    owned: state.owned,
  }, DATA.flow);
  const offers = shopStock();
  const nextQiMax = next.kind === 'max' ? state.qiMax : RunRules.essenceMax(
    next.targetRank || state.cultivation, state.aptitude, undefined, 0,
    next.kind === 'small' ? next.targetStageIndex : 0);
  const aptId = DATA.flow.aptitudeGuId;
  const sariName = next.sariId ? (guById(next.sariId) || {}).name : '同阶舍利蛊';
  // 界面必须区分「需求」与「持有」：早先这里直接把需求蛊写成 `名字 ×1`，
  // 读起来就是背包条目，玩家会以为已经持有（2026-09-20 实测踩到）。
  // 舍利不可越阶替代，所以持有但转数不符时要把持有清单摊开说明原因。
  const sariRankById = Object.fromEntries(
    Object.entries(DATA.flow.sariByRank || {}).map(([rank, id]) => [id, Number(rank)]),
  );
  const sariHeld = next.sariId ? Number(state.owned[next.sariId] || 0) : 0;
  const heldSari = Object.keys(sariRankById)
    .filter((id) => Number(state.owned[id] || 0) > 0 && !(next.canSari && id === next.sariId))
    .map((id) => `${(guById(id) || {}).name || id} ×${Number(state.owned[id])}（${sariRankById[id]} 转）`);
  const ownedGu = Object.values(GU_BY_ID).filter((gu) => Number(state.owned[gu.id] || 0) > 0);
  const aptCount = Number(state.owned[aptId] || 0);
  const aptitudeOrder = DATA.flow.aptitudeOrder;
  const aptitudeIndex = aptitudeOrder.indexOf(state.aptitude);
  const canRaiseAptitude = aptitudeIndex >= 0 && aptitudeIndex < aptitudeOrder.length - 1;
  const canUseAptitude = aptCount > 0 && canRaiseAptitude;
  const tab = PREP_TABS.some((entry) => entry.id === prepTab) ? prepTab : 'shop';
  const tabCount = {
    shop: offers.length,
    gu: ownedGu.length,
  };
  const prepSteps = [
    next.kind === 'max'
      ? '修为 · 已到当前修炼上限；继续靠行程与坊市积累蛊虫与元石。'
      : next.ok
        ? `修为 · 现在可以冲击「${next.targetLabel}」：${[next.kind === 'big' || next.canStone ? `元石 ${next.stoneCost}` : '', next.canSari ? `消耗 1 只 ${sariName}` : ''].filter(Boolean).join('，或')}。`
        : `修为 · 冲击「${next.targetLabel}」${(next.kind === 'big' ? next.stoneOk : next.canStone) ? '元石足够' : `还差 ${Math.max(0, next.stoneCost - state.stones)} 元石`}${next.kind === 'big' && !next.aptitudeOk ? `，且资质需 ${APTITUDE_LABEL[next.requiredApt] || next.requiredApt}` : ''}；元石来自战斗、异闻与卖蛊。`,
  ];
  root.innerHTML = `
    <div class="prep-head">
      <div class="prep-title">
        <div class="kicker">${segmentTitle(node.segment)} · ${nodeTypeLabel(node.type)} · 整备</div>
        <h2>${node.name}</h2>
      </div>
      <div class="prep-orient"><b>整备自由进行</b><span>查看蛊仓与资源，完成后继续行程</span></div>
      ${state.travelSoulDebt ? `<p class="prep-debt-warning">${state.travelSoulDebt.title} · 继续行程扣魂魄 ${state.travelSoulDebt.cost}；当前 ${state.soul}。${state.soul <= state.travelSoulDebt.cost ? '直接赶路将魂魄耗尽败北，可先在坊市养魂。' : `直接赶路后余 ${state.soul - state.travelSoulDebt.cost}。`}</p>` : ''}
      ${(state.knownFacts || []).some(fact => String(fact).startsWith('hazard_pressure:')) ? `<p class="prep-debt-warning" data-travel-pressure>绕行追赶 · 下次交锋开场真元少 ${(state.knownFacts || []).filter(fact => String(fact).startsWith('hazard_pressure:')).length}；支付后清除，继续经过非战节点不会提前结算。</p>` : ''}
      <button class="primary prep-leave" data-prep-continue>完成整备 · 继续行程${state.travelSoulDebt ? ` · 魂魄 -${state.travelSoulDebt.cost}` : ''}</button>
    </div>
    ${gainInsightPanel()}
    <div class="prep-guides">
      ${guideBlock('此刻可做', prepSteps)}
      <details class="guide-block guide-more" data-guide>
        <summary class="kicker">工具在哪用 · 缺什么从哪补</summary>
        <ul>${[...prepToolLines(), ...gapRecoveryLines(next)].map((line) => `<li>${line}</li>`).join('')}</ul>
      </details>
    </div>
    <div class="prep-shell">
      <aside class="prep-rail">
        <section class="rail-block">
          <div class="kicker">修炼突破</div>
          <h3>${next.kind === 'small' ? `冲击 ${next.targetLabel}` : next.kind === 'big' ? `冲击 ${next.targetRank} 转` : '五转巅峰'}</h3>
          ${next.kind !== 'max' ? `<div class="prep-line" data-growth-benefit>突破收益 · 真元上限 ${state.qiMax} → ${nextQiMax}；当前真元不补满。</div>` : ''}
          ${next.kind === 'small' ? `
            <p>小突破消耗元石，或消耗 1 只当前转数同阶舍利蛊。</p>
            <div class="button-row">
              <button class="${next.canStone ? 'primary' : ''}" ${next.canStone ? '' : 'disabled'} data-break="stone">元石 ${next.stoneCost}</button>
              <button class="${next.canSari ? 'primary' : ''}" ${next.canSari ? '' : 'disabled'} data-break="sari">消耗 ${sariName}</button>
            </div>
            <div class="prep-line">需要 1 只 ${sariName} · 你持有 ${sariHeld}</div>
            <div class="prep-line">元石 ${next.stoneCost} · 你持有 ${state.stones}${next.canStone ? ' · 可付' : ` · 还差 ${Math.max(0, next.stoneCost - state.stones)}`}</div>
            ${heldSari.length ? `<div class="prep-line">舍利不可越阶替代；你还持有 ${heldSari.join('、')}</div>` : ''}
          ` : next.kind === 'big' ? `
            <p>大突破要求资质与元石同时达标。</p>
            <div class="prep-line">资质 ${next.aptitudeOk ? '达标' : `需要 ${APTITUDE_LABEL[next.requiredApt] || next.requiredApt} · 当前 ${APTITUDE_LABEL[state.aptitude] || state.aptitude}，用资质机缘提升`}</div>
            <div class="prep-line">元石 ${next.stoneCost} · 你持有 ${state.stones}${next.stoneOk ? ' · 可付' : ` · 还差 ${Math.max(0, next.stoneCost - state.stones)}`}</div>
            <button class="${next.ok ? 'primary' : ''}" ${next.ok ? '' : 'disabled'} data-break="stone">冲击下一转</button>
          ` : '<p>已经到达当前修炼上限。</p>'}
        </section>
        <section class="rail-block">
          <div class="kicker">资质机缘 · 原创</div>
          <h3>资质 ${APTITUDE_LABEL[state.aptitude] || state.aptitude}</h3>
          <p>使用后立即提升一档，更新真元容量并补满当前真元。</p>
          <div class="prep-line">${!canRaiseAptitude ? '当前资质已达上限，无法继续提升' : aptCount > 0 ? `你持有 ×${aptCount}，现在可用` : '未持有资质机缘 · 从坊市、行程或战后奖励取得'}</div>
          <button style="margin-top:13px" class="${canUseAptitude ? 'primary' : ''}" ${canUseAptitude ? '' : 'disabled'} data-use-aptitude>使用资质机缘 ×${aptCount}</button>
        </section>
      </aside>
      <div class="prep-work">
        <nav class="prep-tabs">
          ${PREP_TABS.map((entry) => `<button data-prep-tab="${entry.id}" class="${entry.id === tab ? 'on' : ''}">${entry.label}<span class="tab-count">${tabCount[entry.id]}</span></button>`).join('')}
        </nav>
        <div class="prep-pane${tab === 'shop' ? ' on' : ''}" data-pane="shop">
          <div class="pane-note">${node.type === 'market' ? '市集供应本段已解锁的全部商品，可定向买蛊。' : '旅途整备随机上架部分商品。'}本页买完即售罄，进入下一节点后刷新。</div>
          <div class="shop-grid"></div>
        </div>
        <div class="prep-pane${tab === 'gu' ? ' on' : ''}" data-pane="gu">
          <div class="pane-note">卖蛊返还价值 50%。</div>
          <div class="grid"></div>
        </div>
      </div>
    </div>`;

  // 性能：只绘当前页签。切页签时按需填充；整备动作重绘也只重建可见区。
  renderPrepPane(root, tab);
  bindPrepEvents(root);
}

function renderPrepPane(root, tab) {
  const shop = root.querySelector('[data-pane="shop"] .shop-grid');
  const gu = root.querySelector('[data-pane="gu"] .grid');
  if (tab === 'shop' && shop) {
    shop.innerHTML = shopStock().map(shopOfferCard).join('') || '<div class="empty">本层暂无可用货物。</div>';
  } else if (tab === 'gu' && gu) {
    const ownedGu = Object.values(GU_BY_ID).filter((g) => Number(state.owned[g.id] || 0) > 0);
    gu.innerHTML = ownedGu.map(inventoryCard).join('') || '<div class="empty">蛊仓为空。</div>';
  }
}

// 事件委托：整备页按钮多，innerHTML 后逐个 addListener 是 draw 热点。
function bindPrepEvents(root) {
  if (root.dataset.bound) return;
  root.dataset.bound = '1';
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest(
      '[data-prep-tab],[data-buy-offer],[data-sell-gu],[data-break],[data-use-aptitude],'
      + '[data-produce-leaf],[data-use-leaf],[data-heal-self],[data-train-body],[data-prep-continue],[data-poc-moon-mode]',
    );
    if (!t || !root.contains(t) || t.disabled) return;
    if (t.dataset.pocMoonMode != null) {
      MOONLIGHT_POC.setMode(MOONLIGHT_POC.mode() === 'projection' ? 'canonical' : 'projection');
      renderPrepPane(root, prepTab);
      return;
    }
    if (t.dataset.prepTab) {
      prepTab = t.dataset.prepTab;
      root.querySelectorAll('[data-prep-tab]').forEach((tabButton) => tabButton.classList.toggle('on', tabButton === t));
      root.querySelectorAll('[data-pane]').forEach((pane) => pane.classList.toggle('on', pane.dataset.pane === prepTab));
      renderPrepPane(root, prepTab);
      return;
    }
    if (t.dataset.buyOffer) act.buyOffer(t.dataset.buyOffer);
    else if (t.dataset.produceLeaf) act.produceLeaf(t.dataset.produceLeaf);
    else if (t.dataset.healSelf) act.healSelf(t.dataset.healSelf);
    else if (t.dataset.useLeaf) act.useLeaf(t.dataset.useLeaf);
    else if (t.dataset.trainBody) act.trainBody(t.dataset.trainBody);
    else if (t.dataset.sellGu) act.sellGu(t.dataset.sellGu);
    else if (t.dataset.break) act.breakthrough(t.dataset.break);
    else if (t.dataset.useAptitude != null) act.useAptitudeGu();
    else if (t.dataset.prepContinue != null) act.leavePrep();
  });
}

function renderReward(root) {
  if (!root) return;
  const reward = state.reward;
  if (!reward) {
    root.innerHTML = '<div class="empty">当前没有待领取的战后收获。</div>';
    return;
  }
  const node = nodeById(reward.nodeId);
  const choices = (reward.guChoices || []).map((guId) => guById(guId)).filter(Boolean);
  const tier = reward.tier || 'common';
  root.innerHTML = `
    <div class="reward-sheet">
      <div class="kicker">战后结算 · 自动奖励已到账</div>
      <h1>${node ? node.name : '遭遇'} · 伏诛</h1>
      <div class="reward-lines">
        <div><span>元石</span><b>+${reward.stones}</b></div>
        <div><span>气血</span><b>+${reward.healed || 0} · 真元回满</b></div>
        <div><span>战利方向</span><b>${!choices.length ? '元石与补给' : '蛊虫与成长'}</b></div>
        <div><span>回合</span><b>${reward.turn}</b></div>
      </div>
      ${choices.length ? `
        ${guideBlock('领取与放弃', [
          '领取免费：点中一只即收入蛊仓，不扣元石，已到账的元石与补给不受影响。',
          '放弃的结果：点「放弃本次蛊虫，保留已到账资源」则本次不获得蛊虫，其余已入账资源照常保留；系统不会替你预选。',
          '入仓的蛊不会自动装备；能否立刻催动看卡上写明的修为门槛。',
        ])}
        <h2>战后出蛊 · 三选一</h2>
        <p class="muted">${tier === 'boss' ? '层主奖励 · 稀有蛊虫与成长' : tier === 'elite' ? '精英奖励 · 高品质蛊虫' : '普通战 · 稳定元石与蛊虫成长'}</p>
        <div class="reward-choices">${choices.map((gu) => `
          <button data-reward-gu="${gu.id}">
            <img src="assets/gu/${gu.icon}.png" alt="">
            <b>${gu.name}</b>
            <span>${gu.rank} 转 · ${buildRoleLabel(GuRules.buildRoleOf(gu, GU_BY_ID))} · ${schoolLabel(gu.school)}</span>
            <em>${effectText(gu.effect)}</em>
            ${guChoicePreview(gu.id)}
          </button>`).join('')}</div>
        <p class="muted" style="margin-top:10px">所选蛊虫会收入蛊仓，不会自动装备。进入整备后，可查看用途、使用条件或出售。</p>
      ` : `
        ${guideBlock('领取与放弃', [
          '本次没有待选蛊虫：元石与补给已入账，直接进入整备即可。',
          '想要更多蛊虫：从战后掉落、坊市与奇遇遗藏取得。',
        ])}
        <p class="muted">本次没有待选蛊虫；战利品已入账，可以直接进入整备。</p>`}
      ${reward.battleLog?.length ? `<details data-battle-recap><summary>交锋回顾</summary>${renderBattleLogHtml(reward.battleLog)}</details>` : ''}
      ${choices.length ? '<button class="ghost" data-reward-skip>放弃本次蛊虫，保留已到账资源</button>' : '<button class="primary" data-reward-continue>进入整备</button>'}
    </div>`;
  root.querySelectorAll('[data-reward-gu]').forEach((button) => {
    button.addEventListener('click', () => act.chooseRewardGu(button.dataset.rewardGu));
  });
  root.querySelector('[data-reward-skip]')?.addEventListener('click', () => act.continueReward(true));
  root.querySelector('[data-reward-continue]')?.addEventListener('click', () => act.continueReward());
}

function renderEnding(root) {
  if (!root) return;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const ending = state.ending;
  if (!ending) {
    root.innerHTML = '<div class="empty">本局尚未结束。</div>';
    return;
  }
  const outcomeLabel = ending.outcome === 'victory' ? '胜局' : ending.outcome === 'retreat' ? '主动止步' : ending.outcome === 'defeat' ? '败局' : '终局';
  const progress = journeyProgress();
  root.innerHTML = `
    <div class="ending-sheet">
      <div class="kicker">终局摘要 · ${outcomeLabel}</div>
      <h1>${ending.title}</h1>
      <p class="lead">${ending.detail}</p>
      <div class="ending-death" data-run-recap><div class="kicker">此生修行</div><ul>${(ending.recap || buildRunRecap()).map(line => `<li>${safe(line)}</li>`).join('')}</ul></div>
      ${ending.deathReport?.last3?.length ? `<div class="ending-death"><div class="kicker">败因摘要</div><ul>${ending.deathReport.last3.map((line) => `<li>${line}</li>`).join('')}</ul></div>` : ''}
      <div class="ending-stats">
        <span>本局结果 · ${outcomeLabel}</span>
        <span>行程节点 · ${progress.visitedNodes} / ${progress.totalNodes}</span>
        <span>气血 ${state.blood}</span>
        <span>元石 ${state.stones}</span>
        <span>回合 ${ending.turn || 0}</span>
      </div>
      <div class="hall-actions">
        <button class="primary" data-ending-hall>回到大厅</button>
        <button class="ghost" data-ending-restart>重新开始</button>
      </div>
    </div>`;
  root.querySelector('[data-ending-hall]').addEventListener('click', () => showPage('hall'));
  root.querySelector('[data-ending-restart]').addEventListener('click', () => act.restartRun());
}
