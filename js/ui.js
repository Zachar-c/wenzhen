// Presentation from the supplied UI mockup; gameplay remains in the existing engine.
function uiEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isPreparing() {
  return !!(state?.journey?.started && !state.ending && !state.battle && !state.reward
    && currentNode() && state.prepFor === state.journey.nodeId);
}

const UI = {
  confirmed: false,
  pending: null,
  guFilter: 'all',
  titles: { hall: '首页', map: '命途', 'node-action': '命途 · 抉择', battle: '交锋',
    reward: '战后清算', prep: '整备与交易', gu: '蛊藏', cult: '修行', journal: '行记', records: '往昔行卷', ending: '终局', cover: '开发覆盖' },

  sync() {
    document.getElementById('view-title').textContent = this.titles[state.page] || '问真';
    document.title = `${this.titles[state.page] || '问真'} · 问真`;
    document.getElementById('side-position').textContent = `第 ${journeyProgress().activeSegment} / 5 境 · ${RunFlow.stageLabel(state.cultivation, state.cultivationStage)}`;
    document.getElementById('side-seed').textContent = `种子 ${state.seed} · ${DATA.flow.difficulties[state.journey.difficulty]?.label || ''}`;
    const failed = !!bootSaveIssue || !lastSaveStatus.ok;
    const save = document.getElementById('save-indicator');
    save.classList.toggle('fail', failed);
    save.textContent = failed ? '存档异常 · 请查看首页' : state.journey.started ? '已存至本机' : '本地自动存档';
    for (const [selector, name] of [['.blood','heart'], ['.qi','spark'], ['.thought','eye'], ['.soul','soul'], ['.life','cult'], ['.pool:not(.blood,.qi,.thought,.soul,.life)','coin']]) {
      const pool = document.querySelector(`#hud ${selector}`);
      if (pool && !pool.querySelector('svg')) pool.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[name]}"/></svg>`);
    }
    document.querySelectorAll('#tabs [data-tab]').forEach(button => {
      const active = button.dataset.tab === state.page || button.dataset.tab === 'map' && state.page === 'node-action';
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-ui-page]').forEach(button => {
      const source = document.querySelector(`#tabs [data-tab="${button.dataset.uiPage}"]`);
      button.disabled = source?.disabled || false;
      button.title = source?.title || '';
      const active = button.dataset.uiPage === state.page || button.dataset.uiPage === 'map' && state.page === 'node-action';
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  },

  confirm(title, description, callback) {
    const dialog = document.getElementById('ui-confirm');
    this.pending = callback;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-description').textContent = description;
    dialog.querySelector('.confirm-visual')?.remove();
    dialog.querySelector('#confirm-description').insertAdjacentHTML('afterend', `<div class="confirm-visual">${visualIcon(title.includes('撤退') ? 'battle' : 'archive')} → ${visualIcon('cross')} → ${visualIcon(title.includes('撤退') ? 'exit' : 'play')}</div>`);
    this.visualize('dialog', dialog);
    dialog.querySelector('[data-confirm-cancel]').innerHTML = `${visualIcon('cross')}<span>取消</span>`;
    dialog.querySelector('[data-confirm-accept]').innerHTML = `${visualIcon('check')}<span>确认</span>`;
    dialog.showModal();
    dialog.querySelector('[data-confirm-cancel]').focus();
  },

  decorate(page, root) {
    if (!root) return;
    if (page === 'hall' && !root.querySelector('.home-stage')) this.home(root);
    if (page === 'map' && !root.querySelector('.map-workspace')) this.map(root);
    root.querySelectorAll('button').forEach(button => button.classList.add('btn'));
    this.visualize(page, root);
    root.querySelectorAll('details.gc').forEach(details => details.classList.add('gu-notes'));
    root.querySelectorAll('.guide-block,.map-help,.node-action-help').forEach(block => {
      if (block.closest('details')) return;
      const details = document.createElement('details');
      details.className = 'visual-help';
      details.innerHTML = '<summary>玩法与行程说明</summary>';
      block.replaceWith(details);
      details.append(block);
    });
  },

  visualize(page, root) {
    const nodeIcons = { work: 'fist', harvest: 'leaf', scout: 'eye', buy_information: 'eye',
      trade: 'trade', cross: 'next', meditate: 'cult', collect_gu: 'gu',
      accept_event: 'check', leave: 'next', withdraw: 'back', 'node.rest_heal': 'heart', 'node.leave': 'next' };
    const buttons = { startRun: 'play', continueRun: 'play', goMap: 'route', returnNode: 'back',
      basicAttack: 'fist', observe: 'eye', approach: 'next', exhaust: 'spark', endTurn: 'clock',
      escape: 'route', retreat: 'exit', buyOffer: 'trade', sellGu: 'coin', trainBody: 'fist',
      healSelf: 'heart', useLeaf: 'heart', produceLeaf: 'leaf', break: 'cult', useAptitude: 'spark',
      prepContinue: 'next', rewardContinue: 'next', rewardSkip: 'next', endingHall: 'home', endingRestart: 'play',
      runSeed: 'play', startEncounter: 'battle' };
    root.querySelectorAll('button').forEach(button => {
      if (button.disabled && button.dataset.useGu && !button.querySelector('.visual-lock')) button.insertAdjacentHTML('beforeend', `<span class="visual-lock">${visualIcon('lock')}</span>`);
      if (button.querySelector('.action-icon') || button.dataset.useGu || button.dataset.chooseNode || button.dataset.rewardGu) return;
      const key = Object.keys(buttons).find(key => key in button.dataset);
      const name = button.dataset.nodeAction ? nodeIcons[button.dataset.nodeAction] || 'check'
        : button.dataset.prepTab ? (button.dataset.prepTab === 'shop' ? 'trade' : 'gu') : key ? buttons[key] : '';
      if (!name) return;
      const text = document.createElement('span');
      text.className = 'button-caption';
      while (button.firstChild) text.append(button.firstChild);
      button.append(text);
      button.insertAdjacentHTML('afterbegin', `<span class="action-icon">${visualIcon(name)}${button.disabled ? visualIcon('lock') : ''}</span>`);
      button.classList.add('visual-button');
    });
    if (page === 'hall' && !root.querySelector('.visual-loop')) {
      root.querySelector('.hall-actions')?.insertAdjacentHTML('beforebegin', `<div class="visual-loop" aria-label="选路、战斗、领奖、整备、继续">${['route', 'battle', 'gu', 'trade', 'next'].map((name, i) => `${i ? '<span>→</span>' : ''}${visualIcon(name)}`).join('')}</div>`);
      root.querySelector('.visual-loop')?.insertAdjacentHTML('afterend', `<details class="picture-guide"><summary>${visualIcon('eye')} ?</summary>
        <div class="picture-lesson">${['heart','soul','cult'].map(icon => `${visualValue(icon, '0', '归零导致败北', true)}`).join('')} → ${visualIcon('skull')}</div>
        <div class="picture-lesson"><span class="lesson-card">${guArt(GU_BY_ID.small_light_gu, true)}</span> → <span class="lesson-card">${guArt(GU_BY_ID.moonlight_gu, true)}</span> → ${visualValue('battle', `${GU_BY_ID.moonlight_gu.effect.amount} ×${GU_BY_ID.small_light_gu.effect.multiplier}`, '先小光后月光，本回合下一击增幅')}</div>
        <div class="picture-lesson">${visualIcon('shield')} ← ${visualIcon('battle')} × · ${visualIcon('eye')} → ?</div>
        <div class="picture-lesson">${visualIcon('clock')} → ${visualIcon('battle')} → ${visualValue('heart', '−', '结束回合后敌人执行意图', true)}</div>
      </details>`);
      root.querySelectorAll('[data-difficulty]').forEach((button, i) => {
        if (!button.querySelector('.difficulty-stars')) button.insertAdjacentHTML('afterbegin', `<span class="difficulty-stars" aria-hidden="true">${'◆'.repeat(i + 1)}</span>`);
      });
    }
    root.querySelectorAll('[data-ui-gu-filter]').forEach(button => {
      if (button.querySelector('svg')) return;
      const icons = {all:'gu', rank:'check', 核心:'battle', 攻击:'battle', 防御:'shield', 辅助:'spark', 蜕变:'fist', 资源:'leaf', 情报:'eye', 终结:'crown'};
      button.insertAdjacentHTML('afterbegin', visualIcon(icons[button.dataset.uiGuFilter] || 'gu'));
    });
    if (page === 'ending'  && !root.querySelector('.outcome-picture')) {
      const symbol = state.ending?.outcome === 'victory' ? 'crown' : state.ending?.outcome === 'retreat' ? 'exit' : 'skull';
      root.querySelector('.ending-sheet')?.insertAdjacentHTML('afterbegin', `<div class="outcome-picture">${visualIcon(symbol)}</div>`);
    }
  },

  home(root) {
    const main = root.querySelector('.hall-main');
    if (!main) return;
    const hero = document.createElement('div');
    hero.className = 'home-stage';
    const copy = document.createElement('div');
    copy.className = 'home-copy';
    for (const selector of ['.eyebrow', 'h1', '.hall-copy', '.hall-save', '.hall-ending', '.difficulty-row', '.difficulty-note', '.hall-actions']) {
      const item = main.querySelector(selector);
      if (item) copy.append(item);
    }
    const verse = document.createElement('div');
    verse.className = 'home-verse';
    verse.innerHTML = '命有定数乎？<br>若有，我偏要问个真切。';
    copy.querySelector('h1').after(verse);
    hero.append(copy);
    hero.insertAdjacentHTML('beforeend', homeArt());
    const top = document.createElement('header');
    top.className = 'home-top';
    top.innerHTML = '<div class="brand"><div class="seal">问</div><div><div class="brand-name song">问真</div><div class="brand-sub">WENZHEN · 单机行记</div></div></div><div class="home-top-right"><span class="chip blue">离线 · 单人</span><button class="btn" data-ui-page="records">往昔行卷</button></div>';
    root.prepend(hero);
    root.prepend(top);
    const guides = document.createElement('details');
    guides.className = 'home-reference';
    guides.innerHTML = '<summary>入世须知 · 行囊与玩法</summary>';
    while (main.firstChild) guides.append(main.firstChild);
    main.replaceWith(guides);
    root.querySelector('.hall-grid').classList.add('home-details');
    root.insertAdjacentHTML('beforeend', '<footer class="home-bottom"><span>问真 / 开始只是另一种代价</span><span>本地自动存档 · 不联网 · 存档不跨浏览器同步</span></footer>');
  },

  map(root) {
    const scene = document.createElement('div');
    scene.className = 'map-scene';
    const workspace = document.createElement('div');
    workspace.className = 'map-workspace';
    const aside = document.createElement('aside');
    aside.className = 'map-sidebar stack';
    for (const child of [...root.children]) {
      if (child.matches('.segment-progress,.journey-trail,.map-nodes,.map-choice-title')) scene.append(child);
      else if (child.matches('.map-help,.guide-block,.leave-row')) aside.append(child);
    }
    scene.insertAdjacentHTML('afterbegin', '<svg class="map-mountain" viewBox="0 0 700 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 140L80 50l85 88L260 30l100 100L445 52l100 75 80-67L700 144v56H0" fill="#759784"/></svg>');
    scene.querySelectorAll('.map-node').forEach((card, i) => {
      const facts = card.querySelector('.rn-facts');
      const label = card.querySelector('.rn-top');
      if (label) label.insertAdjacentHTML('afterbegin', `<span class="route-index">${String(i + 1).padStart(2, '0')}</span>`);
      if (facts) {
        const intel = [...facts.children].find(row => row.querySelector('dt')?.textContent === '情报');
        if (intel) {
          const warning = document.createElement('span');
          warning.className = 'route-risk';
          warning.textContent = intel.querySelector('dd').textContent;
          card.querySelector('.map-enter,.rn-state').before(warning);
        }
        const details = document.createElement('details');
        details.className = 'route-facts';
        details.innerHTML = '<summary>风险、代价与收获</summary>';
        details.append(facts);
        if (card.tagName === 'BUTTON') {
          const wrapper = document.createElement('article');
          wrapper.className = `route-card ${card.classList.contains('available') ? 'available' : ''}`;
          card.replaceWith(wrapper);
          wrapper.append(card, details);
        } else card.append(details);
      }
    });
    workspace.append(scene, aside);
    root.append(workspace);
  },

  filterGu(root) {
    let count = 0;
    root.querySelectorAll('[data-gu-id]').forEach(card => {
      const gu = guById(card.dataset.guId);
      card.hidden = !(this.guFilter === 'all' || this.guFilter === 'rank' && gu.playable !== false && gu.rank <= state.cultivation
        || buildRoleLabel(GuRules.buildRoleOf(gu, GU_BY_ID)) === this.guFilter);
      if (!card.hidden) count++;
    });
    root.querySelectorAll('[data-ui-gu-filter]').forEach(button => {
      const selected = button.dataset.uiGuFilter === this.guFilter;
      button.classList.toggle('sel', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const empty = root.querySelector('[data-filter-empty]');
    if (empty) empty.hidden = count > 0;
  },
};

function renderReadView(page, root) {
  if (page === 'gu' || page === 'cult') {
    const previousTab = prepTab;
    if (page === 'gu') prepTab = 'gu';
    renderPrep(root);
    prepTab = previousTab;
    root.querySelector('.prep-title h2').textContent = UI.titles[page];
    root.querySelector('.prep-title .kicker').textContent = currentNode()
      ? `${segmentTitle(currentNode().segment)} · ${currentNode().name} · ${isPreparing() ? '整备中' : '查看'}`
      : `${segmentTitle(journeyProgress().activeSegment)} · 选择下一站`;
    root.querySelector('.prep-guides')?.remove();
    if (page === 'gu') {
      root.querySelector('.prep-rail')?.remove();
      root.querySelector('.prep-tabs')?.remove();
      root.querySelector('[data-pane="shop"]')?.remove();
      const owned = Object.values(GU_BY_ID).filter(gu => Number(state.owned[gu.id] || 0) > 0);
      const roles = [...new Set(owned.map(gu => buildRoleLabel(GuRules.buildRoleOf(gu, GU_BY_ID))))];
      root.querySelector('.prep-work').insertAdjacentHTML('afterbegin', `<div class="three-col gu-summary">${[['持有蛊种', owned.length], ['修为达标', owned.filter(gu => gu.playable !== false && gu.rank <= state.cultivation).length], ['生机叶', state.owned.vitality_leaf_gu || 0]].map(([label, value]) => `<div class="mini-stat"><span class="small muted">${label}</span><b>${value}</b></div>`).join('')}</div><div class="filterbar" role="group" aria-label="蛊藏筛选">${[['all', '全部蛊虫'], ['rank', '修为达标'], ...roles.map(role => [role, role])].map(([key, label]) => `<button class="tab" data-ui-gu-filter="${uiEscape(key)}">${uiEscape(label)}</button>`).join('')}</div>`);
      root.querySelectorAll('.grid>.gu').forEach((card, i) => card.dataset.guId = owned[i].id);
      root.querySelector('.grid').insertAdjacentHTML('afterend', '<div class="empty" data-filter-empty hidden>暂无符合条件的蛊虫。</div>');
      UI.filterGu(root);
    } else {
      root.querySelector('.prep-work')?.remove();
      const shell = root.querySelector('.prep-shell');
      shell.classList.add('cult-workspace');
      shell.insertAdjacentHTML('afterbegin', `<section class="panel cult-status"><div class="kicker">当前修为</div><div class="cultivation-ring"><div><div class="rank">${state.cultivation}转</div><div class="stage">${uiEscape(RunFlow.stageLabel(state.cultivation, state.cultivationStage).split('转')[1])}</div></div></div><h3>${RunFlow.stageLabel(state.cultivation, state.cultivationStage)}</h3><p class="muted">真元 ${state.qi}/${state.qiMax} · 资质 ${APTITUDE_LABEL[state.aptitude]}</p><div class="cult-stages">${Array.from({ length: 4 }, (_, i) => `<span class="${i <= state.cultivationStage ? 'reached' : ''}">${RunFlow.stageLabel(state.cultivation, i).split('转')[1]}</span>`).join('')}</div><div class="notice">突破提高真元上限，当前真元不补满；资质机缘的提升与回元另行结算。行程段数与修为转数相互独立。</div></section>`);
    }
    if (!isPreparing()) {
      root.querySelectorAll('button:not([data-ui-gu-filter])').forEach(button => {
        button.disabled = true;
        button.title = '当前仅可查看，进入整备后可操作';
      });
      root.querySelector('.prep-orient').innerHTML = '<b>查看当前修行</b><span>进入整备后可交易、疗伤、锻体与突破</span>';
      root.querySelector('[data-prep-continue]')?.remove();
    }
  } else if (page === 'journal') {
    root.innerHTML = `<div class="section-head"><div><div class="kicker">JOURNAL / 本局因果</div><h2>行记</h2></div><span>${state.journal.length} 条记录</span></div><div class="journal">${state.journal.length ? state.journal.map((line, i) => `<div><span>${String(state.journal.length - i).padStart(2, '0')}</span><p>${uiEscape(line)}</p></div>`).join('') : '<div class="empty">踏入第一条道路后，行记将从这里开始。</div>'}</div>`;
  } else if (page === 'records') {
    const result = LabSave.readArchive(saveStorage());
    const runs = result.ok ? result.runs : [];
    root.innerHTML = `<div class="section-head"><div><div class="kicker">ARCHIVES / 往昔行卷</div><h2>往昔行卷</h2></div><span>${runs.length} 局 · ${runs.filter(run => run.outcome === 'victory').length} 胜</span></div>${state.ending?.archiveSaved === false ? '<div class="alert">本局结局未能写入旧录，当前局仍可查看。</div>' : ''}<div class="archive-list">${!result.ok ? '<div class="empty">旧录暂不可读取，原始记录已保留。</div>' : runs.length ? runs.map(archiveRunCard).join('') : '<div class="empty">还没有已完成的行卷。</div>'}</div><button class="btn" data-ui-page="hall">返回首页</button>`;
    root.querySelectorAll('[data-run-seed]').forEach(button => button.addEventListener('click', () => act.startRun(button.dataset.difficulty, button.dataset.runSeed)));
  }
  UI.decorate(page, root);
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const replay = button.matches('[data-start-run],[data-ending-restart],[data-run-seed],#reset');
  const difficulty = button.dataset.difficulty && button.dataset.difficulty !== state.journey.difficulty;
  const retreat = button.matches('[data-retreat]');
  if (!UI.confirmed && ((replay || difficulty) && isInProgressRun() || retreat)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    UI.confirm(retreat ? '确认撤离战斗？' : '另开一局，将舍弃当前进度', retreat ? '撤离没有战利，不恢复气血或真元，已付消耗不返还。层主或终点遭遇撤退将结束本局。' : '每个浏览器只有一个进行中存档。重新开始会放弃当前行程，已完成的旧录保留。', () => {
      UI.confirmed = true;
      try { button.click(); } finally { UI.confirmed = false; }
    });
  }
}, true);

document.addEventListener('click', event => {
  const page = event.target.closest('[data-ui-page]');
  if (page && !page.disabled) showPage(page.dataset.uiPage);
  const filter = event.target.closest('[data-ui-gu-filter]');
  if (filter) { UI.guFilter = filter.dataset.uiGuFilter; UI.filterGu(document.getElementById('panel-gu')); }
  if (event.target.closest('[data-confirm-cancel]')) document.getElementById('ui-confirm').close();
  if (event.target.closest('[data-confirm-accept]')) {
    const pending = UI.pending;
    document.getElementById('ui-confirm').close();
    pending?.();
  }
});

document.addEventListener('keydown', event => {
  if (event.target.closest('input,select,textarea,button,dialog') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (document.getElementById('ui-confirm').open) return;
  const page = ['map', 'battle', 'gu', 'prep', 'cult', 'journal'][Number(event.key) - 1];
  const button = page && document.querySelector(`#tabs [data-tab="${page}"]`);
  if (button && !button.disabled) { event.preventDefault(); button.click(); }
});
const ICON={route:'M4 18l5-5 4 4 7-10 M3 5h5v5 M15 3h6v6',gu:'M12 3c3 3 7 1 7 6 0 2-3 3-3 5 0 2 3 3 3 5-2 3-6 2-7-1-2 3-5 3-7 1 0-2 3-3 3-5 0-2-3-3-3-5 0-2 3-3 4-3 0-2-3-2-1-5z',trade:'M3 9h18l-2 11H5L3 9z M5 9l2-5h10l2 5 M9 13v4 M15 13v4',cult:'M12 2c-2 4-6 6-6 11a6 6 0 0012 0c0-4-4-7-6-11z M9 14c0 3 2 5 3 5',log:'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',archive:'M3 5h18v4H3z M5 9v11h14V9 M10 13h4',battle:'M5 19L19 5 M10 4l10 10 M4 10l10 10',home:'M4 11L12 4l8 7v9H4z',back:'M19 12H5 M12 19l-7-7 7-7',shield:'M12 2l8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6z',coin:'M12 3a9 9 0 110 18 9 9 0 010-18z M9 10h6 M9 14h6',heart:'M12 21s-9-5.5-9-12a5 5 0 019-3 5 5 0 019 3c0 6.5-9 12-9 12z',soul:'M12 3c4 4 7 7 7 11a7 7 0 01-14 0c0-4 3-7 7-11z M10 17c3 1 5-1 5-4',spark:'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 100 6 3 3 0 000-6z',cross:'M18 6L6 18 M6 6l12 12'};
function homeArt(){return `<div class="home-art" aria-hidden="true"><svg viewBox="0 0 730 800" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="sun"><stop stop-color="#e9d59c" stop-opacity=".32"/><stop offset="1" stop-color="#d6be75" stop-opacity="0"/></radialGradient><linearGradient id="mt" x2="0.7" y2="1"><stop stop-color="#476359"/><stop offset="1" stop-color="#0a1716"/></linearGradient></defs><circle cx="470" cy="280" r="220" fill="url(#sun)"/><circle cx="470" cy="290" r="103" fill="#dac28b" opacity=".78"/><path d="M0 515L100 410 190 472 301 285 387 430 450 360 650 530 730 450V800H0Z" fill="#31473f" opacity=".8"/><path d="M0 580L165 445 280 550 420 335 540 565 650 487 730 552V800H0Z" fill="url(#mt)"/><path d="M0 640L155 578 300 626 447 494 530 589 680 518 730 575V800H0Z" fill="#1b312a"/><path d="M0 716L215 608 350 690 554 591 730 650V800H0Z" fill="#111f1b"/><path d="M385 710q12-112 7-159l-20-24 9-61 20-21 21 25 11 59-17 31-5 150z" fill="#080d0c"/><path d="M373 534l-32 75 17 6 34-57M429 535l40 65-16 6-45-52" fill="#080d0c"/><path d="M396 439l-6-43 16-35 18 39-7 41z" fill="#0a0f0e"/><path d="M406 361c-34-7-43 16-28 27l33 9 19-18-24-18" fill="#090e0d"/><path d="M393 439l-50 48 13 22 42-38 M425 443l65 51-17 21-62-42" fill="#0a0f0e"/><path d="M200 790Q420 720 730 755" stroke="#d0c28e" stroke-opacity=".12" fill="none" stroke-width="2"/><path d="M38 192l130-41M92 235l70-20M558 136l78-25" stroke="#e7ddbb" stroke-opacity=".16"/></svg><div class="vertical-stamp">天地不仁 · 唯求问真</div><div class="art-index">WENZHEN / JOURNEY OF FIVE REALMS</div></div>`}
