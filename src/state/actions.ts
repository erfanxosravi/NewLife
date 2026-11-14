import { gameDataset, type GameDataset } from '../data/registry';
import {
  createInspectorNpc,
  ensureAdoptionState,
  evaluateAdoptionEligibility,
  evaluateHomeVisitAndInterview,
  generateIndependentAvatarSeed,
  generateMatchedChildCandidates,
  getAdoptionCostEstimates,
} from '../engine/adoption';
import {
  buildOwnedBusinessFromQuote,
  calculateBusinessAcquisitionQuote,
  createInitialStaffMember,
  stepOwnedBusinessYear,
  type EmployerOfferData,
} from '../engine/businesses';
import {
  evaluateEmployeePromotionOrRaise,
  getLicenseStatus,
} from '../engine/careers';
import {
  calculateHousingQuote,
  calculateJobAnnualIncomeBreakdown,
  calculateNetWorthToman,
  convertDepositRentPair,
  getBaselineScaleFromMinWage,
  getMinWageMonthlyForState,
  hasReachedFinancialFreedomMilestone,
} from '../engine/economy';
import { formatToman, toPersianDigits } from '../engine/jalali';
import {
  clampChancePct,
  deriveDefaultPriorities,
  ensureJobCompassState,
  estimateJobSuccessChance,
  jobReadiness,
  jobSalaryRange,
} from '../engine/jobCompass';
import {
  applyCharityFoundationEnding,
  closeDynastyCleanly,
  inheritFromDeceasedToHeir,
  isWillUnlocked,
} from '../engine/legacy';
import { advanceYear, applyEventChoice } from '../engine/reducer';
import { SeededRNG } from '../engine/rng';
import { applyStatDelta, clampStat } from '../engine/stats';
import {
  calculateSpecialCareerAnnualIncomeBreakdown,
  calculateTalentSkillGain,
  getAthleticDisciplineTitleFa,
  getSpecialCareerEligibility,
  getSpecialCareerFallbackJobId,
  getSpecialCareerStageJobId,
  getTalentLessonCostToman,
  getTalentSkillState,
  getTierForTalentScore,
  getTierLabelFa,
} from '../engine/talents';
import type {
  ActivityDefinition,
  AdoptionCareType,
  Asset,
  BusinessAcquisitionMode,
  BusinessFinancingMode,
  BusinessSize,
  CountryDefinition,
  EventChoice,
  EventDefinition,
  GameState,
  HeirCandidate,
  HighSchoolTrack,
  HousingListing,
  HousingRegionTier,
  JobCompassPriorities,
  JobDefinition,
  Loan,
  MilitaryStatus,
  Person,
  SaveGame,
  SharedAssetDecision,
  ShopItemDefinition,
  SkillDefinition,
  SpecialCareerRouteId,
  TalentId,
  UniversityTier,
  VehicleCatalogItem,
  WillConfig,
} from '../engine/types';
import {
  canPerformActivity,
  getAdjustedPriceToman,
  getBusinessCapitalToman,
  getCarRepairCostToman,
  getCreditScore,
  getEmamiCoinPriceToman,
  getEmigrationProgress,
  getEmigrationStepCostToman,
  getGoldGramPriceToman,
  getJobApplicationStatus,
  getKonkurFeeToman,
  getLoanPresets,
  getMilitaryBuyoutCostToman,
  getOwnedShopItemIds,
  getRelationshipActionCosts,
  getSkillLevel,
  getSkillLevels,
  getStatHistory,
  getTehranSqmPriceToman,
  getTutorCostToman,
  getUniversityTuitionToman,
  getUsdRateToman,
  getWorkHistory,
  type EducationHistoryItem,
  type StatHistoryPoint,
} from './selectors';

export interface ActionOutcome {
  save: SaveGame;
  success: boolean;
  message: string;
}

function updateState(
  save: SaveGame,
  mutator: (draft: GameState) => void,
  rngState?: number,
): SaveGame {
  const clonedTalentSkills: GameState['player']['talentSkills'] = {};
  for (const [k, v] of Object.entries(save.state.player.talentSkills ?? {})) {
    if (v) clonedTalentSkills[k as TalentId] = { ...v };
  }
  const nextState: GameState = {
    ...save.state,
    player: {
      ...save.state.player,
      stats: { ...save.state.player.stats },
      hiddenStats: { ...save.state.player.hiddenStats },
      hiddenTalents: { ...save.state.player.hiddenTalents },
      discoveredTalents: (save.state.player.discoveredTalents ?? []).map((d) => ({ ...d })),
      talentSkills: clonedTalentSkills,
      education: { ...save.state.player.education },
      housing: { ...save.state.player.housing },
      job: save.state.player.job ? { ...save.state.player.job } : null,
      licenses: [...(save.state.player.licenses ?? [])],
    },
    npcs: Object.fromEntries(
      Object.entries(save.state.npcs).map(([k, v]) => [k, { ...v }]),
    ),
    relationships: save.state.relationships.map((r) => ({ ...r })),
    assets: save.state.assets.map((a) => ({ ...a })),
    loans: save.state.loans.map((l) => ({ ...l })),
    ownedBusiness: save.state.ownedBusiness
      ? {
          ...save.state.ownedBusiness,
          lastYearCostsToman: { ...save.state.ownedBusiness.lastYearCostsToman },
          staff: save.state.ownedBusiness.staff.map((s) => ({ ...s })),
        }
      : null,
    businessHistory: (save.state.businessHistory ?? []).map((h) => ({ ...h })),
    flags: { ...save.state.flags },
    eventHistory: { ...save.state.eventHistory },
    scheduledEvents: [...save.state.scheduledEvents],
    timeline: [...save.state.timeline],
    unlockedAchievements: [...save.state.unlockedAchievements],
    adoption: save.state.adoption ? ensureAdoptionState(save.state) : undefined,
    jobCompass: save.state.jobCompass ? ensureJobCompassState(save.state) : undefined,
  };

  mutator(nextState);

  return {
    ...save,
    rngState: rngState ?? save.rngState,
    updatedAt: new Date().toISOString(),
    state: nextState,
  };
}

function pushTimeline(
  state: GameState,
  title: string,
  text: string,
  type: GameState['timeline'][number]['type'] = 'life',
  statChanges?: GameState['timeline'][number]['statChanges'],
) {
  state.timeline.push({
    id: `turn_${state.turn}_act_${state.timeline.length}_${Math.random().toString(36).slice(2, 6)}`,
    age: state.player.age,
    jalaliYear: state.currentJalaliYear,
    title,
    text,
    type,
    statChanges,
  });
}

function appendNpcHistory(state: GameState, personId: string, text: string) {
  const key = `hist_rel_${personId}`;
  let existing: { age: number; text: string }[] = [];
  if (typeof state.flags[key] === 'string') {
    try {
      existing = JSON.parse(state.flags[key] as string);
    } catch {
      existing = [];
    }
  }
  existing.push({ age: state.player.age, text });
  state.flags[key] = JSON.stringify(existing.slice(-6));
}

function deductMoney(state: GameState, amount: number): boolean {
  if (amount <= 0) return true;
  if (state.player.moneyToman < amount) return false;
  state.player.moneyToman = Math.round(state.player.moneyToman - amount);
  return true;
}

function unlockAchievement(state: GameState, id: string) {
  if (!state.unlockedAchievements.includes(id)) {
    state.unlockedAchievements.push(id);
  }
}

export function runAdvanceYearWithTick(save: SaveGame, dataset: GameDataset = gameDataset): SaveGame {
  const prevSave = save;
  const stepped = advanceYear(save, dataset);
  if (!stepped.state.isAlive) {
    return updateState(stepped, (draft) => {
      const history = getStatHistory(prevSave.state);
      const point: StatHistoryPoint = {
        age: draft.player.age,
        ...draft.player.stats,
        netWorth: calculateNetWorthToman(draft),
      };
      draft.flags['hist_stats'] = JSON.stringify([...history, point].slice(-18));
    });
  }

  const p = dataset.economy.baseline1405.policyAndModel;
  const prevUsd = getUsdRateToman(prevSave.state, dataset);
  const currUsd = getUsdRateToman(stepped.state, dataset);
  const usdRatio = Math.max(0.5, currUsd / Math.max(1, prevUsd));

  const prevCoin = getEmamiCoinPriceToman(prevSave.state, dataset);
  const currCoin = getEmamiCoinPriceToman(stepped.state, dataset);
  const coinRatio = Math.max(0.5, currCoin / Math.max(1, prevCoin));

  const prevSqm = getTehranSqmPriceToman(prevSave.state, dataset);
  const currSqm = getTehranSqmPriceToman(stepped.state, dataset);
  const housingRatio = Math.max(0.6, currSqm / Math.max(1, prevSqm));

  const rng = new SeededRNG(`${stepped.seed}:post_tick:${stepped.state.turn}`);
  return updateState(stepped, (draft) => {
    // 1. Update asset market values using macro series & baseline model parameters
    for (const asset of draft.assets) {
      if (asset.id === 'inv_usd') {
        asset.currentValueToman = Math.max(0, Math.round(asset.currentValueToman * usdRatio));
      } else if (asset.id === 'inv_gold') {
        asset.currentValueToman = Math.max(0, Math.round(asset.currentValueToman * coinRatio));
      } else if (asset.id === 'inv_bourse') {
        const drift =
          1 +
          draft.lastInflationRate * p.bourseInflationPassThrough.value +
          rng.float(p.bourseVolatilityMin.value, p.bourseVolatilityMax.value);
        asset.currentValueToman = Math.max(0, Math.round(asset.currentValueToman * drift));
      } else if (asset.id === 'inv_deposit') {
        asset.currentValueToman = Math.max(
          0,
          Math.round(asset.currentValueToman * (1 + p.bankDepositAnnualRate.value)),
        );
      } else if (asset.id === 'inv_crypto') {
        const drift = 1 + rng.float(p.cryptoDriftMin.value, p.cryptoDriftMax.value);
        asset.currentValueToman = Math.max(0, Math.round(asset.currentValueToman * drift));
      } else if (asset.type === 'car') {
        const up = 1 + draft.lastInflationRate * p.carInflationPassThrough.value;
        asset.currentValueToman = Math.max(0, Math.round(asset.currentValueToman * up));
        const annualCarCost = Math.round(
          asset.currentValueToman * p.carAnnualMaintenanceRate.value,
        );
        if (draft.player.moneyToman >= annualCarCost) {
          draft.player.moneyToman -= annualCarCost;
        }
      }
    }

    // 2. Housing rent & appreciation
    if (draft.player.housing.type === 'owned' || draft.player.housing.type === 'villa') {
      draft.player.housing.propertyValueToman = Math.round(
        draft.player.housing.propertyValueToman * housingRatio,
      );
    } else if (draft.player.housing.type === 'rent' && draft.player.housing.monthlyRentToman > 0) {
      const annualRent = draft.player.housing.monthlyRentToman * 12;
      if (draft.player.moneyToman >= annualRent) {
        draft.player.moneyToman -= annualRent;
      } else {
        draft.player.debtToman += annualRent - draft.player.moneyToman;
        draft.player.moneyToman = 0;
      }
      draft.player.housing.monthlyRentToman = Math.round(
        draft.player.housing.monthlyRentToman *
          (1 + draft.lastInflationRate * p.rentInflationPassThrough.value),
      );
    }

    // 3. Loan amortization & credit score
    let creditScore = getCreditScore(draft);
    const remainingLoans: Loan[] = [];
    for (const loan of draft.loans) {
      const interest = Math.round(loan.principalRemainingToman * loan.annualInterestRate);
      const due = Math.min(loan.principalRemainingToman + interest, loan.annualPaymentToman);
      if (draft.player.moneyToman >= due) {
        draft.player.moneyToman -= due;
        loan.principalRemainingToman = Math.max(0, loan.principalRemainingToman + interest - due);
        loan.yearsRemaining = Math.max(0, loan.yearsRemaining - 1);
        creditScore = Math.min(850, creditScore + 12);
      } else {
        loan.principalRemainingToman = Math.round((loan.principalRemainingToman + interest) * 1.05);
        creditScore = Math.max(300, creditScore - 38);
        draft.player.stats = applyStatDelta(draft.player.stats, {
          mentalHealth: -4,
          happiness: -3,
        });
        pushTimeline(
          draft,
          'معوقه قسط وام',
          `موجودی کافی برای پرداخت قسط «${loan.name}» نبود و جریمه تأخیر روی بدهی اضافه شد.`,
          'life',
          { mentalHealth: -4 },
        );
      }
      if (loan.principalRemainingToman > 0 && loan.yearsRemaining > 0) {
        remainingLoans.push(loan);
      } else if (loan.principalRemainingToman <= 0) {
        pushTimeline(
          draft,
          'تسویه کامل وام',
          `وام «${loan.name}» به طور کامل تسویه شد.`,
          'milestone',
        );
      }
    }
    draft.loans = remainingLoans;
    draft.flags['credit_score'] = creditScore;

    // 4. Owned business annual operations & retirement pension
    if (draft.ownedBusiness) {
      stepOwnedBusinessYear(draft, rng, dataset);
    } else {
      const pension = draft.flags['pension_income'];
      if (typeof pension === 'number' && pension > 0) {
        const scaledPension = Math.round(
          pension * (1 + Math.max(0, draft.lastInflationRate) * 0.72),
        );
        draft.flags['pension_income'] = scaledPension;
        draft.player.moneyToman += scaledPension;
      } else {
        const legacyBizIncome = draft.flags['business_income'];
        if (typeof legacyBizIncome === 'number' && legacyBizIncome > 0) {
          const isRetired = Boolean(draft.flags['retired']);
          const variance = isRetired ? 1 : rng.float(0.75, 1.3);
          const scaledIncome = Math.round(
            legacyBizIncome * (1 + draft.lastInflationRate * p.businessRealCatchup.value) * variance,
          );
          draft.flags['business_income'] = scaledIncome;
          draft.player.moneyToman += scaledIncome;
        }
      }
    }

    // 5. University progress
    const uniYearsLeft = draft.flags['uni_years_left'];
    if (draft.player.education.inSchool && typeof uniYearsLeft === 'number' && uniYearsLeft > 0) {
      const nextLeft = uniYearsLeft - 1;
      draft.flags['uni_years_left'] = nextLeft;
      draft.player.education.yearsInCurrentStage += 1;
      if (nextLeft === 0) {
        draft.player.education.inSchool = false;
        const targetDegree = draft.flags['uni_target_degree'];
        if (
          targetDegree === 'associate' ||
          targetDegree === 'bachelor' ||
          targetDegree === 'master' ||
          targetDegree === 'phd' ||
          targetDegree === 'medical_doctor'
        ) {
          draft.player.education.level = targetDegree;
        }
        const eduHist: EducationHistoryItem[] =
          typeof draft.flags['hist_edu'] === 'string'
            ? JSON.parse(draft.flags['hist_edu'] as string)
            : [];
        eduHist.push({
          stageFa: String(draft.player.education.major || 'دانشگاه'),
          year: draft.currentJalaliYear,
          detailFa: `فراغت از تحصیل با معدل ${toPersianDigits(draft.player.education.gpa.toFixed(1))}`,
        });
        draft.flags['hist_edu'] = JSON.stringify(eduHist.slice(-10));
        pushTimeline(
          draft,
          'فارغ‌التحصیلی دانشگاه',
          `دوره تحصیل در رشته ${draft.player.education.major ?? 'دانشگاهی'} را با موفقیت به پایان رساندی.`,
          'milestone',
          { happiness: 6, intelligence: 4 },
        );
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6, intelligence: 4 });
      }
    }

    // 6. Military service progression (if serving)
    if (draft.player.militaryStatus === 'serving') {
      const yearsServed =
        (typeof draft.flags['military_years'] === 'number' ? draft.flags['military_years'] : 0) + 1;
      draft.flags['military_years'] = yearsServed;
      if (yearsServed >= 2) {
        draft.player.militaryStatus = 'completed';
        pushTimeline(
          draft,
          'پایان خدمت سربازی',
          'دوران خدمت سربازی به پایان رسید و کارت پایان خدمت را دریافت کردی.',
          'milestone',
          { happiness: 8, mentalHealth: 5 },
        );
        draft.player.stats = applyStatDelta(draft.player.stats, {
          happiness: 8,
          mentalHealth: 5,
        });
      }
    }

    // 7. Relationship gentle drift & grandchild birth
    for (const rel of draft.relationships) {
      const person = draft.npcs[rel.personId];
      if (!person || !person.isAlive) continue;
      if (
        rel.role === 'child' &&
        person.originKind !== 'temporary_guardian' &&
        person.originKind !== 'host_family' &&
        person.age >= 26 &&
        person.age <= 42 &&
        rng.chance(draft.unlockedAchievements.includes('grandparent') ? 0.04 : 0.18)
      ) {
        const ethPool = dataset.names.ethnicities[draft.player.ethnicity];
        const gcGender = rng.chance(0.5) ? 'male' : 'female';
        const gcFirstName =
          gcGender === 'male'
            ? rng.pick(ethPool.maleFirstNames)
            : rng.pick(ethPool.femaleFirstNames);
        const gcId = `npc_grandchild_${draft.turn}_${Object.keys(draft.npcs).length}`;
        draft.npcs[gcId] = {
          id: gcId,
          firstName: gcFirstName,
          lastName: person.lastName,
          gender: gcGender,
          age: 0,
          traits: ['کنجکاو', 'بانشاط'],
          jobTitle: 'نوزاد',
          isAlive: true,
          parentIds: [person.id],
          birthYear: draft.currentJalaliYear,
          avatarSeed: generateIndependentAvatarSeed(rng, 'gc'),
        };
        draft.relationships.push({
          personId: gcId,
          role: 'grandchild',
          closeness: rng.int(72, 92),
          respect: rng.int(65, 88),
          romance: 0,
        });
        unlockAchievement(draft, 'grandparent');
        pushTimeline(
          draft,
          'تولد نوه',
          `با تولد نوه‌ات «${gcFirstName}»، شادی تازه‌ای به جمع خانواده آمد.`,
          'milestone',
          { happiness: 10 },
        );
      }
    }

    // 8. Record stat, netWorth & market rates history
    const prevStatsHist = getStatHistory(prevSave.state);
    const nextPoint: StatHistoryPoint = {
      age: draft.player.age,
      ...draft.player.stats,
      netWorth: calculateNetWorthToman(draft),
    };
    draft.flags['hist_stats'] = JSON.stringify([...prevStatsHist, nextPoint].slice(-18));

    const prevUsdHist =
      typeof draft.flags['hist_usd'] === 'string'
        ? (JSON.parse(draft.flags['hist_usd'] as string) as number[])
        : [];
    const prevGoldHist =
      typeof draft.flags['hist_gold'] === 'string'
        ? (JSON.parse(draft.flags['hist_gold'] as string) as number[])
        : [];
    draft.flags['hist_usd'] = JSON.stringify(
      [...prevUsdHist, getUsdRateToman(draft, dataset)].slice(-10),
    );
    draft.flags['hist_gold'] = JSON.stringify(
      [...prevGoldHist, getGoldGramPriceToman(draft, dataset)].slice(-10),
    );

    if (hasReachedFinancialFreedomMilestone(draft, dataset)) {
      unlockAchievement(draft, 'billionaire');
    }
  });
}

