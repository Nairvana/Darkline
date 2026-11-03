'use strict';

const D = require('./engine.js');

const AI_CFG = process.env.AI_CFG ? JSON.parse(process.env.AI_CFG) : null;
if (AI_CFG) Object.assign(D.AI, AI_CFG);
if (process.env.TIE_HANDICAP != null) {
  D.setTieRule('sum-handicap', parseInt(process.env.TIE_HANDICAP, 10));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeRng(seed) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a ^ seed.charCodeAt(i), 2654435761) >>> 0);
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseBot(kind, state, me, rng) {
  const empty = D.emptyIndices(state);
  if (!empty.length) return null;
  const myGoal = D.GOALS[state.goals[me]];
  const myC = state.claims[me];
  const opC = state.claims[1 - me];
  const values = state.values;

  if (kind === 'ai') return D.chooseAiMove(state, me);
  if (kind === 'random') return empty[Math.floor(rng() * empty.length)];

  if (kind === 'goal') {
    const base = myGoal.progress(myC, opC, values);
    let best = null;
    for (const cell of empty) {
      const gain = myGoal.progress(myC.concat(cell), opC, values) - base;
      const score = gain + rng() * 0.01 + values[cell] * 0.0005;
      if (!best || score > best.score) best = { cell, score };
    }
    return best.cell;
  }

  if (kind === 'material') {
    let best = null;
    for (const cell of empty) {
      const score = values[cell] + rng() * 0.1;
      if (!best || score > best.score) best = { cell, score };
    }
    return best.cell;
  }

  if (kind === 'mixed') {
    const base = myGoal.progress(myC, opC, values);
    let best = null;
    for (const cell of empty) {
      const gain = myGoal.progress(myC.concat(cell), opC, values) - base;
      const score = gain * 0.8 + (values[cell] / 4) * 0.35 + rng() * 0.02;
      if (!best || score > best.score) best = { cell, score };
    }
    return best.cell;
  }

  throw new Error('unknown bot: ' + kind);
}

function runMatch(seed, k0, k1) {
  const state = D.createGame(seed);
  const rng = makeRng(seed + '|bots');
  let guard = 0;
  while (!state.over) {
    if (guard++ > 40) throw new Error('match did not terminate: ' + seed);
    const p = D.playerToMove(state);
    const cell = chooseBot(p === 0 ? k0 : k1, state, p, rng);
    assert(cell != null && D.applyMove(state, cell), `bad move in ${seed}`);
  }
  return { state, ev: D.evaluate(state) };
}

function emptyStats() {
  const goals = {};
  for (const id of D.GOAL_IDS) {
    goals[id] = { held: 0, met: 0, wins: 0, sums: 0 };
  }
  return {
    matches: 0,
    wins: [0, 0],
    draws: 0,
    firstWins: 0,
    reasons: { goal: 0, speed: 0, sum: 0, progress: 0, draw: 0 },
    metBoth: 0,
    metOne: 0,
    metNone: 0,
    goals,
    sums: [0, 0]
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
    stats.sums[p] += ev.sums[p];
    const g = stats.goals[state.goals[p]];
    g.held++;
    if (ev.met[p]) g.met++;
    if (ev.winner === p) g.wins++;
    g.sums += ev.sums[p];
  }
}

function pct(n, total) {
  return total ? ((100 * n) / total).toFixed(1) + '%' : '-';
}

