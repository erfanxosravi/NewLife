import type { GameDataset } from '../../data/registry';
import { getFxRate } from '../fx';
import type { SeededRNG } from '../rng';
import type {
  CountryCostDefinition,
  CountryMacroDefinition,
  CountryPathsDefinition,
  CountryRegionDef,
  CountryRuntimeMacroState,
  CurrencyCode,
  EmigrationState,
  GameState,
  JobDefinition,
  JobIncomeEntry,
} from '../types';

export type CredentialCategory =
  | 'medicine'
  | 'law'
  | 'pharmacy'
  | 'education'
  | 'engineering'
  | 'general';

export interface AbroadIncomeBreakdown {
  currencyCode: CurrencyCode;
  grossAnnualLocal: number;
  socialSecurityLocal: number;
  incomeTaxLocal: number;
  healthInsuranceAnnualLocal: number;
  netAnnualLocal: number;
  grossAnnualToman: number;
  netAnnualToman: number;
  monthlyMultiplierOfMinWage: number;
  minWageMonthlyLocal: number;
  credentialCategory: CredentialCategory;
  credentialFactor: number;
  languageFactor: number;
  convergenceFactor: number;
  needsRelicensing: boolean;
}

export interface AbroadMonthlyBudget {
  currencyCode: CurrencyCode;
  rentLocal: number;
  foodLocal: number;
  utilitiesTransportLocal: number;
  healthcareMiscLocal: number;
  totalMonthlyLocal: number;
  totalAnnualLocal: number;
  totalMonthlyToman: number;
  totalAnnualToman: number;
  ratioToMinWage: number;
}

export interface AbroadHousingOption {
  id: string;
  mode: 'rent' | 'buy';
  titleFa: string;
  areaSqm: number;
  currencyCode: CurrencyCode;
  depositLocal: number;
  monthlyRentLocal: number;
  buyPriceLocal: number;
  downPaymentLocal: number;
  annualMortgageLocal: number;
  mortgageYears: number;
}

export function getCountryMacroDef(
  countryId: string,
  dataset: GameDataset,
): CountryMacroDefinition | undefined {
  return dataset.countriesMacro.find((c) => c.id === countryId);
}

export function getCountryCostDef(
  countryId: string,
  dataset: GameDataset,
): CountryCostDefinition | undefined {
  return dataset.countryCosts.find((c) => c.countryId === countryId);
}

export function getCountryPathsDef(
  countryId: string,
  dataset: GameDataset,
): CountryPathsDefinition | undefined {
  return dataset.countryPaths.find((c) => c.countryId === countryId);
}

export function getActiveRegionDef(
  countryId: string,
  regionId: string | undefined,
  dataset: GameDataset,
): CountryRegionDef | undefined {
  const def = getCountryMacroDef(countryId, dataset);
  if (!def || def.regions.length === 0) return undefined;
  return def.regions.find((r) => r.id === regionId) ?? def.regions[0];
}

export function ensureCountryMacros(
  state: GameState,
  dataset: GameDataset,
): Record<string, CountryRuntimeMacroState> {
  const existing = state.countryMacros ? { ...state.countryMacros } : {};
  for (const c of dataset.countriesMacro) {
    if (!existing[c.id]) {
      existing[c.id] = {
        countryId: c.id,
        cpiIndex: 1,
        lastInflationRate: c.macro.inflationRate.value,
        minWageMonthlyLocal: c.macro.minWageMonthlyLocal.value,
        housingIndex: 1,
        rentIndex: 1,
        unemploymentRate: c.macro.unemploymentRate.value,
        history: [
          {
            year: state.currentJalaliYear,
            inflationRate: c.macro.inflationRate.value,
            minWageMonthlyLocal: c.macro.minWageMonthlyLocal.value,
            housingIndex: 1,
          },
        ],
      };
    }
  }
  return existing;
}