export function runApplyEventChoice(
  save: SaveGame,
  event: EventDefinition,
  choice: EventChoice,
): SaveGame {
  let nextSave = applyEventChoice(save, event, choice);
  if (choice.costToman && choice.costToman > 0) {
    nextSave = updateState(nextSave, (draft) => {
      draft.player.moneyToman = Math.max(0, draft.player.moneyToman - choice.costToman!);
    });
  }
  return nextSave;
}

export function performActivityAction(
  save: SaveGame,
  activity: ActivityDefinition,
): ActionOutcome {
  const check = canPerformActivity(activity, save);
  if (!check.allowed) {
    return { save, success: false, message: check.reason ?? 'امکان انجام این فعالیت نیست' };
  }

  const rng = new SeededRNG(
    `${save.seed}:act:${activity.id}:${save.state.turn}:${save.state.timeline.length}`,
  );
  const pickedOutcome = rng.weightedPick(activity.outcomes, (o) => o.weight);

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_act_${activity.id}`] = draft.turn;
    deductMoney(draft, check.adjustedCost);
    if (pickedOutcome.stats) {
      draft.player.stats = applyStatDelta(draft.player.stats, pickedOutcome.stats);
    }
    if (typeof pickedOutcome.moneyToman === 'number') {
      const scaled = Math.round(pickedOutcome.moneyToman * draft.inflationMultiplier);
      draft.player.moneyToman = Math.max(0, draft.player.moneyToman + scaled);
    }
    if (pickedOutcome.criminalRecordDelta) {
      draft.player.criminalRecord = Math.max(
        0,
        draft.player.criminalRecord + pickedOutcome.criminalRecordDelta,
      );
    }
    pushTimeline(draft, activity.titleFa, pickedOutcome.resultTextFa, 'life', pickedOutcome.stats);
  });

  return { save: nextSave, success: true, message: pickedOutcome.resultTextFa };
}

export function setStudyEffortAction(save: SaveGame, effort: number): SaveGame {
  return updateState(save, (draft) => {
    draft.flags['study_effort'] = Math.max(0, Math.min(100, Math.round(effort)));
  });
}

export function performStudyAction(
  save: SaveGame,
  mode: 'study_hard' | 'tutor' | 'skip',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const cost = mode === 'tutor' ? getTutorCostToman(save.state, dataset) : 0;
  if (cost > save.state.player.moneyToman) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }

  const cdKey = `edu_${mode}`;
  if (save.state.flags[`cd_${cdKey}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_${cdKey}`] = draft.turn;
    deductMoney(draft, cost);

    if (mode === 'study_hard') {
      draft.player.education.gpa = Math.min(20, Number((draft.player.education.gpa + 0.8).toFixed(1)));
      draft.player.stats = applyStatDelta(draft.player.stats, {
        intelligence: 4,
        mentalHealth: -3,
        happiness: -2,
      });
      pushTimeline(
        draft,
        'مطالعه جدی درسی',
        'امسال با تمرکز بیشتر درس خواندی و معدلت بالا رفت.',
        'life',
        { intelligence: 4, mentalHealth: -3 },
      );
    } else if (mode === 'tutor') {
      draft.player.education.gpa = Math.min(20, Number((draft.player.education.gpa + 1.4).toFixed(1)));
      draft.player.stats = applyStatDelta(draft.player.stats, { intelligence: 6 });
      pushTimeline(
        draft,
        'کلاس تقویتی و معلم خصوصی',
        'با کمک معلم خصوصی، پایه‌ات در درس‌های اصلی محکم‌تر شد.',
        'life',
        { intelligence: 6 },
      );
    } else {
      draft.player.education.gpa = Math.max(10, Number((draft.player.education.gpa - 0.9).toFixed(1)));
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 5, intelligence: -2 });
      pushTimeline(
        draft,
        'کمی فاصله از کتاب و درس',
        'امسال بیشتر وقتت را با دوستان و تفریح گذراندی؛ معدل کمی پایین آمد.',
        'life',
        { happiness: 5 },
      );
    }
  });

  return { save: nextSave, success: true, message: 'تغییرات تحصیلی ثبت شد' };
}

export function selectHighSchoolTrackAction(save: SaveGame, track: HighSchoolTrack): ActionOutcome {
  const trackNames: Record<HighSchoolTrack, string> = {
    math: 'ریاضی و فیزیک',
    science: 'علوم تجربی',
    humanities: 'علوم انسانی',
    vocational: 'فنی و حرفه‌ای',
  };
  const nextSave = updateState(save, (draft) => {
    draft.player.education.highSchoolTrack = track;
    draft.flags['edu_track'] = track;
    pushTimeline(
      draft,
      'انتخاب رشته دبیرستان',
      `رشته «${trackNames[track]}» را برای دوره متوسطه دوم انتخاب کردی.`,
      'milestone',
    );
  });
  return { save: nextSave, success: true, message: `رشته ${trackNames[track]} ثبت شد` };
}

export function takeKonkurAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const fee = getKonkurFeeToman(save.state, dataset);
  if (save.state.player.moneyToman < fee) {
    return { save, success: false, message: 'موجودی برای ثبت‌نام کنکور کافی نیست' };
  }
  if (save.state.flags['cd_konkur'] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }

  const rng = new SeededRNG(`${save.seed}:konkur:${save.state.turn}`);
  const effort =
    typeof save.state.flags['study_effort'] === 'number' ? save.state.flags['study_effort'] : 65;
  const score =
    save.state.player.stats.intelligence * 0.52 +
    (save.state.player.education.gpa / 20) * 30 +
    effort * 0.2 +
    rng.int(-12, 14);

  let rank = 48000;
  if (score >= 95) rank = rng.int(12, 95);
  else if (score >= 82) rank = rng.int(120, 1800);
  else if (score >= 68) rank = rng.int(2200, 9500);
  else if (score >= 52) rank = rng.int(11000, 32000);
  else rank = rng.int(35000, 145000);

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, fee);
    draft.flags['cd_konkur'] = draft.turn;
    draft.player.education.konkurRank = rank;
    if (rank <= 100) {
      unlockAchievement(draft, 'aced_konkur');
    }
    draft.player.stats = applyStatDelta(draft.player.stats, {
      mentalHealth: -4,
      happiness: rank <= 3000 ? 10 : -3,
    });
    pushTimeline(
      draft,
      'نتیجه کنکور سراسری',
      `در کنکور سراسری رتبه ${toPersianDigits(rank.toLocaleString('en-US'))} را کسب کردی.`,
      'milestone',
    );
  });

  return {
    save: nextSave,
    success: true,
    message: `رتبه کنکور: ${toPersianDigits(rank.toLocaleString('en-US'))}`,
  };
}

export function enrollUniversityAction(
  save: SaveGame,
  tier: UniversityTier,
  majorFa: string,
  targetDegree: 'associate' | 'bachelor' | 'master' | 'phd' | 'medical_doctor',
  durationYears: number,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const firstYearCost = getUniversityTuitionToman(tier, majorFa, save.state, dataset);
  if (save.state.player.moneyToman < firstYearCost) {
    return { save, success: false, message: 'موجودی برای شهریه سال اول کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, firstYearCost);
    draft.player.education.inSchool = true;
    draft.player.education.universityTier = tier;
    draft.player.education.major = majorFa;
    draft.player.education.yearsInCurrentStage = 0;
    draft.flags['uni_years_left'] = durationYears;
    draft.flags['uni_target_degree'] = targetDegree;
    if (draft.player.gender === 'male' && draft.player.militaryStatus === 'pending') {
      draft.player.militaryStatus = 'exempt_educational';
    }
    pushTimeline(
      draft,
      'ورود به دانشگاه',
      `در رشته «${majorFa}» پذیرفته شدی و دوره ${toPersianDigits(durationYears)} ساله را آغاز کردی.`,
      'milestone',
      { happiness: 7, intelligence: 3 },
    );
    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 7, intelligence: 3 });
  });

  return { save: nextSave, success: true, message: `در رشته ${majorFa} ثبت‌نام شدی` };
}

export function applyForJobAction(
  save: SaveGame,
  job: JobDefinition,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const status = getJobApplicationStatus(job, save.state, dataset);
  if (!status.eligible) {
    return { save, success: false, message: status.reason ?? 'شرایط این شغل کامل نیست' };
  }

  const rng = new SeededRNG(`${save.seed}:job:${job.id}:${save.state.turn}`);
  const passed = rng.chance(status.estimatedChancePct / 100);

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_apply_job_${job.id}`] = draft.turn;
    if (passed) {
      if (draft.player.job) {
        const hist = getWorkHistory(draft);
        hist.push({
          title: draft.player.job.title,
          employer: 'سابقه قبلی',
          fromYear: draft.currentJalaliYear - draft.player.job.yearsInJob,
          toYear: draft.currentJalaliYear,
        });
        draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
      }
      const level1 = job.ladder[0];
      draft.player.job = {
        jobId: job.id,
        title: `${job.titleFa} (${level1.titleFa})`,
        track: job.track,
        level: 1,
        annualSalaryToman: status.breakdown.netAnnual,
        stress: job.stress,
        yearsInJob: 0,
      };
      draft.flags['job_years_in_role'] = 0;
      draft.flags['last_job_gross'] = status.breakdown.grossAnnual;
      draft.flags['last_job_net'] = status.breakdown.netAnnual;
      draft.flags['last_job_deductions'] =
        status.breakdown.commission +
        status.breakdown.runningCosts +
        status.breakdown.bimeh +
        status.breakdown.incomeTax;
      draft.flags['retired'] = false;
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6, fame: 2 });
      pushTimeline(
        draft,
        `استخدام در شغل ${job.titleFa}`,
        `مصاحبه شغلی موفقیت‌آمیز بود و به عنوان «${level1.titleFa}» با خالص دریافتی ${formatToman(status.breakdown.netAnnual)} در سال مشغول به کار شدی.`,
        'milestone',
        { happiness: 6 },
      );
    } else {
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -2 });
      pushTimeline(
        draft,
        'رد شدن در مصاحبه شغلی',
        `برای موقعیت «${job.titleFa}» مصاحبه دادی اما این بار پذیرفته نشدی.`,
        'life',
      );
    }
  });

  return {
    save: nextSave,
    success: passed,
    message: passed
      ? `در ${job.titleFa} استخدام شدی!`
      : 'این بار پذیرفته نشدی؛ می‌توانی مهارتت را بالا ببری',
  };
}

export function changeWorkplaceAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.player.job) {
    return { save, success: false, message: 'شغل فعالی نداری' };
  }
  if (save.state.flags['cd_change_workplace'] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال می‌توانی محل کار را عوض کنی' };
  }
  const job = save.state.player.job;
  const jobDef = dataset.jobs.find((j) => j.id === job.jobId);
  if (!jobDef || jobDef.noPromotions) {
    return { save, success: false, message: 'برای این شغل جابه‌جایی کارفرما تعریف نشده است' };
  }

  const rng = new SeededRNG(`${save.seed}:workplace:${save.state.turn}`);
  const bump = rng.float(1.04, 1.14);
  const cap = calculateJobAnnualIncomeBreakdown({
    job: jobDef,
    level: job.level,
    state: save.state,
    dataset,
    positionOverride01: 1,
  }).netAnnual;

  const nextSave = updateState(save, (draft) => {
    draft.flags['cd_change_workplace'] = draft.turn;
    const current = draft.player.job!;
    const hist = getWorkHistory(draft);
    hist.push({
      title: current.title,
      employer: 'کارفرمای قبلی',
      fromYear: draft.currentJalaliYear - Math.max(1, current.yearsInJob),
      toYear: draft.currentJalaliYear,
    });
    draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
    current.annualSalaryToman = Math.min(cap, Math.round(current.annualSalaryToman * bump));
    draft.flags['job_years_in_role'] = 0;
    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 3, mentalHealth: 2 });
    pushTimeline(
      draft,
      'تغییر محل کار',
      `با حفظ رده شغلی به مجموعه جدیدی منتقل شدی و حقوقت به ${formatToman(current.annualSalaryToman)} در سال رسید.`,
      'life',
      { happiness: 3 },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: 'محل کارت با حفظ رده شغلی تغییر کرد',
  };
}

