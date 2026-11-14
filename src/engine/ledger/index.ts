import type { GameDataset } from '../../data/registry';
import { getMinWageMonthlyForState, getMacroRatesForState, calculateNetWorthToman } from '../economy';
import {
  ALL_CURRENCY_CODES,
  getCurrencyDef,
  getDisplayCurrencyCode,
  getFxRate,
  getUsdPairRate,
  quoteConversion,
  roundCurrencyAmount,
} from '../fx';
import { toPersianDigits } from '../jalali';
import type { SeededRNG } from '../rng';
import type {
  ConversionRecord,
  CurrencyCode,
  DisplayCurrencyMode,
  GameState,
  LedgerState,
  LedgerYearSnapshot,
  PendingTransferOrder,
  TransferChannelDef,
  WalletAccountType,
  WalletEntry,
} from '../types';

export function createInitialLedgerState(
  initialToman: number,
  state?: Partial<GameState>,
  dataset?: GameDataset,
): LedgerState {
  const wallets: WalletEntry[] = [
    {
      id: 'wallet_irt_cash',
      currencyCode: 'IRT',
      accountType: 'cash',
      labelFa: 'کیف پول و حساب تومانی',
      balance: Math.max(0, Math.round(initialToman)),
      countryId: 'iran',
    },
  ];
  const snapshots: LedgerYearSnapshot[] = [];
  if (state && dataset && typeof state.currentJalaliYear === 'number') {
    const macro = getMacroRatesForState(state as GameState, dataset);
    const usdRate = macro.usdFree;
    const netWorthToman = Math.max(0, Math.round(initialToman));
    snapshots.push({
      year: state.currentJalaliYear,
      netWorthUsd: Number((netWorthToman / Math.max(1, usdRate)).toFixed(2)),
      netWorthToman,
      usdRateIrt: usdRate,
      goldUsdPerOz:
        dataset.economy.historicalSeries.find((h) => h.year === state.currentJalaliYear)
          ?.globalGoldUSD.value ?? 3850,
      cpiIranRatio: state.inflationMultiplier ?? 1,
      primaryCurrency: 'IRT',
      localCpiRatio: state.inflationMultiplier ?? 1,
    });
  }
  return {
    wallets,
    conversions: [],
    pendingTransfers: [],
    yearSnapshots: snapshots,
  };
}

export function ensureLedgerState(state: GameState, dataset?: GameDataset): LedgerState {
  if (state.ledger && Array.isArray(state.ledger.wallets) && state.ledger.wallets.length > 0) {
    return state.ledger;
  }
  return createInitialLedgerState(state.player.moneyToman, state, dataset);
}

/**
 * If external/test code assigned state.player.moneyToman directly before calling an action or reducer,
 * synchronize wallet_irt_cash up or down to match player.moneyToman cleanly before applying new deltas.
 */
export function adoptExternalMoneyTomanOverride(
  state: GameState,
  dataset?: GameDataset,
): void {
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;
  let irtMain = ledger.wallets.find((w) => w.id === 'wallet_irt_cash');
  if (!irtMain) {
    irtMain = {
      id: 'wallet_irt_cash',
      currencyCode: 'IRT',
      accountType: 'cash',
      labelFa: 'کیف پول و حساب تومانی',
      balance: Math.max(0, Math.round(state.player.moneyToman)),
      countryId: 'iran',
    };
    ledger.wallets.unshift(irtMain);
    return;
  }
  const otherIrt = ledger.wallets
    .filter((w) => w.currencyCode === 'IRT' && w.id !== 'wallet_irt_cash')
    .reduce((s, w) => s + w.balance, 0);
  const currentTotalIrt = Math.round(irtMain.balance + otherIrt);
  const targetIrt = Math.max(0, Math.round(state.player.moneyToman));
  if (currentTotalIrt !== targetIrt) {
    irtMain.balance = Math.max(0, Math.round(targetIrt - otherIrt));
  }
}

/**
 * Reconciles legacy mutations made directly on draft.player.moneyToman into wallet_irt_cash.
 */
export function reconcileLegacyMoneyDelta(
  state: GameState,
  moneyBeforeMutation: number,
  dataset?: GameDataset,
): void {
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;
  let irtMain = ledger.wallets.find((w) => w.id === 'wallet_irt_cash');
  if (!irtMain) {
    irtMain = {
      id: 'wallet_irt_cash',
      currencyCode: 'IRT',
      accountType: 'cash',
      labelFa: 'کیف پول و حساب تومانی',
      balance: Math.max(0, Math.round(moneyBeforeMutation)),
      countryId: 'iran',
    };
    ledger.wallets.unshift(irtMain);
  }
  const delta = Math.round(state.player.moneyToman - moneyBeforeMutation);
  if (delta !== 0) {
    const otherIrt = ledger.wallets
      .filter((w) => w.currencyCode === 'IRT' && w.id !== 'wallet_irt_cash')
      .reduce((s, w) => s + w.balance, 0);
    // If moneyBefore was sum of IRT wallets, update main wallet cleanly
    irtMain.balance = Math.max(0, Math.round(irtMain.balance + delta));
    state.player.moneyToman = Math.max(0, Math.round(irtMain.balance + otherIrt));
  }
}