export function stepCountriesMacroYear(params: {
  state: GameState;
  nextYear: number;
  fxRng: SeededRNG;
  oilShockRatio: number;
  globalGrowthShockRatio: number;
  dataset: GameDataset;
}): Record<string, CountryRuntimeMacroState> {
  const { state, nextYear, fxRng, oilShockRatio, globalGrowthShockRatio, dataset } = params;
  const macros = ensureCountryMacros(state, dataset);
  const nextMacros: Record<string, CountryRuntimeMacroState> = {};

  for (const c of dataset.countriesMacro) {
    const prev = macros[c.id];
    const baseInf = c.macro.inflationRate.value;
    const prevInf = prev.lastInflationRate;
    const infNoise = fxRng.float(-0.008, 0.01);
    const oilTerm = c.macro.oilShockBeta.value * oilShockRatio;
    const growthTerm = -c.macro.globalGrowthBeta.value * globalGrowthShockRatio * 0.2;

    // High-inflation destinations revert slowly; stable currencies stay near ~2-3%
    const revertedInf =
      prevInf * 0.68 +
      (c.id === 'turkey' ? Math.max(0.14, baseInf * 0.88) : baseInf) * 0.32 +
      infNoise +
      oilTerm +
      growthTerm;
    const nextInf = Number(
      Math.max(0.004, Math.min(c.id === 'turkey' ? 0.65 : 0.14, revertedInf)).toFixed(4),
    );

    const nextCpi = Number((prev.cpiIndex * (1 + nextInf)).toFixed(4));

    let nextMinWage = prev.minWageMonthlyLocal;
    if (
      c.id === 'germany' &&
      nextYear === 1406 &&
      c.macro.minWageHourlyNextYearLocal &&
      c.macro.minWageHourlyLocal.value > 0
    ) {
      // Exact verified Jan 2027 statutory bump (13.90 -> 14.60 EUR/hr)
      const ratio = c.macro.minWageHourlyNextYearLocal.value / c.macro.minWageHourlyLocal.value;
      nextMinWage = Number((prev.minWageMonthlyLocal * ratio).toFixed(2));
    } else {
      const wageGrowth = Math.max(
        0.01,
        c.macro.wageGrowthRate.value * 0.5 + nextInf * (c.id === 'turkey' ? 0.88 : 0.72),
      );
      nextMinWage = Number((prev.minWageMonthlyLocal * (1 + wageGrowth)).toFixed(2));
    }

    const housingDrift = nextInf * 0.92 + fxRng.float(-0.02, 0.03);
    const rentDrift = nextInf * 0.95 + fxRng.float(-0.015, 0.025);
    const nextHousingIdx = Number(Math.max(0.5, prev.housingIndex * (1 + housingDrift)).toFixed(4));
    const nextRentIdx = Number(Math.max(0.5, prev.rentIndex * (1 + rentDrift)).toFixed(4));
    const nextUnemp = Number(
      Math.max(
        0.018,
        Math.min(
          0.18,
          prev.unemploymentRate * 0.6 +
            c.macro.unemploymentRate.value * 0.4 -
            globalGrowthShockRatio * c.macro.globalGrowthBeta.value * 0.4 +
            fxRng.float(-0.004, 0.004),
        ),
      ).toFixed(4),
    );

    const nextHistory = [
      ...prev.history.slice(-19),
      {
        year: nextYear,
        inflationRate: nextInf,
        minWageMonthlyLocal: nextMinWage,
        housingIndex: nextHousingIdx,
      },
    ];

    nextMacros[c.id] = {
      countryId: c.id,
      cpiIndex: nextCpi,
      lastInflationRate: nextInf,
      minWageMonthlyLocal: nextMinWage,
      housingIndex: nextHousingIdx,
      rentIndex: nextRentIdx,
      unemploymentRate: nextUnemp,
      history: nextHistory,
    };
  }

  return nextMacros;
}