export function performCareerAction(
  save: SaveGame,
  action: 'overtime' | 'raise' | 'quit' | 'retire',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.player.job) {
    return { save, success: false, message: 'در حال حاضر شاغل نیستی' };
  }

  const p = dataset.economy.baseline1405.policyAndModel;

  if (action === 'quit' || action === 'retire') {
    const canRetire = save.state.player.age >= 60 || save.state.player.job.yearsInJob >= 25;
    if (action === 'retire' && !canRetire) {
      return {
        save,
        success: false,
        message: 'برای بازنشستگی باید حداقل ۶۰ سال سن یا ۲۵ سال سابقه داشته باشی',
      };
    }
    const nextSave = updateState(save, (draft) => {
      const oldJob = draft.player.job!;
      const hist = getWorkHistory(draft);
      hist.push({
        title: oldJob.title,
        employer: action === 'retire' ? 'بازنشسته' : 'استعفا',
        fromYear: draft.currentJalaliYear - oldJob.yearsInJob,
        toYear: draft.currentJalaliYear,
      });
      draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
      if (action === 'retire') {
        draft.flags['retired'] = true;
        draft.flags['pension_income'] = Math.round(
          oldJob.annualSalaryToman * p.retirementPensionRatio.value,
        );
      }
      draft.player.job = null;
      draft.flags['job_years_in_role'] = 0;
      pushTimeline(
        draft,
        action === 'retire' ? 'بازنشستگی رسمی' : 'استعفا از کار',
        action === 'retire'
          ? `پس از سال‌ها تلاش در «${oldJob.title}» بازنشسته شدی و مستمری برایت برقرار شد.`
          : `از شغل «${oldJob.title}» استعفا دادی تا دنبال مسیر تازه‌ای بروی.`,
        'milestone',
      );
    });
    return {
      save: nextSave,
      success: true,
      message: action === 'retire' ? 'بازنشستگی با مستمری ثبت شد' : 'از شغل فعلی استعفا دادی',
    };
  }

  if (save.state.flags[`cd_career_${action}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }

  const jobDef = dataset.jobs.find((j) => j.id === save.state.player.job!.jobId);
  if (action === 'raise' && jobDef?.noPromotions) {
    return {
      save,
      success: false,
      message: 'این شغل رده ترفیع اداری ندارد؛ برای درآمد بیشتر از ساعت کار یا تأسیس ناوگان اقدام کن.',
    };
  }

  const rng = new SeededRNG(`${save.seed}:career:${action}:${save.state.turn}`);
  let resultMsg = 'نتیجه در دفترچه سرگذشت ثبت شد';
  let didSucceed = true;

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_career_${action}`] = draft.turn;
    const job = draft.player.job!;

    if (action === 'overtime') {
      const bonus = Math.round(job.annualSalaryToman * p.overtimeBonusRatio.value);
      draft.player.moneyToman += bonus;
      draft.flags['career_overtime_boost'] = draft.turn;
      draft.player.stats = applyStatDelta(draft.player.stats, {
        health: -3,
        mentalHealth: -4,
        happiness: -2,
      });
      resultMsg = `پاداش کار اضافه (${formatToman(bonus)}) به حسابت اضافه شد.`;
      pushTimeline(
        draft,
        'اضافه‌کار و پروژه جانبی',
        `با اضافه‌کار امسال پاداش خوبی (${formatToman(bonus)}) گرفتی اما کمی از استراحتت کم شد.`,
        'life',
        { health: -3, mentalHealth: -4 },
      );
    } else if (jobDef) {
      const evalRes = evaluateEmployeePromotionOrRaise({
        state: draft,
        jobDef,
        rng,
        dataset,
      });
      if (evalRes.promoted) {
        job.level = evalRes.newLevel;
        job.title = evalRes.newTitleFa;
        job.annualSalaryToman = evalRes.newAnnualSalaryToman;
        draft.flags['job_years_in_role'] = 0;
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6, fame: 2 });
        resultMsg = evalRes.reasonFa;
        pushTimeline(
          draft,
          'ارتقای رده شغلی',
          `${evalRes.reasonFa} حقوق خالص سالانه به ${formatToman(evalRes.newAnnualSalaryToman)} رسید.`,
          'milestone',
          { happiness: 6 },
        );
      } else if (evalRes.salaryRaisedOnly) {
        job.annualSalaryToman = evalRes.newAnnualSalaryToman;
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 3 });
        resultMsg = evalRes.reasonFa;
        pushTimeline(
          draft,
          'افزایش حقوق در رده فعلی',
          `${evalRes.reasonFa} دریافتی جدید: ${formatToman(evalRes.newAnnualSalaryToman)} در سال.`,
          'life',
          { happiness: 3 },
        );
      } else {
        didSucceed = false;
        resultMsg = evalRes.reasonFa;
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -2 });
        pushTimeline(
          draft,
          'تثبیت جایگاه فعلی',
          evalRes.reasonFa,
          'life',
          { happiness: -2 },
        );
      }
    } else {
      // Special career fallback raise
      if (rng.chance(0.45)) {
        job.annualSalaryToman = Math.round(job.annualSalaryToman * p.raiseMultiplier.value);
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 5 });
        pushTimeline(
          draft,
          'تعدیل حق‌الزحمه سالانه',
          'دستمزد قراردادی‌ات در این سال افزایش یافت.',
          'life',
          { happiness: 5 },
        );
      } else {
        didSucceed = false;
        resultMsg = 'درخواست افزایش دستمزد فعلاً پذیرفته نشد.';
      }
    }
  });

  return { save: nextSave, success: didSucceed, message: resultMsg };
}

export function acquireLicenseAction(
  save: SaveGame,
  licenseId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const license = dataset.businesses.licenses.find((l) => l.id === licenseId);
  if (!license) {
    return { save, success: false, message: 'مجوز یافت نشد' };
  }
  const status = getLicenseStatus(license, save.state, dataset);
  if (status.owned) {
    return { save, success: false, message: 'این مجوز را قبلاً گرفته‌ای' };
  }
  if (!status.eligible) {
    return {
      save,
      success: false,
      message: status.missingReasons[0] ?? 'شرایط دریافت این مجوز کامل نیست',
    };
  }
  if (save.state.flags[`cd_license_${license.id}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال می‌توانی آزمون این مجوز را بدهی' };
  }

  const rng = new SeededRNG(`${save.seed}:lic:${license.id}:${save.state.turn}`);
  const examPassChance = license.examRequired
    ? Math.min(0.94, 0.55 + (save.state.player.stats.intelligence - 50) * 0.006)
    : 1;
  const passed = rng.chance(examPassChance);

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, status.feeToman);
    draft.flags[`cd_license_${license.id}`] = draft.turn;
    if (passed) {
      draft.player.licenses = [...(draft.player.licenses ?? []), license.id];
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 4, fame: 2 });
      pushTimeline(
        draft,
        `دریافت ${license.titleFa}`,
        `مراحل و مدارک «${license.titleFa}» از ${license.issuerFa} با موفقیت تأیید شد.`,
        'milestone',
        { happiness: 4 },
      );
    } else {
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -3, mentalHealth: -2 });
      pushTimeline(
        draft,
        `عدم قبولی در آزمون ${license.titleFa}`,
        `در آزمون تخصصی «${license.titleFa}» نمره قبولی نگرفتی؛ سال بعد می‌توانی دوباره شرکت کنی.`,
        'life',
      );
    }
  });

  return {
    save: nextSave,
    success: passed,
    message: passed
      ? `مجوز «${license.titleFa}» صادر شد`
      : `در آزمون «${license.titleFa}» قبول نشدی؛ سال بعد دوباره تلاش کن`,
  };
}

export interface AcquireBusinessParams {
  businessTypeId: string;
  acquisitionMode: BusinessAcquisitionMode;
  financingMode: BusinessFinancingMode;
  cityId: string;
  regionTier: HousingRegionTier;
  size: BusinessSize;
  customNameFa?: string;
  employerOfferPriceToman?: number;
}

export function acquireBusinessAction(
  save: SaveGame,
  params: AcquireBusinessParams,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const businessDef = dataset.businesses.businesses.find((b) => b.id === params.businessTypeId);
  if (!businessDef) {
    return { save, success: false, message: 'نوع کسب‌وکار یافت نشد' };
  }

  const quote = calculateBusinessAcquisitionQuote({
    businessDef,
    acquisitionMode: params.acquisitionMode,
    financingMode: params.financingMode,
    cityId: params.cityId,
    regionTier: params.regionTier,
    size: params.size,
    state: save.state,
    dataset,
    employerOfferPriceToman: params.employerOfferPriceToman,
  });

  if (!quote.eligible) {
    return {
      save,
      success: false,
      message: quote.blockedReasons[0] ?? 'شرایط راه‌اندازی یا تملک کامل نیست',
    };
  }

  const rng = new SeededRNG(
    `${save.seed}:acquire_biz:${params.businessTypeId}:${params.acquisitionMode}:${save.state.turn}`,
  );
  const ownedBiz = buildOwnedBusinessFromQuote({
    quote,
    customNameFa: params.customNameFa,
    state: save.state,
    rng,
    dataset,
  });

  const modeLabels: Record<BusinessAcquisitionMode, string> = {
    start_scratch: 'تأسیس از صفر',
    buy_existing: 'خرید سرقفلی و امتیاز موجود',
    partnership: 'شراکت تجاری',
    family_takeover: 'ادامه کسب‌وکار خانوادگی',
    franchise: 'دریافت نمایندگی و برند',
    employer_offer: 'خرید با تخفیف از کارفرمای بازنشسته',
    inheritance: 'واگذاری در انحصار وراثت',
  };

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, quote.playerCashRequiredToman);
    if (quote.loanPrincipalToman > 0) {
      const rate = dataset.economy.baseline1405.policyAndModel.loanHousingRate.value;
      draft.loans.push({
        id: `loan_biz_${draft.turn}_${rng.int(100, 999)}`,
        name: `تسهیلات راه‌اندازی ${ownedBiz.nameFa}`,
        principalRemainingToman: quote.loanPrincipalToman,
        annualInterestRate: rate,
        annualPaymentToman: quote.loanAnnualPaymentToman,
        yearsRemaining: 5,
      });
    }

    draft.ownedBusiness = ownedBiz;
    draft.flags['business_name'] = ownedBiz.nameFa;
    draft.flags['business_income'] = 0;
    draft.flags['ownership_acquired_mode'] = params.acquisitionMode;
    draft.flags['ownership_acquired_year'] = draft.currentJalaliYear;
    draft.flags['retired'] = false;
    delete draft.flags['pending_employer_offer'];
    delete draft.flags['pending_family_biz_inheritance'];

    // Sibling dispute risk on family takeover
    if (
      params.acquisitionMode === 'family_takeover' &&
      quote.familyEligibility?.hasSiblingDisputeRisk &&
      rng.chance(0.35)
    ) {
      for (const rel of draft.relationships) {
        if (rel.role === 'sibling') {
          rel.closeness = Math.max(0, rel.closeness - 14);
          rel.respect = Math.max(0, rel.respect - 10);
        }
      }
      pushTimeline(
        draft,
        'دلخوری بر سر کسب‌وکار خانوادگی',
        'واگذاری اداره کسب‌وکار خانواده به تو، بین خواهر و برادرها کمی دلخوری و بحث ایجاد کرد.',
        'life',
      );
    }

    draft.player.stats = applyStatDelta(draft.player.stats, {
      fame: 5,
      happiness: 6,
      mentalHealth: -3,
    });

    pushTimeline(
      draft,
      `مالکیت ${ownedBiz.nameFa}`,
      `از طریق «${modeLabels[params.acquisitionMode]}» مالک «${ownedBiz.nameFa}» شدی؛ سرمایه پرداختی: ${formatToman(quote.playerCashRequiredToman)}.`,
      'milestone',
      { fame: 5, happiness: 6 },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: `مالکیت «${ownedBiz.nameFa}» با موفقیت ثبت شد`,
  };
}

export function respondEmployerOfferAction(
  save: SaveGame,
  accept: boolean,
  financingMode: BusinessFinancingMode = 'personal_cash',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const raw = save.state.flags['pending_employer_offer'];
  if (typeof raw !== 'string') {
    return { save, success: false, message: 'پیشنهادی در انتظار پاسخ نیست' };
  }
  const offer = JSON.parse(raw) as EmployerOfferData;
  if (!accept) {
    const nextSave = updateState(save, (draft) => {
      delete draft.flags['pending_employer_offer'];
      pushTimeline(
        draft,
        'رد پیشنهاد واگذاری کارفرما',
        `پیشنهاد خرید «${offer.businessNameFa}» را نپذیرفتی و در مسیر فعلی‌ات ماندی.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: 'پیشنهاد کارفرما رد شد' };
  }

  return acquireBusinessAction(
    save,
    {
      businessTypeId: offer.businessTypeId,
      acquisitionMode: 'employer_offer',
      financingMode,
      cityId: save.state.player.currentCityId,
      regionTier: 'mid',
      size: 'medium',
      customNameFa: offer.businessNameFa,
      employerOfferPriceToman: offer.discountedPriceToman,
    },
    dataset,
  );
}

