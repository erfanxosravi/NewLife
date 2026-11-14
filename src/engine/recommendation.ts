import { gameDataset, type GameDataset } from '../data/registry';
import { getTotalAssetsAndLiabilitiesInToman } from './ledger';
import { SeededRNG } from './rng';
import type {
  ActivityCategory,
  ActivityDefinition,
  ActivityOutcome,
  GameState,
  PlayerActivityRuntimeState,
  PlayerStats,
  SaveGame,
} from './types';

export const STANDARD_ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  'health',
  'leisure',
  'travel',
  'sport',
  'learning',
  'charity',
  'arts_talent',
  'pets',
  'social_digital',
  'business_trade',
  'legal_civic',
  'lifestyle_shop',
] as const;

export const DEFAULT_MAX_ACTIVITY_QUOTA_PER_TURN = 5;

export function ensureActivityRuntimeState(state: GameState): PlayerActivityRuntimeState {
  const existing = state.activityState;
  if (!existing) {
    return {
      turn: state.turn,
      quotaUsedThisTurn: 0,
      maxQuotaPerTurn: DEFAULT_MAX_ACTIVITY_QUOTA_PER_TURN,
      favoriteIds: [],
      recentIds: [],
      seenOutcomeMap: {},
    };
  }
  if (existing.turn !== state.turn) {
    return {
      ...existing,
      turn: state.turn,
      quotaUsedThisTurn: 0,
      maxQuotaPerTurn: existing.maxQuotaPerTurn || DEFAULT_MAX_ACTIVITY_QUOTA_PER_TURN,
      favoriteIds: [...existing.favoriteIds],
      recentIds: [...existing.recentIds],
      seenOutcomeMap: { ...existing.seenOutcomeMap },
      annualUndoSnapshot: undefined,
    };
  }
  return existing;
}

export function getAnnualSeasonTag(jalaliYear: number, turn: number): 'nowruz' | 'summer' | 'yalda' | 'winter' | 'ramadan' {
  const seasons: ('nowruz' | 'summer' | 'yalda' | 'winter' | 'ramadan')[] = [
    'nowruz',
    'summer',
    'yalda',
    'winter',
    'ramadan',
  ];
  return seasons[Math.abs(jalaliYear + turn) % seasons.length];
}

export function getAnnualSeasonLabelFa(
  tag: 'nowruz' | 'summer' | 'yalda' | 'winter' | 'ramadan',
): string {
  switch (tag) {
    case 'nowruz':
      return 'حال‌وهوای نوروز و بهار';
    case 'summer':
      return 'فصل تابستان';
    case 'yalda':
      return 'شب یلدا و پاییز';
    case 'winter':
      return 'روزهای سرد زمستان';
    case 'ramadan':
      return 'ماه همدلی و بخشش';
  }
}

export function isActivityExecutableBase(
  activity: ActivityDefinition,
  save: SaveGame,
): boolean {
  const { state, contentSettings } = save;
  if (!state.isAlive) return false;
  if (activity.category === 'crime' || activity.contentTag === 'crime') {
    if (!contentSettings.allowCrime) return false;
  }
  if (activity.category === 'gambling' && !contentSettings.allowCrime) return false;
  if (activity.contentTag === 'substance' && !contentSettings.allowSubstance) return false;
  if (activity.contentTag === 'romance' && !contentSettings.allowRomance) return false;

  if (state.player.age < activity.minAge) return false;
  if (activity.maxAge !== undefined && state.player.age > activity.maxAge) return false;
  if (
    activity.minIntelligence !== undefined &&
    state.player.stats.intelligence < activity.minIntelligence
  ) {
    return false;
  }

  const lastTurn = state.flags[`cd_act_${activity.id}`];
  if (typeof lastTurn === 'number' && state.turn - lastTurn < activity.cooldownYears) {
    return false;
  }

  const runtime = ensureActivityRuntimeState(state);
  const quotaCost = activity.quotaCost ?? 1;
  if (runtime.quotaUsedThisTurn + quotaCost > runtime.maxQuotaPerTurn) {
    return false;
  }

  const adjustedCost = Math.round(activity.costToman * state.inflationMultiplier);
  const availableToman =
    state.player.countryId !== 'iran' && state.ledger
      ? Math.max(
          state.player.moneyToman,
          getTotalAssetsAndLiabilitiesInToman(state, gameDataset).walletsToman,
        )
      : state.player.moneyToman;

  if (adjustedCost > availableToman) return false;
  return true;
}

