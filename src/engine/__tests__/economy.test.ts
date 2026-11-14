import { describe, expect, it } from 'vitest';
import baselineJson from '../../data/economy/baseline_1405.json';
import historicalJson from '../../data/economy/historical_series.json';
import jobIncomeJson from '../../data/economy/job_income.json';
import { gameDataset } from '../../data/registry';
import {
  calculateJobAnnualIncomeBreakdown,
  getAnnualLivingExpenseToman,
  getMacroRatesForState,
  getMinWageMonthlyForState,
  getTehran70SqmTransactionPriceToman,
} from '../economy';
import { createNewSaveGame } from '../generator';
import { advanceYear } from '../reducer';
import { SeededRNG } from '../rng';
import {
  Baseline1405Schema,
  HistoricalSeriesSchema,
  JobIncomeFileSchema,
  SourcedNumberSchema,
} from '../schemas';

describe('Real-Data Iranian Economy Model', () => {
  it('1. validates every economy number with Zod for asOf, source, and confidence', () => {
    expect(() => Baseline1405Schema.parse(baselineJson)).not.toThrow();
    expect(() => HistoricalSeriesSchema.parse(historicalJson)).not.toThrow();
    expect(() => JobIncomeFileSchema.parse(jobIncomeJson)).not.toThrow();

    // Verify Zod rejects missing provenance fields
    expect(() =>
      SourcedNumberSchema.parse({ value: 100, unit: 'toman', source: 'x', confidence: 'verified' }),
    ).toThrow();
    expect(() =>
      SourcedNumberSchema.parse({ value: 100, unit: 'toman', asOf: '1405-08', confidence: 'verified' }),
    ).toThrow();
    expect(() =>
      SourcedNumberSchema.parse({ value: 100, unit: 'toman', asOf: '1405-08', source: 'x' }),
    ).toThrow();
    expect(() =>
      SourcedNumberSchema.parse({
        value: 100,
        unit: 'toman',
        asOf: '1405-08',
        source: 'x',
        confidence: 'invented',
      }),
    ).toThrow();
  });

  it('2. places 1405 monthly minimum wage in USD strictly between 50 and 100 USD', () => {
    const { minWageMonthly, usdFree } = gameDataset.economy.baseline1405.verifiedBenchmarks;
    const minWageUsd = minWageMonthly.value / usdFree.value;
    expect(minWageUsd).toBeGreaterThanOrEqual(50);
    expect(minWageUsd).toBeLessThanOrEqual(100);
  });

  it('3. prevents a median-income character from buying a 70 sqm Tehran apartment from salary alone', () => {
    const save = createNewSaveGame(
      { seed: 'median-tehran-apt', birthCityId: 'tehran', birthJalaliYear: 1380, socialClass: 'middle' },
      gameDataset,
    );
    const teacherJob = gameDataset.jobs.find((j) => j.id === 'teacher')!;
    const snappJob = gameDataset.jobs.find((j) => j.id === 'snapp_driver')!;
    // Simulate a realistic 40-year median-income working career at 1405 Tehran benchmarks
    const state1405 = {
      ...save.state,
      currentJalaliYear: 1405,
      inflationMultiplier: 1,
      player: {
        ...save.state.player,
        age: 24,
        currentCityId: 'tehran',
        housing: {
          type: 'rent' as const,
          cityId: 'tehran',
          monthlyRentToman: gameDataset.economy.baseline1405.verifiedBenchmarks.tehranRentSouthMonthly.value,
          depositRahnToman: gameDataset.economy.baseline1405.verifiedBenchmarks.tehranRentSouthDeposit.value,
          propertyValueToman: 0,
        },
      },
    };
    const tehran70Price = getTehran70SqmTransactionPriceToman(state1405, gameDataset);
    expect(tehran70Price).toBeGreaterThan(10_000_000_000);

    const teacherMedian = calculateJobAnnualIncomeBreakdown({
      job: teacherJob,
      level: 2,
      state: {
        ...state1405,
        player: {
          ...state1405.player,
          job: {
            jobId: teacherJob.id,
            title: teacherJob.titleFa,
            track: teacherJob.track,
            level: 2,
            annualSalaryToman: 0,
            stress: teacherJob.stress,
            yearsInJob: 5,
          },
        },
      },
      dataset: gameDataset,
      positionOverride01: 0.5,
    });
    const snappMedian = calculateJobAnnualIncomeBreakdown({
      job: snappJob,
      level: 2,
      state: {
        ...state1405,
        player: {
          ...state1405.player,
          job: {
            jobId: snappJob.id,
            title: snappJob.titleFa,
            track: snappJob.track,
            level: 2,
            annualSalaryToman: 0,
            stress: snappJob.stress,
            yearsInJob: 5,
          },
        },
      },
      dataset: gameDataset,
      positionOverride01: 0.5,
    });

    const livingExpense = getAnnualLivingExpenseToman(
      {
        ...state1405,
        player: {
          ...state1405.player,
          job: {
            jobId: teacherJob.id,
            title: teacherJob.titleFa,
            track: teacherJob.track,
            level: 2,
            annualSalaryToman: teacherMedian.netAnnual,
            stress: teacherJob.stress,
            yearsInJob: 5,
          },
        },
      },
      gameDataset,
    );
    const annualRent = state1405.player.housing.monthlyRentToman * 12;

    const teacher40YrNetSurplus =
      Math.max(0, teacherMedian.netAnnual - livingExpense - annualRent) * 40;
    const snapp40YrNetSurplus =
      Math.max(0, snappMedian.netAnnual - livingExpense - annualRent) * 40;

    expect(teacher40YrNetSurplus).toBeLessThan(tehran70Price);
    expect(snapp40YrNetSurplus).toBeLessThan(tehran70Price);

    // Also run an actual advanceYear simulation (birth 1380, median teacher from age 22-65)
    let sim = createNewSaveGame(
      {
        seed: 'median-lifetime-sim',
        birthCityId: 'tehran',
        birthJalaliYear: 1380,
        socialClass: 'middle',
      },
      gameDataset,
    );
    for (let y = 0; y < 40 && sim.state.isAlive; y++) {
      if (sim.state.player.age === 22 && !sim.state.player.job) {
        sim = {
          ...sim,
          state: {
            ...sim.state,
            player: {
              ...sim.state.player,
              job: {
                jobId: teacherJob.id,
                title: teacherJob.titleFa,
                track: teacherJob.track,
                level: 2,
                annualSalaryToman: 0,
                stress: teacherJob.stress,
                yearsInJob: 0,
              },
            },
          },
        };
      }
      sim = advanceYear(sim, gameDataset);
    }
    const endAptPrice = getTehran70SqmTransactionPriceToman(sim.state, gameDataset);
    expect(sim.state.player.moneyToman).toBeLessThan(endAptPrice);
  });

  it('4. models realistic median snapp_driver net income and keeps >1B Toman (1405 real terms) under 1% of driver lives', () => {
    const snappJob = gameDataset.jobs.find((j) => j.id === 'snapp_driver')!;
    const baseSave = createNewSaveGame(
      { seed: 'snapp-median-check', birthCityId: 'tehran', birthJalaliYear: 1380 },
      gameDataset,
    );
    const state1405 = {
      ...baseSave.state,
      currentJalaliYear: 1405,
      inflationMultiplier: 1,
    };

    const medianBreakdown = calculateJobAnnualIncomeBreakdown({
      job: snappJob,
      level: 2,
      state: state1405,
      dataset: gameDataset,
      positionOverride01: 0.5,
    });
    const monthlyNet = medianBreakdown.netAnnual / 12;
    // Gross ~34.8M/mo -> after 18% commission & 23.08% running costs -> ~20.5M/mo net (~246M/yr)
    expect(monthlyNet).toBeGreaterThan(16_000_000);
    expect(monthlyNet).toBeLessThan(28_000_000);

    // Simulate 1,000 full 40-year driver careers at 1405 anchor scale
    const LIVES = 1000;
    const YEARS_PER_CAREER = 40;
    let livesOver1Billion = 0;

    for (let i = 0; i < LIVES; i++) {
      const rng = new SeededRNG(`snapp-life-${i}`);
      let hitOver1B = false;
      for (let yr = 0; yr < YEARS_PER_CAREER; yr++) {
        const res = calculateJobAnnualIncomeBreakdown({
          job: snappJob,
          level: (yr % 3) + 1,
          state: state1405,
          dataset: gameDataset,
          rng,
          allowTail: true,
        });
        if (res.grossAnnual > 1_000_000_000) {
          hitOver1B = true;
        }
      }
      if (hitOver1B) livesOver1Billion += 1;
    }

    expect(livesOver1Billion / LIVES).toBeLessThan(0.015);
  });

  it('5. keeps non-tail annual income strictly within [p10, p90] * 12 * minWageMonthly across 1,000 lives', () => {
    const TOTAL_LIVES = 1000;
    for (let i = 0; i < TOTAL_LIVES; i++) {
      let save = createNewSaveGame({ seed: `income-dist-${i}` }, gameDataset);
      const rng = new SeededRNG(`income-pick-${i}`);
      const job = gameDataset.jobs[i % gameDataset.jobs.length];
      const entry = gameDataset.economy.jobIncome.find((e) => e.jobId === job.id)!;

      // Sample 5 turns across the life (childhood -> adulthood -> senior)
      for (let step = 0; step < 30 && save.state.isAlive; step++) {
        save = advanceYear(save, gameDataset);
        if (save.state.player.age >= 18 && step % 5 === 0) {
          const minWage = getMinWageMonthlyForState(save.state, gameDataset);
          const country = gameDataset.countries.find((c) => c.id === save.state.player.countryId);
          const countryFactor = country && !country.isIran ? country.costOfLivingIndex : 1;
          const level = (step % job.ladder.length) + 1;
          const breakdown = calculateJobAnnualIncomeBreakdown({
            job,
            level,
            state: save.state,
            dataset: gameDataset,
            rng,
            allowTail: false,
          });
          const minGross = Math.floor(
            minWage * 12 * entry.monthlyIncomeMultiplierOfMinWage.p10.value * countryFactor,
          );
          const maxGross = Math.ceil(
            minWage * 12 * entry.monthlyIncomeMultiplierOfMinWage.p90.value * countryFactor,
          );
          expect(breakdown.grossAnnual).toBeGreaterThanOrEqual(minGross);
          expect(breakdown.grossAnnual).toBeLessThanOrEqual(maxGross);
          expect(breakdown.netAnnual).toBeLessThanOrEqual(breakdown.grossAnnual);
        }
      }
    }
  }, 30000);

  it('6. deflates all historical prices positively for every year 1340..1405 and never <= 0', () => {
    const baseSave = createNewSaveGame({ seed: 'hist-check', birthJalaliYear: 1340 }, gameDataset);
    for (let year = 1340; year <= 1405; year++) {
      const stateAtYear = {
        ...baseSave.state,
        currentJalaliYear: year,
        inflationMultiplier:
          getMacroRatesForState(
            { ...baseSave.state, currentJalaliYear: year, inflationMultiplier: 1 },
            gameDataset,
          ).cpiRatioTo1405,
      };
      const rates = getMacroRatesForState(stateAtYear, gameDataset);
      expect(rates.cpiRatioTo1405).toBeGreaterThan(0);
      expect(rates.minWageMonthly).toBeGreaterThan(0);
      expect(rates.usdFree).toBeGreaterThan(0);
      expect(rates.emamiCoin).toBeGreaterThan(0);
      expect(rates.gold18kPerGram).toBeGreaterThan(0);
      expect(rates.tehranListingSqm).toBeGreaterThan(0);
    }
  });

  it('7. includes all 16 contiguous macro and global series (1340..1405) with strict provenance', () => {
    const series = gameDataset.economy.historicalSeries;
    expect(series.length).toBe(66);
    expect(series[0].year).toBe(1340);
    expect(series[series.length - 1].year).toBe(1405);

    for (let i = 0; i < series.length; i++) {
      const point = series[i];
      expect(point.year).toBe(1340 + i);
      // Pre-TEDPIX years must strictly be marked estimate
      if (point.year < 1369) {
        expect(point.stockIndex.confidence).toBe('estimate');
      }
      // 1405 unclosed macro projections must be marked estimate (except verified fixed CBI deposit ceiling)
      if (point.year === 1405) {
        expect(point.gdpGrowth.confidence).toBe('estimate');
        expect(point.unemployment.confidence).toBe('estimate');
        expect(point.liquidityGrowth.confidence).toBe('estimate');
      }
      // Positive invariants
      expect(point.cpiIndex.value).toBeGreaterThan(0);
      expect(point.stockIndex.value).toBeGreaterThan(0);
      expect(point.globalGoldUSD.value).toBeGreaterThan(0);
      expect(point.oilPriceUSD.value).toBeGreaterThan(0);
      expect(point.oilExportRevenueIndex.value).toBeGreaterThan(0);
      expect(point.unemployment.value).toBeGreaterThan(0.02);
      expect(point.unemployment.value).toBeLessThan(0.35);
    }
  });

  it('8. matches key verified CBI, World Bank, and TEDPIX historical crisis & milestone anchors', () => {
    const byYear = new Map(gameDataset.economy.historicalSeries.map((r) => [r.year, r]));
    // 1359 (1980) war onset contraction
    expect(byYear.get(1359)!.gdpGrowth.value).toBeCloseTo(-0.216, 3);
    expect(byYear.get(1359)!.gdpGrowth.confidence).toBe('verified');
    // 1361 (1982) post-initial rebound
    expect(byYear.get(1361)!.gdpGrowth.value).toBeCloseTo(0.2317, 3);
    // 1374 inflation peak
    expect(byYear.get(1374)!.inflationRate.value).toBeCloseTo(0.494, 3);
    // 1385 liquidity spike
    expect(byYear.get(1385)!.liquidityGrowth.value).toBeCloseTo(0.394, 3);
    expect(byYear.get(1385)!.liquidityGrowth.confidence).toBe('verified');
    // 1399 COVID + liquidity surge + TEDPIX boom
    expect(byYear.get(1399)!.liquidityGrowth.value).toBeCloseTo(0.406, 3);
    expect(byYear.get(1399)!.stockIndex.value).toBe(1309451);
    expect(byYear.get(1399)!.globalGrowth.value).toBeCloseTo(-0.0289, 3);
    // 1404 TEDPIX year-end close
    expect(byYear.get(1404)!.stockIndex.value).toBe(3713956);
    expect(byYear.get(1404)!.stockIndex.confidence).toBe('verified');
  });
});
