import type { GameDataset } from '../../data/registry';
import {
  buildAnnualEconomicReportCard,
  calculateAbroadJobIncome,
  getAbroadLanguageLevel,
  getAbroadMonthlyBudget,
  getCountryCostDef,
  getCountryMacroDef,
  getCountryPathsDef,
  getExpectedAbroadMonthlyNetRange,
} from '../countries';
import { getFxRate } from '../fx';
import { toPersianDigits } from '../jalali';
import {
  creditWallet,
  getCurrencyExposureBreakdown,
  getWalletBalance,
  payInCurrencyOrConvert,
} from '../ledger';
import type { SeededRNG } from '../rng';
import { applyStatDelta } from '../stats';
import type {
  CountryApplicationStatus,
  CurrencyCode,
  EducationLevel,
  EmigrationState,
  GameState,
  MigrationPathSpec,
  MigrationPathType,
  PassportStatusStage,
} from '../types';

export const EMIGRATION_STEP_LABELS_FA = [
  'مدارک و ترجمه',
  'آزمون زبان',
  'ارزیابی مدرک',
  'پذیرش یا پیشنهاد کار',
  'صدور ویزا',
  'ورود و استقرار',
] as const;

export const INTEGRATION_CHECKLIST_ITEMS: {
  id: string;
  titleFa: string;
  subtitleFa: string;
  costLocalMinWageShare: number;
  mentalBoost: number;
}[] = [
  {
    id: 'sim_and_tax_id',
    titleFa: 'سیم‌کارت و شماره مالیاتی',
    subtitleFa: 'ثبت‌نام کد مالیاتی و دریافت شماره تلفن محلی برای قراردادها',
    costLocalMinWageShare: 0.03,
    mentalBoost: 2,
  },
  {
    id: 'bank_account',
    titleFa: 'افتتاح حساب بانکی محلی',
    subtitleFa: 'دریافت کارت بانکی برای دریافت حقوق و پرداخت قبوض',
    costLocalMinWageShare: 0.04,
    mentalBoost: 3,
  },
  {
    id: 'housing_contract',
    titleFa: 'ثبت قرارداد مسکن و آدرس',
    subtitleFa: 'تکمیل ثبت نشانی محل سکونت در شهرداری یا اداره ثبت',
    costLocalMinWageShare: 0.05,
    mentalBoost: 3,
  },
  {
    id: 'health_registration',
    titleFa: 'تکمیل بیمه درمان محلی',
    subtitleFa: 'فعال‌سازی دفترچه یا کارت خدمات درمانی کشور مقصد',
    costLocalMinWageShare: 0.04,
    mentalBoost: 2,
  },
];

export function ensureEmigrationState(state: GameState): EmigrationState {
  if (state.emigration) {
    return state.emigration;
  }
  const isAbroad = state.player.countryId !== 'iran';
  return {
    shortlistedCountryIds: [],
    activeApplications: {},
    languageLevels: {},
    residency: {
      isAbroad,
      countryId: state.player.countryId,
      yearsAbroad: isAbroad ? 1 : 0,
      statusStage: isAbroad ? 'temporary' : 'none',
      abroadWorkMonthsAccumulated: 0,
      checklistDoneIds: [],
      credentialRelicensedTracks: [],
      annualRemittanceCount: 0,
    },
    travelHistory: [],
  };
}

export function getLanguageLevelLabelFa(level: number): string {
  const clamped = Math.max(1, Math.min(6, Math.round(level)));
  const labels: Record<number, string> = {
    1: 'مبتدی ۱',
    2: 'مبتدی ۲',
    3: 'متوسط ۱',
    4: 'متوسط ۲',
    5: 'پیشرفته ۱',
    6: 'پیشرفته ۲',
  };
  return labels[clamped] ?? 'مبتدی ۱';
}

export function getPassportStatusLabelFa(stage: PassportStatusStage): string {
  const map: Record<PassportStatusStage, string> = {
    none: 'اقامت در ایران',
    temporary: 'اقامت موقت',
    renewable: 'اقامت تمدیدپذیر',
    permanent: 'اقامت دائم',
    citizenship: 'تابعیت کامل',
  };
  return map[stage] ?? 'اقامت موقت';
}

export function getCountryApplicationDisplayStatusFa(
  status: CountryApplicationStatus,
  isCurrentResidency: boolean,
): string {
  if (isCurrentResidency) return 'مقیم اینجا';
  const map: Record<CountryApplicationStatus, string> = {
    unexplored: 'بازدیدنشده',
    researching: 'در حال بررسی',
    in_progress: 'پرونده باز',
    approved: 'آماده سفر',
    rejected_retryable: 'نیاز به تلاش مجدد',
  };
  return map[status];
}

