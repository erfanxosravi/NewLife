import type { EventDefinition, PlayerStats, TimelineEntry } from '../engine/types';
import type { AnimationSpeed } from '../storage/saveStore';

export type SequencePhase =
  | 'idle'
  | 'button_feedback'
  | 'overlay'
  | 'feed'
  | 'stats'
  | 'event_ready';

export interface YearTransitionPayload {
  fromAge: number;
  toAge: number;
  fromYear: number;
  toYear: number;
  isDeath: boolean;
  isBirthdayMilestone: boolean;
  isNowruzYear: boolean;
  newEntries: TimelineEntry[];
  statDeltas: Partial<Record<keyof PlayerStats, number>>;
  moneyDelta: number;
  pendingEvent: EventDefinition | null;
  hasPositiveOutcome: boolean;
  hasNegativeOutcome: boolean;
}

export interface TimingProfile {
  instant: boolean;
  reducedMotion: boolean;
  buttonMs: number;
  overlayMs: number;
  feedStaggerMs: number;
  feedInitialDelayMs: number;
  statsDelayMs: number;
  eventDelayMs: number;
  allowConfetti: boolean;
  allowRollingDigits: boolean;
  allowStagger: boolean;
  allowTypewriter: boolean;
  allowWobble: boolean;
}

export interface YearSequenceSnapshot {
  phase: SequencePhase;
  payload: YearTransitionPayload | null;
  revealedEntryCount: number;
  statsApplied: boolean;
  eventOpen: boolean;
  sequenceId: number;
}

export interface SequenceScheduler {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
}

const defaultScheduler: SequenceScheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

export function isBirthdayMilestoneAge(age: number): boolean {
  if (age <= 0) return false;
  return age === 18 || age % 10 === 0;
}

export function getTimingProfile(
  speed: AnimationSpeed,
  prefersReducedMotion: boolean,
): TimingProfile {
  if (prefersReducedMotion) {
    return {
      instant: false,
      reducedMotion: true,
      buttonMs: 40,
      overlayMs: 220,
      feedStaggerMs: 0,
      feedInitialDelayMs: 0,
      statsDelayMs: 50,
      eventDelayMs: 120,
      allowConfetti: false,
      allowRollingDigits: false,
      allowStagger: false,
      allowTypewriter: false,
      allowWobble: false,
    };
  }

  if (speed === 'off') {
    return {
      instant: true,
      reducedMotion: false,
      buttonMs: 0,
      overlayMs: 0,
      feedStaggerMs: 0,
      feedInitialDelayMs: 0,
      statsDelayMs: 0,
      eventDelayMs: 0,
      allowConfetti: false,
      allowRollingDigits: false,
      allowStagger: false,
      allowTypewriter: false,
      allowWobble: false,
    };
  }

  if (speed === 'fast') {
    return {
      instant: false,
      reducedMotion: false,
      buttonMs: 75,
      overlayMs: 650,
      feedStaggerMs: 55,
      feedInitialDelayMs: 40,
      statsDelayMs: 160,
      eventDelayMs: 200,
      allowConfetti: true,
      allowRollingDigits: true,
      allowStagger: true,
      allowTypewriter: false,
      allowWobble: true,
    };
  }

  return {
    instant: false,
    reducedMotion: false,
    buttonMs: 110,
    overlayMs: 1180,
    feedStaggerMs: 100,
    feedInitialDelayMs: 70,
    statsDelayMs: 240,
    eventDelayMs: 380,
    allowConfetti: true,
    allowRollingDigits: true,
    allowStagger: true,
    allowTypewriter: true,
    allowWobble: true,
  };
}

export class YearSequenceController {
  private snapshot: YearSequenceSnapshot = {
    phase: 'idle',
    payload: null,
    revealedEntryCount: 0,
    statsApplied: true,
    eventOpen: false,
    sequenceId: 0,
  };

  private timers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<(snap: YearSequenceSnapshot) => void>();
  private phaseHistory: SequencePhase[] = [];
  private scheduler: SequenceScheduler;

  constructor(scheduler: SequenceScheduler = defaultScheduler) {
    this.scheduler = scheduler;
  }

