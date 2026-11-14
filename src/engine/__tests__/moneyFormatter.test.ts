import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import { ALL_CURRENCY_CODES, getFxRate, initializeFxState, quoteConversion } from '../fx';
import { creditWallet, getWalletBalance, payFromSpecificWallet, quotePayFromWallet } from '../ledger';
import {
  checkLockedRateDrift,
  formatDualMoneyText,
  formatMoneyDual,
  formatSingleCurrency,
  getAffordabilityState,
  getTodayExchangeRatesSummary,
  normalizePersianNumberInput,
} from '../money';
import type { CurrencyCode } from '../types';

function makeTestState(overrides?: {
  countryId?: string;
  displayCurrencyMode?: 'local' | 'IRT' | 'USD';
  moneyToman?: number;
}) {
  const save = createNewSaveGame(
    { seed: 'money-formatter-test', birthCityId: 'tehran', birthJalaliYear: 1380 },
    gameDataset,
  );
  const { state } = save;
  state.currentJalaliYear = 1405;
  state.fxState = initializeFxState(1405, gameDataset);
  state.player.age = 25;
  if (overrides?.countryId) {
    state.player.countryId = overrides.countryId;
  }
  if (overrides?.displayCurrencyMode) {
    state.displayCurrencyMode = overrides.displayCurrencyMode;
  }
  if (overrides?.moneyToman !== undefined) {
    state.player.moneyToman = overrides.moneyToman;
    const irtWallet = state.ledger?.wallets.find((w) => w.currencyCode === 'IRT');
    if (irtWallet) irtWallet.balance = overrides.moneyToman;
  }
  return state;
}

