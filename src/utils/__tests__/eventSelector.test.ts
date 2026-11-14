import { describe, it, expect } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../../engine/generator';
import { advanceYear } from '../../engine/reducer';
import { pickPendingEventForTurn } from '../eventSelector';

describe('Turn Event Selector', () => {
  it('respects age bounds and contentSettings when picking pending turn events', () => {
    let save = createNewSaveGame(
      {
        seed: 'event-selector-seed',
        birthCityId: 'tehran',
        contentSettings: {
          allowCrime: false,
          allowSubstance: false,
          allowRomance: true,
          allowSocialPolitical: false,
        },
      },
      gameDataset,
    );

    // Advance through childhood & teen years to verify events trigger cleanly and respect filters
    const triggeredIds: string[] = [];
    for (let y = 0; y < 35 && save.state.isAlive; y++) {
      save = advanceYear(save, gameDataset);
      const ev = pickPendingEventForTurn(save, gameDataset);
      if (ev) {
        triggeredIds.push(ev.id);
        expect(ev.contentTag).not.toBe('social');
        if (ev.conditions.minAge !== undefined) {
          expect(save.state.player.age).toBeGreaterThanOrEqual(ev.conditions.minAge);
        }
        if (ev.conditions.maxAge !== undefined) {
          expect(save.state.player.age).toBeLessThanOrEqual(ev.conditions.maxAge);
        }
      }
    }

    expect(triggeredIds.length).toBeGreaterThan(0);
  });
});
