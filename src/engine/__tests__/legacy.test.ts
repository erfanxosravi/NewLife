import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import {
  applyCharityFoundationEnding,
  closeDynastyCleanly,
  createDistantRelativeCandidate,
  getEligibleHeirs,
  inheritFromDeceasedToHeir,
  isWillUnlocked,
  normalizeAndValidateWill,
  settleEstate,
} from '../legacy';
import { advanceYear } from '../reducer';
import { SeededRNG } from '../rng';
import { SaveGameSchema } from '../schemas';
import type { SaveGame, WillConfig } from '../types';

function makeDeceasedSaveWithFamily(seed: string, opts?: {
  moneyToman?: number;
  debtToman?: number;
  homeValue?: number;
  hasBusiness?: boolean;
  childCount?: number;
  will?: WillConfig | null;
}): SaveGame {
  const save = createNewSaveGame({ seed, birthJalaliYear: 1355 }, gameDataset);
  const state = save.state;
  state.currentJalaliYear = 1418;
  state.player.age = 63;
  state.player.moneyToman = opts?.moneyToman ?? 8_000_000_000;
  state.player.debtToman = opts?.debtToman ?? 0;
  state.isAlive = false;
  state.player.stats.health = 0;

  if ((opts?.homeValue ?? 0) > 0) {
    state.player.housing = {
      type: 'owned',
      cityId: state.player.currentCityId,
      monthlyRentToman: 0,
      depositRahnToman: 0,
      propertyValueToman: opts!.homeValue!,
    };
  }

  if (opts?.hasBusiness) {
    state.ownedBusiness = {
      id: 'biz_test_1',
      businessTypeId: gameDataset.businesses.businesses[0].id,
      nameFa: 'نانوایی خانوادگی',
      acquisitionMode: 'start_scratch',
      cityId: state.player.currentCityId,
      regionTier: 'mid',
      size: 'small',
      foundedYear: 1395,
      yearsOperating: 23,
      ownershipShare: 1,
      isFranchise: false,
      depositLockedToman: 500_000_000,
      monthlyRentToman: 20_000_000,
      equipmentValueToman: 400_000_000,
      cashReserveToman: 100_000_000,
      branchCount: 1,
      priceStrategy: 'standard',
      reputation: 78,
      customerBase: 90,
      renovationYearsLeft: 0,
      marketingYearsLeft: 0,
      consecutiveLossYears: 0,
      lastYearRevenueToman: 1_200_000_000,
      lastYearCostsToman: { rent: 240_000_000, staff: 300_000_000, supplies: 250_000_000, taxesAndFees: 50_000_000, royalty: 0 },
      lastYearProfitToman: 360_000_000,
      cumulativeProfitToman: 2_500_000_000,
      staff: [],
    };
  }

  const spouseId = 'npc_spouse_1';
  state.npcs[spouseId] = {
    id: spouseId,
    firstName: state.player.gender === 'male' ? 'زهرا' : 'رضا',
    lastName: 'مرادی',
    gender: state.player.gender === 'male' ? 'female' : 'male',
    age: 58,
    traits: ['مهربان'],
    jobTitle: 'بازنشسته',
    isAlive: true,
  };
  state.relationships.push({
    personId: spouseId,
    role: 'spouse',
    closeness: 85,
    respect: 85,
    romance: 75,
  });

  const childCount = opts?.childCount ?? 2;
  for (let i = 0; i < childCount; i++) {
    const cid = `npc_child_${i + 1}`;
    state.npcs[cid] = {
      id: cid,
      firstName: i % 2 === 0 ? 'امیر' : 'سارا',
      lastName: state.player.lastName,
      gender: i % 2 === 0 ? 'male' : 'female',
      age: 28 + i * 3,
      traits: ['پرتلاش'],
      jobTitle: 'مهندس',
      isAlive: true,
    };
    state.relationships.push({
      personId: cid,
      role: 'child',
      closeness: 82,
      respect: 80,
      romance: 0,
    });
  }

  state.will = opts?.will ?? null;
  state.deathSummary = {
    ageAtDeath: 63,
    jalaliYearOfDeath: 1418,
    causeOfDeath: 'ایست قلبی',
    finalNetWorthToman: state.player.moneyToman + state.player.housing.propertyValueToman,
    lifeScore: 620,
    legacyTitle: 'انسانی پربار و الهام‌بخش',
    highlights: ['زندگی پرتلاش'],
  };

  return save;
}

