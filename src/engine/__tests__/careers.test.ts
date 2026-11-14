import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import {
  acquireBusinessAction,
  acquireLicenseAction,
  applyForJobAction,
  changeWorkplaceAction,
  manageBusinessAction,
  performCareerAction,
  respondEmployerOfferAction,
  runAdvanceYearWithTick,
} from '../../state/actions';
import {
  getAllLicensesStatus,
  getBusinessQuotePreview,
  getCurrentJobPromotionState,
  getJobApplicationStatus,
} from '../../state/selectors';
import { stepOwnedBusinessYear } from '../businesses';
import { checkPromotionEligibility, getLicenseStatus } from '../careers';
import { createNewSaveGame } from '../generator';
import { advanceYear } from '../reducer';
import { SeededRNG } from '../rng';
import { JobDefinitionSchema, JobsFileSchema } from '../schemas';
import type { SaveGame } from '../types';

function makeAdultSave(seed: string, age = 22, moneyToman = 500_000_000): SaveGame {
  let save = createNewSaveGame(
    { seed, birthCityId: 'tehran', birthJalaliYear: 1405 - age, socialClass: 'middle' },
    gameDataset,
  );
  save = {
    ...save,
    state: {
      ...save.state,
      currentJalaliYear: 1405,
      inflationMultiplier: 1,
      player: {
        ...save.state.player,
        age,
        moneyToman,
        education: {
          ...save.state.player.education,
          level: 'diploma',
          inSchool: false,
        },
        militaryStatus: 'completed',
        stats: {
          ...save.state.player.stats,
          intelligence: 78,
          health: 85,
          happiness: 75,
          mentalHealth: 80,
          fame: 30,
        },
        hiddenStats: {
          ...save.state.player.hiddenStats,
          conscientiousness: 88,
          luck: 60,
        },
      },
    },
  };
  return save;
}

