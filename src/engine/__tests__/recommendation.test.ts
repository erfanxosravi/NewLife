import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import {
  ensureActivityRuntimeState,
  getPinnedUrgentAlert,
  getSmartRecommendations,
  pickNonRepeatingActivityOutcome,
  STANDARD_ACTIVITY_CATEGORIES,
} from '../recommendation';
import {
  performActivityAction,
  runAdvanceYearWithTick,
  toggleFavoriteActivityAction,
  undoLastActivityAction,
} from '../../state/actions';

describe('Activities Expansion, Non-Repeating Outcomes & Smart Recommendations', () => {
  it('enforces 8..12 activities per standard category, >=5 unique outcomes, and zero Latin characters', () => {
    for (const category of STANDARD_ACTIVITY_CATEGORIES) {
      const list = gameDataset.activities.filter((a) => a.category === category);
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(list.length).toBeLessThanOrEqual(12);

      for (const act of list) {
        expect(/[A-Za-z]/.test(act.titleFa)).toBe(false);
        expect(/[A-Za-z]/.test(act.effectHintFa)).toBe(false);
        expect(act.outcomes.length).toBeGreaterThanOrEqual(5);
        const uniqueTexts = new Set(act.outcomes.map((o) => o.resultTextFa.trim()));
        expect(uniqueTexts.size).toBe(act.outcomes.length);
        for (const out of act.outcomes) {
          expect(/[A-Za-z]/.test(out.resultTextFa)).toBe(false);
        }
      }
    }
  });

  it('cycles through all 5 distinct outcomes without repeating until exhausted', () => {
    let save = createNewSaveGame({ seed: 'non-repeat-test', socialClass: 'wealthy' }, gameDataset);
    while (save.state.player.age < 22) {
      save = runAdvanceYearWithTick(save, gameDataset);
    }

    const act = gameDataset.activities.find((a) => a.category === 'learning' && a.minAge <= 20)!;
    const seenResultTexts = new Set<string>();

    let state = save.state;
    for (let i = 0; i < act.outcomes.length; i++) {
      const pick = pickNonRepeatingActivityOutcome(
        act,
        state,
        `test-seed:${i}`,
      );
      expect(seenResultTexts.has(pick.outcome.resultTextFa)).toBe(false);
      seenResultTexts.add(pick.outcome.resultTextFa);
      state = {
        ...state,
        activityState: {
          ...ensureActivityRuntimeState(state),
          seenOutcomeMap: {
            ...(state.activityState?.seenOutcomeMap ?? {}),
            [act.id]: pick.nextSeenIndices,
          },
        },
      };
    }

    expect(seenResultTexts.size).toBe(act.outcomes.length);
  });

  it('guarantees strict unique categories in top 5 smart recommendations & health emergency override', () => {
    let save = createNewSaveGame({ seed: 'smart-rec-seed', socialClass: 'wealthy' }, gameDataset);
    while (save.state.player.age < 22) {
      save = runAdvanceYearWithTick(save, gameDataset);
    }

    const top5 = getSmartRecommendations(save, gameDataset, 5);
    expect(top5.length).toBe(5);
    const categories = new Set(top5.map((r) => r.activity.category));
    expect(categories.size).toBe(5);

    // Health < 20 triggers pinned urgent alert & puts health #1
    const criticalHealthSave = {
      ...save,
      state: {
        ...save.state,
        player: {
          ...save.state.player,
          stats: { ...save.state.player.stats, health: 12 },
        },
      },
    };
    const urgent = getPinnedUrgentAlert(criticalHealthSave, gameDataset);
    expect(urgent).not.toBeNull();
    expect(urgent?.activity.category).toBe('health');
    expect(urgent?.actions.length).toBeGreaterThanOrEqual(2);
    expect(urgent?.actions.every((a) => a.category === 'health')).toBe(true);

    const urgentTop = getSmartRecommendations(criticalHealthSave, gameDataset, 5);
    expect(urgentTop.length).toBeGreaterThan(0);
    expect(urgentTop[0].activity.category).toBe('health');
  });

  it('tracks annual quota of 5, supports favorites and exact undo, and resets quota next year', () => {
    let save = createNewSaveGame({ seed: 'quota-undo-test', socialClass: 'wealthy' }, gameDataset);
    while (save.state.player.age < 22) {
      save = runAdvanceYearWithTick(save, gameDataset);
    }

    const candidates = gameDataset.activities
      .filter((a) => STANDARD_ACTIVITY_CATEGORIES.includes(a.category) && a.minAge <= 22 && a.costToman === 0)
      .slice(0, 6);
    expect(candidates.length).toBe(6);

    save = toggleFavoriteActivityAction(save, candidates[0].id);
    expect(save.state.activityState?.favoriteIds).toContain(candidates[0].id);

    const beforeFirst = {
      stats: { ...save.state.player.stats },
      money: save.state.player.moneyToman,
      timelineLen: save.state.timeline.length,
    };

    const res1 = performActivityAction(save, candidates[0]);
    expect(res1.success).toBe(true);
    expect(res1.pickedOutcome).toBeDefined();
    expect(res1.save.state.activityState?.quotaUsedThisTurn).toBe(candidates[0].quotaCost ?? 1);

    const undone = undoLastActivityAction(res1.save);
    expect(undone.success).toBe(true);
    expect(undone.save.state.player.stats).toEqual(beforeFirst.stats);
    expect(undone.save.state.player.moneyToman).toBe(beforeFirst.money);
    expect(undone.save.state.timeline.length).toBe(beforeFirst.timelineLen);
    expect(undone.save.state.activityState?.quotaUsedThisTurn).toBe(0);

    // Exhaust quota of 5
    let curr = undone.save;
    let executed = 0;
    for (const c of candidates) {
      const r = performActivityAction(curr, c);
      if (r.success) {
        curr = r.save;
        executed += 1;
      } else {
        expect(r.message).toBe('سهمیه فعالیت امسال تکمیل شده است');
      }
    }
    expect(executed).toBeLessThanOrEqual(5);
    expect(curr.state.activityState?.quotaUsedThisTurn).toBe(5);

    const nextYear = runAdvanceYearWithTick(curr, gameDataset);
    expect(nextYear.state.activityState?.quotaUsedThisTurn ?? 0).toBe(0);
  });
});