function printStats(label, stats) {
  const n = stats.matches;
  const decisive = stats.wins[0] + stats.wins[1];
  console.log(`\n=== ${label} · ${n} matches ===`);
  console.log(`draw ${pct(stats.draws, n)} | P1 win ${pct(stats.wins[0], n)} | P2 win ${pct(stats.wins[1], n)}`);
  console.log(
    `first seat decisive wins ${pct(stats.firstWins, decisive)} | reason goal/speed/sum/progress/draw ` +
    `${stats.reasons.goal}/${stats.reasons.speed}/${stats.reasons.sum}/${stats.reasons.progress}/${stats.reasons.draw}`
  );
  console.log(`goal status: exactly-one ${pct(stats.metOne, n)} | both ${pct(stats.metBoth, n)} | none ${pct(stats.metNone, n)}`);
  console.log(`avg sum: P1 ${(stats.sums[0] / n).toFixed(2)} | P2 ${(stats.sums[1] / n).toFixed(2)}`);
  console.log('goal                 held    met     win    avgSum');
  for (const id of D.GOAL_IDS) {
    const g = stats.goals[id];
    console.log(
      `${D.GOALS[id].name.padEnd(4, '　')} ${D.GOALS[id].en.padEnd(8)} ${String(g.held).padStart(5)} ${pct(g.met, g.held).padStart(7)} ${pct(g.wins, g.held).padStart(7)} ${(g.sums / g.held).toFixed(2).padStart(8)}`
    );
  }
}

function selfplay(n) {
  const stats = emptyStats();
  for (let i = 0; i < n; i++) {
    const { state, ev } = runMatch('sp' + i, 'ai', 'ai');
    record(stats, state, ev);
  }
  printStats('AI self-play', stats);
  return stats;
}

function versus(n) {
  const kinds = ['random', 'goal', 'material', 'mixed'];
  for (const kind of kinds) {
    const stats = emptyStats();
    for (let i = 0; i < n; i++) {
      const { state, ev } = runMatch('vs' + i, 'ai', kind);
      record(stats, state, ev);
    }
    printStats(`AI (P1) vs ${kind} (P2)`, stats);
  }
}

function randomBaseline(n) {
  const stats = emptyStats();
  for (let i = 0; i < n; i++) {
    const { state, ev } = runMatch('rb' + i, 'random', 'random');
    record(stats, state, ev);
  }
  printStats('random vs random baseline', stats);
}

function sample(n) {
  for (let i = 0; i < n; i++) {
    const seed = 'sample' + i;
    const state = D.createGame(seed);
    const log = [];
    while (!state.over) {
      const p = D.playerToMove(state);
      const cell = D.chooseAiMove(state, p);
      log.push(`${p === 0 ? 'P1' : 'P2'} ${D.COORDS[cell]}(${state.values[cell]})`);
      D.applyMove(state, cell);
    }
    const ev = D.evaluate(state);
    const read = D.inferGoals(state, 1)
      .map(r => `${D.GOALS[r.goal].name} ${(r.p * 100).toFixed(0)}%`)
      .join(' / ');
    console.log(`\n#${i} seed=${state.seed} first=${state.first === 0 ? 'P1' : 'P2'}`);
    console.log(`P1 goal ${D.GOALS[state.goals[0]].name} | P2 goal ${D.GOALS[state.goals[1]].name}`);
    console.log(log.join('  '));
    console.log(`met=${JSON.stringify(ev.met)} sums=${JSON.stringify(ev.sums)} winner=${ev.winner} reason=${ev.reason}`);
    console.log(`P2's final read on P1: ${read}`);
  }
}

