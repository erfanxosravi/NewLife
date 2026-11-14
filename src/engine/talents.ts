import type { GameDataset } from '../data/registry';
import {
  calculateProgressiveIncomeTax,
  getMinWageMonthlyForState,
  type JobIncomeBreakdown,
} from './economy';
import { formatToman, toPersianDigits } from './jalali';
import type { SeededRNG } from './rng';
import { clampStat } from './stats';
import type {
  AthleticDiscipline,
  DiscoveredTalent,
  GameState,
  HiddenTalents,
  SpecialCareerDefinition,
  SpecialCareerRouteId,
  TalentDefinition,
  TalentId,
  TalentSkillState,
  TalentTier,
} from './types';

export const TALENT_IDS: TalentId[] = [
  'singing',
  'music_instrument',
  'acting',
  'athletics',
  'visual_art',
  'writing',
  'comedy',
  'math_science',
  'programming_tech',
  'business_sense',
  'leadership',
  'cooking',
  'mechanical',
];

const TIER_RANK: Record<TalentTier, number> = {
  curiosity: 1,
  interest: 2,
  clear_talent: 3,
  brilliant_talent: 4,
};

export function isTierAtLeast(actual: TalentTier, required: TalentTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}

export function getTierForTalentScore(score: number, dataset: GameDataset): TalentTier {
  const clamped = clampStat(score);
  for (const tier of dataset.talents.tiers) {
    if (clamped >= tier.minScore && clamped <= tier.maxScore) {
      return tier.id;
    }
  }
  return 'curiosity';
}

export function getTierLabelFa(tier: TalentTier, dataset: GameDataset): string {
  return dataset.talents.tiers.find((t) => t.id === tier)?.labelFa ?? 'کنجکاوی';
}

export function getAthleticDisciplineTitleFa(
  discipline: AthleticDiscipline,
  dataset: GameDataset,
): string {
  return (
    dataset.talents.athleticDisciplines.find((d) => d.id === discipline)?.titleFa ?? 'فوتبال'
  );
}

/**
 * Skewed Kumaraswamy(alpha, beta) sample in [0, 100]:
 * F^{-1}(u) = (1 - (1 - u)^(1/beta))^(1/alpha)
 * Produces most scores low/moderate and very rare standout (>=72) or rare (>=85) scores.
 * Family influence lowers beta gently (raising odds without ever guaranteeing high values).
 * Social class NEVER enters this calculation (only affects access & exposure later).
 */
function sampleKumaraswamy100(rng: SeededRNG, alpha: number, beta: number): number {
  const u = Math.max(0.0001, Math.min(0.9999, rng.next()));
  const inner = 1 - Math.pow(1 - u, 1 / beta);
  const raw01 = Math.pow(Math.max(0, Math.min(1, inner)), 1 / alpha);
  return clampStat(Math.round(raw01 * 100));
}

export function hasFamilyAffinityForTalent(
  talent: TalentDefinition,
  parentJobTitles: string[],
  parentTraits: string[],
): boolean {
  const jobMatch = parentJobTitles.some((jt) =>
    talent.relatedParentJobKeywords.some((kw) => jt.includes(kw)),
  );
  const traitMatch = parentTraits.some((tr) => talent.relatedParentTraits.includes(tr));
  return jobMatch || traitMatch;
}

export function generateHiddenTalentsAndDiscipline(params: {
  rng: SeededRNG;
  parentJobTitles: string[];
  parentTraits: string[];
  birthCityId: string;
  dataset: GameDataset;
}): {
  hiddenTalents: HiddenTalents;
  athleticDiscipline: AthleticDiscipline;
} {
  const { rng, parentJobTitles, parentTraits, birthCityId, dataset } = params;
  const dist = dataset.talents.distribution;

  const hidden = {} as HiddenTalents;
  for (const talent of dataset.talents.talents) {
    const familyAffinity = hasFamilyAffinityForTalent(talent, parentJobTitles, parentTraits);
    const beta = familyAffinity ? dist.beta * dist.familyBetaMultiplier : dist.beta;
    hidden[talent.id] = sampleKumaraswamy100(rng, dist.alpha, beta);
  }

  const city = dataset.cities.find((c) => c.id === birthCityId);
  const isUrban = city ? !city.isVillage : true;
  const pickedDiscipline = rng.weightedPick(dataset.talents.athleticDisciplines, (d) =>
    isUrban ? d.urbanBias : 2 - Math.min(1.5, d.urbanBias * 0.8),
  ).id;

  return {
    hiddenTalents: hidden,
    athleticDiscipline: pickedDiscipline,
  };
}