export function syncMoneyTomanMirror(state: GameState, dataset?: GameDataset): void {
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;
  const totalIrt = ledger.wallets
    .filter((w) => w.currencyCode === 'IRT')
    .reduce((sum, w) => sum + w.balance, 0);
  state.player.moneyToman = Math.max(0, Math.round(totalIrt));
}

export function getWalletBalance(state: GameState, currencyCode: CurrencyCode): number {
  if (!state.ledger) {
    return currencyCode === 'IRT' ? Math.max(0, state.player.moneyToman) : 0;
  }
  return state.ledger.wallets
    .filter((w) => w.currencyCode === currencyCode)
    .reduce((sum, w) => sum + w.balance, 0);
}

export function creditWallet(params: {
  state: GameState;
  currencyCode: CurrencyCode;
  amount: number;
  dataset: GameDataset;
  accountType?: WalletAccountType;
  labelFa?: string;
  countryId?: string;
}): void {
  const { state, currencyCode, amount, dataset, accountType = 'foreign', labelFa, countryId } = params;
  if (amount <= 0 || !Number.isFinite(amount)) return;
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;

  let wallet =
    currencyCode === 'IRT'
      ? ledger.wallets.find((w) => w.id === 'wallet_irt_cash')
      : ledger.wallets.find((w) => w.currencyCode === currencyCode && w.accountType === accountType) ??
        ledger.wallets.find((w) => w.currencyCode === currencyCode);

  if (!wallet) {
    const cDef = getCurrencyDef(currencyCode, dataset);
    wallet = {
      id: `wallet_${currencyCode.toLowerCase()}_${ledger.wallets.length + 1}`,
      currencyCode,
      accountType: currencyCode === 'IRT' ? 'cash' : accountType,
      labelFa: labelFa ?? `حساب ${cDef.nameFa}`,
      balance: 0,
      countryId,
    };
    ledger.wallets.push(wallet);
  }
  wallet.balance = roundCurrencyAmount(wallet.balance + amount, currencyCode, dataset);
  syncMoneyTomanMirror(state, dataset);
}

export function debitWallet(params: {
  state: GameState;
  currencyCode: CurrencyCode;
  amount: number;
  dataset: GameDataset;
}): boolean {
  const { state, currencyCode, amount, dataset } = params;
  if (amount <= 0) return true;
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;
  const available = getWalletBalance(state, currencyCode);
  if (available + 1e-6 < amount) {
    return false;
  }
  let remaining = amount;
  for (const wallet of ledger.wallets) {
    if (wallet.currencyCode !== currencyCode || wallet.balance <= 0) continue;
    const take = Math.min(wallet.balance, remaining);
    wallet.balance = roundCurrencyAmount(Math.max(0, wallet.balance - take), currencyCode, dataset);
    remaining -= take;
    if (remaining <= 1e-6) break;
  }
  syncMoneyTomanMirror(state, dataset);
  return true;
}

export function getPrimaryLivingCurrency(state: GameState, dataset: GameDataset): CurrencyCode {
  if (state.player.countryId === 'iran') return 'IRT';
  return (
    dataset.countriesMacro.find((c) => c.id === state.player.countryId)?.currencyCode ?? 'USD'
  );
}

export interface PayFromQuote {
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  targetAmount: number;
  sourceRequired: number;
  feeInSource: number;
  spreadPct: number;
  midRateSourceToTarget: number;
  effectiveRateSourceToTarget: number;
  netConvertedTargetAmount: number;
  sourceBalanceBefore: number;
  sourceBalanceAfter: number;
  targetBalanceBefore: number;
  targetBalanceAfter: number;
  canAfford: boolean;
}

/**
 * Exact minimal sourceAmount solver such that quoteConversion(sourceAmount) produces >= targetAmount.
 * Single source of truth for both pre-payment confirmation UI and actual execution debit.
 */