export function getCredentialTrackForJob(
  job: Pick<JobDefinition, 'id' | 'track'>,
  majorFa?: string,
): CredentialCategory {
  if (job.id.includes('pharmac')) return 'pharmacy';
  if (job.track === 'medical' || job.id.includes('doctor') || job.id.includes('dentist')) {
    return 'medicine';
  }
  if (job.id.includes('lawyer') || job.id.includes('legal') || job.track === 'legal') {
    return 'law';
  }
  if (job.track === 'education' || job.id.includes('teacher') || job.id.includes('prof')) {
    return 'education';
  }
  if (
    job.track === 'tech' ||
    job.track === 'engineering' ||
    job.id.includes('engineer') ||
    job.id.includes('developer') ||
    (majorFa && (majorFa.includes('مهندسی') || majorFa.includes('کامپیوتر')))
  ) {
    return 'engineering';
  }
  return 'general';
}

export function calculateCountryIncomeTaxAndSocial(
  annualGrossLocal: number,
  minWageMonthlyLocal: number,
  countryDef: CountryMacroDefinition,
): {
  grossAnnualLocal: number;
  socialSecurityLocal: number;
  incomeTaxLocal: number;
  healthInsuranceAnnualLocal: number;
  netAnnualLocal: number;
} {
  if (annualGrossLocal <= 0) {
    return {
      grossAnnualLocal: 0,
      socialSecurityLocal: 0,
      incomeTaxLocal: 0,
      healthInsuranceAnnualLocal: 0,
      netAnnualLocal: 0,
    };
  }
  const socialRate = countryDef.taxAndBenefits.socialSecurityEmployeeRate.value;
  const socialSecurityLocal = Math.round(annualGrossLocal * socialRate);
  const taxableBase = Math.max(0, annualGrossLocal - socialSecurityLocal);
  const annualMinWage = Math.max(1, minWageMonthlyLocal * 12);

  let incomeTaxLocal = 0;
  let prevCap = 0;
  for (const bracket of countryDef.taxAndBenefits.taxBrackets) {
    const cap = bracket.upToMultipleOfMinWage * annualMinWage;
    if (taxableBase > prevCap) {
      const slice = Math.min(taxableBase, cap) - prevCap;
      if (slice > 0) {
        incomeTaxLocal += slice * bracket.rate;
      }
    }
    prevCap = cap;
  }

  // Employed taxpayers in statutory countries already have health covered via social contributions unless separate surcharge applies (e.g., UK IHS / UAE supplement)
  const healthInsuranceAnnualLocal =
    countryDef.id === 'uk' || countryDef.id === 'uae' || countryDef.id === 'turkey'
      ? Math.round(countryDef.taxAndBenefits.healthInsuranceMonthlyLocal.value * 12)
      : 0;

  const roundedTax = Math.round(incomeTaxLocal);
  const netAnnualLocal = Math.max(
    1,
    Math.round(annualGrossLocal - socialSecurityLocal - roundedTax - healthInsuranceAnnualLocal),
  );

  return {
    grossAnnualLocal: Math.round(annualGrossLocal),
    socialSecurityLocal,
    incomeTaxLocal: roundedTax,
    healthInsuranceAnnualLocal,
    netAnnualLocal,
  };
}

function interpolateJobMult(entry: JobIncomeEntry, pos01: number): number {
  const pos = Math.max(0, Math.min(1, pos01));
  const { p10, median, p90 } = entry.monthlyIncomeMultiplierOfMinWage;
  if (pos <= 0.5) {
    return p10.value + (median.value - p10.value) * (pos / 0.5);
  }
  return median.value + (p90.value - median.value) * ((pos - 0.5) / 0.5);
}

export function getAbroadLanguageLevel(state: GameState, countryId: string, dataset: GameDataset): number {
  const countryDef = getCountryMacroDef(countryId, dataset);
  if (!countryDef) return 2;
  const byCountry = state.emigration?.languageLevels?.[countryId];
  const byCurrency = state.emigration?.languageLevels?.[countryDef.currencyCode];
  const raw = typeof byCountry === 'number' ? byCountry : typeof byCurrency === 'number' ? byCurrency : 2;
  return Math.max(1, Math.min(6, Math.round(raw)));
}