export function getTalentSkillState(
  state: GameState,
  talentId: TalentId,
): TalentSkillState {
  return (
    state.player.talentSkills[talentId] ?? {
      skill: 0,
      practiceCount: 0,
      opportunityScore: 0,
      auditionFailures: 0,
      careerStage: 0,
    }
  );
}

export function evaluateYearlyTalentDiscovery(
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): {
  discovered?: DiscoveredTalent;
  timelineTitle?: string;
  timelineText?: string;
} {
  const { player, npcs } = state;
  const cfg = dataset.talents.discovery;
  if (player.age < cfg.minAge || player.age > cfg.lateBloomerMaxAge) {
    return {};
  }

  const alreadyDiscovered = new Set(player.discoveredTalents.map((d) => d.talentId));
  const candidates = dataset.talents.talents.filter((t) => !alreadyDiscovered.has(t.id));
  if (candidates.length === 0) return {};

  const parentJobTitles: string[] = [];
  const parentTraits: string[] = [];
  for (const pid of ['npc_father', 'npc_mother']) {
    const p = npcs[pid];
    if (p) {
      parentJobTitles.push(p.jobTitle);
      parentTraits.push(...p.traits);
    }
  }

  const inPeakWindow = player.age >= cfg.peakMinAge && player.age <= cfg.peakMaxAge;
  const baseWindowRate = inPeakWindow
    ? cfg.basePeakProbability
    : cfg.baseLateBloomerProbability;

  // Deterministic order per turn
  const ordered = [...candidates];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = ordered[i];
    ordered[i] = ordered[j];
    ordered[j] = tmp;
  }

  for (const talent of ordered) {
    const innateScore = player.hiddenTalents[talent.id];
    const practiceState = getTalentSkillState(state, talent.id);
    const hasPractice = practiceState.practiceCount > 0;

    if (innateScore < cfg.minNaturalDiscoveryScore && !hasPractice) {
      continue;
    }

    const innateFactor = Math.max(0.15, (innateScore - 20) / 80);
    const schoolBonus = talent.schoolTypeBonus[player.education.schoolType] ?? 0;
    const cityBonus = talent.cityAccessBoostIds.includes(player.currentCityId) ? 0.035 : 0;
    const familyBonus = hasFamilyAffinityForTalent(talent, parentJobTitles, parentTraits)
      ? 0.04
      : 0;
    const practiceBonus = hasPractice
      ? Math.min(0.45, practiceState.practiceCount * cfg.practiceDiscoveryBonus)
      : 0;
    const classExposureBonus =
      player.socialClass === 'wealthy'
        ? 0.035
        : player.socialClass === 'upper_middle'
          ? 0.02
          : 0;

    // Limit natural clutter: if player already discovered >=3 talents, require strong innate or active practice
    const saturationFactor =
      player.discoveredTalents.length >= 3 && !hasPractice ? 0.25 : 1;

    const prob = Math.min(
      0.85,
      (baseWindowRate * (0.4 + innateFactor * 1.45) +
        schoolBonus +
        cityBonus +
        familyBonus +
        practiceBonus +
        classExposureBonus) *
        saturationFactor,
    );

    if (rng.chance(prob)) {
      const tier = getTierForTalentScore(innateScore, dataset);
      const hintTextFa = rng.pick(talent.discoveryHintsFa);
      const athleticDiscipline =
        talent.id === 'athletics' ? player.athleticDiscipline : undefined;
      const tierLabel = getTierLabelFa(tier, dataset);
      const discLabel =
        athleticDiscipline !== undefined
          ? `${talent.titleFa} (${getAthleticDisciplineTitleFa(athleticDiscipline, dataset)})`
          : talent.titleFa;

      return {
        discovered: {
          talentId: talent.id,
          tier,
          discoveredAge: player.age,
          hintTextFa,
          athleticDiscipline,
        },
        timelineTitle: `کشف گرایش در ${discLabel}`,
        timelineText: `${hintTextFa} (نشانه: ${tierLabel})`,
      };
    }
  }

  return {};
}