  subscribe(listener: (snap: YearSequenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): YearSequenceSnapshot {
    return this.snapshot;
  }

  getPhaseHistory(): SequencePhase[] {
    return [...this.phaseHistory];
  }

  private emit(partial: Partial<YearSequenceSnapshot>) {
    const prevPhase = this.snapshot.phase;
    this.snapshot = { ...this.snapshot, ...partial };
    if (partial.phase && partial.phase !== prevPhase) {
      this.phaseHistory.push(partial.phase);
    }
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private schedule(fn: () => void, ms: number) {
    const id = this.scheduler.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private clearAllTimers() {
    for (const id of this.timers) {
      this.scheduler.clearTimeout(id);
    }
    this.timers.clear();
  }

  start(
    payload: YearTransitionPayload,
    speed: AnimationSpeed,
    prefersReducedMotion: boolean,
  ): boolean {
    if (this.snapshot.phase !== 'idle') {
      return false;
    }

    this.clearAllTimers();
    this.phaseHistory = [];
    const nextId = this.snapshot.sequenceId + 1;
    const timing = getTimingProfile(speed, prefersReducedMotion);

    if (timing.instant) {
      this.emit({
        sequenceId: nextId,
        phase: 'idle',
        payload,
        revealedEntryCount: payload.newEntries.length,
        statsApplied: true,
        eventOpen: Boolean(payload.pendingEvent),
      });
      return true;
    }

    this.emit({
      sequenceId: nextId,
      phase: 'button_feedback',
      payload,
      revealedEntryCount: 0,
      statsApplied: false,
      eventOpen: false,
    });

    this.schedule(() => {
      if (this.snapshot.sequenceId !== nextId) return;
      this.emit({ phase: 'overlay' });

      const overlayDuration = payload.isDeath
        ? Math.round(timing.overlayMs * 1.15)
        : payload.isBirthdayMilestone
          ? Math.round(timing.overlayMs * 1.2)
          : timing.overlayMs;

      this.schedule(() => {
        if (this.snapshot.sequenceId !== nextId) return;
        this.enterFeedPhase(nextId, payload, timing);
      }, overlayDuration);
    }, timing.buttonMs);

    return true;
  }

  private enterFeedPhase(
    seqId: number,
    payload: YearTransitionPayload,
    timing: TimingProfile,
  ) {
    const total = payload.newEntries.length;

    if (!timing.allowStagger || total <= 1) {
      this.emit({
        phase: 'feed',
        revealedEntryCount: total,
      });
      this.schedule(() => {
        if (this.snapshot.sequenceId !== seqId) return;
        this.enterStatsPhase(seqId, payload, timing);
      }, timing.statsDelayMs);
      return;
    }

    this.emit({
      phase: 'feed',
      revealedEntryCount: 0,
    });

    for (let i = 0; i < total; i++) {
      const delay = timing.feedInitialDelayMs + i * timing.feedStaggerMs;
      this.schedule(() => {
        if (this.snapshot.sequenceId !== seqId) return;
        const count = i + 1;
        this.emit({ revealedEntryCount: count });
        if (count === total) {
          this.schedule(() => {
            if (this.snapshot.sequenceId !== seqId) return;
            this.enterStatsPhase(seqId, payload, timing);
          }, timing.statsDelayMs);
        }
      }, delay);
    }
  }

  private enterStatsPhase(
    seqId: number,
    payload: YearTransitionPayload,
    timing: TimingProfile,
  ) {
    this.emit({
      phase: 'stats',
      statsApplied: true,
    });

    if (payload.pendingEvent) {
      this.schedule(() => {
        if (this.snapshot.sequenceId !== seqId) return;
        this.emit({
          phase: 'event_ready',
          eventOpen: true,
        });
        this.emit({ phase: 'idle' });
      }, timing.eventDelayMs);
    } else {
      this.emit({ phase: 'idle' });
    }
  }

  skip(): void {
    if (this.snapshot.phase === 'idle' || !this.snapshot.payload) return;
    this.clearAllTimers();
    const payload = this.snapshot.payload;
    if (payload.pendingEvent) {
      this.emit({
        revealedEntryCount: payload.newEntries.length,
        statsApplied: true,
        phase: 'event_ready',
        eventOpen: true,
      });
      this.emit({ phase: 'idle' });
    } else {
      this.emit({
        revealedEntryCount: payload.newEntries.length,
        statsApplied: true,
        eventOpen: false,
        phase: 'idle',
      });
    }
  }

  clearEvent(): void {
    if (!this.snapshot.eventOpen) return;
    this.emit({ eventOpen: false });
  }

  reset(): void {
    this.clearAllTimers();
    this.phaseHistory = [];
    this.emit({
      phase: 'idle',
      payload: null,
      revealedEntryCount: 0,
      statsApplied: true,
      eventOpen: false,
    });
  }
}