export function quotePayFromWallet(params: {
  targetAmount: number;
  targetCurrency: CurrencyCode;
  sourceCurrency: CurrencyCode;
  state: GameState;
  dataset: GameDataset;
  channelId?: TransferChannelDef['id'];
}): PayFromQuote {
  const { targetAmount, targetCurrency, sourceCurrency, state, dataset, channelId } = params;
  const safeTarget = Math.max(0, roundCurrencyAmount(targetAmount, targetCurrency, dataset));
  const sourceBalanceBefore = getWalletBalance(state, sourceCurrency);
  const targetBalanceBefore = getWalletBalance(state, targetCurrency);

  if (safeTarget <= 0) {
    return {
      sourceCurrency,
      targetCurrency,
      targetAmount: 0,
      sourceRequired: 0,
      feeInSource: 0,
      spreadPct: 0,
      midRateSourceToTarget: sourceCurrency === targetCurrency ? 1 : getFxRate(state, sourceCurrency, targetCurrency, dataset),
      effectiveRateSourceToTarget: 1,
      netConvertedTargetAmount: 0,
      sourceBalanceBefore,
      sourceBalanceAfter: sourceBalanceBefore,
      targetBalanceBefore,
      targetBalanceAfter: targetBalanceBefore,
      canAfford: true,
    };
  }

  if (sourceCurrency === targetCurrency) {
    const canAfford = sourceBalanceBefore + 1e-6 >= safeTarget;
    return {
      sourceCurrency,
      targetCurrency,
      targetAmount: safeTarget,
      sourceRequired: safeTarget,
      feeInSource: 0,
      spreadPct: 0,
      midRateSourceToTarget: 1,
      effectiveRateSourceToTarget: 1,
      netConvertedTargetAmount: safeTarget,
      sourceBalanceBefore,
      sourceBalanceAfter: roundCurrencyAmount(Math.max(0, sourceBalanceBefore - safeTarget), sourceCurrency, dataset),
      targetBalanceBefore,
      targetBalanceAfter: roundCurrencyAmount(Math.max(0, targetBalanceBefore - safeTarget), targetCurrency, dataset),
      canAfford,
    };
  }

  const def = getCurrencyDef(sourceCurrency, dataset);
  const stepUnit = Math.pow(10, -def.minorUnit);
  const midRate = getFxRate(state, sourceCurrency, targetCurrency, dataset);

  const fromModel = dataset.economy.fxParams.usdPairModels[sourceCurrency];
  const toModel = dataset.economy.fxParams.usdPairModels[targetCurrency];
  const channel = channelId
    ? dataset.economy.fxParams.transferChannels.find((c) => c.id === channelId)
    : undefined;
  const spreadRatio =
    (Math.max(fromModel.spreadBps.value, toModel.spreadBps.value) + (channel ? channel.spreadBps.value : 0)) /
    10_000;
  const baseFeePct = Math.max(fromModel.conversionFeePct.value, toModel.conversionFeePct.value);
  const feePct = channel ? Math.max(baseFeePct, channel.feePct.value) : baseFeePct;

  const analyticalGuess =
    safeTarget / Math.max(1e-9, midRate * (1 - spreadRatio) * (1 - feePct));

  let low = Math.max(0, roundCurrencyAmount(analyticalGuess * 0.9, sourceCurrency, dataset) - stepUnit * 10);
  let high = Math.max(
    stepUnit,
    roundCurrencyAmount(analyticalGuess * 1.1 + stepUnit * 20, sourceCurrency, dataset),
  );

  while (
    quoteConversion({ amount: high, from: sourceCurrency, to: targetCurrency, state, dataset, channelId })
      .netToAmount +
      1e-6 <
    safeTarget
  ) {
    high = roundCurrencyAmount(high * 1.5 + stepUnit * 10, sourceCurrency, dataset);
    if (high > 1e16) break;
  }

  // Binary search in discrete minor-unit steps for minimal sourceRequired where netToAmount >= safeTarget
  const factor = Math.pow(10, def.minorUnit);
  let loInt = Math.max(0, Math.floor(low * factor));
  let hiInt = Math.ceil(high * factor);
  while (loInt < hiInt) {
    const midInt = Math.floor((loInt + hiInt) / 2);
    const candidate = midInt / factor;
    const q = quoteConversion({
      amount: candidate,
      from: sourceCurrency,
      to: targetCurrency,
      state,
      dataset,
      channelId,
    });
    if (q.netToAmount + 1e-6 >= safeTarget) {
      hiInt = midInt;
    } else {
      loInt = midInt + 1;
    }
  }

  const sourceRequired = loInt / factor;
  const finalQuote = quoteConversion({
    amount: sourceRequired,
    from: sourceCurrency,
    to: targetCurrency,
    state,
    dataset,
    channelId,
  });

  const canAfford = sourceBalanceBefore + 1e-6 >= sourceRequired;
  const leftoverInTarget = Math.max(0, finalQuote.netToAmount - safeTarget);

  return {
    sourceCurrency,
    targetCurrency,
    targetAmount: safeTarget,
    sourceRequired,
    feeInSource: finalQuote.feeInFromCurrency,
    spreadPct: finalQuote.spreadPct,
    midRateSourceToTarget: finalQuote.midRate,
    effectiveRateSourceToTarget: finalQuote.effectiveRate,
    netConvertedTargetAmount: finalQuote.netToAmount,
    sourceBalanceBefore,
    sourceBalanceAfter: roundCurrencyAmount(
      Math.max(0, sourceBalanceBefore - sourceRequired),
      sourceCurrency,
      dataset,
    ),
    targetBalanceBefore,
    targetBalanceAfter: roundCurrencyAmount(targetBalanceBefore + leftoverInTarget, targetCurrency, dataset),
    canAfford,
  };
}

/**
 * Pays a cost from a specific user-chosen wallet. If sourceCurrency !== targetCurrency,
 * performs the exact conversion quoted by quotePayFromWallet and debits targetAmount.
 */