export function getTalentLessonCostToman(
  talent: TalentDefinition,
  state: GameState,
  dataset: GameDataset,
): number {
  const minWage = getMinWageMonthlyForState(state, dataset);
  return Math.max(10_000, Math.round(minWage * talent.lessonCostMinWageMultiple));
}

export function calculateTalentSkillGain(params: {
  innateTalentScore: number;
  mode: 'self_practice' | 'lesson_or_club' | 'audition_or_contest' | 'publish_online';
  conscientiousness: number;
  luck: number;
  rng: SeededRNG;
}): { skillGain: number; opportunityGain: number; fameGain: number } {
  const { innateTalentScore, mode, conscientiousness, luck, rng } = params;
  const talentMultiplier = 0.45 + (innateTalentScore / 100) * 1.25;
  const disciplineMultiplier = 0.8 + (conscientiousness / 100) * 0.45;
  const luckRoll = 0.8 + (luck / 100) * 0.35 + rng.float(-0.15, 0.25);

  let baseSkill = 4;
  let baseOpp = 3;
  let baseFame = 0;

  if (mode === 'lesson_or_club') {
    baseSkill = 8;
    baseOpp = 9;
    baseFame = 1;
  } else if (mode === 'audition_or_contest') {
    baseSkill = 6;
    baseOpp = 14;
    baseFame = rng.chance(0.45 + innateTalentScore / 250) ? 3 : 1;
  } else if (mode === 'publish_online') {
    baseSkill = 5;
    baseOpp = 11;
    baseFame = rng.chance(0.35 + luck / 250) ? 3 : 1;
  }

  return {
    skillGain: Math.max(2, Math.round(baseSkill * talentMultiplier * disciplineMultiplier)),
    opportunityGain: Math.max(2, Math.round(baseOpp * luckRoll)),
    fameGain: baseFame,
  };
}

export function findMatchingDiscoveredTalentForCareer(
  career: SpecialCareerDefinition,
  state: GameState,
): DiscoveredTalent | undefined {
  const direct = state.player.discoveredTalents.find(
    (d) => d.talentId === career.requiredTalentId,
  );
  if (direct && isTierAtLeast(direct.tier, career.minTier)) {
    return direct;
  }
  if (career.optionalAltTalentIds) {
    for (const altId of career.optionalAltTalentIds) {
      const alt = state.player.discoveredTalents.find((d) => d.talentId === altId);
      if (alt && isTierAtLeast(alt.tier, career.minTier)) {
        return alt;
      }
    }
  }
  return undefined;
}

export interface SpecialCareerEligibility {
  eligible: boolean;
  discovered: DiscoveredTalent | undefined;
  currentSkill: number;
  currentStage: number;
  opportunityScore: number;
  reason?: string;
  estimatedChancePct: number;
  nextStageTitleFa: string;
}