function check() {
  for (const seed of ['a', 'b', 'c', 'test', 'zzzzzz']) {
    const state = D.createGame(seed);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const v of state.values) counts[v]++;
    assert(counts[1] === 4 && counts[2] === 4 && counts[3] === 4 && counts[4] === 4, 'value counts');
    assert(state.goals[0] !== state.goals[1], 'goals distinct');
    assert(state.first === 0 || state.first === 1, 'first seat');
  }

  const rng = makeRng('invariants');
  for (let t = 0; t < 500; t++) {
    const state = D.createGame('check' + t);
    let guard = 0;
    while (!state.over) {
      if (guard++ > 40) throw new Error('no termination');
      const empty = D.emptyIndices(state);
      const cell = empty[Math.floor(rng() * empty.length)];
      assert(D.applyMove(state, cell), 'legal move');
    }
    assert(state.moves.length <= D.CLAIMS * 2, 'move count');
    assert(state.claims[0].length <= D.CLAIMS && state.claims[1].length <= D.CLAIMS, 'claims count');
    for (let i = 0; i < D.N; i++) {
      if (state.owner[i] === 0) assert(state.claims[0].includes(i), 'owner0');
      else if (state.owner[i] === 1) assert(state.claims[1].includes(i), 'owner1');
    }
    const ev = D.evaluate(state);
    if (state.moves.length < D.CLAIMS * 2) {
      assert(ev.met[0] && ev.met[1], 'early finish means both goals met');
    }
    assert(ev.sums[0] === D.sumOf(state.claims[0], state.values), 'sum0');
    assert(ev.sums[1] === D.sumOf(state.claims[1], state.values), 'sum1');
    const emptyNow = D.emptyIndices(state);
    for (const id of D.GOAL_IDS) {
      const g = D.GOALS[id];
      for (let p = 0; p < 2; p++) {
        const mineNow = state.claims[p];
        const oppNow = state.claims[1 - p];
        if (!g.check(mineNow, oppNow, state.values)) continue;
        assert(g.progress(mineNow, oppNow, state.values) === 1, `${id} progress when met`);
        assert(g.feasible(mineNow, oppNow, emptyNow, state.values), `${id} feasible when met`);
      }
    }
  }

  assert(D.GOAL_IDS.length === 12, 'deck size');
  const vals = [4, 4, 4, 1, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 4];

  assert(D.GOALS.square.check([0, 1, 4], [], vals), 'square yes');
  assert(!D.GOALS.square.check([0, 1, 2], [], vals), 'square no');
  assert(D.GOALS.square.feasible([], [5], [], vals), 'square feasible');
  assert(!D.GOALS.square.feasible([], [5, 6, 9, 10, 0, 3, 12, 15], [], vals), 'square blocked');
  assert(Math.abs(D.GOALS.square.progress([0, 1], [], vals) - 2 / 3) < 1e-9, 'square progress');

  assert(D.GOALS.row3.check([0, 1, 2], [], vals), 'row yes');
  assert(!D.GOALS.row3.check([0, 1, 5], [], vals), 'row no');
  assert(D.GOALS.row3.feasible([], [0, 1, 2], [], vals), 'row feasible');
  assert(!D.GOALS.row3.feasible([], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [], vals), 'row blocked');

  assert(D.GOALS.col3.check([0, 4, 8], [], vals), 'column yes');
  assert(!D.GOALS.col3.check([0, 4, 9], [], vals), 'column no');
  assert(Math.abs(D.GOALS.col3.progress([0, 4], [], vals) - 2 / 3) < 1e-9, 'column progress');

  assert(D.GOALS.edge.check([0, 1, 2], [], vals), 'edge yes');
  assert(!D.GOALS.edge.check([0, 1, 4], [], vals), 'edge no');
  assert(D.GOALS.edge.feasible([], [0, 1, 2, 3], [], vals), 'edge still feasible');
  assert(!D.GOALS.edge.feasible([], [0, 3, 12, 15], [], vals), 'edge blocked');

  assert(D.GOALS.rim.check([0, 1, 5], [], vals), 'rim yes');
  assert(!D.GOALS.rim.check([5, 6, 9], [], vals), 'rim center block excluded');
  assert(D.GOALS.rim.feasible([], [0, 1], [], vals), 'rim feasible');
  assert(!D.GOALS.rim.feasible([], [5, 6, 9, 10, 0, 3, 12, 15], [], vals), 'rim blocked');

  assert(D.GOALS.axis.check([4, 5, 6], [], vals), 'axis yes');
  assert(!D.GOALS.axis.check([0, 1, 2], [], vals), 'axis no');
  assert(!D.GOALS.axis.feasible([], [4, 5, 8, 9, 1, 2, 6, 10], [], vals), 'axis blocked');

  assert(D.GOALS.rainbow.check([0, 3, 4, 8, 9], [], vals), 'rainbow yes');
  assert(!D.GOALS.rainbow.check([0, 3, 4, 8], [], vals), 'rainbow needs a pair');
  assert(Math.abs(D.GOALS.rainbow.progress([0, 3, 4, 8], [], vals) - 0.5) < 1e-9, 'rainbow progress');
  assert(!D.GOALS.rainbow.feasible([0, 3, 4], [8, 9, 10, 11], [], vals), 'rainbow blocked');
  assert(D.GOALS.rainbow.feasible([0, 3, 4, 8], [9], [], vals), 'rainbow pair feasible');

  assert(D.GOALS.link.check([0, 1, 2], [], vals), 'link yes');
  const latin = [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3];
  assert(!D.GOALS.link.check([0, 7, 10], [], latin), 'link needs a line pair');
  assert(Math.abs(D.GOALS.link.progress([0, 1], [], vals) - 5 / 6) < 1e-9, 'link progress');
  assert(D.GOALS.link.feasible([], [], [], vals), 'link feasible');
  assert(!D.GOALS.link.feasible([], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [], vals), 'link blocked');

  assert(D.GOALS.shortdiag.check([1, 6, 11], [], vals), 'shortdiag yes');
  assert(!D.GOALS.shortdiag.check([1, 6, 12], [], vals), 'shortdiag no');
  assert(Math.abs(D.GOALS.shortdiag.progress([1, 6], [], vals) - 2 / 3) < 1e-9, 'shortdiag progress');
  assert(D.GOALS.shortdiag.feasible([], [1], [], vals), 'shortdiag feasible');
  assert(!D.GOALS.shortdiag.feasible([], [1, 4, 2, 7], [], vals), 'shortdiag blocked');

  assert(D.GOALS.corners.check([0, 3, 12], [], vals), 'corners yes');
  assert(!D.GOALS.corners.check([0, 3, 4], [], vals), 'corners no');
  assert(Math.abs(D.GOALS.corners.progress([0, 3], [], vals) - 2 / 3) < 1e-9, 'corners progress');
  assert(D.GOALS.corners.progress([0], [3, 12], vals) === 0, 'corners blocked progress');
  assert(D.GOALS.corners.feasible([], [], [], vals), 'corners feasible');
  assert(!D.GOALS.corners.feasible([], [0, 3], [], vals), 'corners blocked');

  assert(D.GOALS.trio.check([0, 1, 2], [], vals), 'trio yes');
  assert(!D.GOALS.trio.check([0, 1, 4], [], vals), 'trio no');
  assert(Math.abs(D.GOALS.trio.progress([0, 1], [], vals) - 2 / 3) < 1e-9, 'trio progress');
  const trioBlockedOpp = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
  assert(D.GOALS.trio.progress([15], trioBlockedOpp, vals) === 0, 'trio blocked progress');
  assert(!D.GOALS.trio.feasible([], trioBlockedOpp, [], vals), 'trio blocked');

  assert(D.GOALS.eq4.check([0, 1, 4, 5], [], vals), 'eq4 yes');
  assert(!D.GOALS.eq4.check([0, 1, 4, 8], [], vals), 'eq4 no');
  assert(Math.abs(D.GOALS.eq4.progress([0, 1, 4], [], vals) - 3 / 4) < 1e-9, 'eq4 progress');
  assert(D.GOALS.eq4.progressText([0, 1, 4], [], vals) === '3/4', 'eq4 text');
  const eq4Empty = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  assert(D.GOALS.eq4.feasible([], [0, 1, 2, 3], eq4Empty, vals), 'eq4 feasible');
  const eq4BlockedOpp = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert(!D.GOALS.eq4.feasible([], eq4BlockedOpp, [13, 14, 15], vals), 'eq4 blocked');
  assert(D.GOALS.eq4.progress([13], eq4BlockedOpp, vals) === 0, 'eq4 blocked progress');

  const early = D.createGame('early');
  early.goals = ['row3', 'col3'];
  early.first = 0;
  early.claims = [[0, 1], [4, 8]];
  early.moves = [
    { p: 0, cell: 0 }, { p: 1, cell: 4 }, { p: 0, cell: 1 }, { p: 1, cell: 8 }
  ];
  early.owner = new Array(D.N).fill(-1);
  for (const move of early.moves) early.owner[move.cell] = move.p;
  assert(D.playerToMove(early) === 0, 'early player to move');
  assert(D.applyMove(early, 2), 'early row completes');
  assert(!early.over, 'one goal met does not end the game');
  assert(D.applyMove(early, 12), 'early column completes');
  assert(early.over && early.moves.length === 6, 'both goals met ends the game early');

  const both = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1, 2], [4, 8, 12]],
    first: 0
  });
  assert(both.met[0] && both.met[1], 'both met');
  assert(both.completion[0] === both.completion[1], 'equal completion');
  assert(both.winner === 0 && both.reason === 'sum', 'handicap sum decides equal completion');

  const handicapFlip = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[8, 9, 10], [3, 7, 15]],
    first: 0
  });
  assert(handicapFlip.met[0] && handicapFlip.met[1], 'handicap flip both met');
  assert(handicapFlip.completion[0] === handicapFlip.completion[1], 'handicap flip equal completion');
  assert(handicapFlip.sums[0] === 9 && handicapFlip.sums[1] === 7, 'handicap flip raw sums');
  assert(handicapFlip.winner === 1 && handicapFlip.reason === 'sum', 'second player handicap flips the sum');

  const handicapDraw = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1, 2], [7, 11, 15]],
    first: 0
  });
  assert(handicapDraw.met[0] && handicapDraw.met[1], 'handicap draw both met');
  assert(handicapDraw.completion[0] === handicapDraw.completion[1], 'handicap draw equal completion');
  assert(handicapDraw.sums[0] === 12 && handicapDraw.sums[1] === 9, 'handicap draw raw sums');
  assert(handicapDraw.winner === null && handicapDraw.reason === 'draw', 'equal adjusted sums draw');

  const speed = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1, 2], [4, 8, 13, 12]],
    first: 0
  });
  assert(speed.met[0] && speed.met[1], 'speed both met');
  assert(speed.completion[0] < speed.completion[1], 'earlier completion');
  assert(speed.winner === 0 && speed.reason === 'speed', 'earlier completion wins');

  const exclusive = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1, 2], [4, 8, 13]],
    first: 0
  });
  assert(exclusive.met[0] && !exclusive.met[1], 'exclusive met');
  assert(exclusive.winner === 0 && exclusive.reason === 'goal', 'exclusive goal decides');

  const byProgress = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1], [4]],
    first: 0
  });
  assert(!byProgress.met[0] && !byProgress.met[1], 'progress neither met');
  assert(byProgress.winner === 0 && byProgress.reason === 'progress', 'progress decides');

  const bySum = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[0, 1], [4, 8]],
    first: 0
  });
  assert(!bySum.met[0] && !bySum.met[1], 'sum neither met');
  assert(bySum.winner === 0 && bySum.reason === 'sum', 'sum decides');

  const drawn = D.evaluate({
    values: vals,
    goals: ['row3', 'col3'],
    claims: [[], []],
    first: 0
  });
  assert(!drawn.met[0] && !drawn.met[1], 'empty neither met');
  assert(drawn.winner === null && drawn.reason === 'draw', 'empty draw');

  console.log('All engine checks passed.');
}

const mode = process.argv[2] || 'selfplay';
const n = parseInt(process.argv[3] || '2000', 10);

if (mode === 'check') check();
else if (mode === 'versus') versus(n);
else if (mode === 'random') randomBaseline(n);
else if (mode === 'sample') sample(n);
else selfplay(n);
