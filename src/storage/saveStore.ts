import { migrateSaveGame } from '../engine/migrations';
import { SaveGameSchema } from '../engine/schemas';
import type { SaveGame } from '../engine/types';

const DB_NAME = 'zendegi-nameh-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const FALLBACK_STORAGE_KEY = 'zendegi_nameh_saves_v1';
const ACTIVE_SLOT_KEY = 'zendegi_nameh_active_slot';
const THEME_KEY = 'zendegi_nameh_theme';

export const SAVE_SLOTS = ['slot_1', 'slot_2', 'slot_3'] as const;
export type SaveSlotId = (typeof SAVE_SLOTS)[number] | string;

export interface SaveSlotSummary {
  slotId: string;
  fullName: string;
  age: number;
  jalaliYear: number;
  cityId: string;
  isAlive: boolean;
  moneyToman: number;
  updatedAt: string;
  seed: string;
}

export interface StorageDriver {
  get(slotId: string): Promise<unknown | null>;
  set(slotId: string, value: SaveGame): Promise<void>;
  remove(slotId: string): Promise<void>;
  getAll(): Promise<unknown[]>;
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export const indexedDbDriver: StorageDriver = {
  async get(slotId) {
    try {
      const db = await openIndexedDb();
      return await new Promise<unknown | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(slotId);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return localStorageFallbackDriver.get(slotId);
    }
  },
  async set(slotId, value) {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ ...value, slotId });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      await localStorageFallbackDriver.set(slotId, value);
    }
  },
  async remove(slotId) {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(slotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      await localStorageFallbackDriver.remove(slotId);
    }
  },
  async getAll() {
    try {
      const db = await openIndexedDb();
      return await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return localStorageFallbackDriver.getAll();
    }
  },
};

function readFallbackMap(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallbackMap(map: Record<string, unknown>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(map));
}

export const localStorageFallbackDriver: StorageDriver = {
  async get(slotId) {
    const map = readFallbackMap();
    return map[slotId] ?? null;
  },
  async set(slotId, value) {
    const map = readFallbackMap();
    map[slotId] = { ...value, slotId };
    writeFallbackMap(map);
  },
  async remove(slotId) {
    const map = readFallbackMap();
    delete map[slotId];
    writeFallbackMap(map);
  },
  async getAll() {
    const map = readFallbackMap();
    return Object.values(map);
  },
};

export function createMemoryDriver(): StorageDriver {
  const store = new Map<string, SaveGame>();
  return {
    async get(slotId) {
      return store.get(slotId) ?? null;
    },
    async set(slotId, value) {
      store.set(slotId, structuredClone({ ...value, slotId }));
    },
    async remove(slotId) {
      store.delete(slotId);
    },
    async getAll() {
      return Array.from(store.values()).map((item) => structuredClone(item));
    },
  };
}

export function summarizeSaveGame(save: SaveGame): SaveSlotSummary {
  return {
    slotId: save.slotId,
    fullName: `${save.state.player.firstName} ${save.state.player.lastName}`,
    age: save.state.player.age,
    jalaliYear: save.state.currentJalaliYear,
    cityId: save.state.player.currentCityId,
    isAlive: save.state.isAlive,
    moneyToman: save.state.player.moneyToman,
    updatedAt: save.updatedAt,
    seed: save.seed,
  };
}

export function createSaveStore(driver: StorageDriver = indexedDbDriver) {
  return {
    async saveSlot(save: SaveGame): Promise<SaveGame> {
      const validated = SaveGameSchema.parse(save);
      await driver.set(validated.slotId, validated);
      return validated;
    },

    async loadSlot(slotId: string): Promise<SaveGame | null> {
      const raw = await driver.get(slotId);
      if (!raw) return null;
      return migrateSaveGame(raw);
    },

    async deleteSlot(slotId: string): Promise<void> {
      await driver.remove(slotId);
    },

    async listSummaries(): Promise<SaveSlotSummary[]> {
      const items = await driver.getAll();
      const summaries: SaveSlotSummary[] = [];
      for (const raw of items) {
        try {
          const migrated = migrateSaveGame(raw);
          summaries.push(summarizeSaveGame(migrated));
        } catch {
          // Skip corrupted slot entry rather than breaking listing
        }
      }
      return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}

export const saveStore = createSaveStore(indexedDbDriver);

export function getSavedActiveSlotId(): string {
  if (typeof localStorage === 'undefined') return 'slot_1';
  return localStorage.getItem(ACTIVE_SLOT_KEY) || 'slot_1';
}

export function setSavedActiveSlotId(slotId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type AnimationSpeed = 'normal' | 'fast' | 'off';

const ANIM_SPEED_KEY = 'zendegi_nameh_anim_speed';
const SOUND_ENABLED_KEY = 'zendegi_nameh_sound_enabled';
const LONG_PRESS_AUTO_KEY = 'zendegi_nameh_long_press_auto';

export function getSavedThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'light';
  const val = localStorage.getItem(THEME_KEY);
  if (val === 'dark' || val === 'system' || val === 'light') return val;
  return 'light';
}

export function setSavedThemePreference(theme: ThemePreference): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function getSavedAnimationSpeed(): AnimationSpeed {
  if (typeof localStorage === 'undefined') return 'normal';
  const val = localStorage.getItem(ANIM_SPEED_KEY);
  if (val === 'normal' || val === 'fast' || val === 'off') return val;
  return 'normal';
}

export function setSavedAnimationSpeed(speed: AnimationSpeed): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ANIM_SPEED_KEY, speed);
}

export function getSavedSoundEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
}

export function setSavedSoundEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function getSavedLongPressAutoAdvance(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LONG_PRESS_AUTO_KEY) === 'true';
}

export function setSavedLongPressAutoAdvance(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LONG_PRESS_AUTO_KEY, enabled ? 'true' : 'false');
}