export function getSpecialCareerEligibility(
  career: SpecialCareerDefinition,
  state: GameState,
  dataset: GameDataset,
): SpecialCareerEligibility {
  const { player } = state;
  const discovered = findMatchingDiscoveredTalentForCareer(career, state);
  const activeTalentId = discovered?.talentId ?? career.requiredTalentId;
  const skillState = getTalentSkillState(state, activeTalentId);
  const currentStage = skillState.careerStage;
  const nextStageIdx = Math.min(3, currentStage);
  const nextStageTitleFa = career.stageTitlesFa[nextStageIdx];

  const requiredSkillForNext =
    currentStage === 0
      ? career.minSkill
      : Math.min(95, career.minSkill + currentStage * 16);

  if (player.age < career.minAge) {
    return {
      eligible: false,
      discovered,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: `از ${toPersianDigits(career.minAge)} سالگی قابل پیگیری است`,
      estimatedChancePct: 0,
      nextStageTitleFa,
    };
  }

  if (!discovered) {
    const reqTalentTitle =
      dataset.talents.talents.find((t) => t.id === career.requiredTalentId)?.titleFa ?? 'استعداد';
    return {
      eligible: false,
      discovered: undefined,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: `ابتدا باید گرایش «${reqTalentTitle}» (حداقل ${getTierLabelFa(career.minTier, dataset)}) در زندگی یا با تمرین کشف شود`,
      estimatedChancePct: 0,
      nextStageTitleFa,
    };
  }

  if (currentStage === 0 && player.age > career.maxEntryAge) {
    return {
      eligible: false,
      discovered,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: `پنجره سنی ورود به این مسیر حرفه‌ای (${toPersianDigits(career.maxEntryAge)} سال) گذشته است؛ مسیر مربیگری یا تدریس باز است`,
      estimatedChancePct: 0,
      nextStageTitleFa,
    };
  }

  if (currentStage >= 4) {
    return {
      eligible: false,
      discovered,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: 'به بالاترین جایگاه این مسیر حرفه‌ای رسیده‌ای',
      estimatedChancePct: 100,
      nextStageTitleFa: career.stageTitlesFa[3],
    };
  }

  if (skillState.skill < requiredSkillForNext) {
    return {
      eligible: false,
      discovered,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: `نیازمند تمرین و کلاس بیشتر در «${dataset.talents.talents.find((t) => t.id === activeTalentId)?.titleFa}»`,
      estimatedChancePct: 0,
      nextStageTitleFa,
    };
  }

  if (currentStage >= 2 && player.stats.fame < career.fameRequirementForStage3) {
    return {
      eligible: false,
      discovered,
      currentSkill: skillState.skill,
      currentStage,
      opportunityScore: skillState.opportunityScore,
      reason: `برای سطح ملی نیاز به دیده شدن و جایگاه اجتماعی بیشتر (${toPersianDigits(career.fameRequirementForStage3)}٪) داری`,
      estimatedChancePct: 0,
      nextStageTitleFa,
    };
  }

  const innateScore = player.hiddenTalents[activeTalentId];
  const tierBonus = (innateScore - 50) * 0.004;
  const skillBonus = (skillState.skill - requiredSkillForNext) * 0.005;
  const oppBonus = (skillState.opportunityScore / 100) * 0.16;
  const luckBonus = ((player.hiddenStats.luck - 50) / 100) * career.luckWeight;
  const stagePenalty = currentStage * 0.11;
  const agePenalty =
    player.age > career.peakEndAge ? (player.age - career.peakEndAge) * 0.015 : 0;

  const prob = Math.max(
    0.08,
    Math.min(
      0.84,
      career.baseStageSuccessRate + tierBonus + skillBonus + oppBonus + luckBonus - stagePenalty - agePenalty,
    ),
  );

  return {
    eligible: true,
    discovered,
    currentSkill: skillState.skill,
    currentStage,
    opportunityScore: skillState.opportunityScore,
    estimatedChancePct: Math.round(prob * 100),
    nextStageTitleFa,
  };
}

