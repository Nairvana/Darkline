(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DarklineSfx = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MASTER_LEVEL = 1.25;
  const OUTPUT_CEILING = 0.26;
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;

  function limiterCurve(ceiling) {
    const knee = 0.18;
    const samples = 4096;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i += 1) {
      const x = (i / (samples - 1)) * 2 - 1;
      const abs = Math.abs(x);
      curve[i] = abs <= knee
        ? x
        : Math.sign(x) * (knee + (ceiling - knee) * Math.tanh((abs - knee) / (ceiling - knee)));
    }
    return curve;
  }

  function audioContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch (error) {
      try {
        ctx = new Ctor();
      } catch (error2) {
        return null;
      }
    }
    const limiter = ctx.createWaveShaper();
    limiter.curve = limiterCurve(OUTPUT_CEILING);
    limiter.oversample = '2x';
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    return ctx;
  }

  function isBlue() {
    return document.documentElement.classList.contains('theme-deepseek');
  }

  function ready() {
    if (muted) return false;
    return Boolean(audioContext());
  }

  function unlock() {
    if (!muted) audioContext();
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (master.gain.cancelAndHoldAtTime) {
      master.gain.cancelAndHoldAtTime(now);
    } else {
      const current = master.gain.value;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(current, now);
    }
    master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_LEVEL, now + 0.06);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function noiseBuffer() {
    if (noise) return noise;
    const length = Math.floor(ctx.sampleRate);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function envelope(gain, at, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  function tone(options) {
    const at = options.at;
    const attack = options.attack == null ? 0.004 : options.attack;
    const decay = options.decay == null ? 0.2 : options.decay;
    const osc = ctx.createOscillator();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, options.freq), at);
    if (options.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), at + attack + decay);
    }
    if (options.detune) osc.detune.setValueAtTime(options.detune, at);
    let tail = osc;
    if (options.cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(options.cutoff, at);
      filter.Q.value = options.q == null ? 0.7 : options.q;
      tail.connect(filter);
      tail = filter;
    }
    const gain = ctx.createGain();
    envelope(gain, at, options.gain == null ? 0.1 : options.gain, attack, decay);
    tail.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + attack + decay + 0.03);
    osc.onended = () => osc.disconnect();
  }

  function hiss(options) {
    const at = options.at;
    const dur = options.dur == null ? 0.1 : options.dur;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = options.type || 'bandpass';
    filter.Q.value = options.q == null ? 0.8 : options.q;
    filter.frequency.setValueAtTime(Math.max(20, options.freq), at);
    if (options.to) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), at + dur);
    }
    const gain = ctx.createGain();
    envelope(gain, at, options.gain == null ? 0.06 : options.gain, Math.min(0.01, dur * 0.25), dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(at, Math.random() * 0.6, dur + 0.03);
    src.stop(at + dur + 0.05);
    src.onended = () => src.disconnect();
  }

  function claim(side) {
    if (!ready()) return;
    const blue = isBlue();
    const first = side === 0;
    const at = ctx.currentTime + 0.005;
    const base = blue ? (first ? 659.25 : 987.77) : (first ? 523.25 : 392);
    const sub = blue ? (first ? 164.81 : 246.94) : (first ? 130.81 : 98);
    tone({
      type: 'sine',
      freq: sub * 1.55,
      to: sub,
      at,
      attack: 0.004,
      decay: blue ? 0.11 : 0.14,
      gain: blue ? 0.17 : 0.24
    });
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: base * rand(0.994, 1.006),
      at: at + 0.003,
      attack: 0.003,
      decay: blue ? 0.24 : 0.27,
      gain: blue ? 0.1 : 0.11,
      cutoff: blue ? 7000 : 2400
    });
    if (blue) {
      tone({ type: 'sine', freq: base * 2, at: at + 0.008, attack: 0.002, decay: 0.14, gain: 0.045 });
    } else {
      tone({
        type: 'triangle',
        freq: base * 2 * rand(0.996, 1.004),
        at: at + 0.01,
        attack: 0.002,
        decay: 0.1,
        gain: 0.028,
        cutoff: 3200
      });
    }
    hiss({ at, dur: 0.03, gain: blue ? 0.045 : 0.06, freq: blue ? 3600 : 1800, q: 1.1 });
  }

  function denied() {
    if (!ready()) return;
    const blue = isBlue();
    const at = ctx.currentTime + 0.004;
    const freqs = blue ? [1240, 980] : [220, 180];
    freqs.forEach((freq, index) => {
      tone({
        type: blue ? 'sine' : 'triangle',
        freq,
        at: at + index * 0.075,
        attack: 0.002,
        decay: 0.055,
        gain: blue ? 0.055 : 0.085,
        cutoff: blue ? 4200 : 900
      });
    });
    hiss({ at, dur: 0.02, gain: blue ? 0.03 : 0.04, freq: blue ? 3200 : 700, q: 1 });
  }

  function reveal(first) {
    if (!ready()) return;
    const blue = isBlue();
    const p1 = first === 0;
    const at = ctx.currentTime + 0.004;
    const root = blue ? (p1 ? 523.25 : 659.25) : (p1 ? 392 : 329.63);
    const up = blue ? (p1 ? 783.99 : 987.77) : (p1 ? 587.33 : 493.88);
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: root,
      at,
      attack: 0.005,
      decay: 0.28,
      gain: 0.055,
      cutoff: blue ? 7000 : 2600
    });
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: up,
      at: at + 0.085,
      attack: 0.005,
      decay: 0.34,
      gain: 0.05,
      cutoff: blue ? 7000 : 2600
    });
    if (blue) {
      tone({ type: 'sine', freq: up * 2, at: at + 0.09, attack: 0.004, decay: 0.18, gain: 0.018 });
    }
  }

  function handoff(side) {
    if (!ready()) return;
    const blue = isBlue();
    const p1 = side === 0;
    const at = ctx.currentTime + 0.14;
    const base = blue ? (p1 ? 659.25 : 987.77) : (p1 ? 523.25 : 392);
    const sub = blue ? (p1 ? 164.81 : 246.94) : (p1 ? 130.81 : 98);
    hiss({
      at,
      dur: blue ? 0.32 : 0.4,
      gain: blue ? 0.035 : 0.045,
      freq: blue ? 1000 : 420,
      to: blue ? 5000 : 1800,
      q: 0.6
    });
    tone({ type: 'sine', freq: sub * 2, to: sub, at, attack: 0.02, decay: blue ? 0.34 : 0.42, gain: 0.09 });
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: base,
      at: at + 0.04,
      attack: 0.01,
      decay: 0.3,
      gain: 0.045,
      cutoff: blue ? 7000 : 2600
    });
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: base * 1.5,
      at: at + 0.13,
      attack: 0.008,
      decay: 0.24,
      gain: 0.035,
      cutoff: blue ? 7000 : 2600
    });
  }

  function confirm(side) {
    if (!ready()) return;
    const blue = isBlue();
    const first = side === 0;
    const at = ctx.currentTime + 0.003;
    tone({
      type: blue ? 'sine' : 'triangle',
      freq: blue ? (first ? 783.99 : 1174.66) : (first ? 659.25 : 523.25),
      at,
      attack: 0.002,
      decay: 0.1,
      gain: 0.06,
      cutoff: blue ? 8000 : 3000
    });
    hiss({ at, dur: 0.02, gain: 0.04, freq: 4000, q: 0.9 });
  }

  function playNotes(notes, at, blue, gain, decay, cutoff) {
    notes.forEach((freq, index) => {
      tone({
        type: blue ? 'sine' : 'triangle',
        freq,
        at: at + index * 0.09,
        attack: 0.006,
        decay,
        gain,
        cutoff
      });
    });
  }

  function outcome(options) {    if (!ready()) return;
    const blue = isBlue();
    const winner = options.winner;
    const local = Boolean(options.local);
    const at = ctx.currentTime + 0.02;

    if (winner !== 0 && winner !== 1) {
      playNotes([blue ? 440 : 392, blue ? 659.25 : 587.33], at, blue, 0.07, 0.5, blue ? 7000 : 2400);
      tone({ type: 'sine', freq: 110, at, attack: 0.01, decay: 0.6, gain: 0.08 });
      return;
    }

    if (local) {
      const p1 = winner === 0;
      const notes = blue
        ? (p1 ? [523.25, 659.25, 783.99] : [659.25, 830.61, 987.77])
        : (p1 ? [392, 493.88, 587.33] : [329.63, 415.3, 493.88]);
      playNotes(notes, at, blue, 0.085, 0.55, blue ? 7000 : 2600);
      tone({ type: 'sine', freq: p1 ? 130.81 : 98, at, attack: 0.01, decay: 0.5, gain: 0.1 });
      hiss({ at: at + 0.08, dur: 0.4, gain: 0.025, freq: 2400, to: 6200, q: 0.6 });
      return;
    }

    if (winner === 0) {
      playNotes([523.25, 659.25, 783.99], at, blue, 0.085, 0.55, blue ? 7000 : 2800);
      tone({ type: 'sine', freq: 130.81, at, attack: 0.01, decay: 0.5, gain: 0.1 });
      hiss({ at: at + 0.08, dur: 0.36, gain: 0.03, freq: 2600, to: 6400, q: 0.6 });
      return;
    }

    playNotes([392, 311.13, 261.63], at, blue, 0.075, 0.55, blue ? 5000 : 1400);
    tone({ type: 'sine', freq: 98, at, attack: 0.01, decay: 0.55, gain: 0.09 });
    hiss({ at, dur: 0.4, gain: 0.025, freq: 900, to: 300, q: 0.5 });
  }

  return {
    unlock,
    setMuted,
    claim,
    denied,
    reveal,
    handoff,
    confirm,
    outcome
  };
});