export function payFromSpecificWallet(params: {
  state: GameState;
  targetAmount: number;
  targetCurrency: CurrencyCode;
  sourceCurrency: CurrencyCode;
  dataset: GameDataset;
  channelId?: TransferChannelDef['id'];
  noteFa?: string;
}): { ok: boolean; errorFa?: string; quote: PayFromQuote } {
  const { state, targetAmount, targetCurrency, sourceCurrency, dataset, channelId, noteFa } = params;
  const quote = quotePayFromWallet({
    targetAmount,
    targetCurrency,
    sourceCurrency,
    state,
    dataset,
    channelId,
  });

  if (quote.targetAmount <= 0) {
    return { ok: true, quote };
  }
  if (!quote.canAfford) {
    return { ok: false, errorFa: 'موجودی کیف پول انتخاب‌شده کافی نیست.', quote };
  }

  if (sourceCurrency === targetCurrency) {
    const ok = debitWallet({
      state,
      currencyCode: targetCurrency,
      amount: quote.targetAmount,
      dataset,
    });
    return { ok, quote };
  }

  const conv = executeCurrencyConversion({
    state,
    fromCurrency: sourceCurrency,
    toCurrency: targetCurrency,
    fromAmount: quote.sourceRequired,
    channelId,
    noteFa: noteFa ?? 'تبدیل خودکار برای پرداخت هزینه',
    dataset,
  });
  if (!conv.ok) {
    return { ok: false, errorFa: conv.errorFa, quote };
  }
  const debited = debitWallet({
    state,
    currencyCode: targetCurrency,
    amount: quote.targetAmount,
    dataset,
  });
  return { ok: debited, quote };
}

/**
 * Pays an expense in the destination currency first; if insufficient, converts from the specified or fallback wallet with exact quote.
 */
export function payInCurrencyOrConvert(params: {
  state: GameState;
  currencyCode: CurrencyCode;
  amount: number;
  dataset: GameDataset;
  preferredSourceCurrency?: CurrencyCode;
  channelId?: TransferChannelDef['id'];
}): { ok: boolean; convertedFrom?: CurrencyCode; feePaid?: number } {
  const { state, currencyCode, amount, dataset, preferredSourceCurrency, channelId } = params;
  if (amount <= 0) return { ok: true };

  if (preferredSourceCurrency) {
    const res = payFromSpecificWallet({
      state,
      targetAmount: amount,
      targetCurrency: currencyCode,
      sourceCurrency: preferredSourceCurrency,
      dataset,
      channelId,
    });
    if (res.ok) {
      return {
        ok: true,
        convertedFrom: preferredSourceCurrency !== currencyCode ? preferredSourceCurrency : undefined,
        feePaid: res.quote.feeInSource,
      };
    }
    return { ok: false };
  }

  if (debitWallet({ state, currencyCode, amount, dataset })) {
    return { ok: true };
  }

  const directBalance = getWalletBalance(state, currencyCode);
  const shortfall = roundCurrencyAmount(Math.max(0, amount - directBalance), currencyCode, dataset);
  const fallbackOrder: CurrencyCode[] = ['USD', 'IRT', 'EUR', 'GBP', 'CAD', 'AED', 'TRY'].filter(
    (c): c is CurrencyCode => c !== currencyCode,
  );

  for (const src of fallbackOrder) {
    const q = quotePayFromWallet({
      targetAmount: shortfall,
      targetCurrency: currencyCode,
      sourceCurrency: src,
      state,
      dataset,
      channelId,
    });
    if (q.canAfford && q.sourceRequired > 0) {
      const conv = executeCurrencyConversion({
        state,
        fromCurrency: src,
        toCurrency: currencyCode,
        fromAmount: q.sourceRequired,
        channelId,
        noteFa: 'تبدیل خودکار برای پرداخت هزینه',
        dataset,
      });
      if (conv.ok && debitWallet({ state, currencyCode, amount, dataset })) {
        return { ok: true, convertedFrom: src, feePaid: conv.feeInFromCurrency };
      }
    }
  }
  return { ok: false };
}

export function executeCurrencyConversion(params: {
  state: GameState;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: number;
  channelId?: TransferChannelDef['id'];
  noteFa?: string;
  dataset: GameDataset;
}): { ok: boolean; errorFa?: string; toAmount: number; feeInFromCurrency: number } {
  const { state, fromCurrency, toCurrency, fromAmount, channelId, noteFa, dataset } = params;
  if (fromCurrency === toCurrency) {
    return { ok: false, errorFa: 'ارز مبدأ و مقصد نباید یکسان باشد.', toAmount: 0, feeInFromCurrency: 0 };
  }
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
    return { ok: false, errorFa: 'مبلغ تبدیل باید بزرگ‌تر از صفر باشد.', toAmount: 0, feeInFromCurrency: 0 };
  }
  const available = getWalletBalance(state, fromCurrency);
  if (available + 1e-6 < fromAmount) {
    return { ok: false, errorFa: 'موجودی کیف پول مبدأ کافی نیست.', toAmount: 0, feeInFromCurrency: 0 };
  }

  const quote = quoteConversion({
    amount: fromAmount,
    from: fromCurrency,
    to: toCurrency,
    state,
    dataset,
    channelId,
  });
  if (quote.netToAmount <= 0) {
    return { ok: false, errorFa: 'پس از کسر کارمزد مبلغ خالص بسیار ناچیز است.', toAmount: 0, feeInFromCurrency: 0 };
  }

  debitWallet({ state, currencyCode: fromCurrency, amount: fromAmount, dataset });
  creditWallet({ state, currencyCode: toCurrency, amount: quote.netToAmount, dataset });

  const ledger = ensureLedgerState(state, dataset);
  const record: ConversionRecord = {
    id: `conv_${state.turn}_${ledger.conversions.length + 1}`,
    turn: state.turn,
    jalaliYear: state.currentJalaliYear,
    fromCurrency,
    toCurrency,
    fromAmount: roundCurrencyAmount(fromAmount, fromCurrency, dataset),
    toAmount: quote.netToAmount,
    effectiveRate: quote.effectiveRate,
    feeInFromCurrency: quote.feeInFromCurrency,
    channelId,
    noteFa: noteFa ?? 'تبدیل ارزی در کیف پول',
  };
  ledger.conversions = [...ledger.conversions.slice(-24), record];

  return {
    ok: true,
    toAmount: quote.netToAmount,
    feeInFromCurrency: quote.feeInFromCurrency,
  };
}

