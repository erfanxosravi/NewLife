import { getSavedSoundEnabled } from '../storage/saveStore';

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
  delaySec = 0,
): void {
  if (!getSavedSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // Ignore audio context errors in restricted environments
  }
}

export function playYearTickSound(): void {
  playTone(540, 380, 0.055, 0.04, 'triangle');
}

export function playPositiveMilestoneSound(): void {
  playTone(523.25, 523.25, 0.14, 0.05, 'sine', 0);
  playTone(659.25, 659.25, 0.22, 0.055, 'sine', 0.09);
}

export function playNegativeEventSound(): void {
  playTone(240, 170, 0.24, 0.045, 'sine', 0);
}
