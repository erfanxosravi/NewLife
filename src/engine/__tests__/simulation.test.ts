import { describe, it, expect } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import { advanceYear } from '../reducer';
import { SaveGameSchema } from '../schemas';

function assertAllStatsInRange(save: ReturnType<typeof createNewSaveGame>): void {
  const { stats, hiddenStats, moneyToman, debtToman, age } = save.state.player;
  const visibleValues = Object.values(stats);
  const hiddenValues = Object.values(hiddenStats);

  for (const val of [...visibleValues, ...hiddenValues]) {
    expect(Number.isFinite(val)).toBe(true);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(100);
  }

  expect(Number.isFinite(moneyToman)).toBe(true);
  expect(Number.isFinite(debtToman)).toBe(true);
  expect(debtToman).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(save.state.inflationMultiplier)).toBe(true);
  expect(save.state.inflationMultiplier).toBeGreaterThan(0);
  expect(age).toBeGreaterThanOrEqual(0);
  expect(age).toBeLessThanOrEqual(125);
}

describe('Core Simulation Engine', () => {
  it('produces identical deterministic lives for the same seed', () => {
    let runA = createNewSaveGame({ seed: 'deterministic-42' }, gameDataset);
    let runB = createNewSaveGame({ seed: 'deterministic-42' }, gameDataset);

    expect(runA.state.player).toEqual(runB.state.player);

    while (runA.state.isAlive && runA.state.turn < 130) {
      runA = advanceYear(runA, gameDataset);
      runB = advanceYear(runB, gameDataset);
    }

    expect(runA.state.isAlive).toBe(false);
    expect(runB.state.isAlive).toBe(false);
    expect(runA.state.deathSummary).toEqual(runB.state.deathSummary);
    expect(runA.state.timeline.length).toBe(runB.state.timeline.length);
  });

  it('simulates 1,000 full lives from birth to death with zero crashes and valid bounded stats', () => {
    const TOTAL_LIVES = 1000;
    const deathAges: number[] = [];
    const citiesSeen = new Set<string>();

    for (let i = 0; i < TOTAL_LIVES; i++) {
      let save = createNewSaveGame({ seed: `bulk-seed-${i}` }, gameDataset);
      citiesSeen.add(save.state.player.birthCityId);
      assertAllStatsInRange(save);

      let safetyCounter = 0;
      while (save.state.isAlive && safetyCounter < 130) {
        save = advanceYear(save, gameDataset);
        assertAllStatsInRange(save);
        safetyCounter += 1;
      }

      expect(save.state.isAlive).toBe(false);
      expect(save.state.deathSummary).not.toBeNull();
      expect(save.state.deathSummary!.lifeScore).toBeGreaterThan(0);
      expect(save.state.player.stats.health).toBe(0);

      // Periodic full Zod schema validation on completed save
      if (i % 50 === 0) {
        expect(() => SaveGameSchema.parse(save)).not.toThrow();
      }

      deathAges.push(save.state.player.age);
    }

    expect(deathAges).toHaveLength(TOTAL_LIVES);
    expect(citiesSeen.size).toBeGreaterThanOrEqual(5);
    const avgAge = deathAges.reduce((acc, a) => acc + a, 0) / deathAges.length;
    expect(avgAge).toBeGreaterThan(45);
    expect(avgAge).toBeLessThan(95);
  }, 30000);
});