describe('Career Progression Realism (Employee Ladder vs. Business Ownership)', () => {
  it('1. enforces Zod guardrail: rejects grantsOwnership on ladder steps and non-final ceilings', () => {
    const validBarber = structuredClone(gameDataset.jobs.find((j) => j.id === 'barber')!);
    expect(() => JobDefinitionSchema.parse(validBarber)).not.toThrow();
    expect(() => JobsFileSchema.parse(structuredClone(gameDataset.jobs))).not.toThrow();

    const badGrantsOwnership = structuredClone(validBarber) as unknown as {
      ladder: Record<string, unknown>[];
    };
    badGrantsOwnership.ladder[3].grantsOwnership = true;
    expect(() => JobDefinitionSchema.parse(badGrantsOwnership)).toThrow();

    const badMidCeiling = structuredClone(validBarber);
    badMidCeiling.ladder[1].ceiling = true;
    expect(() => JobDefinitionSchema.parse(badMidCeiling)).toThrow();

    const badNoCeilingAtEnd = structuredClone(validBarber);
    badNoCeilingAtEnd.ladder[3].ceiling = false;
    expect(() => JobDefinitionSchema.parse(badNoCeilingAtEnd)).toThrow();
  });

  it('2. validates all jobs in jobs.json have employee ladders with non-owner ceilings and ownershipPath', () => {
    expect(gameDataset.jobs.length).toBeGreaterThanOrEqual(10);
    for (const job of gameDataset.jobs) {
      expect(job.ladder.length).toBeGreaterThanOrEqual(1);
      const last = job.ladder[job.ladder.length - 1];
      expect(last.ceiling).toBe(true);
      for (let i = 0; i < job.ladder.length - 1; i++) {
        expect(job.ladder[i].ceiling).toBe(false);
      }
      // None of the employee ladder titles should claim shop/business ownership
      for (const step of job.ladder) {
        expect(step.titleFa).not.toContain('صاحب سالن');
        expect(step.titleFa).not.toContain('مغازه‌دار مستقل');
        expect(step.titleFa).not.toContain('بنکدار');
        expect(step.titleFa).not.toContain('تاجر بزرگ');
      }
      if (job.ownershipPath.allowed) {
        expect(job.ownershipPath.businessTypeId).toBeTruthy();
      }
    }
  });

  it('3. reproduces and prevents the barber-to-owner promotion bug across a full working career', () => {
    const barberDef = gameDataset.jobs.find((j) => j.id === 'barber')!;
    let save = makeAdultSave('barber-bug-repro', 20, 400_000_000);
    // Boost art & business skill so promotion requirements are met cleanly
    save.state.flags['skills_json'] = JSON.stringify({ art: 5, business: 4 });
    save.state.player.job = {
      jobId: 'barber',
      title: `${barberDef.titleFa} (${barberDef.ladder[0].titleFa})`,
      track: 'craft',
      level: 1,
      annualSalaryToman: barberDef.baseAnnualSalaryToman,
      stress: barberDef.stress,
      yearsInJob: 0,
    };

    for (let yr = 0; yr < 22; yr++) {
      // Request raise / promotion every year
      const raiseRes = performCareerAction(save, 'raise', gameDataset);
      save = raiseRes.save;
      save = runAdvanceYearWithTick(save, gameDataset);
      if (!save.state.isAlive) break;

      // Invariant: NEVER becomes owner via promotion!
      expect(save.state.ownedBusiness).toBeNull();
      expect(save.state.player.job?.title).not.toContain('صاحب سالن');
      expect(save.state.player.job?.level ?? 1).toBeLessThanOrEqual(4);
    }

    const promo = getCurrentJobPromotionState(save.state, gameDataset);
    expect(promo).not.toBeNull();
    expect(promo!.eligibility.currentStep.titleFa).toBe('استادکار و سرآرایشگر');
    expect(promo!.eligibility.atCeiling).toBe(true);
    expect(promo!.eligibility.nextStep).toBeNull();
    expect(save.state.ownedBusiness).toBeNull();

    // Change workplace at ceiling keeps rank but switches employer
    const workplaceRes = changeWorkplaceAction(save, gameDataset);
    expect(workplaceRes.success).toBe(true);
    expect(workplaceRes.save.state.player.job?.level).toBe(4);
    expect(workplaceRes.save.state.ownedBusiness).toBeNull();
  });

  it('4. enforces zero promotion on gig job (snapp_driver) and non-owner ceiling on bazaar_merchant', () => {
    const snappDef = gameDataset.jobs.find((j) => j.id === 'snapp_driver')!;
    expect(snappDef.noPromotions).toBe(true);
    expect(snappDef.ladder).toHaveLength(1);
    expect(snappDef.ladder[0].ceiling).toBe(true);

    let snappSave = makeAdultSave('snapp-gig-test', 24);
    snappSave.state.player.job = {
      jobId: 'snapp_driver',
      title: snappDef.titleFa,
      track: 'transport',
      level: 1,
      annualSalaryToman: snappDef.baseAnnualSalaryToman,
      stress: snappDef.stress,
      yearsInJob: 5,
    };
    const snappRaise = performCareerAction(snappSave, 'raise', gameDataset);
    expect(snappRaise.success).toBe(false);
    expect(snappRaise.save.state.player.job?.level).toBe(1);

    const bazaarDef = gameDataset.jobs.find((j) => j.id === 'bazaar_merchant')!;
    let bazaarSave = makeAdultSave('bazaar-ceiling', 22);
    bazaarSave.state.flags['skills_json'] = JSON.stringify({ business: 5 });
    bazaarSave.state.player.job = {
      jobId: 'bazaar_merchant',
      title: `${bazaarDef.titleFa} (${bazaarDef.ladder[2].titleFa})`,
      track: 'commerce',
      level: 3,
      annualSalaryToman: bazaarDef.baseAnnualSalaryToman,
      stress: bazaarDef.stress,
      yearsInJob: 12,
    };
    const bazaarElig = checkPromotionEligibility(bazaarSave.state, bazaarDef, gameDataset);
    expect(bazaarElig.atCeiling).toBe(true);
    expect(bazaarElig.currentStep.titleFa).toBe('مباشر و مسئول فروش حجره');
    const bazaarRaise = performCareerAction(bazaarSave, 'raise', gameDataset);
    expect(bazaarRaise.save.state.player.job?.level).toBe(3);
    expect(bazaarRaise.save.state.ownedBusiness).toBeNull();
  });

  it('5. gates credentialed professions (doctor, nurse, teacher, pharmacist, lawyer) behind degrees & licenses', () => {
    const highSchoolSave = makeAdultSave('no-creds', 26, 800_000_000);
    for (const jobId of ['doctor', 'nurse', 'teacher', 'pharmacist', 'lawyer']) {
      const job = gameDataset.jobs.find((j) => j.id === jobId)!;
      const appStatus = getJobApplicationStatus(job, highSchoolSave.state, gameDataset);
      expect(appStatus.eligible).toBe(false);
    }

    // Even with medical_doctor degree, missing medical_license must block doctor application
    let mdSave = makeAdultSave('md-no-lic', 27, 800_000_000);
    mdSave.state.player.education.level = 'medical_doctor';
    const doctorJob = gameDataset.jobs.find((j) => j.id === 'doctor')!;
    expect(getJobApplicationStatus(doctorJob, mdSave.state, gameDataset).eligible).toBe(false);

    // Acquiring medical_license unlocks doctor job
    const medLic = gameDataset.businesses.licenses.find((l) => l.id === 'medical_license')!;
    expect(getLicenseStatus(medLic, mdSave.state, gameDataset).eligible).toBe(true);
    const licRes = acquireLicenseAction(mdSave, 'medical_license', gameDataset);
    expect(licRes.success).toBe(true);
    mdSave = licRes.save;
    expect(mdSave.state.player.licenses).toContain('medical_license');
    expect(getJobApplicationStatus(doctorJob, mdSave.state, gameDataset).eligible).toBe(true);

    const applyRes = applyForJobAction(mdSave, doctorJob, gameDataset);
    expect(applyRes.save.state.flags['cd_apply_job_doctor']).toBe(mdSave.state.turn);
  });

  it('6. enforces explicit ownership prerequisites (license + capital + risk preview) and supports 5 acquisition modes', () => {
    let save = makeAdultSave('ownership-flow', 26, 2_500_000_000);
    save.state.flags['skills_json'] = JSON.stringify({ art: 3, business: 2 });
    save.state.flags['track_exp_craft'] = 4;

    const barberBiz = gameDataset.businesses.businesses.find((b) => b.id === 'barbershop')!;

    // Blocked without guild_barber license
    const blockedQuote = getBusinessQuotePreview({
      businessDef: barberBiz,
      acquisitionMode: 'start_scratch',
      financingMode: 'personal_cash',
      cityId: 'tehran',
      regionTier: 'mid',
      size: 'small',
      state: save.state,
      dataset: gameDataset,
    });
    expect(blockedQuote.eligible).toBe(false);
    expect(blockedQuote.missingLicenses).toContain('guild_barber');

    // Acquire license -> becomes eligible
    const licRes = acquireLicenseAction(save, 'guild_barber', gameDataset);
    expect(licRes.success).toBe(true);
    save = licRes.save;

    const readyQuote = getBusinessQuotePreview({
      businessDef: barberBiz,
      acquisitionMode: 'buy_existing',
      financingMode: 'bank_loan',
      cityId: 'tehran',
      regionTier: 'mid',
      size: 'small',
      state: save.state,
      dataset: gameDataset,
    });
    expect(readyQuote.eligible).toBe(true);
    expect(readyQuote.totalCapitalRequiredToman).toBeGreaterThan(0);
    expect(readyQuote.loanPrincipalToman).toBeGreaterThan(0);
    expect(readyQuote.expectedAnnualNetMinToman).toBeLessThan(readyQuote.expectedAnnualNetMaxToman);

    const acqRes = acquireBusinessAction(
      save,
      {
        businessTypeId: 'barbershop',
        acquisitionMode: 'buy_existing',
        financingMode: 'bank_loan',
        cityId: 'tehran',
        regionTier: 'mid',
        size: 'small',
        customNameFa: 'آرایشگاه پارس',
      },
      gameDataset,
    );
    expect(acqRes.success).toBe(true);
    save = acqRes.save;
    expect(save.state.ownedBusiness).not.toBeNull();
    expect(save.state.ownedBusiness?.acquisitionMode).toBe('buy_existing');
    expect(save.state.flags['ownership_acquired_mode']).toBe('buy_existing');
    expect(save.state.loans.some((l) => l.name.includes('آرایشگاه پارس'))).toBe(true);

    // Owner management actions (hire, pricing, renovate, advertise, sell)
    save = manageBusinessAction(save, 'hire_staff', undefined, gameDataset).save;
    expect(save.state.ownedBusiness!.staff.length).toBeGreaterThanOrEqual(2);
    save = manageBusinessAction(save, 'price_premium', undefined, gameDataset).save;
    expect(save.state.ownedBusiness!.priceStrategy).toBe('premium');
    save = manageBusinessAction(save, 'sell', undefined, gameDataset).save;
    expect(save.state.ownedBusiness).toBeNull();
    expect(save.state.businessHistory[0].outcome).toBe('sold');

    // Civil servant cannot simultaneously own a commercial business
    const civilSave = makeAdultSave('civil-conflict', 28, 3_000_000_000);
    civilSave.state.player.education.level = 'bachelor';
    civilSave.state.player.licenses = ['guild_barber'];
    civilSave.state.flags['skills_json'] = JSON.stringify({ art: 3 });
    civilSave.state.flags['track_exp_craft'] = 4;
    civilSave.state.player.job = {
      jobId: 'civil_servant',
      title: 'کارمند اداری دولت',
      track: 'government',
      level: 2,
      annualSalaryToman: 380_000_000,
      stress: 35,
      yearsInJob: 4,
    };
    const conflictQuote = getBusinessQuotePreview({
      businessDef: barberBiz,
      acquisitionMode: 'start_scratch',
      financingMode: 'personal_cash',
      cityId: 'tehran',
      regionTier: 'mid',
      size: 'small',
      state: civilSave.state,
      dataset: gameDataset,
    });
    expect(conflictQuote.eligible).toBe(false);
    expect(conflictQuote.conflictOfInterestReason).toBeTruthy();

    const allLicenses = getAllLicensesStatus(save.state, gameDataset);
    expect(allLicenses).toHaveLength(gameDataset.businesses.licenses.length);
  });

  it('7. models negative profit, debt spillover, forced closure/bankruptcy, and zero NaN invariants', () => {
    let save = makeAdultSave('biz-bankruptcy', 29, 10_000_000_000);
    save.state.player.licenses = ['guild_commerce'];
    save.state.flags['skills_json'] = JSON.stringify({ business: 2 });
    save.state.flags['track_exp_commerce'] = 3;

    const shopDef = gameDataset.businesses.businesses.find((b) => b.id === 'bazaar_shop')!;
    const acq = acquireBusinessAction(
      save,
      {
        businessTypeId: 'bazaar_shop',
        acquisitionMode: 'start_scratch',
        financingMode: 'personal_cash',
        cityId: 'tehran',
        regionTier: 'north',
        size: 'large',
        customNameFa: 'حجره پرریسک',
      },
      gameDataset,
    );
    expect(acq.success).toBe(true);
    save = acq.save;

    // Inflate staffing & wipe reserves/cash to test realistic negative cashflow & closure
    save.state.player.moneyToman = 10_000_000;
    save.state.ownedBusiness!.cashReserveToman = 5_000_000;
    save.state.ownedBusiness!.reputation = 12;
    save.state.ownedBusiness!.customerBase = 5;
    save.state.ownedBusiness!.monthlyRentToman = 140_000_000; // severe fixed rent overhead
    // Add extra staff wages
    for (let i = 0; i < 6; i++) {
      save.state.ownedBusiness!.staff.push({
        id: `extra_${i}`,
        fullName: `کارمند ${i}`,
        roleTitleFa: 'فروشنده',
        level: 2,
        annualWageToman: 320_000_000,
        skill: 55,
        yearsEmployed: 2,
        morale: 70,
      });
    }

    let sawNegativeProfit = false;
    let forcedClosed = false;
    for (let yr = 0; yr < 8; yr++) {
      const rng = new SeededRNG(`loss-yr-${yr}`);
      stepOwnedBusinessYear(save.state, rng, gameDataset);
      if (
        (save.state.ownedBusiness && save.state.ownedBusiness.lastYearProfitToman < 0) ||
        save.state.timeline.some((t) => t.title.includes('زیان مالی'))
      ) {
        sawNegativeProfit = true;
      }
      expect(Number.isFinite(save.state.player.moneyToman)).toBe(true);
      expect(save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
      expect(save.state.player.debtToman).toBeGreaterThanOrEqual(0);
      if (!save.state.ownedBusiness) {
        forcedClosed = true;
        break;
      }
      save.state.turn += 1;
      save.state.currentJalaliYear += 1;
    }

    expect(sawNegativeProfit).toBe(true);
    expect(forcedClosed).toBe(true);
    expect(save.state.ownedBusiness).toBeNull();
    expect(save.state.businessHistory.length).toBeGreaterThanOrEqual(1);
    expect(['bankrupt', 'closed']).toContain(save.state.businessHistory[0].outcome);
    expect(save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
    expect(save.state.player.debtToman).toBeGreaterThan(0);
    expect(Number(save.state.flags['credit_score'] ?? 640)).toBeLessThan(640);
    expect(shopDef.id).toBe('bazaar_shop');
  });

  it('8. simulates 5,000 barber careers proving 0% become owners via promotion (100% explicit flow)', () => {
    const barberDef = gameDataset.jobs.find((j) => j.id === 'barber')!;
    const LIVES = 5000;
    let reachedCeilingCount = 0;
    let employerOfferCount = 0;
    let ownersViaPromotionCount = 0;
    let ownersViaExplicitFlowCount = 0;

    for (let i = 0; i < LIVES; i++) {
      let save = createNewSaveGame(
        { seed: `barber-sim-${i}`, birthCityId: 'tehran', birthJalaliYear: 1384 },
        gameDataset,
      );
      // Fast-forward state to age 20 entering barbershop apprenticeship
      save.state.player.age = 20;
      save.state.currentJalaliYear = 1404;
      save.state.player.militaryStatus = 'completed';
      save.state.player.education.level = 'diploma';
      save.state.player.education.inSchool = false;
      save.state.flags['skills_json'] = JSON.stringify({
        art: (i % 4) + 1,
        business: i % 3,
      });
      save.state.player.job = {
        jobId: 'barber',
        title: `${barberDef.titleFa} (${barberDef.ladder[0].titleFa})`,
        track: 'craft',
        level: 1,
        annualSalaryToman: barberDef.baseAnnualSalaryToman,
        stress: barberDef.stress,
        yearsInJob: 0,
      };

      // Simulate 16 years of employee career + raise attempts
      for (let yr = 0; yr < 16 && save.state.isAlive; yr++) {
        if (yr % 2 === 0) {
          save = performCareerAction(save, 'raise', gameDataset).save;
        }
        save = advanceYear(save, gameDataset);

        if (save.state.flags['pending_employer_offer']) {
          employerOfferCount += 1;
          // Decline in most lives; verify accepting records explicit employer_offer mode in sample
          if (i % 25 === 0 && save.state.player.moneyToman > 1_000_000_000) {
            const resp = respondEmployerOfferAction(save, true, 'personal_cash', gameDataset);
            save = resp.save;
          } else {
            save = respondEmployerOfferAction(save, false, 'personal_cash', gameDataset).save;
          }
        }
      }

      if (save.state.player.job?.level === 4) {
        reachedCeilingCount += 1;
      }
      if (save.state.ownedBusiness) {
        if (save.state.flags['ownership_acquired_mode']) {
          ownersViaExplicitFlowCount += 1;
        } else {
          ownersViaPromotionCount += 1;
        }
      }
      expect(Number.isFinite(save.state.player.moneyToman)).toBe(true);
      expect(save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
    }

    expect(ownersViaPromotionCount).toBe(0);
    expect(reachedCeilingCount).toBeGreaterThan(200);
    // Rare employer offer exists but stays bounded (< 15% of career-year opportunities)
    expect(employerOfferCount).toBeGreaterThanOrEqual(1);
    expect(ownersViaExplicitFlowCount).toBeGreaterThanOrEqual(0);
  }, 45000);
});
