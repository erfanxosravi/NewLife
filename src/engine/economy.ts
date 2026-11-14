import type { GameDataset } from '../data/registry';
import type { SeededRNG } from './rng';
import type {
  Baseline1405Data,
  GameState,
  HistoricalYearPoint,
  HousingListing,
  InflationScenario,
  JobDefinition,
  JobIncomeEntry,
  SocialClass,
} from './types';

export interface MacroRatesSnapshot {
  year: number;
  cpiRatioTo1405: number;
  inflationRate: number;
  minWageMonthly: number;
  usdFree: number;
  emamiCoin: number;
  gold18kPerGram: number;
  tehranListingSqm: number;
}

export interface JobIncomeBreakdown {
  grossAnnual: number;
  commission: number;
  runningCosts: number;
  bimeh: number;
  incomeTax: number;
  netAnnual: number;
  monthlyMultiplierOfMinWage: number;
  tailTriggered?: {
    titleFa: string;
    resultTextFa: string;
  };
}

export interface HousingPriceQuote {
  listingPriceToman: number;
  transactionPriceToman: number;
  depositRahnToman: number;
  monthlyRentToman: number;
  pricePerSqmListingToman: number;
}

export function pickInflationScenario(rng: SeededRNG): InflationScenario {
  const roll = rng.float(0, 1);
  if (roll < 0.25) return 'low';
  if (roll < 0.72) return 'medium';
  return 'high';
}

export function getInflationScenario(state: GameState): InflationScenario {
  const raw = state.flags['econ_scenario'];
  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }
  return 'medium';
}

export function getHistoricalYearPoint(
  year: number,
  dataset: GameDataset,
): HistoricalYearPoint {
  const series = dataset.economy.historicalSeries;
  const clamped = Math.max(series[0].year, Math.min(series[series.length - 1].year, year));
  return series.find((p) => p.year === clamped) ?? series[series.length - 1];
}

export function getAnchorYearPoint(dataset: GameDataset): HistoricalYearPoint {
  const anchorYear = dataset.economy.baseline1405.meta.anchorYear;
  return getHistoricalYearPoint(anchorYear, dataset);
}

export function getBaselineScaleFromMinWage(
  minWageMultiple: number,
  state: GameState,
  dataset: GameDataset,
): number {
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  return Math.max(0, Math.round(minWageMultiple * minWageMonthly));
}

export function getMacroRatesForState(state: GameState, dataset: GameDataset): MacroRatesSnapshot {
  const baseline = dataset.economy.baseline1405;
  const anchorYear = baseline.meta.anchorYear;
  const anchorPoint = getAnchorYearPoint(dataset);

  if (state.currentJalaliYear <= anchorYear) {
    const point = getHistoricalYearPoint(state.currentJalaliYear, dataset);
    const historicalRatio = point.cpiIndex.value / anchorPoint.cpiIndex.value;
    // Allow explicit inflationMultiplier overrides in unit tests (e.g. inflationMultiplier = 2.5)
    const isOverridden =
      Math.abs(state.inflationMultiplier - historicalRatio) > Math.max(0.05, historicalRatio * 0.25);
    const ratio = isOverridden ? state.inflationMultiplier : historicalRatio;
    const scaleIfOverridden = isOverridden ? state.inflationMultiplier / historicalRatio : 1;

    const gold18kRatio =
      baseline.verifiedBenchmarks.gold18kPerGram.value /
      baseline.verifiedBenchmarks.emamiCoin.value;

    return {
      year: state.currentJalaliYear,
      cpiRatioTo1405: ratio,
      inflationRate: point.inflationRate.value,
      minWageMonthly: Math.max(1, Math.round(point.minWageMonthly.value * scaleIfOverridden)),
      usdFree: Math.max(1, Math.round(point.usdFree.value * scaleIfOverridden)),
      emamiCoin: Math.max(1, Math.round(point.emamiCoin.value * scaleIfOverridden)),
      gold18kPerGram: Math.max(
        1,
        Math.round(
          (state.currentJalaliYear === anchorYear
            ? baseline.verifiedBenchmarks.gold18kPerGram.value
            : point.emamiCoin.value * gold18kRatio) * scaleIfOverridden,
        ),
      ),
      tehranListingSqm: Math.max(1, Math.round(point.tehranPricePerSqm.value * scaleIfOverridden)),
    };
  }

  // Future years (> 1405): read stored macro flags if present, else scale cleanly by inflationMultiplier
  const fallbackScale = state.inflationMultiplier;
  const readFlag = (key: string, base1405Val: number): number => {
    const val = state.flags[key];
    return typeof val === 'number' && Number.isFinite(val) && val > 0
      ? Math.round(val)
      : Math.max(1, Math.round(base1405Val * fallbackScale));
  };

  return {
    year: state.currentJalaliYear,
    cpiRatioTo1405: state.inflationMultiplier,
    inflationRate: state.lastInflationRate,
    minWageMonthly: readFlag('macro_min_wage', baseline.verifiedBenchmarks.minWageMonthly.value),
    usdFree: readFlag('macro_usd', baseline.verifiedBenchmarks.usdFree.value),
    emamiCoin: readFlag('macro_coin', baseline.verifiedBenchmarks.emamiCoin.value),
    gold18kPerGram: readFlag('macro_gold_gram', baseline.verifiedBenchmarks.gold18kPerGram.value),
    tehranListingSqm: readFlag(
      'macro_tehran_sqm',
      baseline.verifiedBenchmarks.tehranListingPricePerSqm.value,
    ),
  };
}