export function calculateAbroadJobIncome(params: {
  job: JobDefinition;
  level: number;
  state: GameState;
  dataset: GameDataset;
  countryIdOverride?: string;
  yearsAbroadOverride?: number;
  languageLevelOverride?: number;
  relicensedOverride?: boolean;
  permitTypeOverride?: EmigrationState['residency']['permitType'];
  rng?: SeededRNG;
  positionOverride01?: number;
}): AbroadIncomeBreakdown {
  const {
    job,
    level,
    state,
    dataset,
    countryIdOverride,
    yearsAbroadOverride,
    languageLevelOverride,
    relicensedOverride,
    permitTypeOverride,
    rng,
    positionOverride01,
  } = params;

  const countryId = countryIdOverride ?? state.player.countryId;
  const countryDef = getCountryMacroDef(countryId, dataset) ?? dataset.countriesMacro[0];
  const runtime = state.countryMacros?.[countryDef.id];
  const minWageMonthlyLocal = runtime?.minWageMonthlyLocal ?? countryDef.macro.minWageMonthlyLocal.value;

  const entry = dataset.economy.jobIncome.find((e) => e.jobId === job.id);
  const maxLevel = Math.max(1, job.ladder.length);
  const levelPos = maxLevel > 1 ? (Math.min(maxLevel, Math.max(1, level)) - 1) / (maxLevel - 1) : 0.5;
  const region = getActiveRegionDef(countryDef.id, state.emigration?.residency?.regionId, dataset);
  const regionShift = region ? (region.jobOpportunityIndex - 1) * 0.22 : 0;
  const intelShift = (state.player.stats.intelligence - 50) * 0.002;
  const noise = rng ? rng.float(-0.12, 0.12) : 0;
  const pos01 =
    positionOverride01 !== undefined
      ? Math.max(0, Math.min(1, positionOverride01))
      : Math.max(0, Math.min(1, 0.25 + levelPos * 0.52 + regionShift + intelShift + noise));

  const baseMultiplier = entry ? interpolateJobMult(entry, pos01) : 1.45;

  const credentialCategory = getCredentialTrackForJob(job, state.player.education.major);
  const credSpec = countryDef.credentials[credentialCategory] ?? countryDef.credentials.general;
  const isRelicensed =
    relicensedOverride ??
    Boolean(state.emigration?.residency?.credentialRelicensedTracks.includes(credentialCategory));
  const credentialFactor = isRelicensed
    ? Math.max(0.95, credSpec.recognitionFactor)
    : credSpec.recognitionFactor;

  const langLevel =
    languageLevelOverride ?? getAbroadLanguageLevel(state, countryDef.id, dataset);
  const langWeight = countryDef.integrationCurve.languageWeight;
  // Language levels 1..6 map smoothly from ~(0.64) to ~(1.04) weighted by destination sensitivity
  const rawLangNorm = (langLevel - 1) / 5; // 0 .. 1
  const languageFactor = Number(
    (1 - langWeight * 0.42 + rawLangNorm * (langWeight * 0.48)).toFixed(4),
  );

  const yearsAbroad = yearsAbroadOverride ?? state.emigration?.residency?.yearsAbroad ?? 0;
  const convergeYears = Math.max(1, countryDef.integrationCurve.yearsToConverge);
  const progressRatio = Math.max(0, Math.min(1, yearsAbroad / convergeYears));
  const convergenceFactor = Number(
    (1 - countryDef.integrationCurve.initialPenaltyRatio * (1 - progressRatio)).toFixed(4),
  );

  const permitType = permitTypeOverride ?? state.emigration?.residency?.permitType;
  const isStudent = permitType === 'study';
  const studentCapRatio = isStudent
    ? Math.min(0.65, countryDef.visaRules.studentWorkHoursPerWeek / 40)
    : 1;

  // Compute target multiplier, then enforce statutory minimum-wage floor for FT workers
  const rawMultiplier =
    baseMultiplier * credentialFactor * languageFactor * convergenceFactor * studentCapRatio;

  const minFloorMultiplier = isStudent
    ? 0.45
    : countryDef.macro.hasStatutoryMinWage !== false
      ? 1.0
      : 0.92;

  const effectiveMultiplier = Math.max(minFloorMultiplier, rawMultiplier);
  const grossAnnualLocal = Math.max(1, Math.round(minWageMonthlyLocal * 12 * effectiveMultiplier));

  const taxRes = calculateCountryIncomeTaxAndSocial(
    grossAnnualLocal,
    minWageMonthlyLocal,
    countryDef,
  );
  const fxToIrt = getFxRate(state, countryDef.currencyCode, 'IRT', dataset);

  return {
    currencyCode: countryDef.currencyCode,
    grossAnnualLocal: taxRes.grossAnnualLocal,
    socialSecurityLocal: taxRes.socialSecurityLocal,
    incomeTaxLocal: taxRes.incomeTaxLocal,
    healthInsuranceAnnualLocal: taxRes.healthInsuranceAnnualLocal,
    netAnnualLocal: taxRes.netAnnualLocal,
    grossAnnualToman: Math.round(taxRes.grossAnnualLocal * fxToIrt),
    netAnnualToman: Math.round(taxRes.netAnnualLocal * fxToIrt),
    monthlyMultiplierOfMinWage: Number(effectiveMultiplier.toFixed(3)),
    minWageMonthlyLocal,
    credentialCategory,
    credentialFactor,
    languageFactor,
    convergenceFactor,
    needsRelicensing: credSpec.needsRelicensing && !isRelicensed,
  };
}