export function respondFamilyInheritanceBizAction(
  save: SaveGame,
  accept: boolean,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const raw = save.state.flags['pending_family_biz_inheritance'];
  if (typeof raw !== 'string') {
    return { save, success: false, message: 'ماترک کسب‌وکاری در انتظار تصمیم نیست' };
  }
  const offer = JSON.parse(raw) as {
    businessTypeId: string;
    businessNameFa: string;
    offeredYear: number;
  };
  if (!accept) {
    const nextSave = updateState(save, (draft) => {
      delete draft.flags['pending_family_biz_inheritance'];
      const payout = Math.round(getMinWageMonthlyForState(draft, dataset) * 14);
      draft.player.moneyToman += payout;
      pushTimeline(
        draft,
        'فروش و تقسیم ماترک صنفی خانواده',
        `امتیاز کسب‌وکار خانوادگی واگذار شد و سهم نقدی ${formatToman(payout)} به تو رسید.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: 'ماترک کسب‌وکار نقد شد' };
  }

  return acquireBusinessAction(
    save,
    {
      businessTypeId: offer.businessTypeId,
      acquisitionMode: 'inheritance',
      financingMode: 'personal_cash',
      cityId: save.state.player.currentCityId,
      regionTier: 'mid',
      size: 'medium',
      customNameFa: offer.businessNameFa,
    },
    dataset,
  );
}

export function manageBusinessAction(
  save: SaveGame,
  action:
    | 'hire_staff'
    | 'fire_staff'
    | 'price_discount'
    | 'price_standard'
    | 'price_premium'
    | 'renovate'
    | 'advertise'
    | 'add_branch'
    | 'sell'
    | 'close',
  staffId?: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const biz = save.state.ownedBusiness;
  if (!biz) {
    return { save, success: false, message: 'کسب‌وکار فعالی نداری' };
  }
  const bizDef = dataset.businesses.businesses.find((b) => b.id === biz.businessTypeId);
  if (!bizDef) {
    return { save, success: false, message: 'مشخصات کسب‌وکار یافت نشد' };
  }

  const minWageMonthly = getMinWageMonthlyForState(save.state, dataset);
  const rng = new SeededRNG(`${save.seed}:biz_mgmt:${action}:${save.state.turn}:${biz.staff.length}`);

  if (action === 'sell' || action === 'close') {
    const valuation =
      action === 'sell'
        ? Math.round(
            (biz.depositLockedToman +
              biz.equipmentValueToman * 0.75 +
              Math.max(0, biz.cashReserveToman) +
              Math.max(0, biz.lastYearProfitToman) * 1.4) *
              biz.ownershipShare,
          )
        : Math.round(
            (biz.depositLockedToman +
              biz.equipmentValueToman * 0.35 +
              Math.max(0, biz.cashReserveToman)) *
              biz.ownershipShare,
          );

    const nextSave = updateState(save, (draft) => {
      const target = draft.ownedBusiness!;
      draft.player.moneyToman = Math.round(draft.player.moneyToman + Math.max(0, valuation));
      draft.businessHistory.push({
        id: target.id,
        businessTypeId: target.businessTypeId,
        nameFa: target.nameFa,
        acquisitionMode: target.acquisitionMode,
        startYear: target.foundedYear,
        endYear: draft.currentJalaliYear,
        outcome: action === 'sell' ? 'sold' : 'closed',
        netResultToman: target.cumulativeProfitToman + valuation,
      });
      draft.ownedBusiness = null;
      delete draft.flags['business_name'];
      draft.flags['business_income'] = 0;
      pushTimeline(
        draft,
        action === 'sell' ? `فروش ${target.nameFa}` : `تعطیلی داوطلبانه ${target.nameFa}`,
        action === 'sell'
          ? `«${target.nameFa}» را به ارزش ${formatToman(valuation)} واگذار کردی.`
          : `«${target.nameFa}» را جمع کردی و ${formatToman(valuation)} از ودیعه و وسایل برگشت.`,
        'milestone',
      );
    });
    return {
      save: nextSave,
      success: true,
      message: action === 'sell' ? 'کسب‌وکار فروخته شد' : 'کسب‌وکار بسته شد',
    };
  }

  if (action === 'price_discount' || action === 'price_standard' || action === 'price_premium') {
    const strategy =
      action === 'price_discount'
        ? 'discount'
        : action === 'price_premium'
          ? 'premium'
          : 'standard';
    const nextSave = updateState(save, (draft) => {
      draft.ownedBusiness!.priceStrategy = strategy;
    });
    return { save: nextSave, success: true, message: 'سیاست قیمت‌گذاری به‌روزرسانی شد' };
  }

  if (action === 'hire_staff') {
    if (biz.staff.length >= bizDef.maxStaffCount * biz.branchCount) {
      return { save, success: false, message: 'ظرفیت نیروی انسانی فعلی تکمیل است' };
    }
    const hireCost = Math.round(minWageMonthly * 1.5);
    if (save.state.player.moneyToman < hireCost) {
      return { save, success: false, message: 'موجودی برای هزینه استخدام کافی نیست' };
    }
    const newStaff = createInitialStaffMember({
      businessDef: bizDef,
      index: biz.staff.length,
      minWageMonthly,
      rng,
      dataset,
    });
    const nextSave = updateState(save, (draft) => {
      deductMoney(draft, hireCost);
      draft.ownedBusiness!.staff.push(newStaff);
      pushTimeline(
        draft,
        `استخدام ${newStaff.roleTitleFa}`,
        `${newStaff.fullName} به عنوان «${newStaff.roleTitleFa}» در ${draft.ownedBusiness!.nameFa} استخدام شد.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: `${newStaff.fullName} استخدام شد` };
  }

  if (action === 'fire_staff') {
    if (biz.staff.length === 0) {
      return { save, success: false, message: 'کارمندی برای تعدیل وجود ندارد' };
    }
    const targetStaff =
      (staffId ? biz.staff.find((s) => s.id === staffId) : undefined) ?? biz.staff[biz.staff.length - 1];
    const nextSave = updateState(save, (draft) => {
      draft.ownedBusiness!.staff = draft.ownedBusiness!.staff.filter((s) => s.id !== targetStaff.id);
      draft.ownedBusiness!.reputation = Math.max(0, draft.ownedBusiness!.reputation - 2);
      pushTimeline(
        draft,
        'تعدیل نیرو',
        `همکاری با «${targetStaff.fullName}» در ${draft.ownedBusiness!.nameFa} پایان یافت.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: `${targetStaff.fullName} تعدیل شد` };
  }

  if (action === 'renovate') {
    const cost = Math.round(minWageMonthly * 8 * biz.branchCount);
    if (save.state.player.moneyToman < cost) {
      return { save, success: false, message: `برای بازسازی ${formatToman(cost)} لازم است` };
    }
    const nextSave = updateState(save, (draft) => {
      deductMoney(draft, cost);
      draft.ownedBusiness!.renovationYearsLeft = 2;
      draft.ownedBusiness!.equipmentValueToman += Math.round(cost * 0.65);
      draft.ownedBusiness!.reputation = Math.min(100, draft.ownedBusiness!.reputation + 8);
      pushTimeline(
        draft,
        `بازسازی و نوسازی ${draft.ownedBusiness!.nameFa}`,
        `دکور و تجهیزات کسب‌وکار بازسازی شد و جذابیتش برای مشتری‌ها بالا رفت.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: 'بازسازی با موفقیت انجام شد' };
  }

  if (action === 'advertise') {
    const cost = Math.round(minWageMonthly * 4 * biz.branchCount);
    if (save.state.player.moneyToman < cost) {
      return { save, success: false, message: `برای تبلیغات ${formatToman(cost)} لازم است` };
    }
    const nextSave = updateState(save, (draft) => {
      deductMoney(draft, cost);
      draft.ownedBusiness!.marketingYearsLeft = 2;
      draft.ownedBusiness!.customerBase = Math.min(200, draft.ownedBusiness!.customerBase + 12);
      pushTimeline(
        draft,
        `کمپین تبلیغاتی ${draft.ownedBusiness!.nameFa}`,
        `تبلیغات محلی و آنلاین برای جذب مشتری تازه اجرا شد.`,
        'life',
      );
    });
    return { save: nextSave, success: true, message: 'کمپین تبلیغاتی فعال شد' };
  }

  // add_branch
  const branchCost = Math.round(
    (biz.depositLockedToman + biz.equipmentValueToman) * 0.75,
  );
  if (save.state.player.moneyToman < branchCost) {
    return {
      save,
      success: false,
      message: `برای افتتاح شعبه جدید ${formatToman(branchCost)} سرمایه لازم است`,
    };
  }
  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, branchCost);
    draft.ownedBusiness!.branchCount += 1;
    draft.ownedBusiness!.reputation = Math.min(100, draft.ownedBusiness!.reputation + 6);
    draft.player.stats = applyStatDelta(draft.player.stats, { fame: 4, happiness: 5 });
    pushTimeline(
      draft,
      `افتتاح شعبه ${toPersianDigits(draft.ownedBusiness!.branchCount)} ${draft.ownedBusiness!.nameFa}`,
      `شعبه جدیدی با سرمایه ${formatToman(branchCost)} راه‌اندازی شد.`,
      'milestone',
      { fame: 4 },
    );
  });
  return { save: nextSave, success: true, message: 'شعبه جدید افتتاح شد' };
}

export function startBusinessAction(
  save: SaveGame,
  businessName: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  return acquireBusinessAction(
    save,
    {
      businessTypeId: 'cafe_franchise',
      acquisitionMode: 'start_scratch',
      financingMode: 'personal_cash',
      cityId: save.state.player.currentCityId,
      regionTier: 'mid',
      size: 'small',
      customNameFa: businessName,
    },
    dataset,
  );
}

export function trainSkillAction(save: SaveGame, skill: SkillDefinition): ActionOutcome {
  const currentLevel = getSkillLevel(save.state, skill.id);
  if (currentLevel >= 5) {
    return { save, success: false, message: 'این مهارت به حداکثر سطح رسیده است' };
  }
  if (save.state.player.age < skill.minAge) {
    return { save, success: false, message: `از ${toPersianDigits(skill.minAge)} سالگی فعال می‌شود` };
  }
  if (save.state.flags[`cd_skill_${skill.id}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }
  const cost = getAdjustedPriceToman(skill.costToman, save.state);
  if (save.state.player.moneyToman < cost) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, cost);
    draft.flags[`cd_skill_${skill.id}`] = draft.turn;
    const map = getSkillLevels(draft);
    map[skill.id] = currentLevel + 1;
    draft.flags['skills_json'] = JSON.stringify(map);
    draft.player.stats = applyStatDelta(draft.player.stats, { intelligence: 2, happiness: 2 });
    pushTimeline(
      draft,
      `پیشرفت مهارت ${skill.titleFa}`,
      `مهارت «${skill.titleFa}» به سطح ${toPersianDigits(currentLevel + 1)} از ۵ رسید.`,
      'life',
      { intelligence: 2 },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: `${skill.titleFa} به سطح ${toPersianDigits(currentLevel + 1)} رسید`,
  };
}

export function selectMilitaryOptionAction(
  save: SaveGame,
  option: 'serve' | 'amrieh' | 'exempt_medical' | 'exempt_breadwinner' | 'buyout' | 'defer',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (save.state.player.gender !== 'male') {
    return { save, success: false, message: 'مشمول خدمت نظام وظیفه نیستی' };
  }
  const rng = new SeededRNG(`${save.seed}:mil:${option}:${save.state.turn}`);
  const buyoutCost = getMilitaryBuyoutCostToman(save.state, dataset);

  if (option === 'buyout' && save.state.player.moneyToman < buyoutCost) {
    return { save, success: false, message: 'موجودی برای خرید خدمت کافی نیست' };
  }

  let message = '';
  const nextSave = updateState(save, (draft) => {
    let nextStatus: MilitaryStatus = draft.player.militaryStatus;
    if (option === 'serve') {
      nextStatus = 'serving';
      draft.flags['military_years'] = 0;
      message = 'خدمت سربازی عادی آغاز شد';
    } else if (option === 'amrieh') {
      if (
        draft.player.education.level === 'bachelor' ||
        draft.player.education.level === 'master' ||
        draft.player.education.level === 'phd'
      ) {
        nextStatus = 'serving';
        draft.flags['military_years'] = 0;
        draft.flags['military_amrieh'] = true;
        message = 'امریه سربازی در نهاد اداری تأیید شد';
      } else {
        message = 'امریه نیاز به مدرک دانشگاهی دارد';
        return;
      }
    } else if (option === 'exempt_medical') {
      if (draft.player.stats.health < 55 || rng.chance(0.28)) {
        nextStatus = 'exempt_medical';
        message = 'معافیت پزشکی تأیید شد';
      } else {
        message = 'کمیسیون پزشکی معافیت را تأیید نکرد';
      }
    } else if (option === 'exempt_breadwinner') {
      const fatherDead = draft.npcs['npc_father'] && !draft.npcs['npc_father'].isAlive;
      if (fatherDead || !draft.npcs['npc_father']) {
        nextStatus = 'exempt_breadwinner';
        message = 'معافیت کفالت خانواده صادر شد';
      } else {
        message = 'شرایط کفالت محرز نشد';
      }
    } else if (option === 'buyout') {
      deductMoney(draft, buyoutCost);
      nextStatus = 'bought_out';
      message = 'خرید خدمت با موفقیت انجام شد';
    } else if (option === 'defer') {
      draft.flags['military_absent'] = true;
      draft.player.stats = applyStatDelta(draft.player.stats, { mentalHealth: -3 });
      message = 'دفترچه ارسال نشد؛ فعلاً غیبت ثبت شد';
    }

    draft.player.militaryStatus = nextStatus;
    if (message) {
      pushTimeline(draft, 'وضعیت نظام وظیفه', message, 'milestone');
    }
  });

  const ok = !message.includes('نیاز') && !message.includes('نکرد') && !message.includes('نشد');
  return { save: nextSave, success: ok, message };
}

export function tradeInvestmentAction(
  save: SaveGame,
  invId: 'inv_usd' | 'inv_gold' | 'inv_bourse' | 'inv_deposit' | 'inv_crypto',
  titleFa: string,
  assetType: Asset['type'],
  amountToman: number,
  mode: 'buy' | 'sell',
): ActionOutcome {
  if (amountToman <= 0) {
    return { save, success: false, message: 'مبلغ باید بیشتر از صفر باشد' };
  }

  if (mode === 'buy' && save.state.player.moneyToman < amountToman) {
    return { save, success: false, message: 'موجودی نقد کافی نیست' };
  }

  const existing = save.state.assets.find((a) => a.id === invId);
  if (mode === 'sell' && (!existing || existing.currentValueToman <= 0)) {
    return { save, success: false, message: 'دارایی برای فروش نداری' };
  }

  let message = '';
  const nextSave = updateState(save, (draft) => {
    const asset = draft.assets.find((a) => a.id === invId);
    if (mode === 'buy') {
      deductMoney(draft, amountToman);
      if (asset) {
        asset.purchasePriceToman += amountToman;
        asset.currentValueToman += amountToman;
        asset.quantity += 1;
      } else {
        draft.assets.push({
          id: invId,
          type: assetType,
          name: titleFa,
          quantity: 1,
          purchasePriceToman: amountToman,
          currentValueToman: amountToman,
        });
      }
      message = `خرید ${titleFa} انجام شد`;
    } else {
      const sellAmt = Math.min(amountToman, asset!.currentValueToman);
      asset!.currentValueToman -= sellAmt;
      draft.player.moneyToman += sellAmt;
      if (asset!.currentValueToman <= 1000) {
        draft.assets = draft.assets.filter((a) => a.id !== invId);
      }
      message = `فروش ${titleFa} و واریز به نقدینگی انجام شد`;
    }
    pushTimeline(draft, titleFa, message, 'life');
  });

  return { save: nextSave, success: true, message };
}

export function applyHousingAction(
  save: SaveGame,
  listing: HousingListing,
  dataset: GameDataset = gameDataset,
  extraDepositToman = 0,
): ActionOutcome {
  const quote = calculateHousingQuote(listing, save.state.player.currentCityId, save.state, dataset);

  if (listing.mode === 'rent') {
    const converted = convertDepositRentPair(
      quote.depositRahnToman,
      quote.monthlyRentToman,
      extraDepositToman,
      dataset,
    );
    const upfront = converted.deposit + converted.monthlyRent;
    const availableAfterRefund =
      save.state.player.moneyToman + save.state.player.housing.depositRahnToman;
    if (availableAfterRefund < upfront) {
      return { save, success: false, message: 'موجودی برای ودیعه رهن و اجاره ماه اول کافی نیست' };
    }
    const nextSave = updateState(save, (draft) => {
      draft.player.moneyToman += draft.player.housing.depositRahnToman;
      deductMoney(draft, upfront);
      draft.player.housing = {
        type: 'rent',
        cityId: draft.player.currentCityId,
        monthlyRentToman: converted.monthlyRent,
        depositRahnToman: converted.deposit,
        propertyValueToman: 0,
      };
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 4 });
      pushTimeline(
        draft,
        'اجاره مسکن جدید',
        `قرارداد «${listing.titleFa}» با ودیعه ${formatToman(converted.deposit)} و اجاره ماهانه ${formatToman(converted.monthlyRent)} بسته شد.`,
        'milestone',
        { happiness: 4 },
      );
    });
    return { save: nextSave, success: true, message: 'قرارداد اجاره مسکن ثبت شد' };
  }

  const buyPrice = quote.transactionPriceToman;
  const availableAfterSale =
    save.state.player.moneyToman +
    save.state.player.housing.propertyValueToman +
    save.state.player.housing.depositRahnToman;

  if (availableAfterSale < buyPrice) {
    return { save, success: false, message: 'موجودی برای خرید این ملک کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    draft.player.moneyToman +=
      draft.player.housing.propertyValueToman + draft.player.housing.depositRahnToman;
    deductMoney(draft, buyPrice);
    draft.player.housing = {
      type: listing.areaSqm >= 160 ? 'villa' : 'owned',
      cityId: draft.player.currentCityId,
      monthlyRentToman: 0,
      depositRahnToman: 0,
      propertyValueToman: buyPrice,
    };
    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 9, fame: 5 });
    pushTimeline(
      draft,
      'خرید خانه',
      `سند «${listing.titleFa}» به قیمت قطعی معامله (${formatToman(buyPrice)}) به نامت زده شد.`,
      'milestone',
      { happiness: 9, fame: 5 },
    );
  });

  return { save: nextSave, success: true, message: 'خرید مسکن با موفقیت انجام شد' };
}

export function buyVehicleAction(save: SaveGame, vehicle: VehicleCatalogItem): ActionOutcome {
  const price = getAdjustedPriceToman(vehicle.basePriceToman, save.state);
  if (save.state.player.moneyToman < price) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }
  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, price);
    draft.assets.push({
      id: `veh_${vehicle.id}_${draft.turn}`,
      type: 'car',
      name: vehicle.titleFa,
      quantity: 1,
      purchasePriceToman: price,
      currentValueToman: price,
    });
    draft.player.stats = applyStatDelta(draft.player.stats, {
      happiness: vehicle.happinessBonus,
      fame: vehicle.fameBonus,
    });
    pushTimeline(
      draft,
      `خرید ${vehicle.titleFa}`,
      `کلید «${vehicle.titleFa}» را تحویل گرفتی.`,
      'milestone',
      { happiness: vehicle.happinessBonus, fame: vehicle.fameBonus },
    );
  });
  return { save: nextSave, success: true, message: `${vehicle.titleFa} خریداری شد` };
}

export function sellVehicleAction(save: SaveGame, assetId: string): ActionOutcome {
  const vehicle = save.state.assets.find((a) => a.id === assetId && a.type === 'car');
  if (!vehicle) {
    return { save, success: false, message: 'خودرو پیدا نشد' };
  }
  const nextSave = updateState(save, (draft) => {
    draft.player.moneyToman += vehicle.currentValueToman;
    draft.assets = draft.assets.filter((a) => a.id !== assetId);
    pushTimeline(
      draft,
      'فروش خودرو',
      `«${vehicle.name}» فروخته شد و مبلغ به نقدینگی اضافه شد.`,
      'life',
    );
  });
  return { save: nextSave, success: true, message: `${vehicle.name} فروخته شد` };
}

export function repairVehicleAction(
  save: SaveGame,
  assetId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const vehicle = save.state.assets.find((a) => a.id === assetId && a.type === 'car');
  if (!vehicle) return { save, success: false, message: 'خودرو پیدا نشد' };
  const cost = getCarRepairCostToman(vehicle.currentValueToman, dataset);
  if (save.state.player.moneyToman < cost) {
    return { save, success: false, message: 'موجودی برای سرویس و تعمیر کافی نیست' };
  }
  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, cost);
    draft.player.stats = applyStatDelta(draft.player.stats, { mentalHealth: 2 });
    pushTimeline(
      draft,
      'سرویس دوره‌ای خودرو',
      `«${vehicle.name}» سرویس کامل شد و ایمن‌تر شد.`,
      'life',
    );
  });
  return { save: nextSave, success: true, message: 'سرویس خودرو انجام شد' };
}

export function takeLoanAction(
  save: SaveGame,
  presetKind: 'personal' | 'housing',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const credit = getCreditScore(save.state);
  if (credit < 480) {
    return { save, success: false, message: 'امتیاز اعتباری برای دریافت وام جدید پایین است' };
  }
  if (save.state.loans.length >= 3) {
    return { save, success: false, message: 'حداکثر ۳ وام فعال مجاز است' };
  }
  const presets = getLoanPresets(save.state, dataset);
  const preset = presets[presetKind];
  const principal = preset.principalToman;
  const annualPayment = Math.round(
    (principal * (1 + preset.annualRate * preset.years)) / preset.years,
  );

  const nextSave = updateState(save, (draft) => {
    draft.loans.push({
      id: `loan_${draft.turn}_${draft.loans.length + 1}`,
      name: preset.name,
      principalRemainingToman: principal,
      annualInterestRate: preset.annualRate,
      annualPaymentToman: annualPayment,
      yearsRemaining: preset.years,
    });
    draft.player.moneyToman += principal;
    pushTimeline(
      draft,
      `دریافت ${preset.name}`,
      `مبلغ ${formatToman(principal)} وام به حساب اضافه شد و اقساط سالانه تنظیم گردید.`,
      'life',
    );
  });

  return { save: nextSave, success: true, message: `${preset.name} دریافت شد` };
}

export function payOffDebtAction(save: SaveGame, amount: number): ActionOutcome {
  if (amount <= 0) return { save, success: false, message: 'مبلغ نامعتبر است' };
  if (save.state.player.moneyToman < amount) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    const pay = Math.min(amount, draft.player.debtToman);
    if (pay > 0) {
      deductMoney(draft, pay);
      draft.player.debtToman -= pay;
      draft.flags['credit_score'] = Math.min(850, getCreditScore(draft) + 15);
      pushTimeline(draft, 'تسویه بدهی', `بخشی از بدهی معوق تسویه شد.`, 'life');
    } else if (draft.loans.length > 0) {
      const target = draft.loans[0];
      const loanPay = Math.min(amount, target.principalRemainingToman);
      deductMoney(draft, loanPay);
      target.principalRemainingToman -= loanPay;
      if (target.principalRemainingToman <= 0) {
        draft.loans.shift();
      }
      draft.flags['credit_score'] = Math.min(850, getCreditScore(draft) + 18);
      pushTimeline(
        draft,
        'پرداخت پیش‌ازموعد وام',
        `بخشی از اصل وام «${target.name}» تسویه شد.`,
        'life',
      );
    }
  });

  return { save: nextSave, success: true, message: 'پرداخت با موفقیت انجام شد' };
}

export function buyShopItemAction(save: SaveGame, item: ShopItemDefinition): ActionOutcome {
  if (save.state.player.age < item.minAge) {
    return { save, success: false, message: `از ${toPersianDigits(item.minAge)} سالگی فعال می‌شود` };
  }
  const owned = getOwnedShopItemIds(save.state);
  if (!item.repeatable && owned.includes(item.id)) {
    return { save, success: false, message: 'قبلاً این کالا را خریده‌ای' };
  }
  const price = getAdjustedPriceToman(item.basePriceToman, save.state);
  if (save.state.player.moneyToman < price) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, price);
    if (!item.repeatable) {
      draft.flags['shop_owned'] = JSON.stringify([...owned, item.id]);
    }
    draft.player.stats = applyStatDelta(draft.player.stats, item.stats);
    pushTimeline(
      draft,
      `خرید ${item.titleFa}`,
      `«${item.titleFa}» را تهیه کردی و از آن لذت می‌بری.`,
      'life',
      item.stats,
    );
  });

  return { save: nextSave, success: true, message: `${item.titleFa} خریداری شد` };
}

export function interactWithPersonAction(
  save: SaveGame,
  personId: string,
  interaction:
    | 'talk'
    | 'gift'
    | 'compliment'
    | 'trip'
    | 'argue'
    | 'propose'
    | 'marry'
    | 'have_child'
    | 'divorce',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const person = save.state.npcs[personId];
  const relIdx = save.state.relationships.findIndex((r) => r.personId === personId);
  if (!person || relIdx === -1 || !person.isAlive) {
    return { save, success: false, message: 'این فرد در دسترس نیست' };
  }
  if (
    interaction !== 'divorce' &&
    interaction !== 'marry' &&
    save.state.flags[`cd_rel_${personId}_${interaction}`] === save.state.turn
  ) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }

  const { giftCost, tripCost, weddingCost } = getRelationshipActionCosts(save.state, dataset);

  if (interaction === 'gift' && save.state.player.moneyToman < giftCost) {
    return { save, success: false, message: 'موجودی برای خرید هدیه کافی نیست' };
  }
  if (interaction === 'trip' && save.state.player.moneyToman < tripCost) {
    return { save, success: false, message: 'موجودی برای هزینه سفر کافی نیست' };
  }
  if (interaction === 'marry' && save.state.player.moneyToman < weddingCost) {
    return { save, success: false, message: 'هزینه مراسم و شروع زندگی مشترک کافی نیست' };
  }

  let msg = '';
  const nextSave = updateState(save, (draft) => {
    const rel = draft.relationships[relIdx];
    const npc = draft.npcs[personId];
    draft.flags[`cd_rel_${personId}_${interaction}`] = draft.turn;

    if (interaction === 'talk') {
      rel.closeness = clampStat(rel.closeness + 8);
      rel.respect = clampStat(rel.respect + 4);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 3, mentalHealth: 3 });
      msg = `با ${npc.firstName} گپ صمیمی زدی و از حال هم باخبر شدید.`;
    } else if (interaction === 'gift') {
      deductMoney(draft, giftCost);
      rel.closeness = clampStat(rel.closeness + 14);
      rel.respect = clampStat(rel.respect + 8);
      if (rel.role === 'partner' || rel.role === 'spouse') rel.romance = clampStat(rel.romance + 10);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 5 });
      msg = `برای ${npc.firstName} هدیه خریدی و حسابی خوشحالش کردی.`;
    } else if (interaction === 'compliment') {
      rel.closeness = clampStat(rel.closeness + 6);
      rel.respect = clampStat(rel.respect + 6);
      msg = `از زحمات و رفتار خوب ${npc.firstName} تعریف کردی.`;
    } else if (interaction === 'trip') {
      deductMoney(draft, tripCost);
      rel.closeness = clampStat(rel.closeness + 16);
      if (rel.role === 'partner' || rel.role === 'spouse') rel.romance = clampStat(rel.romance + 14);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 8, mentalHealth: 6 });
      msg = `یک سفر دونفره و خاطره‌انگیز با ${npc.firstName} رفتید.`;
    } else if (interaction === 'argue') {
      rel.closeness = clampStat(rel.closeness - 14);
      rel.respect = clampStat(rel.respect - 10);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -4, mentalHealth: -5 });
      msg = `سر موضوعی با ${npc.firstName} بحثت شد و دلخوری پیش آمد.`;
    } else if (interaction === 'propose') {
      draft.player.maritalStatus = 'engaged';
      rel.romance = clampStat(rel.romance + 15);
      msg = `مراسم خواستگاری و بله‌برون با ${npc.firstName} انجام شد.`;
      pushTimeline(draft, 'خواستگاری و نامزدی', msg, 'milestone', { happiness: 10 });
    } else if (interaction === 'marry') {
      deductMoney(draft, weddingCost);
      rel.role = 'spouse';
      rel.romance = clampStat(rel.romance + 18);
      rel.closeness = clampStat(rel.closeness + 12);
      draft.player.maritalStatus = 'married';
      draft.flags['married_year'] = draft.currentJalaliYear;
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 12, fame: 3 });
      msg = `جشن عروسی با ${npc.firstName} برگزار شد و زندگی مشترک را آغاز کردید.`;
      pushTimeline(draft, 'ازدواج', msg, 'milestone', { happiness: 12 });
    } else if (interaction === 'have_child') {
      const rng = new SeededRNG(`${save.seed}:child:${draft.turn}`);
      const eth = draft.player.ethnicity;
      const pool = dataset.names.ethnicities[eth];
      const childGender = rng.chance(0.5) ? 'male' : 'female';
      const childId = `npc_child_${draft.turn}_${Object.keys(draft.npcs).length}`;
      const childName =
        childGender === 'male' ? rng.pick(pool.maleFirstNames) : rng.pick(pool.femaleFirstNames);
      const child: Person = {
        id: childId,
        firstName: childName,
        lastName: draft.player.lastName,
        gender: childGender,
        age: 0,
        traits: ['کنجکاو', 'مهربان'],
        jobTitle: 'نوزاد',
        isAlive: true,
        avatarSeed: generateIndependentAvatarSeed(rng, 'child'),
        originKind: 'biological',
      };
      draft.npcs[childId] = child;
      draft.relationships.push({
        personId: childId,
        role: 'child',
        closeness: 90,
        respect: 80,
        romance: 0,
      });
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 14, mentalHealth: -2 });
      msg = `فرزندت «${childName}» به دنیا آمد و خانه پر از ذوق شد.`;
      pushTimeline(draft, `تولد ${childName}`, msg, 'milestone', { happiness: 14 });
    } else if (interaction === 'divorce') {
      draft.player.maritalStatus = 'divorced';
      delete draft.flags['married_year'];
      draft.relationships.splice(relIdx, 1);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -14, mentalHealth: -12 });
      msg = `زندگی مشترک با ${npc.firstName} با توافق به جدایی رسید.`;
      pushTimeline(draft, 'جدایی و طلاق', msg, 'milestone', {
        happiness: -14,
        mentalHealth: -12,
      });
    }

    appendNpcHistory(draft, personId, msg);
    if (!['propose', 'marry', 'have_child', 'divorce'].includes(interaction)) {
      pushTimeline(draft, `رابطه با ${npc.firstName}`, msg, 'life');
    }
  });

  return { save: nextSave, success: true, message: msg };
}

export function findNewRelationshipAction(
  save: SaveGame,
  kind: 'friend' | 'partner',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (kind === 'partner' && !save.contentSettings.allowRomance) {
    return { save, success: false, message: 'رویدادهای عاشقانه در تنظیمات محتوا خاموش است' };
  }
  if (kind === 'partner' && save.state.player.age < 18) {
    return { save, success: false, message: 'از ۱۸ سالگی فعال می‌شود' };
  }
  if (save.state.flags[`cd_find_${kind}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال' };
  }

  const rng = new SeededRNG(
    `${save.seed}:meet_${kind}:${save.state.turn}:${save.state.relationships.length}`,
  );
  const eth = save.state.player.ethnicity;
  const pool = dataset.names.ethnicities[eth];
  const gender =
    kind === 'partner'
      ? save.state.player.gender === 'male'
        ? 'female'
        : 'male'
      : rng.chance(0.5)
        ? 'male'
        : 'female';
  const firstName =
    gender === 'male' ? rng.pick(pool.maleFirstNames) : rng.pick(pool.femaleFirstNames);
  const lastName = rng.pick(pool.lastNames);
  const npcId = `npc_${kind}_${save.state.turn}_${Object.keys(save.state.npcs).length}`;

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_find_${kind}`] = draft.turn;
    draft.npcs[npcId] = {
      id: npcId,
      firstName,
      lastName,
      gender,
      age: Math.max(6, draft.player.age + rng.int(-3, 3)),
      traits: [rng.pick(['خوش‌برخورد', 'اهل سفر', 'دقیق', 'مهربان', 'شوخ‌طبع'])],
      jobTitle: draft.player.age >= 22 ? rng.pick(dataset.jobs).titleFa : 'دانشجو / دانش‌آموز',
      isAlive: true,
      avatarSeed: generateIndependentAvatarSeed(rng, kind),
    };
    draft.relationships.push({
      personId: npcId,
      role: kind,
      closeness: rng.int(48, 72),
      respect: rng.int(50, 75),
      romance: kind === 'partner' ? rng.int(55, 82) : 0,
    });
    const text =
      kind === 'partner'
        ? `با «${firstName} ${lastName}» آشنا شدی و ارتباط عاطفی محترمانه‌ای شکل گرفت.`
        : `با «${firstName} ${lastName}» دوست شدی و رفت‌وآمدتان بیشتر شد.`;
    appendNpcHistory(draft, npcId, text);
    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 5 });
    pushTimeline(draft, kind === 'partner' ? 'آشنایی عاطفی تازه' : 'دوست تازه', text, 'life', {
      happiness: 5,
    });
  });

  return {
    save: nextSave,
    success: true,
    message: `${firstName} ${lastName} به دایره روابطت اضافه شد`,
  };
}

export function advanceEmigrationStepAction(
  save: SaveGame,
  country: CountryDefinition,
  path: 'study' | 'work' | 'investment',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (save.state.player.age < 18) {
    return { save, success: false, message: 'مهاجرت مستقل از ۱۸ سالگی فعال می‌شود' };
  }
  const progress = getEmigrationProgress(save.state);
  const sameTrack = progress.targetCountryId === country.id && progress.path === path;
  const currentStep = sameTrack ? progress.step : 0;
  const nextStep = currentStep + 1;

  const stepNames: Record<number, string> = {
    1: 'آماده‌سازی و ترجمه مدارک',
    2: 'آزمون زبان بین‌المللی',
    3: 'دریافت پذیرش یا پیشنهاد کاری',
    4: 'مصاحبه و صدور ویزای نهایی',
  };

  const cost = getEmigrationStepCostToman(country, currentStep, save.state, dataset);
  if (save.state.player.moneyToman < cost) {
    return {
      save,
      success: false,
      message: `موجودی برای مرحله «${stepNames[nextStep]}» کافی نیست`,
    };
  }

  const rng = new SeededRNG(`${save.seed}:emig:${country.id}:${nextStep}:${save.state.turn}`);
  const baseSuccess = Math.max(
    0.45,
    0.92 - country.difficulty * 0.35 + (save.state.player.stats.intelligence - 50) * 0.003,
  );
  const succeeded = nextStep < 4 ? rng.chance(baseSuccess) : rng.chance(baseSuccess + 0.05);

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, cost);
    draft.flags['emig_target'] = country.id;
    draft.flags['emig_path'] = path;

    if (!succeeded) {
      draft.player.stats = applyStatDelta(draft.player.stats, { mentalHealth: -5, happiness: -4 });
      pushTimeline(
        draft,
        `توقف موقت پرونده مهاجرت به ${country.nameFa}`,
        `در مرحله «${stepNames[nextStep]}» پرونده با تأخیر روبه‌رو شد؛ می‌توانی دوباره اقدام کنی.`,
        'life',
        { mentalHealth: -5 },
      );
      return;
    }

    draft.flags['emig_step'] = nextStep;
    if (nextStep >= 4) {
      draft.player.countryId = country.id;
      draft.player.currentCityId = country.id;
      draft.player.job = null;
      draft.flags['emig_step'] = 0;
      draft.flags['emig_target'] = '';
      unlockAchievement(draft, 'emigrated');
      draft.player.stats = applyStatDelta(draft.player.stats, {
        happiness: 10,
        fame: 4,
        mentalHealth: -4,
      });
      pushTimeline(
        draft,
        `مهاجرت به ${country.nameFa}`,
        `ویزا صادر شد و فصل تازه‌ای از زندگی‌ات را در ${country.nameFa} آغاز کردی.`,
        'milestone',
        { happiness: 10 },
      );
    } else {
      pushTimeline(
        draft,
        `پیشرفت پرونده مهاجرت (${country.nameFa})`,
        `مرحله «${stepNames[nextStep]}» با موفقیت تکمیل شد.`,
        'life',
      );
    }
  });

  return {
    save: nextSave,
    success: succeeded,
    message: succeeded
      ? nextStep >= 4
        ? `مهاجرت به ${country.nameFa} با موفقیت انجام شد!`
        : `مرحله «${stepNames[nextStep]}» تکمیل شد`
      : `مرحله «${stepNames[nextStep]}» نیاز به تلاش مجدد دارد`,
  };
}

export function developTalentAction(
  save: SaveGame,
  talentId: TalentId,
  mode: 'self_practice' | 'lesson_or_club' | 'audition_or_contest' | 'publish_online',
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.isAlive) {
    return { save, success: false, message: 'زندگی به پایان رسیده است' };
  }
  const talent = dataset.talents.talents.find((t) => t.id === talentId);
  if (!talent) {
    return { save, success: false, message: 'استعداد مورد نظر یافت نشد' };
  }
  if (save.state.player.age < talent.minPracticeAge) {
    return {
      save,
      success: false,
      message: `از ${toPersianDigits(talent.minPracticeAge)} سالگی قابل تمرین است`,
    };
  }
  const cdKey = `talent_${talentId}`;
  if (save.state.flags[`cd_${cdKey}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال برای هر زمینه' };
  }

  const cost =
    mode === 'lesson_or_club'
      ? getTalentLessonCostToman(talent, save.state, dataset)
      : mode === 'audition_or_contest'
        ? Math.round(getTalentLessonCostToman(talent, save.state, dataset) * 0.5)
        : 0;

  if (cost > 0 && save.state.player.moneyToman < cost) {
    return { save, success: false, message: 'موجودی کافی نیست' };
  }

  const rng = new SeededRNG(`${save.seed}:talent_dev:${talentId}:${mode}:${save.state.turn}`);
  const innateScore = save.state.player.hiddenTalents[talentId];
  const gains = calculateTalentSkillGain({
    innateTalentScore: innateScore,
    mode,
    conscientiousness: save.state.player.hiddenStats.conscientiousness,
    luck: save.state.player.hiddenStats.luck,
    rng,
  });

  let discoveredNowTitle: string | null = null;
  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_${cdKey}`] = draft.turn;
    deductMoney(draft, cost);

    const prevSkill = getTalentSkillState(draft, talentId);
    const nextSkillVal = clampStat(prevSkill.skill + gains.skillGain);
    const nextOppVal = clampStat(prevSkill.opportunityScore + gains.opportunityGain);

    draft.player.talentSkills[talentId] = {
      ...prevSkill,
      skill: nextSkillVal,
      practiceCount: prevSkill.practiceCount + 1,
      opportunityScore: nextOppVal,
    };

    // Active exploration can spark discovery of a talent not yet surfaced
    const alreadyDiscovered = draft.player.discoveredTalents.some((d) => d.talentId === talentId);
    if (!alreadyDiscovered) {
      const sparkProb =
        mode === 'lesson_or_club' || mode === 'audition_or_contest'
          ? 0.35 + (innateScore / 100) * 0.55
          : 0.2 + (innateScore / 100) * 0.45;
      if (rng.chance(sparkProb) || prevSkill.practiceCount + 1 >= 2) {
        const tier = getTierForTalentScore(innateScore, dataset);
        const hintTextFa = rng.pick(talent.discoveryHintsFa);
        const athleticDiscipline =
          talentId === 'athletics' ? draft.player.athleticDiscipline : undefined;
        draft.player.discoveredTalents.push({
          talentId,
          tier,
          discoveredAge: draft.player.age,
          hintTextFa,
          athleticDiscipline,
        });
        const tierLabel = getTierLabelFa(tier, dataset);
        const discLabel =
          athleticDiscipline !== undefined
            ? `${talent.titleFa} (${getAthleticDisciplineTitleFa(athleticDiscipline, dataset)})`
            : talent.titleFa;
        discoveredNowTitle = `${discLabel} (${tierLabel})`;
        pushTimeline(
          draft,
          `شناخت گرایش در ${discLabel}`,
          `${hintTextFa} (نشانه: ${tierLabel})`,
          tier === 'clear_talent' || tier === 'brilliant_talent' ? 'milestone' : 'life',
          { happiness: 4 },
        );
      }
    }

    const modeLabels: Record<typeof mode, string> = {
      self_practice: 'تمرین فردی',
      lesson_or_club: talent.lessonTitleFa,
      audition_or_contest: 'شرکت در مسابقه و فراخوان',
      publish_online: 'انتشار اثر در فضای مجازی',
    };

    draft.player.stats = applyStatDelta(draft.player.stats, {
      happiness: 2,
      fame: gains.fameGain,
      health: talentId === 'athletics' ? 3 : 0,
    });

    pushTimeline(
      draft,
      `${modeLabels[mode]} (${talent.titleFa})`,
      `در «${talent.titleFa}» وقت گذاشتی و مهارت و تجربه‌ات در این مسیر پخته‌تر شد.`,
      'life',
      { happiness: 2, ...(gains.fameGain > 0 ? { fame: gains.fameGain } : {}) },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: discoveredNowTitle
      ? `تمرین ثبت شد و گرایش تازه نمایان شد: ${discoveredNowTitle}`
      : `پیشرفت در «${talent.titleFa}» ثبت شد`,
  };
}

export function pursueSpecialCareerAction(
  save: SaveGame,
  careerId: string,
  routeId: SpecialCareerRouteId,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const career = dataset.specialCareers.find((c) => c.id === careerId);
  if (!career) {
    return { save, success: false, message: 'مسیر حرفه‌ای یافت نشد' };
  }

  const cdKey = `special_${careerId}`;
  if (save.state.flags[`cd_${cdKey}`] === save.state.turn) {
    return { save, success: false, message: 'فقط یک بار در سال می‌توانی برای این مرحله اقدام کنی' };
  }

  const eligibility = getSpecialCareerEligibility(career, save.state, dataset);
  if (!eligibility.eligible || !eligibility.discovered) {
    return {
      save,
      success: false,
      message: eligibility.reason ?? 'شرایط ورود به این مرحله هنوز کامل نیست',
    };
  }

  const activeTalentId = eligibility.discovered.talentId;
  const rng = new SeededRNG(`${save.seed}:special:${careerId}:${save.state.turn}:${routeId}`);
  const passed = rng.chance(eligibility.estimatedChancePct / 100);
  const nextStage = Math.min(4, eligibility.currentStage + 1);
  const stageTitle = career.stageTitlesFa[nextStage - 1];

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_${cdKey}`] = draft.turn;
    const prevSkill = getTalentSkillState(draft, activeTalentId);

    if (passed) {
      if (draft.player.job && draft.player.job.jobId !== getSpecialCareerStageJobId(career.id)) {
        const hist = getWorkHistory(draft);
        hist.push({
          title: draft.player.job.title,
          employer: 'سابقه قبلی',
          fromYear: draft.currentJalaliYear - draft.player.job.yearsInJob,
          toYear: draft.currentJalaliYear,
        });
        draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
      }

      draft.player.talentSkills[activeTalentId] = {
        ...prevSkill,
        careerStage: nextStage,
        activeRoute: routeId,
        opportunityScore: clampStat(prevSkill.opportunityScore + 10),
      };

      const breakdown = calculateSpecialCareerAnnualIncomeBreakdown({
        career,
        stage: nextStage,
        state: draft,
        dataset,
        rng,
        allowTail: false,
      });

      draft.player.job = {
        jobId: getSpecialCareerStageJobId(career.id),
        title: `${career.titleFa} — ${stageTitle}`,
        track: 'special',
        level: nextStage,
        annualSalaryToman: breakdown.netAnnual,
        stress: 55 + nextStage * 5,
        yearsInJob: draft.player.job?.jobId === getSpecialCareerStageJobId(career.id)
          ? draft.player.job.yearsInJob
          : 0,
      };
      draft.flags['last_job_gross'] = breakdown.grossAnnual;
      draft.flags['last_job_net'] = breakdown.netAnnual;
      draft.flags['last_job_deductions'] = breakdown.bimeh + breakdown.incomeTax;

      const fameBoost = nextStage === 1 ? 6 : nextStage === 2 ? 12 : nextStage === 3 ? 18 : 24;
      draft.player.stats = applyStatDelta(draft.player.stats, {
        happiness: 8,
        fame: fameBoost,
      });

      const routeObj = career.alternativeRoutes.find((r) => r.id === routeId);
      pushTimeline(
        draft,
        `پذیرش در مسیر «${career.titleFa}»`,
        `در مرحله «${stageTitle}» (${routeObj?.titleFa ?? ''}) پذیرفته شدی و قرارداد کاری تازه با خالص ${formatToman(breakdown.netAnnual)} در سال بسته شد.`,
        'milestone',
        { happiness: 8, fame: fameBoost },
      );
    } else {
      draft.player.talentSkills[activeTalentId] = {
        ...prevSkill,
        auditionFailures: prevSkill.auditionFailures + 1,
        opportunityScore: clampStat(prevSkill.opportunityScore + 3),
      };
      draft.player.stats = applyStatDelta(draft.player.stats, {
        happiness: -3,
        mentalHealth: -2,
      });
      pushTimeline(
        draft,
        `نتیجه آزمون «${career.titleFa}»`,
        `این بار در فراخوان مرحله «${stageTitle}» پذیرفته نشدی، اما تجربه صحنه و تمرین بعدی شانس‌ت را بالا می‌برد.`,
        'life',
        { happiness: -3 },
      );
    }
  });

  return {
    save: nextSave,
    success: passed,
    message: passed
      ? `تبریک! در مرحله «${stageTitle}» پذیرفته شدی`
      : 'این بار پذیرفته نشدی؛ تمرین و فرصت بیشتر شانس را بالا می‌برد',
  };
}

