import type { GameDataset } from '../../data/registry';
import { toPersianDigits } from '../jalali';
import type { SeededRNG } from '../rng';
import type {
  CurrencyCode,
  CurrencyDefinition,
  DisplayCurrencyMode,
  FxState,
  GameState,
  TransferChannelDef,
} from '../types';

export const ALL_CURRENCY_CODES: CurrencyCode[] = [
  'IRT',
  'USD',
  'TRY',
  'EUR',
  'GBP',
  'CAD',
  'AED',
];

export function getCurrencyDef(code: CurrencyCode, dataset: GameDataset): CurrencyDefinition {
  return (
    dataset.economy.currencies.find((c) => c.code === code) ??
    dataset.economy.currencies[0]
  );
}

export function roundCurrencyAmount(
  amount: number,
  currencyCode: CurrencyCode,
  dataset: GameDataset,
): number {
  const def = getCurrencyDef(currencyCode, dataset);
  const factor = Math.pow(10, def.minorUnit);
  return Math.round(amount * factor) / factor;
}

export function getHistoricalFxRow(year: number, dataset: GameDataset) {
  const rows = dataset.economy.fxParams.historicalUsdRates;
  const clamped = Math.max(rows[0].year, Math.min(rows[rows.length - 1].year, year));
  return rows.find((r) => r.year === clamped) ?? rows[rows.length - 1];
}

export function initializeFxState(
  birthJalaliYear: number,
  dataset: GameDataset,
): FxState {
  const row = getHistoricalFxRow(birthJalaliYear, dataset);
  const histPoint =
    dataset.economy.historicalSeries.find((p) => p.year === birthJalaliYear) ??
    dataset.economy.historicalSeries[dataset.economy.historicalSeries.length - 1];

  const usdRates = {} as Record<CurrencyCode, number>;
  const fairUsdRates = {} as Record<CurrencyCode, number>;
  const cumulativePriceIndices = {} as Record<CurrencyCode, number>;

  for (const code of ALL_CURRENCY_CODES) {
    const rate = row.rates[code]?.value ?? 1;
    usdRates[code] = rate;
    fairUsdRates[code] = rate;
    cumulativePriceIndices[code] = 1;
  }

  return {
    usdRates,
    fairUsdRates,
    cumulativePriceIndices,
    history: [
      {
        year: birthJalaliYear,
        usdRates: { ...usdRates },
        fairUsdRates: { ...fairUsdRates },
        goldUsdPerOz: histPoint.globalGoldUSD.value,
      },
    ],
  };
}

export function ensureFxState(state: GameState, dataset: GameDataset): FxState {
  if (state.fxState && state.fxState.usdRates && state.fxState.fairUsdRates) {
    return state.fxState;
  }
  const initialized = initializeFxState(state.currentJalaliYear, dataset);
  const macroUsd = state.flags['macro_usd'];
  if (typeof macroUsd === 'number' && Number.isFinite(macroUsd) && macroUsd > 0) {
    initialized.usdRates.IRT = macroUsd;
    initialized.fairUsdRates.IRT = macroUsd;
  }
  return initialized;
}