export function getExpectedAbroadMonthlyNetRange(params: {
  countryId: string;
  state: GameState;
  dataset: GameDataset;
  jobIdOverride?: string;
  regionIdOverride?: string;
  languageLevelOverride?: number;
}): {
  currencyCode: CurrencyCode;
  monthlyNetLow: number;
  monthlyNetMedian: number;
  monthlyNetHigh: number;
  needsRelicensing: boolean;
  jobTitleFa: string;
} {
  const {
    countryId,
    state,
    dataset,
    jobIdOverride,
    regionIdOverride,
    languageLevelOverride,
  } = params;
  const overrideJob = jobIdOverride ? dataset.jobs.find((j) => j.id === jobIdOverride) : undefined;
  const currentJob = state.player.job
    ? dataset.jobs.find((j) => j.id === state.player.job!.jobId)
    : undefined;
  const fallbackJob =
    overrideJob ??
    currentJob ??
    dataset.jobs.find((j) => j.minEducation === state.player.education.level) ??
    dataset.jobs[0];

  const langLevel = languageLevelOverride ?? getAbroadLanguageLevel(state, countryId, dataset);
  const yearsEst = state.player.countryId === countryId ? state.emigration?.residency?.yearsAbroad ?? 0 : 1;
  const activeState =
    regionIdOverride && state.emigration
      ? {
          ...state,
          emigration: {
            ...state.emigration,
            residency: { ...state.emigration.residency, regionId: regionIdOverride },
          },
        }
      : state;
  const targetLevel = overrideJob ? 1 : state.player.job?.level ?? 1;

  const low = calculateAbroadJobIncome({
    job: fallbackJob,
    level: targetLevel,
    state: activeState,
    dataset,
    countryIdOverride: countryId,
    yearsAbroadOverride: 0,
    languageLevelOverride: langLevel,
    positionOverride01: 0.25,
  });
  const med = calculateAbroadJobIncome({
    job: fallbackJob,
    level: targetLevel,
    state: activeState,
    dataset,
    countryIdOverride: countryId,
    yearsAbroadOverride: yearsEst,
    languageLevelOverride: langLevel,
    positionOverride01: 0.5,
  });
  const high = calculateAbroadJobIncome({
    job: fallbackJob,
    level: Math.min(fallbackJob.ladder.length, targetLevel + 1),
    state: activeState,
    dataset,
    countryIdOverride: countryId,
    yearsAbroadOverride: 4,
    languageLevelOverride: Math.min(6, langLevel + 1),
    relicensedOverride: true,
    positionOverride01: 0.8,
  });

  return {
    currencyCode: med.currencyCode,
    monthlyNetLow: Math.round(low.netAnnualLocal / 12),
    monthlyNetMedian: Math.round(med.netAnnualLocal / 12),
    monthlyNetHigh: Math.round(high.netAnnualLocal / 12),
    needsRelicensing: med.needsRelicensing,
    jobTitleFa: fallbackJob.shortTitle || fallbackJob.titleFa,
  };
}