export function getPinnedUrgentAlert(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): {
  titleFa: string;
  bodyFa: string;
  activity: ActivityDefinition;
} | null {
  const { state } = save;
  if (!state.isAlive || state.player.stats.health >= 20) return null;

  const healthCandidates = dataset.activities
    .filter((a) => a.category === 'health' && isActivityExecutableBase(a, save))
    .sort((a, b) => {
      const priorityIds = ['act_hospital_visit', 'act_medical_checkup', 'act_sleep_hygiene'];
      const ia = priorityIds.indexOf(a.id);
      const ib = priorityIds.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.costToman - b.costToman;
    });

  const best =
    healthCandidates[0] ??
    dataset.activities.find((a) => a.category === 'health' && a.costToman === 0);
  if (!best) return null;

  return {
    titleFa: 'اولویت فوری سلامت',
    bodyFa: 'سلامت بدنی تو به سطح هشدار رسیده است؛ رسیدگی پزشکی یا استراحت فوری را در اولویت بگذار.',
    activity: best,
  };
}

export interface ActivityRecommendationItem {
  activity: ActivityDefinition;
  score: number;
  reasonFa: string;
}

function getStatDeficitWeight(stats: PlayerStats, key: keyof PlayerStats): number {
  const v = stats[key];
  if (v < 20) return 3.8;
  if (v < 40) return 2.2;
  if (v < 65) return 1.15;
  return 0.45;
}

function estimateActivityExpectedGainScore(
  activity: ActivityDefinition,
  state: GameState,
  seasonTag: ReturnType<typeof getAnnualSeasonTag>,
): { score: number; reasonFa: string } {
  const stats = state.player.stats;
  const isHealthEmergency = stats.health < 20;

  let avgHealth = 0;
  let avgHappiness = 0;
  let avgMental = 0;
  let avgIntel = 0;
  let avgLooks = 0;
  let avgFame = 0;
  let avgMoney = 0;
  let totalWeight = 0;

  for (const out of activity.outcomes) {
    const w = out.weight;
    totalWeight += w;
    avgHealth += (out.stats?.health ?? 0) * w;
    avgHappiness += (out.stats?.happiness ?? 0) * w;
    avgMental += (out.stats?.mentalHealth ?? 0) * w;
    avgIntel += (out.stats?.intelligence ?? 0) * w;
    avgLooks += (out.stats?.looks ?? 0) * w;
    avgFame += (out.stats?.fame ?? 0) * w;
    avgMoney += (out.moneyToman ?? 0) * w;
  }

  if (totalWeight > 0) {
    avgHealth /= totalWeight;
    avgHappiness /= totalWeight;
    avgMental /= totalWeight;
    avgIntel /= totalWeight;
    avgLooks /= totalWeight;
    avgFame /= totalWeight;
    avgMoney /= totalWeight;
  }

  let score =
    avgHealth * getStatDeficitWeight(stats, 'health') * 2.4 +
    avgMental * getStatDeficitWeight(stats, 'mentalHealth') * 2.0 +
    avgHappiness * getStatDeficitWeight(stats, 'happiness') * 1.6 +
    avgIntel * getStatDeficitWeight(stats, 'intelligence') * 1.5 +
    avgLooks * getStatDeficitWeight(stats, 'looks') * 1.3 +
    avgFame * getStatDeficitWeight(stats, 'fame') * 1.2;

  if (avgMoney > 0) {
    score += Math.min(8, Math.log10(Math.max(10, avgMoney)) * 1.1);
  }
  if (activity.seasonTags?.includes(seasonTag)) {
    score += 4.5;
  }
  if (state.activityState?.favoriteIds.includes(activity.id)) {
    score += 1.8;
  }
  if (state.player.moneyToman < 5_000_000 && activity.costToman === 0) {
    score += 3;
  }

  let reasonFa = activity.effectHintFa;
  if (isHealthEmergency) {
    if (activity.category === 'health') {
      score += 180;
      reasonFa = 'رسیدگی فوری به سلامت پایین';
    } else if (activity.category === 'leisure' || activity.category === 'travel') {
      score -= 60;
    }
  } else if (stats.mentalHealth < 35 && avgMental >= 4) {
    reasonFa = 'کمک به آرامش و تعادل روان';
  } else if (stats.intelligence < 50 && avgIntel >= 3) {
    reasonFa = 'ارتقای دانش و توان یادگیری';
  } else if (activity.seasonTags?.includes(seasonTag)) {
    reasonFa = `متناسب با ${getAnnualSeasonLabelFa(seasonTag)}`;
  }

  return { score, reasonFa };
}