describe('Money Formatter & Currency Transparency Engine', () => {
  it('formats all 7 currencies with strictly Persian digits, proper Persian names, and zero Latin characters', () => {
    const samples: Array<{ code: CurrencyCode; amount: number; expectedName: string }> = [
      { code: 'IRT', amount: 45_000_000, expectedName: 'میلیون تومان' },
      { code: 'USD', amount: 1_200, expectedName: 'دلار' },
      { code: 'EUR', amount: 450, expectedName: 'یورو' },
      { code: 'TRY', amount: 3_000, expectedName: 'لیر' },
      { code: 'GBP', amount: 850, expectedName: 'پوند' },
      { code: 'CAD', amount: 2_500, expectedName: 'دلار کانادا' },
      { code: 'AED', amount: 5_000, expectedName: 'درهم' },
    ];

    for (const sample of samples) {
      const text = formatSingleCurrency(sample.amount, sample.code, gameDataset);
      expect(text).toContain(sample.expectedName);
      expect(text).not.toMatch(/[A-Za-z]/);
      expect(text).not.toMatch(/[0-9]/);
      expect(text).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('handles Toman scale thresholds (تومان, هزار, میلیون, میلیارد, همت), negatives, and edge inputs cleanly', () => {
    expect(formatSingleCurrency(0, 'IRT', gameDataset)).toBe('۰ تومان');
    expect(formatSingleCurrency(-0, 'IRT', gameDataset)).toBe('۰ تومان');
    expect(formatSingleCurrency(Number.NaN, 'EUR', gameDataset)).toBe('۰ یورو');
    expect(formatSingleCurrency(Number.POSITIVE_INFINITY, 'TRY', gameDataset)).toBe('۰ لیر');
    expect(formatSingleCurrency(250_000, 'IRT', gameDataset)).toContain('هزار تومان');
    expect(formatSingleCurrency(12_500_000, 'IRT', gameDataset)).toContain('میلیون تومان');
    expect(formatSingleCurrency(3_400_000_000, 'IRT', gameDataset)).toContain('میلیارد تومان');
    expect(formatSingleCurrency(1_500_000_000_000, 'IRT', gameDataset)).toContain('همت');
    const negative = formatSingleCurrency(-450, 'EUR', gameDataset);
    expect(negative.startsWith('−')).toBe(true);
    expect(negative).toContain('یورو');
  });

  it('enforces dual display when living in Iran vs abroad and across displayCurrencyMode toggles', () => {
    // Player lives in Iran -> primary is IRT; foreign EUR shows Toman equivalent
    const iranState = makeTestState({ countryId: 'iran', displayCurrencyMode: 'local' });
    const eurInIran = formatMoneyDual(450, 'EUR', iranState, gameDataset);
    expect(eurInIran.primaryText).toContain('یورو');
    expect(eurInIran.secondaryText).toContain('≈');
    expect(eurInIran.secondaryText).toContain('تومان');
    expect(eurInIran.inlineText).toContain('(');
    expect(eurInIran.isForeignToPrimary).toBe(true);

    // Iran IRT in local mode has no redundant secondary line
    const irtInIran = formatMoneyDual(50_000_000, 'IRT', iranState, gameDataset);
    expect(irtInIran.secondaryText).toBeNull();
    expect(irtInIran.isForeignToPrimary).toBe(false);

    // Player lives in Germany -> local EUR amount MUST show Toman equivalent as secondary
    const germanyState = makeTestState({ countryId: 'germany', displayCurrencyMode: 'local' });
    const eurInGermany = formatMoneyDual(2_000, 'EUR', germanyState, gameDataset);
    expect(eurInGermany.primaryText).toContain('یورو');
    expect(eurInGermany.secondaryText).toContain('≈');
    expect(eurInGermany.secondaryText).toContain('تومان');
    expect(eurInGermany.equivalentCurrencyCode).toBe('IRT');

    // Display toggle set to USD in Iran -> IRT shows USD equivalent
    const usdToggleState = makeTestState({ countryId: 'iran', displayCurrencyMode: 'USD' });
    const irtWithUsdToggle = formatMoneyDual(500_000_000, 'IRT', usdToggleState, gameDataset);
    expect(irtWithUsdToggle.secondaryText).toContain('دلار');

    // Dual text helper contains zero Latin chars
    const plainDual = formatDualMoneyText(450, 'EUR', iranState, gameDataset);
    expect(plainDual).not.toMatch(/[A-Za-z]/);
    expect(plainDual).toContain('یورو');
    expect(plainDual).toContain('تومان');
  });

  it('keeps USD-triangulated FX rates identical across fx selector, today summary, and dual formatter', () => {
    const state = makeTestState();
    const summary = getTodayExchangeRatesSummary(state, gameDataset);

    for (const item of summary.all) {
      const directFx = Math.round(getFxRate(state, item.code, 'IRT', gameDataset));
      expect(item.rateIrt).toBe(directFx);
      expect(item.rateIrtFormatted).not.toMatch(/[A-Za-z]/);
    }

    // Check triangulation: (EUR -> TRY) * (TRY -> IRT) ≈ (EUR -> IRT)
    const eurToTry = getFxRate(state, 'EUR', 'TRY', gameDataset);
    const tryToIrt = getFxRate(state, 'TRY', 'IRT', gameDataset);
    const eurToIrt = getFxRate(state, 'EUR', 'IRT', gameDataset);
    expect(Math.abs(eurToTry * tryToIrt - eurToIrt) / eurToIrt).toBeLessThan(1e-6);

    const dualEur = formatMoneyDual(100, 'EUR', state, gameDataset);
    expect(Math.round(dualEur.midRateToIrt)).toBe(Math.round(eurToIrt));
  });

  it('quotes and executes exact pay-from-wallet debits and preserves non-arbitrageable spreads', () => {
    const state = makeTestState({ moneyToman: 500_000_000 });
    const costEur = 450;

    const quote = quotePayFromWallet({
      targetAmount: costEur,
      targetCurrency: 'EUR',
      sourceCurrency: 'IRT',
      state,
      dataset: gameDataset,
    });
    expect(quote.canAfford).toBe(true);
    expect(quote.sourceRequired).toBeGreaterThan(0);

    const irtBefore = getWalletBalance(state, 'IRT');
    const res = payFromSpecificWallet({
      state,
      targetAmount: costEur,
      targetCurrency: 'EUR',
      sourceCurrency: 'IRT',
      dataset: gameDataset,
    });
    expect(res.ok).toBe(true);
    const irtAfter = getWalletBalance(state, 'IRT');
    expect(irtBefore - irtAfter).toBe(quote.sourceRequired);
    expect(irtAfter).toBe(quote.sourceBalanceAfter);

    // Direct EUR wallet debit when EUR wallet has balance
    creditWallet({ state, currencyCode: 'EUR', amount: 600, dataset: gameDataset });
    const eurQuote = quotePayFromWallet({
      targetAmount: 200,
      targetCurrency: 'EUR',
      sourceCurrency: 'EUR',
      state,
      dataset: gameDataset,
    });
    expect(eurQuote.sourceRequired).toBe(200);
    expect(eurQuote.feeInSource).toBe(0);

    // Round-trip conversion loss (non-arbitrageable)
    for (const foreign of ALL_CURRENCY_CODES.filter((c) => c !== 'IRT')) {
      const q1 = quoteConversion({ amount: 100_000_000, from: 'IRT', to: foreign, state, dataset: gameDataset });
      const q2 = quoteConversion({ amount: q1.netToAmount, from: foreign, to: 'IRT', state, dataset: gameDataset });
      expect(q2.netToAmount).toBeLessThan(100_000_000);
    }
  });

  it('detects affordability states (sufficient / tight / shortfall), locked rate drift >= 5%, and Persian input', () => {
    // Sufficient
    const rich = makeTestState({ moneyToman: 900_000_000 });
    expect(
      getAffordabilityState({ amount: 450, currency: 'EUR', state: rich, dataset: gameDataset }).status,
    ).toBe('sufficient');

    // Shortfall
    const poor = makeTestState({ moneyToman: 1_000_000 });
    const shortfall = getAffordabilityState({
      amount: 450,
      currency: 'EUR',
      state: poor,
      dataset: gameDataset,
      hasCheaperTier: true,
    });
    expect(shortfall.status).toBe('shortfall');
    expect(shortfall.shortfallToman).toBeGreaterThan(0);
    expect(shortfall.fixSuggestions).toContain('cheaper_tier');
    expect(shortfall.shortLabelFa).toContain('کم‌داری');

    // Tight (just enough for 450 EUR + conversion, but leaves below 2-month buffer)
    const eurRate = getFxRate(rich, 'EUR', 'IRT', gameDataset);
    const tightBudget = Math.round(450 * eurRate * 1.1);
    const tight = makeTestState({ moneyToman: tightBudget });
    expect(
      getAffordabilityState({ amount: 450, currency: 'EUR', state: tight, dataset: gameDataset }).status,
    ).toBe('tight');

    // Locked rate drift
    const driftHigh = checkLockedRateDrift({
      lockedRateIrt: eurRate * 0.9,
      lockedYear: 1404,
      currencyCode: 'EUR',
      state: rich,
      dataset: gameDataset,
    });
    expect(driftHigh?.drifted).toBe(true);
    expect(driftHigh?.driftPct).toBeGreaterThan(5);

    const driftLow = checkLockedRateDrift({
      lockedRateIrt: eurRate * 0.99,
      lockedYear: 1405,
      currencyCode: 'EUR',
      state: rich,
      dataset: gameDataset,
    });
    expect(driftLow?.drifted).toBe(false);

    // Persian/Arabic digits normalization
    expect(normalizePersianNumberInput('۱٬۲۵۰٬۰۰۰')).toBe(1_250_000);
    expect(normalizePersianNumberInput('۴۵۰٫۵')).toBe(450.5);
    expect(normalizePersianNumberInput('abc')).toBe(0);
  });
});
