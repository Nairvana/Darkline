(function () {
  'use strict';

  const D = window.Darkline;
  if (!D) return;
  const Sfx = window.DarklineSfx;

  const byId = id => document.getElementById(id);
  const el = {
    board: byId('board'),
    statusDot: byId('statusDot'),
    turnText: byId('turnText'),
    turnSub: byId('turnSub'),
    resultBtn: byId('resultBtn'),
    ledgerYou: byId('ledgerYou'),
    ledgerFoe: byId('ledgerFoe'),
    sumYou: byId('sumYou'),
    sumFoe: byId('sumFoe'),
    ledgerYouLabel: byId('ledgerYouLabel'),
    ledgerFoeLabel: byId('ledgerFoeLabel'),
    metaYou: byId('metaYou'),
    metaFoe: byId('metaFoe'),
    pipsYou: byId('pipsYou'),
    pipsFoe: byId('pipsFoe'),
    directivePanel: byId('directivePanel'),
    directiveEyebrow: byId('directiveEyebrow'),
    directiveEn: byId('directiveEn'),
    yourGoalName: byId('yourGoalName'),
    yourGoalEn: byId('yourGoalEn'),
    goalBadge: byId('goalBadge'),
    yourGoalDesc: byId('yourGoalDesc'),
    goalProgressBar: byId('goalProgressBar'),
    goalProgressText: byId('goalProgressText'),
    goalHint: byId('goalHint'),
    goalStrip: byId('goalStrip'),
    stripKicker: byId('stripKicker'),
    stripName: byId('stripName'),
    stripDesc: byId('stripDesc'),
    stripProgress: byId('stripProgress'),
    stripBadge: byId('stripBadge'),
    enemyPanel: byId('enemyPanel'),
    enemyTitle: byId('enemyTitle'),
    enemyEyebrow: byId('enemyEyebrow'),
    enemyRedacted: byId('enemyRedacted'),
    enemyNote: byId('enemyNote'),
    enemyReveal: byId('enemyReveal'),
    enemyGoalName: byId('enemyGoalName'),
    enemyGoalEn: byId('enemyGoalEn'),
    enemyGoalBadge: byId('enemyGoalBadge'),
    enemyGoalDesc: byId('enemyGoalDesc'),
    poolCount: byId('poolCount'),
    goalPool: byId('goalPool'),
    poolNote: byId('poolNote'),
    moveLog: byId('moveLog'),
    seedCode: byId('seedCode'),
    seedInput: byId('seedInput'),
    copyBtn: byId('copyBtn'),
    loadSeedBtn: byId('loadSeedBtn'),
    replayBtn: byId('replayBtn'),
    newBtn: byId('newBtn'),
    rulesBtn: byId('rulesBtn'),
    muteBtn: byId('muteBtn'),
    historyBtn: byId('historyBtn'),
    drawDialog: byId('drawDialog'),
    drawCards: Array.from(document.querySelectorAll('.draw-card')),
    drawLead: byId('drawLead'),
    drawResult: byId('drawResult'),
    modeBtn: byId('modeBtn'),
    rulesDialog: byId('rulesDialog'),
    historyDialog: byId('historyDialog'),
    historyList: byId('historyList'),
    clearHistoryBtn: byId('clearHistoryBtn'),
    brandMark: byId('brandMark'),
    brandSub: byId('brandSub'),
    bridgeStatusBtn: byId('bridgeStatusBtn'),
    bridgeName: byId('bridgeName'),
    bridgeSide: byId('bridgeSide'),
    bridgeDialog: byId('bridgeDialog'),
    bridgeNow: byId('bridgeNow'),
    bridgeNowName: byId('bridgeNowName'),
    bridgeNowSide: byId('bridgeNowSide'),
    handoffDialog: byId('handoffDialog'),
    handoffMark: byId('handoffMark'),
    handoffTitle: byId('handoffTitle'),
    handoffSub: byId('handoffSub'),
    handoffBtn: byId('handoffBtn'),
    endDialog: byId('endDialog'),
    closeEndBtn: byId('closeEndBtn'),
    verdictTitle: byId('verdictTitle'),
    verdictReason: byId('verdictReason'),
    endYouLabel: byId('endYouLabel'),
    endFoeLabel: byId('endFoeLabel'),
    endYourGoal: byId('endYourGoal'),
    endYourDesc: byId('endYourDesc'),
    endYourMet: byId('endYourMet'),
    endFoeGoal: byId('endFoeGoal'),
    endFoeDesc: byId('endFoeDesc'),
    endFoeMet: byId('endFoeMet'),
    verdictStats: byId('verdictStats'),
    readoutPanel: byId('readoutPanel'),
    readVerdict: byId('readVerdict'),
    readoutBars: byId('readoutBars'),
    endInspectBtn: byId('endInspectBtn'),
    endReplayBtn: byId('endReplayBtn'),
    endNewBtn: byId('endNewBtn'),
    toast: byId('toast'),
    bgmDark: byId('bgmDark'),
    bgmBlue: byId('bgmBlue'),
    sfxFlip: byId('sfxFlip')
  };

  // Opt-in only: ?debug=1 (fair read-only), ?debug=full (full read-only),
  // ?agent=you|foe|both (external control; built-in AI yields those sides).
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const debugParam = params.get('debug') || hashParams.get('debug');
  const bridgeDebug = debugParam === 'full' ? 'full' : debugParam ? 'view' : null;
  const agentParam = params.get('agent') || hashParams.get('agent');
  const agentMode = agentParam === 'you' || agentParam === 'foe' || agentParam === 'both'
    ? agentParam
    : null;
  const agentSides = agentMode === 'both' ? [0, 1] : agentMode === 'you' ? [0] : agentMode === 'foe' ? [1] : [];
  const bridgeEnabled = Boolean(bridgeDebug || agentMode);
  const modelParam = params.get('model') || hashParams.get('model');
  const clientParam = params.get('client') || hashParams.get('client');
  let agentIdentity = {
    model: modelParam ? String(modelParam).trim().slice(0, 32) : '',
    client: clientParam ? String(clientParam).trim().slice(0, 24) : '',
    lastSeen: 0
  };

  function agentControls(side) {
    return agentSides.includes(side);
  }

  let state = null;
  let busy = false;
  let localMode = false;
  let viewSide = 0;
  let pendingSide = 0;
  let handoffOpen = false;
  let lastPlaced = -1;
  let drawPending = false;
  let drawSettled = false;
  let drawTimer = null;
  let aiTimer = null;
  let endTimer = null;
  let toastTimer = null;
  const HISTORY_KEY = 'darkline.history.v1';
  const HISTORY_LIMIT = 30;
  const THEME_KEY = 'darkline.theme.v1';
  const MUTE_KEY = 'darkline.muted.v1';
  let historyLogged = false;
  let endSounded = false;
  let historyCache = readHistory();
  let bridgeSeq = 0;
  let bridgeWaiters = [];
  let themeBusy = false;

  const BGM_VOLUME = 0.28;
  const BGM_FADE_IN = 900;
  const BGM_FADE_OUT = 480;
  const FLIP_VOLUME = 0.55;
  const bgmTracks = el.bgmDark && el.bgmBlue
    ? [
        { audio: el.bgmDark, raf: 0 },
        { audio: el.bgmBlue, raf: 0 }
      ]
    : [];
  const bgmPreloadTimers = [0, 0];
  let bgmActive = document.documentElement.classList.contains('theme-deepseek') ? 1 : 0;
  let bgmStarted = false;
  let bgmMuted = false;

  function init() {
    if (agentMode) localMode = false;
    syncThemeUI();
    syncModeUI();
    initBgm();
    wire();
    newGame(seedFromHash() || D.newSeed());
  }

  function newGame(seed) {
    clearTimeout(aiTimer);
    clearTimeout(endTimer);
    clearTimeout(drawTimer);
    aiTimer = null;
    endTimer = null;
    drawTimer = null;
    if (el.endDialog.open) el.endDialog.close();
    if (el.drawDialog.open) el.drawDialog.close();
    if (el.rulesDialog.open) el.rulesDialog.close();
    if (el.historyDialog.open) el.historyDialog.close();
    if (el.bridgeDialog.open) el.bridgeDialog.close();
    if (el.handoffDialog.open) el.handoffDialog.close();

    state = D.createGame(seed);
    busy = false;
    viewSide = 0;
    pendingSide = 0;
    handoffOpen = false;
    lastPlaced = -1;
    drawPending = true;
    drawSettled = false;
    historyLogged = false;
    endSounded = false;
    el.seedInput.value = '';
    updateHash(state.seed);
    buildBoard();
    buildPool();
    renderAll();
    el.goalPool.scrollTop = 0;
    openDraw();
  }

  function openDraw() {
    clearTimeout(drawTimer);
    drawTimer = null;
    for (const card of el.drawCards) {
      const side = card.dataset.draw === '0' ? '左边' : '右边';
      card.disabled = agentControls(0);
      card.classList.remove('is-revealed', 'is-picked', 'is-foe');
      card.querySelector('.draw-value').textContent = '?';
      card.querySelector('.draw-role').textContent = '';
      card.setAttribute('aria-label', `抽${side}的暗牌`);
    }
    el.drawLead.textContent = localMode
      ? '两张暗牌点数不同。P1 选一张，另一张归 P2；牌面大的一方先落子。'
      : '两张暗牌点数不同。你选一张，另一张归对手；牌面大的一方先落子。';
    el.drawResult.textContent = agentControls(0) ? '等待外部接入选择先手牌。' : '选一张暗牌。';
    el.drawDialog.showModal();
    el.drawDialog.focus({ preventScroll: true });
  }

  function pickDraw(event) {
    if (agentControls(0)) return;
    applyDrawPick(Number(event.currentTarget.dataset.draw));
  }

  function applyDrawPick(pick) {
    if (!drawPending || drawSettled) return false;
    if (pick !== 0 && pick !== 1) return false;
    const result = D.resolveInitiative(state, pick);
    if (!result) return false;
    drawSettled = true;
    playFlipSfx();
    const pickerLabel = localMode ? 'P1' : '你';
    const otherLabel = localMode ? 'P2' : '对手';

    el.drawCards.forEach((item, index) => {
      const mine = index === pick;
      item.disabled = true;
      item.classList.add('is-revealed');
      item.classList.toggle('is-picked', mine);
      item.classList.toggle('is-foe', !mine);
      item.querySelector('.draw-value').textContent = state.initiative.cards[index];
      item.querySelector('.draw-role').textContent = mine ? pickerLabel : otherLabel;
      item.setAttribute('aria-label', `${mine ? pickerLabel : otherLabel}抽到 ${state.initiative.cards[index]}`);
    });

    clearTimeout(drawTimer);
    drawTimer = setTimeout(() => {
      drawTimer = null;
      const gap = localMode ? ' ' : '';
      el.drawResult.innerHTML =
        `${pickerLabel}${gap}抽到 <b>${result.mine}</b>，${otherLabel}${gap}抽到 <b>${result.foe}</b>。` +
        (result.first === 0 ? `${pickerLabel}${gap}先手。` : `${otherLabel}${gap}先手。`);
      el.drawDialog.focus({ preventScroll: true });
      drawTimer = setTimeout(() => {
        drawTimer = null;
        startGameFromDraw();
      }, 1000);
    }, 620);
    return true;
  }

  function startGameFromDraw() {
    if (!drawPending || !drawSettled) return;
    clearTimeout(drawTimer);
    drawTimer = null;
    drawPending = false;
    el.drawDialog.close();
    if (localMode) {
      renderAll();
      openHandoff(D.playerToMove(state), true);
      return;
    }
    renderAll();
    if (D.playerToMove(state) === 1) scheduleAi(720);
  }

  function openHandoff(side, fromDraw) {
    pendingSide = side === 1 ? 1 : 0;
    handoffOpen = true;
    busy = true;
    const p = pendingSide + 1;
    const mover = viewSide + 1;
    el.handoffMark.textContent = p;
    el.handoffMark.classList.toggle('p2', pendingSide === 1);
    el.handoffDialog.classList.toggle('p2', pendingSide === 1);
    el.handoffBtn.classList.toggle('p2', pendingSide === 1);
    el.handoffTitle.textContent = `交给 P${p}`;
    el.handoffSub.textContent = fromDraw
      ? `先手已定。把设备交给 P${p}，确认后才显示秘密指令。`
      : `P${mover} 已落子。把设备交给 P${p}，确认后继续。`;
    el.handoffBtn.textContent = `我是 P${p}`;
    renderAll();
    Sfx.handoff(pendingSide);
    if (!el.handoffDialog.open) el.handoffDialog.showModal();
    el.handoffBtn.focus({ preventScroll: true });
  }

  function confirmHandoff() {
    if (!handoffOpen) return;
    Sfx.confirm(pendingSide);
    viewSide = pendingSide;
    handoffOpen = false;
    busy = false;
    if (el.handoffDialog.open) el.handoffDialog.close();
    renderAll();
  }

  function buildBoard() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < D.N; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell val${state.values[i]}`;
      cell.dataset.i = i;
      cell.setAttribute('role', 'gridcell');
      cell.innerHTML = `
        <span class="coord">${D.COORDS[i]}</span>
        <span class="value">${state.values[i]}</span>
        <span class="owner-mark" aria-hidden="true"></span>
        <span class="last-mark" aria-hidden="true"></span>
      `;
      frag.appendChild(cell);
    }
    el.board.replaceChildren(frag);
  }

  function buildPool() {
    el.goalPool.innerHTML = D.GOAL_IDS.map((id, index) => {
      const g = D.GOALS[id];
      return `
        <li class="goal-item" data-goal="${id}">
          <span class="goal-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="goal-copy">
            <span class="goal-name">${g.name}<em>${g.en}</em></span>
            <span class="goal-desc">${g.desc}</span>
          </span>
          <span class="mine-tag"></span>
        </li>
      `;
    }).join('');
    el.poolCount.textContent = D.GOAL_IDS.length;
  }

  function renderAll() {
    if (!state) return;
    renderStatus();
    renderBoard();
    renderGoal();
    renderEnemy();
    renderLedger();
    renderLog();
    renderPool();
    renderFooter();
    renderBridgeBadge();
    notifyBridge();
  }

  function renderStatus() {
    if (drawPending) {
      el.statusDot.className = 'status-dot you';
      el.turnText.textContent = localMode ? 'P1 抽牌' : '抽牌定先手';
      el.turnSub.textContent = agentControls(0)
        ? '等待外部接入选择暗牌'
        : '选一张暗牌 · 点数大者先落子';
      el.resultBtn.classList.add('hidden');
      return;
    }

    if (state.over) {
      el.statusDot.className = 'status-dot over';
      el.turnText.textContent = '对局结束';
      el.turnSub.textContent = `总和 ${D.sumOf(state.claims[0], state.values)} : ${D.sumOf(state.claims[1], state.values)} · 目标已结算`;
      el.resultBtn.classList.remove('hidden');
      return;
    }

    const turn = D.playerToMove(state);
    if (localMode) {
      const nth = state.claims[turn].length + 1;
      el.statusDot.className = `status-dot ${turn === 0 ? 'you' : 'foe'}`;
      el.turnText.textContent = handoffOpen ? '等待交接' : `轮到 P${turn + 1}`;
      el.turnSub.textContent = `${state.first === turn ? '先手' : '后手'} · 第 ${nth}/5 手 · 选一格落子`;
      el.resultBtn.classList.add('hidden');
      return;
    }
    if (turn === 0) {
      const nth = state.claims[0].length + 1;
      if (agentControls(0)) {
        el.statusDot.className = 'status-dot you thinking';
        el.turnText.textContent = '外部接入中';
        el.turnSub.textContent = `第 ${nth}/5 手 · 等待外部落子`;
      } else {
        el.statusDot.className = 'status-dot you';
        el.turnText.textContent = '轮到你';
        el.turnSub.textContent = `${state.first === 0 ? '你先手' : '对手先手'} · 第 ${nth}/5 手 · 选一格落子`;
      }
      el.resultBtn.classList.add('hidden');
    } else {
      const nth = state.claims[1].length + 1;
      el.statusDot.className = 'status-dot foe thinking';
      if (agentControls(1)) {
        el.turnText.textContent = '外部对手思考中';
        el.turnSub.textContent = `第 ${nth}/5 手 · 等待外部落子`;
      } else {
        el.turnText.textContent = '对手推演中';
        el.turnSub.textContent = state.moves.length === 0
          ? '对手先手 · 正在布局'
          : `第 ${nth}/5 手 · 它在读你的落子`;
      }
      el.resultBtn.classList.add('hidden');
    }
  }

  function renderBoard() {
    const turn = D.playerToMove(state);
    const controllable = localMode
      ? !handoffOpen && turn === viewSide
      : !agentControls(0) && turn === 0;
    const canPlay = !state.over && !busy && !drawPending && controllable;
    el.board.classList.toggle('turn-p2', localMode && viewSide === 1);
    el.board.classList.toggle('is-over', state.over);
    for (let i = 0; i < D.N; i++) {
      const cell = el.board.children[i];
      if (!cell) continue;
      const owner = state.owner[i];
      const claimable = canPlay && owner === -1;
      const ownerLabel = owner === -1 ? '空' : owner === 0 ? '你的格' : '对手的格';
      cell.classList.toggle('claimable', claimable);
      cell.classList.toggle('owned-you', owner === 0);
      cell.classList.toggle('owned-foe', owner === 1);
      cell.classList.toggle('last', i === lastPlaced);
      cell.tabIndex = claimable ? 0 : -1;
      cell.setAttribute('aria-disabled', claimable ? 'false' : 'true');
      cell.setAttribute('aria-label', `${D.COORDS[i]}，数字 ${state.values[i]}，${ownerLabel}`);
    }
  }

  function renderGoal() {
    const goalSide = localMode ? viewSide : 0;
    const info = D.goalInfo(state, goalSide);
    const viewerP2 = localMode && goalSide === 1;
    el.directivePanel.classList.toggle('is-p2', viewerP2);
    el.goalStrip.classList.toggle('is-p2', viewerP2);
    el.directiveEyebrow.textContent = localMode ? `P${goalSide + 1} 的秘密指令` : '你的秘密指令';
    el.directiveEn.textContent = localMode ? `P${goalSide + 1}` : 'YOUR DIRECTIVE';
    el.stripKicker.textContent = localMode ? `DIRECTIVE · P${goalSide + 1} 的指令` : 'YOUR DIRECTIVE · 你的指令';
    el.yourGoalName.textContent = `「${info.name}」`;
    el.yourGoalEn.textContent = info.en;
    el.yourGoalDesc.textContent = info.desc;
    el.goalProgressBar.style.width = `${Math.round(info.ratio * 100)}%`;
    el.goalProgressText.textContent = info.text;

    let badge = '进行中';
    let cls = 'live';
    let hint = localMode ? '别让对方看出你在找什么。' : '别让它看出你在找什么。';

    if (state.over) {
      if (info.met) {
        badge = '已达成';
        cls = 'met';
        hint = '这件案子已经成立。';
      } else {
        badge = '未达成';
        cls = 'missed';
        hint = info.feasible ? '差一步，但时间用完了。' : '目标被封死，未能成立。';
      }
    } else if (info.met) {
      badge = '已达成';
      cls = 'met';
      hint = localMode ? '这一手成立了。剩下的手，用来封死对方。' : '它还是没看穿你。剩下的手，用来封死它。';
    } else if (!info.feasible) {
      badge = '已封死';
      cls = 'dead';
      hint = localMode ? '目标做不成了。转去压低对方的完成度。' : '目标做不成了。转去压低对手的完成度。';
    }

    el.goalBadge.textContent = badge;
    el.goalBadge.className = `badge ${cls}`;
    el.goalHint.textContent = hint;
    el.directivePanel.classList.toggle('is-met', info.met);
    el.directivePanel.classList.toggle('is-dead', !state.over && !info.met && !info.feasible);

    el.stripName.textContent = `「${info.name}」`;
    el.stripDesc.textContent = info.desc;
    el.stripProgress.textContent = info.text;
    el.stripBadge.textContent = badge;
    el.stripBadge.className = `badge ${cls}`;
    el.goalStrip.classList.toggle('is-met', info.met);
    el.goalStrip.classList.toggle('is-dead', !state.over && !info.met && !info.feasible);
  }

  function renderEnemy() {
    const thinking = !localMode && !state.over && D.playerToMove(state) === 1;
    const enemySide = localMode ? 1 - viewSide : 1;
    el.enemyPanel.classList.toggle('is-p1', localMode && enemySide === 0);
    el.enemyPanel.classList.toggle('is-p2', localMode && enemySide === 1);
    el.enemyTitle.textContent = localMode ? `P${enemySide + 1} 的指令` : '对手的指令';
    el.enemyNote.textContent = state.over
      ? ''
      : localMode
        ? '目标池 12 选 1 · 与你的不同。对方也在读你。'
        : '目标池 12 选 1 · 与你的不同。它也在读你。';
    el.enemyPanel.classList.toggle('thinking', thinking);
    el.enemyPanel.classList.toggle('revealed', state.over);
    el.enemyEyebrow.textContent = state.over ? 'REVEALED' : 'REDACTED';
    el.enemyRedacted.classList.toggle('hidden', state.over);
    el.enemyNote.classList.toggle('hidden', state.over);
    el.enemyReveal.classList.toggle('hidden', !state.over);

    if (state.over) {
      const info = D.goalInfo(state, 1);
      el.enemyGoalName.textContent = `「${info.name}」`;
      el.enemyGoalEn.textContent = info.en;
      el.enemyGoalDesc.textContent = info.desc;
      el.enemyGoalBadge.textContent = info.met ? '已达成' : '未达成';
      el.enemyGoalBadge.className = `badge ${info.met ? 'met' : 'missed'}`;
    }
  }

  function renderLedger() {
    const sums = [0, 1].map(p => D.sumOf(state.claims[p], state.values));
    el.ledgerYouLabel.textContent = localMode ? 'P1 · 总和' : '你 · 总和';
    el.ledgerFoeLabel.textContent = localMode ? 'P2 · 总和' : '对手 · 总和';
    el.sumYou.textContent = sums[0];
    el.sumFoe.textContent = sums[1];
    el.metaYou.textContent = `${state.claims[0].length} / ${D.CLAIMS} 格`;
    el.metaFoe.textContent = `${state.claims[1].length} / ${D.CLAIMS} 格`;
    el.ledgerYou.classList.toggle('lead', sums[0] > sums[1]);
    el.ledgerFoe.classList.toggle('lead', sums[1] > sums[0]);
    renderPips(el.pipsYou, state.claims[0].length);
    renderPips(el.pipsFoe, state.claims[1].length);
  }

  function renderPips(container, count) {
    container.innerHTML = Array.from(
      { length: D.CLAIMS },
      (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`
    ).join('');
  }

  function renderLog() {
    if (!state.moves.length) {
      el.moveLog.innerHTML = '<li class="empty">等待第一手…</li>';
      return;
    }
    const rows = [];
    for (let i = state.moves.length - 1; i >= 0; i--) {
      const move = state.moves[i];
      rows.push(`
        <li class="log-item ${move.p === 0 ? 'you' : 'foe'}">
          <span class="log-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="log-who">${localMode ? `P${move.p + 1}` : move.p === 0 ? '你' : '对手'}</span>
          <span class="log-cell">${D.COORDS[move.cell]}</span>
          <span class="log-value">${state.values[move.cell]}</span>
        </li>
      `);
    }
    el.moveLog.innerHTML = rows.join('');
  }

  function renderPool() {
    const viewerP2 = localMode && viewSide === 1;
    const foeSide = 1 - viewSide;
    const mine = state.goals[localMode ? viewSide : 0];
    const foe = state.goals[localMode ? foeSide : 1];
    for (const item of el.goalPool.children) {
      const id = item.dataset.goal;
      const isMine = id === mine;
      const isFoe = state.over && id === foe;
      item.classList.toggle('is-mine', isMine);
      item.classList.toggle('is-foe', isFoe);
      item.classList.toggle('is-mine-p2', isMine && viewerP2);
      item.classList.toggle('is-foe-p1', isFoe && localMode && foeSide === 0);
      item.style.order = isMine ? '-2' : isFoe ? '-1' : '0';
      const tag = item.querySelector('.mine-tag');
      tag.textContent = isMine
        ? localMode && state.over ? `P${viewSide + 1}` : localMode ? '当前' : '你'
        : isFoe
          ? localMode ? `P${foeSide + 1}` : '对手'
          : '';
      if (localMode) {
        tag.classList.toggle('p2', (isMine && viewerP2) || (isFoe && foeSide === 1));
        tag.classList.remove('foe');
      } else {
        tag.classList.toggle('foe', !isMine && isFoe);
        tag.classList.remove('p2');
      }
    }
    el.poolNote.textContent = state.over
      ? '双方指令已揭晓。'
      : localMode
        ? `对方的目标在其余 ${D.GOAL_IDS.length - 1} 张之中。`
        : `对手的目标在其余 ${D.GOAL_IDS.length - 1} 张之中。`;
    syncPoolOverflow();
  }

  function syncPoolOverflow() {
    const panel = el.goalPool.closest('.pool');
    if (panel) panel.classList.toggle('is-scrollable', el.goalPool.scrollHeight > el.goalPool.clientHeight + 1);
  }

  function renderFooter() {
    el.seedCode.textContent = state.seed;
  }

  function onCell(index) {
    if (!state || state.over || busy || drawPending) return;
    if (localMode) {
      if (handoffOpen || D.playerToMove(state) !== viewSide) return;
    } else {
      if (agentControls(0)) return;
      if (D.playerToMove(state) !== 0) return;
    }
    if (state.owner[index] !== -1) {
      Sfx.denied();
      return;
    }
    if (!D.applyMove(state, index)) return;
    lastPlaced = index;
    Sfx.claim(localMode ? viewSide : 0);
    renderAll();
    if (checkEnd()) return;
    if (localMode) {
      openHandoff(D.playerToMove(state), false);
      return;
    }
    scheduleAi();
  }

  function scheduleAi(delay = 640) {
    if (localMode) return;
    if (!state || state.over || drawPending || D.playerToMove(state) !== 1) return;
    if (agentControls(1)) return;
    clearTimeout(aiTimer);
    busy = true;
    renderAll();

    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!state || state.over) {
        busy = false;
        return;
      }
      let cell = D.chooseAiMove(state, 1);
      if (cell == null) cell = D.emptyIndices(state)[0];
      if (cell != null && D.applyMove(state, cell)) {
        lastPlaced = cell;
        Sfx.claim(1);
      }
      busy = false;
      renderAll();
      checkEnd();
    }, delay);
  }

  function checkEnd() {
    if (!state.over) return false;
    if (!historyLogged) {
      historyLogged = true;
      recordHistory();
    }
    busy = true;
    renderAll();
    el.goalPool.scrollTop = 0;
    clearTimeout(endTimer);
    endTimer = setTimeout(showEnd, 620);
    return true;
  }

  function showEnd() {
    if (!state || !state.over) return;
    clearTimeout(endTimer);
    endTimer = null;
    if (el.endDialog.open) return;
    populateEnd();
    if (!endSounded) {
      endSounded = true;
      Sfx.outcome({ winner: D.evaluate(state).winner, local: localMode });
    }
    el.endDialog.showModal();
  }

  function readHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(entry => entry && typeof entry.seed === 'string' &&
          Array.isArray(entry.goals) && D.GOAL_IDS.includes(entry.goals[0]) && D.GOAL_IDS.includes(entry.goals[1]))
        .slice(0, HISTORY_LIMIT)
        .map(entry => ({
          seed: entry.seed,
          at: Number(entry.at) || Date.now(),
          mode: entry.mode === 'local' ? 'local' : 'ai',
          winner: entry.winner === 0 || entry.winner === 1 ? entry.winner : null,
          reason: typeof entry.reason === 'string' ? entry.reason : 'draw',
          goals: entry.goals,
          met: Array.isArray(entry.met) ? [!!entry.met[0], !!entry.met[1]] : [false, false],
          first: entry.first === 1 ? 1 : 0,
          completion: Array.isArray(entry.completion) ? entry.completion : [null, null],
          sums: Array.isArray(entry.sums) ? entry.sums : [0, 0],
          moves: Number(entry.moves) || 0
        }));
    } catch (error) {
      return [];
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyCache));
    } catch (error) {
      // Storage can be unavailable for local files; the in-memory list still works this session.
    }
  }

  function recordHistory() {
    const ev = D.evaluate(state);
    historyCache.unshift({
      seed: state.seed,
      at: Date.now(),
      mode: localMode ? 'local' : 'ai',
      winner: ev.winner,
      reason: ev.reason,
      goals: state.goals.slice(),
      met: ev.met.slice(),
      first: state.first,
      completion: ev.completion.slice(),
      sums: ev.sums.slice(),
      moves: state.moves.length
    });
    historyCache = historyCache.slice(0, HISTORY_LIMIT);
    persistHistory();
  }

  function historyReason(entry) {
    if (entry.reason === 'goal') return '唯一达成';
    if (entry.reason === 'speed') return '手数裁定';
    if (entry.reason === 'sum') return entry.met[0] && entry.met[1] ? `总和裁定 +${D.TIE_HANDICAP}` : '总和裁定';
    if (entry.reason === 'progress') return '完成度裁定';
    if (entry.met[0] && entry.met[1]) return '补点后仍平';
    return '全部相同';
  }

  function historyMeta(entry) {
    const seat = entry.mode === 'local'
      ? `P${entry.first + 1} 先手`
      : entry.first === 0 ? '你先手' : '对手先手';
    const both = entry.met[0] && entry.met[1] &&
      entry.completion[0] != null && entry.completion[1] != null;
    const hands = both ? `完成 ${entry.completion[0]}/${entry.completion[1]} 手` : `${entry.moves} 手`;
    return `${seat} · ${hands} · ${historyReason(entry)}（${entry.sums[0]}:${entry.sums[1]}）`;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function renderHistory() {
    el.historyList.replaceChildren();
    el.clearHistoryBtn.disabled = historyCache.length === 0;
    if (!historyCache.length) {
      const empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = '还没有对局记录。';
      el.historyList.appendChild(empty);
      return;
    }

    for (const entry of historyCache) {
      const local = entry.mode === 'local';
      const firstGoal = D.GOALS[entry.goals[0]].name;
      const secondGoal = D.GOALS[entry.goals[1]].name;
      const result = local
        ? entry.winner === 0 ? '1胜' : entry.winner === 1 ? '2胜' : '平'
        : entry.winner === 0 ? '胜' : entry.winner === 1 ? '负' : '平';
      const cls = entry.winner === 0 ? 'win' : entry.winner === 1 ? 'lose' : 'draw';
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      button.dataset.seed = entry.seed;
      button.dataset.mode = entry.mode;
      button.title = `重开种子 ${entry.seed}`;
      button.innerHTML = `
        <span class="history-result ${cls}">${result}</span>
        <span class="history-main">
          <span class="history-seed-row">
            <span class="history-seed"></span>
            <span class="history-time">${formatTime(entry.at)}</span>
          </span>
          <span class="history-goals"></span>
          <span class="history-meta"></span>
        </span>
        <span class="history-arrow" aria-hidden="true">→</span>
      `;
      button.querySelector('.history-seed').textContent = entry.seed;
      button.querySelector('.history-goals').textContent = local
        ? `P1「${firstGoal}」 · P2「${secondGoal}」`
        : `你「${firstGoal}」 · 对手「${secondGoal}」`;
      button.querySelector('.history-meta').textContent = historyMeta(entry);
      item.appendChild(button);
      el.historyList.appendChild(item);
    }
  }

  function clearHistory() {
    if (!historyCache.length) return;
    if (!window.confirm('清空全部对局记录？')) return;
    historyCache = [];
    persistHistory();
    renderHistory();
  }

  function agentSideLabel() {
    if (agentMode === 'foe') return '执对手';
    if (agentMode === 'you') return '执你方';
    if (agentMode === 'both') return '执双方';
    return '';
  }

  function agentIsOnline() {
    return agentIdentity.lastSeen > 0 && Date.now() - agentIdentity.lastSeen < 20000;
  }

  function renderBridgeBadge() {
    if (!agentMode) {
      el.bridgeStatusBtn.className = 'bridge-status off';
      el.bridgeName.textContent = '未接入模型';
      el.bridgeSide.textContent = '点击查看接入指南';
      el.bridgeStatusBtn.title = '未接入模型，点击查看接入指南';
      el.bridgeStatusBtn.setAttribute('aria-label', '未接入模型，点击查看接入指南');
    } else {
      const online = agentIsOnline();
      const named = Boolean(agentIdentity.model);
      const name = named ? agentIdentity.model : agentIdentity.lastSeen ? '未命名模型' : '等待模型';
      const state = online ? '在线' : named ? '待命' : '等待接入';
      const client = agentIdentity.client ? `${agentIdentity.client} · ` : '';
      el.bridgeStatusBtn.className = `bridge-status ${online ? 'online' : 'waiting'}`;
      el.bridgeName.textContent = name;
      el.bridgeSide.textContent = `${agentSideLabel()} · ${state}`;
      el.bridgeStatusBtn.title = `${name} · ${client}${agentSideLabel()} · ${state}`;
      el.bridgeStatusBtn.setAttribute('aria-label', `${name}，${client}${agentSideLabel()}，${state}，点击查看接入指南`);
    }
    renderBridgeNow();
  }

  function renderBridgeNow() {
    if (!agentMode) {
      el.bridgeNow.className = 'bridge-now off';
      el.bridgeNowName.textContent = '未接入模型';
      el.bridgeNowSide.textContent = bridgeDebug
        ? '调试只读已开启，但还没有模型接管。'
        : '当前没有外部模型连接。';
      return;
    }
    const online = agentIsOnline();
    const model = agentIdentity.model || (agentIdentity.lastSeen ? '未命名模型' : '等待模型');
    const client = agentIdentity.client ? `${agentIdentity.client} · ` : '';
    el.bridgeNow.className = `bridge-now ${online ? 'online' : 'waiting'}`;
    el.bridgeNowName.textContent = model;
    el.bridgeNowSide.textContent = `${client}${agentSideLabel()} · ${online ? '在线' : agentIdentity.model ? '待命' : '等待接入'}`;
  }

  function touchAgent() {
    if (!agentMode) return;
    agentIdentity.lastSeen = Date.now();
  }

  function identifyAgent(input) {
    if (!agentMode) return { ok: false, error: 'agent mode disabled' };
    const source = typeof input === 'string' ? { model: input } : (input || {});
    const rawModel = source.model != null ? source.model : source.name;
    const model = typeof rawModel === 'string' ? rawModel.trim().slice(0, 32) : '';
    const client = typeof source.client === 'string' ? source.client.trim().slice(0, 24) : '';
    if (!model && !client) return { ok: false, error: 'model or client required' };
    if (model) agentIdentity.model = model;
    if (client) agentIdentity.client = client;
    agentIdentity.lastSeen = Date.now();
    renderBridgeBadge();
    return {
      ok: true,
      model: agentIdentity.model,
      client: agentIdentity.client,
      sides: agentSides.slice()
    };
  }

  function heartbeatAgent() {
    if (!agentMode) return { ok: false, error: 'agent mode disabled' };
    agentIdentity.lastSeen = Date.now();
    renderBridgeBadge();
    return { ok: true, at: agentIdentity.lastSeen };
  }

  function defaultBridgeSide() {
    return agentSides.length === 1 ? agentSides[0] : 0;
  }

  function bridgeStatus() {
    const phase = !state ? 'init' : drawPending ? 'draw' : state.over ? 'over' : 'play';
    const turn = state && !drawPending ? D.playerToMove(state) : null;
    const ready = Boolean(state && !state.over && !drawPending && !busy);
    return {
      bridge: true,
      debug: bridgeDebug,
      agent: agentMode,
      model: agentIdentity.model,
      client: agentIdentity.client,
      sides: agentSides.slice(),
      phase,
      seq: bridgeSeq,
      turn,
      first: state && (!drawPending || drawSettled) ? state.first : null,
      over: state ? state.over : false,
      drawPending,
      drawSettled,
      busy,
      canSubmit: ready && agentSides.includes(turn)
    };
  }

  function bridgeView(side) {
    if (!state) return null;
    const p = (side == null ? defaultBridgeSide() : side) === 1 ? 1 : 0;
    const info = D.goalInfo(state, p);
    const other = state.over ? D.goalInfo(state, 1 - p) : null;
    const goal = D.GOALS[state.goals[p]];
    const seq = [];
    let completion = null;
    for (let i = 0; i < state.claims[p].length; i++) {
      seq.push(state.claims[p][i]);
      if (goal.check(seq, state.claims[1 - p], state.values)) {
        completion = i + 1;
        break;
      }
    }
    return {
      side: p,
      phase: drawPending ? 'draw' : state.over ? 'over' : 'play',
      turn: drawPending ? null : D.playerToMove(state),
      first: !drawPending || drawSettled ? state.first : null,
      over: state.over,
      values: state.values.slice(),
      owner: state.owner.slice(),
      claims: [state.claims[0].slice(), state.claims[1].slice()],
      sums: [D.sumOf(state.claims[0], state.values), D.sumOf(state.claims[1], state.values)],
      moves: state.moves.map(move => ({ p: move.p, cell: move.cell })),
      empty: D.emptyIndices(state),
      goal: {
        id: info.id,
        name: info.name,
        en: info.en,
        desc: info.desc,
        met: info.met,
        progress: info.ratio,
        text: info.text,
        feasible: info.feasible,
        completion
      },
      otherGoal: other ? {
        id: other.id,
        name: other.name,
        en: other.en,
        desc: other.desc,
        met: other.met,
        progress: other.ratio,
        text: other.text,
        feasible: other.feasible
      } : null,
      initiative: drawSettled || !drawPending
        ? {
            cards: state.initiative.cards.slice(),
            humanPick: state.initiative.pick,
            yourCard: state.initiative.cards[p === 0 ? state.initiative.pick : 1 - state.initiative.pick],
            theirCard: state.initiative.cards[p === 0 ? 1 - state.initiative.pick : state.initiative.pick]
          }
        : { revealed: false }
    };
  }

  function bridgeInfer(side) {
    if (!state) return null;
    const p = (side == null ? defaultBridgeSide() : side) === 1 ? 1 : 0;
    return D.inferGoals(state, p)
      .map(row => ({ goal: row.goal, name: D.GOALS[row.goal].name, p: row.p }))
      .sort((a, b) => b.p - a.p);
  }

  function bridgeRules() {
    return {
      size: D.SIZE,
      claims: D.CLAIMS,
      tieRule: 'sum-handicap',
      tieHandicap: D.TIE_HANDICAP,
      endEarlyWhenBothMet: true,
      initiative: '抽两张不同点数的暗牌，选一张；点数大的一方先手。',
      information: '目标池公开；你只知道自己的目标，对手目标在其余 11 张之中。',
      goals: D.GOAL_IDS.map(id => {
        const goal = D.GOALS[id];
        return { id, name: goal.name, en: goal.en, desc: goal.desc };
      }),
      resolution: [
        { id: 'sole', text: '只有一方达成自己的指令：该方获胜。' },
        { id: 'both', text: '双方都达成时对局立即结束；手数更少者获胜。' },
        {
          id: 'same-hand',
          text: `双方都达成且手数相同：比较数字总和，后手补 ${D.TIE_HANDICAP} 点；补点后更高者胜，仍相同则平局。`
        },
        { id: 'none', text: '双方都未达成：完成度更高者获胜。' },
        {
          id: 'none-tie',
          text: '双方都未达成且完成度相同：比较数字总和（不加补点）；更高者胜，仍相同则平局。'
        }
      ]
    };
  }

  function bridgeFull() {
    if (bridgeDebug !== 'full') return { ok: false, error: 'requires ?debug=full' };
    if (!state) return { ok: false, error: 'no game' };
    return {
      ok: true,
      state: JSON.parse(JSON.stringify(state)),
      evaluate: D.evaluate(state),
      goals: state.goals.slice(),
      goalInfo: [D.goalInfo(state, 0), D.goalInfo(state, 1)],
      infer: [bridgeInfer(0), bridgeInfer(1)]
    };
  }

  function bridgeSubmit(cell) {
    if (!agentMode) return { ok: false, error: 'agent mode disabled; use ?agent=you|foe|both' };
    if (!state) return { ok: false, error: 'no game' };
    if (state.over || drawPending) return { ok: false, error: 'game not in play' };
    if (busy) return { ok: false, error: 'game busy' };
    const turn = D.playerToMove(state);
    if (!agentSides.includes(turn)) {
      return { ok: false, error: `side ${turn + 1} is not externally controlled` };
    }
    const index = Number(cell);
    if (!Number.isInteger(index) || index < 0 || index >= D.N) {
      return { ok: false, error: 'invalid cell' };
    }
    if (state.owner[index] !== -1) return { ok: false, error: 'cell occupied' };
    if (!D.applyMove(state, index)) return { ok: false, error: 'move rejected' };
    lastPlaced = index;
    Sfx.claim(turn);
    renderAll();
    const ended = checkEnd();
    if (!ended) scheduleAi();
    return {
      ok: true,
      side: turn,
      cell: index,
      over: state.over,
      turn: D.playerToMove(state)
    };
  }

  function bridgeChooseInitiative(pick) {
    if (!agentMode) return { ok: false, error: 'agent mode disabled' };
    if (!agentSides.includes(0)) {
      return { ok: false, error: 'initiative pick belongs to the human side' };
    }
    const index = Number(pick);
    if (!applyDrawPick(index)) return { ok: false, error: 'cannot pick now' };
    return { ok: true, pick: index };
  }

  function waitForBridgeUpdate(sinceSeq, timeoutMs) {
    if (!agentMode) return Promise.resolve({ ok: false, error: 'agent mode disabled' });
    const since = Number(sinceSeq) || 0;
    if (bridgeSeq > since) {
      return Promise.resolve({ ok: true, seq: bridgeSeq, at: Date.now(), ...bridgeStatus() });
    }
    const waitMs = Math.min(Math.max(Number(timeoutMs) || 30000, 1000), 120000);
    return new Promise(resolve => {
      const waiter = { resolve, beat: null, timer: null };
      waiter.beat = setInterval(() => {
        touchAgent();
        renderBridgeBadge();
      }, 5000);
      waiter.timer = setTimeout(() => {
        bridgeWaiters = bridgeWaiters.filter(item => item !== waiter);
        clearInterval(waiter.beat);
        resolve({ ok: false, timeout: true, seq: bridgeSeq, at: Date.now(), ...bridgeStatus() });
      }, waitMs);
      bridgeWaiters.push(waiter);
    });
  }

  function notifyBridge() {
    if (!bridgeEnabled) return;
    bridgeSeq += 1;
    const detail = { seq: bridgeSeq, at: Date.now(), ...bridgeStatus() };
    for (const waiter of bridgeWaiters.splice(0)) {
      clearInterval(waiter.beat);
      clearTimeout(waiter.timer);
      waiter.resolve({ ok: true, ...detail });
    }
    try {
      window.dispatchEvent(new CustomEvent('darkline:update', { detail }));
    } catch (error) {
      // Polling via window.__darkline remains available if CustomEvent is unavailable.
    }
  }

  function installBridge() {
    if (!bridgeEnabled) return;
    window.__darkline = {
      version: 1,
      status() {
        touchAgent();
        renderBridgeBadge();
        return bridgeStatus();
      },
      view(side) {
        touchAgent();
        renderBridgeBadge();
        return bridgeView(side);
      },
      infer(side) {
        touchAgent();
        renderBridgeBadge();
        return bridgeInfer(side);
      },
      rules() {
        touchAgent();
        renderBridgeBadge();
        return bridgeRules();
      },
      submit(cell) {
        touchAgent();
        const result = bridgeSubmit(cell);
        renderBridgeBadge();
        return result;
      },
      chooseInitiative(pick) {
        touchAgent();
        const result = bridgeChooseInitiative(pick);
        renderBridgeBadge();
        return result;
      },
      full() {
        touchAgent();
        renderBridgeBadge();
        return bridgeFull();
      },
      waitForUpdate(sinceSeq, timeoutMs) {
        touchAgent();
        renderBridgeBadge();
        return waitForBridgeUpdate(sinceSeq, timeoutMs);
      },
      identify: identifyAgent,
      heartbeat: heartbeatAgent
    };
    console.info('[darkline] bridge ready', {
      debug: bridgeDebug,
      agent: agentMode,
      sides: agentSides.slice()
    });
    if (agentMode) setInterval(renderBridgeBadge, 1000);
  }

  function populateEnd() {
    const ev = D.evaluate(state);
    const yi = D.goalInfo(state, 0);
    const fi = D.goalInfo(state, 1);
    const local = localMode;
    const p1 = local ? 'P1' : '你';
    const p2 = local ? 'P2' : '对手';
    el.endDialog.classList.toggle('is-p1', local && ev.winner === 0);
    el.endDialog.classList.toggle('is-p2', local && ev.winner === 1);

    el.verdictTitle.textContent = ev.winner === 0
      ? local ? 'P1 获胜' : '你赢了'
      : ev.winner === 1
        ? local ? 'P2 获胜' : '对手赢了'
        : '平局';
    const verdictClass = ev.winner === 0 ? 'win' : ev.winner === 1 ? (local ? 'p2' : 'lose') : 'draw';
    el.verdictTitle.className = `verdict-title ${verdictClass}`;
    el.verdictReason.textContent = verdictReason(ev);
    el.endYouLabel.textContent = p1;
    el.endFoeLabel.textContent = p2;
    el.readoutPanel.classList.toggle('hidden', local);

    el.endYourGoal.textContent = `「${yi.name}」`;
    el.endYourDesc.textContent = `${yi.desc}（${yi.text}）`;
    el.endYourMet.textContent = ev.met[0] ? '已达成' : '未达成';
    el.endYourMet.className = `met-badge${ev.met[0] ? '' : ' missed'}`;

    el.endFoeGoal.textContent = `「${fi.name}」`;
    el.endFoeDesc.textContent = `${fi.desc}（${fi.text}）`;
    el.endFoeMet.textContent = ev.met[1] ? '已达成' : '未达成';
    el.endFoeMet.className = `met-badge${ev.met[1] ? '' : ' missed'}`;

    const tiedCompletion = ev.met[0] && ev.met[1] && ev.completion[0] === ev.completion[1];
    const sumNote = tiedCompletion ? `（后手 +${D.TIE_HANDICAP}）` : '';
    const stats = [
      `<span>完成度 · ${p1} <b>${pct(ev.progress[0])}</b> / ${p2} <b>${pct(ev.progress[1])}</b></span>`,
      `<span>总和 · ${p1} <b>${ev.sums[0]}</b> / ${p2} <b>${ev.sums[1]}</b>${sumNote}</span>`
    ];
    if (ev.met[0] && ev.met[1]) {
      stats.splice(1, 0, `<span>完成手数 · ${p1} <b>${ev.completion[0]}</b> / ${p2} <b>${ev.completion[1]}</b></span>`);
    }
    el.verdictStats.innerHTML = stats.join('');

    const read = D.inferGoals(state, 1).sort((a, b) => b.p - a.p);
    const actual = state.goals[0];
    const top = read[0];
    el.readVerdict.textContent = top.goal === actual
      ? `命中 · 它押「${D.GOALS[actual].name}」`
      : `误判 · 它押「${D.GOALS[top.goal].name}」`;

    el.readoutBars.innerHTML = read.map((row, index) => {
      const g = D.GOALS[row.goal];
      const isActual = row.goal === actual;
      return `
        <div class="read-row${isActual ? ' actual' : ''}${index === 0 ? ' top' : ''}">
          <span class="read-name">${g.name}${isActual ? '<em>实际</em>' : ''}</span>
          <span class="read-track"><span style="width:${Math.max(2, Math.round(row.p * 100))}%"></span></span>
          <span class="read-pct">${Math.round(row.p * 100)}%</span>
        </div>
      `;
    }).join('');
  }

  function seatName(side) {
    return localMode ? `P${side + 1}` : side === 0 ? '你' : '对手';
  }

  function verdictReason(ev) {
    const p1 = seatName(0);
    const p2 = seatName(1);
    const gap = localMode ? ' ' : '';
    if (ev.reason === 'goal') {
      return `${seatName(ev.winner)}${gap}唯一达成「${D.GOALS[state.goals[ev.winner]].name}」。`;
    }
    if (ev.reason === 'speed') {
      return `双方都达成；${p1}${gap}用了 ${ev.completion[0]} 手，${p2}${gap}用了 ${ev.completion[1]} 手。`;
    }
    if (ev.reason === 'progress') {
      return `双方都未达成；${p1}${gap}完成 ${pct(ev.progress[0])}，${p2}${gap}完成 ${pct(ev.progress[1])}。`;
    }
    if (ev.reason === 'sum') {
      if (ev.met[0] && ev.met[1]) {
        const second = 1 - state.first;
        const firstSum = ev.sums[0] + (second === 0 ? D.TIE_HANDICAP : 0);
        const secondSum = ev.sums[1] + (second === 1 ? D.TIE_HANDICAP : 0);
        return `双方都达成且同为 ${ev.completion[0]} 手；总和裁定（后手 +${D.TIE_HANDICAP}）：${p1} ${firstSum}，${p2} ${secondSum}。`;
      }
      return `双方都未达成且完成度相同，进入总和裁定：${p1} ${ev.sums[0]}，${p2} ${ev.sums[1]}。`;
    }
    if (ev.met[0] && ev.met[1] && ev.completion[0] === ev.completion[1]) {
      const second = 1 - state.first;
      const firstSum = ev.sums[0] + (second === 0 ? D.TIE_HANDICAP : 0);
      const secondSum = ev.sums[1] + (second === 1 ? D.TIE_HANDICAP : 0);
      return `双方都达成且同为 ${ev.completion[0]} 手；后手 +${D.TIE_HANDICAP} 后总和仍为 ${firstSum} : ${secondSum}，判平局。`;
    }
    return '目标状态、完成度与总和全部相同。';
  }

  function pct(value) {
    return `${Math.round(value * 100)}%`;
  }

  function loadSeed() {
    const value = el.seedInput.value.trim();
    if (!value) {
      toast('先输入一串种子');
      el.seedInput.focus();
      return;
    }
    newGame(value);
    toast(`已载入种子 ${value}`);
  }

  async function copySeed() {
    if (!state) return;
    const seed = state.seed;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(seed);
        toast(`种子已复制：${seed}`);
        return;
      }
    } catch (error) {
      // Fall through to the legacy copy path.
    }

    const input = document.createElement('textarea');
    input.value = seed;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    input.remove();
    toast(copied ? `种子已复制：${seed}` : `种子：${seed}`);
  }

  function seedFromHash() {
    const match = location.hash.match(/[#&]seed=([^&]*)/);
    if (!match) return null;
    try {
      const value = decodeURIComponent(match[1]);
      return value || null;
    } catch (error) {
      return match[1] || null;
    }
  }

  function updateHash(seed) {
    const url = new URL(location.href);
    url.hash = `seed=${encodeURIComponent(seed)}`;
    if (url.href === location.href) return;
    try {
      history.replaceState(null, '', url.href);
    } catch (error) {
      // file:// pages can reject history writes; the seed stays visible and loadable.
    }
  }

  function toast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  function syncThemeUI() {
    const deepseek = document.documentElement.classList.contains('theme-deepseek');
    el.brandMark.setAttribute('aria-pressed', String(deepseek));
    el.brandMark.setAttribute('aria-label', deepseek ? '切回暗线主题' : '切换到 DeepSeek 主题');
    el.brandMark.title = deepseek ? '切回暗线主题' : '切换主题';
    el.brandSub.innerHTML = deepseek
      ? 'DEEPSEEK <span>/ WHALE PROTOCOL</span>'
      : 'DARKLINE <span>/ SECRET DIRECTIVE DUEL</span>';
    document.title = deepseek ? '暗线 · DEEPSEEK BLUE' : '暗线 · DARKLINE';
  }

  function setTheme(deepseek) {
    document.documentElement.classList.toggle('theme-deepseek', deepseek);
    try {
      localStorage.setItem(THEME_KEY, deepseek ? 'deepseek' : 'darkline');
    } catch (error) {
      // Theme still applies for this page when storage is unavailable.
    }
    syncThemeUI();
  }

  function toggleTheme() {
    if (themeBusy) return;
    const deepseek = !document.documentElement.classList.contains('theme-deepseek');
    const label = deepseek ? 'DEEPSEEK 蓝 · 鲸群已接入' : '已回到暗线';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    switchBgm(deepseek ? 1 : 0);

    if (!document.startViewTransition || reduceMotion) {
      setTheme(deepseek);
      toast(label);
      return;
    }

    const rect = el.brandMark.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    themeBusy = true;
    let transition;
    try {
      transition = document.startViewTransition(() => setTheme(deepseek));
    } catch (error) {
      themeBusy = false;
      setTheme(deepseek);
      toast(label);
      return;
    }

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 700,
          easing: 'cubic-bezier(0.55, 0, 0.25, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    }).catch(() => {});

    const done = () => {
      themeBusy = false;
      toast(label);
    };
    transition.finished.then(done, done);
  }

  function playFlipSfx() {
    const audio = el.sfxFlip;
    if (!audio || bgmMuted) return;
    try {
      audio.currentTime = 0;
      audio.volume = FLIP_VOLUME;
      const playback = audio.play();
      if (playback && playback.catch) playback.catch(() => {});
    } catch (error) {
      // Playback can fail before the first user gesture; the draw is silent then.
    }
  }

  function initBgm() {
    try {
      bgmMuted = localStorage.getItem(MUTE_KEY) === '1';
    } catch (error) {
      bgmMuted = false;
    }
    syncMuteUI();
    Sfx.setMuted(bgmMuted);
    if (!bgmTracks.length) return;
    bgmActive = document.documentElement.classList.contains('theme-deepseek') ? 1 : 0;
    for (const track of bgmTracks) {
      track.audio.loop = true;
      track.audio.volume = 0;
    }
    document.addEventListener('click', startBgmFromGesture);
    document.addEventListener('keydown', startBgmFromGesture);
  }

  function syncMuteUI() {
    if (!el.muteBtn) return;
    el.muteBtn.setAttribute('aria-pressed', String(bgmMuted));
    el.muteBtn.setAttribute('aria-label', bgmMuted ? '恢复声音' : '静音声音');
    el.muteBtn.title = bgmMuted ? '恢复声音' : '静音声音';
  }

  function toggleMute() {
    bgmMuted = !bgmMuted;
    try {
      localStorage.setItem(MUTE_KEY, bgmMuted ? '1' : '0');
    } catch (error) {
      // Mute still applies for this page when storage is unavailable.
    }
    syncMuteUI();
    Sfx.setMuted(bgmMuted);
    if (!bgmMuted) Sfx.unlock();
    if (bgmTracks.length) {
      if (bgmMuted) {
        for (const track of bgmTracks) {
          if (!track.audio.paused) fadeBgm(track, 0, BGM_FADE_OUT);
        }
      } else {
        playBgmTrack(bgmActive, BGM_FADE_IN);
      }
    }
    toast(bgmMuted ? '声音已静音' : '声音已恢复');
  }

  function removeBgmStart() {
    document.removeEventListener('click', startBgmFromGesture);
    document.removeEventListener('keydown', startBgmFromGesture);
  }

  function startBgmFromGesture() {
    if (bgmMuted) return;
    Sfx.unlock();
    if (bgmStarted) {
      removeBgmStart();
      return;
    }
    playBgmTrack(bgmActive, BGM_FADE_IN);
  }

  function fadeBgm(track, target, duration) {
    cancelAnimationFrame(track.raf);
    const audio = track.audio;
    const from = audio.volume;
    const startedAt = performance.now();
    const step = now => {
      const ratio = Math.min(1, (now - startedAt) / duration);
      audio.volume = from + (target - from) * ratio;
      if (ratio < 1) {
        track.raf = requestAnimationFrame(step);
      } else if (target === 0) {
        audio.pause();
      }
    };
    track.raf = requestAnimationFrame(step);
  }

  function playBgmTrack(index, duration) {
    const track = bgmTracks[index];
    if (!track || bgmMuted) return;
    const audio = track.audio;
    bgmStarted = true;
    const settled = () => {
      if (bgmActive !== index) {
        audio.pause();
        audio.volume = 0;
        return;
      }
      fadeBgm(track, BGM_VOLUME, duration);
      preloadBgmOther(index);
      removeBgmStart();
    };
    if (audio.paused) {
      audio.volume = 0;
      let attempt;
      try {
        attempt = audio.play();
      } catch (error) {
        bgmStarted = false;
        return;
      }
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(settled).catch(() => {
          bgmStarted = false;
        });
      } else {
        settled();
      }
    } else {
      settled();
    }
  }

  function preloadBgmOther(index) {
    const otherIndex = 1 - index;
    const audio = bgmTracks[otherIndex].audio;
    if (!audio.paused || audio.readyState > 0) return;
    clearTimeout(bgmPreloadTimers[otherIndex]);
    bgmPreloadTimers[otherIndex] = setTimeout(() => {
      if (audio.paused && audio.readyState === 0) audio.load();
    }, 2500);
  }

  function switchBgm(index) {
    if (!bgmTracks.length) return;
    const target = index === 1 ? 1 : 0;
    if (target === bgmActive) {
      if (!bgmStarted && !bgmMuted) playBgmTrack(target, BGM_FADE_IN);
      return;
    }
    const previous = bgmTracks[bgmActive];
    if (!previous.audio.paused) fadeBgm(previous, 0, BGM_FADE_OUT);
    bgmActive = target;
    if (!bgmMuted) playBgmTrack(target, BGM_FADE_IN);
  }

  function syncModeUI() {
    el.modeBtn.classList.toggle('hidden', Boolean(agentMode));
    el.modeBtn.setAttribute('aria-pressed', String(localMode));
    el.modeBtn.title = localMode ? '切回人机对局（会开始新局）' : '开启同屏双人（会开始新局）';
    el.modeBtn.setAttribute('aria-label', localMode ? '切回人机对局' : '开启同屏双人');
    document.documentElement.classList.toggle('local-mode', localMode);
  }

  function toggleMode() {
    if (agentMode) return;
    const next = !localMode;
    const inProgress = Boolean(state && !state.over && state.moves.length > 0);
    if (inProgress && !window.confirm('切换对局模式会开始新的一局，继续？')) return;
    localMode = next;
    syncModeUI();
    newGame(D.newSeed());
    toast(localMode ? '同屏双人 · 交接后查看指令' : '已切回人机对局');
  }

  function wire() {
    el.brandMark.addEventListener('click', toggleTheme);
    el.modeBtn.addEventListener('click', toggleMode);
    if (el.muteBtn) el.muteBtn.addEventListener('click', toggleMute);

    el.board.addEventListener('click', event => {
      const cell = event.target.closest('.cell');
      if (!cell) return;
      onCell(Number(cell.dataset.i));
    });

    el.rulesBtn.addEventListener('click', () => {
      if (!el.rulesDialog.open) el.rulesDialog.showModal();
    });

    document.querySelectorAll('[data-close-rules]').forEach(button => {
      button.addEventListener('click', () => el.rulesDialog.close());
    });

    el.rulesDialog.addEventListener('click', event => {
      if (event.target === el.rulesDialog) el.rulesDialog.close();
    });

    el.endDialog.addEventListener('click', event => {
      if (event.target === el.endDialog) el.endDialog.close();
    });

    el.closeEndBtn.addEventListener('click', () => el.endDialog.close());
    el.endInspectBtn.addEventListener('click', () => el.endDialog.close());
    el.resultBtn.addEventListener('click', showEnd);

    el.drawCards.forEach(card => card.addEventListener('click', pickDraw));
    el.drawDialog.addEventListener('cancel', event => {
      event.preventDefault();
    });

    el.handoffBtn.addEventListener('click', confirmHandoff);
    el.handoffDialog.addEventListener('cancel', event => {
      event.preventDefault();
    });

    el.historyBtn.addEventListener('click', () => {
      renderHistory();
      if (!el.historyDialog.open) el.historyDialog.showModal();
    });
    document.querySelectorAll('[data-close-history]').forEach(button => {
      button.addEventListener('click', () => el.historyDialog.close());
    });
    el.historyDialog.addEventListener('click', event => {
      if (event.target === el.historyDialog) el.historyDialog.close();
    });
    el.clearHistoryBtn.addEventListener('click', clearHistory);
    el.historyList.addEventListener('click', event => {
      const item = event.target.closest('.history-item');
      if (!item) return;
      const seed = item.dataset.seed;
      el.historyDialog.close();
      if (!agentMode) {
        localMode = item.dataset.mode === 'local';
        syncModeUI();
      }
      newGame(seed);
    });

    el.bridgeStatusBtn.addEventListener('click', () => {
      renderBridgeNow();
      if (!el.bridgeDialog.open) el.bridgeDialog.showModal();
    });
    document.querySelectorAll('[data-close-bridge]').forEach(button => {
      button.addEventListener('click', () => el.bridgeDialog.close());
    });
    el.bridgeDialog.addEventListener('click', event => {
      if (event.target === el.bridgeDialog) el.bridgeDialog.close();
    });

    el.copyBtn.addEventListener('click', copySeed);
    el.loadSeedBtn.addEventListener('click', loadSeed);
    el.seedInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadSeed();
      }
    });

    el.replayBtn.addEventListener('click', () => newGame(state.seed));
    el.newBtn.addEventListener('click', () => newGame(D.newSeed()));
    el.endReplayBtn.addEventListener('click', () => newGame(state.seed));
    el.endNewBtn.addEventListener('click', () => newGame(D.newSeed()));

    window.addEventListener('hashchange', () => {
      const seed = seedFromHash();
      if (seed && state && seed !== state.seed) newGame(seed);
    });

    window.addEventListener('resize', syncPoolOverflow);
  }

  installBridge();
  init();
})();