export function getMinWageMonthlyForState(state: GameState, dataset: GameDataset): number {
  return getMacroRatesForState(state, dataset).minWageMonthly;
}

export function initializeMacroFlagsForBirthYear(
  birthJalaliYear: number,
  scenario: InflationScenario,
  dataset: GameDataset,
): {
  inflationMultiplier: number;
  lastInflationRate: number;
  flags: Record<string, number | string>;
} {
  const baseline = dataset.economy.baseline1405;
  const anchorPoint = getAnchorYearPoint(dataset);
  const point = getHistoricalYearPoint(birthJalaliYear, dataset);
  const ratio = Number((point.cpiIndex.value / anchorPoint.cpiIndex.value).toFixed(6));
  const gold18kRatio =
    baseline.verifiedBenchmarks.gold18kPerGram.value / baseline.verifiedBenchmarks.emamiCoin.value;

  return {
    inflationMultiplier: Math.max(0.000001, ratio),
    lastInflationRate: point.inflationRate.value,
    flags: {
      econ_scenario: scenario,
      macro_min_wage: point.minWageMonthly.value,
      macro_usd: point.usdFree.value,
      macro_coin: point.emamiCoin.value,
      macro_gold_gram:
        birthJalaliYear === baseline.meta.anchorYear
          ? baseline.verifiedBenchmarks.gold18kPerGram.value
          : Math.max(1, Math.round(point.emamiCoin.value * gold18kRatio)),
      macro_tehran_sqm: point.tehranPricePerSqm.value,
    },
  };
}

