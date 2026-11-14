import { describe, it, expect } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../../engine/generator';
import { advanceYear } from '../../engine/reducer';
import { CURRENT_SCHEMA_VERSION } from '../../engine/schemas';
import { createMemoryDriver, createSaveStore } from '../saveStore';

describe('Multi-slot SaveStore & Migration Integration', () => {
  it('saves, lists, loads, and deletes multiple life slots', async () => {
    const store = createSaveStore(createMemoryDriver());

    let life1 = createNewSaveGame({ seed: 'slot-1-seed', slotId: 'slot_1' }, gameDataset);
    life1 = advanceYear(life1, gameDataset);

    const life2 = createNewSaveGame({ seed: 'slot-2-seed', slotId: 'slot_2' }, gameDataset);

    await store.saveSlot(life1);
    await store.saveSlot(life2);

    const summaries = await store.listSummaries();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.slotId).sort()).toEqual(['slot_1', 'slot_2']);

    const loaded1 = await store.loadSlot('slot_1');
    expect(loaded1).not.toBeNull();
    expect(loaded1!.state.player.age).toBe(1);
    expect(loaded1!.seed).toBe('slot-1-seed');

    await store.deleteSlot('slot_2');
    const afterDelete = await store.listSummaries();
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].slotId).toBe('slot_1');
  });

  it('automatically migrates legacy v0 saves when loaded from storage', async () => {
    const rawDriver = createMemoryDriver();
    const store = createSaveStore(rawDriver);
    const base = createNewSaveGame({ seed: 'legacy-save', slotId: 'slot_1' }, gameDataset);

    const legacyPayload = {
      slotId: 'slot_1',
      seed: base.seed,
      rngState: base.rngState,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      state: { ...base.state },
    };

    // Write unversioned legacy payload directly to storage
    await rawDriver.set('slot_1', legacyPayload as unknown as typeof base);

    const loaded = await store.loadSlot('slot_1');
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded!.seed).toBe('legacy-save');
  });
});