export function submitCrossBorderTransfer(params: {
  state: GameState;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: number;
  channelId: TransferChannelDef['id'];
  purposeFa: string;
  rng: SeededRNG;
  dataset: GameDataset;
}): {
  ok: boolean;
  errorFa?: string;
  delayed: boolean;
  receivedAmount: number;
  feeInFromCurrency: number;
} {
  const { state, fromCurrency, toCurrency, fromAmount, channelId, purposeFa, rng, dataset } = params;
  const channel = dataset.economy.fxParams.transferChannels.find((c) => c.id === channelId);
  if (!channel) {
    return { ok: false, errorFa: 'مسیر انتقال یافت نشد.', delayed: false, receivedAmount: 0, feeInFromCurrency: 0 };
  }

  const usdAmount = fromAmount * getFxRate(state, fromCurrency, 'USD', dataset);
  if (usdAmount < channel.minAmountUsd.value) {
    return {
      ok: false,
      errorFa: `حداقل مبلغ مجاز این مسیر معادل ${toPersianDigits(channel.minAmountUsd.value.toLocaleString('en-US'))} دلار است.`,
      delayed: false,
      receivedAmount: 0,
      feeInFromCurrency: 0,
    };
  }
  if (usdAmount > channel.maxAmountUsd.value) {
    return {
      ok: false,
      errorFa: `سقف مجاز این مسیر در هر تراکنش معادل ${toPersianDigits(channel.maxAmountUsd.value.toLocaleString('en-US'))} دلار است.`,
      delayed: false,
      receivedAmount: 0,
      feeInFromCurrency: 0,
    };
  }

  const available = getWalletBalance(state, fromCurrency);
  if (available + 1e-6 < fromAmount) {
    return { ok: false, errorFa: 'موجودی کیف پول مبدأ کافی نیست.', delayed: false, receivedAmount: 0, feeInFromCurrency: 0 };
  }

  const quote = quoteConversion({
    amount: fromAmount,
    from: fromCurrency,
    to: toCurrency,
    state,
    dataset,
    channelId,
  });

  if (channel.delayTurns.value <= 0) {
    // Immediate execution with failure risk -> refund minus half fee if failed
    debitWallet({ state, currencyCode: fromCurrency, amount: fromAmount, dataset });
    if (rng.chance(channel.failureRisk.value)) {
      const partialFee = roundCurrencyAmount(quote.feeInFromCurrency * 0.4, fromCurrency, dataset);
      creditWallet({
        state,
        currencyCode: fromCurrency,
        amount: Math.max(0, fromAmount - partialFee),
        dataset,
      });
      return {
        ok: false,
        errorFa: 'انتقال در پردازش برگشت خورد و مبلغ پس از کسر هزینه اداری به حساب مبدأ بازگشت.',
        delayed: false,
        receivedAmount: 0,
        feeInFromCurrency: partialFee,
      };
    }

    creditWallet({ state, currencyCode: toCurrency, amount: quote.netToAmount, dataset });
    const ledger = ensureLedgerState(state, dataset);
    ledger.conversions = [
      ...ledger.conversions.slice(-24),
      {
        id: `conv_${state.turn}_${ledger.conversions.length + 1}`,
        turn: state.turn,
        jalaliYear: state.currentJalaliYear,
        fromCurrency,
        toCurrency,
        fromAmount,
        toAmount: quote.netToAmount,
        effectiveRate: quote.effectiveRate,
        feeInFromCurrency: quote.feeInFromCurrency,
        channelId,
        noteFa: purposeFa,
      },
    ];
    return {
      ok: true,
      delayed: false,
      receivedAmount: quote.netToAmount,
      feeInFromCurrency: quote.feeInFromCurrency,
    };
  }

  // Delayed order settled on next yearAdvance
  debitWallet({ state, currencyCode: fromCurrency, amount: fromAmount, dataset });
  const ledger = ensureLedgerState(state, dataset);
  const order: PendingTransferOrder = {
    id: `tr_${state.turn}_${ledger.pendingTransfers.length + 1}`,
    createdTurn: state.turn,
    executeAtTurn: state.turn + Math.round(channel.delayTurns.value),
    channelId,
    fromCurrency,
    toCurrency,
    fromAmount,
    expectedToAmount: quote.netToAmount,
    feeInFromCurrency: quote.feeInFromCurrency,
    failureRisk: channel.failureRisk.value,
    purposeFa,
  };
  ledger.pendingTransfers.push(order);

  return {
    ok: true,
    delayed: true,
    receivedAmount: quote.netToAmount,
    feeInFromCurrency: quote.feeInFromCurrency,
  };
}