export function enterSpecialFallbackCareerAction(
  save: SaveGame,
  careerId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const career = dataset.specialCareers.find((c) => c.id === careerId);
  if (!career) {
    return { save, success: false, message: 'مسیر شغلی یافت نشد' };
  }
  if (save.state.player.age < 18) {
    return { save, success: false, message: 'از ۱۸ سالگی فعال می‌شود' };
  }
  const skillState = getTalentSkillState(save.state, career.requiredTalentId);
  const hasDiscovered = save.state.player.discoveredTalents.some(
    (d) =>
      d.talentId === career.requiredTalentId ||
      (career.optionalAltTalentIds ?? []).includes(d.talentId),
  );
  if (!hasDiscovered && skillState.skill < 25) {
    return {
      save,
      success: false,
      message: 'ابتدا باید در این زمینه تجربه یا تمرین کافی داشته باشی',
    };
  }

  const nextSave = updateState(save, (draft) => {
    if (draft.player.job) {
      const hist = getWorkHistory(draft);
      hist.push({
        title: draft.player.job.title,
        employer: 'سابقه قبلی',
        fromYear: draft.currentJalaliYear - draft.player.job.yearsInJob,
        toYear: draft.currentJalaliYear,
      });
      draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
    }

    const breakdown = calculateSpecialCareerAnnualIncomeBreakdown({
      career,
      stage: 1,
      state: draft,
      dataset,
      isFallback: true,
    });

    draft.player.job = {
      jobId: getSpecialCareerFallbackJobId(career.id),
      title: career.fallbackCareerFa,
      track: 'special',
      level: 1,
      annualSalaryToman: breakdown.netAnnual,
      stress: 42,
      yearsInJob: 0,
    };
    draft.flags['last_job_gross'] = breakdown.grossAnnual;
    draft.flags['last_job_net'] = breakdown.netAnnual;
    draft.flags['last_job_deductions'] = breakdown.bimeh + breakdown.incomeTax;

    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 5, fame: 2 });
    pushTimeline(
      draft,
      `شروع فعالیت: ${career.fallbackCareerFa}`,
      `تجربه‌ات را به عنوان «${career.fallbackCareerFa}» به مسیر شغلی پایدار با خالص ${formatToman(breakdown.netAnnual)} در سال تبدیل کردی.`,
      'milestone',
      { happiness: 5 },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: `به عنوان «${career.fallbackCareerFa}» مشغول به کار شدی`,
  };
}

