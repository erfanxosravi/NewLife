import { gameDataset } from '../data/registry';
import { SeededRNG } from './rng';
import { CURRENT_SCHEMA_VERSION, SaveGameSchema } from './schemas';
import { generateHiddenTalentsAndDiscipline } from './talents';
import type { ContentSettings, SaveGame } from './types';

export type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

const DEFAULT_CONTENT_SETTINGS: ContentSettings = {
  allowCrime: false,
  allowSubstance: false,
  allowRomance: true,
  allowSocialPolitical: false,
};

/**
 * Registry of sequential migrations: key is the source schemaVersion,
 * transforming payload from `v` -> `v + 1`.
 */
const MIGRATIONS: Record<number, MigrationFn> = {
  0: (raw) => {
    const nowIso = new Date().toISOString();
    const state = (typeof raw.state === 'object' && raw.state !== null
      ? { ...(raw.state as Record<string, unknown>) }
      : {}) as Record<string, unknown>;

    if (typeof state.lastInflationRate !== 'number') {
      state.lastInflationRate = 0.25;
    }
    if (!Array.isArray(state.unlockedAchievements)) {
      state.unlockedAchievements = [];
    }
    if (!Array.isArray(state.scheduledEvents)) {
      state.scheduledEvents = [];
    }
    const flags =
      typeof state.flags === 'object' && state.flags !== null
        ? { ...(state.flags as Record<string, unknown>) }
        : {};
    if (typeof flags.econ_scenario !== 'string') {
      flags.econ_scenario = 'medium';
    }
    state.flags = flags;

    return {
      ...raw,
      schemaVersion: 1,
      slotId: typeof raw.slotId === 'string' && raw.slotId ? raw.slotId : 'slot_1',
      seed: typeof raw.seed === 'string' && raw.seed ? raw.seed : 'migrated-seed',
      rngState: typeof raw.rngState === 'number' ? raw.rngState : 1,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
      contentSettings:
        typeof raw.contentSettings === 'object' && raw.contentSettings !== null
          ? { ...DEFAULT_CONTENT_SETTINGS, ...(raw.contentSettings as Record<string, unknown>) }
          : DEFAULT_CONTENT_SETTINGS,
      state,
    };
  },
  1: (raw) => {
    const seed = typeof raw.seed === 'string' && raw.seed ? raw.seed : 'migrated-v1-seed';
    const state = (typeof raw.state === 'object' && raw.state !== null
      ? { ...(raw.state as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const player = (typeof state.player === 'object' && state.player !== null
      ? { ...(state.player as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const npcs =
      typeof state.npcs === 'object' && state.npcs !== null
        ? (state.npcs as Record<string, { jobTitle?: string; traits?: string[] }>)
        : {};

    const parentJobTitles: string[] = [];
    const parentTraits: string[] = [];
    for (const pid of ['npc_father', 'npc_mother']) {
      const npc = npcs[pid];
      if (npc?.jobTitle) parentJobTitles.push(npc.jobTitle);
      if (Array.isArray(npc?.traits)) parentTraits.push(...npc.traits);
    }

    const birthCityId = typeof player.birthCityId === 'string' ? player.birthCityId : 'tehran';
    const rng = new SeededRNG(`${seed}:v2_talents`);
    const generated = generateHiddenTalentsAndDiscipline({
      rng,
      parentJobTitles,
      parentTraits,
      birthCityId,
      dataset: gameDataset,
    });

    if (!player.hiddenTalents || typeof player.hiddenTalents !== 'object') {
      player.hiddenTalents = generated.hiddenTalents;
    }
    if (typeof player.athleticDiscipline !== 'string') {
      player.athleticDiscipline = generated.athleticDiscipline;
    }
    if (!Array.isArray(player.discoveredTalents)) {
      player.discoveredTalents = [];
    }
    if (!player.talentSkills || typeof player.talentSkills !== 'object') {
      player.talentSkills = {};
    }

    state.player = player;
    return {
      ...raw,
      schemaVersion: 2,
      state,
    };
  },
  2: (raw) => {
    const state = (typeof raw.state === 'object' && raw.state !== null
      ? { ...(raw.state as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const player = (typeof state.player === 'object' && state.player !== null
      ? { ...(state.player as Record<string, unknown>) }
      : {}) as Record<string, unknown>;

    if (!Array.isArray(player.licenses)) {
      player.licenses = [];
    }
    if (!('ownedBusiness' in state)) {
      state.ownedBusiness = null;
    }
    if (!Array.isArray(state.businessHistory)) {
      state.businessHistory = [];
    }

    state.player = player;
    return {
      ...raw,
      schemaVersion: 3,
      state,
    };
  },
  3: (raw) => {
    const seed = typeof raw.seed === 'string' && raw.seed ? raw.seed : 'migrated-v3-seed';
    const state = (typeof raw.state === 'object' && raw.state !== null
      ? { ...(raw.state as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const player = (typeof state.player === 'object' && state.player !== null
      ? (state.player as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const firstName = typeof player.firstName === 'string' ? player.firstName : 'شخصیت';
    const lastName = typeof player.lastName === 'string' ? player.lastName : 'ایرانی';
    const worldSeed =
      typeof state.worldSeed === 'string' && state.worldSeed ? state.worldSeed : seed;

    state.worldSeed = worldSeed;
    if (!('horizonEnded' in state)) {
      state.horizonEnded = false;
    }
    if (!('will' in state)) {
      state.will = null;
    }
    if (!state.dynasty || typeof state.dynasty !== 'object') {
      state.dynasty = {
        dynastyNameFa: `خاندان ${lastName}`,
        founderNameFa: `${firstName} ${lastName}`,
        worldSeed,
        currentGeneration: 1,
        totalGenerationsLived: 0,
        familyReputation: 50,
        dynastyScore: 0,
        unlockedDynastyRibbons: [],
        chapters: [],
        wealthTimeline: [],
        hallOfFame: [],
        charityEndowmentTotalToman: 0,
        ancestorMemoriesFa: [],
      };
    }

    return {
      ...raw,
      schemaVersion: 4,
      state,
    };
  },
};

export function migrateSaveGame(rawInput: unknown): SaveGame {
  if (typeof rawInput !== 'object' || rawInput === null || Array.isArray(rawInput)) {
    throw new Error('داده ذخیره نامعتبر است.');
  }

  let current: Record<string, unknown> = { ...(rawInput as Record<string, unknown>) };
  let version = typeof current.schemaVersion === 'number' && Number.isInteger(current.schemaVersion)
    ? current.schemaVersion
    : 0;

  if (version < 0) {
    throw new Error(`نسخه ذخیره نامعتبر است: ${version}`);
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `این فایل ذخیره با نسخه جدیدتر (${version}) ساخته شده و با نسخه فعلی (${CURRENT_SCHEMA_VERSION}) سازگار نیست.`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrateStep = MIGRATIONS[version];
    if (!migrateStep) {
      throw new Error(`مسیر انتقال برای نسخه ${version} به ${version + 1} تعریف نشده است.`);
    }
    current = migrateStep(current);
    version += 1;
  }

  return SaveGameSchema.parse(current);
}
