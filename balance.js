'use strict';

const D = require('./engine.js');

const AI_CFG = process.env.AI_CFG ? JSON.parse(process.env.AI_CFG) : null;
if (AI_CFG) Object.assign(D.AI, AI_CFG);

const SIZE = D.SIZE;
const BLOCKS = [];
for (let r = 0; r < SIZE - 1; r++) {
  for (let c = 0; c < SIZE - 1; c++) {
    BLOCKS.push([r * SIZE + c, r * SIZE + c + 1, (r + 1) * SIZE + c, (r + 1) * SIZE + c + 1]);
  }
}
const QUADRANTS = [
  [0, 1, 4, 5],
  [2, 3, 6, 7],
  [8, 9, 12, 13],
  [10, 11, 14, 15]
];
const RIM_BLOCKS = BLOCKS.filter(block => block.some(i => {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  return r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
}));
const EDGE_BLOCKS = [
  [1, 2, 5, 6],
  [4, 5, 8, 9],
  [6, 7, 10, 11],
  [9, 10, 13, 14]
];
const CENTER = [5, 6, 9, 10];
const OPPOSITE = [[0, 15], [3, 12]];
const DIAGONALS = [[0, 5, 10, 15], [3, 6, 9, 12]];
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
const ADJACENT_CORNERS = [[0, 3], [0, 12], [3, 15], [12, 15]];
const SHORT_DIAGS = [[1, 6, 11], [4, 9, 14], [2, 5, 8], [7, 10, 13]];
const CENTER_LINES = [
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [1, 5, 9, 13],
  [2, 6, 10, 14]
];
const ALL_DIAGONALS = (() => {
  const map = new Map();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = r * SIZE + c;
      const a = 'd' + (r - c);
      const b = 's' + (r + c);
      if (!map.has(a)) map.set(a, []);
      if (!map.has(b)) map.set(b, []);
      map.get(a).push(i);
      map.get(b).push(i);
    }
  }
  return Array.from(map.values()).filter(line => line.length >= 3);
})();
const ORTHO_PAIRS = (() => {
  const out = [];
  for (let i = 0; i < D.N; i++) {
    for (const j of neighbors(i)) {
      if (j > i) out.push([i, j]);
    }
  }
  return out;
})();

function count(cells, fn) {
  let n = 0;
  for (const i of cells) if (fn(i)) n++;
  return n;
}

function hasAll(mine, cells) {
  return cells.every(i => mine.includes(i));
}

function counts(cells, values) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const i of cells) c[values[i]]++;
  return c;
}

const ALL_CELLS = Array.from({ length: D.N }, (_, i) => i);

function emptyOf(mine, opp) {
  return ALL_CELLS.filter(i => !mine.includes(i) && !opp.includes(i));
}

function fullhouseFeasible(mine, opp, values) {
  const c = counts(mine, values);
  const e = counts(emptyOf(mine, opp), values);
  for (let v = 1; v <= 4; v++) {
    if (c[v] + e[v] < 3) continue;
    for (let w = 1; w <= 4; w++) {
      if (w !== v && c[w] + e[w] >= 2) return true;
    }
  }
  return false;
}

function rainbowFeasible(mine, opp, values) {
  const empty = emptyOf(mine, opp);
  const have = new Set(mine.map(i => values[i]));
  for (let v = 1; v <= 4; v++) {
    if (!have.has(v) && !empty.some(i => values[i] === v)) return false;
  }
  const c = counts(mine, values);
  for (let v = 1; v <= 4; v++) {
    if (c[v] + count(empty, i => values[i] === v) >= 2) return true;
  }
  return false;
}

function pairsFeasible(mine, opp, values) {
  const c = counts(mine, values);
  const e = counts(emptyOf(mine, opp), values);
  let reachable = 0;
  for (let v = 1; v <= 4; v++) if (c[v] + e[v] >= 2) reachable++;
  return reachable >= 2;
}

function bestLive(lines, mine, opp, maxOpp) {
  let best = 0;
  for (const line of lines) {
    if (count(line, i => opp.includes(i)) > maxOpp) continue;
    best = Math.max(best, count(line, i => mine.includes(i)));
  }
  return best;
}

function anyLive(lines, opp, maxOpp) {
  return lines.some(line => count(line, i => opp.includes(i)) <= maxOpp);
}

function liveProgress(lines, mine, opp, maxOpp, need) {
  return Math.min(1, bestLive(lines, mine, opp, maxOpp) / need);
}

function liveText(lines, mine, opp, maxOpp, need) {
  return `${Math.min(need, bestLive(lines, mine, opp, maxOpp))}/${need}`;
}

