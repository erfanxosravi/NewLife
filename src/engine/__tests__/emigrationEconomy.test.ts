import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import {
  advanceEmigrationPipelineStepAction,
  completeAbroadArrivalAndMoveAction,
  completeIntegrationChecklistAction,
  convertCurrencyAction,
  relicenseCredentialAbroadAction,
  rentOrBuyAbroadHousingAction,
  returnToIranAction,
  runAdvanceYearWithTick,
  sellIranPropertyAndTransferAction,
  sendRemittanceToIranAction,
  studyForeignLanguageAction,
  takeShortForeignTripAction,
} from '../../state/actions';
import {
  calculateAbroadJobIncome,
  getAbroadMonthlyBudget,
  getCountryMacroDef,
} from '../countries';
import {
  compareCountries,
  computeEmigrationDifficulty,
  getLanguageLevelLabelFa,
  getShortTripQuote,
  rankCountriesForPlayer,
} from '../emigration';
import { getFxRate, initializeFxState } from '../fx';
import { createNewSaveGame } from '../generator';
import { creditWallet, getWalletBalance } from '../ledger';
import { SeededRNG } from '../rng';

describe('Country Macro, Abroad Economy & Emigration Pipeline', () => {
  it('1. decomposes emigration difficulty into bars summing exactly to totalDifficulty and uses pure Persian language labels', () => {
    const save = createNewSaveGame({ seed: 'diff-check', birthJalaliYear: 1380 }, gameDataset);
    save.state.player.age = 27;
    save.state.player.education.level = 'bachelor';

    for (let lvl = 1; lvl <= 6; lvl++) {
      const lbl = getLanguageLevelLabelFa(lvl);
      expect(/[A-Za-z]/.test(lbl)).toBe(false);
    }

    for (const c of gameDataset.countriesMacro.filter((x) => !x.isTemplate)) {
      const report = computeEmigrationDifficulty({
        countryId: c.id,
        state: save.state,
        dataset: gameDataset,
      });
      const factorSum = report.factors.reduce((s, f) => s + f.points, 0);
      expect(factorSum).toBe(report.totalDifficulty);
      expect(report.totalDifficulty).toBeGreaterThanOrEqual(5);
      expect(report.totalDifficulty).toBeLessThanOrEqual(95);
    }

    const ranked = rankCountriesForPlayer(save.state, gameDataset);
    expect(ranked.length).toBe(5);
    const comp = compareCountries(['germany', 'canada', 'turkey'], save.state, gameDataset);
    expect(comp.length).toBe(3);
  });

  it('2. simulates 5,000 abroad migrant careers validating statutory min-wage floor, convergence curve, and re-licensing uplift', () => {
    const baseSave = createNewSaveGame({ seed: 'migrant-mc', birthJalaliYear: 1380 }, gameDataset);
    baseSave.state.currentJalaliYear = 1405;
    baseSave.state.fxState = initializeFxState(1405, gameDataset);
    baseSave.state.player.age = 30;
    const countries = gameDataset.countriesMacro.filter((c) => !c.isTemplate);
    const rng = new SeededRNG('migrant-mc-trials');

    const TRIALS = 5000;
    for (let i = 0; i < TRIALS; i++) {
      const c = countries[i % countries.length];
      const job = gameDataset.jobs[i % gameDataset.jobs.length];
      const level = (i % job.ladder.length) + 1;
      const years = i % 6;
      const lang = (i % 6) + 1;

      const res = calculateAbroadJobIncome({
        job,
        level,
        state: baseSave.state,
        dataset: gameDataset,
        countryIdOverride: c.id,
        yearsAbroadOverride: years,
        languageLevelOverride: lang,
        relicensedOverride: false,
        permitTypeOverride: 'work',
        rng,
      });

      expect(Number.isFinite(res.grossAnnualLocal)).toBe(true);
      expect(Number.isFinite(res.netAnnualLocal)).toBe(true);
      expect(res.netAnnualLocal).toBeGreaterThan(0);
      expect(res.netAnnualLocal).toBeLessThanOrEqual(res.grossAnnualLocal);

      if (c.macro.hasStatutoryMinWage !== false) {
        // Statutory full-time min-wage floor enforced across 100% of legal FT trials
        expect(res.grossAnnualLocal).toBeGreaterThanOrEqual(
          Math.floor(res.minWageMonthlyLocal * 12) - 1,
        );
      }
    }

    // Verify 3-5 year convergence curve & regulated profession re-licensing salary uplift
    const medJob =
      gameDataset.jobs.find((j) => j.track === 'medical' || j.id.includes('doctor')) ??
      gameDataset.jobs[0];
    const yr0 = calculateAbroadJobIncome({
      job: medJob,
      level: 2,
      state: baseSave.state,
      dataset: gameDataset,
      countryIdOverride: 'germany',
      yearsAbroadOverride: 0,
      languageLevelOverride: 5,
      relicensedOverride: false,
      permitTypeOverride: 'work',
      positionOverride01: 0.5,
    });
    const yr4 = calculateAbroadJobIncome({
      job: medJob,
      level: 2,
      state: baseSave.state,
      dataset: gameDataset,
      countryIdOverride: 'germany',
      yearsAbroadOverride: 4,
      languageLevelOverride: 5,
      relicensedOverride: false,
      permitTypeOverride: 'work',
      positionOverride01: 0.5,
    });
    const yr4Relicensed = calculateAbroadJobIncome({
      job: medJob,
      level: 2,
      state: baseSave.state,
      dataset: gameDataset,
      countryIdOverride: 'germany',
      yearsAbroadOverride: 4,
      languageLevelOverride: 5,
      relicensedOverride: true,
      permitTypeOverride: 'work',
      positionOverride01: 0.5,
    });
    expect(yr4.netAnnualLocal).toBeGreaterThanOrEqual(yr0.netAnnualLocal);
    expect(yr4Relicensed.netAnnualLocal).toBeGreaterThan(yr4.netAnnualLocal);
  });

  it('3. enforces destination-currency proof-of-funds FX check, completes 6-step arrival, and steps abroad economy', () => {
    let save = createNewSaveGame({ seed: 'emig-pipeline-test', birthJalaliYear: 1378 }, gameDataset);
    save.state.currentJalaliYear = 1405;
    save.state.fxState = initializeFxState(1405, gameDataset);
    save.state.player.age = 27;
    save.state.player.education.level = 'bachelor';
    save.state.player.stats.intelligence = 82;

    // Give enough IRT for language classes and step 0-2 fees (~3,380 EUR), still far below 11,904 EUR proof-of-funds
    save.state.player.moneyToman = 1_000_000_000;
    const convLow = convertCurrencyAction(
      save,
      { fromCurrency: 'IRT', toCurrency: 'EUR', fromAmount: 500_000_000 },
      gameDataset,
    );
    expect(convLow.success).toBe(true);
    save = convLow.save;

    // Boost German language to medium-1 (level 3)
    let langRes = studyForeignLanguageAction(save, 'germany', gameDataset);
    expect(langRes.success).toBe(true);
    save = langRes.save;

    save.state.flags['cd_lang_germany'] = -1;
    langRes = studyForeignLanguageAction(save, 'germany', gameDataset);
    save = langRes.save;

    // Advance steps 0..2 until reaching step 3 (proof-of-funds gate)
    for (let g = 0; g < 14; g++) {
      if ((save.state.emigration?.activeApplications?.germany?.currentStepIndex ?? 0) >= 3) break;
      save = { ...save, state: { ...save.state, turn: save.state.turn + 1 } };
      const res = advanceEmigrationPipelineStepAction(save, 'germany', 'study', gameDataset);
      save = res.save;
    }

    expect(save.state.emigration?.activeApplications?.germany?.currentStepIndex).toBe(3);
    const blockedStep3 = advanceEmigrationPipelineStepAction(save, 'germany', 'study', gameDataset);
    expect(blockedStep3.success).toBe(false);
    expect(blockedStep3.message).toContain('تمکن مالی');

    // Credit 25,000 EUR -> proof of funds passes -> complete up to arrival
    creditWallet({ state: save.state, currencyCode: 'EUR', amount: 25000, dataset: gameDataset });
    for (let guard = 0; guard < 10; guard++) {
      const app = save.state.emigration?.activeApplications?.germany;
      if (app?.status === 'approved') break;
      save = { ...save, state: { ...save.state, turn: save.state.turn + 1 } };
      const stepRes = advanceEmigrationPipelineStepAction(save, 'germany', 'study', gameDataset);
      save = stepRes.save;
    }

    expect(save.state.emigration?.activeApplications?.germany?.status).toBe('approved');
    const arrive = completeAbroadArrivalAndMoveAction(save, 'germany', 'de_berlin', gameDataset);
    expect(arrive.success).toBe(true);
    save = arrive.save;
    expect(save.state.player.countryId).toBe('germany');
    expect(save.state.emigration?.residency.isAbroad).toBe(true);

    // Complete 12-month checklist & advance to 1406 (verifying Germany 2027 14.60 EUR min-wage step)
    const chk = completeIntegrationChecklistAction(save, 'sim_and_tax_id', gameDataset);
    expect(chk.success).toBe(true);
    save = chk.save;

    const preMinWage = getCountryMacroDef('germany', gameDataset)!.macro.minWageMonthlyLocal.value;
    save = runAdvanceYearWithTick(save, gameDataset);
    expect(save.state.currentJalaliYear).toBe(1406);
    expect(save.state.countryMacros?.germany?.minWageMonthlyLocal).toBeGreaterThan(preMinWage);
    expect(save.state.emigration?.lastReportCard?.currencyCode).toBe('EUR');
  });

  it('4. triggers forced return on employer-tied permit grace expiry and supports voluntary return & family remittance', () => {
    let save = createNewSaveGame({ seed: 'grace-return', birthJalaliYear: 1378 }, gameDataset);
    save.state.currentJalaliYear = 1405;
    save.state.fxState = initializeFxState(1405, gameDataset);
    save.state.player.age = 27;
    save.state.player.countryId = 'uae';
    save.state.player.currentCityId = 'ae_dubai';
    save.state.player.job = null;
    creditWallet({ state: save.state, currencyCode: 'AED', amount: 80000, dataset: gameDataset });

    save.state.emigration = {
      shortlistedCountryIds: ['uae'],
      activeApplications: {},
      languageLevels: { uae: 4, AED: 4 },
      residency: {
        isAbroad: true,
        countryId: 'uae',
        regionId: 'ae_dubai',
        yearsAbroad: 1,
        statusStage: 'temporary',
        permitType: 'work',
        jobLossGraceMonthsRemaining: 3, // already inside 3-mo employer-tied grace window
        abroadWorkMonthsAccumulated: 12,
        checklistDoneIds: [],
        credentialRelicensedTracks: [],
        annualRemittanceCount: 0,
      },
      travelHistory: [],
    };

    // Remittance boosts living parents closeness before return
    const parentBefore = save.state.relationships.find((r) => r.role === 'mother')?.closeness ?? 50;
    const rem = sendRemittanceToIranAction(save, 2000, gameDataset);
    expect(rem.success).toBe(true);
    save = rem.save;
    const parentAfter = save.state.relationships.find((r) => r.role === 'mother')?.closeness ?? 50;
    expect(parentAfter).toBeGreaterThan(parentBefore);

    // Advance 1 year while unemployed with 3-mo grace -> forced return to Iran
    save = runAdvanceYearWithTick(save, gameDataset);
    expect(save.state.player.countryId).toBe('iran');
    expect(save.state.emigration?.residency.isAbroad).toBe(false);
    expect(save.state.emigration?.residency.forcedReturnNoticeFa).toBeTruthy();

    // Voluntary return check + property preservation + abroad housing + relicensing
    let saveVol = createNewSaveGame({ seed: 'vol-return', birthJalaliYear: 1378 }, gameDataset);
    saveVol.state.currentJalaliYear = 1405;
    saveVol.state.fxState = initializeFxState(1405, gameDataset);
    saveVol.state.player.countryId = 'canada';
    saveVol.state.flags['iran_owned_property_toman'] = 12_000_000_000;
    creditWallet({ state: saveVol.state, currencyCode: 'CAD', amount: 250000, dataset: gameDataset });
    saveVol.state.emigration = {
      shortlistedCountryIds: ['canada'],
      activeApplications: {},
      languageLevels: { canada: 5, CAD: 5 },
      residency: {
        isAbroad: true,
        countryId: 'canada',
        regionId: 'ca_toronto',
        yearsAbroad: 1,
        statusStage: 'temporary',
        permitType: 'skilled',
        abroadWorkMonthsAccumulated: 12,
        checklistDoneIds: [],
        credentialRelicensedTracks: [],
        annualRemittanceCount: 0,
      },
      travelHistory: [],
    };
    const relRes = relicenseCredentialAbroadAction(saveVol, 'medicine', gameDataset);
    expect(relRes.success).toBe(true);
    saveVol = relRes.save;

    const rentRes = rentOrBuyAbroadHousingAction(saveVol, 'canada_rent_studio', 'ca_toronto', gameDataset);
    expect(rentRes.success).toBe(true);
    saveVol = rentRes.save;

    const sellIranRes = sellIranPropertyAndTransferAction(saveVol, 'CAD', 'exchange_office', gameDataset);
    expect(sellIranRes.success).toBe(true);
    saveVol = sellIranRes.save;

    const volRet = returnToIranAction(saveVol, gameDataset);
    expect(volRet.success).toBe(true);
    expect(volRet.save.state.player.countryId).toBe('iran');
    expect(volRet.save.state.emigration?.residency.forcedReturnNoticeFa).toBeUndefined();
  });

  it('5. quotes and executes short foreign trips cleanly across visa-free and visa destinations', () => {
    let save = createNewSaveGame({ seed: 'short-trip', birthJalaliYear: 1380 }, gameDataset);
    save.state.currentJalaliYear = 1405;
    save.state.fxState = initializeFxState(1405, gameDataset);
    save.state.player.age = 25;
    save.state.player.moneyToman = 600_000_000;

    const quote = getShortTripQuote('turkey', 'standard', save.state, gameDataset)!;
    expect(quote.visaType).toBe('visa_free');
    expect(quote.totalLocal).toBeGreaterThan(0);

    const budgetBefore = getAbroadMonthlyBudget(save.state, gameDataset, 'turkey');
    expect(budgetBefore.totalMonthlyLocal).toBeGreaterThan(0);

    const tripRes = takeShortForeignTripAction(save, 'turkey', 'standard', gameDataset);
    expect(tripRes.success).toBe(true);
    save = tripRes.save;
    expect(save.state.emigration?.travelHistory.length).toBe(1);
    expect(save.state.emigration?.activeApplications?.turkey?.status).toBe('researching');
    expect(getFxRate(save.state, 'USD', 'TRY', gameDataset)).toBeGreaterThan(30);
    expect(getWalletBalance(save.state, 'IRT')).toBeLessThan(600_000_000);
  });
});
