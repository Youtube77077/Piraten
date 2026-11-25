/**
 * Sound effects, synthesized live with the Web Audio API (no audio files).
 * Every envelope uses exponential/target curves — nothing ramps linearly.
 * Browsers only allow audio after a user gesture; `unlockAudio()` is called on the
 * first tap/keypress, and every effect is a silent no-op until then or when muted.
 */
import { getSettings } from './settings';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): Ctx | null {
  if (!getSettings().sound) return null;
  if (!ctx) {
    const C: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

export function unlockAudio() {
  audio();
}

function noise(c: Ctx) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

const E = 0.0001; // exponential ramps can't touch zero

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  vol: number;
  at?: number;
  attack?: number;
  detune?: number;
}

function tone({ freq, to, type = 'sine', dur, vol, at = 0, attack = 0.006, detune = 0 }: ToneOpts) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(E, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(E, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  vol: number;
  from: number;
  to: number;
  at?: number;
  attack?: number;
  type?: BiquadFilterType;
  q?: number;
}

function sweep({ dur, vol, from, to, at = 0, attack = 0.02, type = 'bandpass', q = 1.2 }: NoiseOpts) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const n = noise(c);
  const f = c.createBiquadFilter();
  const g = c.createGain();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(E, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(E, t + dur);
  n.connect(f).connect(g).connect(master);
  n.start(t);
  n.stop(t + dur + 0.05);
}

/* ------------------------------------------------------------------ effects */

export const sfx = {
  /** Button press. */
  tap() {
    tone({ freq: 900, to: 520, type: 'triangle', dur: 0.09, vol: 0.2 });
    sweep({ dur: 0.04, vol: 0.06, from: 5000, to: 3000, type: 'highpass', attack: 0.002 });
  },
  /** Very soft key tick while typing. */
  key() {
    tone({ freq: 1500 + Math.random() * 300, to: 1100, dur: 0.035, vol: 0.035 });
  },
  /** Gentle "nope" for invalid input. */
  error() {
    tone({ freq: 240, to: 200, type: 'square', dur: 0.09, vol: 0.05 });
    tone({ freq: 200, to: 170, type: 'square', dur: 0.12, vol: 0.05, at: 0.1 });
  },
  /** Searching shimmer while the account "loads". */
  search() {
    sweep({ dur: 0.9, vol: 0.08, from: 600, to: 3200, attack: 0.3 });
    [0, 0.18, 0.36, 0.54].forEach((at, i) => tone({ freq: 1200 + i * 220, dur: 0.12, vol: 0.04, at }));
  },
  /** Account found. */
  found() {
    tone({ freq: 659, type: 'triangle', dur: 0.22, vol: 0.18 });
    tone({ freq: 988, type: 'triangle', dur: 0.32, vol: 0.18, at: 0.09 });
    tone({ freq: 1976, dur: 0.25, vol: 0.05, at: 0.12 });
  },
  /** Profile card flip-in. */
  reveal() {
    sweep({ dur: 0.45, vol: 0.2, from: 300, to: 2600, attack: 0.15 });
    tone({ freq: 150, to: 55, dur: 0.35, vol: 0.35, at: 0.28 });
  },
  /** Level counter rolling up. */
  count(duration = 0.8) {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const p = i / (steps - 1);
      const at = duration * (1 - Math.pow(1 - p, 2)); // ease-out spacing
      tone({ freq: 700 + p * 700, type: 'triangle', dur: 0.05, vol: 0.05 + p * 0.03, at });
    }
  },
  /** Menu drawer. */
  menu(open: boolean) {
    sweep({ dur: 0.24, vol: 0.09, from: open ? 500 : 1800, to: open ? 1800 : 500, attack: 0.06 });
  },
  /** Back home after the reward. */
  home() {
    sweep({ dur: 0.5, vol: 0.12, from: 2400, to: 400, attack: 0.08 });
  },
  /**
   * Charge build-up that lasts `seconds`: a soft, warm pad (C + G + octave, gently
   * filtered) that swells and rises a fifth, plus quiet bell ticks that speed up and
   * climb a pentatonic scale toward 100%. Returns a stop function.
   */
  charge(seconds: number) {
    const c = audio();
    if (!c || !master) return () => undefined;
    const t = c.currentTime;
    const voices: OscillatorNode[] = [];

    // warm pad
    const pad = c.createGain();
    pad.gain.setValueAtTime(E, t);
    pad.gain.setTargetAtTime(0.03, t, seconds * 0.25);
    pad.gain.setTargetAtTime(0.05, t + seconds * 0.6, seconds * 0.2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.setTargetAtTime(1800, t, seconds * 0.5);
    lp.connect(pad).connect(master);
    [
      { f: 261.63, type: 'triangle' as OscillatorType },
      { f: 392.0, type: 'triangle' as OscillatorType },
      { f: 523.25, type: 'sine' as OscillatorType },
    ].forEach(({ f, type }, i) => {
      const o = c.createOscillator();
      o.type = type;
      o.detune.value = i === 1 ? 4 : i === 2 ? -4 : 0;
      o.frequency.setValueAtTime(f, t);
      o.frequency.setTargetAtTime(f * 1.5, t + 0.2, seconds * 0.45); // smooth rise of a fifth
      o.connect(lp);
      o.start(t);
      voices.push(o);
    });

    // accelerating bell ticks on a pentatonic scale
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
    let at = 0.15;
    while (at < seconds - 0.05) {
      const p = at / seconds;
      const f = scale[Math.min(scale.length - 1, Math.floor(p * scale.length))];
      const o = c.createOscillator();
      const g = c.createGain();
      const st = t + at;
      o.type = 'sine';
      o.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(E, st);
      g.gain.exponentialRampToValueAtTime(0.022 + p * 0.022, st + 0.006);
      g.gain.exponentialRampToValueAtTime(E, st + 0.22);
      o.connect(g).connect(master);
      o.start(st);
      o.stop(st + 0.25);
      voices.push(o);
      at += 0.34 - 0.24 * Math.pow(p, 0.8); // 0.34 s apart at first, ~0.1 s near the end
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const s = c.currentTime;
      pad.gain.cancelScheduledValues(s);
      pad.gain.setTargetAtTime(E, s, 0.04);
      voices.forEach((o) => {
        try {
          o.stop(s + 0.25);
        } catch {
          /* already stopped */
        }
      });
    };
  },
  /** Status step tick during the charge. */
  step() {
    tone({ freq: 1320, type: 'triangle', dur: 0.12, vol: 0.08 });
  },
  /** The big moment: impact + bright fanfare. */
  burst() {
    tone({ freq: 130, to: 38, dur: 0.75, vol: 0.7, attack: 0.004 });
    sweep({ dur: 0.7, vol: 0.4, from: 3000, to: 160, type: 'lowpass', q: 0.8, attack: 0.004 });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone({ freq: f, type: 'triangle', dur: 1.3, vol: 0.1, at: 0.05 + i * 0.045, attack: 0.01 });
      tone({ freq: f, type: 'sine', dur: 1.1, vol: 0.05, at: 0.05 + i * 0.045, detune: 8 });
    });
    for (let i = 0; i < 8; i++) tone({ freq: 2000 + Math.random() * 2400, dur: 0.18, vol: 0.035, at: 0.25 + i * 0.07 });
  },
  /** Completion sparkle. */
  complete() {
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.09, at: i * 0.07 }));
  },
};