export function calculateSpecialCareerAnnualIncomeBreakdown(params: {
  career: SpecialCareerDefinition;
  stage: number;
  state: GameState;
  dataset: GameDataset;
  rng?: SeededRNG;
  allowTail?: boolean;
  isFallback?: boolean;
}): JobIncomeBreakdown {
  const { career, stage, state, dataset, rng, allowTail = false, isFallback = false } = params;
  const baseline = dataset.economy.baseline1405;
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  const country = dataset.countries.find((c) => c.id === state.player.countryId);
  const countryFactor = country && !country.isIran ? country.costOfLivingIndex : 1;

  if (!isFallback && allowTail && rng && career.tailPayout && stage >= 2) {
    const fameBoost = 1 + (state.player.stats.fame / 100) * 0.8;
    if (rng.chance(career.tailPayout.probability * fameBoost)) {
      const grossAnnual = Math.max(
        1,
        Math.round(minWageMonthly * career.tailPayout.yearlyCapMultiplierOfMinWage * countryFactor),
      );
      const { bimeh, incomeTax } = calculateProgressiveIncomeTax(
        grossAnnual,
        minWageMonthly,
        baseline,
      );
      const netAnnual = Math.max(1, grossAnnual - bimeh - incomeTax);
      return {
        grossAnnual,
        commission: 0,
        runningCosts: 0,
        bimeh,
        incomeTax,
        netAnnual,
        monthlyMultiplierOfMinWage: Number((grossAnnual / (minWageMonthly * 12)).toFixed(3)),
        tailTriggered: {
          titleFa: career.tailPayout.titleFa,
          resultTextFa: career.tailPayout.resultTextFa,
        },
      };
    }
  }

  let mult = career.fallbackMonthlyMinWageMultiplier;
  if (!isFallback) {
    const map = career.monthlyIncomeMinWageMultiplier;
    mult =
      stage >= 4
        ? map.stage4
        : stage === 3
          ? map.stage3
          : stage === 2
            ? map.stage2
            : map.stage1;
  }

  const variance = rng ? rng.float(0.85, 1.18) : 1;
  const grossAnnual = Math.max(
    1,
    Math.round(minWageMonthly * 12 * mult * variance * countryFactor),
  );
  const { bimeh, incomeTax } = calculateProgressiveIncomeTax(
    grossAnnual,
    minWageMonthly,
    baseline,
  );
  const netAnnual = Math.max(1, grossAnnual - bimeh - incomeTax);

  return {
    grossAnnual,
    commission: 0,
    runningCosts: 0,
    bimeh,
    incomeTax,
    netAnnual,
    monthlyMultiplierOfMinWage: Number((mult * variance).toFixed(3)),
  };
}

export function getOrdinaryJobAptitudeBonus(
  jobTrack: string,
  state: GameState,
): number {
  const t = state.player.hiddenTalents;
  let relevant = 0;
  if (jobTrack === 'tech') relevant = Math.max(t.programming_tech, t.math_science);
  else if (jobTrack === 'medical') relevant = t.math_science;
  else if (jobTrack === 'commerce') relevant = t.business_sense;
  else if (jobTrack === 'government' || jobTrack === 'education')
    relevant = Math.max(t.leadership, t.writing);
  else if (jobTrack === 'craft') relevant = Math.max(t.mechanical, t.cooking, t.visual_art);
  else if (jobTrack === 'transport') relevant = t.mechanical;

  // Gentle bonus: up to +8% interview/performance edge, never gates ordinary jobs
  return relevant >= 70 ? 0.08 : relevant >= 50 ? 0.04 : 0;
}

export function getSpecialCareerStageJobId(careerId: string): string {
  return `special_${careerId}`;
}

export function getSpecialCareerFallbackJobId(careerId: string): string {
  return `special_fallback_${careerId}`;
}

export function isSpecialCareerJobId(jobId: string): {
  careerId: string;
  isFallback: boolean;
} | null {
  if (jobId.startsWith('special_fallback_')) {
    return { careerId: jobId.replace('special_fallback_', ''), isFallback: true };
  }
  if (jobId.startsWith('special_')) {
    return { careerId: jobId.replace('special_', ''), isFallback: false };
  }
  return null;
}

export function formatSpecialRouteChoiceSummary(
  career: SpecialCareerDefinition,
  routeId: SpecialCareerRouteId,
  state: GameState,
): string {
  const route = career.alternativeRoutes.find((r) => r.id === routeId);
  if (!route) return '';
  if (routeId === 'mainstream' && state.player.gender === 'female' && career.femaleMainstreamNoteFa) {
    return career.femaleMainstreamNoteFa;
  }
  return route.noteFa;
}

export function buildSpecialCareerDisplaySalary(
  career: SpecialCareerDefinition,
  stage: number,
  state: GameState,
  dataset: GameDataset,
  isFallback = false,
): string {
  const breakdown = calculateSpecialCareerAnnualIncomeBreakdown({
    career,
    stage: Math.max(1, stage),
    state,
    dataset,
    isFallback,
  });
  return `خالص ${formatToman(breakdown.netAnnual)} / سال`;
}