describe('Legacy, Inheritance & Dynasty Engine', () => {
  it('continues heir at exact current age and exact Jalali year with preserved worldSeed and macro state', () => {
    const deceasedSave = makeDeceasedSaveWithFamily('heir-continuity-1', {
      moneyToman: 5_000_000_000,
      homeValue: 4_000_000_000,
      childCount: 2,
    });
    const heirs = getEligibleHeirs(deceasedSave.state, gameDataset);
    expect(heirs.length).toBe(2);
    const chosen = heirs[1]; // Sara, age 31

    const outcome = inheritFromDeceasedToHeir({
      save: deceasedSave,
      heirId: chosen.personId,
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
      dataset: gameDataset,
    });

    const nextState = outcome.save.state;
    expect(nextState.isAlive).toBe(true);
    expect(nextState.player.age).toBe(chosen.age);
    expect(nextState.currentJalaliYear).toBe(deceasedSave.state.currentJalaliYear);
    expect(nextState.worldSeed).toBe(deceasedSave.state.worldSeed);
    expect(nextState.inflationMultiplier).toBe(deceasedSave.state.inflationMultiplier);
    expect(nextState.player.firstName).toBe(chosen.firstName);
    expect(nextState.player.lastName).toBe(chosen.lastName);
    expect(nextState.dynasty?.currentGeneration).toBe(2);
    expect(nextState.dynasty?.chapters.length).toBe(1);
    expect(SaveGameSchema.safeParse(outcome.save).success).toBe(true);
  });

  it('strictly conserves estate money and forgives excess debt beyond gross assets (Art. 868-869)', () => {
    // Solvent estate conservation
    const solvent = makeDeceasedSaveWithFamily('conserve-1', {
      moneyToman: 12_000_000_000,
      debtToman: 2_000_000_000,
      homeValue: 6_000_000_000,
      hasBusiness: true,
    });
    const res = settleEstate({
      state: solvent.state,
      chosenHeirId: 'npc_child_1',
      dataset: gameDataset,
      rng: new SeededRNG('test-conserve'),
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
    });

    const sumDistributed = res.shares.reduce((s, line) => s + line.totalToman, 0);
    expect(
      res.funeralCostToman + res.debtsPaidToman + res.settlementFeeToman + sumDistributed,
    ).toBe(res.grossAssetsToman);
    expect(res.chosenHeirCashToman).toBeGreaterThanOrEqual(0);
    expect(res.forgivenDebtToman).toBe(0);

    // Insolvent estate: debts exceed gross assets -> heirs owe 0 personally, excess forgiven
    const insolvent = makeDeceasedSaveWithFamily('insolvent-1', {
      moneyToman: 500_000_000,
      debtToman: 15_000_000_000,
      homeValue: 0,
    });
    const insRes = settleEstate({
      state: insolvent.state,
      chosenHeirId: 'npc_child_1',
      dataset: gameDataset,
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
    });

    expect(insRes.netDistributableToman).toBe(0);
    expect(insRes.forgivenDebtToman).toBeGreaterThan(0);
    expect(insRes.chosenHeirCashToman).toBe(0);
    expect(insRes.debtsPaidToman + insRes.funeralCostToman).toBe(insRes.grossAssetsToman);

    const outcome = inheritFromDeceasedToHeir({
      save: insolvent,
      heirId: 'npc_child_1',
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
      dataset: gameDataset,
    });
    expect(outcome.save.state.player.debtToman).toBe(0);
    expect(outcome.save.state.player.moneyToman).toBe(0);
  });

  it('enforces the Iranian Civil Code 1/3 limit on wills (Art. 843)', () => {
    const excessWill: WillConfig = {
      updatedAtAge: 60,
      updatedAtYear: 1415,
      divisionPreference: 'civil_code',
      charityPercent: 60,
      beneficiaries: [
        {
          id: 'b1',
          targetType: 'friend',
          labelFa: 'دوست قدیمی',
          sharePercent: 30,
        },
      ],
      specificItems: {},
      letterToHeirsFa: 'مهربان بمانید.',
    };

    const validation = normalizeAndValidateWill(excessWill, gameDataset);
    expect(validation.exceedsOneThird).toBe(true);
    const totalEffective =
      validation.effectiveCharityRatio +
      validation.effectiveBeneficiaries.reduce((s, b) => s + b.effectiveRatio, 0);
    expect(totalEffective).toBeLessThanOrEqual(gameDataset.inheritance.rules.maxWillShareRatio + 0.0001);

    const save = makeDeceasedSaveWithFamily('will-cap-1', {
      moneyToman: 9_000_000_000,
      will: excessWill,
    });
    const settled = settleEstate({
      state: save.state,
      chosenHeirId: 'npc_child_1',
      dataset: gameDataset,
      rng: new SeededRNG('will-cap-rng'),
    });

    const charityAndFriend = settled.shares
      .filter((s) => s.recipientId === 'will_charity' || s.recipientId === 'will_b1')
      .reduce((sum, s) => sum + s.totalToman, 0);
    expect(charityAndFriend).toBeLessThanOrEqual(Math.ceil(settled.netDistributableToman / 3) + 2);
  });

  it('unlocks will at age 50+ or serious illness and handles buy_out_siblings / keep_jointly cleanly', () => {
    const young = createNewSaveGame({ seed: 'will-unlock-1' }, gameDataset);
    young.state.player.age = 30;
    young.state.player.stats.health = 80;
    expect(isWillUnlocked(young.state, gameDataset)).toBe(false);

    young.state.player.stats.health = 25;
    expect(isWillUnlocked(young.state, gameDataset)).toBe(true);

    const save = makeDeceasedSaveWithFamily('buyout-1', {
      moneyToman: 2_000_000_000,
      homeValue: 8_000_000_000,
      hasBusiness: true,
      childCount: 2,
    });
    const outcome = inheritFromDeceasedToHeir({
      save,
      heirId: 'npc_child_1',
      homeDecision: 'buy_out_siblings',
      businessDecision: 'keep_jointly',
      dataset: gameDataset,
    });
    expect(outcome.save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
    expect(outcome.save.state.player.housing.type).toBe('owned');
    expect(outcome.save.state.ownedBusiness).not.toBeNull();
    expect(outcome.save.state.dynasty?.unlockedDynastyRibbons).toContain('dyn_business_steward');
  });

  it('produces identical deterministic dynasty outcomes for identical seeds and decisions', () => {
    const saveA = makeDeceasedSaveWithFamily('det-dynasty-99', {
      moneyToman: 7_500_000_000,
      homeValue: 3_000_000_000,
    });
    const saveB = makeDeceasedSaveWithFamily('det-dynasty-99', {
      moneyToman: 7_500_000_000,
      homeValue: 3_000_000_000,
    });

    const outA = inheritFromDeceasedToHeir({
      save: saveA,
      heirId: 'npc_child_1',
      homeDecision: 'keep_jointly',
      businessDecision: 'sell_and_split',
      dataset: gameDataset,
    });
    const outB = inheritFromDeceasedToHeir({
      save: saveB,
      heirId: 'npc_child_1',
      homeDecision: 'keep_jointly',
      businessDecision: 'sell_and_split',
      dataset: gameDataset,
    });

    expect(outA.settlement).toEqual(outB.settlement);
    expect(outA.save.state.player).toEqual(outB.save.state.player);
    expect(outA.save.state.dynasty).toEqual(outB.save.state.dynasty);
  });

  it('handles no-heir endings (distant relative, charity foundation, clean closing) and macro horizon guard', () => {
    const childless = makeDeceasedSaveWithFamily('no-heir-1', {
      moneyToman: 4_000_000_000,
      childCount: 0,
    });
    expect(getEligibleHeirs(childless.state, gameDataset)).toHaveLength(0);

    const distant = createDistantRelativeCandidate(childless.state, childless.seed, gameDataset);
    const distantOut = inheritFromDeceasedToHeir({
      save: childless,
      heirId: distant.personId,
      distantCandidate: distant,
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
      dataset: gameDataset,
    });
    expect(distantOut.save.state.dynasty?.currentGeneration).toBe(2);

    const charityOut = applyCharityFoundationEnding(childless, gameDataset);
    expect(charityOut.save.state.dynasty?.isClosed).toBe(true);
    expect(charityOut.save.state.dynasty?.unlockedDynastyRibbons).toContain('dyn_charity_founder');

    const closed = closeDynastyCleanly(childless, gameDataset);
    expect(closed.state.dynasty?.isClosed).toBe(true);

    // Macro horizon guard check
    const horizonSave = createNewSaveGame({ seed: 'horizon-test', birthJalaliYear: 1403 }, gameDataset);
    horizonSave.state.currentJalaliYear = gameDataset.inheritance.rules.maxMacroJalaliYear;
    const postHorizon = advanceYear(horizonSave, gameDataset);
    expect(postHorizon.state.isAlive).toBe(false);
    expect(postHorizon.state.horizonEnded).toBe(true);
    expect(postHorizon.state.deathSummary?.legacyTitle).toContain('پایان یک دوران');
  });

  it('batches 5,000 lives across multi-generation heir chains (up to 6 gens) with zero NaN, crashes, or negative wealth', () => {
    const TOTAL_LIVES = 5000;
    const rng = new SeededRNG('batch-5000-dynasties');
    let multiGenTransitions = 0;

    for (let i = 0; i < TOTAL_LIVES; i++) {
      let save = createNewSaveGame({ seed: `dyn-batch-${i}`, birthJalaliYear: 1350 + (i % 40) }, gameDataset);

      // Run a full life (with synthetic child injection every ~6th life to stress 6-gen chains within 5000 lives!)
      let chainGen = 1;
      const maxChainForThisSeed = i % 10 === 0 ? 6 : 1;

      while (chainGen <= maxChainForThisSeed) {
        let safety = 0;
        while (save.state.isAlive && safety < 120) {
          save = advanceYear(save, gameDataset);
          expect(Number.isFinite(save.state.player.moneyToman)).toBe(true);
          expect(Number.isFinite(save.state.player.debtToman)).toBe(true);
          expect(save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
          expect(save.state.player.debtToman).toBeGreaterThanOrEqual(0);
          safety += 1;
        }

        if (chainGen >= maxChainForThisSeed || save.state.horizonEnded) break;

        // Ensure an heir candidate exists for multi-generation stress testing
        if (getEligibleHeirs(save.state, gameDataset).length === 0) {
          const cid = `npc_child_gen${chainGen}`;
          save.state.npcs[cid] = {
            id: cid,
            firstName: 'آرش',
            lastName: save.state.player.lastName,
            gender: rng.chance(0.5) ? 'male' : 'female',
            age: rng.int(18, 36),
            traits: ['پرتلاش'],
            jobTitle: 'کارمند',
            isAlive: true,
          };
          save.state.relationships.push({
            personId: cid,
            role: 'child',
            closeness: rng.int(40, 95),
            respect: rng.int(40, 95),
            romance: 0,
          });
        }

        const heirs = getEligibleHeirs(save.state, gameDataset);
        const chosen = heirs[0];
        const homeDecision = rng.pick(['keep_jointly', 'buy_out_siblings', 'sell_and_split'] as const);
        const bizDecision = rng.pick(['keep_jointly', 'buy_out_siblings', 'sell_and_split'] as const);

        const nextOutcome = inheritFromDeceasedToHeir({
          save,
          heirId: chosen.personId,
          homeDecision,
          businessDecision,
          dataset: gameDataset,
        });

        const { settlement } = nextOutcome;
        const distributed = settlement.shares.reduce((s, l) => s + l.totalToman, 0);
        expect(
          settlement.funeralCostToman +
            settlement.debtsPaidToman +
            settlement.settlementFeeToman +
            distributed,
        ).toBe(settlement.grossAssetsToman);
        expect(nextOutcome.save.state.player.moneyToman).toBeGreaterThanOrEqual(0);
        expect(nextOutcome.save.state.player.debtToman).toBe(0);

        save = nextOutcome.save;
        multiGenTransitions += 1;
        chainGen += 1;
      }

      if (i % 250 === 0) {
        expect(() => SaveGameSchema.parse(save)).not.toThrow();
      }
    }

    expect(multiGenTransitions).toBeGreaterThan(2000);
  }, 45000);
});