export function getAbroadMonthlyBudget(
  state: GameState,
  dataset: GameDataset,
  countryIdOverride?: string,
  regionIdOverride?: string,
  householdMembersOverride?: number,
): AbroadMonthlyBudget {
  const countryId = countryIdOverride ?? state.player.countryId;
  const countryDef = getCountryMacroDef(countryId, dataset) ?? dataset.countriesMacro[0];
  const costDef = getCountryCostDef(countryDef.id, dataset) ?? dataset.countryCosts[0];
  const runtime = state.countryMacros?.[countryDef.id];
  const cpiScale = runtime?.cpiIndex ?? 1;
  const rentScale = runtime?.rentIndex ?? 1;
  const region = getActiveRegionDef(
    countryDef.id,
    regionIdOverride ?? state.emigration?.residency?.regionId,
    dataset,
  );
  const colMult = region?.colMultiplier ?? 1;
  const rentMult = region?.rentMultiplier ?? 1;

  const hasSpouse =
    householdMembersOverride !== undefined
      ? householdMembersOverride >= 2
      : state.relationships.some((r) => r.role === 'spouse' && state.npcs[r.personId]?.isAlive);
  const childrenCount =
    householdMembersOverride !== undefined
      ? Math.max(0, householdMembersOverride - 2)
      : state.relationships.filter((r) => r.role === 'child' && state.npcs[r.personId]?.isAlive).length;
  const nonRentHouseholdMult = 1 + (hasSpouse ? 0.42 : 0) + Math.min(3, childrenCount) * 0.24;
  const rentHouseholdMult = 1 + (hasSpouse ? 0.18 : 0) + Math.min(3, childrenCount) * 0.14;

  // If player owns abroad housing, monthly mortgage/ownership rent drops to maintenance share
  const ownsAbroadHome =
    state.player.countryId === countryDef.id &&
    (state.player.housing.type === 'owned' || state.player.housing.type === 'villa');
  const rentBase = costDef.monthlyBasketLocal.rentSingle.value * rentScale * rentMult * rentHouseholdMult;
  const rentLocal = ownsAbroadHome
    ? Math.round(rentBase * 0.22)
    : Math.round(rentBase);
  const foodLocal = Math.round(
    costDef.monthlyBasketLocal.foodSingle.value * cpiScale * colMult * nonRentHouseholdMult,
  );
  const utilitiesTransportLocal = Math.round(
    costDef.monthlyBasketLocal.utilitiesTransport.value * cpiScale * colMult * (1 + (hasSpouse ? 0.2 : 0)),
  );
  const healthcareMiscLocal = Math.round(
    costDef.monthlyBasketLocal.healthcareMisc.value * cpiScale * colMult * nonRentHouseholdMult,
  );

  const totalMonthlyLocal = rentLocal + foodLocal + utilitiesTransportLocal + healthcareMiscLocal;
  const totalAnnualLocal = totalMonthlyLocal * 12;
  const fxToIrt = getFxRate(state, countryDef.currencyCode, 'IRT', dataset);
  const minWage = runtime?.minWageMonthlyLocal ?? countryDef.macro.minWageMonthlyLocal.value;

  return {
    currencyCode: countryDef.currencyCode,
    rentLocal,
    foodLocal,
    utilitiesTransportLocal,
    healthcareMiscLocal,
    totalMonthlyLocal,
    totalAnnualLocal,
    totalMonthlyToman: Math.round(totalMonthlyLocal * fxToIrt),
    totalAnnualToman: Math.round(totalAnnualLocal * fxToIrt),
    ratioToMinWage: Number((totalMonthlyLocal / Math.max(1, minWage)).toFixed(2)),
  };
}

