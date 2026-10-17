import { getSettings } from './settings';

// Click sounds synthesized with the Web Audio API, so there are no audio files to host.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  endFreq?: number;
  duration?: number;
  type?: OscillatorType;
  peak?: number;
}

function playTone({ freq, endFreq, duration = 0.09, type = 'triangle', peak = 0.2 }: Tone): void {
  if (!getSettings().sound) return;
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export const playPickupSound = () => playTone({ freq: 500, endFreq: 620, duration: 0.05, type: 'sine', peak: 0.1 });
export const playPlaceSound = () => playTone({ freq: 700, endFreq: 420, duration: 0.09, peak: 0.22 });
export const playReturnSound = () => playTone({ freq: 320, endFreq: 220, duration: 0.07, type: 'sine', peak: 0.12 });
export const playSolvedSound = () => {
  playTone({ freq: 660, duration: 0.1, peak: 0.22 });
  window.setTimeout(() => playTone({ freq: 880, duration: 0.16, peak: 0.22 }), 90);
};
