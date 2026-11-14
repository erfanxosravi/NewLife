import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import {
  advanceAdoptionFromReadinessAction,
  completeAdoptionDocumentAction,
  completeAdoptionSupervisionTaskAction,
  conductAdoptionBondingMeetingAction,
  finalizeAdoptionPlacementAction,
  obtainInfertilityCertificateAction,
  respondAdoptionCommitmentAction,
  runAdoptionEvaluationNowAction,
  selectAdoptionCandidateAction,
  startOrSelectAdoptionCareTypeAction,
  submitAdoptionApplicationAction,
} from '../../state/actions';
import { pickPendingEventForTurn } from '../../utils/eventSelector';
import {
  createEmptyAdoptionState,
  evaluateAdoptionEligibility,
  getAdoptionCostEstimates,
  rollInspectorOutcome,
} from '../adoption';
import { createNewSaveGame } from '../generator';
import { getEligibleHeirs, inheritFromDeceasedToHeir, settleEstate } from '../legacy';
import { advanceYear, applyEventChoice } from '../reducer';
import { SeededRNG } from '../rng';
import { SaveGameSchema } from '../schemas';
import type { InspectorOutcome, SaveGame } from '../types';

function makeEligibleCoupleSave(seed = 'adopt_couple_1', marriageYears = 6): SaveGame {
  const save = createNewSaveGame(
    { seed, gender: 'male', birthJalaliYear: 1370 },
    gameDataset,
  );
  const s = save.state;
  s.currentJalaliYear = 1405;
  s.inflationMultiplier = 1;
  s.player.age = 35;
  s.player.countryId = 'iran';
  s.player.maritalStatus = 'married';
  s.player.criminalRecord = 0;
  s.player.stats.health = 85;
  s.player.stats.mentalHealth = 84;
  s.player.moneyToman = 1_500_000_000;
  s.player.housing = {
    type: 'owned',
    cityId: s.player.currentCityId,
    monthlyRentToman: 0,
    depositRahnToman: 0,
    propertyValueToman: 6_500_000_000,
  };
  s.player.job = {
    jobId: gameDataset.jobs[0].id,
    title: gameDataset.jobs[0].titleFa,
    track: gameDataset.jobs[0].track,
    level: 2,
    annualSalaryToman: 600_000_000,
    stress: 30,
    yearsInJob: 6,
  };
  s.flags['married_year'] = s.currentJalaliYear - marriageYears;
  s.npcs['npc_spouse'] = {
    id: 'npc_spouse',
    firstName: 'مریم',
    lastName: 'کاظمی',
    gender: 'female',
    age: 33,
    traits: ['مهربان', 'صبور'],
    jobTitle: 'معلم',
    isAlive: true,
    avatarSeed: 'spouse_seed_1',
  };
  s.relationships.push({
    personId: 'npc_spouse',
    role: 'spouse',
    closeness: 88,
    respect: 85,
    romance: 84,
  });
  return save;
}

function advanceThroughApprovalToPlacement(
  initialSave: SaveGame,
  careType: 'permanent' | 'temporary_guardian' | 'host_family' = 'permanent',
): SaveGame {
  let save = startOrSelectAdoptionCareTypeAction(initialSave, careType, gameDataset).save;
  const readyRes = advanceAdoptionFromReadinessAction(save, gameDataset);
  expect(readyRes.success).toBe(true);
  save = readyRes.save;

  const commitRes = respondAdoptionCommitmentAction(save, true);
  expect(commitRes.success).toBe(true);
  save = commitRes.save;

  for (const doc of gameDataset.adoption.documents) {
    const docRes = completeAdoptionDocumentAction(save, doc.id, gameDataset);
    expect(docRes.success).toBe(true);
    save = docRes.save;
  }

  const subRes = submitAdoptionApplicationAction(save, gameDataset);
  expect(subRes.success).toBe(true);
  save = subRes.save;

  if (save.state.adoption?.activeApplication?.evaluationStatus === 'in_queue') {
    save = advanceYear(save, gameDataset);
  }
  if (save.state.adoption?.activeApplication?.evaluationStatus === 'needs_improvements') {
    save = runAdoptionEvaluationNowAction(save, gameDataset).save;
  }

  const app = save.state.adoption?.activeApplication;
  expect(app?.evaluationStatus).toBe('approved');
  expect(app?.step).toBe('matching');
  expect((app?.matchedCandidates.length ?? 0) > 0).toBe(true);

  const chosen = app!.matchedCandidates[0];
  const reqMeetings = gameDataset.adoption.matching.requiredBondingMeetings;
  for (let i = 0; i < reqMeetings; i += 1) {
    const meetRes = conductAdoptionBondingMeetingAction(save, chosen.tempId, gameDataset);
    expect(meetRes.success).toBe(true);
    save = meetRes.save;
  }

  const selRes = selectAdoptionCandidateAction(save, chosen.tempId, gameDataset);
  expect(selRes.success).toBe(true);
  save = selRes.save;

  const finRes = finalizeAdoptionPlacementAction(save, { enrollSchool: true }, gameDataset);
  expect(finRes.success).toBe(true);
  return finRes.save;
}