export function saveWillAction(
  save: SaveGame,
  will: WillConfig,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!isWillUnlocked(save.state, dataset)) {
    return {
      save,
      success: false,
      message: `ثبت وصیت‌نامه از ${toPersianDigits(dataset.inheritance.rules.minWillAge)} سالگی یا در وضعیت بیماری شدید فعال می‌شود`,
    };
  }
  const nextSave = updateState(save, (draft) => {
    draft.will = {
      ...will,
      updatedAtAge: draft.player.age,
      updatedAtYear: draft.currentJalaliYear,
      beneficiaries: will.beneficiaries.map((b) => ({ ...b })),
      specificItems: { ...will.specificItems },
    };
    pushTimeline(
      draft,
      'ثبت یا به‌روزرسانی وصیت‌نامه',
      'وصیت‌نامه و تقسیم دارایی‌هایت با در نظر گرفتن سقف قانونی یک‌سوم ثبت شد.',
      'life',
    );
  });
  return {
    save: nextSave,
    success: true,
    message: 'وصیت‌نامه با موفقیت ثبت شد',
  };
}

export function continueDynastyWithHeirAction(
  save: SaveGame,
  params: {
    heirId: string;
    distantCandidate?: HeirCandidate;
    homeDecision: SharedAssetDecision;
    businessDecision: SharedAssetDecision;
  },
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const outcome = inheritFromDeceasedToHeir({
    save,
    heirId: params.heirId,
    distantCandidate: params.distantCandidate,
    homeDecision: params.homeDecision,
    businessDecision: params.businessDecision,
    dataset,
  });
  return {
    save: outcome.save,
    success: true,
    message: `فصل تازه‌ای با «${outcome.save.state.player.firstName} ${outcome.save.state.player.lastName}» آغاز شد`,
  };
}

export function endDynastyWithCharityAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const res = applyCharityFoundationEnding(save, dataset);
  return {
    save: res.save,
    success: true,
    message: `بنیاد خیریه «${res.save.state.dynasty?.charityFoundationNameFa ?? 'خانوادگی'}» با ماترک باقی‌مانده ثبت شد`,
  };
}

export function closeDynastyAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const nextSave = closeDynastyCleanly(save, dataset);
  return {
    save: nextSave,
    success: true,
    message: 'دفتر دودمان با احترام بسته شد',
  };
}

export function obtainInfertilityCertificateAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.isAlive) {
    return { save, success: false, message: 'زندگی به پایان رسیده است' };
  }
  const report = evaluateAdoptionEligibility(save.state, 'permanent', dataset);
  if (!report.canTakeInfertilityTest) {
    return {
      save,
      success: false,
      message: 'در حال حاضر نیازی به گواهی پزشکی ناباروری نیست یا شرایط اولیه آن برقرار نیست',
    };
  }
  const cost = report.infertilityTestCostToman;
  if (save.state.player.moneyToman < cost) {
    return { save, success: false, message: 'موجودی برای هزینه معاینات و گواهی پزشکی کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, cost);
    const adoption = ensureAdoptionState(draft);
    adoption.hasInfertilityCert = true;
    if (adoption.activeApplication) {
      adoption.activeApplication.hasInfertilityCert = true;
    }
    draft.adoption = adoption;
    pushTimeline(
      draft,
      'دریافت گواهی پزشکی برای تشکیل پرونده سرپرستی',
      'معاینات تخصصی و گواهی پزشکی لازم برای استفاده از استثنای سابقه ازدواج (ماده ۵ قانون ۱۳۹۲) ثبت شد.',
      'life',
    );
  });

  return {
    save: nextSave,
    success: true,
    message: 'گواهی پزشکی با موفقیت در پرونده ثبت شد',
  };
}