export function stepFxRates(params: {
  prevFx: FxState;
  nextYear: number;
  iranInflationRate: number;
  countryInflationsByCurrency: Partial<Record<CurrencyCode, number>>;
  globalInflationRate: number;
  oilShockRatio: number;
  globalGrowthShockRatio: number;
  goldUsdPerOz: number;
  iranMacroUsdOverride?: number;
  rng: SeededRNG;
  dataset: GameDataset;
}): FxState {
  const {
    prevFx,
    nextYear,
    iranInflationRate,
    countryInflationsByCurrency,
    globalInflationRate,
    oilShockRatio,
    globalGrowthShockRatio,
    goldUsdPerOz,
    iranMacroUsdOverride,
    rng,
    dataset,
  } = params;

  const anchorYear = dataset.economy.fxParams.meta.anchorYear;
  if (nextYear <= anchorYear) {
    const row = getHistoricalFxRow(nextYear, dataset);
    const usdRates = {} as Record<CurrencyCode, number>;
    const fairUsdRates = {} as Record<CurrencyCode, number>;
    const cumulativePriceIndices = { ...prevFx.cumulativePriceIndices };

    for (const code of ALL_CURRENCY_CODES) {
      const rate = row.rates[code]?.value ?? prevFx.usdRates[code] ?? 1;
      usdRates[code] = rate;
      fairUsdRates[code] = rate;
      const inf =
        code === 'USD'
          ? globalInflationRate
          : code === 'IRT'
            ? iranInflationRate
            : (countryInflationsByCurrency[code] ?? globalInflationRate);
      cumulativePriceIndices[code] = Math.max(
        0.0001,
        (cumulativePriceIndices[code] ?? 1) * (1 + Math.max(-0.1, inf)),
      );
    }

    if (iranMacroUsdOverride && iranMacroUsdOverride > 0) {
      usdRates.IRT = iranMacroUsdOverride;
      fairUsdRates.IRT = iranMacroUsdOverride;
    }

    const history = [
      ...prevFx.history.slice(-119),
      {
        year: nextYear,
        usdRates: { ...usdRates },
        fairUsdRates: { ...fairUsdRates },
        goldUsdPerOz,
      },
    ];

    return {
      usdRates,
      fairUsdRates,
      cumulativePriceIndices,
      history,
    };
  }

  // Post-1405 stochastic regime/OU model:
  // log s_t = log s_{t-1} + kappa * (log fair_t - log s_{t-1}) + jumps + noise
  const nextPriceIndices = { ...prevFx.cumulativePriceIndices };
  const usdInfl = Math.max(-0.02, globalInflationRate);
  nextPriceIndices.USD = Math.max(0.0001, (nextPriceIndices.USD ?? 1) * (1 + usdInfl));

  const usdRates = { ...prevFx.usdRates, USD: 1 };
  const fairUsdRates = { ...prevFx.fairUsdRates, USD: 1 };

  for (const code of ALL_CURRENCY_CODES) {
    if (code === 'USD') continue;
    const model = dataset.economy.fxParams.usdPairModels[code];
    const currDef = getCurrencyDef(code, dataset);
    const localInf =
      code === 'IRT'
        ? iranInflationRate
        : (countryInflationsByCurrency[code] ?? globalInflationRate);

    nextPriceIndices[code] = Math.max(
      0.0001,
      (nextPriceIndices[code] ?? 1) * (1 + Math.max(-0.1, localInf)),
    );

    const prevRate = Math.max(0.000001, prevFx.usdRates[code] ?? model.anchor1405UnitsPerUsd.value);
    const prevFair = Math.max(0.000001, prevFx.fairUsdRates[code] ?? prevRate);

    // Fair rate tracks cumulative inflation differential vs USD plus structural risk premium
    const infDiff = Math.max(-0.15, localInf - usdInfl);
    const fairFactor = Math.exp(infDiff + model.riskPremiumAnnual.value);
    const fairT =
      code === 'AED'
        ? model.anchor1405UnitsPerUsd.value
        : Math.max(0.000001, prevFair * fairFactor);

    const logPrev = Math.log(prevRate);
    const logFair = Math.log(fairT);
    const kappa = model.kappa.value;
    const jumpTriggered = rng.chance(model.jumpProb.value);
    const jumpTerm = jumpTriggered
      ? model.jumpMeanLog.value + rng.float(-1, 1) * model.jumpStdLog.value
      : 0;
    const noiseTerm = rng.float(-1, 1) * model.noiseStd.value;
    const macroShock =
      currDef.oilBeta.value * oilShockRatio +
      currDef.globalGrowthBeta.value * globalGrowthShockRatio;

    const logNext = logPrev + kappa * (logFair - logPrev) + jumpTerm + noiseTerm + macroShock;
    let nextRate = Math.exp(logNext);
    if (code === 'IRT') {
      nextRate = Math.max(10, Math.round(nextRate));
    } else if (code === 'AED') {
      // AED maintains narrow band around 3.6725 official peg
      nextRate = Number(Math.max(3.66, Math.min(3.69, nextRate)).toFixed(4));
    } else {
      nextRate = Number(Math.max(0.0001, nextRate).toFixed(4));
    }

    fairUsdRates[code] = fairT;
    usdRates[code] = nextRate;
  }

  const history = [
    ...prevFx.history.slice(-119),
    {
      year: nextYear,
      usdRates: { ...usdRates },
      fairUsdRates: { ...fairUsdRates },
      goldUsdPerOz,
    },
  ];

  return {
    usdRates,
    fairUsdRates,
    cumulativePriceIndices: nextPriceIndices,
    history,
  };
}

