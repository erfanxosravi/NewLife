import type { GameDataset } from '../data/registry';
import type { DeathSummary, GameState, HiddenStats, PlayerStats } from './types';
import type { SeededRNG } from './rng';
import { calculateNetWorthToman, getPurchasingPowerSummary } from './economy';
import { toPersianDigits } from './jalali';

export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function applyStatDelta(
  stats: PlayerStats,
  delta: Partial<PlayerStats>,
): PlayerStats {
  return {
    health: clampStat(stats.health + (delta.health ?? 0)),
    happiness: clampStat(stats.happiness + (delta.happiness ?? 0)),
    intelligence: clampStat(stats.intelligence + (delta.intelligence ?? 0)),
    looks: clampStat(stats.looks + (delta.looks ?? 0)),
    fame: clampStat(stats.fame + (delta.fame ?? 0)),
    mentalHealth: clampStat(stats.mentalHealth + (delta.mentalHealth ?? 0)),
  };
}

export function applyHiddenStatDelta(
  stats: HiddenStats,
  delta: Partial<HiddenStats>,
): HiddenStats {
  return {
    luck: clampStat(stats.luck + (delta.luck ?? 0)),
    talent: clampStat(stats.talent + (delta.talent ?? 0)),
    conscientiousness: clampStat(stats.conscientiousness + (delta.conscientiousness ?? 0)),
    riskAppetite: clampStat(stats.riskAppetite + (delta.riskAppetite ?? 0)),
  };
}

export function evaluateDeathRisk(state: GameState, rng: SeededRNG): {
  died: boolean;
  causeOfDeath: string;
} {
  const { age, stats, hiddenStats } = state.player;
  const luckFactor = (50 - hiddenStats.luck) * 0.0004;

  // Guaranteed natural upper bound so simulations always terminate cleanly
  if (age >= 115) {
    return {
      died: true,
      causeOfDeath: 'کهولت سن و آرامش پس از یک عمر طولانی',
    };
  }

  // Acute health collapse
  if (stats.health <= 0) {
    return {
      died: true,
      causeOfDeath: age < 45 ? 'بیماری شدید و نارسایی جسمی' : 'ایست قلبی بر اثر ضعف شدید جسمانی',
    };
  }

  let baseRisk = 0.0005;
  if (age < 5) baseRisk = 0.0012;
  else if (age < 18) baseRisk = 0.0008;
  else if (age < 40) baseRisk = 0.0015;
  else if (age < 60) baseRisk = 0.0045;
  else if (age < 75) baseRisk = 0.016;
  else if (age < 85) baseRisk = 0.055;
  else if (age < 95) baseRisk = 0.14;
  else baseRisk = 0.32;

  // Health & mentalHealth modifiers
  const healthPenalty = stats.health < 35 ? (35 - stats.health) * 0.003 : (50 - stats.health) * 0.0005;
  const mentalPenalty = stats.mentalHealth < 20 ? (20 - stats.mentalHealth) * 0.001 : 0;

  // Childhood protection against early random mortality spikes
  const finalRisk = Math.max(
    0.0002,
    Math.min(0.95, baseRisk + healthPenalty + mentalPenalty + luckFactor),
  );

  if (!rng.chance(finalRisk)) {
    return { died: false, causeOfDeath: '' };
  }

  // Choose culturally natural cause of death based on age & health
  if (age >= 75) {
    const elderCauses = [
      'کهولت سن و ایست قلبی در خواب',
      'نارسایی قلبی در سنین سالمندی',
      'بیماری تنفسی و ضعف قوای جسمانی در سالمندی',
    ];
    return { died: true, causeOfDeath: rng.pick(elderCauses) };
  }

  if (age >= 40) {
    const midCauses = [
      'سکته قلبی ناگهانی',
      'عوارض یک بیماری مزمن',
      'سانحه رانندگی در جاده',
    ];
    return { died: true, causeOfDeath: rng.pick(midCauses) };
  }

  if (age >= 15) {
    const youngCauses = [
      'سانحه رانندگی ناگهانی',
      'بیماری حاد و غیرمنتظره',
      'حادثه ناگوار حین سفر',
    ];
    return { died: true, causeOfDeath: rng.pick(youngCauses) };
  }

  return {
    died: true,
    causeOfDeath: 'بیماری سخت دوران کودکی',
  };
}

export function buildDeathSummary(
  state: GameState,
  causeOfDeath: string,
  dataset?: GameDataset,
): DeathSummary {
  const { player } = state;
  const netWorth = calculateNetWorthToman(state);
  const usdEquivalent = dataset
    ? Math.max(0, getPurchasingPowerSummary(netWorth, state, dataset).usdEquivalent)
    : Math.max(0, netWorth / Math.max(1, state.inflationMultiplier * 271_900));

  const ageScore = Math.min(300, player.age * 3);
  const statAvg =
    (player.stats.health +
      player.stats.happiness +
      player.stats.intelligence +
      player.stats.fame +
      player.stats.mentalHealth) /
    5;
  const statScore = Math.round(statAvg * 4);
  const wealthScore = Math.min(200, Math.round(Math.sqrt(usdEquivalent / 25_000) * 55));
  const achievementScore = state.unlockedAchievements.length * 25;

  const lifeScore = Math.max(10, ageScore + statScore + wealthScore + achievementScore);

  let legacyTitle = 'رهگذر آرام زندگی';
  if (lifeScore >= 750) legacyTitle = 'اسطوره فراموش‌نشدنی';
  else if (lifeScore >= 600) legacyTitle = 'انسانی پربار و الهام‌بخش';
  else if (lifeScore >= 450) legacyTitle = 'همراهی محترم و باوقار';
  else if (lifeScore >= 300) legacyTitle = 'زندگی پرتلاش و واقعی';

  const highlights: string[] = [
    `زندگی در ${toPersianDigits(player.age)} سالگی به پایان رسید.`,
    `هوش نهایی: ${toPersianDigits(player.stats.intelligence)} از ۱۰۰ · شادی: ${toPersianDigits(player.stats.happiness)} از ۱۰۰`,
  ];

  if (player.job) {
    highlights.push(`آخرین جایگاه شغلی: ${player.job.title}`);
  }

  if (state.unlockedAchievements.length > 0) {
    highlights.push(`دستاوردهای ثبت‌شده: ${toPersianDigits(state.unlockedAchievements.length)} مورد`);
  }

  return {
    ageAtDeath: player.age,
    jalaliYearOfDeath: state.currentJalaliYear,
    causeOfDeath,
    finalNetWorthToman: netWorth,
    lifeScore,
    legacyTitle,
    highlights,
  };
}
