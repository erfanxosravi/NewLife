import { gameDataset, type GameDataset } from '../data/registry';
import {
  calculateAbroadJobIncome,
  getAbroadMonthlyBudget,
  getCountryMacroDef,
  getCountryPathsDef,
} from '../engine/countries';
import {
  calculateHousingQuote,
  calculateJobAnnualIncomeBreakdown,
  calculateNetWorthToman,
  convertDepositRentPair,
  getAnnualLivingExpenseToman,
  getBaselineScaleFromMinWage,
  getMacroRatesForState,
  getPurchasingPowerSummary,
  getTehran70SqmTransactionPriceToman,
  type HousingPriceQuote,
  type JobIncomeBreakdown,
} from '../engine/economy';
import {
  compareCountries,
  computeEmigrationDifficulty,
  ensureEmigrationState,
  rankCountriesForPlayer,
} from '../engine/emigration';
import { getDisplayCurrencyCode } from '../engine/fx';
import { toPersianDigits } from '../engine/jalali';
import { formatSingleCurrency } from '../engine/money';
import {
  getAnnualRealPerformanceAndBenchmarks,
  getCurrencyExposureBreakdown,
  getLedgerNetWorth,
  getSavingsErosionWarnings,
  getTotalAssetsAndLiabilitiesInToman,
} from '../engine/ledger';
import {
  ensureActivityRuntimeState,
  getPinnedUrgentAlert,
  getRecentAndFavoriteActivities,
  getSeasonalActivities,
  getSmartRecommendations,
} from '../engine/recommendation';
import {
  checkPromotionEligibility,
  getLicenseStatus,
  hasCredential,
  type LicenseStatus,
  type PromotionEligibility,
} from '../engine/careers';
import {
  ensureAdoptionState,
  evaluateAdoptionEligibility,
  getAdoptionCostEstimates,
  type AdoptionEligibilityReport,
} from '../engine/adoption';
import {
  calculateBusinessAcquisitionQuote,
  checkFamilyTakeoverEligibility,
  type BusinessAcquisitionQuote,
  type EmployerOfferData,
} from '../engine/businesses';
import {
  buildSpecialCareerDisplaySalary,
  getAthleticDisciplineTitleFa,
  getSpecialCareerEligibility,
  getTalentLessonCostToman,
  getTalentSkillState,
  getTierLabelFa,
  type SpecialCareerEligibility,
} from '../engine/talents';
import type {
  ActivityDefinition,
  BusinessAcquisitionMode,
  BusinessFinancingMode,
  BusinessSize,
  BusinessTypeDefinition,
  City,
  CountryDefinition,
  EducationLevel,
  GameState,
  HousingListing,
  HousingRegionTier,
  JobDefinition,
  Person,
  PlayerStats,
  Relationship,
  SaveGame,
  ShopItemDefinition,
  SkillDefinition,
  SpecialCareerDefinition,
  TalentId,
  TalentTier,
  UniversityTier,
} from '../engine/types';

export interface StatHistoryPoint {
  age: number;
  health: number;
  happiness: number;
  intelligence: number;
  looks: number;
  mentalHealth: number;
  fame: number;
  netWorth: number;
}

export interface EducationHistoryItem {
  stageFa: string;
  year: number;
  detailFa: string;
}

export interface WorkHistoryItem {
  title: string;
  employer: string;
  fromYear: number;
  toYear?: number;
}

export interface EmigrationProgress {
  targetCountryId: string | null;
  path: 'study' | 'work' | 'investment' | null;
  step: number; // 0: none, 1: docs, 2: language, 3: admission/offer, 4: visa ready
}