export function getUsdPairRate(
  state: GameState,
  code: CurrencyCode,
  dataset: GameDataset,
): number {
  if (code === 'USD') return 1;
  if (state.fxState?.usdRates?.[code]) {
    return state.fxState.usdRates[code];
  }
  if (code === 'IRT') {
    const macroUsd = state.flags['macro_usd'];
    if (typeof macroUsd === 'number' && Number.isFinite(macroUsd) && macroUsd > 0) {
      return macroUsd;
    }
  }
  const fx = ensureFxState(state, dataset);
  return fx.usdRates[code] ?? dataset.economy.fxParams.usdPairModels[code].anchor1405UnitsPerUsd.value;
}

/**
 * Strict USD triangulation: cross rate A -> B is (B per USD) / (A per USD)
 */
export function getFxRate(
  state: GameState,
  from: CurrencyCode,
  to: CurrencyCode,
  dataset: GameDataset,
): number {
  if (from === to) return 1;
  const usdFrom = getUsdPairRate(state, from, dataset);
  const usdTo = getUsdPairRate(state, to, dataset);
  return usdTo / Math.max(0.000001, usdFrom);
}

export function getRealExchangeRateAndPppGap(
  state: GameState,
  currencyCode: CurrencyCode,
  dataset: GameDataset,
): {
  spotRatePerUsd: number;
  fairRatePerUsd: number;
  realExchangeIndex: number;
  pppGapPct: number;
  assessmentFa: string;
} {
  const fx = ensureFxState(state, dataset);
  const spotRatePerUsd = getUsdPairRate(state, currencyCode, dataset);
  const fairRatePerUsd = Math.max(0.000001, fx.fairUsdRates[currencyCode] ?? spotRatePerUsd);
  const realExchangeIndex = Number((spotRatePerUsd / fairRatePerUsd).toFixed(3));
  const pppGapPct = Math.round((realExchangeIndex - 1) * 100);

  let assessmentFa = 'نزدیک به تعادل قدرت خرید';
  if (currencyCode === 'USD') {
    assessmentFa = 'ارز مبنای مرجع';
  } else if (pppGapPct >= 12) {
    assessmentFa = 'ارز محلی پایین‌تر از تعادل قدرت خرید (جهش ارزی)';
  } else if (pppGapPct <= -12) {
    assessmentFa = 'ارز محلی بالاتر از تعادل قدرت خرید (ارزان‌تر شدن ارز خارجی)';
  }

  return {
    spotRatePerUsd,
    fairRatePerUsd,
    realExchangeIndex,
    pppGapPct,
    assessmentFa,
  };
}

export interface ConversionQuote {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: number;
  midRate: number;
  effectiveRate: number;
  feeInFromCurrency: number;
  spreadPct: number;
  totalFrictionPct: number;
  netToAmount: number;
}