export function getAbroadHousingOptions(
  countryId: string,
  regionId: string | undefined,
  state: GameState,
  dataset: GameDataset,
): AbroadHousingOption[] {
  const countryDef = getCountryMacroDef(countryId, dataset);
  const costDef = getCountryCostDef(countryId, dataset);
  if (!countryDef || !costDef) return [];

  const runtime = state.countryMacros?.[countryId];
  const housingIdx = runtime?.housingIndex ?? 1;
  const rentIdx = runtime?.rentIndex ?? 1;
  const region = getActiveRegionDef(countryId, regionId, dataset);
  const regionNameFa = region?.nameFa ?? countryDef.nameFa;
  const rentMult = region?.rentMultiplier ?? 1;
  const colMult = region?.colMultiplier ?? 1;

  const baseMonthlyRent = Math.round(
    countryDef.macro.monthlyRentSingleBaseLocal.value * rentIdx * rentMult,
  );
  const studioRent = Math.max(1, Math.round(baseMonthlyRent * 0.85));
  const twoBedRent = Math.max(1, Math.round(baseMonthlyRent * 1.45));
  const depositMonths = costDef.housingNorms.depositMonths;

  const sqmPrice = Math.round(
    countryDef.macro.housingPricePerSqmLocal.value * housingIdx * (colMult * 0.75 + rentMult * 0.25),
  );
  const buyArea = costDef.housingNorms.defaultBuySqm;
  const buyPriceLocal = Math.max(1, Math.round(sqmPrice * buyArea));
  const downPaymentLocal = Math.round(buyPriceLocal * costDef.housingNorms.mortgageDownPaymentRatio);
  const principal = Math.max(0, buyPriceLocal - downPaymentLocal);
  const rate = costDef.housingNorms.mortgageAnnualRate;
  const years = costDef.housingNorms.mortgageMaxYears;
  const annualMortgageLocal =
    principal > 0 && rate > 0
      ? Math.round((principal * rate) / (1 - Math.pow(1 + rate, -years)))
      : Math.round(principal / Math.max(1, years));

  return [
    {
      id: `${countryId}_rent_studio`,
      mode: 'rent',
      titleFa: `استودیو نقلی در ${regionNameFa}`,
      areaSqm: 42,
      currencyCode: countryDef.currencyCode,
      depositLocal: studioRent * depositMonths,
      monthlyRentLocal: studioRent,
      buyPriceLocal: 0,
      downPaymentLocal: 0,
      annualMortgageLocal: 0,
      mortgageYears: 0,
    },
    {
      id: `${countryId}_rent_family`,
      mode: 'rent',
      titleFa: `آپارتمان یک‌خوابه در ${regionNameFa}`,
      areaSqm: 68,
      currencyCode: countryDef.currencyCode,
      depositLocal: twoBedRent * depositMonths,
      monthlyRentLocal: twoBedRent,
      buyPriceLocal: 0,
      downPaymentLocal: 0,
      annualMortgageLocal: 0,
      mortgageYears: 0,
    },
    {
      id: `${countryId}_buy_apt`,
      mode: 'buy',
      titleFa: `خرید آپارتمان ${buyArea} متری در ${regionNameFa}`,
      areaSqm: buyArea,
      currencyCode: countryDef.currencyCode,
      depositLocal: 0,
      monthlyRentLocal: 0,
      buyPriceLocal,
      downPaymentLocal,
      annualMortgageLocal,
      mortgageYears: years,
    },
  ];
}

export function buildAnnualEconomicReportCard(params: {
  year: number;
  currencyCode: CurrencyCode;
  netIncomeLocal: number;
  livingCostsLocal: number;
  taxesPaidLocal: number;
  remittanceLocal: number;
  savingsDeltaLocal: number;
}): NonNullable<EmigrationState['lastReportCard']> {
  return {
    year: params.year,
    currencyCode: params.currencyCode,
    netIncomeLocal: Math.round(params.netIncomeLocal),
    livingCostsLocal: Math.round(params.livingCostsLocal),
    taxesPaidLocal: Math.round(params.taxesPaidLocal),
    remittanceLocal: Math.round(params.remittanceLocal),
    savingsDeltaLocal: Math.round(params.savingsDeltaLocal),
  };
}