function parseJsonFlag<T>(flags: GameState['flags'], key: string, fallback: T): T {
  const raw = flags[key];
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getStatHistory(state: GameState): StatHistoryPoint[] {
  return parseJsonFlag<StatHistoryPoint[]>(state.flags, 'hist_stats', []);
}

export function getLastYearStatDeltas(state: GameState): Partial<Record<keyof PlayerStats, number>> {
  const history = getStatHistory(state);
  if (history.length < 2) return {};
  const prev = history[history.length - 2];
  const curr = state.player.stats;
  return {
    health: curr.health - prev.health,
    happiness: curr.happiness - prev.happiness,
    intelligence: curr.intelligence - prev.intelligence,
    looks: curr.looks - prev.looks,
    mentalHealth: curr.mentalHealth - prev.mentalHealth,
    fame: curr.fame - prev.fame,
  };
}

export function getNetWorthSeries(state: GameState): number[] {
  const history = getStatHistory(state);
  const series = history.map((p) => p.netWorth);
  const current = calculateNetWorthToman(state);
  if (series.length === 0 || series[series.length - 1] !== current) {
    series.push(current);
  }
  return series;
}

export function getSkillLevels(state: GameState): Record<string, number> {
  return parseJsonFlag<Record<string, number>>(state.flags, 'skills_json', {});
}

export function getSkillLevel(state: GameState, skillId: string): number {
  const map = getSkillLevels(state);
  return Math.max(0, Math.min(5, map[skillId] ?? 0));
}

export function getStudyEffort(state: GameState): number {
  const raw = state.flags['study_effort'];
  return typeof raw === 'number' ? Math.max(0, Math.min(100, raw)) : 65;
}

export function getEducationHistory(state: GameState): EducationHistoryItem[] {
  return parseJsonFlag<EducationHistoryItem[]>(state.flags, 'hist_edu', []);
}

export function getWorkHistory(state: GameState): WorkHistoryItem[] {
  return parseJsonFlag<WorkHistoryItem[]>(state.flags, 'hist_work', []);
}

export function getOwnedShopItemIds(state: GameState): string[] {
  return parseJsonFlag<string[]>(state.flags, 'shop_owned', []);
}

export function getNpcHistory(state: GameState, personId: string): { age: number; text: string }[] {
  return parseJsonFlag<{ age: number; text: string }[]>(state.flags, `hist_rel_${personId}`, []);
}

export function getCreditScore(state: GameState): number {
  const raw = state.flags['credit_score'];
  return typeof raw === 'number' ? Math.max(300, Math.min(850, raw)) : 660;
}

export function getEmigrationProgress(state: GameState): EmigrationProgress {
  const target = state.flags['emig_target'];
  const path = state.flags['emig_path'];
  const step = state.flags['emig_step'];
  return {
    targetCountryId: typeof target === 'string' && target.length > 0 ? target : null,
    path: path === 'study' || path === 'work' || path === 'investment' ? path : null,
    step: typeof step === 'number' ? Math.max(0, Math.min(4, step)) : 0,
  };
}

export function getUsdRateToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getMacroRatesForState(state, dataset).usdFree;
}

export function getGoldGramPriceToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getMacroRatesForState(state, dataset).gold18kPerGram;
}

export function getEmamiCoinPriceToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getMacroRatesForState(state, dataset).emamiCoin;
}

export function getTehranSqmPriceToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getMacroRatesForState(state, dataset).tehranListingSqm;
}

export function getMinWageMonthly(state: GameState, dataset: GameDataset = gameDataset): number {
  return getMacroRatesForState(state, dataset).minWageMonthly;
}

export function getMarketRatesHistory(
  state: GameState,
  dataset: GameDataset = gameDataset,
): { usd: number[]; gold: number[] } {
  const usd = parseJsonFlag<number[]>(state.flags, 'hist_usd', [getUsdRateToman(state, dataset)]);
  const gold = parseJsonFlag<number[]>(state.flags, 'hist_gold', [
    getGoldGramPriceToman(state, dataset),
  ]);
  return { usd, gold };
}

export function getAmountPurchasingPower(
  amountToman: number,
  state: GameState,
  dataset: GameDataset = gameDataset,
) {
  return getPurchasingPowerSummary(amountToman, state, dataset);
}

export function formatUsdEquivalentHint(
  amountToman: number,
  state: GameState,
  dataset: GameDataset = gameDataset,
): string {
  const { usdEquivalent } = getPurchasingPowerSummary(amountToman, state, dataset);
  const absUsd = Math.abs(usdEquivalent);
  const sign = usdEquivalent < 0 ? '−' : '';
  return `معادل ${sign}${toPersianDigits(absUsd.toLocaleString('en-US'))} دلار`;
}

export function getTehran70SqmRefPrice(state: GameState, dataset: GameDataset = gameDataset): number {
  return getTehran70SqmTransactionPriceToman(state, dataset);
}

export function getAdjustedPriceToman(basePriceToman: number, state: GameState): number {
  return Math.round(basePriceToman * state.inflationMultiplier);
}

export function getShopItemPriceToman(item: ShopItemDefinition, state: GameState): number {
  return getAdjustedPriceToman(item.basePriceToman, state);
}

export function getTutorCostToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getBaselineScaleFromMinWage(
    dataset.economy.baseline1405.policyAndModel.tutorFeeMinWageMultiple.value,
    state,
    dataset,
  );
}

export function getKonkurFeeToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getBaselineScaleFromMinWage(
    dataset.economy.baseline1405.policyAndModel.konkurFeeMinWageMultiple.value,
    state,
    dataset,
  );
}

export function getBusinessCapitalToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getBaselineScaleFromMinWage(
    dataset.economy.baseline1405.policyAndModel.businessStartupCapitalMinWageMultiple.value,
    state,
    dataset,
  );
}

export function getMilitaryBuyoutCostToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getBaselineScaleFromMinWage(
    dataset.economy.baseline1405.policyAndModel.militaryBuyoutMinWageMultiple.value,
    state,
    dataset,
  );
}