const EDU_ORDER: Record<EducationLevel, number> = {
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

export interface DifficultyFactorBar {
  id: string;
  labelFa: string;
  points: number; // positive adds difficulty, negative reduces difficulty; sum == totalDifficulty
  impact: 'helpful' | 'neutral' | 'barrier';
  detailFa: string;
  fixAction?: {
    tab: 'work' | 'assets' | 'activities' | 'emigration';
    subTarget: string;
    labelFa: string;
  };
}

export interface EmigrationDifficultyReport {
  countryId: string;
  pathId: MigrationPathType;
  totalDifficulty: number; // 0..100, exact sum of factors
  approvalChancePct: number; // 5..96
  factors: DifficultyFactorBar[];
  proofOfFundsRequiredLocal: number;
  proofOfFundsLiquidLocal: number;
  proofOfFundsDestWalletOnlyLocal: number;
  currencyCode: CurrencyCode;
  hasProofOfFunds: boolean;
  hasStrictDestCurrencyFunds: boolean;
  meetsAge: boolean;
  meetsEducation: boolean;
  meetsLanguage: boolean;
}

export function getTotalLiquidWalletEquivalentInCurrency(
  state: GameState,
  targetCurrency: CurrencyCode,
  dataset: GameDataset,
): number {
  if (!state.ledger) {
    return Number(
      (state.player.moneyToman * getFxRate(state, 'IRT', targetCurrency, dataset)).toFixed(2),
    );
  }
  let total = 0;
  for (const w of state.ledger.wallets) {
    if (w.balance <= 0) continue;
    total += w.balance * getFxRate(state, w.currencyCode, targetCurrency, dataset);
  }
  // Include USD-denominated financial assets as semi-liquid proof of funds
  for (const a of state.assets) {
    if (a.type === 'usd' || a.id === 'inv_deposit') {
      total += a.currentValueToman * getFxRate(state, 'IRT', targetCurrency, dataset);
    }
  }
  return Number(total.toFixed(2));
}

export function getPreferredPathForCountry(
  countryId: string,
  state: GameState,
  dataset: GameDataset,
  explicitPathId?: MigrationPathType,
): MigrationPathSpec {
  const pathsDef = getCountryPathsDef(countryId, dataset);
  const all = pathsDef?.pathways ?? [];
  if (explicitPathId) {
    const found = all.find((p) => p.id === explicitPathId);
    if (found) return found;
  }
  const active = state.emigration?.activeApplications?.[countryId];
  if (active) {
    const found = all.find((p) => p.id === active.selectedPathId);
    if (found) return found;
  }
  return all[0];
}

export function computeEmigrationDifficulty(params: {
  countryId: string;
  pathId?: MigrationPathType;
  state: GameState;
  dataset: GameDataset;
}): EmigrationDifficultyReport {
  const { countryId, pathId, state, dataset } = params;
  const countryDef = getCountryMacroDef(countryId, dataset) ?? dataset.countriesMacro[0];
  const pathSpec = getPreferredPathForCountry(countryDef.id, state, dataset, pathId);
  const currencyCode = countryDef.currencyCode;

  const basePoints = Math.round(countryDef.baseVisaDifficulty.value * 100);
  const age = state.player.age;
  let ageDelta = 0;
  let ageDetailFa = 'سن مناسب برای امتیاز مهاجرتی';
  if (age < pathSpec.minAge) {
    ageDelta = 24;
    ageDetailFa = `حداقل سن این مسیر ${toPersianDigits(pathSpec.minAge)} سال است`;
  } else if (age <= 34) {
    ageDelta = -8;
    ageDetailFa = 'بازه سنی طلایی (بیشترین امتیاز پذیرش)';
  } else if (age <= 44) {
    ageDelta = 3;
    ageDetailFa = 'سن میانسال با نیاز به سابقه کار قوی‌تر';
  } else {
    ageDelta = 14;
    ageDetailFa = 'کاهش امتیاز سنی در نظام‌های امتیازمحور';
  }

  const meetsEdu = EDU_ORDER[state.player.education.level] >= EDU_ORDER[pathSpec.minEducation];
  const eduGap = EDU_ORDER[pathSpec.minEducation] - EDU_ORDER[state.player.education.level];
  const eduDelta = meetsEdu
    ? Math.max(-10, -3 - Math.min(2, EDU_ORDER[state.player.education.level] - EDU_ORDER[pathSpec.minEducation]) * 3)
    : 12 + Math.max(0, eduGap) * 4;

  const langLevel = getAbroadLanguageLevel(state, countryDef.id, dataset);
  const meetsLanguage = langLevel >= pathSpec.requiredLanguageLevel;
  const langDelta = meetsLanguage
    ? -(langLevel - pathSpec.requiredLanguageLevel + 1) * 4
    : (pathSpec.requiredLanguageLevel - langLevel) * 7;

  const proofRequired = pathSpec.proofOfFundsLocal;
  const liquidEquivalent = getTotalLiquidWalletEquivalentInCurrency(state, currencyCode, dataset);
  const destWalletOnly = getWalletBalance(state, currencyCode);
  const fundsRatio = liquidEquivalent / Math.max(1, proofRequired);
  const hasProofOfFunds = liquidEquivalent + 0.01 >= proofRequired;
  const hasStrictDestCurrencyFunds = destWalletOnly + 0.01 >= proofRequired;
  let fundsDelta = 0;
  if (hasProofOfFunds) {
    fundsDelta = fundsRatio >= 1.8 ? -10 : -5;
  } else if (fundsRatio >= 0.65) {
    fundsDelta = 9;
  } else {
    fundsDelta = 18;
  }

  const skillCount = Object.values(JSON.parse(String(state.flags['skills_json'] || '{}')) as Record<string, number>).reduce(
    (s, v) => s + (v > 0 ? 1 : 0),
    0,
  );
  const licenseCount = state.player.licenses?.length ?? 0;
  const workYears = state.player.job?.yearsInJob ?? 0;
  const skillDelta = Math.max(
    -12,
    Math.min(10, 4 - skillCount * 2 - licenseCount * 3 - Math.min(4, Math.floor(workYears / 2))),
  );

  const recordDelta = state.player.criminalRecord > 0 ? 22 : -2;

  const rawFactors: DifficultyFactorBar[] = [
    {
      id: 'country_baseline',
      labelFa: 'سخت‌گیری پایه ویزا و سهمیه',
      points: basePoints,
      impact: basePoints >= 45 ? 'barrier' : 'neutral',
      detailFa: countryDef.baseVisaDifficulty.source,
    },
    {
      id: 'age',
      labelFa: 'شرایط سنی',
      points: ageDelta,
      impact: ageDelta < 0 ? 'helpful' : ageDelta > 5 ? 'barrier' : 'neutral',
      detailFa: ageDetailFa,
    },
    {
      id: 'education',
      labelFa: 'مدرک تحصیلی',
      points: eduDelta,
      impact: meetsEdu ? 'helpful' : 'barrier',
      detailFa: meetsEdu ? 'حداقل مدرک تحصیلی تأمین است' : 'نیاز به ادامه تحصیل و ارتقای مدرک',
      fixAction: meetsEdu
        ? undefined
        : { tab: 'work', subTarget: 'education', labelFa: 'ادامه تحصیل در کار و تحصیل' },
    },
    {
      id: 'language',
      labelFa: `سطح زبان (${getLanguageLevelLabelFa(langLevel)})`,
      points: langDelta,
      impact: meetsLanguage ? 'helpful' : 'barrier',
      detailFa: meetsLanguage
        ? `شرط زبان (${getLanguageLevelLabelFa(pathSpec.requiredLanguageLevel)}) تأمین شده است`
        : `نیازمند رساندن زبان به «${getLanguageLevelLabelFa(pathSpec.requiredLanguageLevel)}»`,
      fixAction: meetsLanguage
        ? undefined
        : { tab: 'emigration', subTarget: 'language', labelFa: 'تقویت زبان مقصد' },
    },
    {
      id: 'proof_of_funds',
      labelFa: 'تمکن مالی ارزی',
      points: fundsDelta,
      impact: hasProofOfFunds ? 'helpful' : 'barrier',
      detailFa: hasProofOfFunds
        ? hasStrictDestCurrencyFunds
          ? 'موجودی ارزی در حساب ارز مقصد آماده است'
          : 'معادل سرمایه کافی است؛ تبدیل به ارز مقصد توصیه می‌شود'
        : 'موجودی نقد و ارزی کمتر از حد نصاب تمکن مالی است',
      fixAction: hasProofOfFunds && hasStrictDestCurrencyFunds
        ? undefined
        : { tab: 'assets', subTarget: 'fx_converter', labelFa: 'تبدیل ارز در کیف پول' },
    },
    {
      id: 'skills_career',
      labelFa: 'مهارت، مجوز و سابقه کار',
      points: skillDelta,
      impact: skillDelta < 0 ? 'helpful' : 'barrier',
      detailFa: 'مهارت‌ها و مجوزهای حرفه‌ای ریسک رد شدن را کم می‌کنند',
      fixAction:
        skillDelta >= 0
          ? { tab: 'work', subTarget: 'skills', labelFa: 'ارتقای مهارت و مجوز' }
          : undefined,
    },
    {
      id: 'record',
      labelFa: 'سابقه کیفری و مدارک',
      points: recordDelta,
      impact: state.player.criminalRecord > 0 ? 'barrier' : 'helpful',
      detailFa:
        state.player.criminalRecord > 0
          ? 'وجود سوءپیشینه دشواری پرونده را بالا می‌برد'
          : 'پرونده بدون سوءپیشینه است',
    },
  ];

  const rawSum = rawFactors.reduce((s, f) => s + f.points, 0);
  const totalDifficulty = Math.max(5, Math.min(95, rawSum));
  if (rawSum !== totalDifficulty) {
    // Adjust baseline slice so factor sum strictly equals totalDifficulty
    rawFactors[0] = {
      ...rawFactors[0],
      points: rawFactors[0].points + (totalDifficulty - rawSum),
    };
  }

  const meetsAge = age >= pathSpec.minAge;
  const rawApproval = Math.round(
    pathSpec.baseSuccessRate * 100 - (totalDifficulty - 42) * 0.55 + (state.player.stats.intelligence - 50) * 0.15,
  );
  const approvalChancePct =
    !meetsAge || !meetsEdu
      ? 10
      : Math.max(8, Math.min(96, rawApproval));

  return {
    countryId: countryDef.id,
    pathId: pathSpec.id,
    totalDifficulty,
    approvalChancePct,
    factors: rawFactors,
    proofOfFundsRequiredLocal: proofRequired,
    proofOfFundsLiquidLocal: liquidEquivalent,
    proofOfFundsDestWalletOnlyLocal: destWalletOnly,
    currencyCode,
    hasProofOfFunds,
    hasStrictDestCurrencyFunds,
    meetsAge,
    meetsEducation: meetsEdu,
    meetsLanguage,
  };
}

export interface RankedCountrySuggestion {
  countryId: string;
  nameFa: string;
  currencyCode: CurrencyCode;
  score: number;
  monthlyNetMedianLocal: number;
  monthlyBudgetLocal: number;
  monthlySurplusLocal: number;
  monthlySurplusToman: number;
  difficulty: EmigrationDifficultyReport;
  bestPath: MigrationPathSpec;
  highlightFa: string;
}

export function rankCountriesForPlayer(
  state: GameState,
  dataset: GameDataset,
  includeTemplate = false,
): RankedCountrySuggestion[] {
  const weights = state.jobCompass?.priorities ?? {
    income: 2,
    calm: 2,
    security: 2,
    growth: 2,
    freedom: 2,
  };

  const candidates = dataset.countriesMacro.filter((c) => includeTemplate || !c.isTemplate);
  const list: RankedCountrySuggestion[] = candidates.map((c) => {
    const pathsDef = getCountryPathsDef(c.id, dataset);
    const pathways = pathsDef?.pathways ?? [];
    let bestDiff = computeEmigrationDifficulty({
      countryId: c.id,
      pathId: pathways[0]?.id,
      state,
      dataset,
    });
    let bestPath = pathways[0];
    for (const p of pathways.slice(1)) {
      const diff = computeEmigrationDifficulty({
        countryId: c.id,
        pathId: p.id,
        state,
        dataset,
      });
      if (diff.totalDifficulty < bestDiff.totalDifficulty) {
        bestDiff = diff;
        bestPath = p;
      }
    }

    const incomeRange = getExpectedAbroadMonthlyNetRange({
      countryId: c.id,
      state,
      dataset,
    });
    const budget = getAbroadMonthlyBudget(state, dataset, c.id);
    const monthlySurplusLocal = incomeRange.monthlyNetMedian - budget.totalMonthlyLocal;
    const fxToIrt = getFxRate(state, c.currencyCode, 'IRT', dataset);
    const monthlySurplusToman = Math.round(monthlySurplusLocal * fxToIrt);
    const surplusRatio = monthlySurplusLocal / Math.max(1, budget.totalMonthlyLocal);

    const stabilityScore = Math.max(0, 100 - Math.round(c.macro.inflationRate.value * 160));
    const safetyNetScore = Math.round(c.taxAndBenefits.unemploymentBenefitRatio * 100);
    const openness = c.opennessScore.value;
    const easeScore = 100 - bestDiff.totalDifficulty;

    const totalWeight = Math.max(
      1,
      weights.income + weights.calm + weights.security + weights.growth + weights.freedom,
    );
    const weighted =
      (weights.income * Math.max(10, Math.min(100, 50 + surplusRatio * 45)) +
        weights.calm * stabilityScore +
        weights.security * safetyNetScore +
        weights.growth * (incomeRange.needsRelicensing ? 55 : 82) +
        weights.freedom * ((openness + easeScore) / 2)) /
      totalWeight;

    const score = Math.max(15, Math.min(98, Math.round(weighted)));
    const highlightFa =
      monthlySurplusLocal > 0 && bestDiff.hasProofOfFunds
        ? 'تراز درآمد و هزینه مثبت و تمکن آماده'
        : bestDiff.totalDifficulty <= 45
          ? 'مسیر ورود با دشواری کمتر'
          : stabilityScore >= 80
            ? 'ثبات بالای ارز و قیمت‌ها'
            : 'بازار پویا اما نیازمند برنامه‌ریزی';

    return {
      countryId: c.id,
      nameFa: c.nameFa,
      currencyCode: c.currencyCode,
      score,
      monthlyNetMedianLocal: incomeRange.monthlyNetMedian,
      monthlyBudgetLocal: budget.totalMonthlyLocal,
      monthlySurplusLocal,
      monthlySurplusToman,
      difficulty: bestDiff,
      bestPath,
      highlightFa,
    };
  });

  return list.sort((a, b) => b.score - a.score);
}

export interface CountryComparisonColumn {
  countryId: string;
  nameFa: string;
  currencyCode: CurrencyCode;
  radarScores: {
    netIncome: number;
    affordability: number;
    easeOfEntry: number;
    macroStability: number;
    credentialFit: number;
  };
  monthlyNetMedianLocal: number;
  monthlyBudgetLocal: number;
  monthlyNetMedianToman: number;
  monthlyBudgetToman: number;
  totalDifficulty: number;
  inflationPct: number;
  permanentYears: number;
  needsRelicensing: boolean;
}

export function compareCountries(
  countryIds: string[],
  state: GameState,
  dataset: GameDataset,
): CountryComparisonColumn[] {
  const uniqueIds = Array.from(new Set(countryIds)).slice(0, 3);
  return uniqueIds
    .map((id) => {
      const def = getCountryMacroDef(id, dataset);
      const paths = getCountryPathsDef(id, dataset);
      if (!def || !paths) return null;
      const incomeRange = getExpectedAbroadMonthlyNetRange({ countryId: id, state, dataset });
      const budget = getAbroadMonthlyBudget(state, dataset, id);
      const diff = computeEmigrationDifficulty({ countryId: id, state, dataset });
      const fxToIrt = getFxRate(state, def.currencyCode, 'IRT', dataset);
      const netToman = Math.round(incomeRange.monthlyNetMedian * fxToIrt);
      const budgetToman = Math.round(budget.totalMonthlyLocal * fxToIrt);
      const surplusRatio = incomeRange.monthlyNetMedian / Math.max(1, budget.totalMonthlyLocal);

      return {
        countryId: id,
        nameFa: def.nameFa,
        currencyCode: def.currencyCode,
        radarScores: {
          netIncome: Math.max(15, Math.min(98, Math.round(surplusRatio * 48))),
          affordability: Math.max(18, Math.min(95, Math.round(105 - budget.ratioToMinWage * 28))),
          easeOfEntry: Math.max(12, Math.min(95, 100 - diff.totalDifficulty)),
          macroStability: Math.max(12, Math.min(98, Math.round(100 - def.macro.inflationRate.value * 210))),
          credentialFit: incomeRange.needsRelicensing ? 44 : 88,
        },
        monthlyNetMedianLocal: incomeRange.monthlyNetMedian,
        monthlyBudgetLocal: budget.totalMonthlyLocal,
        monthlyNetMedianToman: netToman,
        monthlyBudgetToman: budgetToman,
        totalDifficulty: diff.totalDifficulty,
        inflationPct: Number((def.macro.inflationRate.value * 100).toFixed(1)),
        permanentYears: paths.statusLadder.permanentAfterYears,
        needsRelicensing: incomeRange.needsRelicensing,
      };
    })
    .filter((x): x is CountryComparisonColumn => x !== null);
}

export interface ShortTripQuote {
  countryId: string;
  countryNameFa: string;
  currencyCode: CurrencyCode;
  tier: 'budget' | 'standard' | 'comfort';
  tierLabelFa: string;
  durationDays: number;
  visaType: 'visa_free' | 'e_visa' | 'embassy_visa';
  visaLabelFa: string;
  visaApprovalPct: number;
  flightLocal: number;
  visaFeeLocal: number;
  stayLocal: number;
  totalLocal: number;
  totalToman: number;
  totalUsd: number;
  happinessBoost: number;
  mentalBoost: number;
  highlightsFa: string[];
}

export function getShortTripQuote(
  countryId: string,
  tier: 'budget' | 'standard' | 'comfort',
  state: GameState,
  dataset: GameDataset,
): ShortTripQuote | null {
  const def = getCountryMacroDef(countryId, dataset);
  const cost = getCountryCostDef(countryId, dataset);
  if (!def || !cost) return null;

  const trip = cost.shortTrip;
  const tierSpec = trip.tiers[tier];
  const cpiScale = state.countryMacros?.[countryId]?.cpiIndex ?? 1;

  const usdToLocal = getFxRate(state, 'USD', def.currencyCode, dataset);
  const flightLocal = Math.round(trip.flightRoundTripUsd * usdToLocal);
  const visaFeeLocal = Math.round(trip.visaFeeUsd * usdToLocal);
  const stayLocal = Math.round(tierSpec.dailyCostLocal * trip.durationDays * cpiScale);
  const totalLocal = flightLocal + visaFeeLocal + stayLocal;

  const totalToman = Math.round(totalLocal * getFxRate(state, def.currencyCode, 'IRT', dataset));
  const totalUsd = Number((totalLocal * getFxRate(state, def.currencyCode, 'USD', dataset)).toFixed(0));

  const exposure = getCurrencyExposureBreakdown(state, dataset);
  const netWorthToman = exposure.reduce((s, e) => s + e.tomanEquivalent, 0);
  const fundsComfortBonus = netWorthToman > totalToman * 4 ? 0.1 : 0;
  const criminalPenalty = state.player.criminalRecord > 0 ? 0.25 : 0;
  const visaApprovalPct =
    trip.visaType === 'visa_free'
      ? 99
      : Math.max(15, Math.min(96, Math.round((trip.visaApprovalBase + fundsComfortBonus - criminalPenalty) * 100)));

  return {
    countryId: def.id,
    countryNameFa: def.nameFa,
    currencyCode: def.currencyCode,
    tier,
    tierLabelFa: tierSpec.labelFa,
    durationDays: trip.durationDays,
    visaType: trip.visaType,
    visaLabelFa: trip.visaLabelFa,
    visaApprovalPct,
    flightLocal,
    visaFeeLocal,
    stayLocal,
    totalLocal,
    totalToman,
    totalUsd,
    happinessBoost: tierSpec.happinessBoost,
    mentalBoost: tierSpec.mentalBoost,
    highlightsFa: trip.highlightsFa,
  };
}

export function getStudyLanguageCost(
  countryId: string,
  state: GameState,
  dataset: GameDataset,
): { currencyCode: CurrencyCode; costLocal: number; costToman: number } {
  const def = getCountryMacroDef(countryId, dataset) ?? dataset.countriesMacro[0];
  const runtime = state.countryMacros?.[def.id];
  const minWage = runtime?.minWageMonthlyLocal ?? def.macro.minWageMonthlyLocal.value;
  const costLocal = Math.max(1, Math.round(minWage * 0.12));
  const costToman = Math.round(costLocal * getFxRate(state, def.currencyCode, 'IRT', dataset));
  return { currencyCode: def.currencyCode, costLocal, costToman };
}

export function getEmigrationStepFeeLocal(
  countryId: string,
  pathSpec: MigrationPathSpec,
  stepIndexZeroBased: number,
  state: GameState,
  dataset: GameDataset,
): { currencyCode: CurrencyCode; feeLocal: number; feeToman: number } {
  const def = getCountryMacroDef(countryId, dataset) ?? dataset.countriesMacro[0];
  const weights = [0.12, 0.16, 0.2, 0.22, 0.3, 0];
  const w = weights[stepIndexZeroBased] ?? 0.2;
  const cpiScale = state.countryMacros?.[def.id]?.cpiIndex ?? 1;
  const feeLocal = Math.round(pathSpec.applicationFeeLocal * w * cpiScale);
  const feeToman = Math.round(feeLocal * getFxRate(state, def.currencyCode, 'IRT', dataset));
  return { currencyCode: def.currencyCode, feeLocal, feeToman };
}

export function triggerReturnToIran(params: {
  state: GameState;
  reasonFa: string;
  forced: boolean;
  dataset: GameDataset;
}): void {
  const { state, reasonFa, forced } = params;
  const emig = ensureEmigrationState(state);
  const prevCountryId = state.player.countryId;
  const prevCountryDef = getCountryMacroDef(prevCountryId, params.dataset);

  // If player rented abroad, drop rental state on return
  state.player.countryId = 'iran';
  state.player.currentCityId = 'tehran';
  state.player.job = null;
  state.player.housing = {
    type: 'rent',
    cityId: 'tehran',
    monthlyRentToman: 0,
    depositRahnToman: 0,
    propertyValueToman: 0,
  };

  emig.residency = {
    ...emig.residency,
    isAbroad: false,
    countryId: 'iran',
    regionId: undefined,
    statusStage: 'none',
    permitType: undefined,
    jobLossGraceMonthsRemaining: undefined,
    forcedReturnNoticeFa: forced ? reasonFa : undefined,
  };
  state.emigration = emig;

  state.player.stats = applyStatDelta(state.player.stats, {
    happiness: forced ? -10 : 4,
    mentalHealth: forced ? -8 : 3,
  });

  state.timeline.push({
    id: `turn_${state.turn}_return_${state.timeline.length}`,
    age: state.player.age,
    jalaliYear: state.currentJalaliYear,
    title: forced
      ? `پایان مهلت اقامت در ${prevCountryDef?.nameFa ?? 'مقصد'} و بازگشت`
      : `بازگشت داوطلبانه از ${prevCountryDef?.nameFa ?? 'مقصد'} به ایران`,
    text: reasonFa,
    type: 'milestone',
    statChanges: forced ? { happiness: -10, mentalHealth: -8 } : { happiness: 4 },
  });
}

export function stepAbroadYearEconomyAndResidency(params: {
  state: GameState;
  nextYear: number;
  rng: SeededRNG;
  dataset: GameDataset;
}): {
  handledAbroad: boolean;
  netIncomeLocal: number;
  livingCostsLocal: number;
  taxesPaidLocal: number;
} {
  const { state, nextYear, rng, dataset } = params;
  if (state.player.countryId === 'iran') {
    return { handledAbroad: false, netIncomeLocal: 0, livingCostsLocal: 0, taxesPaidLocal: 0 };
  }

  const emig = ensureEmigrationState(state);
  state.emigration = emig;
  const countryDef = getCountryMacroDef(state.player.countryId, dataset);
  const pathsDef = getCountryPathsDef(state.player.countryId, dataset);
  if (!countryDef || !pathsDef) {
    return { handledAbroad: false, netIncomeLocal: 0, livingCostsLocal: 0, taxesPaidLocal: 0 };
  }

  const localCurrency = countryDef.currencyCode;
  emig.residency.isAbroad = true;
  emig.residency.countryId = countryDef.id;
  emig.residency.yearsAbroad = (emig.residency.yearsAbroad || 0) + 1;

  // Step 1: Calculate abroad net income (job or unemployment insurance) & pay into local wallet
  let netIncomeLocal = 0;
  let taxesPaidLocal = 0;

  if (state.player.job) {
    const jobDef = dataset.jobs.find((j) => j.id === state.player.job!.jobId);
    let breakdown;
    if (jobDef) {
      breakdown = calculateAbroadJobIncome({
        job: jobDef,
        level: state.player.job.level,
        state,
        dataset,
        rng,
      });
    } else {
      // Fallback for special careers abroad
      const runtime = state.countryMacros?.[countryDef.id];
      const minW = runtime?.minWageMonthlyLocal ?? countryDef.macro.minWageMonthlyLocal.value;
      const gross = Math.round(minW * 12 * 1.8);
      netIncomeLocal = Math.round(gross * 0.78);
      taxesPaidLocal = gross - netIncomeLocal;
    }

    if (breakdown) {
      netIncomeLocal = breakdown.netAnnualLocal;
      taxesPaidLocal =
        breakdown.socialSecurityLocal +
        breakdown.incomeTaxLocal +
        breakdown.healthInsuranceAnnualLocal;
      state.player.job.annualSalaryToman = breakdown.netAnnualToman;
    }
    state.player.job.yearsInJob += 1;
    emig.residency.abroadWorkMonthsAccumulated += 12;
    emig.residency.jobLossGraceMonthsRemaining = undefined;

    creditWallet({
      state,
      currencyCode: localCurrency,
      amount: netIncomeLocal,
      dataset,
      accountType: 'foreign',
      countryId: countryDef.id,
    });
  } else {
    // Unemployed abroad: check unemployment insurance or employer-tied permit grace countdown
    const eligibleForUnemployment =
      emig.residency.abroadWorkMonthsAccumulated >=
        countryDef.taxAndBenefits.unemploymentEligibleMonthsWorked &&
      (emig.residency.statusStage === 'renewable' ||
        emig.residency.statusStage === 'permanent' ||
        emig.residency.statusStage === 'citizenship' ||
        !countryDef.visaRules.employerTiedWorkPermit);

    if (eligibleForUnemployment) {
      const runtime = state.countryMacros?.[countryDef.id];
      const minW = runtime?.minWageMonthlyLocal ?? countryDef.macro.minWageMonthlyLocal.value;
      const benefitAnnual = Math.round(
        minW * 12 * countryDef.taxAndBenefits.unemploymentBenefitRatio,
      );
      netIncomeLocal = benefitAnnual;
      creditWallet({
        state,
        currencyCode: localCurrency,
        amount: benefitAnnual,
        dataset,
        accountType: 'foreign',
        countryId: countryDef.id,
      });
    }

    // Check employer-tied visa grace period if permit is work/skilled and not permanent
    const isEmployerTied =
      countryDef.visaRules.employerTiedWorkPermit &&
      (emig.residency.permitType === 'work' || emig.residency.permitType === 'skilled') &&
      emig.residency.statusStage !== 'permanent' &&
      emig.residency.statusStage !== 'citizenship';

    if (isEmployerTied) {
      if (emig.residency.jobLossGraceMonthsRemaining === undefined) {
        emig.residency.jobLossGraceMonthsRemaining = countryDef.visaRules.jobLossGraceMonths;
        state.timeline.push({
          id: `turn_${state.turn}_grace_warn_${state.timeline.length}`,
          age: state.player.age,
          jalaliYear: nextYear,
          title: `مهلت قانونی ویزای کار در ${countryDef.nameFa}`,
          text: `به دلیل بیکاری، بر اساس مقررات ویزای وابسته به کارفرما حدود ${toPersianDigits(countryDef.visaRules.jobLossGraceMonths)} ماه فرصت داری قرارداد کاری تازه ببندی.`,
          type: 'event',
        });
      } else {
        const nextGrace = Math.max(0, emig.residency.jobLossGraceMonthsRemaining - 12);
        emig.residency.jobLossGraceMonthsRemaining = nextGrace;
        if (nextGrace <= 0) {
          // Charge half-year living expenses before return, then execute clean return
          const partialCost = Math.round(getAbroadMonthlyBudget(state, dataset).totalAnnualLocal * 0.35);
          payInCurrencyOrConvert({
            state,
            currencyCode: localCurrency,
            amount: partialCost,
            dataset,
          });
          triggerReturnToIran({
            state,
            reasonFa: `مهلت قانونی ${toPersianDigits(countryDef.visaRules.jobLossGraceMonths)} ماهه برای یافتن کارفرمای جدید در ${countryDef.nameFa} به پایان رسید و بازگشت به مبدأ ثبت شد.`,
            forced: true,
            dataset,
          });
          return {
            handledAbroad: true,
            netIncomeLocal,
            livingCostsLocal: partialCost,
            taxesPaidLocal,
          };
        }
      }
    }
  }

  // Step 2: Charge annual living expenses in destination currency
  const budget = getAbroadMonthlyBudget(state, dataset);
  const livingCostsLocal = budget.totalAnnualLocal;
  const paid = payInCurrencyOrConvert({
    state,
    currencyCode: localCurrency,
    amount: livingCostsLocal,
    dataset,
  });
  if (!paid.ok) {
    // Remaining unpaid deficit becomes Toman-mirrored debt
    const avail = getWalletBalance(state, localCurrency);
    if (avail > 0) {
      payInCurrencyOrConvert({ state, currencyCode: localCurrency, amount: avail, dataset });
    }
    const shortfallLocal = Math.max(0, livingCostsLocal - avail);
    const shortfallToman = Math.round(
      shortfallLocal * getFxRate(state, localCurrency, 'IRT', dataset),
    );
    state.player.debtToman = Math.round(state.player.debtToman + shortfallToman);
    state.player.stats = applyStatDelta(state.player.stats, { mentalHealth: -4, happiness: -3 });
  }

  // Step 3: Status Ladder Progression (temporary -> renewable -> permanent -> citizenship)
  const langLevel = getAbroadLanguageLevel(state, countryDef.id, dataset);
  const years = emig.residency.yearsAbroad;
  const ladder = pathsDef.statusLadder;
  if (
    emig.residency.statusStage === 'temporary' &&
    years >= ladder.renewableAfterYears
  ) {
    emig.residency.statusStage = 'renewable';
    state.timeline.push({
      id: `turn_${state.turn}_status_renewable`,
      age: state.player.age,
      jalaliYear: nextYear,
      title: 'تمدید اقامت و تثبیت وضعیت',
      text: `اقامت موقت تو در ${countryDef.nameFa} به اقامت تمدیدپذیر ارتقا یافت.`,
      type: 'milestone',
    });
  } else if (
    emig.residency.statusStage === 'renewable' &&
    years >= ladder.permanentAfterYears &&
    langLevel >= ladder.minLanguageForPermanent
  ) {
    emig.residency.statusStage = 'permanent';
    emig.residency.jobLossGraceMonthsRemaining = undefined;
    state.player.stats = applyStatDelta(state.player.stats, { happiness: 8, mentalHealth: 6 });
    state.timeline.push({
      id: `turn_${state.turn}_status_pr`,
      age: state.player.age,
      jalaliYear: nextYear,
      title: `دریافت اقامت دائم ${countryDef.nameFa}`,
      text: `پس از ${toPersianDigits(years)} سال حضور و تسلط کافی بر زبان، کارت اقامت دائم صادر شد.`,
      type: 'milestone',
      statChanges: { happiness: 8, mentalHealth: 6 },
    });
  } else if (
    emig.residency.statusStage === 'permanent' &&
    years >= ladder.citizenshipAfterYears &&
    langLevel >= ladder.minLanguageForCitizenship
  ) {
    emig.residency.statusStage = 'citizenship';
    state.player.stats = applyStatDelta(state.player.stats, { happiness: 10, fame: 3 });
    state.timeline.push({
      id: `turn_${state.turn}_status_citizen`,
      age: state.player.age,
      jalaliYear: nextYear,
      title: `اخذ تابعیت ${countryDef.nameFa}`,
      text: `شرایط قانونی تابعیت در ${countryDef.nameFa} تکمیل شد و گذرنامه دوم دریافت کردی.`,
      type: 'milestone',
      statChanges: { happiness: 10 },
    });
  }

  // Step 4: Abroad contextual event (~30% annual chance)
  if (countryDef.events.length > 0 && rng.chance(0.28)) {
    const picked = rng.pick(countryDef.events);
    if (picked.costLocal !== 0) {
      if (picked.costLocal > 0) {
        payInCurrencyOrConvert({
          state,
          currencyCode: localCurrency,
          amount: picked.costLocal,
          dataset,
        });
      } else {
        creditWallet({
          state,
          currencyCode: localCurrency,
          amount: Math.abs(picked.costLocal),
          dataset,
          accountType: 'foreign',
          countryId: countryDef.id,
        });
      }
    }
    state.player.stats = applyStatDelta(state.player.stats, picked.statsDelta);
    state.timeline.push({
      id: `turn_${state.turn}_abroad_evt_${picked.id}`,
      age: state.player.age,
      jalaliYear: nextYear,
      title: picked.titleFa,
      text: picked.textFa,
      type: 'event',
      statChanges: picked.statsDelta,
    });
  }

  const savingsDeltaLocal = netIncomeLocal - livingCostsLocal;
  emig.lastReportCard = buildAnnualEconomicReportCard({
    year: nextYear,
    currencyCode: localCurrency,
    netIncomeLocal,
    livingCostsLocal,
    taxesPaidLocal,
    remittanceLocal: emig.residency.annualRemittanceCount,
    savingsDeltaLocal,
  });
  emig.residency.annualRemittanceCount = 0;

  return {
    handledAbroad: true,
    netIncomeLocal,
    livingCostsLocal,
    taxesPaidLocal,
  };
}