function neighbors(i) {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out = [];
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

function componentSize(start, allowed, values) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.pop();
    for (const j of neighbors(i)) {
      if (seen.has(j) || !allowed.has(j) || values[j] !== values[start]) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen.size;
}

function bestChain(mine, opp, empty, values) {
  let bestMine = 0;
  const mineSet = new Set(mine);
  for (const i of mine) {
    if (componentSize(i, mineSet, values) > bestMine) bestMine = componentSize(i, mineSet, values);
  }
  let feasible = false;
  const allowed = new Set(mine.concat(empty));
  for (const i of allowed) {
    if (opp.includes(i)) continue;
    if (componentSize(i, allowed, values) >= 3) {
      feasible = true;
      break;
    }
  }
  return { bestMine, feasible };
}

function chainCheck(mine, opp, values) {
  const set = new Set(mine);
  for (const i of mine) {
    if (componentSize(i, set, values) >= 3) return true;
  }
  return false;
}

function blockPrism(mine, opp, values) {
  let best = 0;
  let feasible = false;
  for (const block of BLOCKS) {
    if (new Set(block.map(i => values[i])).size < 4) continue;
    if (block.some(i => opp.includes(i))) continue;
    feasible = true;
    best = Math.max(best, count(block, i => mine.includes(i)));
  }
  return { best, feasible };
}

const square3 = {
  id: 'square',
  name: '方阵',
  en: 'SQUARE',
  desc: '占据某个 2×2 中的至少 3 格',
  check(mine) {
    return BLOCKS.some(b => count(b, i => mine.includes(i)) >= 3);
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
};

const square4 = {
  id: 'square4',
  name: '实心',
  en: 'SOLID',
  desc: '占据一个完整的 2×2',
  check(mine) {
    return BLOCKS.some(b => hasAll(mine, b));
  },
  progress(mine, opp) {
    return liveProgress(BLOCKS, mine, opp, 0, 4);
  },
  progressText(mine, opp) {
    return liveText(BLOCKS, mine, opp, 0, 4);
  },
  feasible(mine, opp) {
    return anyLive(BLOCKS, opp, 0);
  }
};

const quadrant3 = {
  id: 'quadrant',
  name: '象限',
  en: 'QUADRANT',
  desc: '占据一个角区 2×2 中的至少 3 格',
  check(mine) {
    return QUADRANTS.some(q => count(q, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(QUADRANTS, mine, opp, 1, 3);
  },
  progressText(mine, opp) {
    return liveText(QUADRANTS, mine, opp, 1, 3);
  },
  feasible(mine, opp) {
    return anyLive(QUADRANTS, opp, 1);
  }
};

const center3 = {
  id: 'center',
  name: '中枢',
  en: 'CENTER',
  desc: '占据中心 2×2 的至少 3 格',
  check(mine) {
    return count(CENTER, i => mine.includes(i)) >= 3;
  },
  progress(mine, opp) {
    return liveProgress([CENTER], mine, opp, 1, 3);
  },
  progressText(mine, opp) {
    return liveText([CENTER], mine, opp, 1, 3);
  },
  feasible(mine, opp) {
    return anyLive([CENTER], opp, 1);
  }
};

const corners3 = {
  id: 'corners',
  name: '三足',
  en: 'CORNERS',
  desc: '占据至少 3 个角格',
  check(mine) {
    return count(D.CORNERS, i => mine.includes(i)) >= 3;
  },
  progress(mine, opp) {
    if (!this.check(mine) && count(D.CORNERS, i => opp.includes(i)) >= 2) return 0;
    return Math.min(1, count(D.CORNERS, i => mine.includes(i)) / 3);
  },
  progressText(mine, opp) {
    if (!this.check(mine) && count(D.CORNERS, i => opp.includes(i)) >= 2) return '0/3';
    return `${Math.min(3, count(D.CORNERS, i => mine.includes(i)))}/3`;
  },
  feasible(mine, opp) {
    return count(D.CORNERS, i => !opp.includes(i)) >= 3;
  }
};

const opposite2 = {
  id: 'opposite',
  name: '对穿',
  en: 'OPPOSITE',
  desc: '占据一对对角上的角格',
  check(mine) {
    return OPPOSITE.some(pair => hasAll(mine, pair));
  },
  progress(mine, opp) {
    return liveProgress(OPPOSITE, mine, opp, 0, 2);
  },
  progressText(mine, opp) {
    return liveText(OPPOSITE, mine, opp, 0, 2);
  },
  feasible(mine, opp) {
    return anyLive(OPPOSITE, opp, 0);
  }
};

const diagonal3 = {
  id: 'diagonal',
  name: '斜线',
  en: 'DIAGONAL',
  desc: '占据任意一条长对角线上的至少 3 格',
  check(mine) {
    return DIAGONALS.some(d => count(d, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(DIAGONALS, mine, opp, 1, 3);
  },
  progressText(mine, opp) {
    return liveText(DIAGONALS, mine, opp, 1, 3);
  },
  feasible(mine, opp) {
    return anyLive(DIAGONALS, opp, 1);
  }
};

const doublediag = {
  id: 'doublediag',
  name: '双斜',
  en: 'TWIN DIAGONALS',
  desc: '在两条长对角线上各占据至少 2 格',
  check(mine) {
    return DIAGONALS.every(d => count(d, i => mine.includes(i)) >= 2);
  },
  progress(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return 0;
    let n = 0;
    for (const d of DIAGONALS) n += Math.min(2, count(d, i => mine.includes(i)));
    return n / 4;
  },
  progressText(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return '0+0/4';
    const a = Math.min(2, count(DIAGONALS[0], i => mine.includes(i)));
    const b = Math.min(2, count(DIAGONALS[1], i => mine.includes(i)));
    return `${a}+${b}/4`;
  },
  feasible(mine, opp) {
    return DIAGONALS.every(d => count(d, i => !opp.includes(i)) >= 2);
  }
};

const doublediag4 = {
  id: 'doublediag4',
  name: '双斜',
  en: 'TWIN DIAGONALS',
  desc: '在两条长对角线上合计至少 4 格，且每条至少 1 格',
  check(mine) {
    const a = count(DIAGONALS[0], i => mine.includes(i));
    const b = count(DIAGONALS[1], i => mine.includes(i));
    return a >= 1 && b >= 1 && a + b >= 4;
  },
  progress(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return 0;
    const a = count(DIAGONALS[0], i => mine.includes(i));
    const b = count(DIAGONALS[1], i => mine.includes(i));
    const touch = (Math.min(1, a) + Math.min(1, b)) / 2;
    return Math.min(1, 0.5 * touch + 0.5 * Math.min(1, (a + b) / 4));
  },
  progressText(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return '0/4';
    const a = count(DIAGONALS[0], i => mine.includes(i));
    const b = count(DIAGONALS[1], i => mine.includes(i));
    return `${Math.min(4, a + b)}/4`;
  },
  feasible(mine, opp) {
    const avail = DIAGONALS.map(d => count(d, i => !opp.includes(i)));
    return avail[0] >= 1 && avail[1] >= 1 && avail[0] + avail[1] >= 4;
  }
};

const diagonal4 = {
  id: 'diagonal4',
  name: '贯斜',
  en: 'FULL DIAGONAL',
  desc: '占据一条完整的长对角线',
  check(mine) {
    return DIAGONALS.some(d => hasAll(mine, d));
  },
  progress(mine, opp) {
    return liveProgress(DIAGONALS, mine, opp, 0, 4);
  },
  progressText(mine, opp) {
    return liveText(DIAGONALS, mine, opp, 0, 4);
  },
  feasible(mine, opp) {
    return anyLive(DIAGONALS, opp, 0);
  }
};

const fullhouse = {
  id: 'fullhouse',
  name: '满堂',
  en: 'FULL HOUSE',
  desc: '拥有 3 个同数格和另外 2 个同数格',
  check(mine, opp, values) {
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return c[0] >= 3 && c[1] >= 2;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !fullhouseFeasible(mine, opp, values)) return 0;
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return Math.min(1, (Math.min(c[0], 3) + Math.min(c[1], 2)) / 5);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !fullhouseFeasible(mine, opp, values)) return '0+0';
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return `${Math.min(3, c[0])}+${Math.min(2, c[1])}`;
  },
  feasible(mine, opp, empty, values) {
    const c = counts(mine, values);
    const e = counts(empty, values);
    for (let v = 1; v <= 4; v++) {
      if (c[v] + e[v] < 3) continue;
      for (let w = 1; w <= 4; w++) {
        if (w !== v && c[w] + e[w] >= 2) return true;
      }
    }
    return false;
  }
};

const rainbow5 = {
  id: 'rainbow',
  name: '全谱',
  en: 'RAINBOW',
  desc: '集齐 4 种数字，且其中一种至少 2 格',
  check(mine, opp, values) {
    const c = counts(mine, values);
    return Object.values(c).every(n => n > 0) && Math.max(...Object.values(c)) >= 2;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !rainbowFeasible(mine, opp, values)) return 0;
    const c = counts(mine, values);
    const distinct = Object.values(c).filter(n => n > 0).length;
    const pair = Object.values(c).some(n => n >= 2);
    return Math.min(1, 0.5 * (distinct / 4) + 0.5 * (pair ? 1 : 0));
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !rainbowFeasible(mine, opp, values)) return '0/4';
    const c = counts(mine, values);
    const distinct = Object.values(c).filter(n => n > 0).length;
    const pair = Object.values(c).some(n => n >= 2);
    return `${distinct}/4${pair ? '·对' : ''}`;
  },
  feasible(mine, opp, empty, values) {
    const have = new Set(mine.map(i => values[i]));
    for (let v = 1; v <= 4; v++) {
      if (!have.has(v) && !empty.some(i => values[i] === v)) return false;
    }
    const c = counts(mine, values);
    for (let v = 1; v <= 4; v++) {
      if (c[v] + count(empty, i => values[i] === v) >= 2) return true;
    }
    return false;
  }
};

const prism = {
  id: 'prism',
  name: '虹块',
  en: 'PRISM',
  desc: '占据一个四色俱全的 2×2',
  check(mine, opp, values) {
    return BLOCKS.some(b => new Set(b.map(i => values[i])).size === 4 && hasAll(mine, b));
  },
  progress(mine, opp, values) {
    const p = blockPrism(mine, opp, values);
    return Math.min(1, p.best / 4);
  },
  progressText(mine, opp, values) {
    return `${blockPrism(mine, opp, values).best}/4`;
  },
  feasible(mine, opp, empty, values) {
    return blockPrism(mine, opp, values).feasible;
  }
};

const edgeblocks3 = {
  id: 'edgeblocks',
  name: '边块',
  en: 'EDGE BLOCKS',
  desc: '占据贴边中心的某个 2×2 中的至少 3 格',
  check(mine) {
    return EDGE_BLOCKS.some(b => count(b, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(EDGE_BLOCKS, mine, opp, 1, 3);
  },
  progressText(mine, opp) {
    return liveText(EDGE_BLOCKS, mine, opp, 1, 3);
  },
  feasible(mine, opp) {
    return anyLive(EDGE_BLOCKS, opp, 1);
  }
};

const rim3 = {
  id: 'rim3',
  name: '边阵',
  en: 'RIM',
  desc: '占据贴着外边的某个 2×2 中的至少 3 格',
  check(mine) {
    return RIM_BLOCKS.some(b => count(b, i => mine.includes(i)) >= 3);
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
};

const shortdiag = {
  id: 'shortdiag',
  name: '短斜',
  en: 'SHORT DIAGONAL',
  desc: '占据一条短斜线上的全部 3 格',
  check(mine) {
    return SHORT_DIAGS.some(d => hasAll(mine, d));
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
};

const centerline3 = {
  id: 'centerline',
  name: '中轴',
  en: 'AXIS',
  desc: '占据中间四行四列之一的至少 3 格',
  check(mine) {
    return CENTER_LINES.some(line => count(line, i => mine.includes(i)) >= 3);
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
};

const row3 = {
  id: 'row3',
  name: '横断',
  en: 'ROW',
  desc: '占据同一行中的至少 3 格',
  check(mine) {
    return ROWS.some(row => count(row, i => mine.includes(i)) >= 3);
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
};

const col3 = {
  id: 'col3',
  name: '纵贯',
  en: 'COLUMN',
  desc: '占据同一列中的至少 3 格',
  check(mine) {
    return COLS.some(col => count(col, i => mine.includes(i)) >= 3);
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
};

const line3 = {
  id: 'line3',
  name: '连线',
  en: 'LINE',
  desc: '占据同一行或列中的至少 3 格',
  check(mine) {
    return LINES.some(line => count(line, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(LINES, mine, opp, 1, 3);
  },
  progressText(mine, opp) {
    return liveText(LINES, mine, opp, 1, 3);
  },
  feasible(mine, opp) {
    return anyLive(LINES, opp, 1);
  }
};

function sameLinePair(cells, values, value) {
  const set = new Set(cells.filter(i => values[i] === value));
  for (const line of LINES) {
    let n = 0;
    for (const i of line) if (set.has(i)) n++;
    if (n >= 2) return true;
  }
  return false;
}

const linkLine = {
  id: 'linkline',
  name: '连三·线',
  en: 'LINE LINK',
  desc: '占据 3 个同数格，且其中两个在同行或同列',
  check(mine, opp, values) {
    for (let v = 1; v <= 4; v++) {
      if (count(mine, i => values[i] === v) >= 3 && sameLinePair(mine, values, v)) return true;
    }
    return false;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !linkLineFeasible(mine, opp, values)) return 0;
    let best = 0;
    for (let v = 1; v <= 4; v++) {
      const c = count(mine, i => values[i] === v);
      const same = sameLinePair(mine, values, v);
      best = Math.max(best, 0.5 * Math.min(3, c) / 3 + 0.5 * (same ? 1 : 0));
    }
    return Math.min(1, best);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !linkLineFeasible(mine, opp, values)) return '0/3';
    let best = 0;
    for (let v = 1; v <= 4; v++) best = Math.max(best, count(mine, i => values[i] === v));
    return `${Math.min(3, best)}/3`;
  },
  feasible(mine, opp, empty, values) {
    return linkLineFeasible(mine, opp, values);
  }
};

function linkLineFeasible(mine, opp, values) {
  const allowed = mine.concat(emptyOf(mine, opp));
  for (let v = 1; v <= 4; v++) {
    const cells = allowed.filter(i => values[i] === v);
    if (cells.length >= 3 && sameLinePair(cells, values, v)) return true;
  }
  return false;
}

const line4 = {
  id: 'line4',
  name: '长线',
  en: 'FULL LINE',
  desc: '占据一条完整的行或列',
  check(mine) {
    return LINES.some(line => hasAll(mine, line));
  },
  progress(mine, opp) {
    return liveProgress(LINES, mine, opp, 0, 4);
  },
  progressText(mine, opp) {
    return liveText(LINES, mine, opp, 0, 4);
  },
  feasible(mine, opp) {
    return anyLive(LINES, opp, 0);
  }
};

const edge3 = {
  id: 'edge',
  name: '边路',
  en: 'EDGE',
  desc: '占据同一条外边上的至少 3 格',
  check(mine) {
    return EDGES.some(edge => count(edge, i => mine.includes(i)) >= 3);
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
};

const chain3 = {
  id: 'chain',
  name: '连块',
  en: 'CHAIN',
  desc: '占据 3 个相连的同数格',
  check(mine, opp, values) {
    return chainCheck(mine, opp, values);
  },
  progress(mine, opp, values) {
    return Math.min(1, bestChain(mine, opp, [], values).bestMine / 3);
  },
  progressText(mine, opp, values) {
    return `${Math.min(3, bestChain(mine, opp, [], values).bestMine)}/3`;
  },
  feasible(mine, opp, empty, values) {
    return bestChain(mine, opp, empty, values).feasible;
  }
};

const trio3 = {
  id: 'trio',
  name: '复读',
  en: 'TRIO',
  desc: '占据至少 3 个相同数字',
  check(mine, opp, values) {
    return Math.max(...Object.values(counts(mine, values))) >= 3;
  },
  progress(mine, opp, values) {
    return Math.min(1, Math.max(...Object.values(counts(mine, values))) / 3);
  },
  progressText(mine, opp, values) {
    return `${Math.min(3, Math.max(...Object.values(counts(mine, values))))}/3`;
  },
  feasible(mine, opp, empty, values) {
    const c = counts(mine, values);
    const e = counts(empty, values);
    for (let v = 1; v <= 4; v++) if (c[v] + e[v] >= 3) return true;
    return false;
  }
};

const pairs2 = {
  id: 'pairs2',
  name: '双对',
  en: 'PAIRS',
  desc: '拥有两种数字，各至少 2 格',
  check(mine, opp, values) {
    return Object.values(counts(mine, values)).filter(n => n >= 2).length >= 2;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !pairsFeasible(mine, opp, values)) return 0;
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return Math.min(1, (Math.min(2, c[0]) + Math.min(2, c[1])) / 4);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !pairsFeasible(mine, opp, values)) return '0/2';
    return `${Object.values(counts(mine, values)).filter(n => n >= 2).length}/2`;
  },
  feasible(mine, opp, empty, values) {
    const c = counts(mine, values);
    const e = counts(empty, values);
    let reachable = 0;
    for (let v = 1; v <= 4; v++) if (c[v] + e[v] >= 2) reachable++;
    return reachable >= 2;
  }
};

function hasAdjacentSame(cells, values, value) {
  const set = new Set(cells);
  for (const [i, j] of ORTHO_PAIRS) {
    if (values[i] === value && values[j] === value && set.has(i) && set.has(j)) return true;
  }
  return false;
}

function adjacentValues(cells, values) {
  let n = 0;
  for (let v = 1; v <= 4; v++) if (hasAdjacentSame(cells, values, v)) n++;
  return n;
}

function twinValueProgress(cells, values, value) {
  const c = count(cells, i => values[i] === value);
  if (hasAdjacentSame(cells, values, value)) return 1;
  if (c >= 2) return 0.4;
  if (c >= 1) return 0.2;
  return 0;
}

const center2 = {
  id: 'center2',
  name: '双中',
  en: 'CENTER2',
  desc: '占据中心 2×2 的至少 2 格',
  check(mine) {
    return count(CENTER, i => mine.includes(i)) >= 2;
  },
  progress(mine, opp) {
    if (!this.check(mine) && count(CENTER, i => opp.includes(i)) >= 3) return 0;
    return Math.min(1, count(CENTER, i => mine.includes(i)) / 2);
  },
  progressText(mine, opp) {
    if (!this.check(mine) && count(CENTER, i => opp.includes(i)) >= 3) return '0/2';
    return `${Math.min(2, count(CENTER, i => mine.includes(i)))}/2`;
  },
  feasible(mine, opp) {
    return count(CENTER, i => !opp.includes(i)) >= 2;
  }
};

const corners2 = {
  id: 'corners2',
  name: '双角',
  en: 'CORNERS2',
  desc: '占据至少 2 个角格',
  check(mine) {
    return count(D.CORNERS, i => mine.includes(i)) >= 2;
  },
  progress(mine, opp) {
    if (!this.check(mine) && count(D.CORNERS, i => opp.includes(i)) >= 3) return 0;
    return Math.min(1, count(D.CORNERS, i => mine.includes(i)) / 2);
  },
  progressText(mine, opp) {
    if (!this.check(mine) && count(D.CORNERS, i => opp.includes(i)) >= 3) return '0/2';
    return `${Math.min(2, count(D.CORNERS, i => mine.includes(i)))}/2`;
  },
  feasible(mine, opp) {
    return count(D.CORNERS, i => !opp.includes(i)) >= 2;
  }
};

const corneradj = {
  id: 'corneradj',
  name: '邻角',
  en: 'ADJACENT CORNERS',
  desc: '占据一对相邻的角格',
  check(mine) {
    return ADJACENT_CORNERS.some(pair => hasAll(mine, pair));
  },
  progress(mine, opp) {
    return liveProgress(ADJACENT_CORNERS, mine, opp, 0, 2);
  },
  progressText(mine, opp) {
    return liveText(ADJACENT_CORNERS, mine, opp, 0, 2);
  },
  feasible(mine, opp) {
    return anyLive(ADJACENT_CORNERS, opp, 0);
  }
};

const diagall = {
  id: 'diagall',
  name: '斜网',
  en: 'DIAGONALS',
  desc: '占据任意一条斜线上的至少 3 格',
  check(mine) {
    return ALL_DIAGONALS.some(d => count(d, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    let best = 0;
    for (const d of ALL_DIAGONALS) {
      if (count(d, i => opp.includes(i)) > d.length - 3) continue;
      best = Math.max(best, count(d, i => mine.includes(i)));
    }
    return Math.min(1, best / 3);
  },
  progressText(mine, opp) {
    let best = 0;
    for (const d of ALL_DIAGONALS) {
      if (count(d, i => opp.includes(i)) > d.length - 3) continue;
      best = Math.max(best, count(d, i => mine.includes(i)));
    }
    return `${Math.min(3, best)}/3`;
  },
  feasible(mine, opp) {
    return ALL_DIAGONALS.some(d => count(d, i => opp.includes(i)) <= d.length - 3);
  }
};

const squareClean = {
  id: 'squarec',
  name: '净阵',
  en: 'CLEAN SQUARE',
  desc: '占据某个没有对手的 2×2 中的至少 3 格',
  check(mine, opp) {
    return BLOCKS.some(b => count(b, i => opp.includes(i)) === 0 &&
      count(b, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(BLOCKS, mine, opp, 0, 3);
  },
  progressText(mine, opp) {
    return liveText(BLOCKS, mine, opp, 0, 3);
  },
  feasible(mine, opp) {
    return anyLive(BLOCKS, opp, 0);
  }
};

const lineClean = {
  id: 'linec',
  name: '净线',
  en: 'CLEAN LINE',
  desc: '占据没有对手的一行或一列中的至少 3 格',
  check(mine, opp) {
    return LINES.some(line => count(line, i => opp.includes(i)) === 0 &&
      count(line, i => mine.includes(i)) >= 3);
  },
  progress(mine, opp) {
    return liveProgress(LINES, mine, opp, 0, 3);
  },
  progressText(mine, opp) {
    return liveText(LINES, mine, opp, 0, 3);
  },
  feasible(mine, opp) {
    return anyLive(LINES, opp, 0);
  }
};

const quad = {
  id: 'quad',
  name: '四条',
  en: 'FOUR OF A KIND',
  desc: '占据某个数字的全部 4 格',
  check(mine, opp, values) {
    return Math.max(...Object.values(counts(mine, values))) >= 4;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values)) {
      const oppC = counts(opp, values);
      if (!Object.keys(oppC).some(v => oppC[v] === 0)) return 0;
    }
    return Math.min(1, Math.max(...Object.values(counts(mine, values))) / 4);
  },
  progressText(mine, opp, values) {
    return `${Math.min(4, Math.max(...Object.values(counts(mine, values))))}/4`;
  },
  feasible(mine, opp, empty, values) {
    const oppC = counts(opp, values);
    for (let v = 1; v <= 4; v++) if (oppC[v] === 0) return true;
    return false;
  }
};

const link = {
  id: 'link',
  name: '连三',
  en: 'LINK',
  desc: '占据 3 个同数格，且其中有两个相邻',
  check(mine, opp, values) {
    for (let v = 1; v <= 4; v++) {
      if (count(mine, i => values[i] === v) >= 3 && hasAdjacentSame(mine, values, v)) return true;
    }
    return false;
  },
  progress(mine, opp, values) {
    let best = 0;
    for (let v = 1; v <= 4; v++) {
      const c = count(mine, i => values[i] === v);
      const adj = hasAdjacentSame(mine, values, v);
      const p = 0.5 * Math.min(3, c) / 3 + 0.5 * (adj ? 1 : 0);
      best = Math.max(best, p);
    }
    if (!this.check(mine, opp, values) && !linkFeasible(mine, opp, values)) return 0;
    return Math.min(1, best);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !linkFeasible(mine, opp, values)) return '0/3';
    let best = 0;
    for (let v = 1; v <= 4; v++) {
      const c = count(mine, i => values[i] === v);
      if (c > best) best = c;
    }
    return `${Math.min(3, best)}/3`;
  },
  feasible(mine, opp, empty, values) {
    return linkFeasible(mine, opp, values);
  }
};

function linkFeasible(mine, opp, values) {
  const allowed = new Set(mine.concat(emptyOf(mine, opp)));
  for (let v = 1; v <= 4; v++) {
    const cells = ALL_CELLS.filter(i => values[i] === v && allowed.has(i));
    if (cells.length < 3) continue;
    if (hasAdjacentSame(cells, values, v)) return true;
  }
  return false;
}

const twin = {
  id: 'twin',
  name: '双联',
  en: 'TWIN PAIRS',
  desc: '拥有两种数字，各有一对相邻的同数格',
  check(mine, opp, values) {
    let n = 0;
    for (let v = 1; v <= 4; v++) {
      if (count(mine, i => values[i] === v) >= 2 && hasAdjacentSame(mine, values, v)) n++;
    }
    return n >= 2;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !twinFeasible(mine, opp, values)) return 0;
    const vals = [];
    for (let v = 1; v <= 4; v++) vals.push(twinValueProgress(mine, values, v));
    vals.sort((a, b) => b - a);
    return Math.min(1, (vals[0] + vals[1]) / 2);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !twinFeasible(mine, opp, values)) return '0/2';
    let n = 0;
    for (let v = 1; v <= 4; v++) {
      if (count(mine, i => values[i] === v) >= 2 && hasAdjacentSame(mine, values, v)) n++;
    }
    return `${n}/2`;
  },
  feasible(mine, opp, empty, values) {
    return twinFeasible(mine, opp, values);
  }
};

function twinFeasible(mine, opp, values) {
  let n = 0;
  const allowed = new Set(mine.concat(emptyOf(mine, opp)));
  for (let v = 1; v <= 4; v++) {
    const cells = ALL_CELLS.filter(i => values[i] === v && allowed.has(i));
    if (cells.length < 2) continue;
    if (hasAdjacentSame(cells, values, v)) n++;
  }
  return n >= 2;
}

const rainbow4 = {
  id: 'rainbow4',
  name: '四色',
  en: 'FOUR COLORS',
  desc: '集齐 1、2、3、4 四种数字',
  check(mine, opp, values) {
    return new Set(mine.map(i => values[i])).size === 4;
  },
  progress(mine, opp, values) {
    const distinct = new Set(mine.map(i => values[i])).size;
    if (!this.check(mine, opp, values) && !rainbowFeasible(mine, opp, values)) return 0;
    return Math.min(1, distinct / 4);
  },
  progressText(mine, opp, values) {
    const distinct = new Set(mine.map(i => values[i])).size;
    return `${distinct}/4`;
  },
  feasible(mine, opp, empty, values) {
    return rainbowFeasible(mine, opp, values);
  }
};

function rainbowAdjFeasible(mine, opp, values) {
  const allowed = mine.concat(emptyOf(mine, opp));
  const have = new Set(mine.map(i => values[i]));
  for (let v = 1; v <= 4; v++) {
    if (!have.has(v) && !allowed.some(i => values[i] === v)) return false;
  }
  for (let v = 1; v <= 4; v++) {
    if (count(allowed, i => values[i] === v) >= 2 && hasAdjacentSame(allowed, values, v)) return true;
  }
  return false;
}

function fullhouseAdjFeasible(mine, opp, values) {
  if (!fullhouseFeasible(mine, opp, values)) return false;
  const allowed = mine.concat(emptyOf(mine, opp));
  for (let v = 1; v <= 4; v++) {
    if (count(allowed, i => values[i] === v) >= 2 && hasAdjacentSame(allowed, values, v)) return true;
  }
  return false;
}

const rainbowAdj = {
  id: 'rainbowadj',
  name: '全谱·连',
  en: 'SPECTRUM',
  desc: '集齐 4 种数字，且其中一对相邻',
  check(mine, opp, values) {
    return new Set(mine.map(i => values[i])).size === 4 && adjacentValues(mine, values) >= 1;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !rainbowAdjFeasible(mine, opp, values)) return 0;
    const distinct = new Set(mine.map(i => values[i])).size;
    const adj = adjacentValues(mine, values) >= 1;
    return Math.min(1, 0.6 * (distinct / 4) + 0.4 * (adj ? 1 : 0));
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !rainbowAdjFeasible(mine, opp, values)) return '0/4';
    const distinct = new Set(mine.map(i => values[i])).size;
    const adj = adjacentValues(mine, values) >= 1;
    return `${distinct}/4${adj ? '·连' : ''}`;
  },
  feasible(mine, opp, empty, values) {
    return rainbowAdjFeasible(mine, opp, values);
  }
};

const fullhouseAdj = {
  id: 'fullhouseadj',
  name: '连堂',
  en: 'CONNECTED FULL HOUSE',
  desc: '拥有 3+2 同数格，且其中有相邻对',
  check(mine, opp, values) {
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return c[0] >= 3 && c[1] >= 2 && adjacentValues(mine, values) >= 1;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !fullhouseAdjFeasible(mine, opp, values)) return 0;
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    const base = (Math.min(3, c[0]) + Math.min(2, c[1])) / 5;
    return Math.min(1, 0.7 * base + 0.3 * (adjacentValues(mine, values) >= 1 ? 1 : 0));
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !fullhouseAdjFeasible(mine, opp, values)) return '0+0';
    const c = Object.values(counts(mine, values)).sort((a, b) => b - a);
    return `${Math.min(3, c[0])}+${Math.min(2, c[1])}`;
  },
  feasible(mine, opp, empty, values) {
    return fullhouseAdjFeasible(mine, opp, values);
  }
};

const SEQ_RUNS = [[1, 2, 3], [2, 3, 4]];

const seq3 = {
  id: 'seq',
  name: '顺子',
  en: 'STRAIGHT',
  desc: '占据 1-2-3 或 2-3-4 三种数字',
  check(mine, opp, values) {
    const c = counts(mine, values);
    return SEQ_RUNS.some(run => run.every(v => c[v] > 0));
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return 0;
    const c = counts(mine, values);
    let best = 0;
    for (const run of SEQ_RUNS) best = Math.max(best, run.filter(v => c[v] > 0).length);
    return best / 3;
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return '0/3';
    const c = counts(mine, values);
    let best = 0;
    for (const run of SEQ_RUNS) best = Math.max(best, run.filter(v => c[v] > 0).length);
    return `${best}/3`;
  },
  feasible(mine, opp, empty, values) {
    const c = counts(mine, values);
    const e = counts(empty, values);
    return SEQ_RUNS.some(run => run.every(v => c[v] + e[v] >= 1));
  }
};

const EQ_PATTERNS = [
  { 1: 2, 2: 1 },
  { 1: 1, 2: 1, 3: 1 },
  { 1: 1, 3: 1, 4: 1 },
  { 2: 2, 4: 1 }
];

function eqMatched(need, c) {
  let n = 0;
  for (const v of Object.keys(need)) n += Math.min(c[v], need[v]);
  return n;
}

function eqFeasible(need, c, e) {
  for (const v of Object.keys(need)) {
    if (c[v] + e[v] < need[v]) return false;
  }
  return true;
}

const eq3 = {
  id: 'equation',
  name: '等式',
  en: 'EQUATION',
  desc: '三格中一数等于另两数之和',
  check(mine, opp, values) {
    const c = counts(mine, values);
    return EQ_PATTERNS.some(need => eqMatched(need, c) === 3);
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return 0;
    const c = counts(mine, values);
    let best = 0;
    for (const need of EQ_PATTERNS) best = Math.max(best, eqMatched(need, c));
    return best / 3;
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return '0/3';
    const c = counts(mine, values);
    let best = 0;
    for (const need of EQ_PATTERNS) best = Math.max(best, eqMatched(need, c));
    return `${Math.min(3, best)}/3`;
  },
  feasible(mine, opp, empty, values) {
    const c = counts(mine, values);
    const e = counts(empty, values);
    return EQ_PATTERNS.some(need => eqFeasible(need, c, e));
  }
};

const MIRROR_PAIRS = Array.from({ length: D.N / 2 }, (_, i) => [i, D.N - 1 - i]);

const mirror3 = {
  id: 'mirror',
  name: '镜像',
  en: 'MIRROR',
  desc: '占据两对中心对称的格子',
  check(mine) {
    let pairs = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (mine.includes(a) && mine.includes(b)) pairs++;
    }
    return pairs >= 2;
  },
  progress(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return 0;
    let score = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (opp.includes(a) || opp.includes(b)) continue;
      if (mine.includes(a)) score++;
      if (mine.includes(b)) score++;
    }
    return Math.min(1, score / 4);
  },
  progressText(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return '0/4';
    let score = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (opp.includes(a) || opp.includes(b)) continue;
      if (mine.includes(a)) score++;
      if (mine.includes(b)) score++;
    }
    return `${Math.min(4, score)}/4`;
  },
  feasible(mine, opp) {
    let open = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (!opp.includes(a) && !opp.includes(b)) open++;
    }
    return open >= 2;
  }
};

