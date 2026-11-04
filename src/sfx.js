/* Small synthesized sounds: no files, nothing loads until the first gesture. */

let ctx = null, master = null, noiseBuf = null;
let muted = false;
try {
  muted = localStorage.getItem('four-rolls-muted') === '1';
} catch {}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.004, slide = 0, delay = 0 } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(dur, { gain = 0.15, type = 'bandpass', freq = 2000, q = 1, delay = 0, sweep = 1 } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  /** A dry mechanical tick; pitch > 1 sounds brighter. */
  tick(pitch = 1, gain = 0.12) {
    hiss(0.03, { gain, freq: 3200 * pitch, q: 6 });
    tone(1400 * pitch, 0.03, { type: 'triangle', gain: gain * 0.4 });
  },
  clack() {
    hiss(0.06, { gain: 0.3, freq: 900, q: 2 });
    tone(180, 0.08, { type: 'square', gain: 0.05, slide: 0.6 });
    hiss(0.05, { gain: 0.2, freq: 1600, q: 3, delay: 0.09 });
  },
  paper() {
    hiss(0.28, { gain: 0.14, freq: 1800, q: 0.7, sweep: 2.2 });
  },
  pen() {
    hiss(0.35, { gain: 0.08, freq: 3600, q: 8, sweep: 1.3 });
    tone(2200, 0.25, { type: 'sine', gain: 0.012, slide: 1.2 });
  },
  splash(gain = 0.18) {
    hiss(0.45, { gain, type: 'lowpass', freq: 1400, sweep: 0.35 });
  },
  pop() {
    tone(660, 0.14, { gain: 0.1, slide: 1.5 });
  },
  nope() {
    tone(220, 0.18, { type: 'triangle', gain: 0.1, slide: 0.8 });
  },
  /** Two soft bell notes: something clicked into place. */
  chime() {
    tone(1046.5, 0.9, { gain: 0.09 });
    tone(1568, 1.1, { gain: 0.06, delay: 0.09 });
    tone(2093, 0.6, { gain: 0.02, delay: 0.09 });
  },
  /** A small rising arpeggio for milestones. */
  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.9, { gain: 0.07, delay: i * 0.09 }));
  },
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('four-rolls-muted', muted ? '1' : '0');
    } catch {}
    if (ac()) master.gain.value = muted ? 0 : 0.55;
    return muted;
  },
};
