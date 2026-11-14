import type { GameDataset } from '../../data/registry';
import {
  ALL_CURRENCY_CODES,
  getCurrencyDef,
  getDisplayCurrencyCode,
  getFxRate,
  quoteConversion,
  roundCurrencyAmount,
} from '../fx';
import type { ConversionQuote } from '../fx';
import { toPersianDigits } from '../jalali';
import type { CurrencyCode, DisplayCurrencyMode, GameState } from '../types';

export interface SingleCurrencyFormatOptions {
  compact?: boolean;
  chipShort?: boolean;
  showSign?: boolean;
  includeUnit?: boolean;
}

export function normalizePersianNumberInput(raw: string): number {
  const persianToLatin = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬,،\s]/g, '')
    .replace(/[٫/]/g, '.');
  const parsed = Number(persianToLatin);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function formatSingleCurrency(
  amount: number,
  currencyCode: CurrencyCode,
  dataset: GameDataset,
  options?: SingleCurrencyFormatOptions,
): string {
  const def = getCurrencyDef(currencyCode, dataset);
  const compact = options?.compact ?? false;
  const chipShort = options?.chipShort ?? false;
  const includeUnit = options?.includeUnit ?? true;
  const showSign = options?.showSign ?? false;

  if (!Number.isFinite(amount)) {
    return includeUnit ? `۰ ${def.shortNameFa}` : '۰';
  }

  const safe = Object.is(amount, -0) ? 0 : amount;
  const sign = safe < 0 ? '−' : showSign && safe > 0 ? '+' : '';
  const abs = Math.abs(safe);

  if (currencyCode === 'IRT') {
    const absRounded = Math.round(abs);
    if (absRounded >= 1_000_000_000_000) {
      const hemt = absRounded / 1_000_000_000_000;
      const formatted =
        hemt >= 100
          ? Math.round(hemt).toString()
          : hemt.toFixed(hemt >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
      return includeUnit
        ? `${sign}${toPersianDigits(formatted)} همت`
        : `${sign}${toPersianDigits(formatted)}`;
    }

    if (absRounded >= 1_000_000_000) {
      const billions = absRounded / 1_000_000_000;
      const formatted =
        billions >= 100
          ? Math.round(billions).toString()
          : billions.toFixed(billions >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
      if (!includeUnit) return `${sign}${toPersianDigits(formatted)}`;
      return `${sign}${toPersianDigits(formatted)} ${chipShort ? 'میلیارد ت' : 'میلیارد تومان'}`;
    }

    if (absRounded >= 1_000_000) {
      const millions = absRounded / 1_000_000;
      const formatted =
        millions >= 100
          ? Math.round(millions).toString()
          : millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
      if (!includeUnit) return `${sign}${toPersianDigits(formatted)}`;
      return `${sign}${toPersianDigits(formatted)} ${chipShort ? 'م.ت' : 'میلیون تومان'}`;
    }

    if (absRounded >= 10_000 || (compact && absRounded >= 1_000)) {
      const thousands = Math.round(absRounded / 1_000);
      if (!includeUnit) return `${sign}${toPersianDigits(thousands.toLocaleString('en-US'))}`;
      return `${sign}${toPersianDigits(thousands.toLocaleString('en-US'))} ${chipShort ? 'ه.ت' : 'هزار تومان'}`;
    }

    if (!includeUnit) return `${sign}${toPersianDigits(absRounded.toLocaleString('en-US'))}`;
    return `${sign}${toPersianDigits(absRounded.toLocaleString('en-US'))} ${chipShort ? 'ت' : 'تومان'}`;
  }

  let numStr = '';
  if ((compact || chipShort) && abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
    numStr = `${toPersianDigits(formatted)} میلیون`;
  } else {
    const decimals = abs >= 100 || Number.isInteger(abs) ? 0 : Math.min(2, def.minorUnit);
    const rounded = decimals === 0 ? Math.round(abs) : Number(abs.toFixed(decimals));
    numStr = toPersianDigits(rounded.toLocaleString('en-US'));
  }

  return includeUnit ? `${sign}${numStr} ${def.shortNameFa}` : `${sign}${numStr}`;
}

export function resolveDualDisplayTarget(
  amountCurrency: CurrencyCode,
  state: GameState,
  dataset: GameDataset,
  primaryOverride?: DisplayCurrencyMode,
): { primaryCurrency: CurrencyCode; equivalentCurrency: CurrencyCode | null } {
  const primaryCurrency = getDisplayCurrencyCode(state, dataset, primaryOverride);
  if (amountCurrency !== primaryCurrency) {
    return { primaryCurrency, equivalentCurrency: primaryCurrency };
  }
  // When living abroad (or viewing in USD mode), amounts in primary currency always carry Toman as secondary
  if (primaryCurrency !== 'IRT') {
    return { primaryCurrency, equivalentCurrency: 'IRT' };
  }
  return { primaryCurrency: 'IRT', equivalentCurrency: null };
}

export interface DualMoneyFormatResult {
  amount: number;
  currencyCode: CurrencyCode;
  currencyNameFa: string;
  currencyShortNameFa: string;
  primaryText: string;
  primaryCompactText: string;
  secondaryText: string | null;
  secondaryCompactText: string | null;
  inlineText: string;
  equivalentAmount: number | null;
  equivalentCurrencyCode: CurrencyCode | null;
  tomanAmount: number;
  midRateToEquivalent: number | null;
  midRateToIrt: number;
  unitConversionQuote: ConversionQuote | null;
  amountConversionQuote: ConversionQuote | null;
  shareOfNetWorthPct: number;
  quoteYear: number;
  isForeignToPrimary: boolean;
}

function estimateRawNetWorthToman(state: GameState, dataset: GameDataset): number {
  let walletsToman = 0;
  if (state.ledger?.wallets?.length) {
    for (const w of state.ledger.wallets) {
      if (w.balance > 0) {
        walletsToman += w.balance * getFxRate(state, w.currencyCode, 'IRT', dataset);
      }
    }
  } else {
    walletsToman = Math.max(0, state.player.moneyToman);
  }
  const assetsToman = state.assets.reduce((s, a) => s + Math.max(0, a.currentValueToman), 0);
  const housingToman = Math.max(
    0,
    (state.player.housing?.propertyValueToman ?? 0) + (state.player.housing?.depositRahnToman ?? 0),
  );
  const businessToman = state.ownedBusiness
    ? Math.max(
        0,
        (state.ownedBusiness.depositLockedToman +
          state.ownedBusiness.equipmentValueToman +
          Math.max(0, state.ownedBusiness.cashReserveToman)) *
          state.ownedBusiness.ownershipShare,
      )
    : 0;
  const debt =
    Math.max(0, state.player.debtToman ?? 0) +
    state.loans.reduce((s, l) => s + Math.max(0, l.principalRemainingToman), 0);
  return Math.max(0, Math.round(walletsToman + assetsToman + housingToman + businessToman - debt));
}

export function formatMoneyDual(
  amount: number,
  currencyCode: CurrencyCode,
  state: GameState,
  dataset: GameDataset,
  options?: {
    compact?: boolean;
    showSign?: boolean;
    primaryOverride?: DisplayCurrencyMode;
    forceHideSecondary?: boolean;
  },
): DualMoneyFormatResult {
  const safeAmount = Number.isFinite(amount) ? (Object.is(amount, -0) ? 0 : amount) : 0;
  const def = getCurrencyDef(currencyCode, dataset);
  const compact = options?.compact ?? false;
  const showSign = options?.showSign ?? false;
  const { primaryCurrency, equivalentCurrency } = resolveDualDisplayTarget(
    currencyCode,
    state,
    dataset,
    options?.primaryOverride,
  );

  const primaryText = formatSingleCurrency(safeAmount, currencyCode, dataset, {
    compact,
    showSign,
  });
  const primaryCompactText = formatSingleCurrency(safeAmount, currencyCode, dataset, {
    compact: true,
    showSign,
  });

  const midRateToIrt = getFxRate(state, currencyCode, 'IRT', dataset);
  const tomanAmount =
    currencyCode === 'IRT'
      ? Math.round(safeAmount)
      : roundCurrencyAmount(safeAmount * midRateToIrt, 'IRT', dataset);

  const targetEqCode = options?.forceHideSecondary ? null : equivalentCurrency;
  let equivalentAmount: number | null = null;
  let secondaryText: string | null = null;
  let secondaryCompactText: string | null = null;
  let midRateToEquivalent: number | null = null;
  let unitConversionQuote: ConversionQuote | null = null;
  let amountConversionQuote: ConversionQuote | null = null;

  if (targetEqCode) {
    midRateToEquivalent = getFxRate(state, currencyCode, targetEqCode, dataset);
    equivalentAmount = roundCurrencyAmount(
      safeAmount * midRateToEquivalent,
      targetEqCode,
      dataset,
    );
    const eqSingle = formatSingleCurrency(Math.abs(equivalentAmount), targetEqCode, dataset, {
      compact: true,
    });
    const eqChip = formatSingleCurrency(Math.abs(equivalentAmount), targetEqCode, dataset, {
      compact: true,
      chipShort: true,
    });
    const signedPrefix = safeAmount < 0 ? '−' : showSign && safeAmount > 0 ? '+' : '';
    secondaryText = safeAmount < 0 ? `≈ −${eqSingle}` : `≈ ${eqSingle}`;
    secondaryCompactText = safeAmount < 0 || (showSign && safeAmount > 0) ? `${signedPrefix}${eqChip}` : `≈ ${eqChip}`;

    unitConversionQuote = quoteConversion({
      amount: 1,
      from: currencyCode,
      to: targetEqCode,
      state,
      dataset,
    });
    amountConversionQuote = quoteConversion({
      amount: Math.abs(safeAmount),
      from: currencyCode,
      to: targetEqCode,
      state,
      dataset,
    });
  }

  const inlineText =
    secondaryCompactText !== null
      ? `${primaryCompactText} (${secondaryCompactText})`
      : primaryCompactText;

  const netWorthToman = estimateRawNetWorthToman(state, dataset);
  const shareOfNetWorthPct =
    netWorthToman > 0
      ? Math.min(999, Math.round((Math.abs(tomanAmount) / netWorthToman) * 100))
      : Math.abs(tomanAmount) > 0
        ? 100
        : 0;

  return {
    amount: safeAmount,
    currencyCode,
    currencyNameFa: def.nameFa,
    currencyShortNameFa: def.shortNameFa,
    primaryText,
    primaryCompactText,
    secondaryText,
    secondaryCompactText,
    inlineText,
    equivalentAmount,
    equivalentCurrencyCode: targetEqCode,
    tomanAmount,
    midRateToEquivalent,
    midRateToIrt,
    unitConversionQuote,
    amountConversionQuote,
    shareOfNetWorthPct,
    quoteYear: state.currentJalaliYear,
    isForeignToPrimary: currencyCode !== primaryCurrency,
  };
}

/**
 * Plain-text dual money formatter for action messages, timeline entries, and disabled tooltips.
 */
export function formatDualMoneyText(
  amount: number,
  currencyCode: CurrencyCode,
  state: GameState,
  dataset: GameDataset,
  options?: { compact?: boolean },
): string {
  const res = formatMoneyDual(amount, currencyCode, state, dataset, {
    compact: options?.compact ?? true,
  });
  if (!res.secondaryText) return res.primaryText;
  return `${res.primaryText} (${res.secondaryText})`;
}

export interface FxTickerItem {
  code: CurrencyCode;
  nameFa: string;
  shortNameFa: string;
  rateIrt: number;
  rateIrtFormatted: string;
  prevRateIrt: number;
  changePct: number;
  direction: 'up' | 'down' | 'flat';
  sparkline: number[];
}

export interface TodayExchangeRatesSummary {
  quoteYear: number;
  featured: FxTickerItem[];
  all: FxTickerItem[];
}

export function getTodayExchangeRatesSummary(
  state: GameState,
  dataset: GameDataset,
  highlightCurrency?: CurrencyCode,
): TodayExchangeRatesSummary {
  const history = state.fxState?.history ?? [];
  const allCodes = ALL_CURRENCY_CODES.filter((c) => c !== 'IRT');

  const buildItem = (code: CurrencyCode): FxTickerItem => {
    const def = getCurrencyDef(code, dataset);
    const rateIrt = getFxRate(state, code, 'IRT', dataset);

    const series: number[] = [];
    for (const h of history.slice(-12)) {
      const irtPerUsd = h.usdRates?.IRT ?? 0;
      const codePerUsd = code === 'USD' ? 1 : (h.usdRates?.[code] ?? 0);
      if (irtPerUsd > 0 && codePerUsd > 0) {
        series.push(Math.round(irtPerUsd / codePerUsd));
      }
    }
    if (series.length === 0) {
      series.push(Math.round(rateIrt));
    }

    const prevRateIrt = series.length >= 2 ? series[series.length - 2] : rateIrt;
    const changePct =
      prevRateIrt > 0 ? Number((((rateIrt - prevRateIrt) / prevRateIrt) * 100).toFixed(1)) : 0;
    const direction: 'up' | 'down' | 'flat' =
      changePct >= 0.4 ? 'up' : changePct <= -0.4 ? 'down' : 'flat';

    return {
      code,
      nameFa: def.nameFa,
      shortNameFa: def.shortNameFa,
      rateIrt: Math.round(rateIrt),
      rateIrtFormatted: formatSingleCurrency(rateIrt, 'IRT', dataset, {
        compact: rateIrt >= 1_000_000,
      }),
      prevRateIrt: Math.round(prevRateIrt),
      changePct,
      direction,
      sparkline: series,
    };
  };

  const all = allCodes.map(buildItem);
  const featuredCodes: CurrencyCode[] = ['EUR', 'TRY', 'USD'];
  if (highlightCurrency && highlightCurrency !== 'IRT' && !featuredCodes.includes(highlightCurrency)) {
    featuredCodes.unshift(highlightCurrency);
  }
  const featured = featuredCodes
    .slice(0, highlightCurrency && !['EUR', 'TRY', 'USD', 'IRT'].includes(highlightCurrency) ? 4 : 3)
    .map((c) => all.find((item) => item.code === c)!)
    .filter(Boolean);

  return {
    quoteYear: state.currentJalaliYear,
    featured,
    all,
  };
}

export type AffordabilityStatus = 'sufficient' | 'tight' | 'shortfall';
export type AffordabilityFixKind = 'convert' | 'sell_asset' | 'loan' | 'cheaper_tier';

export interface AffordabilityReport {
  status: AffordabilityStatus;
  canAffordFromAnyWallet: boolean;
  canAffordDirect: boolean;
  preferredPayFromCurrency: CurrencyCode;
  costToman: number;
  directBalance: number;
  totalLiquidWalletsToman: number;
  shortfallToman: number;
  shortfallInPriceCurrency: number;
  remainingAfterPurchaseToman: number;
  shortLabelFa: string;
  detailFa: string;
  badgeTone: 'emerald' | 'amber' | 'rose';
  fixSuggestions: AffordabilityFixKind[];
}

export function getAffordabilityState(params: {
  amount: number;
  currency: CurrencyCode;
  state: GameState;
  dataset: GameDataset;
  hasCheaperTier?: boolean;
}): AffordabilityReport {
  const { amount, currency, state, dataset, hasCheaperTier } = params;
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const fxToIrt = getFxRate(state, currency, 'IRT', dataset);
  const costToman = Math.round(safeAmount * fxToIrt);

  const wallets = state.ledger?.wallets ?? [
    {
      id: 'wallet_irt_cash',
      currencyCode: 'IRT' as CurrencyCode,
      accountType: 'cash' as const,
      labelFa: 'کیف پول تومانی',
      balance: Math.max(0, state.player.moneyToman),
    },
  ];

  const directBalance = wallets
    .filter((w) => w.currencyCode === currency)
    .reduce((s, w) => s + w.balance, 0);
  const canAffordDirect = directBalance + 1e-6 >= safeAmount;

  // Estimate usable Toman across all liquid wallets (using actual quoteConversion when currency differs)
  const walletUsableInPriceCurrency = new Map<CurrencyCode, number>();
  let totalUsableInPriceCurrency = directBalance;
  let totalLiquidWalletsToman = 0;

  for (const code of ALL_CURRENCY_CODES) {
    const bal = wallets
      .filter((w) => w.currencyCode === code)
      .reduce((s, w) => s + w.balance, 0);
    if (bal <= 0) continue;
    totalLiquidWalletsToman += bal * getFxRate(state, code, 'IRT', dataset);
    if (code === currency) {
      walletUsableInPriceCurrency.set(code, bal);
    } else {
      const q = quoteConversion({
        amount: bal,
        from: code,
        to: currency,
        state,
        dataset,
      });
      walletUsableInPriceCurrency.set(code, q.netToAmount);
      totalUsableInPriceCurrency += q.netToAmount;
    }
  }

  // Pick preferred pay-from wallet: direct if sufficient, otherwise primary living wallet if sufficient, otherwise largest wallet
  const primaryCode = getDisplayCurrencyCode(state, dataset, 'local');
  let preferredPayFromCurrency: CurrencyCode = currency;
  let singleWalletSufficient = canAffordDirect;

  if (!canAffordDirect) {
    const primaryCanCover = (walletUsableInPriceCurrency.get(primaryCode) ?? 0) + 1e-6 >= safeAmount;
    if (primaryCanCover) {
      preferredPayFromCurrency = primaryCode;
      singleWalletSufficient = true;
    } else {
      const irtCanCover = (walletUsableInPriceCurrency.get('IRT') ?? 0) + 1e-6 >= safeAmount;
      if (irtCanCover) {
        preferredPayFromCurrency = 'IRT';
        singleWalletSufficient = true;
      } else {
        // Choose wallet with highest convertible coverage
        let bestCode: CurrencyCode = 'IRT';
        let bestCov = -1;
        for (const [c, cov] of walletUsableInPriceCurrency.entries()) {
          if (cov > bestCov) {
            bestCov = cov;
            bestCode = c;
          }
        }
        preferredPayFromCurrency = bestCode;
        singleWalletSufficient = bestCov + 1e-6 >= safeAmount;
      }
    }
  }

  const canAffordFromAnyWallet = singleWalletSufficient || totalUsableInPriceCurrency + 1e-6 >= safeAmount;
  const shortfallInPriceCurrency = canAffordFromAnyWallet
    ? 0
    : roundCurrencyAmount(Math.max(0, safeAmount - totalUsableInPriceCurrency), currency, dataset);
  const shortfallToman = canAffordFromAnyWallet
    ? 0
    : Math.max(1, Math.round(shortfallInPriceCurrency * fxToIrt));

  // Estimate conversion friction (~4.5% when paying from another wallet)
  const effectiveSpendToman = canAffordDirect ? costToman : Math.round(costToman * 1.045);
  const remainingAfterPurchaseToman = Math.max(
    0,
    Math.round(totalLiquidWalletsToman - effectiveSpendToman),
  );

  // Two-month baseline buffer check
  const monthlyRentToman = Math.max(0, state.player.housing?.monthlyRentToman ?? 0);
  const twoMonthsBufferToman = Math.max(15_000_000, monthlyRentToman * 2);

  if (!canAffordFromAnyWallet) {
    const fixSuggestions: AffordabilityFixKind[] = [];
    const hasInvestments = state.assets.some((a) => a.currentValueToman > 0);
    if (hasInvestments) fixSuggestions.push('sell_asset');
    fixSuggestions.push('loan');
    if (hasCheaperTier) fixSuggestions.push('cheaper_tier');

    const gapText = formatSingleCurrency(shortfallToman, 'IRT', dataset, { compact: true });
    return {
      status: 'shortfall',
      canAffordFromAnyWallet: false,
      canAffordDirect: false,
      preferredPayFromCurrency,
      costToman,
      directBalance,
      totalLiquidWalletsToman: Math.round(totalLiquidWalletsToman),
      shortfallToman,
      shortfallInPriceCurrency,
      remainingAfterPurchaseToman: 0,
      shortLabelFa: `کم‌داری: ≈ ${gapText}`,
      detailFa: `برای این پرداخت حدود ${gapText} کسری نقدینگی داری`,
      badgeTone: 'rose',
      fixSuggestions,
    };
  }

  const preferredDef = getCurrencyDef(preferredPayFromCurrency, dataset);
  const remainingPrimaryText = formatSingleCurrency(remainingAfterPurchaseToman, 'IRT', dataset, {
    compact: true,
  });

  if (
    remainingAfterPurchaseToman < twoMonthsBufferToman ||
    (totalLiquidWalletsToman > 0 && remainingAfterPurchaseToman < totalLiquidWalletsToman * 0.2)
  ) {
    return {
      status: 'tight',
      canAffordFromAnyWallet: true,
      canAffordDirect,
      preferredPayFromCurrency,
      costToman,
      directBalance,
      totalLiquidWalletsToman: Math.round(totalLiquidWalletsToman),
      shortfallToman: 0,
      shortfallInPriceCurrency: 0,
      remainingAfterPurchaseToman,
      shortLabelFa: `بعد از خرید ≈ ${remainingPrimaryText} می‌مونه`,
      detailFa: `قابل پرداخت از کیف ${preferredDef.shortNameFa}، اما حاشیه نقدینگی پایین می‌آید`,
      badgeTone: 'amber',
      fixSuggestions: hasCheaperTier ? ['cheaper_tier'] : ['convert'],
    };
  }

  return {
    status: 'sufficient',
    canAffordFromAnyWallet: true,
    canAffordDirect,
    preferredPayFromCurrency,
    costToman,
    directBalance,
    totalLiquidWalletsToman: Math.round(totalLiquidWalletsToman),
    shortfallToman: 0,
    shortfallInPriceCurrency: 0,
    remainingAfterPurchaseToman,
    shortLabelFa: `از پس‌انداز ${preferredDef.shortNameFa} می‌پردازی`,
    detailFa: `پس از پرداخت حدود ${remainingPrimaryText} ذخیره نقدی باقی می‌ماند`,
    badgeTone: 'emerald',
    fixSuggestions: canAffordDirect ? [] : ['convert'],
  };
}

export interface RateDriftInfo {
  drifted: boolean;
  driftPct: number;
  direction: 'up' | 'down' | 'flat';
  lockedRateIrt: number;
  currentRateIrt: number;
  lockedYear: number;
}

export function checkLockedRateDrift(params: {
  lockedRateIrt?: number;
  lockedYear?: number;
  currencyCode: CurrencyCode;
  state: GameState;
  dataset: GameDataset;
  thresholdRatio?: number;
}): RateDriftInfo | null {
  const { lockedRateIrt, lockedYear, currencyCode, state, dataset, thresholdRatio = 0.05 } = params;
  if (!lockedRateIrt || lockedRateIrt <= 0 || currencyCode === 'IRT') return null;
  const currentRateIrt = getFxRate(state, currencyCode, 'IRT', dataset);
  const ratio = (currentRateIrt - lockedRateIrt) / lockedRateIrt;
  const absRatio = Math.abs(ratio);
  const driftPct = Number((ratio * 100).toFixed(1));
  return {
    drifted: absRatio >= thresholdRatio,
    driftPct,
    direction: ratio > 0.005 ? 'up' : ratio < -0.005 ? 'down' : 'flat',
    lockedRateIrt: Math.round(lockedRateIrt),
    currentRateIrt: Math.round(currentRateIrt),
    lockedYear: lockedYear ?? state.currentJalaliYear,
  };
}