export function quoteConversion(params: {
  amount: number;
  from: CurrencyCode;
  to: CurrencyCode;
  state: GameState;
  dataset: GameDataset;
  channelId?: TransferChannelDef['id'];
}): ConversionQuote {
  const { amount, from, to, state, dataset, channelId } = params;
  const safeAmount = Math.max(0, amount);
  const midRate = getFxRate(state, from, to, dataset);

  if (from === to) {
    return {
      fromCurrency: from,
      toCurrency: to,
      fromAmount: safeAmount,
      midRate: 1,
      effectiveRate: 1,
      feeInFromCurrency: 0,
      spreadPct: 0,
      totalFrictionPct: 0,
      netToAmount: roundCurrencyAmount(safeAmount, to, dataset),
    };
  }

  const fromModel = dataset.economy.fxParams.usdPairModels[from];
  const toModel = dataset.economy.fxParams.usdPairModels[to];
  const channel = channelId
    ? dataset.economy.fxParams.transferChannels.find((c) => c.id === channelId)
    : undefined;

  const pairSpreadBps = Math.max(fromModel.spreadBps.value, toModel.spreadBps.value);
  const extraSpreadBps = channel ? channel.spreadBps.value : 0;
  const spreadRatio = (pairSpreadBps + extraSpreadBps) / 10_000;

  const baseFeePct = Math.max(fromModel.conversionFeePct.value, toModel.conversionFeePct.value);
  const feePct = channel ? Math.max(baseFeePct, channel.feePct.value) : baseFeePct;

  const feeInFromCurrency = roundCurrencyAmount(safeAmount * feePct, from, dataset);
  const convertibleAfterFee = Math.max(0, safeAmount - feeInFromCurrency);
  const effectiveRate = midRate * (1 - spreadRatio);
  const netToAmount = roundCurrencyAmount(convertibleAfterFee * effectiveRate, to, dataset);

  const totalFrictionPct = Number(((1 - (1 - feePct) * (1 - spreadRatio)) * 100).toFixed(2));

  return {
    fromCurrency: from,
    toCurrency: to,
    fromAmount: safeAmount,
    midRate,
    effectiveRate,
    feeInFromCurrency,
    spreadPct: Number((spreadRatio * 100).toFixed(2)),
    totalFrictionPct,
    netToAmount,
  };
}

export function getDisplayCurrencyCode(
  state: GameState,
  dataset: GameDataset,
  overrideMode?: DisplayCurrencyMode,
): CurrencyCode {
  const mode = overrideMode ?? state.displayCurrencyMode ?? 'local';
  if (mode === 'IRT') return 'IRT';
  if (mode === 'USD') return 'USD';

  const countryId = state.player.countryId;
  if (!countryId || countryId === 'iran') return 'IRT';
  const macro = dataset.countriesMacro.find((c) => c.id === countryId);
  return macro?.currencyCode ?? 'USD';
}

/**
 * Formats an amount in any currency using strictly Persian digits & Persian currency labels (zero Latin chars).
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: CurrencyCode,
  dataset: GameDataset,
  options?: { compact?: boolean; includeUnit?: boolean },
): string {
  const def = getCurrencyDef(currencyCode, dataset);
  const compact = options?.compact ?? false;
  const includeUnit = options?.includeUnit ?? true;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  let numStr = '';
  if (currencyCode === 'IRT') {
    if (compact) {
      if (abs >= 1_000_000_000_000) {
        numStr = `${toPersianDigits((abs / 1_000_000_000_000).toFixed(1).replace(/\.0$/, ''))} همت`;
      } else if (abs >= 1_000_000_000) {
        numStr = `${toPersianDigits((abs / 1_000_000_000).toFixed(1).replace(/\.0$/, ''))} میلیارد`;
      } else if (abs >= 1_000_000) {
        numStr = `${toPersianDigits((abs / 1_000_000).toFixed(1).replace(/\.0$/, ''))} میلیون`;
      } else if (abs >= 1_000) {
        numStr = `${toPersianDigits(Math.round(abs / 1_000).toLocaleString('en-US'))} هزار`;
      } else {
        numStr = toPersianDigits(Math.round(abs).toLocaleString('en-US'));
      }
    } else {
      numStr = toPersianDigits(Math.round(abs).toLocaleString('en-US'));
    }
  } else if (compact && abs >= 1_000_000) {
    numStr = `${toPersianDigits((abs / 1_000_000).toFixed(2).replace(/\.00$/, ''))} میلیون`;
  } else {
    const decimals = abs >= 100 || Number.isInteger(abs) ? 0 : Math.min(2, def.minorUnit);
    const rounded = decimals === 0 ? Math.round(abs) : Number(abs.toFixed(decimals));
    numStr = toPersianDigits(rounded.toLocaleString('en-US'));
  }

  return includeUnit ? `${sign}${numStr} ${def.shortNameFa}` : `${sign}${numStr}`;
}