export function getRelationshipActionCosts(state: GameState, dataset: GameDataset = gameDataset) {
  const p = dataset.economy.baseline1405.policyAndModel;
  return {
    giftCost: getBaselineScaleFromMinWage(p.giftMinWageMultiple.value, state, dataset),
    tripCost: getBaselineScaleFromMinWage(p.domesticTripMinWageMultiple.value, state, dataset),
    weddingCost: getBaselineScaleFromMinWage(p.weddingMinWageMultiple.value, state, dataset),
  };
}

export function getUniversityTuitionToman(
  tier: UniversityTier,
  majorFa: string,
  state: GameState,
  dataset: GameDataset = gameDataset,
): number {
  const p = dataset.economy.baseline1405.policyAndModel;
  let multiple = p.uniTuitionStateMinWageMultiple.value;
  if (tier === 'state_top') {
    multiple = majorFa.includes('پزشک')
      ? p.uniTuitionStateTopMedMinWageMultiple.value
      : p.uniTuitionStateTopEngMinWageMultiple.value;
  } else if (tier === 'azad') {
    multiple = p.uniTuitionAzadMinWageMultiple.value;
  } else if (tier === 'applied_science') {
    multiple = p.uniTuitionAppliedScienceMinWageMultiple.value;
  }
  return getBaselineScaleFromMinWage(multiple, state, dataset);
}

export function getLoanPresets(state: GameState, dataset: GameDataset = gameDataset) {
  const p = dataset.economy.baseline1405.policyAndModel;
  const personalPrincipal = getBaselineScaleFromMinWage(
    p.loanPersonalMinWageMultiple.value,
    state,
    dataset,
  );
  const housingPrincipal = getBaselineScaleFromMinWage(
    p.loanHousingMinWageMultiple.value,
    state,
    dataset,
  );
  return {
    personal: {
      name: 'وام ضروری',
      labelFa: `وام ضروری / ازدواج (سود ${toPersianDigits(Math.round(p.loanPersonalRate.value * 100))}٪ · ${toPersianDigits(p.loanPersonalYears.value)} ساله)`,
      principalToman: personalPrincipal,
      annualRate: p.loanPersonalRate.value,
      years: p.loanPersonalYears.value,
    },
    housing: {
      name: 'وام مسکن',
      labelFa: `وام مسکن و ودیعه (سود ${toPersianDigits(Math.round(p.loanHousingRate.value * 100))}٪ · ${toPersianDigits(p.loanHousingYears.value)} ساله)`,
      principalToman: housingPrincipal,
      annualRate: p.loanHousingRate.value,
      years: p.loanHousingYears.value,
    },
  };
}

export function getDebtPayoffChunkToman(state: GameState, dataset: GameDataset = gameDataset): number {
  return getBaselineScaleFromMinWage(
    dataset.economy.baseline1405.policyAndModel.debtPayoffChunkMinWageMultiple.value,
    state,
    dataset,
  );
}

export function getQuickTradeAmountToman(state: GameState, dataset: GameDataset = gameDataset): number {
  const p = dataset.economy.baseline1405.policyAndModel;
  const minAmt = getBaselineScaleFromMinWage(
    p.investmentQuickTradeMinMinWageMultiple.value,
    state,
    dataset,
  );
  const maxAmt = getBaselineScaleFromMinWage(
    p.investmentQuickTradeMaxMinWageMultiple.value,
    state,
    dataset,
  );
  const target =
    state.player.moneyToman > 0
      ? Math.round(state.player.moneyToman * p.investmentQuickTradeShare.value)
      : minAmt;
  return Math.max(minAmt, Math.min(target, maxAmt));
}

export function getCarRepairCostToman(
  carValueToman: number,
  dataset: GameDataset = gameDataset,
): number {
  return Math.round(
    carValueToman * dataset.economy.baseline1405.policyAndModel.carRepairRate.value,
  );
}

export function getHousingListingQuote(
  listing: HousingListing,
  state: GameState,
  dataset: GameDataset = gameDataset,
): HousingPriceQuote {
  return calculateHousingQuote(listing, state.player.currentCityId, state, dataset);
}

export function getConvertedRentalPair(
  baseDepositToman: number,
  baseMonthlyRentToman: number,
  extraDepositToman: number,
  dataset: GameDataset = gameDataset,
) {
  return convertDepositRentPair(baseDepositToman, baseMonthlyRentToman, extraDepositToman, dataset);
}

export function getEmigrationTotalCostToman(
  country: CountryDefinition,
  state: GameState,
  dataset: GameDataset = gameDataset,
): number {
  const usdRate = getUsdRateToman(state, dataset);
  const anchorUsd = dataset.economy.baseline1405.verifiedBenchmarks.usdFree.value;
  return Math.max(1, Math.round(country.baseMigrationCostToman * (usdRate / Math.max(1, anchorUsd))));
}