export function startOrSelectAdoptionCareTypeAction(
  save: SaveGame,
  careType: AdoptionCareType,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.isAlive) {
    return { save, success: false, message: 'زندگی به پایان رسیده است' };
  }
  const existing = save.state.adoption?.activeApplication;
  if (existing && (existing.placedChildPersonId || existing.step === 'supervision')) {
    return {
      save,
      success: false,
      message: 'تا پایان دوره نظارت پرونده فعلی نمی‌توانی نوع سرپرستی را تغییر دهی',
    };
  }
  const careDef = dataset.adoption.careTypes.find((c) => c.id === careType);
  if (!careDef) {
    return { save, success: false, message: 'نوع سرپرستی یافت نشد' };
  }

  const nextSave = updateState(save, (draft) => {
    const adoption = ensureAdoptionState(draft);
    adoption.activeApplication = {
      id: `adopt_${draft.currentJalaliYear}_${adoption.pastApplicationsCount + 1}`,
      careType,
      step: 'readiness',
      startedYear: draft.currentJalaliYear,
      commitmentAccepted: false,
      pausedForReflection: false,
      hasInfertilityCert: adoption.hasInfertilityCert,
      completedDocIds: [],
      portalSubmitted: false,
      queueYearsRemaining: 0,
      evaluationStatus: 'not_started',
      evaluationNotesFa: [],
      matchedCandidates: [],
      probationaryApproved: false,
      courtDecreeIssued: false,
    };
    draft.adoption = adoption;
  });

  return {
    save: nextSave,
    success: true,
    message: `مسیر «${careDef.titleFa}» انتخاب شد`,
  };
}

export function advanceAdoptionFromReadinessAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  if (!save.state.isAlive) {
    return { save, success: false, message: 'زندگی به پایان رسیده است' };
  }
  const adoption = ensureAdoptionState(save.state);
  const careType = adoption.activeApplication?.careType ?? 'permanent';
  const report = evaluateAdoptionEligibility(save.state, careType, dataset);
  if (!report.eligible) {
    return {
      save,
      success: false,
      message: report.blockedReasonFa ?? 'پیش‌نیازهای قانونی این مرحله هنوز کامل نشده‌اند',
    };
  }

  const nextSave = updateState(save, (draft) => {
    const nextAdopt = ensureAdoptionState(draft);
    if (!nextAdopt.activeApplication) {
      nextAdopt.activeApplication = {
        id: `adopt_${draft.currentJalaliYear}_${nextAdopt.pastApplicationsCount + 1}`,
        careType,
        step: 'commitment',
        startedYear: draft.currentJalaliYear,
        commitmentAccepted: false,
        pausedForReflection: false,
        hasInfertilityCert: nextAdopt.hasInfertilityCert,
        completedDocIds: [],
        portalSubmitted: false,
        queueYearsRemaining: 0,
        evaluationStatus: 'not_started',
        evaluationNotesFa: [],
        matchedCandidates: [],
        probationaryApproved: false,
        courtDecreeIssued: false,
      };
    } else {
      nextAdopt.activeApplication.step = 'commitment';
      nextAdopt.activeApplication.pausedForReflection = false;
    }
    draft.adoption = nextAdopt;
  });

  return {
    save: nextSave,
    success: true,
    message: 'مرحله آمادگی تأیید شد؛ منشور تعهد آماده بررسی است',
  };
}

export function respondAdoptionCommitmentAction(
  save: SaveGame,
  accepted: boolean,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'commitment') {
    return { save, success: false, message: 'پرونده در مرحله تعهد نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    const adoption = ensureAdoptionState(draft);
    if (!adoption.activeApplication) return;
    if (accepted) {
      adoption.activeApplication.commitmentAccepted = true;
      adoption.activeApplication.pausedForReflection = false;
      adoption.activeApplication.step = 'application';
      pushTimeline(
        draft,
        'امضای تعهدنامه سرپرستی',
        'با آگاهی کامل از مسئولیت عاطفی، تربیتی و قانونی، تعهدنامه سرپرستی را پذیرفتی.',
        'life',
      );
    } else {
      adoption.activeApplication.commitmentAccepted = false;
      adoption.activeApplication.pausedForReflection = true;
    }
    draft.adoption = adoption;
  });

  return {
    save: nextSave,
    success: true,
    message: accepted
      ? 'تعهدنامه ثبت شد؛ اکنون مدارک را تکمیل کن'
      : 'پرونده برای فکر و گفت‌وگوی بیشتر بدون هیچ جریمه‌ای مکث شد',
  };
}

export function completeAdoptionDocumentAction(
  save: SaveGame,
  docId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'application') {
    return { save, success: false, message: 'پرونده در مرحله بارگذاری مدارک نیست' };
  }
  const doc = dataset.adoption.documents.find((d) => d.id === docId);
  if (!doc) {
    return { save, success: false, message: 'مدرک مورد نظر یافت نشد' };
  }
  if (app.completedDocIds.includes(docId)) {
    return { save, success: false, message: 'این مدرک قبلاً ثبت شده است' };
  }

  const roundedFee = getBaselineScaleFromMinWage(doc.feeMinWageMultiple, save.state, dataset);
  if (save.state.player.moneyToman < roundedFee) {
    return { save, success: false, message: 'موجودی برای هزینه صدور این مدرک کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, roundedFee);
    const adoption = ensureAdoptionState(draft);
    if (adoption.activeApplication && !adoption.activeApplication.completedDocIds.includes(docId)) {
      adoption.activeApplication.completedDocIds.push(docId);
    }
    draft.adoption = adoption;
  });

  return {
    save: nextSave,
    success: true,
    message: `«${doc.titleFa}» در سامانه بارگذاری شد`,
  };
}

export function submitAdoptionApplicationAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'application') {
    return { save, success: false, message: 'پرونده در مرحله ثبت درخواست نیست' };
  }
  const allDocsDone = dataset.adoption.documents.every((d) => app.completedDocIds.includes(d.id));
  if (!allDocsDone) {
    return { save, success: false, message: 'ابتدا تمام مدارک فهرست را تکمیل و بارگذاری کن' };
  }

  const { applicationBaseCostToman } = getAdoptionCostEstimates(save.state, dataset);
  if (save.state.player.moneyToman < applicationBaseCostToman) {
    return { save, success: false, message: 'موجودی برای هزینه ثبت نهایی پرونده کافی نیست' };
  }

  const rng = new SeededRNG(`${save.seed}:adopt_submit:${save.state.turn}:${app.id}`);
  const delayed = rng.chance(dataset.adoption.evaluation.queueDelayProbability);
  let outcomeMsg = 'پرونده در سامانه بهزیستی ثبت شد';

  const nextSave = updateState(
    save,
    (draft) => {
      deductMoney(draft, applicationBaseCostToman);
      const adoption = ensureAdoptionState(draft);
      const nextApp = adoption.activeApplication;
      if (!nextApp) return;

      nextApp.portalSubmitted = true;
      nextApp.step = 'evaluation';

      if (delayed) {
        nextApp.evaluationStatus = 'in_queue';
        nextApp.queueYearsRemaining = 1;
        nextApp.evaluationNotesFa = [
          'پرونده شما در صف نوبت کارشناسی بهزیستی ثبت شد؛ نتیجه بازدید منزل در سال آینده اعلام می‌شود.',
        ];
        outcomeMsg = 'پرونده ثبت شد و در نوبت بازدید سال آینده قرار گرفت';
        pushTimeline(
          draft,
          'ثبت پرونده سرپرستی در سامانه بهزیستی',
          'مدارک ارسال شد و زمان بازدید کارشناس منزل برای سال آینده تعیین گردید.',
          'life',
        );
      } else {
        const evalResult = evaluateHomeVisitAndInterview(draft, nextApp, rng, dataset);
        nextApp.evaluationStatus = evalResult.status;
        nextApp.evaluationNotesFa = evalResult.notesFa;
        nextApp.queueYearsRemaining = 0;

        if (evalResult.status === 'approved') {
          nextApp.step = 'matching';
          nextApp.matchedCandidates = generateMatchedChildCandidates(
            draft,
            nextApp.careType,
            rng,
            dataset,
          );
          outcomeMsg = 'ارزیابی کارشناس بهزیستی تأیید شد! فهرست آشنایی آماده است';
          draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6 });
          pushTimeline(
            draft,
            'تأیید صلاحیت در بازدید منزل بهزیستی',
            'ارزیابی محیط خانه و مصاحبه با نتیجه مثبت تأیید شد و وارد مرحله آشنایی با کودک شدی.',
            'milestone',
            { happiness: 6 },
          );
        } else if (evalResult.status === 'rejected') {
          adoption.pastApplicationsCount += 1;
          adoption.reapplyCooldownUntilYear =
            draft.currentJalaliYear + dataset.adoption.evaluation.reapplyCooldownYears;
          adoption.activeApplication = null;
          outcomeMsg = 'پرونده در این نوبت تأیید نشد و پس از مهلت قانونی قابل پیگیری مجدد است';
          pushTimeline(
            draft,
            'نتیجه ارزیابی سرپرستی',
            evalResult.notesFa[evalResult.notesFa.length - 1] ?? outcomeMsg,
            'life',
          );
        } else {
          outcomeMsg = 'پرونده نیازمند چند بهبود جزئی است؛ نکات کارشناس را بررسی کن';
          pushTimeline(
            draft,
            'نظر اصلاحی کارشناس بازدید',
            'کارشناس بهزیستی پیشنهادهایی برای تقویت آمادگی خانه یا شرایط روحی ثبت کرد.',
            'life',
          );
        }
      }
      draft.adoption = adoption;
    },
    rng.getState(),
  );

  return {
    save: nextSave,
    success: true,
    message: outcomeMsg,
  };
}

export function runAdoptionEvaluationNowAction(
  save: SaveGame,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'evaluation' || app.evaluationStatus !== 'needs_improvements') {
    return { save, success: false, message: 'پرونده آماده ارزیابی مجدد نیست' };
  }
  const report = evaluateAdoptionEligibility(save.state, app.careType, dataset);
  if (!report.eligible) {
    return {
      save,
      success: false,
      message: report.blockedReasonFa ?? 'هنوز پیش‌نیازهای قانونی برقرار نیستند',
    };
  }

  const rng = new SeededRNG(`${save.seed}:adopt_recheck:${save.state.turn}:${app.id}`);
  let msg = 'ارزیابی مجدد انجام شد';

  const nextSave = updateState(
    save,
    (draft) => {
      const adoption = ensureAdoptionState(draft);
      const nextApp = adoption.activeApplication;
      if (!nextApp) return;

      const evalResult = evaluateHomeVisitAndInterview(draft, nextApp, rng, dataset);
      nextApp.evaluationStatus = evalResult.status;
      nextApp.evaluationNotesFa = evalResult.notesFa;

      if (evalResult.status === 'approved') {
        nextApp.step = 'matching';
        nextApp.matchedCandidates = generateMatchedChildCandidates(
          draft,
          nextApp.careType,
          rng,
          dataset,
        );
        msg = 'ارزیابی مجدد با موفقیت تأیید شد';
        draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6 });
        pushTimeline(
          draft,
          'تأیید پرونده سرپرستی پس از بازبینی',
          'با بهبود شرایط خانه و خانواده، گزارش بازدید کارشناس بهزیستی تأیید شد.',
          'milestone',
          { happiness: 6 },
        );
      } else if (evalResult.status === 'rejected') {
        adoption.pastApplicationsCount += 1;
        adoption.reapplyCooldownUntilYear =
          draft.currentJalaliYear + dataset.adoption.evaluation.reapplyCooldownYears;
        adoption.activeApplication = null;
        msg = 'پرونده در بررسی مجدد تأیید نشد';
      } else {
        msg = 'همچنان به تقویت ثبات مسکن، مالی یا آرامش نیاز است';
      }
      draft.adoption = adoption;
    },
    rng.getState(),
  );

  return { save: nextSave, success: true, message: msg };
}

export function conductAdoptionBondingMeetingAction(
  save: SaveGame,
  candidateTempId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'matching' || app.evaluationStatus !== 'approved') {
    return { save, success: false, message: 'امکان دیدار آشنایی در این مرحله فعال نیست' };
  }
  const cand = app.matchedCandidates.find((c) => c.tempId === candidateTempId);
  if (!cand) {
    return { save, success: false, message: 'پروفایل کودک یافت نشد' };
  }

  const { bondingMeetingCostToman } = getAdoptionCostEstimates(save.state, dataset);
  if (save.state.player.moneyToman < bondingMeetingCostToman) {
    return { save, success: false, message: 'موجودی برای هزینه رفت‌وآمد و جلسه آشنایی کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, bondingMeetingCostToman);
    const adoption = ensureAdoptionState(draft);
    const target = adoption.activeApplication?.matchedCandidates.find(
      (c) => c.tempId === candidateTempId,
    );
    if (target) {
      target.bondingMeetingsDone += 1;
    }
    draft.adoption = adoption;
    draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 3, mentalHealth: 2 });
  });

  return {
    save: nextSave,
    success: true,
    message: `جلسه آشنایی با ${cand.firstName} برگزار شد`,
  };
}

export function selectAdoptionCandidateAction(
  save: SaveGame,
  candidateTempId: string,
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app || app.step !== 'matching' || app.evaluationStatus !== 'approved') {
    return { save, success: false, message: 'ابتدا باید ارزیابی بهزیستی تأیید شده باشد' };
  }
  const cand = app.matchedCandidates.find((c) => c.tempId === candidateTempId);
  if (!cand) {
    return { save, success: false, message: 'کودک انتخابی در فهرست نیست' };
  }
  const requiredMeetings = dataset.adoption.matching.requiredBondingMeetings;
  if (cand.bondingMeetingsDone < requiredMeetings) {
    return {
      save,
      success: false,
      message: `حداقل ${toPersianDigits(requiredMeetings)} نشست آشنایی و هم‌صحبتی با ${cand.firstName} لازم است`,
    };
  }

  const nextSave = updateState(save, (draft) => {
    const adoption = ensureAdoptionState(draft);
    if (adoption.activeApplication) {
      adoption.activeApplication.selectedCandidateId = candidateTempId;
      adoption.activeApplication.step = 'decree';
    }
    draft.adoption = adoption;
  });

  return {
    save: nextSave,
    success: true,
    message: `${cand.firstName} برای مرحله حکم و تحویل انتخاب شد`,
  };
}