export function resolvePendingTransfersOnYearAdvance(
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): string[] {
  const ledger = ensureLedgerState(state, dataset);
  const notes: string[] = [];
  const stillPending: PendingTransferOrder[] = [];

  for (const order of ledger.pendingTransfers) {
    if (state.turn < order.executeAtTurn) {
      stillPending.push(order);
      continue;
    }
    if (rng.chance(order.failureRisk)) {
      const refunded = Math.max(0, order.fromAmount - order.feeInFromCurrency * 0.35);
      creditWallet({
        state,
        currencyCode: order.fromCurrency,
        amount: refunded,
        dataset,
      });
      notes.push(`حواله «${order.purposeFa}» برگشت خورد و پس از کسر هزینه بانکی به حساب مبدأ بازگشت.`);
    } else {
      creditWallet({
        state,
        currencyCode: order.toCurrency,
        amount: order.expectedToAmount,
        dataset,
      });
      ledger.conversions = [
        ...ledger.conversions.slice(-24),
        {
          id: `conv_settled_${state.turn}_${ledger.conversions.length + 1}`,
          turn: state.turn,
          jalaliYear: state.currentJalaliYear,
          fromCurrency: order.fromCurrency,
          toCurrency: order.toCurrency,
          fromAmount: order.fromAmount,
          toAmount: order.expectedToAmount,
          effectiveRate: order.expectedToAmount / Math.max(0.0001, order.fromAmount),
          feeInFromCurrency: order.feeInFromCurrency,
          channelId: order.channelId,
          noteFa: order.purposeFa,
        },
      ];
      notes.push(`حواله «${order.purposeFa}» با موفقیت به حساب ارزی مقصد نشست.`);
    }
  }

  ledger.pendingTransfers = stillPending;
  return notes;
}

export interface NetWorthSummary {
  displayCurrency: CurrencyCode;
  displayAmount: number;
  tomanAmount: number;
  usdAmount: number;
  localMinWageMonths: number;
  purchasingPowerHintFa: string;
}

export function getTotalAssetsAndLiabilitiesInToman(state: GameState, dataset: GameDataset): {
  walletsToman: number;
  financialAssetsToman: number;
  housingToman: number;
  businessToman: number;
  liabilitiesToman: number;
  netToman: number;
} {
  const ledger = ensureLedgerState(state, dataset);
  let walletsToman = 0;
  for (const w of ledger.wallets) {
    if (w.balance <= 0) continue;
    walletsToman += w.balance * getFxRate(state, w.currencyCode, 'IRT', dataset);
  }
  const financialAssetsToman = state.assets.reduce((s, a) => s + a.currentValueToman, 0);

  // If abroad property flag/currency is set, housing.propertyValueToman is stored in Toman or converted via local currency; keep propertyValueToman synced in IRT for unified valuation + expose local property valuation when abroad
  const housingToman = state.player.housing.propertyValueToman + state.player.housing.depositRahnToman;
  const businessToman = state.ownedBusiness
    ? (state.ownedBusiness.depositLockedToman +
        state.ownedBusiness.equipmentValueToman +
        Math.max(0, state.ownedBusiness.cashReserveToman)) *
      state.ownedBusiness.ownershipShare
    : 0;
  const liabilitiesToman =
    state.player.debtToman +
    state.loans.reduce((s, l) => s + l.principalRemainingToman, 0);

  const netToman = Math.round(
    walletsToman + financialAssetsToman + housingToman + businessToman - liabilitiesToman,
  );
  return {
    walletsToman: Math.round(walletsToman),
    financialAssetsToman: Math.round(financialAssetsToman),
    housingToman: Math.round(housingToman),
    businessToman: Math.round(businessToman),
    liabilitiesToman: Math.round(liabilitiesToman),
    netToman,
  };
}