export function getEmigrationStepCostToman(
  country: CountryDefinition,
  currentStepZeroBased: number,
  state: GameState,
  dataset: GameDataset = gameDataset,
): number {
  const total = getEmigrationTotalCostToman(country, state, dataset);
  const ratios = [0.12, 0.15, 0.28, 0.45];
  const ratio = ratios[currentStepZeroBased] ?? 0.45;
  return Math.max(1, Math.round(total * ratio));
}

export function getActionCooldownRemaining(
  state: GameState,
  actionKey: string,
  cooldownYears = 1,
): number {
  const lastTurn = state.flags[`cd_${actionKey}`];
  if (typeof lastTurn !== 'number') return 0;
  const elapsed = state.turn - lastTurn;
  return elapsed < cooldownYears ? cooldownYears - elapsed : 0;
}

export function canPerformActivity(
  activity: ActivityDefinition,
  save: SaveGame,
): { allowed: boolean; reason?: string; adjustedCost: number } {
  const { state, contentSettings } = save;
  const { player } = state;
  const adjustedCost = getAdjustedPriceToman(activity.costToman, save.state);

  if (!state.isAlive) {
    return { allowed: false, reason: 'زندگی به پایان رسیده است', adjustedCost };
  }
  if (activity.contentTag === 'crime' && !contentSettings.allowCrime) {
    return { allowed: false, reason: 'در تنظیمات محتوا غیرفعال است', adjustedCost };
  }
  if (activity.contentTag === 'substance' && !contentSettings.allowSubstance) {
    return { allowed: false, reason: 'در تنظیمات محتوا غیرفعال است', adjustedCost };
  }
  if (activity.contentTag === 'romance' && !contentSettings.allowRomance) {
    return { allowed: false, reason: 'در تنظیمات محتوا غیرفعال است', adjustedCost };
  }
  if (player.age < activity.minAge) {
    return {
      allowed: false,
      reason: `از ${toPersianDigits(activity.minAge)} سالگی فعال می‌شود`,
      adjustedCost,
    };
  }
  if (activity.maxAge !== undefined && player.age > activity.maxAge) {
    return {
      allowed: false,
      reason: `تا ${toPersianDigits(activity.maxAge)} سالگی مجاز است`,
      adjustedCost,
    };
  }
  if (activity.minIntelligence !== undefined && player.stats.intelligence < activity.minIntelligence) {
    return {
      allowed: false,
      reason: `نیاز به هوش ${toPersianDigits(activity.minIntelligence)} دارد`,
      adjustedCost,
    };
  }
  const cd = getActionCooldownRemaining(state, `act_${activity.id}`, activity.cooldownYears);
  if (cd > 0) {
    return {
      allowed: false,
      reason: cd === 1 ? 'فقط یک بار در سال' : `${toPersianDigits(cd)} سال تا نوبت بعد`,
      adjustedCost,
    };
  }
  const activityRuntime = ensureActivityRuntimeState(state);
  const quotaCost = activity.quotaCost ?? 1;
  if (activityRuntime.quotaUsedThisTurn + quotaCost > activityRuntime.maxQuotaPerTurn) {
    return {
      allowed: false,
      reason: 'سهمیه فعالیت امسال تکمیل شده است',
      adjustedCost,
    };
  }
  const availableToman =
    player.countryId !== 'iran' && state.ledger
      ? Math.max(
          player.moneyToman,
          getTotalAssetsAndLiabilitiesInToman(state, gameDataset).walletsToman,
        )
      : player.moneyToman;
  if (adjustedCost > availableToman) {
    return { allowed: false, reason: 'موجودی کافی نیست', adjustedCost };
  }
  return { allowed: true, adjustedCost };
}

export function isActivityVisibleByContentSettings(
  activity: ActivityDefinition,
  save: SaveGame,
): boolean {
  if (activity.category === 'crime' || activity.contentTag === 'crime') {
    return save.contentSettings.allowCrime;
  }
  if (activity.category === 'gambling' && !save.contentSettings.allowCrime) {
    return false;
  }
  if (activity.contentTag === 'substance' && !save.contentSettings.allowSubstance) {
    return false;
  }
  if (activity.contentTag === 'romance' && !save.contentSettings.allowRomance) {
    return false;
  }
  return true;
}

const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0,
  preschool: 1,
  elementary: 2,
  middle_school: 3,
  high_school: 4,
  diploma: 5,
  associate: 6,
  bachelor: 7,
  master: 8,
  phd: 9,
  medical_doctor: 9,
};

export function meetsEducationRequirement(
  current: EducationLevel,
  required: EducationLevel,
): boolean {
  return EDUCATION_RANK[current] >= EDUCATION_RANK[required];
}