export function finalizeAdoptionPlacementAction(
  save: SaveGame,
  params: { customFirstName?: string; enrollSchool?: boolean } = {},
  dataset: GameDataset = gameDataset,
): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (
    !app ||
    app.step !== 'decree' ||
    app.evaluationStatus !== 'approved' ||
    !app.selectedCandidateId
  ) {
    return {
      save,
      success: false,
      message: 'صدور حکم و تحویل تنها پس از تأیید ارزیابی و انتخاب کودک در مرحله آشنایی ممکن است',
    };
  }
  const candidate = app.matchedCandidates.find((c) => c.tempId === app.selectedCandidateId);
  if (!candidate) {
    return { save, success: false, message: 'اطلاعات کودک انتخاب‌شده یافت نشد' };
  }

  const report = evaluateAdoptionEligibility(save.state, app.careType, dataset);
  if (save.state.player.moneyToman < report.placementFeeToman) {
    return {
      save,
      success: false,
      message: 'موجودی برای هزینه ثبت حکم، شناسنامه و بیمه آتیه کافی نیست',
    };
  }

  const rng = new SeededRNG(`${save.seed}:adopt_place:${save.state.turn}:${candidate.tempId}`);
  let placedChildName = candidate.firstName;

  const nextSave = updateState(
    save,
    (draft) => {
      deductMoney(draft, report.placementFeeToman);
      const adoption = ensureAdoptionState(draft);
      const nextApp = adoption.activeApplication;
      if (!nextApp) return;

      const isPermanent = nextApp.careType === 'permanent';
      const trimmedName = params.customFirstName?.trim();
      const childFirstName = isPermanent && trimmedName ? trimmedName : candidate.firstName;
      placedChildName = childFirstName;

      const ethPool = dataset.names.ethnicities[draft.player.ethnicity];
      const childLastName = isPermanent ? draft.player.lastName : rng.pick(ethPool.lastNames);
      const childId = `npc_adopted_${draft.turn}_${Object.keys(draft.npcs).length}`;

      const jobTitle =
        candidate.age >= 7
          ? 'دانش‌آموز'
          : params.enrollSchool && candidate.age >= 4
            ? 'پیش‌دبستانی'
            : 'کودک';

      const originKind =
        nextApp.careType === 'permanent'
          ? 'adopted'
          : nextApp.careType === 'temporary_guardian'
            ? 'temporary_guardian'
            : 'host_family';

      const childPerson: Person = {
        id: childId,
        firstName: childFirstName,
        lastName: childLastName,
        gender: candidate.gender,
        age: candidate.age,
        traits: [...candidate.traits],
        jobTitle,
        isAlive: true,
        birthYear: draft.currentJalaliYear - candidate.age,
        avatarSeed: candidate.avatarSeed,
        originKind,
        adoptionMeta: {
          careType: nextApp.careType,
          placedYear: draft.currentJalaliYear,
          placedAtChildAge: candidate.age,
          biologicalOriginKnown: candidate.age >= 5,
          backgroundFa: candidate.backgroundFa,
          healthNeedsFa: candidate.healthNeedsFa,
          supervisionClosedAt18: candidate.age >= 18,
        },
      };

      const inspector = createInspectorNpc(draft, rng, dataset);

      draft.npcs[childId] = childPerson;
      draft.npcs[inspector.id] = inspector;
      draft.relationships.push({
        personId: childId,
        role: 'child',
        closeness: Math.min(92, 68 + candidate.bondingMeetingsDone * 6),
        respect: 76,
        romance: 0,
      });

      nextApp.probationaryApproved = true;
      nextApp.courtDecreeIssued = true;
      nextApp.placedChildPersonId = childId;
      nextApp.placedYear = draft.currentJalaliYear;
      nextApp.inspectorPersonId = inspector.id;
      nextApp.nextVisitYear = draft.currentJalaliYear + 1;
      nextApp.step = 'supervision';

      adoption.completedAdoptedCount += 1;
      draft.adoption = adoption;

      if (isPermanent) {
        draft.flags['has_adopted_child'] = true;
        if (candidate.age >= 10) {
          draft.flags['has_adopted_teen_or_preteen'] = true;
        }
        unlockAchievement(draft, 'loving_home');
      } else {
        unlockAchievement(draft, 'helping_hand');
      }

      draft.player.stats = applyStatDelta(draft.player.stats, {
        happiness: 14,
        mentalHealth: 4,
      });

      const careTitle =
        dataset.adoption.careTypes.find((c) => c.id === nextApp.careType)?.titleFa ?? 'سرپرستی';
      const timelineMsg = isPermanent
        ? `حکم سرپرستی و تحویل «${childFirstName} ${childLastName}» از سوی دادگاه خانواده و بهزیستی صادر شد؛ خانواده شما با حضورش گرم‌تر شده است.`
        : `تحویل موقت «${childFirstName}» در قالب «${careTitle}» ثبت شد و نظارت دوره‌ای بهزیستی از سال آینده آغاز می‌شود.`;

      appendNpcHistory(draft, childId, timelineMsg);
      pushTimeline(draft, `ورود ${childFirstName} به خانه`, timelineMsg, 'milestone', {
        happiness: 14,
        mentalHealth: 4,
      });
    },
    rng.getState(),
  );

  return {
    save: nextSave,
    success: true,
    message: `«${placedChildName}» با حکم قانونی به جمع خانواده پیوست`,
  };
}

export function completeAdoptionSupervisionTaskAction(
  save: SaveGame,
  visitId: string,
  taskId: string,
): ActionOutcome {
  const adoption = save.state.adoption;
  if (!adoption) {
    return { save, success: false, message: 'گزارش نظارتی یافت نشد' };
  }
  const visit = adoption.supervisionVisits.find((v) => v.id === visitId);
  const task = visit?.tasks.find((t) => t.id === taskId);
  if (!visit || !task) {
    return { save, success: false, message: 'تکلیف مورد نظر یافت نشد' };
  }
  if (task.completed) {
    return { save, success: false, message: 'این مورد قبلاً انجام شده است' };
  }
  if (save.state.player.moneyToman < task.costToman) {
    return { save, success: false, message: 'موجودی برای انجام این تکلیف کافی نیست' };
  }

  const nextSave = updateState(save, (draft) => {
    deductMoney(draft, task.costToman);
    const nextAdoption = ensureAdoptionState(draft);
    const targetVisit = nextAdoption.supervisionVisits.find((v) => v.id === visitId);
    const targetTask = targetVisit?.tasks.find((t) => t.id === taskId);
    if (targetTask) {
      targetTask.completed = true;
    }
    draft.adoption = nextAdoption;

    const childRel = draft.relationships.find((r) => r.personId === visit.childPersonId);
    if (childRel) {
      childRel.closeness = clampStat(childRel.closeness + 5);
    }
    draft.player.stats = applyStatDelta(draft.player.stats, {
      mentalHealth: 3,
      happiness: 2,
    });
    pushTimeline(
      draft,
      `انجام توصیه ناظر: ${task.titleFa}`,
      `توصیه مددکار بهزیستی برای حمایت بهتر از ${visit.childNameFa} با موفقیت انجام شد.`,
      'life',
      { mentalHealth: 3, happiness: 2 },
    );
  });

  return {
    save: nextSave,
    success: true,
    message: `«${task.titleFa}» تکمیل شد`,
  };
}

export function abandonAdoptionApplicationAction(save: SaveGame): ActionOutcome {
  const app = save.state.adoption?.activeApplication;
  if (!app) {
    return { save, success: false, message: 'پرونده فعالی وجود ندارد' };
  }
  if (app.placedChildPersonId) {
    return {
      save,
      success: false,
      message: 'پس از تحویل کودک امکان انصراف سیستمی از این پرونده وجود ندارد',
    };
  }

  const nextSave = updateState(save, (draft) => {
    const adoption = ensureAdoptionState(draft);
    adoption.activeApplication = null;
    draft.adoption = adoption;
    pushTimeline(
      draft,
      'انصراف از پرونده درخواستی سرپرستی',
      'پرونده درخواستی پیش از تحویل کودک بسته شد؛ هر زمان آماده بودی می‌توانی دوباره اقدام کنی.',
      'life',
    );
  });

  return {
    save: nextSave,
    success: true,
    message: 'پرونده سرپرستی بسته شد',
  };
}

export function setJobPrioritiesAction(
  save: SaveGame,
  priorities: JobCompassPriorities,
  customized = true,
): SaveGame {
  return updateState(save, (draft) => {
    const compass = ensureJobCompassState(draft);
    compass.priorities = {
      income: Math.max(0, Math.min(3, Math.round(priorities.income))),
      calm: Math.max(0, Math.min(3, Math.round(priorities.calm))),
      security: Math.max(0, Math.min(3, Math.round(priorities.security))),
      growth: Math.max(0, Math.min(3, Math.round(priorities.growth))),
      freedom: Math.max(0, Math.min(3, Math.round(priorities.freedom))),
    };
    compass.prioritiesCustomized = customized;
    draft.jobCompass = compass;
  });
}

export function resetJobPrioritiesAction(save: SaveGame): SaveGame {
  return updateState(save, (draft) => {
    const compass = ensureJobCompassState(draft);
    compass.priorities = deriveDefaultPriorities(draft);
    compass.prioritiesCustomized = false;
    draft.jobCompass = compass;
  });
}

export function setJobSalaryUnitAction(
  save: SaveGame,
  unit: 'monthly' | 'annual',
): SaveGame {
  return updateState(save, (draft) => {
    const compass = ensureJobCompassState(draft);
    compass.salaryUnit = unit;
    draft.jobCompass = compass;
  });
}

export function toggleJobShortlistAction(
  save: SaveGame,
  jobId: string,
): { save: SaveGame; added: boolean; count: number } {
  const current = ensureJobCompassState(save.state).shortlistedJobIds;
  const exists = current.includes(jobId);
  const nextIds = exists
    ? current.filter((id) => id !== jobId)
    : [...current, jobId].slice(-5);

  const nextSave = updateState(save, (draft) => {
    const compass = ensureJobCompassState(draft);
    compass.shortlistedJobIds = nextIds;
    draft.jobCompass = compass;
  });

  return { save: nextSave, added: !exists, count: nextIds.length };
}

export function pinJobGoalAction(
  save: SaveGame,
  jobId: string | null,
): ActionOutcome {
  const alreadyPinned = save.state.jobCompass?.pinnedJobId === jobId;
  const targetId = alreadyPinned ? null : jobId;
  const nextSave = updateState(save, (draft) => {
    const compass = ensureJobCompassState(draft);
    compass.pinnedJobId = targetId;
    draft.jobCompass = compass;
  });
  return {
    save: nextSave,
    success: true,
    message: targetId ? 'این شغل به عنوان هدف شغلی تو ثبت شد' : 'هدف شغلی برداشته شد',
  };
}

export type JobInterviewOutcomeType = 'hired' | 'waitlist' | 'rejected';

export interface JobInterviewOutcome extends ActionOutcome {
  outcome: JobInterviewOutcomeType;
  finalChancePct: number;
  interviewShiftPct: number;
  startingMonthlyNet?: number;
  startingAnnualNet?: number;
  adviceFa: string;
}

export function submitJobInterviewAction(
  save: SaveGame,
  job: JobDefinition,
  interviewAnswers: { questionId: string; answerId: string }[],
  dataset: GameDataset = gameDataset,
): JobInterviewOutcome {
  const readiness = jobReadiness(save.state, job, dataset);
  if (!readiness.eligible || !readiness.canApplyNow) {
    const msg = readiness.blockedReason ?? 'شرایط درخواست این شغل هنوز کامل نیست';
    return {
      save,
      success: false,
      message: msg,
      outcome: 'rejected',
      finalChancePct: 0,
      interviewShiftPct: 0,
      adviceFa: readiness.shortGapFa,
    };
  }

  const chanceInfo = estimateJobSuccessChance(job, save.state, dataset);
  const allQuestions = [
    ...(dataset.interviews.byJobId[job.id] ?? []),
    ...dataset.interviews.generalQuestions,
  ];
  let rawDelta = 0;
  for (const picked of interviewAnswers) {
    const q = allQuestions.find((item) => item.id === picked.questionId);
    const ans = q?.answers.find((a) => a.id === picked.answerId);
    if (ans) rawDelta += ans.chanceDeltaPct;
  }
  const interviewShiftPct = Math.max(-8, Math.min(10, Math.round(rawDelta)));
  const finalChancePct = clampChancePct(chanceInfo.baseChancePct + interviewShiftPct);

  const rng = new SeededRNG(`${save.seed}:interview:${job.id}:${save.state.turn}`);
  const roll = rng.float(0, 100);

  let outcome: JobInterviewOutcomeType;
  if (roll < finalChancePct) {
    outcome = 'hired';
  } else if (roll < Math.min(98, finalChancePct + 14)) {
    outcome = 'waitlist';
  } else {
    outcome = 'rejected';
  }

  const salaryInfo = jobSalaryRange(job, save.state, dataset);
  const status = getJobApplicationStatus(job, save.state, dataset);

  const nextSave = updateState(save, (draft) => {
    draft.flags[`cd_apply_job_${job.id}`] = draft.turn;
    const compass = ensureJobCompassState(draft);

    if (outcome === 'hired') {
      if (draft.player.job) {
        const hist = getWorkHistory(draft);
        hist.push({
          title: draft.player.job.title,
          employer: 'سابقه قبلی',
          fromYear: draft.currentJalaliYear - draft.player.job.yearsInJob,
          toYear: draft.currentJalaliYear,
        });
        draft.flags['hist_work'] = JSON.stringify(hist.slice(-12));
      }
      const level1 = job.ladder[0];
      draft.player.job = {
        jobId: job.id,
        title: `${job.titleFa} (${level1.titleFa})`,
        track: job.track,
        level: 1,
        annualSalaryToman: status.breakdown.netAnnual,
        stress: job.stress,
        yearsInJob: 0,
      };
      draft.flags['job_years_in_role'] = 0;
      draft.flags['last_job_gross'] = status.breakdown.grossAnnual;
      draft.flags['last_job_net'] = status.breakdown.netAnnual;
      draft.flags['last_job_deductions'] =
        status.breakdown.commission +
        status.breakdown.runningCosts +
        status.breakdown.bimeh +
        status.breakdown.incomeTax;
      draft.flags['retired'] = false;
      if (compass.pinnedJobId === job.id) {
        compass.pinnedJobId = null;
      }
      compass.waitlistedJobs = compass.waitlistedJobs.filter((w) => w.jobId !== job.id);
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 6, fame: 2 });
      pushTimeline(
        draft,
        `استخدام در شغل ${job.titleFa}`,
        `مصاحبه با موفقیت گذشت و با خالص دریافتی ${formatToman(salaryInfo.expectedMonthlyNet)} در ماه در رده «${level1.titleFa}» شروع به کار کردی.`,
        'milestone',
        { happiness: 6 },
      );
    } else if (outcome === 'waitlist') {
      compass.waitlistedJobs = [
        ...compass.waitlistedJobs.filter((w) => w.jobId !== job.id),
        {
          jobId: job.id,
          appliedTurn: draft.turn,
          appliedYear: draft.currentJalaliYear,
          interviewBonusPct: interviewShiftPct,
        },
      ];
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: 1 });
      pushTimeline(
        draft,
        `فهرست انتظار برای ${job.shortTitle}`,
        `مصاحبه برای «${job.titleFa}» خوب پیش رفت و پرونده‌ات در صف تأیید تا سال آینده قرار گرفت.`,
        'life',
      );
    } else {
      draft.player.stats = applyStatDelta(draft.player.stats, { happiness: -2 });
      pushTimeline(
        draft,
        `نتیجه مصاحبه ${job.shortTitle}`,
        `این بار برای «${job.titleFa}» انتخاب نشدی؛ بالا بردن مهارت مرتبط و هوش شانس دور بعد را بیشتر می‌کند.`,
        'life',
      );
    }
    draft.jobCompass = compass;
  });

  const adviceFa =
    outcome === 'hired'
      ? `تبریک! حقوق خالص ماهانه از ${formatToman(salaryInfo.expectedMonthlyNet)} شروع می‌شود.`
      : outcome === 'waitlist'
        ? 'نتیجه قطعی از فهرست انتظار با رفتن به سال بعد مشخص می‌شود.'
        : job.requiredSkillId
          ? 'تا سال بعد مهارت مرتبط را بالا ببر و دوباره مصاحبه بده.'
          : 'سال بعد با تجربه و تمرکز بیشتر دوباره اقدام کن.';

  return {
    save: nextSave,
    success: outcome === 'hired',
    message:
      outcome === 'hired'
        ? `در «${job.shortTitle}» پذیرفته شدی!`
        : outcome === 'waitlist'
          ? `در فهرست انتظار «${job.shortTitle}» قرار گرفتی`
          : `این بار در مصاحبه «${job.shortTitle}» پذیرفته نشدی`,
    outcome,
    finalChancePct,
    interviewShiftPct,
    startingMonthlyNet: salaryInfo.expectedMonthlyNet,
    startingAnnualNet: status.breakdown.netAnnual,
    adviceFa,
  };
}