export function stepMacroYear(
  state: GameState,
  nextYear: number,
  rng: SeededRNG,
  dataset: GameDataset,
): {
  nextMultiplier: number;
  rate: number;
  macroFlags: Record<string, number>;
} {
  const baseline = dataset.economy.baseline1405;
  const anchorYear = baseline.meta.anchorYear;
  const anchorPoint = getAnchorYearPoint(dataset);

  if (nextYear <= anchorYear) {
    const point = getHistoricalYearPoint(nextYear, dataset);
    const ratio = Number((point.cpiIndex.value / anchorPoint.cpiIndex.value).toFixed(6));
    const gold18kRatio =
      baseline.verifiedBenchmarks.gold18kPerGram.value /
      baseline.verifiedBenchmarks.emamiCoin.value;

    return {
      nextMultiplier: Math.max(0.000001, ratio),
      rate: point.inflationRate.value,
      macroFlags: {
        macro_min_wage: point.minWageMonthly.value,
        macro_usd: point.usdFree.value,
        macro_coin: point.emamiCoin.value,
        macro_gold_gram:
          nextYear === anchorYear
            ? baseline.verifiedBenchmarks.gold18kPerGram.value
            : Math.max(1, Math.round(point.emamiCoin.value * gold18kRatio)),
        macro_tehran_sqm: point.tehranPricePerSqm.value,
      },
    };
  }

  // Future years (> 1405): scenario-driven band from baseline_1405.json
  const p = baseline.policyAndModel;
  const scenario = getInflationScenario(state);
  const band =
    scenario === 'low'
      ? {
          min: p.scenarioLowInflationMin.value,
          max: p.scenarioLowInflationMax.value,
          wageCatchup: p.scenarioLowWageCatchup.value,
        }
      : scenario === 'medium'
        ? {
            min: p.scenarioMediumInflationMin.value,
            max: p.scenarioMediumInflationMax.value,
            wageCatchup: p.scenarioMediumWageCatchup.value,
          }
        : {
            min: p.scenarioHighInflationMin.value,
            max: p.scenarioHighInflationMax.value,
            wageCatchup: p.scenarioHighWageCatchup.value,
          };

  const rawRate = rng.float(band.min, band.max);
  const yearsPastAnchor = Math.max(0, nextYear - anchorYear);
  const horizonDamp = yearsPastAnchor > 20 ? Math.max(0.45, 1 - (yearsPastAnchor - 20) * 0.015) : 1;
  const rate = Number((rawRate * horizonDamp).toFixed(4));
  const nextMultiplier = Number((state.inflationMultiplier * (1 + rate)).toFixed(4));

  const prev = getMacroRatesForState(state, dataset);
  const usdDrift =
    1 +
    rate * p.usdInflationPassThrough.value +
    rng.float(p.usdVolatilityMin.value, p.usdVolatilityMax.value);
  const goldDrift =
    1 +
    rate * p.goldInflationPassThrough.value +
    rng.float(p.goldVolatilityMin.value, p.goldVolatilityMax.value);
  const housingDrift = 1 + rate * p.housingInflationPassThrough.value;
  const wageDrift = 1 + rate * band.wageCatchup;

  return {
    nextMultiplier: Math.max(0.000001, nextMultiplier),
    rate,
    macroFlags: {
      macro_min_wage: Math.max(1, Math.round(prev.minWageMonthly * wageDrift)),
      macro_usd: Math.max(1, Math.round(prev.usdFree * Math.max(0.85, usdDrift))),
      macro_coin: Math.max(1, Math.round(prev.emamiCoin * Math.max(0.85, goldDrift))),
      macro_gold_gram: Math.max(1, Math.round(prev.gold18kPerGram * Math.max(0.85, goldDrift))),
      macro_tehran_sqm: Math.max(1, Math.round(prev.tehranListingSqm * housingDrift)),
    },
  };
}

export function getInitialPocketMoney(
  socialClass: SocialClass,
  birthJalaliYear: number,
  dataset: GameDataset,
): number {
  const p = dataset.economy.baseline1405.policyAndModel;
  const minWage = getHistoricalYearPoint(birthJalaliYear, dataset).minWageMonthly.value;
  const multipleByClass: Record<SocialClass, number> = {
    poor: p.pocketMoneyPoorMinWageMultiple.value,
    middle: p.pocketMoneyMiddleMinWageMultiple.value,
    upper_middle: p.pocketMoneyUpperMiddleMinWageMultiple.value,
    wealthy: p.pocketMoneyWealthyMinWageMultiple.value,
  };
  return Math.round(multipleByClass[socialClass] * minWage);
}

export function calculateProgressiveIncomeTax(
  annualAfterCosts: number,
  minWageMonthly: number,
  baseline: Baseline1405Data,
): { bimeh: number; incomeTax: number } {
  if (annualAfterCosts <= 0) return { bimeh: 0, incomeTax: 0 };
  const p = baseline.policyAndModel;
  const bimeh = Math.round(annualAfterCosts * p.socialSecurityEmployeeRate.value);
  const taxableBase = Math.max(0, annualAfterCosts - bimeh);

  const b1 = minWageMonthly * p.taxExemptionAnnualMinWageMultiple.value;
  const b2 = minWageMonthly * p.taxBracket2MinWageMultiple.value;
  const b3 = minWageMonthly * p.taxBracket3MinWageMultiple.value;

  let tax = 0;
  if (taxableBase > b1) {
    tax += Math.min(taxableBase - b1, Math.max(0, b2 - b1)) * p.taxBracket1Rate.value;
  }
  if (taxableBase > b2) {
    tax += Math.min(taxableBase - b2, Math.max(0, b3 - b2)) * p.taxBracket2Rate.value;
  }
  if (taxableBase > b3) {
    tax += (taxableBase - b3) * p.taxBracket3Rate.value;
  }

  return { bimeh, incomeTax: Math.round(tax) };
}

