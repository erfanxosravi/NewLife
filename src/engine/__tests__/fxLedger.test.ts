import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import {
  ALL_CURRENCY_CODES,
  formatCurrencyAmount,
  getFxRate,
  getRealExchangeRateAndPppGap,
  initializeFxState,
  quoteConversion,
  stepFxRates,
} from '../fx';
import { createNewSaveGame } from '../generator';
import {
  creditWallet,
  executeCurrencyConversion,
  getAnnualRealPerformanceAndBenchmarks,
  getCurrencyExposureBreakdown,
  getLedgerNetWorth,
  getSavingsErosionWarnings,
  getWalletBalance,
  recordLedgerYearSnapshot,
  submitCrossBorderTransfer,
} from '../ledger';
import { advanceYear } from '../reducer';
import { SeededRNG } from '../rng';

describe('Multi-Currency FX & Ledger Engine', () => {
  it('1. maintains strict USD triangulation consistency with zero arbitrage across all pairs', () => {
    const save = createNewSaveGame({ seed: 'fx-triangulation', birthJalaliYear: 1384 }, gameDataset);
    const sim = advanceYear(save, gameDataset);

    for (const a of ALL_CURRENCY_CODES) {
      for (const b of ALL_CURRENCY_CODES) {
        for (const c of ALL_CURRENCY_CODES) {
          const ab = getFxRate(sim.state, a, b, gameDataset);
          const bc = getFxRate(sim.state, b, c, gameDataset);
          const ac = getFxRate(sim.state, a, c, gameDataset);
          expect(ab * bc).toBeCloseTo(ac, 6);
        }
      }
    }
  });

  it('2. applies spread and conversion fees so round-trip conversion strictly loses value (< 1)', () => {
    const save = createNewSaveGame({ seed: 'fx-friction', birthJalaliYear: 1384 }, gameDataset);
    save.state.currentJalaliYear = 1405;
    save.state.fxState = initializeFxState(1405, gameDataset);

    const startAmount = 100_000_000;
    const leg1 = quoteConversion({
      amount: startAmount,
      from: 'IRT',
      to: 'EUR',
      state: save.state,
      dataset: gameDataset,
    });
    expect(leg1.feeInFromCurrency).toBeGreaterThan(0);
    expect(leg1.netToAmount).toBeGreaterThan(0);

    const leg2 = quoteConversion({
      amount: leg1.netToAmount,
      from: 'EUR',
      to: 'IRT',
      state: save.state,
      dataset: gameDataset,
    });

    expect(leg2.netToAmount).toBeLessThan(startAmount);
    expect(leg2.netToAmount / startAmount).toBeLessThan(0.99);
  });

  it('3. generates deterministic post-1405 FX paths from worldSeed and depreciates high-inflation currencies vs USD', () => {
    const runSeries = (seed: string) => {
      let fx = initializeFxState(1405, gameDataset);
      const rng = new SeededRNG(seed);
      for (let y = 1406; y <= 1435; y++) {
        fx = stepFxRates({
          prevFx: fx,
          nextYear: y,
          iranInflationRate: 0.34,
          countryInflationsByCurrency: {
            TRY: 0.28,
            EUR: 0.022,
            GBP: 0.024,
            CAD: 0.022,
            AED: 0.025,
          },
          globalInflationRate: 0.023,
          oilShockRatio: 0,
          globalGrowthShockRatio: 0,
          goldUsdPerOz: 3900 + (y - 1405) * 40,
          rng,
          dataset: gameDataset,
        });
      }
      return fx;
    };

    const runA = runSeries('world-fx-det-1');
    const runB = runSeries('world-fx-det-1');
    expect(runA.usdRates).toEqual(runB.usdRates);
    expect(runA.fairUsdRates).toEqual(runB.fairUsdRates);

    // High-inflation IRT and TRY depreciate significantly over 30 years relative to 1405 anchor
    expect(runA.usdRates.IRT).toBeGreaterThan(271900 * 50);
    expect(runA.usdRates.TRY).toBeGreaterThan(45 * 20);
    // Pegged AED stays near 3.6725
    expect(runA.usdRates.AED).toBeGreaterThan(3.6);
    expect(runA.usdRates.AED).toBeLessThan(3.75);
    // Stable EUR stays bounded
    expect(runA.usdRates.EUR).toBeGreaterThan(0.5);
    expect(runA.usdRates.EUR).toBeLessThan(1.6);

    const gapCheck = getRealExchangeRateAndPppGap(
      { ...createNewSaveGame({ seed: 'x' }, gameDataset).state, fxState: runA },
      'TRY',
      gameDataset,
    );
    expect(gapCheck.realExchangeIndex).toBeGreaterThan(0.3);
  });

  it('4. models 40-year real purchasing power erosion in Toman cash vs USD-hedged cash and triggers warnings', () => {
    let sim = createNewSaveGame({ seed: 'erosion-40y', birthJalaliYear: 1405 }, gameDataset);
    sim.state.flags['econ_scenario'] = 'high';
    creditWallet({
      state: sim.state,
      currencyCode: 'IRT',
      amount: 1_000_000_000,
      dataset: gameDataset,
    });
    const startUsdEq =
      1_000_000_000 / Math.max(1, sim.state.fxState!.usdRates.IRT);

    for (let y = 0; y < 25 && sim.state.isAlive; y++) {
      sim = advanceYear(sim, gameDataset);
    }

    const warnings = getSavingsErosionWarnings(sim.state, gameDataset);
    expect(warnings.some((w) => w.currencyCode === 'IRT')).toBe(true);

    const cashWalletIrt = getWalletBalance(sim.state, 'IRT');
    const endUsdEq = cashWalletIrt / Math.max(1, sim.state.fxState!.usdRates.IRT);
    expect(endUsdEq).toBeLessThan(startUsdEq * 0.25);

    const perf = getAnnualRealPerformanceAndBenchmarks(sim.state, gameDataset);
    expect(perf.hasComparison).toBe(true);
    expect(perf.vsUsdBenchmarkPct).toBeLessThan(0);
  });

  it('5. computes multi-currency exposure donut, net worth, cross-border transfers, and strictly Persian currency formatting', () => {
    let save = createNewSaveGame({ seed: 'ledger-donut', birthJalaliYear: 1384 }, gameDataset);
    save.state.currentJalaliYear = 1405;
    save.state.fxState = initializeFxState(1405, gameDataset);

    creditWallet({
      state: save.state,
      currencyCode: 'IRT',
      amount: 543_800_000, // 2000 USD worth
      dataset: gameDataset,
    });
    const conv = executeCurrencyConversion({
      state: save.state,
      fromCurrency: 'IRT',
      toCurrency: 'EUR',
      fromAmount: 271_900_000,
      dataset: gameDataset,
    });
    expect(conv.ok).toBe(true);
    expect(getWalletBalance(save.state, 'EUR')).toBeGreaterThan(800);

    const slices = getCurrencyExposureBreakdown(save.state, gameDataset);
    expect(slices.length).toBe(2);
    const totalPct = slices.reduce((s, x) => s + x.sharePct, 0);
    expect(totalPct).toBeGreaterThanOrEqual(99);
    expect(totalPct).toBeLessThanOrEqual(101);

    const nwLocal = getLedgerNetWorth(save.state, gameDataset, 'local');
    const nwUsd = getLedgerNetWorth(save.state, gameDataset, 'USD');
    expect(nwLocal.displayCurrency).toBe('IRT');
    expect(nwUsd.displayCurrency).toBe('USD');
    expect(nwUsd.displayAmount).toBeGreaterThan(1500);
    expect(nwLocal.purchasingPowerHintFa).toContain('ماه حقوق حداقل محلی');

    // Submit delayed transfer via bank_wire (1 turn delay)
    const rng = new SeededRNG('transfer-test');
    const tr = submitCrossBorderTransfer({
      state: save.state,
      fromCurrency: 'IRT',
      toCurrency: 'TRY',
      fromAmount: 200_000_000,
      channelId: 'bank_wire',
      purposeFa: 'انتقال سرمایه برای تمکن ترکیه',
      rng,
      dataset: gameDataset,
    });
    expect(tr.ok).toBe(true);
    expect(tr.delayed).toBe(true);
    expect(save.state.ledger!.pendingTransfers.length).toBe(1);

    // Advance 1 year settles pending transfer
    save = advanceYear(save, gameDataset);
    expect(save.state.ledger!.pendingTransfers.length).toBe(0);

    recordLedgerYearSnapshot(save.state, gameDataset);
    expect(save.state.ledger!.yearSnapshots.length).toBeGreaterThanOrEqual(2);

    // Strict zero-Latin check on formatted currency strings
    for (const code of ALL_CURRENCY_CODES) {
      const formatted = formatCurrencyAmount(12500, code, gameDataset);
      expect(formatted.match(/[A-Za-z]{2,}/g)).toBeNull();
    }
  });
});