export function getLedgerNetWorth(
  state: GameState,
  dataset: GameDataset,
  overrideMode?: DisplayCurrencyMode,
): NetWorthSummary {
  const displayCurrency = getDisplayCurrencyCode(state, dataset, overrideMode);
  const totals = getTotalAssetsAndLiabilitiesInToman(state, dataset);
  // Keep consistency if state.ledger is not yet populated in legacy callers
  const netToman = state.ledger ? totals.netToman : calculateNetWorthToman(state);
  const usdRate = getUsdPairRate(state, 'IRT', dataset);
  const usdAmount = Number((netToman / Math.max(1, usdRate)).toFixed(2));
  const displayAmount = roundCurrencyAmount(
    netToman * getFxRate(state, 'IRT', displayCurrency, dataset),
    displayCurrency,
    dataset,
  );

  let localMinWageMonthlyInToman = getMinWageMonthlyForState(state, dataset);
  if (state.player.countryId !== 'iran') {
    const cm = dataset.countriesMacro.find((c) => c.id === state.player.countryId);
    const runtime = state.countryMacros?.[state.player.countryId];
    if (cm) {
      const localMin = runtime?.minWageMonthlyLocal ?? cm.macro.minWageMonthlyLocal.value;
      localMinWageMonthlyInToman = localMin * getFxRate(state, cm.currencyCode, 'IRT', dataset);
    }
  }
  const localMinWageMonths = Number(
    (Math.max(0, netToman) / Math.max(1, localMinWageMonthlyInToman)).toFixed(1),
  );
  const purchasingPowerHintFa = `معادل ${toPersianDigits(localMinWageMonths.toLocaleString('en-US'))} ماه حقوق حداقل محلی`;

  return {
    displayCurrency,
    displayAmount,
    tomanAmount: netToman,
    usdAmount,
    localMinWageMonths,
    purchasingPowerHintFa,
  };
}

export interface CurrencyExposureSlice {
  currencyCode: CurrencyCode;
  nameFa: string;
  shortNameFa: string;
  nativeAmount: number;
  tomanEquivalent: number;
  usdEquivalent: number;
  sharePct: number;
  highInflationRisk: boolean;
  colorHex: string;
}

const CURRENCY_COLORS: Record<CurrencyCode, string> = {
  IRT: '#F59E0B',
  USD: '#10B981',
  TRY: '#EF4444',
  EUR: '#3B82F6',
  GBP: '#8B5CF6',
  CAD: '#EC4899',
  AED: '#0EA5E9',
};

export function getCurrencyExposureBreakdown(
  state: GameState,
  dataset: GameDataset,
): CurrencyExposureSlice[] {
  const ledger = ensureLedgerState(state, dataset);
  const byCurrency = new Map<CurrencyCode, { native: number; toman: number }>();

  const add = (code: CurrencyCode, nativeDelta: number, tomanDelta: number) => {
    const prev = byCurrency.get(code) ?? { native: 0, toman: 0 };
    byCurrency.set(code, {
      native: prev.native + nativeDelta,
      toman: prev.toman + tomanDelta,
    });
  };

  for (const w of ledger.wallets) {
    if (w.balance <= 0) continue;
    const tomanEq = w.balance * getFxRate(state, w.currencyCode, 'IRT', dataset);
    add(w.currencyCode, w.balance, tomanEq);
  }

  for (const asset of state.assets) {
    if (asset.currentValueToman <= 0) continue;
    if (asset.type === 'usd') {
      const usdAmt = asset.currentValueToman / Math.max(1, getUsdPairRate(state, 'IRT', dataset));
      add('USD', usdAmt, asset.currentValueToman);
    } else if (asset.type === 'crypto') {
      const usdAmt = asset.currentValueToman / Math.max(1, getUsdPairRate(state, 'IRT', dataset));
      add('USD', usdAmt, asset.currentValueToman);
    } else {
      add('IRT', asset.currentValueToman, asset.currentValueToman);
    }
  }

  const totalToman = Array.from(byCurrency.values()).reduce((s, v) => s + v.toman, 0);
  if (totalToman <= 0) return [];

  const slices: CurrencyExposureSlice[] = [];
  for (const code of ALL_CURRENCY_CODES) {
    const entry = byCurrency.get(code);
    if (!entry || entry.toman <= 0) continue;
    const def = getCurrencyDef(code, dataset);
    slices.push({
      currencyCode: code,
      nameFa: def.nameFa,
      shortNameFa: def.shortNameFa,
      nativeAmount: roundCurrencyAmount(entry.native, code, dataset),
      tomanEquivalent: Math.round(entry.toman),
      usdEquivalent: Number((entry.toman / Math.max(1, getUsdPairRate(state, 'IRT', dataset))).toFixed(1)),
      sharePct: Math.round((entry.toman / totalToman) * 100),
      highInflationRisk: def.highInflationRisk,
      colorHex: CURRENCY_COLORS[code],
    });
  }

  return slices.sort((a, b) => b.tomanEquivalent - a.tomanEquivalent);
}