function interpolateJobMultiplier(
  entry: JobIncomeEntry,
  pos01: number,
): number {
  const pos = Math.max(0, Math.min(1, pos01));
  const { p10, median, p90 } = entry.monthlyIncomeMultiplierOfMinWage;
  if (pos <= 0.5) {
    return p10.value + (median.value - p10.value) * (pos / 0.5);
  }
  return median.value + (p90.value - median.value) * ((pos - 0.5) / 0.5);
}

export function calculateJobAnnualIncomeBreakdown(params: {
  job: JobDefinition;
  level: number;
  state: GameState;
  dataset: GameDataset;
  rng?: SeededRNG;
  allowTail?: boolean;
  positionOverride01?: number;
}): JobIncomeBreakdown {
  const { job, level, state, dataset, rng, allowTail = false, positionOverride01 } = params;
  const baseline = dataset.economy.baseline1405;
  const entry = dataset.economy.jobIncome.find((e) => e.jobId === job.id);
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  const country = dataset.countries.find((c) => c.id === state.player.countryId);
  const countryFactor = country && !country.isIran ? country.costOfLivingIndex : 1;

  if (!entry) {
    const fallbackNet = Math.round(minWageMonthly * 12 * 1.5 * countryFactor);
    return {
      grossAnnual: fallbackNet,
      commission: 0,
      runningCosts: 0,
      bimeh: 0,
      incomeTax: 0,
      netAnnual: fallbackNet,
      monthlyMultiplierOfMinWage: 1.5,
    };
  }

  // Check ultra-rare tail event first if enabled
  if (allowTail && rng && entry.tail && rng.chance(entry.tail.probability.value)) {
    const grossAnnual = Math.max(
      1,
      Math.round(minWageMonthly * entry.tail.yearlyCapMultiplierOfMinWage.value * countryFactor),
    );
    const commission = Math.round(grossAnnual * entry.commissionRate.value);
    const runningCosts = Math.round(grossAnnual * entry.costRatioOfGross.value);
    const afterCosts = Math.max(0, grossAnnual - commission - runningCosts);
    const { bimeh, incomeTax } = entry.taxExempt
      ? { bimeh: 0, incomeTax: 0 }
      : calculateProgressiveIncomeTax(afterCosts, minWageMonthly, baseline);
    const netAnnual = Math.max(1, afterCosts - bimeh - incomeTax);
    return {
      grossAnnual,
      commission,
      runningCosts,
      bimeh,
      incomeTax,
      netAnnual,
      monthlyMultiplierOfMinWage: Number((grossAnnual / (minWageMonthly * 12)).toFixed(3)),
      tailTriggered: {
        titleFa: entry.tail.titleFa,
        resultTextFa: entry.tail.resultTextFa,
      },
    };
  }

  const maxLevel = Math.max(1, job.ladder.length);
  const levelPos = maxLevel > 1 ? (Math.min(maxLevel, Math.max(1, level)) - 1) / (maxLevel - 1) : 0.5;
  const city = dataset.cities.find((c) => c.id === state.player.currentCityId);
  const cityShift = city ? (city.jobOpportunityIndex - 1) * 0.2 : 0;
  const intelShift = (state.player.stats.intelligence - 50) * 0.002;
  const noise = rng ? rng.float(-0.18, 0.18) : 0;

  // Map position strictly inside [0, 1] so normal-year gross strictly lies within [p10, p90]
  const pos01 =
    positionOverride01 !== undefined
      ? Math.max(0, Math.min(1, positionOverride01))
      : Math.max(0, Math.min(1, 0.22 + levelPos * 0.56 + cityShift + intelShift + noise));

  const monthlyMultiplier = interpolateJobMultiplier(entry, pos01);
  const grossAnnual = Math.max(1, Math.round(minWageMonthly * 12 * monthlyMultiplier * countryFactor));
  const commission = Math.round(grossAnnual * entry.commissionRate.value);
  const runningCosts = Math.round(grossAnnual * entry.costRatioOfGross.value);
  const afterCosts = Math.max(0, grossAnnual - commission - runningCosts);
  const { bimeh, incomeTax } = entry.taxExempt
    ? { bimeh: 0, incomeTax: 0 }
    : calculateProgressiveIncomeTax(afterCosts, minWageMonthly, baseline);
  const netAnnual = Math.max(1, afterCosts - bimeh - incomeTax);

  return {
    grossAnnual,
    commission,
    runningCosts,
    bimeh,
    incomeTax,
    netAnnual,
    monthlyMultiplierOfMinWage: Number(monthlyMultiplier.toFixed(3)),
  };
}

