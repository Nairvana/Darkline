(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Darkline = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIZE = 4;
  const N = SIZE * SIZE;
  const CLAIMS = 5;
  const TIE_HANDICAP = 3;
  const CORNERS = [0, 3, 12, 15];
  const AI = {
    complete: 1.8,
    defense: 1.05,
    denyBase: 0.85,
    denyProgress: 1.15,
    denyLate: 0.35,
    denyComplete: 1.7,
    denyKill: 1.0,
    value: 0.04,
    noise: 0.05,
    look: 4.0,
    tie: 0.4
  };
  const COORDS = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) COORDS.push('ABCD'[c] + (r + 1));
  }
  const BLOCKS = [];
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      BLOCKS.push([
        r * SIZE + c,
        r * SIZE + c + 1,
        (r + 1) * SIZE + c,
        (r + 1) * SIZE + c + 1
      ]);
    }
  }
  const ROWS = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push(r * SIZE + c);
    ROWS.push(row);
  }
  const COLS = [];
  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = 0; r < SIZE; r++) col.push(r * SIZE + c);
    COLS.push(col);
  }
  const LINES = ROWS.concat(COLS);
  const EDGES = [
    [0, 1, 2, 3],
    [3, 7, 11, 15],
    [12, 13, 14, 15],
    [0, 4, 8, 12]
  ];
  const RIM_BLOCKS = BLOCKS.filter(block => block.some(i => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    return r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
  }));
  const CENTER_LINES = [
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [1, 5, 9, 13],
    [2, 6, 10, 14]
  ];
  const SHORT_DIAGS = [
    [1, 6, 11],
    [4, 9, 14],
    [2, 5, 8],
    [7, 10, 13]
  ];

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^ (h >>> 16)) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    return xmur3(String(str))();
  }

  function rngFor(seed, salt) {
    return mulberry32(hashString(seed + '|' + salt));
  }

  function valueCounts(cells, values) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const i of cells) counts[values[i]]++;
    return counts;
  }

  function countWhere(cells, fn) {
    let n = 0;
    for (const i of cells) if (fn(i)) n++;
    return n;
  }

  function bestLive(lines, mine, opp, maxOpp) {
    let best = 0;
    for (const line of lines) {
      if (countWhere(line, i => opp.includes(i)) > maxOpp) continue;
      const k = countWhere(line, i => mine.includes(i));
      if (k > best) best = k;
    }
    return best;
  }

  function anyLive(lines, opp, maxOpp) {
    return lines.some(line => countWhere(line, i => opp.includes(i)) <= maxOpp);
  }

  function liveProgress(lines, mine, opp, maxOpp, need) {
    return Math.min(1, bestLive(lines, mine, opp, maxOpp) / need);
  }

  function liveText(lines, mine, opp, maxOpp, need) {
    return `${Math.min(need, bestLive(lines, mine, opp, maxOpp))}/${need}`;
  }

  function sameLinePair(cells, values, value) {
    const set = new Set(cells.filter(i => values[i] === value));
    for (const line of LINES) {
      let n = 0;
      for (const i of line) if (set.has(i)) n++;
      if (n >= 2) return true;
    }
    return false;
  }

  function canRainbow(mine, opp, values) {
    const have = new Set(mine.map(i => values[i]));
    for (let v = 1; v <= 4; v++) {
      if (have.has(v)) continue;
      let available = false;
      for (let i = 0; i < N; i++) {
        if (!opp.includes(i) && values[i] === v) {
          available = true;
          break;
        }
      }
      if (!available) return false;
    }
    for (let v = 1; v <= 4; v++) {
      let available = 0;
      for (let i = 0; i < N; i++) {
        if (!opp.includes(i) && values[i] === v) available++;
      }
      if (available >= 2) return true;
    }
    return false;
  }

  function canLinkLine(mine, opp, values) {
    const allowed = [];
    for (let i = 0; i < N; i++) if (!opp.includes(i)) allowed.push(i);
    for (let v = 1; v <= 4; v++) {
      const cells = allowed.filter(i => values[i] === v);
      if (cells.length >= 3 && sameLinePair(cells, values, v)) return true;
    }
    return false;
  }

  function availableCounts(opp, values) {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < N; i++) {
      if (!opp.includes(i)) c[values[i]]++;
    }
    return c;
  }

  function canTrio(opp, values) {
    const c = availableCounts(opp, values);
    return c[1] >= 3 || c[2] >= 3 || c[3] >= 3 || c[4] >= 3;
  }

  function eq4Valid(cells, values) {
    const [a, b, c, d] = cells;
    return values[a] + values[b] === values[c] + values[d] ||
      values[a] + values[c] === values[b] + values[d] ||
      values[a] + values[d] === values[b] + values[c];
  }

  function eq4Best(pool, mine, values) {
    let best = 0;
    for (let i = 0; i < pool.length - 3; i++) {
      for (let j = i + 1; j < pool.length - 2; j++) {
        for (let k = j + 1; k < pool.length - 1; k++) {
          for (let l = k + 1; l < pool.length; l++) {
            const cells = [pool[i], pool[j], pool[k], pool[l]];
            if (!eq4Valid(cells, values)) continue;
            const owned = cells.filter(x => mine.includes(x)).length;
            if (owned > best) best = owned;
          }
        }
      }
    }
    return best;
  }

  function eq4Any(opp, values) {
    const pool = [];
    for (let i = 0; i < N; i++) if (!opp.includes(i)) pool.push(i);
    for (let i = 0; i < pool.length - 3; i++) {
      for (let j = i + 1; j < pool.length - 2; j++) {
        for (let k = j + 1; k < pool.length - 1; k++) {
          for (let l = k + 1; l < pool.length; l++) {
            if (eq4Valid([pool[i], pool[j], pool[k], pool[l]], values)) return true;
          }
        }
      }
    }
    return false;
  }

  const GOALS = {
    square: {
      id: 'square',
      name: '方阵',
      en: 'SQUARE',
      desc: '2×2 中占至少 3 格',
      check(mine) {
        return BLOCKS.some(block => countWhere(block, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(BLOCKS, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(BLOCKS, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(BLOCKS, opp, 1);
      }
    },
    row3: {
      id: 'row3',
      name: '横断',
      en: 'ROW',
      desc: '同一行占至少 3 格',
      check(mine) {
        return ROWS.some(row => countWhere(row, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(ROWS, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(ROWS, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(ROWS, opp, 1);
      }
    },
    col3: {
      id: 'col3',
      name: '纵贯',
      en: 'COLUMN',
      desc: '同一列占至少 3 格',
      check(mine) {
        return COLS.some(col => countWhere(col, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(COLS, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(COLS, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(COLS, opp, 1);
      }
    },
    edge: {
      id: 'edge',
      name: '边路',
      en: 'EDGE',
      desc: '同一条外边占至少 3 格',
      check(mine) {
        return EDGES.some(edge => countWhere(edge, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(EDGES, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(EDGES, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(EDGES, opp, 1);
      }
    },
    rim: {
      id: 'rim',
      name: '边阵',
      en: 'RIM',
      desc: '贴边的 2×2 占至少 3 格',
      check(mine) {
        return RIM_BLOCKS.some(block => countWhere(block, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(RIM_BLOCKS, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(RIM_BLOCKS, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(RIM_BLOCKS, opp, 1);
      }
    },
    axis: {
      id: 'axis',
      name: '中轴',
      en: 'AXIS',
      desc: '中两行/列占至少 3 格',
      check(mine) {
        return CENTER_LINES.some(line => countWhere(line, i => mine.includes(i)) >= 3);
      },
      progress(mine, opp) {
        return liveProgress(CENTER_LINES, mine, opp, 1, 3);
      },
      progressText(mine, opp) {
        return liveText(CENTER_LINES, mine, opp, 1, 3);
      },
      feasible(mine, opp) {
        return anyLive(CENTER_LINES, opp, 1);
      }
    },
    link: {
      id: 'link',
      name: '连三',
      en: 'LINK',
      desc: '3 个同数格，含同行一对',
      check(mine, opp, values) {
        for (let v = 1; v <= 4; v++) {
          if (countWhere(mine, i => values[i] === v) >= 3 && sameLinePair(mine, values, v)) {
            return true;
          }
        }
        return false;
      },
      progress(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canLinkLine(mine, opp, values)) return 0;
        let best = 0;
        for (let v = 1; v <= 4; v++) {
          const c = countWhere(mine, i => values[i] === v);
          const same = sameLinePair(mine, values, v);
          best = Math.max(best, 0.5 * Math.min(3, c) / 3 + 0.5 * (same ? 1 : 0));
        }
        return Math.min(1, best);
      },
      progressText(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canLinkLine(mine, opp, values)) return '0/3';
        let best = 0;
        for (let v = 1; v <= 4; v++) {
          best = Math.max(best, countWhere(mine, i => values[i] === v));
        }
        return `${Math.min(3, best)}/3`;
      },
      feasible(mine, opp, empty, values) {
        return canLinkLine(mine, opp, values);
      }
    },
    rainbow: {
      id: 'rainbow',
      name: '全谱',
      en: 'RAINBOW',
      desc: '集齐 4 种数字并成对',
      check(mine, opp, values) {
        const c = valueCounts(mine, values);
        return Object.values(c).every(n => n > 0) && Math.max(...Object.values(c)) >= 2;
      },
      progress(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canRainbow(mine, opp, values)) return 0;
        const c = valueCounts(mine, values);
        const distinct = Object.values(c).filter(n => n > 0).length;
        const pair = Object.values(c).some(n => n >= 2);
        return Math.min(1, 0.5 * (distinct / 4) + 0.5 * (pair ? 1 : 0));
      },
      progressText(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canRainbow(mine, opp, values)) return '0/4';
        const c = valueCounts(mine, values);
        const distinct = Object.values(c).filter(n => n > 0).length;
        const pair = Object.values(c).some(n => n >= 2);
        return `${distinct}/4${pair ? '·对' : ''}`;
      },
      feasible(mine, opp, empty, values) {
        return canRainbow(mine, opp, values);
      }
    },
    shortdiag: {
      id: 'shortdiag',
      name: '短斜',
      en: 'SHORT DIAGONAL',
      desc: '一条短斜线占满 3 格',
      check(mine) {
        return SHORT_DIAGS.some(d => countWhere(d, i => mine.includes(i)) === d.length);
      },
      progress(mine, opp) {
        return liveProgress(SHORT_DIAGS, mine, opp, 0, 3);
      },
      progressText(mine, opp) {
        return liveText(SHORT_DIAGS, mine, opp, 0, 3);
      },
      feasible(mine, opp) {
        return anyLive(SHORT_DIAGS, opp, 0);
      }
    },
    corners: {
      id: 'corners',
      name: '三足',
      en: 'CORNERS',
      desc: '四个角占至少 3 个',
      check(mine) {
        return countWhere(CORNERS, i => mine.includes(i)) >= 3;
      },
      progress(mine, opp) {
        if (!this.check(mine) && countWhere(CORNERS, i => opp.includes(i)) >= 2) return 0;
        return Math.min(1, countWhere(CORNERS, i => mine.includes(i)) / 3);
      },
      progressText(mine, opp) {
        if (!this.check(mine) && countWhere(CORNERS, i => opp.includes(i)) >= 2) return '0/3';
        return `${Math.min(3, countWhere(CORNERS, i => mine.includes(i)))}/3`;
      },
      feasible(mine, opp) {
        return countWhere(CORNERS, i => !opp.includes(i)) >= 3;
      }
    },
    trio: {
      id: 'trio',
      name: '三同',
      en: 'TRIO',
      desc: '至少 3 个相同数字',
      check(mine, opp, values) {
        return Math.max(...Object.values(valueCounts(mine, values))) >= 3;
      },
      progress(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canTrio(opp, values)) return 0;
        return Math.min(1, Math.max(...Object.values(valueCounts(mine, values))) / 3);
      },
      progressText(mine, opp, values) {
        if (!this.check(mine, opp, values) && !canTrio(opp, values)) return '0/3';
        return `${Math.min(3, Math.max(...Object.values(valueCounts(mine, values))))}/3`;
      },
      feasible(mine, opp, empty, values) {
        return canTrio(opp, values);
      }
    },
    eq4: {
      id: 'eq4',
      name: '配平',
      en: 'BALANCE',
      desc: '四格可分成两组，两组和相等',
      check(mine, opp, values) {
        return eq4Best(mine, mine, values) === 4;
      },
      progress(mine, opp, values) {
        if (!this.check(mine, opp, values) && !eq4Any(opp, values)) return 0;
        const pool = [];
        for (let i = 0; i < N; i++) if (!opp.includes(i)) pool.push(i);
        return Math.min(1, eq4Best(pool, mine, values) / 4);
      },
      progressText(mine, opp, values) {
        if (!this.check(mine, opp, values) && !eq4Any(opp, values)) return '0/4';
        const pool = [];
        for (let i = 0; i < N; i++) if (!opp.includes(i)) pool.push(i);
        return `${Math.min(4, eq4Best(pool, mine, values))}/4`;
      },
      feasible(mine, opp, empty, values) {
        return eq4Any(opp, values);
      }
    }
  };

  const GOAL_IDS = [
    'square',
    'row3',
    'col3',
    'edge',
    'rim',
    'axis',
    'link',
    'rainbow',
    'shortdiag',
    'corners',
    'trio',
    'eq4'
  ];

  function newSeed() {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return (a[0] >>> 0).toString(36).slice(0, 6).padStart(6, '0');
    }
    return Math.floor(Math.random() * 60466176).toString(36).padStart(6, '0');
  }

  function normalizeSeed(input) {
    if (input == null) return newSeed();
    const s = String(input).trim();
    return s || newSeed();
  }

  function createGame(seedInput) {
    const seed = normalizeSeed(seedInput);
    const rng = mulberry32(hashString(seed + '|deal'));
    const values = shuffle([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], rng);
    const goalOrder = shuffle(GOAL_IDS.slice(), rng);
    const drawRng = rngFor(seed, 'initiative');
    const cards = shuffle([1, 2, 3, 4], drawRng).slice(0, 2);
    const initiative = {
      cards,
      pick: 0,
      mine: cards[0],
      foe: cards[1]
    };
    return {
      seed,
      values,
      owner: new Array(N).fill(-1),
      claims: [[], []],
      goals: [goalOrder[0], goalOrder[1]],
      first: initiative.mine > initiative.foe ? 0 : 1,
      initiative,
      moves: [],
      over: false
    };
  }

  function resolveInitiative(state, pick) {
    if (!state || !state.initiative) return null;
    if (pick !== 0 && pick !== 1) return null;
    const cards = state.initiative.cards;
    state.initiative.pick = pick;
    state.initiative.mine = cards[pick];
    state.initiative.foe = cards[1 - pick];
    state.first = state.initiative.mine > state.initiative.foe ? 0 : 1;
    return {
      mine: state.initiative.mine,
      foe: state.initiative.foe,
      first: state.first
    };
  }

  function playerToMove(state) {
    if (!state || state.over) return null;
    return (state.first + state.moves.length) % 2;
  }

  function emptyIndices(state) {
    const out = [];
    for (let i = 0; i < N; i++) if (state.owner[i] === -1) out.push(i);
    return out;
  }

  function applyMove(state, cell) {
    if (!state || state.over) return false;
    if (!Number.isInteger(cell) || cell < 0 || cell >= N) return false;
    if (state.owner[cell] !== -1) return false;
    const p = playerToMove(state);
    state.owner[cell] = p;
    state.claims[p].push(cell);
    state.moves.push({ p, cell });
    if (state.moves.length >= CLAIMS * 2) {
      state.over = true;
    } else if (
      GOALS[state.goals[0]].check(state.claims[0], state.claims[1], state.values) &&
      GOALS[state.goals[1]].check(state.claims[1], state.claims[0], state.values)
    ) {
      state.over = true;
    }
    return true;
  }

  function sumOf(cells, values) {
    let total = 0;
    for (const i of cells) total += values[i];
    return total;
  }

  function goalInfo(state, p) {
    const id = state.goals[p];
    const g = GOALS[id];
    const mine = state.claims[p];
    const opp = state.claims[1 - p];
    const empty = emptyIndices(state);
    return {
      id,
      name: g.name,
      en: g.en,
      desc: g.desc,
      ratio: g.progress(mine, opp, state.values),
      text: g.progressText(mine, opp, state.values),
      met: g.check(mine, opp, state.values),
      feasible: g.feasible(mine, opp, empty, state.values)
    };
  }

  function completionClaim(state, p) {
    const g = GOALS[state.goals[p]];
    const mine = [];
    for (let used = 1; used <= state.claims[p].length; used++) {
      mine.push(state.claims[p][used - 1]);
      if (g.check(mine, state.claims[1 - p], state.values)) return used;
    }
    return null;
  }

  function evaluate(state) {
    const met = [0, 1].map(p =>
      GOALS[state.goals[p]].check(state.claims[p], state.claims[1 - p], state.values)
    );
    const sums = [0, 1].map(p => sumOf(state.claims[p], state.values));
    const progress = [0, 1].map(p =>
      GOALS[state.goals[p]].progress(state.claims[p], state.claims[1 - p], state.values)
    );
    const completion = [0, 1].map(p => (met[p] ? completionClaim(state, p) : null));
    let winner = null;
    let reason = 'draw';

    if (met[0] !== met[1]) {
      winner = met[0] ? 0 : 1;
      reason = 'goal';
    } else if (met[0] && met[1]) {
      if (completion[0] !== completion[1]) {
        winner = completion[0] < completion[1] ? 0 : 1;
        reason = 'speed';
      } else {
        // Equal claim count: the second player's sum gets a handicap before comparison.
        const second = 1 - state.first;
        const adjusted = [sums[0], sums[1]];
        adjusted[second] += tieHandicap;
        if (adjusted[0] !== adjusted[1]) {
          winner = adjusted[0] > adjusted[1] ? 0 : 1;
          reason = 'sum';
        }
      }
    } else if (Math.abs(progress[0] - progress[1]) > 1e-9) {
      winner = progress[0] > progress[1] ? 0 : 1;
      reason = 'progress';
    } else if (sums[0] !== sums[1]) {
      winner = sums[0] > sums[1] ? 0 : 1;
      reason = 'sum';
    }

    return { met, sums, progress, completion, winner, reason };
  }

  function softmax(xs) {
    const m = Math.max(...xs);
    const ys = xs.map(x => Math.exp(x - m));
    const total = ys.reduce((a, b) => a + b, 0) || 1;
    return ys.map(y => y / total);
  }

  function inferGoals(state, me) {
    const opp = 1 - me;
    const myGoalId = state.goals[me];
    const hyps = GOAL_IDS.filter(id => id !== myGoalId);
    const logs = hyps.map(() => 0);
    const mine = [];
    const theirs = [];
    for (const move of state.moves) {
      if (move.p === me) {
        mine.push(move.cell);
        continue;
      }
      const cell = move.cell;
      const myBase = GOALS[myGoalId].progress(mine, theirs, state.values);
      const myNext = GOALS[myGoalId].progress(mine.concat(cell), theirs, state.values);
      const myDelta = Math.max(0, myNext - myBase);
      for (let k = 0; k < hyps.length; k++) {
        const g = GOALS[hyps[k]];
        const base = g.progress(theirs, mine, state.values);
        const next = g.progress(theirs.concat(cell), mine, state.values);
        const delta = Math.max(0, next - base);
        // A move that mostly denies my goal says less about theirs.
        const adjusted = Math.max(0, delta - 0.3 * myDelta);
        const material = 0.035 * (state.values[cell] - 2.5);
        logs[k] += Math.log(Math.max(0.05, 0.3 + 2.8 * adjusted + material));
      }
      theirs.push(cell);
    }
    const probs = softmax(logs.map(x => x / 1.15));
    return hyps.map((goal, i) => ({ goal, p: probs[i] }));
  }

  let tieRule = 'sum-handicap';
  let tieHandicap = TIE_HANDICAP;

  function setTieRule(rule, handicap) {
    if (rule === 'second' || rule === 'sum' || rule === 'sum-handicap' || rule === 'first' || rule === 'draw') {
      tieRule = rule;
      tieHandicap = Number.isFinite(handicap) ? handicap : 0;
    }
  }

  function completionAt(goal, mine, opp, values) {
    const seq = [];
    for (let i = 0; i < mine.length; i++) {
      seq.push(mine[i]);
      if (goal.check(seq, opp, values)) return i + 1;
    }
    return null;
  }

  function positionValue(state, player, myGoalId, otherGoalId, mine, opp, values) {
    const myGoal = GOALS[myGoalId];
    const otherGoal = GOALS[otherGoalId];
    const metMine = myGoal.check(mine, opp, values);
    const metOther = otherGoal.check(opp, mine, values);

    if (metMine !== metOther) return metMine ? 1 : -1;
    if (metMine && metOther) {
      const cMine = completionAt(myGoal, mine, opp, values);
      const cOther = completionAt(otherGoal, opp, mine, values);
      if (cMine !== cOther) return cMine < cOther ? 1 : -1;
      if (tieRule === 'sum') {
        const sMine = sumOf(mine, values);
        const sOther = sumOf(opp, values);
        if (sMine !== sOther) return sMine > sOther ? 1 : -1;
      } else if (tieRule === 'sum-handicap') {
        const second = 1 - state.first;
        const sMine = sumOf(mine, values) + (player === second ? tieHandicap : 0);
        const sOther = sumOf(opp, values) + (player !== second ? tieHandicap : 0);
        if (sMine !== sOther) return sMine > sOther ? 1 : -1;
        return 0;
      } else if (tieRule === 'first') {
        return player === state.first ? 1 : -1;
      } else if (tieRule === 'draw') {
        return 0;
      }
      return player === 1 - state.first ? 1 : -1;
    }

    const pMine = myGoal.progress(mine, opp, values);
    const pOther = otherGoal.progress(opp, mine, values);
    if (Math.abs(pMine - pOther) > 1e-9) return 0.5 * (pMine - pOther);
    const sMine = sumOf(mine, values);
    const sOther = sumOf(opp, values);
    if (sMine !== sOther) return sMine > sOther ? 0.25 : -0.25;
    return 0;
  }

  function expectedOutcome(state, me, mine, opp, read, values) {
    let total = 0;
    let weight = 0;
    for (const r of read) {
      total += r.p * positionValue(state, me, state.goals[me], r.goal, mine, opp, values);
      weight += r.p;
    }
    return weight ? total / weight : 0;
  }

  function chooseAiMove(state, me) {
    if (!state || state.over || playerToMove(state) !== me) return null;
    const opp = 1 - me;
    const empty = emptyIndices(state);
    if (!empty.length) return null;

    const values = state.values;
    const myGoalId = state.goals[me];
    const myGoal = GOALS[myGoalId];
    const myC = state.claims[me];
    const opC = state.claims[opp];
    const met = myGoal.check(myC, opC, values);
    const feasible = myGoal.feasible(myC, opC, empty, values);
    const baseProgress = myGoal.progress(myC, opC, values);
    const read = inferGoals(state, me);
    const left = CLAIMS - myC.length;

    const rng = rngFor(state.seed, 'ai|' + me + '|' + state.moves.length);
    const second = me === 1 - state.first;
    const completeBonus = AI.complete + (second ? AI.tie : -AI.tie);
    const denyCompleteBonus = AI.denyComplete + (second ? -AI.tie * 0.5 : AI.tie);
    const scored = [];

    for (const cell of empty) {
      const emptyAfter = empty.filter(x => x !== cell);
      const completes = !met && feasible && myGoal.check(myC.concat(cell), opC, values);
      // Progress still matters when the goal is already impossible: it is the fallback verdict.
      const attack = met
        ? 0
        : Math.max(0, myGoal.progress(myC.concat(cell), opC, values) - baseProgress) +
          (completes ? completeBonus : 0);

      let defense = 0;
      for (const r of read) {
        const g = GOALS[r.goal];
        if (g.check(opC, myC, values)) continue;
        if (!g.feasible(opC, myC, empty, values)) continue;
        const before = g.progress(opC, myC, values);
        const after = g.progress(opC.concat(cell), myC, values);
        const delta = Math.max(0, after - before);
        let denial = delta * (AI.denyBase + AI.denyProgress * before + (left <= 2 ? AI.denyLate : 0));
        // Threshold effects matter more than raw progress: finish or kill it.
        if (g.check(opC.concat(cell), myC, values)) denial += denyCompleteBonus;
        else if (!g.feasible(opC, myC.concat(cell), emptyAfter, values)) denial += AI.denyKill;
        defense += r.p * denial;
      }

      const score =
        attack +
        AI.defense * defense +
        AI.value * (values[cell] / 4) +
        rng() * AI.noise;

      scored.push({ cell, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, 5);
    const topRead = read.slice().sort((a, b) => b.p - a.p).slice(0, 5);

    for (const cand of candidates) {
      const myAfter = myC.concat(cand.cell);
      const emptyAfter = empty.filter(x => x !== cand.cell);
      let aiValue;
      if (!emptyAfter.length) {
        aiValue = expectedOutcome(state, me, myAfter, opC, read, values);
      } else {
        let reply = null;
        let replyValue = -Infinity;
        for (const r of emptyAfter) {
          const oppAfter = opC.concat(r);
          let ev = 0;
          let weight = 0;
          for (const h of topRead) {
            ev += h.p * positionValue(state, opp, h.goal, state.goals[me], oppAfter, myAfter, values);
            weight += h.p;
          }
          ev = weight ? ev / weight : 0;
          if (ev > replyValue) {
            replyValue = ev;
            reply = r;
          }
        }
        aiValue = expectedOutcome(state, me, myAfter, opC.concat(reply), read, values);
      }
      cand.score += AI.look * aiValue;
    }

    let best = candidates[0];
    for (const cand of candidates) {
      if (cand.score > best.score) best = cand;
    }
    return best ? best.cell : empty[0];
  }

  return {
    SIZE,
    N,
    CLAIMS,
    TIE_HANDICAP,
    CORNERS,
    COORDS,
    GOALS,
    GOAL_IDS,
    AI,
    newSeed,
    createGame,
    resolveInitiative,
    playerToMove,
    emptyIndices,
    applyMove,
    sumOf,
    goalInfo,
    evaluate,
    inferGoals,
    chooseAiMove,
    setTieRule
  };
});