export function getJobApplicationStatus(
  job: JobDefinition,
  state: GameState,
  dataset: GameDataset = gameDataset,
): {
  eligible: boolean;
  reason?: string;
  estimatedChancePct: number;
  estimatedSalary: number;
  breakdown: JobIncomeBreakdown;
} {
  const { player } = state;
  let breakdown: JobIncomeBreakdown;
  if (player.countryId !== 'iran') {
    const ab = calculateAbroadJobIncome({
      job,
      level: 1,
      state,
      dataset,
      positionOverride01: 0.35,
    });
    breakdown = {
      grossAnnual: ab.grossAnnualToman,
      commission: 0,
      runningCosts: 0,
      bimeh: Math.round(
        ab.socialSecurityLocal * (ab.grossAnnualToman / Math.max(1, ab.grossAnnualLocal)),
      ),
      incomeTax: Math.round(
        ab.incomeTaxLocal * (ab.grossAnnualToman / Math.max(1, ab.grossAnnualLocal)),
      ),
      netAnnual: ab.netAnnualToman,
      monthlyMultiplierOfMinWage: ab.monthlyMultiplierOfMinWage,
    };
  } else {
    breakdown = calculateJobAnnualIncomeBreakdown({
      job,
      level: 1,
      state,
      dataset,
      positionOverride01: 0.35,
    });
  }
  const estimatedSalary = breakdown.netAnnual;

  if (player.age < 18) {
    return {
      eligible: false,
      reason: 'از ۱۸ سالگی می‌توانی درخواست بدهی',
      estimatedChancePct: 0,
      estimatedSalary,
      breakdown,
    };
  }
  if (!meetsEducationRequirement(player.education.level, job.minEducation)) {
    return {
      eligible: false,
      reason: 'مدرک تحصیلی کافی نیست',
      estimatedChancePct: 0,
      estimatedSalary,
      breakdown,
    };
  }
  if (player.gender === 'male' && player.militaryStatus === 'serving') {
    return {
      eligible: false,
      reason: 'در حین خدمت سربازی امکان استخدام تمام‌وقت نیست',
      estimatedChancePct: 0,
      estimatedSalary,
      breakdown,
    };
  }
  if (job.employerType === 'دولتی' && player.criminalRecord > 0) {
    return {
      eligible: false,
      reason: 'سوءپیشینه مانع استخدام دولتی است',
      estimatedChancePct: 0,
      estimatedSalary,
      breakdown,
    };
  }
  if (job.requiredLicenseId && !hasCredential(state, job.requiredLicenseId)) {
    const licTitle =
      dataset.businesses.licenses.find((l) => l.id === job.requiredLicenseId)?.titleFa ??
      'مجوز تخصصی';
    return {
      eligible: false,
      reason: `نیاز به دریافت «${licTitle}»`,
      estimatedChancePct: 0,
      estimatedSalary,
      breakdown,
    };
  }

  const base = job.baseSuccessChance ?? 0.7;
  const intelBonus = (player.stats.intelligence - 50) * 0.003;
  const skillLevel = job.requiredSkillId ? getSkillLevel(state, job.requiredSkillId) : 0;
  const skillBonus = skillLevel * 0.06;
  const cd = getActionCooldownRemaining(state, `apply_job_${job.id}`, 1);

  if (cd > 0) {
    return {
      eligible: false,
      reason: 'فقط یک بار در سال',
      estimatedChancePct: Math.round(
        Math.max(10, Math.min(95, (base + intelBonus + skillBonus) * 100)),
      ),
      estimatedSalary,
      breakdown,
    };
  }

  const city = dataset.cities.find((c) => c.id === player.currentCityId);
  const cityBonus = city ? (city.jobOpportunityIndex - 1) * 0.1 : 0;
  const pct = Math.round(
    Math.max(12, Math.min(96, (base + intelBonus + skillBonus + cityBonus) * 100)),
  );
  return { eligible: true, estimatedChancePct: pct, estimatedSalary, breakdown };
}

export function getGroupedRelationships(state: GameState): {
  family: { rel: Relationship; person: Person }[];
  friends: { rel: Relationship; person: Person }[];
  romance: { rel: Relationship; person: Person }[];
  children: { rel: Relationship; person: Person }[];
  deceased: { rel: Relationship; person: Person }[];
  allAlive: { rel: Relationship; person: Person }[];
} {
  const family: { rel: Relationship; person: Person }[] = [];
  const friends: { rel: Relationship; person: Person }[] = [];
  const romance: { rel: Relationship; person: Person }[] = [];
  const children: { rel: Relationship; person: Person }[] = [];
  const deceased: { rel: Relationship; person: Person }[] = [];
  const allAlive: { rel: Relationship; person: Person }[] = [];

  for (const rel of state.relationships) {
    const person = state.npcs[rel.personId];
    if (!person) continue;
    const item = { rel, person };
    if (!person.isAlive) {
      deceased.push(item);
      continue;
    }
    allAlive.push(item);
    if (rel.role === 'father' || rel.role === 'mother' || rel.role === 'sibling') {
      family.push(item);
    } else if (rel.role === 'friend') {
      friends.push(item);
    } else if (rel.role === 'partner' || rel.role === 'spouse') {
      romance.push(item);
    } else if (rel.role === 'child') {
      children.push(item);
    }
  }

  return { family, friends, romance, children, deceased, allAlive };
}