export function calculateHousingQuote(
  listing: HousingListing,
  cityId: string,
  state: GameState,
  dataset: GameDataset,
): HousingPriceQuote {
  const baseline = dataset.economy.baseline1405;
  const macro = getMacroRatesForState(state, dataset);
  const tehranSqm = macro.tehranListingSqm;
  const cityMult = baseline.cityHousingMultipliers[cityId]?.value ?? 0.35;
  const regionTier = listing.regionTier ?? 'mid';
  const regionMult = baseline.housingRegionMultipliers[regionTier].value;
  const pricePerSqmListingToman = Math.max(1, Math.round(tehranSqm * cityMult * regionMult));

  if (listing.mode === 'buy') {
    const listingPriceToman = Math.max(1, Math.round(pricePerSqmListingToman * listing.areaSqm));
    const transactionPriceToman = Math.max(
      1,
      Math.round(listingPriceToman * baseline.policyAndModel.listingToTransactionDiscount.value),
    );
    return {
      listingPriceToman,
      transactionPriceToman,
      depositRahnToman: 0,
      monthlyRentToman: 0,
      pricePerSqmListingToman,
    };
  }

  // Rent quote anchored to verified Tehran Mid (70-100 sqm) and South benchmarks
  const tehranFactor = tehranSqm / baseline.verifiedBenchmarks.tehranListingPricePerSqm.value;
  if (regionTier === 'south') {
    const areaFactor = listing.areaSqm / 70;
    return {
      listingPriceToman: 0,
      transactionPriceToman: 0,
      depositRahnToman: Math.max(
        1,
        Math.round(
          baseline.verifiedBenchmarks.tehranRentSouthDeposit.value *
            tehranFactor *
            cityMult *
            areaFactor,
        ),
      ),
      monthlyRentToman: Math.max(
        1,
        Math.round(
          baseline.verifiedBenchmarks.tehranRentSouthMonthly.value *
            tehranFactor *
            cityMult *
            areaFactor,
        ),
      ),
      pricePerSqmListingToman,
    };
  }

  const areaFactor = listing.areaSqm / 85;
  return {
    listingPriceToman: 0,
    transactionPriceToman: 0,
    depositRahnToman: Math.max(
      1,
      Math.round(
        baseline.verifiedBenchmarks.tehranRentMidDeposit.value *
          tehranFactor *
          cityMult *
          regionMult *
          areaFactor,
      ),
    ),
    monthlyRentToman: Math.max(
      1,
      Math.round(
        baseline.verifiedBenchmarks.tehranRentMidMonthly.value *
          tehranFactor *
          cityMult *
          regionMult *
          areaFactor,
      ),
    ),
    pricePerSqmListingToman,
  };
}

export function convertDepositRentPair(
  baseDeposit: number,
  baseMonthlyRent: number,
  extraDepositToman: number,
  dataset: GameDataset,
): { deposit: number; monthlyRent: number } {
  const rate = dataset.economy.baseline1405.policyAndModel.depositToMonthlyRentRate.value;
  const deposit = Math.max(0, Math.round(baseDeposit + extraDepositToman));
  const rentDelta = Math.round(extraDepositToman * rate);
  const monthlyRent = Math.max(0, Math.round(baseMonthlyRent - rentDelta));
  return { deposit, monthlyRent };
}

