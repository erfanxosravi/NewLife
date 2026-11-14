import { describe, it, expect } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import { migrateSaveGame } from '../migrations';
import { CURRENT_SCHEMA_VERSION } from '../schemas';

describe('SaveGame schemaVersion Migrations', () => {
  it('migrates legacy v0 save payload to v1 cleanly', () => {
    const validSave = createNewSaveGame({ seed: 'migration-test' }, gameDataset);
    const legacyV0 = {
      slotId: 'slot_legacy',
      seed: validSave.seed,
      rngState: validSave.rngState,
      createdAt: validSave.createdAt,
      updatedAt: validSave.updatedAt,
      state: {
        ...validSave.state,
      },
    };
    // Simulate missing v1 fields on legacy state
    const legacyState = legacyV0.state as Record<string, unknown>;
    delete legacyState.lastInflationRate;
    delete legacyState.unlockedAchievements;
    delete legacyState.scheduledEvents;

    const migrated = migrateSaveGame(legacyV0);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.slotId).toBe('slot_legacy');
    expect(migrated.state.lastInflationRate).toBe(0.25);
    expect(Array.isArray(migrated.state.unlockedAchievements)).toBe(true);
    expect(Array.isArray(migrated.state.scheduledEvents)).toBe(true);
  });

  it('migrates v1 save payload to v2 cleanly with deterministic talent fields', () => {
    const validSave = createNewSaveGame({ seed: 'v1-to-v2-test' }, gameDataset);
    const playerWithoutV2 = { ...(validSave.state.player as unknown as Record<string, unknown>) };
    delete playerWithoutV2.hiddenTalents;
    delete playerWithoutV2.athleticDiscipline;
    delete playerWithoutV2.discoveredTalents;
    delete playerWithoutV2.talentSkills;

    const v1Save = {
      ...validSave,
      schemaVersion: 1,
      state: {
        ...validSave.state,
        player: playerWithoutV2,
      },
    };

    const migratedA = migrateSaveGame(v1Save);
    const migratedB = migrateSaveGame(v1Save);

    expect(migratedA.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedA.state.player.hiddenTalents).toEqual(migratedB.state.player.hiddenTalents);
    expect(migratedA.state.player.athleticDiscipline).toBe(
      migratedB.state.player.athleticDiscipline,
    );
    expect(Array.isArray(migratedA.state.player.discoveredTalents)).toBe(true);
    expect(typeof migratedA.state.player.talentSkills).toBe('object');
    expect(Array.isArray(migratedA.state.player.licenses)).toBe(true);
    expect(migratedA.state.ownedBusiness).toBeNull();
    expect(Array.isArray(migratedA.state.businessHistory)).toBe(true);
  });

  it('migrates v2 save payload to v3 cleanly with licenses and ownedBusiness fields', () => {
    const validSave = createNewSaveGame({ seed: 'v2-to-v3-test' }, gameDataset);
    const playerWithoutV3 = { ...(validSave.state.player as unknown as Record<string, unknown>) };
    delete playerWithoutV3.licenses;
    const stateWithoutV3 = { ...(validSave.state as unknown as Record<string, unknown>) };
    delete stateWithoutV3.ownedBusiness;
    delete stateWithoutV3.businessHistory;

    const v2Save = {
      ...validSave,
      schemaVersion: 2,
      state: {
        ...stateWithoutV3,
        player: playerWithoutV3,
      },
    };

    const migrated = migrateSaveGame(v2Save);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.player.licenses).toEqual([]);
    expect(migrated.state.ownedBusiness).toBeNull();
    expect(migrated.state.businessHistory).toEqual([]);
    expect(migrated.state.worldSeed).toBe(v2Save.seed);
    expect(migrated.state.dynasty?.currentGeneration).toBe(1);
  });

  it('migrates v3 save payload to v4 cleanly with worldSeed, will, and dynasty fields', () => {
    const validSave = createNewSaveGame({ seed: 'v3-to-v4-test' }, gameDataset);
    const stateWithoutV4 = { ...(validSave.state as unknown as Record<string, unknown>) };
    delete stateWithoutV4.worldSeed;
    delete stateWithoutV4.will;
    delete stateWithoutV4.dynasty;
    delete stateWithoutV4.horizonEnded;

    const v3Save = {
      ...validSave,
      schemaVersion: 3,
      state: stateWithoutV4,
    };

    const migrated = migrateSaveGame(v3Save);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.worldSeed).toBe('v3-to-v4-test');
    expect(migrated.state.will).toBeNull();
    expect(migrated.state.horizonEnded).toBe(false);
    expect(migrated.state.dynasty?.dynastyNameFa).toContain(validSave.state.player.lastName);
  });

  it('migrates v4 save payload to v5 cleanly with adoption state and avatar seeds', () => {
    const validSave = createNewSaveGame({ seed: 'v4-to-v5-test' }, gameDataset);
    const playerWithoutV5 = { ...(validSave.state.player as unknown as Record<string, unknown>) };
    delete playerWithoutV5.avatarSeed;
    const stateWithoutV5 = { ...(validSave.state as unknown as Record<string, unknown>) };
    delete stateWithoutV5.adoption;

    const v4Save = {
      ...validSave,
      schemaVersion: 4,
      state: {
        ...stateWithoutV5,
        player: playerWithoutV5,
      },
    };

    const migrated = migrateSaveGame(v4Save);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.adoption?.activeApplication).toBeNull();
    expect(migrated.state.adoption?.supervisionVisits).toEqual([]);
    expect(typeof migrated.state.player.avatarSeed).toBe('string');
  });

  it('migrates v5 save payload to v6 cleanly with jobCompass defaults', () => {
    const validSave = createNewSaveGame({ seed: 'v5-to-v6-test' }, gameDataset);
    const stateWithoutV6 = { ...(validSave.state as unknown as Record<string, unknown>) };
    delete stateWithoutV6.jobCompass;

    const v5Save = {
      ...validSave,
      schemaVersion: 5,
      state: stateWithoutV6,
    };

    const migrated = migrateSaveGame(v5Save);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.jobCompass).toBeDefined();
    expect(migrated.state.jobCompass?.salaryUnit).toBe('monthly');
    expect(migrated.state.jobCompass?.shortlistedJobIds).toEqual([]);
    expect(migrated.state.jobCompass?.pinnedJobId).toBeNull();
  });

  it('migrates v6 save payload to v7 cleanly with multi-currency IRT wallet, fxState, and displayCurrencyMode', () => {
    const validSave = createNewSaveGame({ seed: 'v6-to-v7-test' }, gameDataset);
    const stateWithoutV7 = { ...(validSave.state as unknown as Record<string, unknown>) };
    delete stateWithoutV7.ledger;
    delete stateWithoutV7.fxState;
    delete stateWithoutV7.displayCurrencyMode;
    validSave.state.player.moneyToman = 123_456_789;
    const v6Save = {
      ...validSave,
      schemaVersion: 6,
      state: {
        ...stateWithoutV7,
        player: { ...validSave.state.player, moneyToman: 123_456_789 },
      },
    };

    const migrated = migrateSaveGame(v6Save);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.displayCurrencyMode).toBe('local');
    expect(migrated.state.fxState?.usdRates.USD).toBe(1);
    const irtWallet = migrated.state.ledger?.wallets.find((w) => w.currencyCode === 'IRT');
    expect(irtWallet?.balance).toBe(123_456_789);
  });

  it('passes through valid current-version save payloads', () => {
    const validSave = createNewSaveGame({ seed: 'v7-valid' }, gameDataset);
    const result = migrateSaveGame(validSave);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.seed).toBe('v7-valid');
  });

  it('rejects unsupported future schema versions and malformed data', () => {
    const validSave = createNewSaveGame({ seed: 'future' }, gameDataset);
    expect(() =>
      migrateSaveGame({ ...validSave, schemaVersion: CURRENT_SCHEMA_VERSION + 5 }),
    ).toThrow();
    expect(() => migrateSaveGame(null)).toThrow();
    expect(() => migrateSaveGame('corrupted')).toThrow();
  });
});