export function getCityById(dataset: GameDataset, cityId: string): City | undefined {
  return dataset.cities.find((c) => c.id === cityId);
}

export function getCountryById(
  dataset: GameDataset,
  countryId: string,
): CountryDefinition | undefined {
  return dataset.countries.find((c) => c.id === countryId);
}

export function getSkillTrainingCost(skill: SkillDefinition, state: GameState): number {
  return getAdjustedPriceToman(skill.costToman, state);
}

export function getAnnualIncomeEstimate(state: GameState): number {
  const salary = state.player.job?.annualSalaryToman ?? 0;
  const bizProfit = state.ownedBusiness ? state.ownedBusiness.lastYearProfitToman : 0;
  const pensionOrLegacy =
    typeof state.flags['pension_income'] === 'number'
      ? state.flags['pension_income']
      : !state.ownedBusiness && typeof state.flags['business_income'] === 'number'
        ? state.flags['business_income']
        : 0;
  return Math.round(salary + bizProfit + pensionOrLegacy);
}

export function getAnnualExpenseEstimate(
  state: GameState,
  dataset: GameDataset = gameDataset,
): number {
  const baseLiving = getAnnualLivingExpenseToman(state, dataset);
  const rent = state.player.housing.monthlyRentToman * 12;
  const loans = state.loans.reduce((sum, l) => sum + l.annualPaymentToman, 0);
  const carRate = dataset.economy.baseline1405.policyAndModel.carAnnualMaintenanceRate.value;
  const vehicles = state.assets
    .filter((a) => a.type === 'car')
    .reduce((sum, v) => sum + Math.round(v.currentValueToman * carRate), 0);
  return Math.round(baseLiving + rent + loans + vehicles);
}

export interface DiscoveredTalentDisplay {
  talentId: TalentId;
  titleFa: string;
  categoryFa: string;
  tier: TalentTier;
  tierLabelFa: string;
  tierDescriptionFa: string;
  discoveredAge: number;
  hintTextFa: string;
  athleticDisciplineTitleFa?: string;
  skillLevelLabelFa: string;
  careerStage: number;
}

export function getQualitativeSkillLabelFa(skill: number): string {
  if (skill >= 80) return 'حرفه‌ای و مسلط';
  if (skill >= 55) return 'پیشرفته';
  if (skill >= 30) return 'متوسط';
  if (skill >= 10) return 'آشنا';
  return 'شروع تازه';
}

export function getDiscoveredTalentsDisplay(
  state: GameState,
  dataset: GameDataset = gameDataset,
): DiscoveredTalentDisplay[] {
  return (state.player.discoveredTalents ?? []).map((dt) => {
    const def = dataset.talents.talents.find((t) => t.id === dt.talentId);
    const tierDef = dataset.talents.tiers.find((tr) => tr.id === dt.tier);
    const skillState = getTalentSkillState(state, dt.talentId);
    return {
      talentId: dt.talentId,
      titleFa: def?.titleFa ?? dt.talentId,
      categoryFa: def?.categoryFa ?? 'استعداد',
      tier: dt.tier,
      tierLabelFa: getTierLabelFa(dt.tier, dataset),
      tierDescriptionFa: tierDef?.descriptionFa ?? '',
      discoveredAge: dt.discoveredAge,
      hintTextFa: dt.hintTextFa,
      athleticDisciplineTitleFa: dt.athleticDiscipline
        ? getAthleticDisciplineTitleFa(dt.athleticDiscipline, dataset)
        : undefined,
      skillLevelLabelFa: getQualitativeSkillLabelFa(skillState.skill),
      careerStage: skillState.careerStage,
    };
  });
}

export interface TalentPracticeOption {
  talentId: TalentId;
  titleFa: string;
  categoryFa: string;
  lessonTitleFa: string;
  isDiscovered: boolean;
  discoveredTierLabelFa?: string;
  athleticDisciplineTitleFa?: string;
  skillValue: number;
  skillLevelLabelFa: string;
  lessonCostToman: number;
  minPracticeAge: number;
  cooldownRemaining: number;
}