export function getTehran70SqmTransactionPriceToman(
  state: GameState,
  dataset: GameDataset,
): number {
  const p = dataset.economy.baseline1405.policyAndModel;
  const macro = getMacroRatesForState(state, dataset);
  return Math.max(
    1,
    Math.round(
      macro.tehranListingSqm *
        p.referenceApartmentAreaSqm.value *
        p.listingToTransactionDiscount.value,
    ),
  );
}

export function getPurchasingPowerSummary(
  amountToman: number,
  state: GameState,
  dataset: GameDataset,
): {
  usdEquivalent: number;
  tehran70SqmApts: number;
  labelFa: string;
} {
  const macro = getMacroRatesForState(state, dataset);
  const usdEquivalent = Math.round(amountToman / Math.max(1, macro.usdFree));
  const aptPrice = getTehran70SqmTransactionPriceToman(state, dataset);
  const tehran70SqmApts = Number((amountToman / aptPrice).toFixed(2));

  let labelFa = 'زیر خط پس‌انداز';
  if (usdEquivalent >= 500_000 || tehran70SqmApts >= 3) labelFa = 'ثروت کلان و مستقل';
  else if (usdEquivalent >= 100_000 || tehran70SqmApts >= 1) labelFa = 'استقلال مالی (هم‌تراز ملک تهران)';
  else if (usdEquivalent >= 30_000) labelFa = 'دارای سرمایه و اندوخته';
  else if (usdEquivalent >= 5_000) labelFa = 'در حال شکل‌گیری پس‌انداز';
  else if (amountToman > 0) labelFa = 'نقدینگی روزمره';

  return { usdEquivalent, tehran70SqmApts, labelFa };
}

export function hasReachedFinancialFreedomMilestone(
  state: GameState,
  dataset: GameDataset,
): boolean {
  const netWorth = calculateNetWorthToman(state);
  const pp = getPurchasingPowerSummary(netWorth, state, dataset);
  const p = dataset.economy.baseline1405.policyAndModel;
  return (
    pp.usdEquivalent >= p.wealthMilestoneUsdThreshold.value ||
    pp.tehran70SqmApts >= p.wealthMilestoneAptCount.value
  );
}

export function getAnnualLivingExpenseToman(
  state: GameState,
  dataset: GameDataset,
): number {
  const p = dataset.economy.baseline1405.policyAndModel;
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  const city = dataset.cities.find((c) => c.id === state.player.currentCityId);
  const cityCol = city?.costOfLivingIndex ?? 1;
  const country = dataset.countries.find((c) => c.id === state.player.countryId);
  const countryCol = country && !country.isIran ? country.costOfLivingIndex : 1;

  if (state.player.job) {
    return Math.round(
      minWageMonthly * p.baseAnnualLivingExpenseMinWageMultiple.value * cityCol * countryCol,
    );
  }
  if (state.player.age >= 18 && state.player.housing.type !== 'with_family') {
    return Math.round(
      minWageMonthly * p.unemployedLivingSupportMinWageMultiple.value * cityCol * countryCol,
    );
  }
  return 0;
}

export function calculateNetWorthToman(state: GameState): number {
  const assetTotal = state.assets.reduce((sum, asset) => sum + asset.currentValueToman, 0);
  const propertyTotal = state.player.housing.propertyValueToman + state.player.housing.depositRahnToman;
  const bizEquity = state.ownedBusiness
    ? Math.round(
        (state.ownedBusiness.depositLockedToman +
          state.ownedBusiness.equipmentValueToman +
          Math.max(0, state.ownedBusiness.cashReserveToman)) *
          state.ownedBusiness.ownershipShare,
      )
    : 0;
  const loanTotal = state.loans.reduce((sum, loan) => sum + loan.principalRemainingToman, 0);
  const net =
    state.player.moneyToman + assetTotal + propertyTotal + bizEquity - state.player.debtToman - loanTotal;
  return Math.round(Number.isFinite(net) ? net : 0);
}