export function getSavingsErosionWarnings(
  state: GameState,
  dataset: GameDataset,
): { currencyCode: CurrencyCode; titleFa: string; bodyFa: string; annualRealLossPct: number }[] {
  const exposure = getCurrencyExposureBreakdown(state, dataset);
  const warnings: {
    currencyCode: CurrencyCode;
    titleFa: string;
    bodyFa: string;
    annualRealLossPct: number;
  }[] = [];

  for (const slice of exposure) {
    if (!slice.highInflationRisk || slice.sharePct < 20) continue;
    const def = getCurrencyDef(slice.currencyCode, dataset);
    const inf =
      slice.currencyCode === 'IRT'
        ? state.lastInflationRate
        : (state.countryMacros?.turkey?.lastInflationRate ??
            dataset.countriesMacro.find((c) => c.currencyCode === slice.currencyCode)?.macro
              .inflationRate.value ??
            0.28);
    const carry = def.annualCarryRate.value;
    const netRealLoss = inf - carry;
    if (netRealLoss > 0.05) {
      const pct = Math.round(netRealLoss * 100);
      warnings.push({
        currencyCode: slice.currencyCode,
        titleFa: `فرسایش قدرت خرید در ${slice.shortNameFa}`,
        bodyFa: `${toPersianDigits(slice.sharePct)}٪ از نقدینگی تو در ${slice.nameFa} با تورم سالانه بالاتر از سود سپرده است (افت واقعی حدود ${toPersianDigits(pct)}٪ در سال).`,
        annualRealLossPct: pct,
      });
    }
  }

  return warnings;
}

export function getAnnualRealPerformanceAndBenchmarks(
  state: GameState,
  dataset: GameDataset,
): {
  hasComparison: boolean;
  nominalReturnPct: number;
  realReturnPct: number;
  vsUsdBenchmarkPct: number;
  vsGoldBenchmarkPct: number;
  summaryFa: string;
} {
  const ledger = ensureLedgerState(state, dataset);
  const snaps = ledger.yearSnapshots;
  if (snaps.length < 2) {
    return {
      hasComparison: false,
      nominalReturnPct: 0,
      realReturnPct: 0,
      vsUsdBenchmarkPct: 0,
      vsGoldBenchmarkPct: 0,
      summaryFa: 'برای محاسبه عملکرد واقعی، حداقل یک سال شبیه‌سازی کامل لازم است.',
    };
  }

  const prev = snaps[snaps.length - 2];
  const curr = snaps[snaps.length - 1];
  const prevNwToman = Math.max(1, prev.netWorthToman);
  const currNwToman = Math.max(0, curr.netWorthToman);

  const nominalReturn = currNwToman / prevNwToman - 1;
  const infRatio = Math.max(0.5, curr.cpiIranRatio / Math.max(0.000001, prev.cpiIranRatio));
  const realReturn = (1 + nominalReturn) / infRatio - 1;

  const usdBenchmarkToman = prevNwToman * (curr.usdRateIrt / Math.max(1, prev.usdRateIrt));
  const goldPrevIrt = prev.goldUsdPerOz * prev.usdRateIrt;
  const goldCurrIrt = curr.goldUsdPerOz * curr.usdRateIrt;
  const goldBenchmarkToman = prevNwToman * (goldCurrIrt / Math.max(1, goldPrevIrt));

  const vsUsd = currNwToman / Math.max(1, usdBenchmarkToman) - 1;
  const vsGold = currNwToman / Math.max(1, goldBenchmarkToman) - 1;

  return {
    hasComparison: true,
    nominalReturnPct: Number((nominalReturn * 100).toFixed(1)),
    realReturnPct: Number((realReturn * 100).toFixed(1)),
    vsUsdBenchmarkPct: Number((vsUsd * 100).toFixed(1)),
    vsGoldBenchmarkPct: Number((vsGold * 100).toFixed(1)),
    summaryFa:
      realReturn >= 0
        ? `تغییر واقعی خالص دارایی (تعدیل‌شده با تورم): +${toPersianDigits(Math.round(realReturn * 100))}٪`
        : `تغییر واقعی خالص دارایی (تعدیل‌شده با تورم): -${toPersianDigits(Math.abs(Math.round(realReturn * 100)))}٪`,
  };
}

export function recordLedgerYearSnapshot(state: GameState, dataset: GameDataset): void {
  const ledger = ensureLedgerState(state, dataset);
  state.ledger = ledger;
  const macro = getMacroRatesForState(state, dataset);
  const totals = getTotalAssetsAndLiabilitiesInToman(state, dataset);
  const usdRate = Math.max(1, getUsdPairRate(state, 'IRT', dataset));
  const primaryCurrency = getPrimaryLivingCurrency(state, dataset);
  const histPoint =
    dataset.economy.historicalSeries.find((p) => p.year === state.currentJalaliYear) ??
    dataset.economy.historicalSeries[dataset.economy.historicalSeries.length - 1];
  const latestFx = state.fxState?.history?.[state.fxState.history.length - 1];
  const goldUsd = latestFx?.goldUsdPerOz ?? histPoint.globalGoldUSD.value;
  const localCpiRatio =
    primaryCurrency === 'IRT'
      ? state.inflationMultiplier
      : (state.countryMacros?.[state.player.countryId]?.cpiIndex ?? 1);

  const snapshot: LedgerYearSnapshot = {
    year: state.currentJalaliYear,
    netWorthUsd: Number((totals.netToman / usdRate).toFixed(2)),
    netWorthToman: totals.netToman,
    usdRateIrt: macro.usdFree,
    goldUsdPerOz: goldUsd,
    cpiIranRatio: state.inflationMultiplier,
    primaryCurrency,
    localCpiRatio,
  };

  ledger.yearSnapshots = [...ledger.yearSnapshots.slice(-59), snapshot];
}