function lineRunBest(lineCells, mine, values) {
  const c = counts(lineCells.filter(i => mine.includes(i)), values);
  let best = 0;
  for (const run of SEQ_RUNS) best = Math.max(best, run.filter(v => c[v] > 0).length);
  return best;
}

function lineRunFeasible(line, mine, values) {
  for (const run of SEQ_RUNS) {
    if (run.every(v => line.some(i => values[i] === v && !mine.includes(i)))) return true;
  }
  return false;
}

const seqLine3 = {
  id: 'seqline',
  name: '顺列',
  en: 'LINE RUN',
  desc: '同一行/列中占据三个连续数字',
  check(mine, opp, values) {
    return LINES.some(line => lineRunBest(line, mine, values) === 3);
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return 0;
    let best = 0;
    for (const line of LINES) best = Math.max(best, lineRunBest(line, mine, values));
    return best / 3;
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return '0/3';
    let best = 0;
    for (const line of LINES) best = Math.max(best, lineRunBest(line, mine, values));
    return `${best}/3`;
  },
  feasible(mine, opp, empty, values) {
    const emptySet = new Set(empty);
    return LINES.some(line => {
      const mineOnLine = line.filter(i => mine.includes(i));
      const c = counts(mineOnLine, values);
      for (const run of SEQ_RUNS) {
        let ok = true;
        for (const v of run) {
          if (c[v] > 0) continue;
          if (!line.some(i => emptySet.has(i) && values[i] === v)) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
      return false;
    });
  }
};

function eq4Valid(cells, values) {
  if (cells.length !== 4) return false;
  const [a, b, c, d] = cells;
  return values[a] + values[b] === values[c] + values[d] ||
    values[a] + values[c] === values[b] + values[d] ||
    values[a] + values[d] === values[b] + values[c];
}

function eq4Best(mine, empty, values) {
  const pool = mine.concat(empty);
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

function eq4Any(mine, empty, values) {
  const pool = mine.concat(empty);
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

const eq4 = {
  id: 'eq4',
  name: '配平',
  en: 'BALANCE',
  desc: '四格可分成两组，两组和相等',
  check(mine, opp, values) {
    return eq4Best(mine, [], values) === 4;
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return 0;
    return Math.min(1, eq4Best(mine, emptyOf(mine, opp), values) / 4);
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return '0/4';
    return `${Math.min(4, eq4Best(mine, emptyOf(mine, opp), values))}/4`;
  },
  feasible(mine, opp, empty, values) {
    return eq4Any(mine, empty, values);
  }
};

const mirrorPlus = {
  id: 'mirrorplus',
  name: '对称',
  en: 'SYMMETRY',
  desc: '占据一对中心对称格，再加任意一格',
  check(mine) {
    if (mine.length < 3) return false;
    return MIRROR_PAIRS.some(([a, b]) => mine.includes(a) && mine.includes(b));
  },
  progress(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return 0;
    let best = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (opp.includes(a) || opp.includes(b)) continue;
      let n = 0;
      if (mine.includes(a)) n++;
      if (mine.includes(b)) n++;
      if (n === 2) n = Math.min(3, 2 + Math.max(0, mine.length - 2));
      if (n === 1 && mine.length >= 2) n = 2;
      best = Math.max(best, Math.min(3, n));
    }
    return best / 3;
  },
  progressText(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return '0/3';
    let best = 0;
    for (const [a, b] of MIRROR_PAIRS) {
      if (opp.includes(a) || opp.includes(b)) continue;
      let n = 0;
      if (mine.includes(a)) n++;
      if (mine.includes(b)) n++;
      if (n === 2) n = Math.min(3, 2 + Math.max(0, mine.length - 2));
      if (n === 1 && mine.length >= 2) n = 2;
      best = Math.max(best, Math.min(3, n));
    }
    return `${best}/3`;
  },
  feasible(mine, opp) {
    return MIRROR_PAIRS.some(([a, b]) => !opp.includes(a) && !opp.includes(b));
  }
};

function lineSumBest(line, mine, empty, values) {
  const pool = line.filter(i => mine.includes(i) || empty.includes(i));
  let best = 0;
  for (let i = 0; i < pool.length - 2; i++) {
    for (let j = i + 1; j < pool.length - 1; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        if (values[pool[i]] + values[pool[j]] + values[pool[k]] !== 9) continue;
        const owned = [pool[i], pool[j], pool[k]].filter(x => mine.includes(x)).length;
        if (owned > best) best = owned;
      }
    }
  }
  return best;
}

const lineSum9 = {
  id: 'linesum9',
  name: '和九',
  en: 'SUM NINE',
  desc: '同一行/列中占据三格，和为 9',
  check(mine, opp, values) {
    return LINES.some(line => lineSumBest(line, mine, [], values) === 3);
  },
  progress(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return 0;
    const empty = emptyOf(mine, opp);
    let best = 0;
    for (const line of LINES) best = Math.max(best, lineSumBest(line, mine, empty, values));
    return best / 3;
  },
  progressText(mine, opp, values) {
    if (!this.check(mine, opp, values) && !this.feasible(mine, opp, emptyOf(mine, opp), values)) return '0/3';
    const empty = emptyOf(mine, opp);
    let best = 0;
    for (const line of LINES) best = Math.max(best, lineSumBest(line, mine, empty, values));
    return `${best}/3`;
  },
  feasible(mine, opp, empty, values) {
    return LINES.some(line => lineSumBest(line, mine, empty, values) >= 1);
  }
};

const ROT_ORBITS = [
  [0, 3, 15, 12],
  [1, 7, 14, 8],
  [2, 11, 13, 4],
  [5, 6, 10, 9]
];

const rot4 = {
  id: 'rot4',
  name: '回旋',
  en: 'ROTATION',
  desc: '占据一条绕中心旋转 90° 的四格轨道',
  check(mine) {
    return ROT_ORBITS.some(orbit => orbit.every(i => mine.includes(i)));
  },
  progress(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return 0;
    let best = 0;
    for (const orbit of ROT_ORBITS) best = Math.max(best, count(orbit, i => mine.includes(i)));
    return Math.min(1, best / 4);
  },
  progressText(mine, opp) {
    if (!this.check(mine) && !this.feasible(mine, opp)) return '0/4';
    let best = 0;
    for (const orbit of ROT_ORBITS) best = Math.max(best, count(orbit, i => mine.includes(i)));
    return `${Math.min(4, best)}/4`;
  },
  feasible(mine, opp) {
    return ROT_ORBITS.some(orbit => orbit.every(i => !opp.includes(i)));
  }
};

const CANDIDATES = [
  square3,
  square4,
  quadrant3,
  center3,
  corners3,
  opposite2,
  diagonal3,
  diagonal4,
  fullhouse,
  rainbow5,
  prism,
  line3,
  line4,
  edge3,
  chain3,
  trio3,
  pairs2,
  center2,
  corners2,
  corneradj,
  diagall,
  squareClean,
  lineClean,
  quad,
  link,
  twin,
  rainbow4,
  row3,
  col3,
  rim3,
  rainbowAdj,
  fullhouseAdj,
  doublediag,
  doublediag4,
  linkLine,
  shortdiag,
  centerline3,
  edgeblocks3,
  seq3,
  eq3,
  mirror3,
  seqLine3,
  eq4,
  mirrorPlus,
  lineSum9,
  rot4
];

const CANDIDATE_IDS = CANDIDATES.map(g => g.id);

function install(ids) {
  for (const g of CANDIDATES) D.GOALS[g.id] = g;
  for (const id of ids) {
    if (!D.GOALS[id]) throw new Error('unknown goal id: ' + id);
  }
  D.GOAL_IDS.length = 0;
  for (const id of ids) D.GOAL_IDS.push(id);
}

const RULE = process.env.RULE || 'native';
const HANDICAP = process.env.TIE_HANDICAP != null
  ? parseInt(process.env.TIE_HANDICAP, 10)
  : (RULE === 'native' ? D.TIE_HANDICAP : 0);
D.setTieRule(
  RULE === 'native' ? 'sum-handicap' :
  RULE === 'sum-tie' ? 'sum' :
  RULE === 'sum-handicap' ? 'sum-handicap' :
  RULE === 'first-tie' ? 'first' :
  RULE === 'draw-tie' ? 'draw' : 'second',
  HANDICAP
);

function judged(state, ev) {
  if (RULE !== 'sum-first' && RULE !== 'second-tie' && RULE !== 'second-tie-met' && RULE !== 'sum-tie' &&
    RULE !== 'sum-handicap' && RULE !== 'first-tie' && RULE !== 'draw-tie') return ev;
  const out = Object.assign({}, ev);
  let winner = null;
  let reason = 'draw';
  if (ev.met[0] !== ev.met[1]) {
    winner = ev.met[0] ? 0 : 1;
    reason = 'goal';
  } else if (ev.met[0] && ev.met[1]) {
    if (RULE === 'sum-first') {
      if (ev.sums[0] !== ev.sums[1]) {
        winner = ev.sums[0] > ev.sums[1] ? 0 : 1;
        reason = 'sum';
      }
    } else if (ev.completion[0] !== ev.completion[1]) {
      winner = ev.completion[0] < ev.completion[1] ? 0 : 1;
      reason = 'speed';
    } else if (RULE === 'sum-tie') {
      if (ev.sums[0] !== ev.sums[1]) {
        winner = ev.sums[0] > ev.sums[1] ? 0 : 1;
        reason = 'sum';
      } else {
        winner = 1 - state.first;
        reason = 'tie';
      }
    } else if (RULE === 'sum-handicap') {
      const firstSum = ev.sums[state.first];
      const secondSum = ev.sums[1 - state.first] + HANDICAP;
      if (firstSum !== secondSum) {
        winner = firstSum > secondSum ? state.first : 1 - state.first;
        reason = 'sum';
      } else {
        winner = null;
        reason = 'draw';
      }
    } else if (RULE === 'first-tie') {
      winner = state.first;
      reason = 'tie';
    } else if (RULE === 'draw-tie') {
      winner = null;
      reason = 'draw';
    } else {
      winner = 1 - state.first;
      reason = 'tie';
    }
  } else if (Math.abs(ev.progress[0] - ev.progress[1]) > 1e-9) {
    winner = ev.progress[0] > ev.progress[1] ? 0 : 1;
    reason = 'progress';
  } else if (ev.sums[0] !== ev.sums[1]) {
    winner = ev.sums[0] > ev.sums[1] ? 0 : 1;
    reason = 'sum';
  } else if (RULE === 'second-tie') {
    winner = 1 - state.first;
    reason = 'tie';
  }
  out.winner = winner;
  out.reason = reason;
  return out;
}

function completionIndex(state, p) {
  const g = D.GOALS[state.goals[p]];
  const mine = [];
  for (let used = 1; used <= state.claims[p].length; used++) {
    mine.push(state.claims[p][used - 1]);
    if (g.check(mine, state.claims[1 - p], state.values)) return used;
  }
  return null;
}

function newStats(ids) {
  const goals = {};
  for (const id of ids) {
    goals[id] = { held: 0, met: 0, wins: 0, sums: 0, comp: 0, metSum: 0 };
  }
  return {
    matches: 0,
    draws: 0,
    wins: [0, 0],
    firstWins: 0,
    reasons: { goal: 0, speed: 0, progress: 0, sum: 0, tie: 0, draw: 0 },
    metOne: 0,
    metBoth: 0,
    metNone: 0,
    goals
  };
}

function record(stats, state, ev) {
  stats.matches++;
  stats.reasons[ev.reason]++;
  if (ev.winner === null) stats.draws++;
  else {
    stats.wins[ev.winner]++;
    if (ev.winner === state.first) stats.firstWins++;
  }
  if (ev.met[0] && ev.met[1]) stats.metBoth++;
  else if (ev.met[0] || ev.met[1]) stats.metOne++;
  else stats.metNone++;

  for (let p = 0; p < 2; p++) {
    const g = stats.goals[state.goals[p]];
    g.held++;
    g.sums += ev.sums[p];
    if (ev.met[p]) {
      g.met++;
      const c = completionIndex(state, p);
      if (c != null) {
        g.comp += c;
        g.metSum++;
      }
    }
    if (ev.winner === p) g.wins++;
  }
}

function pct(n, total) {
  return total ? ((100 * n) / total).toFixed(1) + '%' : '-';
}

function play(seed) {
  const state = D.createGame(seed);
  let guard = 0;
  while (!state.over) {
    if (guard++ > 40) throw new Error('no termination: ' + seed);
    const p = D.playerToMove(state);
    D.applyMove(state, D.chooseAiMove(state, p));
  }
  return { state, ev: judged(state, D.evaluate(state)) };
}

function printDeck(label, ids, matches) {
  install(ids);
  const stats = newStats(ids);
  for (let i = 0; i < matches; i++) {
    const { state, ev } = play('bal|' + i);
    record(stats, state, ev);
  }
  const n = stats.matches;
  const decisive = stats.wins[0] + stats.wins[1];
  console.log(`\n=== ${label} · ${n} ===`);
  console.log(
    `met exactly-one ${pct(stats.metOne, n)} | both ${pct(stats.metBoth, n)} | none ${pct(stats.metNone, n)}` +
    ` | first-seat win ${pct(stats.firstWins, decisive)} | draw ${pct(stats.draws, n)}`
  );
  console.log(
    `reasons ` +
    Object.entries(stats.reasons).map(([k, v]) => `${k} ${pct(v, n)}`).join(' | ')
  );
  console.log('goal              held   met    win   comp  avgSum');
  const rows = ids.map(id => {
    const g = stats.goals[id];
    return {
      id,
      name: D.GOALS[id].name,
      met: g.met / g.held,
      win: g.wins / g.held,
      comp: g.metSum ? g.comp / g.metSum : 0,
      sum: g.sums / g.held,
      held: g.held
    };
  });
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(3, '　')} ${D.GOALS[r.id].en.padEnd(12)} ` +
      `${String(r.held).padStart(5)} ` +
      `${pct(r.met, 1).padStart(6)} ` +
      `${pct(r.win, 1).padStart(6)} ` +
      `${r.comp.toFixed(2).padStart(5)} ` +
      `${r.sum.toFixed(2).padStart(6)}`
    );
  }
  return rows;
}

function printPairs(label, ids, gamesPerPair) {
  install(ids);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  }
  console.log(`\n=== ${label} pairs · ${gamesPerPair} per pair ===`);
  let total = 0;
  const results = [];
  for (const [a, b] of pairs) {
    let aw = 0, bw = 0, dr = 0, am = 0, bm = 0, ac = 0, acn = 0, bc = 0, bcn = 0;
    let fw = 0, fdec = 0, bothMet = 0;
    for (let k = 0; k < gamesPerPair; k++) {
      const state = D.createGame('pair|' + total);
      state.goals = k % 2 === 0 ? [a, b] : [b, a];
      const aSeat = state.goals[0] === a ? 0 : 1;
      let guard = 0;
      while (!state.over) {
        if (guard++ > 40) throw new Error('no termination');
        const p = D.playerToMove(state);
        D.applyMove(state, D.chooseAiMove(state, p));
      }
      const ev = judged(state, D.evaluate(state));
      total++;
      if (ev.winner === null) dr++;
      else {
        if (ev.winner === state.first) fw++;
        fdec++;
        if (ev.winner === aSeat) aw++;
        else bw++;
      }
      if (ev.met[0] && ev.met[1]) bothMet++;
      if (ev.met[aSeat]) {
        am++;
        const c = completionIndex(state, aSeat);
        if (c != null) { ac += c; acn++; }
      }
      if (ev.met[1 - aSeat]) {
        bm++;
        const c = completionIndex(state, 1 - aSeat);
        if (c != null) { bc += c; bcn++; }
      }
    }
    const dec = aw + bw;
    results.push({
      a, b, aw, bw, dr, fw, fdec, bothMet,
      aWin: dec ? aw / dec : 0.5,
      bWin: dec ? bw / dec : 0.5,
      aMet: am / gamesPerPair,
      bMet: bm / gamesPerPair,
      aComp: acn ? ac / acn : 0,
      bComp: bcn ? bc / bcn : 0
    });
  }
  console.log(
    `first-seat win ${pct(results.reduce((n, r) => n + r.fw, 0), results.reduce((n, r) => n + r.fdec, 0))}` +
    ` | both met ${pct(results.reduce((n, r) => n + r.bothMet, 0), results.length * gamesPerPair)}`
  );
  const up = results.map(p => [p.a, p.b, p.aWin, p.bWin, p.aMet, p.bMet, p.dr / gamesPerPair]);
  up.sort((x, y) => Math.abs(y[2] - 0.5) - Math.abs(x[2] - 0.5));
  for (const [a, b, aw, bw, am, bm, dr] of up) {
    console.log(
      `${D.GOALS[a].name.padEnd(3, '　')} vs ${D.GOALS[b].name.padEnd(3, '　')} ` +
      `${pct(aw, 1).padStart(6)} / ${pct(bw, 1).padStart(6)}` +
      `  met ${pct(am, 1).padStart(6)} / ${pct(bm, 1).padStart(6)}` +
      `  draw ${pct(dr, 1).padStart(5)}`
    );
  }
}

function printPair(a, b, games) {
  install(CANDIDATE_IDS);
  if (!D.GOALS[a] || !D.GOALS[b]) throw new Error('unknown goal');
  let aw = 0, bw = 0, dr = 0, am = 0, bm = 0, ac = 0, acn = 0, bc = 0, bcn = 0;
  for (let k = 0; k < games; k++) {
    const state = D.createGame('pair|' + k);
    state.goals = k % 2 === 0 ? [a, b] : [b, a];
    const aSeat = state.goals[0] === a ? 0 : 1;
    let guard = 0;
    while (!state.over) {
      if (guard++ > 40) throw new Error('no termination');
      const p = D.playerToMove(state);
      D.applyMove(state, D.chooseAiMove(state, p));
    }
    const ev = judged(state, D.evaluate(state));
    if (ev.winner === null) dr++;
    else if (ev.winner === aSeat) aw++;
    else bw++;
    if (ev.met[aSeat]) { am++; const c = completionIndex(state, aSeat); if (c != null) { ac += c; acn++; } }
    if (ev.met[1 - aSeat]) { bm++; const c = completionIndex(state, 1 - aSeat); if (c != null) { bc += c; bcn++; } }
  }
  const dec = aw + bw;
  console.log(`\n${D.GOALS[a].name} vs ${D.GOALS[b].name} · ${games}`);
  console.log(
    `win ${pct(aw, dec)} / ${pct(bw, dec)} | draw ${pct(dr, games)}` +
    ` | met ${pct(am, games)} / ${pct(bm, games)}` +
    ` | comp ${acn ? (ac / acn).toFixed(2) : '-'} / ${bcn ? (bc / bcn).toFixed(2) : '-'}`
  );
}

const mode = process.argv[2] || 'deck';
const arg = process.argv[3] || '';
const deckArg = process.argv[4] || '';
const deck = deckArg
  ? deckArg.split(',').map(s => s.trim()).filter(Boolean)
  : CANDIDATE_IDS;

if (mode === 'deck') {
  printDeck('candidate deck', deck, parseInt(arg || '8000', 10));
} else if (mode === 'pairs') {
  printPairs('candidate deck', deck, parseInt(arg || '60', 10));
} else if (mode === 'pair') {
  printPair(process.argv[3], process.argv[4], parseInt(process.argv[5] || '1000', 10));
} else {
  console.error('usage: node balance.js deck <n> [ids] | pairs <n> [ids] | pair <a> <b> <n>');
  process.exit(1);
}
