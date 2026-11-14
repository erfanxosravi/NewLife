import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventDefinition, TimelineEntry } from '../engine/types';
import {
  YearSequenceController,
  getTimingProfile,
  isBirthdayMilestoneAge,
  type YearTransitionPayload,
} from './yearSequence';

function makeEntry(id: string): TimelineEntry {
  return {
    id,
    age: 18,
    jalaliYear: 1404,
    title: `رویداد ${id}`,
    text: 'متن آزمایشی رویداد سالانه',
    type: 'life',
  };
}

const mockEvent: EventDefinition = {
  id: 'test_event',
  category: 'young_adult',
  titleFa: 'تصمیم مهم',
  textFa: 'متن تصمیم',
  contentTag: 'mild',
  weight: 1,
  maxOccurrences: 1,
  conditions: {},
  choices: [
    {
      id: 'c1',
      labelFa: 'گزینه اول',
      effects: { resultTextFa: 'نتیجه' },
    },
  ],
};

function makePayload(overrides: Partial<YearTransitionPayload> = {}): YearTransitionPayload {
  return {
    fromAge: 17,
    toAge: 18,
    fromYear: 1403,
    toYear: 1404,
    isDeath: false,
    isBirthdayMilestone: true,
    isNowruzYear: false,
    newEntries: [makeEntry('e1'), makeEntry('e2'), makeEntry('e3')],
    statDeltas: { happiness: 5, health: -2 },
    moneyDelta: 2_000_000,
    pendingEvent: mockEvent,
    hasPositiveOutcome: true,
    hasNegativeOutcome: false,
    ...overrides,
  };
}

describe('YearSequenceController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('progresses strictly in non-overlapping phase order and blocks concurrent starts', () => {
    vi.useFakeTimers();
    const ctrl = new YearSequenceController();
    const payload = makePayload();

    const started = ctrl.start(payload, 'normal', false);
    expect(started).toBe(true);
    expect(ctrl.getSnapshot().phase).toBe('button_feedback');

    // Attempt double tap while active -> must be rejected
    const secondStart = ctrl.start(makePayload({ toAge: 19 }), 'normal', false);
    expect(secondStart).toBe(false);
    expect(ctrl.getSnapshot().payload?.toAge).toBe(18);

    // Advance through all phases
    vi.advanceTimersByTime(5000);

    const snap = ctrl.getSnapshot();
    expect(snap.phase).toBe('idle');
    expect(snap.revealedEntryCount).toBe(3);
    expect(snap.statsApplied).toBe(true);
    expect(snap.eventOpen).toBe(true);

    expect(ctrl.getPhaseHistory()).toEqual([
      'button_feedback',
      'overlay',
      'feed',
      'stats',
      'event_ready',
      'idle',
    ]);
  });

  it('skip() jumps immediately to revealed final state and opens pending event', () => {
    vi.useFakeTimers();
    const ctrl = new YearSequenceController();
    const payload = makePayload();

    ctrl.start(payload, 'normal', false);
    // Advance into overlay phase
    vi.advanceTimersByTime(150);
    expect(ctrl.getSnapshot().phase).toBe('overlay');
    expect(ctrl.getSnapshot().revealedEntryCount).toBe(0);
    expect(ctrl.getSnapshot().statsApplied).toBe(false);

    ctrl.skip();

    const snap = ctrl.getSnapshot();
    expect(snap.phase).toBe('idle');
    expect(snap.revealedEntryCount).toBe(3);
    expect(snap.statsApplied).toBe(true);
    expect(snap.eventOpen).toBe(true);

    // Ensure no leftover timers alter state later
    vi.advanceTimersByTime(5000);
    expect(ctrl.getSnapshot().phase).toBe('idle');
  });

  it('skip() during feed stagger completes remaining entries without errors', () => {
    vi.useFakeTimers();
    const ctrl = new YearSequenceController();
    const payload = makePayload({ pendingEvent: null });

    ctrl.start(payload, 'normal', false);
    // Advance past button + milestone overlay (~110 + 1416) + initial feed delay
    vi.advanceTimersByTime(1650);
    expect(ctrl.getSnapshot().phase).toBe('feed');
    expect(ctrl.getSnapshot().revealedEntryCount).toBeLessThan(3);

    ctrl.skip();

    const snap = ctrl.getSnapshot();
    expect(snap.phase).toBe('idle');
    expect(snap.revealedEntryCount).toBe(3);
    expect(snap.statsApplied).toBe(true);
    expect(snap.eventOpen).toBe(false);
  });

  it('respects prefers-reduced-motion by disabling confetti, rolling digits, stagger, and wobble', () => {
    vi.useFakeTimers();
    const profile = getTimingProfile('normal', true);
    expect(profile.reducedMotion).toBe(true);
    expect(profile.allowConfetti).toBe(false);
    expect(profile.allowRollingDigits).toBe(false);
    expect(profile.allowStagger).toBe(false);
    expect(profile.allowWobble).toBe(false);
    expect(profile.allowTypewriter).toBe(false);

    const ctrl = new YearSequenceController();
    const payload = makePayload();
    ctrl.start(payload, 'normal', true);

    // In reduced motion, sequence completes rapidly (~40 + 264 + 50 + 120 < 600ms)
    vi.advanceTimersByTime(650);
    const snap = ctrl.getSnapshot();
    expect(snap.phase).toBe('idle');
    expect(snap.revealedEntryCount).toBe(3);
    expect(snap.statsApplied).toBe(true);
    expect(snap.eventOpen).toBe(true);
  });

  it('handles animation speed "off" immediately without timers', () => {
    const ctrl = new YearSequenceController();
    const payload = makePayload();
    const started = ctrl.start(payload, 'off', false);
    expect(started).toBe(true);

    const snap = ctrl.getSnapshot();
    expect(snap.phase).toBe('idle');
    expect(snap.revealedEntryCount).toBe(3);
    expect(snap.statsApplied).toBe(true);
    expect(snap.eventOpen).toBe(true);
  });

  it('identifies birthday milestones accurately', () => {
    expect(isBirthdayMilestoneAge(10)).toBe(true);
    expect(isBirthdayMilestoneAge(18)).toBe(true);
    expect(isBirthdayMilestoneAge(20)).toBe(true);
    expect(isBirthdayMilestoneAge(40)).toBe(true);
    expect(isBirthdayMilestoneAge(17)).toBe(false);
    expect(isBirthdayMilestoneAge(0)).toBe(false);
  });
});