export function getTalentPracticeOptions(
  state: GameState,
  dataset: GameDataset = gameDataset,
): TalentPracticeOption[] {
  const discoveredMap = new Map(
    (state.player.discoveredTalents ?? []).map((d) => [d.talentId, d]),
  );

  return dataset.talents.talents.map((t) => {
    const disc = discoveredMap.get(t.id);
    const skillState = getTalentSkillState(state, t.id);
    return {
      talentId: t.id,
      titleFa: t.titleFa,
      categoryFa: t.categoryFa,
      lessonTitleFa: t.lessonTitleFa,
      isDiscovered: Boolean(disc),
      discoveredTierLabelFa: disc ? getTierLabelFa(disc.tier, dataset) : undefined,
      athleticDisciplineTitleFa:
        t.id === 'athletics'
          ? getAthleticDisciplineTitleFa(state.player.athleticDiscipline, dataset)
          : undefined,
      skillValue: skillState.skill,
      skillLevelLabelFa: getQualitativeSkillLabelFa(skillState.skill),
      lessonCostToman: getTalentLessonCostToman(t, state, dataset),
      minPracticeAge: t.minPracticeAge,
      cooldownRemaining: getActionCooldownRemaining(state, `talent_${t.id}`, 1),
    };
  });
}

export interface SpecialCareerCardData {
  career: SpecialCareerDefinition;
  eligibility: SpecialCareerEligibility;
  salaryText: string;
  fallbackSalaryText: string;
  fallbackEligible: boolean;
  isCurrentSpecialJob: boolean;
  isCurrentFallbackJob: boolean;
}

export function getSpecialCareerCards(
  state: GameState,
  dataset: GameDataset = gameDataset,
): SpecialCareerCardData[] {
  return dataset.specialCareers.map((career) => {
    const eligibility = getSpecialCareerEligibility(career, state, dataset);
    const targetStage = Math.min(4, eligibility.currentStage + 1);
    const currentJobId = state.player.job?.jobId;
    const isCurrentSpecialJob = currentJobId === `special_${career.id}`;
    const isCurrentFallbackJob = currentJobId === `special_fallback_${career.id}`;
    const skillState = getTalentSkillState(state, career.requiredTalentId);
    const fallbackEligible =
      state.player.age >= 18 &&
      (Boolean(eligibility.discovered) || skillState.skill >= 25);

    return {
      career,
      eligibility,
      salaryText: buildSpecialCareerDisplaySalary(career, targetStage, state, dataset, false),
      fallbackSalaryText: buildSpecialCareerDisplaySalary(career, 1, state, dataset, true),
      fallbackEligible,
      isCurrentSpecialJob,
      isCurrentFallbackJob,
    };
  });
}

export function getCurrentJobPromotionState(
  state: GameState,
  dataset: GameDataset = gameDataset,
): { jobDef: JobDefinition; eligibility: PromotionEligibility } | null {
  if (!state.player.job) return null;
  const jobDef = dataset.jobs.find((j) => j.id === state.player.job!.jobId);
  if (!jobDef) return null;
  return {
    jobDef,
    eligibility: checkPromotionEligibility(state, jobDef, dataset),
  };
}

export function getAllLicensesStatus(
  state: GameState,
  dataset: GameDataset = gameDataset,
): LicenseStatus[] {
  return dataset.businesses.licenses.map((lic) => getLicenseStatus(lic, state, dataset));
}

export function getPendingEmployerOffer(state: GameState): EmployerOfferData | null {
  const raw = state.flags['pending_employer_offer'];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as EmployerOfferData;
  } catch {
    return null;
  }
}

export function getPendingFamilyBizInheritance(
  state: GameState,
): { businessTypeId: string; businessNameFa: string; offeredYear: number } | null {
  const raw = state.flags['pending_family_biz_inheritance'];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as { businessTypeId: string; businessNameFa: string; offeredYear: number };
  } catch {
    return null;
  }
}

export function getBusinessQuotePreview(params: {
  businessDef: BusinessTypeDefinition;
  acquisitionMode: BusinessAcquisitionMode;
  financingMode: BusinessFinancingMode;
  cityId: string;
  regionTier: HousingRegionTier;
  size: BusinessSize;
  state: GameState;
  dataset?: GameDataset;
  employerOfferPriceToman?: number;
}): BusinessAcquisitionQuote {
  return calculateBusinessAcquisitionQuote({
    ...params,
    dataset: params.dataset ?? gameDataset,
  });
}

export function getFamilyBusinessCandidates(
  state: GameState,
  dataset: GameDataset = gameDataset,
) {
  return dataset.businesses.businesses.map((b) => ({
    businessDef: b,
    family: checkFamilyTakeoverEligibility(state, b),
  }));
}

export interface AdoptionHubSummary {
  adoptionState: ReturnType<typeof ensureAdoptionState>;
  activeApplication: ReturnType<typeof ensureAdoptionState>['activeApplication'];
  eligibilityPermanent: AdoptionEligibilityReport;
  activeEligibility: AdoptionEligibilityReport;
  costEstimates: ReturnType<typeof getAdoptionCostEstimates>;
  pendingTasksCount: number;
  latestVisit: ReturnType<typeof ensureAdoptionState>['supervisionVisits'][number] | null;
  adoptedChildrenCount: number;
}