export function getSmartRecommendations(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
  limit = 5,
): ActivityRecommendationItem[] {
  const seasonTag = getAnnualSeasonTag(save.state.currentJalaliYear, save.state.turn);
  const candidates = dataset.activities
    .filter(
      (a) =>
        STANDARD_ACTIVITY_CATEGORIES.includes(a.category) &&
        isActivityExecutableBase(a, save),
    )
    .map((activity) => {
      const { score, reasonFa } = estimateActivityExpectedGainScore(activity, save.state, seasonTag);
      const tieNoise =
        ((activity.id.charCodeAt(4) || 7) * 13 + save.state.turn * 7) % 10;
      return {
        activity,
        score: score + tieNoise * 0.01,
        reasonFa,
      };
    })
    .sort((a, b) => b.score - a.score);

  const picked: ActivityRecommendationItem[] = [];
  const usedCategories = new Set<ActivityCategory>();

  for (const item of candidates) {
    if (usedCategories.has(item.activity.category)) continue;
    usedCategories.add(item.activity.category);
    picked.push(item);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function getSeasonalActivities(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): { seasonTag: ReturnType<typeof getAnnualSeasonTag>; seasonLabelFa: string; items: ActivityDefinition[] } {
  const seasonTag = getAnnualSeasonTag(save.state.currentJalaliYear, save.state.turn);
  const items = dataset.activities.filter(
    (a) =>
      STANDARD_ACTIVITY_CATEGORIES.includes(a.category) &&
      a.seasonTags?.includes(seasonTag) &&
      save.state.player.age >= a.minAge &&
      (a.maxAge === undefined || save.state.player.age <= a.maxAge),
  );
  return {
    seasonTag,
    seasonLabelFa: getAnnualSeasonLabelFa(seasonTag),
    items,
  };
}

export function getRecentAndFavoriteActivities(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): { favorites: ActivityDefinition[]; recents: ActivityDefinition[] } {
  const runtime = ensureActivityRuntimeState(save.state);
  const byId = new Map(dataset.activities.map((a) => [a.id, a]));
  const favorites = runtime.favoriteIds
    .map((id) => byId.get(id))
    .filter((a): a is ActivityDefinition => Boolean(a));
  const recents = runtime.recentIds
    .map((id) => byId.get(id))
    .filter((a): a is ActivityDefinition => Boolean(a));
  return { favorites, recents };
}

export function pickNonRepeatingActivityOutcome(
  activity: ActivityDefinition,
  state: GameState,
  seed: string,
): {
  outcome: ActivityOutcome;
  outcomeIndex: number;
  nextSeenIndices: number[];
} {
  const runtime = ensureActivityRuntimeState(state);
  const prevSeen = runtime.seenOutcomeMap[activity.id] ?? [];
  const allIndices = activity.outcomes.map((_, idx) => idx);
  let remaining = allIndices.filter((idx) => !prevSeen.includes(idx));
  let baseSeen = prevSeen;
  if (remaining.length === 0) {
    remaining = allIndices;
    baseSeen = [];
  }

  const rng = new SeededRNG(seed);
  const pool = remaining.map((idx) => ({
    idx,
    outcome: activity.outcomes[idx],
  }));
  const chosen = rng.weightedPick(pool, (item) => item.outcome.weight);
  const nextSeenIndices = [...baseSeen, chosen.idx];

  return {
    outcome: chosen.outcome,
    outcomeIndex: chosen.idx,
    nextSeenIndices,
  };
}