describe('Adoption System (Milestone 1)', () => {
  it('enforces Law 1392 eligibility rules across married couples, infertility exception, bio child gap, and single applicants', () => {
    // 1. Married 6 years, age 35 -> eligible + realistic 1405 Toman fee scale
    const eligibleCouple = makeEligibleCoupleSave('elig_1', 6);
    const rep1 = evaluateAdoptionEligibility(eligibleCouple.state, 'permanent', gameDataset);
    expect(rep1.eligible).toBe(true);
    const costs1405 = getAdoptionCostEstimates(eligibleCouple.state, gameDataset);
    expect(costs1405.bondingMeetingCostToman).toBeGreaterThanOrEqual(1_000_000);
    expect(rep1.placementFeeToman).toBeGreaterThanOrEqual(10_000_000);

    // 2. Married 2 years without infertility cert -> blocked; with medical cert -> eligible
    const shortMarriage = makeEligibleCoupleSave('elig_2', 2);
    const rep2 = evaluateAdoptionEligibility(shortMarriage.state, 'permanent', gameDataset);
    expect(rep2.eligible).toBe(false);
    expect(rep2.canTakeInfertilityTest).toBe(true);
    const afterCert = obtainInfertilityCertificateAction(shortMarriage, gameDataset);
    expect(afterCert.success).toBe(true);
    const rep2After = evaluateAdoptionEligibility(afterCert.save.state, 'permanent', gameDataset);
    expect(rep2After.eligible).toBe(true);

    // 3. Bio child age 1 blocks permanent (minGap = 2); bio child age 4 caps child age at 2
    const withBaby = makeEligibleCoupleSave('elig_3', 6);
    withBaby.state.npcs['npc_bio_baby'] = {
      id: 'npc_bio_baby',
      firstName: 'آوا',
      lastName: 'شریفی',
      gender: 'female',
      age: 1,
      traits: ['آرام'],
      jobTitle: 'کودک',
      isAlive: true,
      originKind: 'biological',
    };
    withBaby.state.relationships.push({
      personId: 'npc_bio_baby',
      role: 'child',
      closeness: 90,
      respect: 70,
      romance: 0,
    });
    expect(evaluateAdoptionEligibility(withBaby.state, 'permanent', gameDataset).eligible).toBe(false);
    withBaby.state.npcs['npc_bio_baby'].age = 4;
    const repOlderBio = evaluateAdoptionEligibility(withBaby.state, 'permanent', gameDataset);
    expect(repOlderBio.eligible).toBe(true);
    expect(repOlderBio.maxAllowedChildAge).toBe(2);

    // 4. Single woman >= 30 -> eligible, female child only
    const singleWoman = createNewSaveGame({ seed: 'sw_1', gender: 'female', birthJalaliYear: 1372 }, gameDataset);
    singleWoman.state.currentJalaliYear = 1405;
    singleWoman.state.inflationMultiplier = 1;
    singleWoman.state.player.age = 33;
    singleWoman.state.player.stats.health = 80;
    singleWoman.state.player.stats.mentalHealth = 80;
    singleWoman.state.player.moneyToman = 1_200_000_000;
    singleWoman.state.player.housing.type = 'rent';
    const repSW = evaluateAdoptionEligibility(singleWoman.state, 'permanent', gameDataset);
    expect(repSW.eligible).toBe(true);
    expect(repSW.singleWomanFemaleOnly).toBe(true);

    // 5. Single man -> ineligible under Law 1392
    const singleMan = createNewSaveGame({ seed: 'sm_1', gender: 'male', birthJalaliYear: 1372 }, gameDataset);
    singleMan.state.currentJalaliYear = 1405;
    singleMan.state.inflationMultiplier = 1;
    singleMan.state.player.age = 33;
    singleMan.state.player.moneyToman = 1_200_000_000;
    singleMan.state.player.housing.type = 'owned';
    expect(evaluateAdoptionEligibility(singleMan.state, 'permanent', gameDataset).eligible).toBe(false);

    // 6. Criminal record / low mental health / abroad -> blocked
    const withCrime = makeEligibleCoupleSave('crime_1', 6);
    withCrime.state.player.criminalRecord = 1;
    expect(evaluateAdoptionEligibility(withCrime.state, 'permanent', gameDataset).eligible).toBe(false);

    const abroad = makeEligibleCoupleSave('abroad_1', 6);
    abroad.state.player.countryId = 'germany';
    expect(evaluateAdoptionEligibility(abroad.state, 'permanent', gameDataset).eligible).toBe(false);
  });

  it('prevents bypassing evaluation approval and generates independent child/inspector avatars across the 7-step flow', () => {
    const base = makeEligibleCoupleSave('flow_invariant', 7);
    const started = startOrSelectAdoptionCareTypeAction(base, 'permanent', gameDataset).save;

    // Premature placement must fail strictly
    const premature = finalizeAdoptionPlacementAction(started, {}, gameDataset);
    expect(premature.success).toBe(false);

    // Pause for reflection works cleanly
    const step2 = advanceAdoptionFromReadinessAction(started, gameDataset).save;
    const paused = respondAdoptionCommitmentAction(step2, false).save;
    expect(paused.state.adoption?.activeApplication?.pausedForReflection).toBe(true);
    expect(paused.state.adoption?.activeApplication?.step).toBe('commitment');

    const placed = advanceThroughApprovalToPlacement(base, 'permanent');
    const app = placed.state.adoption?.activeApplication;
    expect(app?.step).toBe('supervision');
    expect(app?.courtDecreeIssued).toBe(true);
    expect(app?.placedChildPersonId).toBeDefined();
    expect(app?.nextVisitYear).toBe(placed.state.currentJalaliYear + 1);

    const child = placed.state.npcs[app!.placedChildPersonId!];
    const inspector = placed.state.npcs[app!.inspectorPersonId!];
    expect(child).toBeDefined();
    expect(child.originKind).toBe('adopted');
    expect(child.avatarSeed).toBeTruthy();
    expect(child.avatarSeed).not.toBe(placed.state.player.avatarSeed);
    expect(inspector).toBeDefined();
    expect(inspector.originKind).toBe('inspector');
    expect(inspector.avatarSeed).toBeTruthy();
    expect(inspector.avatarSeed).not.toBe(child.avatarSeed);
    expect(placed.state.unlockedAchievements).toContain('loving_home');
  });

  it('matches only female child candidates for single women over 30', () => {
    const sw = createNewSaveGame({ seed: 'sw_match', gender: 'female', birthJalaliYear: 1371 }, gameDataset);
    sw.state.currentJalaliYear = 1405;
    sw.state.inflationMultiplier = 1;
    sw.state.player.age = 34;
    sw.state.player.stats.health = 88;
    sw.state.player.stats.mentalHealth = 88;
    sw.state.player.moneyToman = 1_500_000_000;
    sw.state.player.housing = {
      type: 'owned',
      cityId: sw.state.player.currentCityId,
      monthlyRentToman: 0,
      depositRahnToman: 0,
      propertyValueToman: 6_000_000_000,
    };
    sw.state.player.job = {
      jobId: gameDataset.jobs[0].id,
      title: gameDataset.jobs[0].titleFa,
      track: gameDataset.jobs[0].track,
      level: 2,
      annualSalaryToman: 500_000_000,
      stress: 25,
      yearsInJob: 5,
    };

    let s = startOrSelectAdoptionCareTypeAction(sw, 'permanent', gameDataset).save;
    s = advanceAdoptionFromReadinessAction(s, gameDataset).save;
    s = respondAdoptionCommitmentAction(s, true).save;
    for (const doc of gameDataset.adoption.documents) {
      s = completeAdoptionDocumentAction(s, doc.id, gameDataset).save;
    }
    s = submitAdoptionApplicationAction(s, gameDataset).save;
    if (s.state.adoption?.activeApplication?.evaluationStatus === 'in_queue') {
      s = advanceYear(s, gameDataset);
    }
    const candidates = s.state.adoption?.activeApplication?.matchedCandidates ?? [];
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.gender === 'female')).toBe(true);
  });

  it('schedules first inspector visit the year AFTER placement and closes supervision cleanly at age 18', () => {
    const placed = advanceThroughApprovalToPlacement(makeEligibleCoupleSave('supervision_1', 6), 'permanent');
    const childId = placed.state.adoption!.activeApplication!.placedChildPersonId!;
    // Zero visits in placement year
    expect(placed.state.adoption!.supervisionVisits.length).toBe(0);

    // Advance 1 year -> first visit triggers
    let simSave = advanceYear(placed, gameDataset);
    expect(simSave.state.adoption!.supervisionVisits.length).toBe(1);
    expect(simSave.state.adoption!.supervisionVisits[0].jalaliYear).toBe(
      placed.state.currentJalaliYear + 1,
    );

    // Complete any generated task if needs_improvement / serious_concern
    const firstVisit = simSave.state.adoption!.supervisionVisits[0];
    if (firstVisit.tasks.length > 0) {
      const doneRes = completeAdoptionSupervisionTaskAction(
        simSave,
        firstVisit.id,
        firstVisit.tasks[0].id,
      );
      expect(doneRes.success).toBe(true);
      simSave = doneRes.save;
      expect(simSave.state.adoption!.supervisionVisits[0].tasks[0].completed).toBe(true);
    }

    // Advance until child reaches 18
    let guard = 0;
    while (simSave.state.npcs[childId].age < 18 && guard < 22) {
      simSave = advanceYear(simSave, gameDataset);
      guard += 1;
    }
    expect(simSave.state.npcs[childId].age).toBeGreaterThanOrEqual(18);
    expect(simSave.state.npcs[childId].adoptionMeta?.supervisionClosedAt18).toBe(true);
    expect(simSave.state.adoption?.activeApplication).toBeNull();

    const visitCountAt18 = simSave.state.adoption!.supervisionVisits.length;
    // Advancing more years never triggers visits for that child after 18
    simSave = advanceYear(simSave, gameDataset);
    simSave = advanceYear(simSave, gameDataset);
    expect(simSave.state.adoption!.supervisionVisits.length).toBe(visitCountAt18);
  });

  it('produces reasonable inspector outcome distribution across 200+ seeded simulations', () => {
    const base = makeEligibleCoupleSave('dist_base', 6);
    const counts: Record<InspectorOutcome, number> = {
      great: 0,
      satisfactory: 0,
      needs_improvement: 0,
      serious_concern: 0,
    };
    for (let i = 0; i < 240; i += 1) {
      const outcome = rollInspectorOutcome(
        base.state,
        80,
        false,
        new SeededRNG(`insp_dist_${i}`),
        gameDataset,
      );
      counts[outcome] += 1;
    }
    expect(counts.great).toBeGreaterThan(60);
    expect(counts.satisfactory).toBeGreaterThan(50);
    expect(counts.needs_improvement).toBeGreaterThan(5);
    expect(counts.great + counts.satisfactory).toBeGreaterThan(counts.serious_concern * 5);
  });

  it('triggers long-term adoption events from adoption.json when flags and age match', () => {
    const placed = advanceThroughApprovalToPlacement(makeEligibleCoupleSave('ev_adopt', 7), 'permanent');
    placed.state.flags['has_adopted_child'] = true;
    placed.state.flags['has_adopted_teen_or_preteen'] = true;
    placed.state.player.age = 38;

    const adoptionEventIds = new Set(gameDataset.adoption.longTermEvents.map((e) => e.id));
    let matchedAdoptionEvent = null;
    for (let i = 0; i < 80; i += 1) {
      const candidateSave: SaveGame = {
        ...placed,
        seed: `pick_adopt_${i}`,
        state: { ...placed.state, turn: i + 1 },
      };
      const picked = pickPendingEventForTurn(candidateSave, gameDataset);
      if (picked && adoptionEventIds.has(picked.id)) {
        matchedAdoptionEvent = picked;
        break;
      }
    }
    expect(matchedAdoptionEvent).not.toBeNull();

    const applied = applyEventChoice(
      placed,
      matchedAdoptionEvent!,
      matchedAdoptionEvent!.choices[0],
    );
    expect(applied.state.eventHistory[matchedAdoptionEvent!.id]).toBeGreaterThanOrEqual(1);
  });

  it('includes permanent adopted children in inheritance/heirs while excluding temporary guardianship and host family', () => {
    const save = advanceThroughApprovalToPlacement(makeEligibleCoupleSave('heir_adopt', 8), 'permanent');
    const permChildId = save.state.adoption!.activeApplication!.placedChildPersonId!;

    // Also add a temporary_guardian child and host_family child to verify exclusion
    save.state.npcs['npc_temp_kid'] = {
      id: 'npc_temp_kid',
      firstName: 'نیما',
      lastName: 'احمدی',
      gender: 'male',
      age: 9,
      traits: ['آرام'],
      jobTitle: 'دانش‌آموز',
      isAlive: true,
      originKind: 'temporary_guardian',
    };
    save.state.relationships.push({
      personId: 'npc_temp_kid',
      role: 'child',
      closeness: 75,
      respect: 70,
      romance: 0,
    });

    save.state.npcs['npc_host_kid'] = {
      id: 'npc_host_kid',
      firstName: 'سارا',
      lastName: 'اکبری',
      gender: 'female',
      age: 10,
      traits: ['مهربان'],
      jobTitle: 'دانش‌آموز',
      isAlive: true,
      originKind: 'host_family',
    };
    save.state.relationships.push({
      personId: 'npc_host_kid',
      role: 'child',
      closeness: 70,
      respect: 70,
      romance: 0,
    });

    save.state.isAlive = false;
    const heirs = getEligibleHeirs(save.state, gameDataset);
    expect(heirs.some((h) => h.personId === permChildId)).toBe(true);
    expect(heirs.some((h) => h.personId === 'npc_temp_kid')).toBe(false);
    expect(heirs.some((h) => h.personId === 'npc_host_kid')).toBe(false);

    const permHeir = heirs.find((h) => h.personId === permChildId)!;
    const settlement = settleEstate({
      state: save.state,
      chosenHeirId: permChildId,
      dataset: gameDataset,
    });
    expect(settlement.shares.some((s) => s.recipientId === permChildId)).toBe(true);
    expect(settlement.shares.some((s) => s.recipientId === 'npc_temp_kid')).toBe(false);

    const inherited = inheritFromDeceasedToHeir({
      save,
      heirId: permHeir.personId,
      homeDecision: 'keep_jointly',
      businessDecision: 'keep_jointly',
      dataset: gameDataset,
    });
    expect(inherited.save.state.isAlive).toBe(true);
    expect(inherited.save.state.player.firstName).toBe(save.state.npcs[permChildId].firstName);
    expect(inherited.save.state.player.avatarSeed).toBe(save.state.npcs[permChildId].avatarSeed);
    expect(inherited.save.state.adoption?.activeApplication).toBeNull();
  });

  it('supports welfare_center starting scenario with mentor NPC and age-18 empowerment grant', () => {
    const save = createNewSaveGame(
      { seed: 'welfare_pack_1', startingScenarioId: 'welfare_center', birthJalaliYear: 1388 },
      gameDataset,
    );
    expect(save.state.player.raisedInWelfareCenter).toBe(true);
    expect(save.state.player.moneyToman).toBe(0);
    expect(save.state.npcs['npc_mentor_welfare']?.originKind).toBe('mentor');

    let simSave: SaveGame = {
      ...save,
      state: {
        ...save.state,
        player: { ...save.state.player, age: 17 },
        currentJalaliYear: 1405,
      },
    };
    simSave = advanceYear(simSave, gameDataset);
    expect(simSave.state.player.age).toBe(18);
    expect(simSave.state.flags['welfare_ms_18']).toBe(true);
    expect(simSave.state.player.moneyToman).toBeGreaterThan(0);
    expect(simSave.state.timeline.some((t) => t.id.includes('welfare_ageout'))).toBe(true);
  });

  it('maintains schema validity and deterministic results under identical seeds', () => {
    const a1 = createNewSaveGame({ seed: 'det_adopt_1', birthJalaliYear: 1370 }, gameDataset);
    const a2 = createNewSaveGame({ seed: 'det_adopt_1', birthJalaliYear: 1370 }, gameDataset);
    expect(a1.state.player.avatarSeed).toBe(a2.state.player.avatarSeed);
    expect(a1.state.adoption).toEqual(createEmptyAdoptionState());

    const p1 = advanceThroughApprovalToPlacement(makeEligibleCoupleSave('det_flow_1', 6), 'temporary_guardian');
    const p2 = advanceThroughApprovalToPlacement(makeEligibleCoupleSave('det_flow_1', 6), 'temporary_guardian');
    expect(p1.state.adoption).toEqual(p2.state.adoption);
    expect(() => SaveGameSchema.parse(p1)).not.toThrow();
  });
});