export function getAdoptionHubSummary(
  state: GameState,
  dataset: GameDataset = gameDataset,
): AdoptionHubSummary {
  const adoptionState = ensureAdoptionState(state);
  const activeCareType = adoptionState.activeApplication?.careType ?? 'permanent';
  const eligibilityPermanent = evaluateAdoptionEligibility(state, 'permanent', dataset);
  const activeEligibility =
    activeCareType === 'permanent'
      ? eligibilityPermanent
      : evaluateAdoptionEligibility(state, activeCareType, dataset);
  const pendingTasksCount = adoptionState.supervisionVisits.reduce(
    (sum, v) => sum + v.tasks.filter((t) => !t.completed).length,
    0,
  );
  const latestVisit =
    adoptionState.supervisionVisits.length > 0
      ? adoptionState.supervisionVisits[adoptionState.supervisionVisits.length - 1]
      : null;
  const adoptedChildrenCount = state.relationships.filter((r) => {
    if (r.role !== 'child') return false;
    const p = state.npcs[r.personId];
    return Boolean(
      p &&
        p.isAlive &&
        (p.originKind === 'adopted' ||
          p.originKind === 'temporary_guardian' ||
          p.originKind === 'host_family'),
    );
  }).length;

  return {
    adoptionState,
    activeApplication: adoptionState.activeApplication,
    eligibilityPermanent,
    activeEligibility,
    costEstimates: getAdoptionCostEstimates(state, dataset),
    pendingTasksCount,
    latestVisit,
    adoptedChildrenCount,
  };
}

export function getHeaderMoneySummary(
  state: GameState,
  dataset: GameDataset = gameDataset,
) {
  const displayCurrency = getDisplayCurrencyCode(state, dataset);
  const netWorth = getLedgerNetWorth(state, dataset);
  const exposure = getCurrencyExposureBreakdown(state, dataset);
  const warnings = getSavingsErosionWarnings(state, dataset);
  const perf = getAnnualRealPerformanceAndBenchmarks(state, dataset);
  const cashDisplayAmount =
    netWorth.displayCurrency === 'IRT'
      ? state.player.moneyToman
      : state.ledger
        ? state.ledger.wallets
            .filter((w) => w.currencyCode === netWorth.displayCurrency)
            .reduce((s, w) => s + w.balance, 0) ||
          Number(
            (
              state.player.moneyToman *
              (netWorth.tomanAmount > 0 ? netWorth.displayAmount / netWorth.tomanAmount : 0)
            ).toFixed(2),
          )
        : state.player.moneyToman;
  const cashDisplayText = formatSingleCurrency(cashDisplayAmount, displayCurrency, dataset);
  const primaryFormatted = formatSingleCurrency(
    netWorth.displayAmount,
    netWorth.displayCurrency,
    dataset,
  );
  const secondaryTomanFormatted = formatSingleCurrency(netWorth.tomanAmount, 'IRT', dataset);
  return {
    displayCurrency,
    netWorth: {
      ...netWorth,
      primaryFormatted,
      secondaryTomanFormatted,
    },
    cashDisplayAmount,
    cashDisplayText,
    exposure,
    warnings,
    performance: perf,
  };
}

export function getEmigrationHubSummary(
  state: GameState,
  dataset: GameDataset = gameDataset,
) {
  const emigration = ensureEmigrationState(state);
  const ranked = rankCountriesForPlayer(state, dataset);
  const compareIds =
    emigration.shortlistedCountryIds.length > 0
      ? emigration.shortlistedCountryIds
      : ranked.slice(0, 3).map((r) => r.countryId);
  const comparison = compareCountries(compareIds, state, dataset);
  const abroadBudget =
    state.player.countryId !== 'iran' ? getAbroadMonthlyBudget(state, dataset) : null;
  const activeCountryDef =
    state.player.countryId !== 'iran' ? getCountryMacroDef(state.player.countryId, dataset) : null;
  const activePathsDef =
    state.player.countryId !== 'iran' ? getCountryPathsDef(state.player.countryId, dataset) : null;

  return {
    emigration,
    ranked,
    comparison,
    abroadBudget,
    activeCountryDef,
    activePathsDef,
    computeDifficulty: (countryId: string, pathId?: 'study' | 'work' | 'skilled' | 'investment' | 'family') =>
      computeEmigrationDifficulty({ countryId, pathId, state, dataset }),
  };
}

export function getActivitiesHubSummary(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
) {
  const runtime = ensureActivityRuntimeState(save.state);
  const urgentAlert = getPinnedUrgentAlert(save, dataset);
  const smartRecommendations = getSmartRecommendations(save, dataset, 5);
  const seasonal = getSeasonalActivities(save, dataset);
  const { favorites, recents } = getRecentAndFavoriteActivities(save, dataset);
  const moneySummary = getHeaderMoneySummary(save.state, dataset);
  return {
    runtime,
    urgentAlert,
    smartRecommendations,
    seasonal,
    favorites,
    recents,
    moneySummary,
  };
}




