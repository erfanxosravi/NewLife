import type { GameDataset } from '../../data/registry';
import { getBaselineScaleFromMinWage, getMinWageMonthlyForState } from '../economy';
import { formatToman, toPersianDigits } from '../jalali';
import type { SeededRNG } from '../rng';
import { applyStatDelta, clampStat } from '../stats';
import type {
  AdoptionApplicationState,
  AdoptionCandidateChild,
  AdoptionCareType,
  AdoptionEvaluationStatus,
  AdoptionInspectorVisit,
  AdoptionState,
  AdoptionStepId,
  AdoptionSupervisionTask,
  GameState,
  Gender,
  InspectorOutcome,
  Person,
  TimelineEntry,
} from '../types';

export interface AdoptionRequirementItem {
  id: string;
  label: string;
  met: boolean;
  currentText?: string;
  requiredText?: string;
  fixHint?: string;
}

export interface AdoptionEligibilityReport {
  careType: AdoptionCareType;
  eligible: boolean;
  pathwayFa: string;
  singleWomanFemaleOnly: boolean;
  maxAllowedChildAge: number;
  hasAgePriority: boolean;
  canTakeInfertilityTest: boolean;
  infertilityTestCostToman: number;
  requiredSavingsToman: number;
  placementFeeToman: number;
  marriageYears: number;
  checklist: AdoptionRequirementItem[];
  blockedReasonFa?: string;
}

export function createEmptyAdoptionState(): AdoptionState {
  return {
    activeApplication: null,
    pastApplicationsCount: 0,
    hasInfertilityCert: false,
    supervisionVisits: [],
    completedAdoptedCount: 0,
  };
}

export function ensureAdoptionState(state: GameState): AdoptionState {
  if (!state.adoption) {
    return createEmptyAdoptionState();
  }
  return {
    ...state.adoption,
    supervisionVisits: state.adoption.supervisionVisits.map((v) => ({
      ...v,
      tasks: v.tasks.map((t) => ({ ...t })),
    })),
    activeApplication: state.adoption.activeApplication
      ? {
          ...state.adoption.activeApplication,
          completedDocIds: [...state.adoption.activeApplication.completedDocIds],
          evaluationNotesFa: [...state.adoption.activeApplication.evaluationNotesFa],
          matchedCandidates: state.adoption.activeApplication.matchedCandidates.map((c) => ({
            ...c,
            traits: [...c.traits],
          })),
        }
      : null,
  };
}

export function getMarriageDurationYears(state: GameState): number {
  if (state.player.maritalStatus !== 'married') return 0;
  const marriedYear = state.flags['married_year'];
  if (typeof marriedYear === 'number' && Number.isFinite(marriedYear)) {
    return Math.max(0, state.currentJalaliYear - marriedYear);
  }
  return 0;
}

export function getLivingChildrenWithMeta(state: GameState): { person: Person; closeness: number }[] {
  const result: { person: Person; closeness: number }[] = [];
  for (const rel of state.relationships) {
    if (rel.role !== 'child') continue;
    const person = state.npcs[rel.personId];
    if (person && person.isAlive) {
      result.push({ person, closeness: rel.closeness });
    }
  }
  return result;
}

export function getAdoptionCostEstimates(state: GameState, dataset: GameDataset) {
  const e = dataset.adoption.eligibility;
  const docsTotalMultiple = dataset.adoption.documents.reduce(
    (sum, d) => sum + d.feeMinWageMultiple,
    0,
  );
  return {
    infertilityTestCostToman: getBaselineScaleFromMinWage(
      e.infertilityCheckCostMinWageMultiple.value,
      state,
      dataset,
    ),
    applicationBaseCostToman: getBaselineScaleFromMinWage(
      e.applicationBaseCostMinWageMultiple.value,
      state,
      dataset,
    ),
    bondingMeetingCostToman: getBaselineScaleFromMinWage(
      dataset.adoption.matching.bondingMeetingCostMinWageMultiple,
      state,
      dataset,
    ),
    docsTotalCostToman: getBaselineScaleFromMinWage(docsTotalMultiple, state, dataset),
  };
}

export function evaluateAdoptionEligibility(
  state: GameState,
  careType: AdoptionCareType,
  dataset: GameDataset,
): AdoptionEligibilityReport {
  const adoptionState = ensureAdoptionState(state);
  const cfg = dataset.adoption;
  const careDef = cfg.careTypes.find((c) => c.id === careType) ?? cfg.careTypes[0];
  const e = cfg.eligibility;
  const { player } = state;

  const spouseRel = state.relationships.find(
    (r) => r.role === 'spouse' && state.npcs[r.personId]?.isAlive,
  );
  const spouse = spouseRel ? state.npcs[spouseRel.personId] : undefined;
  const isMarriedCouple = player.maritalStatus === 'married' && Boolean(spouse);
  const isSingleWoman = !isMarriedCouple && player.gender === 'female';

  const livingChildren = getLivingChildrenWithMeta(state);
  const permanentChildren = livingChildren.filter(
    (c) => c.person.originKind !== 'temporary_guardian' && c.person.originKind !== 'host_family',
  );
  const hasExistingChild = permanentChildren.length > 0;
  const youngestChildAge = hasExistingChild
    ? Math.min(...permanentChildren.map((c) => c.person.age))
    : 99;

  const marriageYears = getMarriageDurationYears(state);
  const maxSpouseOrPlayerAge = isMarriedCouple && spouse ? Math.max(player.age, spouse.age) : player.age;
  const hasInfertilityCert =
    adoptionState.hasInfertilityCert || Boolean(adoptionState.activeApplication?.hasInfertilityCert);

  const checklist: AdoptionRequirementItem[] = [];

  // 1. Legal applicant pathway (Art. 5 Law 1392)
  let pathwayMet = false;
  let pathwayFa = 'شرایط متقاضی';
  let singleWomanFemaleOnly = false;
  let pathwayCurrent = '';
  let pathwayRequired = 'حداقل ۳۰ سال سن (زوجین یا زن مجرد)';
  let pathwayHint = '';

  if (isMarriedCouple) {
    const ageOk = maxSpouseOrPlayerAge >= e.minApplicantAge;
    if (hasExistingChild) {
      pathwayFa = 'بند ب ماده ۵ · زوجین دارای فرزند';
      pathwayMet = ageOk;
      pathwayCurrent = `سن ${toPersianDigits(maxSpouseOrPlayerAge)} سال`;
      pathwayRequired = `حداقل ${toPersianDigits(e.minApplicantAge)} سال`;
      pathwayHint = `حداقل یکی از زوجین باید به ${toPersianDigits(e.minApplicantAge)} سالگی برسد.`;
    } else {
      const marriageOk = marriageYears >= e.minMarriageYearsNoChild || hasInfertilityCert;
      pathwayFa = 'بند الف ماده ۵ · زوجین بدون فرزند';
      pathwayMet = ageOk && marriageOk;
      if (!ageOk) {
        pathwayCurrent = `${toPersianDigits(maxSpouseOrPlayerAge)} سال`;
        pathwayRequired = `${toPersianDigits(e.minApplicantAge)} سال`;
        pathwayHint = `حداقل یکی از زوجین باید ${toPersianDigits(e.minApplicantAge)} سال تمام داشته باشد.`;
      } else if (!marriageOk) {
        pathwayCurrent = `${toPersianDigits(marriageYears)} سال زندگی مشترک`;
        pathwayRequired = `${toPersianDigits(e.minMarriageYearsNoChild)} سال یا گواهی پزشکی`;
        pathwayHint = `می‌توانی ${toPersianDigits(e.minMarriageYearsNoChild - marriageYears)} سال صبر کنی یا در صورت احراز، گواهی پزشکی ناباروری دریافت کنی.`;
      } else {
        pathwayCurrent = hasInfertilityCert
          ? 'دارای گواهی پزشکی ناباروری'
          : `${toPersianDigits(marriageYears)} سال سابقه ازدواج`;
        pathwayRequired = 'واجد شرایط بند الف';
      }
    }
  } else if (isSingleWoman) {
    pathwayFa = 'بند ج ماده ۵ · بانوان مجرد بالای ۳۰ سال';
    singleWomanFemaleOnly = e.singleWomanOnlyFemaleChild;
    pathwayMet = e.singleWomanAllowed && player.age >= e.singleWomanMinAge;
    pathwayCurrent = `${toPersianDigits(player.age)} سال`;
    pathwayRequired = `${toPersianDigits(e.singleWomanMinAge)} سال (صرفاً کودک دختر)`;
    pathwayHint = `مطابق قانون ۱۳۹۲، بانوان بدون شوهر از ${toPersianDigits(e.singleWomanMinAge)} سالگی مجاز به سرپرستی کودک دختر هستند.`;
  } else {
    pathwayFa = 'شرایط قانونی متقاضی (ماده ۵)';
    pathwayMet = false;
    pathwayCurrent = 'مرد مجرد';
    pathwayRequired = 'زوجین متأهل یا بانوان بالای ۳۰ سال';
    pathwayHint =
      'مطابق ماده ۵ قانون حمایت از کودکان بی‌سرپرست، امکان درخواست پس از ازدواج رسمی فعال می‌شود.';
  }

  checklist.push({
    id: 'legal_pathway',
    label: pathwayFa,
    met: pathwayMet,
    currentText: pathwayCurrent,
    requiredText: pathwayRequired,
    fixHint: pathwayHint,
  });

  // 2. Nationality (Iran)
  const iranOk = player.countryId === 'iran';
  checklist.push({
    id: 'nationality',
    label: 'تابعیت و اقامت قانونی در ایران',
    met: iranOk,
    currentText: iranOk ? 'ایران' : 'خارج از کشور',
    requiredText: 'ایران',
    fixHint: 'پیگیری پرونده در سامانه بهزیستی مستلزم اقامت و پرونده قضایی در ایران است.',
  });

  // 3. Cooldown after rejection
  const cooldownUntil = adoptionState.reapplyCooldownUntilYear;
  const cooldownOk = !cooldownUntil || state.currentJalaliYear >= cooldownUntil;
  if (!cooldownOk && cooldownUntil) {
    checklist.push({
      id: 'cooldown',
      label: 'فاصله زمانی پس از رد پرونده قبلی',
      met: false,
      currentText: `سال ${toPersianDigits(state.currentJalaliYear)}`,
      requiredText: `از سال ${toPersianDigits(cooldownUntil)}`,
      fixHint: `تا سال ${toPersianDigits(cooldownUntil)} فرصت داری شرایط مسکن، درآمد یا سلامت را تقویت کنی.`,
    });
  }

  // 4. No Criminal Record
  const crimeOk = player.criminalRecord <= e.maxCriminalRecord;
  checklist.push({
    id: 'criminal_record',
    label: 'نداشتن محکومیت مؤثر کیفری',
    met: crimeOk,
    currentText: crimeOk ? 'بدون سوءپیشینه' : `${toPersianDigits(player.criminalRecord)} سابقه`,
    requiredText: 'پاک',
    fixHint: 'وجود سوءپیشینه مانع تأیید صلاحیت در استعلام قوه قضاییه می‌شود.',
  });

  // 5. Health & Mental Health
  const healthOk =
    player.stats.health >= e.minHealth && player.stats.mentalHealth >= e.minMentalHealth;
  checklist.push({
    id: 'health_mental',
    label: 'سلامت جسمی و تعادل روانی',
    met: healthOk,
    currentText: `جسم ${toPersianDigits(Math.round(player.stats.health))} · روان ${toPersianDigits(Math.round(player.stats.mentalHealth))}`,
    requiredText: `حداقل ${toPersianDigits(e.minHealth)} و ${toPersianDigits(e.minMentalHealth)}`,
    fixHint: 'از بخش فعالیت‌ها چکاپ پزشکی، مشاوره، ورزش یا استراحت را انجام بده.',
  });

  // 6. Housing stability
  const hasIndependentHousing =
    player.housing.type === 'rent' ||
    player.housing.type === 'owned' ||
    player.housing.type === 'villa';
  const housingOk = !careDef.requiresIndependentHousing || hasIndependentHousing;
  checklist.push({
    id: 'housing',
    label: 'مسکن مناسب و مستقل',
    met: housingOk,
    currentText: hasIndependentHousing ? 'دارای مسکن مستقل' : 'همراه خانواده / خوابگاه',
    requiredText: careDef.requiresIndependentHousing ? 'اجاره یا مالکیت' : 'منعطف',
    fixHint: 'در بخش دارایی‌ها > مسکن، یک خانه مناسب اجاره کن یا بخر.',
  });

  // 7. Financial capacity
  const requiredSavingsToman = getBaselineScaleFromMinWage(
    careDef.minSavingsMinWageMultiple,
    state,
    dataset,
  );
  const savingsOk = player.moneyToman >= requiredSavingsToman;
  checklist.push({
    id: 'financial',
    label: 'تمکن مالی و پس‌انداز مناسب',
    met: savingsOk,
    currentText: formatToman(player.moneyToman),
    requiredText: formatToman(requiredSavingsToman),
    fixHint: 'با کار، کسب‌وکار یا مدیریت هزینه‌ها نقدینگی خود را به حداقل لازم برسان.',
  });

  // 8. Relationship stability if married
  if (isMarriedCouple && spouseRel) {
    const relOk = spouseRel.closeness >= e.minSpouseCloseness;
    checklist.push({
      id: 'spouse_closeness',
      label: 'همدلی و رضایت در زندگی مشترک',
      met: relOk,
      currentText: `${toPersianDigits(spouseRel.closeness)}٪`,
      requiredText: `حداقل ${toPersianDigits(e.minSpouseCloseness)}٪`,
      fixHint: 'در بخش روابط با همسرت گفت‌وگو کن، هدیه بده یا به سفر بروید.',
    });
  }

  // 9. Age proportion with biological children
  const maxAllowedChildAge = hasExistingChild
    ? Math.max(-1, youngestChildAge - e.minGapYearsBelowYoungestBioChild)
    : 16;
  const proportionOk =
    !hasExistingChild ||
    careType === 'host_family' ||
    maxAllowedChildAge >= 0;
  if (hasExistingChild && careType !== 'host_family') {
    checklist.push({
      id: 'child_age_proportion',
      label: 'تناسب سنی با فرزندان فعلی خانواده',
      met: proportionOk,
      currentText: `کوچک‌ترین فرزند ${toPersianDigits(youngestChildAge)} ساله`,
      requiredText: `حداقل ${toPersianDigits(e.minGapYearsBelowYoungestBioChild)} سال بزرگ‌تر از کودک جدید`,
      fixHint: 'با بزرگ‌تر شدن فرزندان فعلی، امکان پذیرش کودک خردسال‌تر فعال می‌شود.',
    });
  }

  const eligible = checklist.every((item) => item.met);
  const firstUnmet = checklist.find((item) => !item.met);
  const costs = getAdoptionCostEstimates(state, dataset);
  const placementFeeToman = getBaselineScaleFromMinWage(
    careDef.feeMinWageMultiple,
    state,
    dataset,
  );

  const canTakeInfertilityTest =
    isMarriedCouple &&
    !hasExistingChild &&
    maxSpouseOrPlayerAge >= e.minApplicantAge &&
    marriageYears < e.minMarriageYearsNoChild &&
    !hasInfertilityCert &&
    e.infertilityExceptionAllowed;

  return {
    careType,
    eligible,
    pathwayFa,
    singleWomanFemaleOnly,
    maxAllowedChildAge: Math.min(16, Math.max(0, maxAllowedChildAge)),
    hasAgePriority: player.age < e.priorityMaxAge,
    canTakeInfertilityTest,
    infertilityTestCostToman: costs.infertilityTestCostToman,
    requiredSavingsToman,
    placementFeeToman,
    marriageYears,
    checklist,
    blockedReasonFa: firstUnmet ? `${firstUnmet.label}: ${firstUnmet.fixHint ?? ''}` : undefined,
  };
}

export function generateIndependentAvatarSeed(rng: SeededRNG, tag: string): string {
  return `av_${tag}_${rng.int(100000, 999999)}_${rng.int(1000, 9999)}`;
}

export function generateMatchedChildCandidates(
  state: GameState,
  careType: AdoptionCareType,
  rng: SeededRNG,
  dataset: GameDataset,
): AdoptionCandidateChild[] {
  const report = evaluateAdoptionEligibility(state, careType, dataset);
  const cfg = dataset.adoption;
  const maxAge = report.maxAllowedChildAge;
  const eligibleProfiles = cfg.matching.childProfiles.filter((p) => p.minAge <= maxAge);
  const poolProfiles = eligibleProfiles.length > 0 ? eligibleProfiles : [cfg.matching.childProfiles[0]];

  const ethKeys = Object.keys(dataset.names.ethnicities) as (keyof typeof dataset.names.ethnicities)[];
  const traitsPool = ['کنجکاو', 'مهربان', 'آرام', 'خوش‌ذوق', 'باهوش', 'پرانرژی', 'دلسوز'];

  const results: AdoptionCandidateChild[] = [];
  for (let i = 0; i < cfg.matching.candidatesPerMatch; i++) {
    const profile = poolProfiles[i % poolProfiles.length];
    const effectiveMax = Math.min(profile.maxAge, maxAge);
    const effectiveMin = Math.min(profile.minAge, effectiveMax);
    const childAge = rng.int(effectiveMin, effectiveMax);

    const gender: Gender = report.singleWomanFemaleOnly
      ? 'female'
      : rng.chance(0.5)
        ? 'female'
        : 'male';

    const eth = rng.pick(ethKeys);
    const names = dataset.names.ethnicities[eth];
    const firstName =
      gender === 'male' ? rng.pick(names.maleFirstNames) : rng.pick(names.femaleFirstNames);
    const backgroundFa = rng.pick(profile.backgroundsFa);
    const hasHealthNeed = rng.chance(profile.healthNeedProbability);
    const healthNeedsFa = hasHealthNeed ? rng.pick(profile.optionalHealthNeedsFa) : undefined;

    const t1 = rng.pick(traitsPool);
    const t2 = rng.pick(traitsPool.filter((t) => t !== t1));

    results.push({
      tempId: `cand_${state.currentJalaliYear}_${i + 1}_${rng.int(100, 999)}`,
      firstName,
      gender,
      age: childAge,
      ageBracketId: profile.ageBracketId,
      avatarSeed: generateIndependentAvatarSeed(rng, `adopt_cand_${i}`),
      traits: [t1, t2],
      backgroundFa,
      healthNeedsFa,
      bondingMeetingsDone: 0,
    });
  }
  return results;
}

export function evaluateHomeVisitAndInterview(
  state: GameState,
  app: AdoptionApplicationState,
  rng: SeededRNG,
  dataset: GameDataset,
): {
  status: AdoptionEvaluationStatus;
  notesFa: string[];
  score: number;
} {
  const ev = dataset.adoption.evaluation;
  const w = ev.weights;
  const { player } = state;

  const housingScore =
    player.housing.type === 'owned' || player.housing.type === 'villa'
      ? 96
      : player.housing.type === 'rent'
        ? 78
        : 40;

  const minWage = getMinWageMonthlyForState(state, dataset);
  const savingsRatio = Math.min(1, player.moneyToman / Math.max(1, minWage * 6));
  const hasIncome = Boolean(player.job || state.ownedBusiness || state.flags['pension_income']);
  const incomeScore = (hasIncome ? 62 : 28) + savingsRatio * 34;

  const spouseRel = state.relationships.find(
    (r) => r.role === 'spouse' && state.npcs[r.personId]?.isAlive,
  );
  const relScore = spouseRel ? spouseRel.closeness : 76;
  const mentalScore = player.stats.mentalHealth;
  const crimeScore = player.criminalRecord === 0 ? 100 : 0;

  const aliveClose = state.relationships.filter((r) => state.npcs[r.personId]?.isAlive);
  const avgFriendRespect =
    aliveClose.length > 0
      ? aliveClose.reduce((s, r) => s + r.respect, 0) / aliveClose.length
      : 65;
  const refScore = Math.min(100, avgFriendRespect * 0.75 + player.stats.fame * 0.25);

  const weighted =
    housingScore * w.housingStability +
    incomeScore * w.incomeStability +
    relScore * w.relationshipHealth +
    mentalScore * w.mentalHealth +
    crimeScore * w.noCriminalRecord +
    refScore * w.references;

  const ageBonus = player.age < dataset.adoption.eligibility.priorityMaxAge ? 4 : -4;
  const variance = rng.float(-5, 6);
  const finalScore = Math.round(weighted + ageBonus + variance);

  const notesFa: string[] = [];
  if (housingScore >= 75) notesFa.push('وضعیت مسکن و فضای امن خانه مورد تأیید کارشناس بازدید قرار گرفت.');
  else notesFa.push('نیاز به مسکن مستقل و پایدارتر در گزارش بازدید ذکر شد.');

  if (incomeScore >= 60) notesFa.push('تمکن مالی و تعهد تأمین آتیه کودک قابل قبول ارزیابی شد.');
  else notesFa.push('پیشنهاد شد پشتوانه مالی یا درآمد مستمر تقویت شود.');

  if (mentalScore >= 60 && relScore >= 60) {
    notesFa.push('ارزیابی روان‌شناختی و همدلی فضای خانه مثبت گزارش شد.');
  } else {
    notesFa.push('کارشناس پیشنهاد داد پیش از تحویل کودک چند جلسه مشاوره آرامش و خانواده انجام شود.');
  }

  if (player.criminalRecord > 0) {
    return {
      status: 'rejected',
      notesFa: ['به دلیل وجود سابقه کیفری مؤثر، صلاحیت پرونده تأیید نشد.'],
      score: 0,
    };
  }

  if (finalScore >= ev.approvalBaseThreshold) {
    return { status: 'approved', notesFa, score: finalScore };
  }
  if (finalScore >= ev.approvalBaseThreshold - 14) {
    return { status: 'needs_improvements', notesFa, score: finalScore };
  }
  return {
    status: 'rejected',
    notesFa: [
      ...notesFa,
      `پرونده در این نوبت تأیید نشد؛ پس از ${toPersianDigits(ev.reapplyCooldownYears)} سال می‌توانی دوباره اقدام کنی.`,
    ],
    score: finalScore,
  };
}

export function createInspectorNpc(
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): Person {
  const ethKeys = Object.keys(dataset.names.ethnicities) as (keyof typeof dataset.names.ethnicities)[];
  const eth = rng.pick(ethKeys);
  const pool = dataset.names.ethnicities[eth];
  const gender: Gender = rng.chance(0.55) ? 'female' : 'male';
  const firstName =
    gender === 'male' ? rng.pick(pool.maleFirstNames) : rng.pick(pool.femaleFirstNames);
  const lastName = rng.pick(pool.lastNames);

  return {
    id: `npc_inspector_${state.currentJalaliYear}_${rng.int(100, 999)}`,
    firstName,
    lastName,
    gender,
    age: rng.int(29, 49),
    traits: ['دقیق', 'دلسوز'],
    jobTitle: 'مددکار اجتماعی و ناظر بهزیستی',
    isAlive: true,
    avatarSeed: generateIndependentAvatarSeed(rng, 'inspector'),
    originKind: 'inspector',
  };
}

function buildVisitTasks(
  outcome: InspectorOutcome,
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): AdoptionSupervisionTask[] {
  if (outcome !== 'needs_improvement' && outcome !== 'serious_concern') {
    return [];
  }
  const templates = dataset.adoption.supervision.improvementTaskTemplates;
  const count = outcome === 'serious_concern' ? 2 : 1;
  const chosen = templates.slice(0, count);
  return chosen.map((tpl, idx) => ({
    id: `${tpl.id}_${state.currentJalaliYear}_${idx}`,
    titleFa: tpl.titleFa,
    descriptionFa: tpl.descriptionFa,
    costToman: getBaselineScaleFromMinWage(tpl.costMinWageMultiple, state, dataset),
    completed: false,
  }));
}

export function rollInspectorOutcome(
  state: GameState,
  childCloseness: number,
  hadUnresolvedTasks: boolean,
  rng: SeededRNG,
  dataset: GameDataset,
): InspectorOutcome {
  const baseW = dataset.adoption.supervision.outcomeWeights;
  const qualityBonus =
    (state.player.stats.mentalHealth >= 60 ? 0.12 : -0.1) +
    (childCloseness >= 70 ? 0.12 : -0.08) +
    (hadUnresolvedTasks ? -0.18 : 0.05) +
    (state.player.criminalRecord > 0 ? -0.25 : 0);

  const weights: { outcome: InspectorOutcome; weight: number }[] = [
    { outcome: 'great', weight: Math.max(0.08, baseW.great + qualityBonus) },
    { outcome: 'satisfactory', weight: Math.max(0.15, baseW.satisfactory) },
    {
      outcome: 'needs_improvement',
      weight: Math.max(0.04, baseW.needs_improvement - qualityBonus * 0.5),
    },
    {
      outcome: 'serious_concern',
      weight: Math.max(0.01, baseW.serious_concern + (hadUnresolvedTasks ? 0.08 : 0)),
    },
  ];
  return rng.weightedPick(weights, (w) => w.weight).outcome;
}

function getVisitSummaryFa(outcome: InspectorOutcome, childName: string): string {
  switch (outcome) {
    case 'great':
      return `مددکار ناظر از پیوند گرم و صمیمی با ${childName}، وضعیت تحصیلی و آرامش محیط خانه بسیار رضایت داشت.`;
    case 'satisfactory':
      return `بازدید دوره‌ای به خوبی انجام شد؛ روند رشد و سازگاری ${childName} در خانواده قابل قبول ارزیابی شد.`;
    case 'needs_improvement':
      return `ناظر وضعیت کلی را خوب دانست، اما برای آرامش و رشد بهتر ${childName} چند تکلیف حمایتی تا بازدید بعدی پیشنهاد کرد.`;
    case 'serious_concern':
      return `مددکار نسبت به فشار روحی یا کمبود پیگیری مراقبتی در این دوره ابراز نگرانی کرد و برنامه پیگیری نزدیک‌تر برای حمایت از ${childName} ثبت شد.`;
  }
}

export function stepAdoptionYear(
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): void {
  const adoption = ensureAdoptionState(state);
  let mutated = false;

  // 1. Update teen/origins event gate flag for placed adopted children
  const adoptedChildren = state.relationships
    .map((r) => ({ rel: r, person: state.npcs[r.personId] }))
    .filter(
      (item): item is { rel: GameState['relationships'][number]; person: Person } =>
        Boolean(
          item.person &&
            item.person.isAlive &&
            item.rel.role === 'child' &&
            item.person.originKind === 'adopted',
        ),
    );

  if (adoptedChildren.length > 0) {
    state.flags['has_adopted_child'] = true;
    if (adoptedChildren.some((c) => c.person.age >= 10)) {
      state.flags['has_adopted_teen_or_preteen'] = true;
    }
  }

  // 2. Advance active evaluation queue if waiting
  const app = adoption.activeApplication;
  if (app && app.step === 'evaluation' && app.evaluationStatus === 'in_queue') {
    app.queueYearsRemaining = Math.max(0, app.queueYearsRemaining - 1);
    mutated = true;
    if (app.queueYearsRemaining === 0) {
      const result = evaluateHomeVisitAndInterview(state, app, rng, dataset);
      app.evaluationStatus = result.status;
      app.evaluationNotesFa = result.notesFa;
      if (result.status === 'approved') {
        app.step = 'matching';
        app.matchedCandidates = generateMatchedChildCandidates(state, app.careType, rng, dataset);
        state.timeline.push({
          id: `turn_${state.turn}_adopt_eval_approved`,
          age: state.player.age,
          jalaliYear: state.currentJalaliYear,
          title: 'تأیید ارزیابی سرپرستی بهزیستی',
          text: 'پرونده سرپرستی تو پس از بازدید منزل تأیید شد و اکنون می‌توانی در بخش روابط > فرزندان مرحله آشنایی با کودک را ببینی.',
          type: 'milestone',
          statChanges: { happiness: 6 },
        });
        state.player.stats = applyStatDelta(state.player.stats, { happiness: 6 });
      } else if (result.status === 'rejected') {
        adoption.pastApplicationsCount += 1;
        adoption.reapplyCooldownUntilYear =
          state.currentJalaliYear + dataset.adoption.evaluation.reapplyCooldownYears;
        adoption.activeApplication = null;
        state.timeline.push({
          id: `turn_${state.turn}_adopt_eval_rejected`,
          age: state.player.age,
          jalaliYear: state.currentJalaliYear,
          title: 'نتیجه بررسی پرونده سرپرستی',
          text: result.notesFa[result.notesFa.length - 1] ?? 'پرونده در این دوره تأیید نشد.',
          type: 'life',
        });
      } else {
        state.timeline.push({
          id: `turn_${state.turn}_adopt_eval_improve`,
          age: state.player.age,
          jalaliYear: state.currentJalaliYear,
          title: 'گزارش بازدید کارشناس بهزیستی',
          text: 'کارشناس بهزیستی چند مورد اصلاحی برای تکمیل پرونده ثبت کرده است.',
          type: 'life',
        });
      }
    }
  }

  // 3. Supervision Inspector Visits & Age-18 Closure
  if (app && app.step === 'supervision' && app.placedChildPersonId) {
    const child = state.npcs[app.placedChildPersonId];
    const childRel = state.relationships.find((r) => r.personId === app.placedChildPersonId);
    if (child && child.isAlive && !child.adoptionMeta?.supervisionClosedAt18) {
      const endAge = dataset.adoption.supervision.endAtChildAge;
      if (child.age >= endAge) {
        if (child.adoptionMeta) {
          child.adoptionMeta = {
            ...child.adoptionMeta,
            supervisionClosedAt18: true,
          };
        }
        const hadSeriousConcern = adoption.supervisionVisits.some(
          (v) => v.childPersonId === child.id && v.outcome === 'serious_concern',
        );
        if (!hadSeriousConcern && !state.unlockedAchievements.includes('steadfast_guardian')) {
          state.unlockedAchievements.push('steadfast_guardian');
        }
        adoption.pastApplicationsCount += 1;
        adoption.activeApplication = null;
        mutated = true;

        state.timeline.push({
          id: `turn_${state.turn}_adopt_closed_18_${child.id}`,
          age: state.player.age,
          jalaliYear: state.currentJalaliYear,
          title: `پایان نظارت قانونی و جوانی ${child.firstName}`,
          text: `${child.firstName} به ${toPersianDigits(endAge)} سالگی رسید و دوره نظارت سازمان بهزیستی با آرامش و احترام به پایان رسید.`,
          type: 'milestone',
          statChanges: { happiness: 8, mentalHealth: 4 },
        });
        state.player.stats = applyStatDelta(state.player.stats, {
          happiness: 8,
          mentalHealth: 4,
        });
      } else if (app.nextVisitYear && state.currentJalaliYear >= app.nextVisitYear) {
        let inspector = app.inspectorPersonId ? state.npcs[app.inspectorPersonId] : undefined;
        if (!inspector) {
          inspector = createInspectorNpc(state, rng, dataset);
          state.npcs[inspector.id] = inspector;
          app.inspectorPersonId = inspector.id;
        }

        const priorVisitsForChild = adoption.supervisionVisits.filter(
          (v) => v.childPersonId === child.id,
        );
        const hadUnresolvedTasks = priorVisitsForChild.some(
          (v) => v.followUpRequired && v.tasks.some((t) => !t.completed),
        );

        const outcome = rollInspectorOutcome(
          state,
          childRel?.closeness ?? 75,
          hadUnresolvedTasks,
          rng,
          dataset,
        );
        const tasks = buildVisitTasks(outcome, state, rng, dataset);
        const followUpRequired = tasks.length > 0;
        const summaryFa = getVisitSummaryFa(outcome, child.firstName);

        const visit: AdoptionInspectorVisit = {
          id: `visit_${child.id}_${state.currentJalaliYear}`,
          childPersonId: child.id,
          childNameFa: `${child.firstName} ${child.lastName}`,
          jalaliYear: state.currentJalaliYear,
          playerAge: state.player.age,
          childAge: child.age,
          inspectorPersonId: inspector.id,
          inspectorNameFa: `${inspector.firstName} ${inspector.lastName}`,
          inspectorAvatarSeed: inspector.avatarSeed ?? inspector.id,
          outcome,
          summaryFa,
          followUpRequired,
          tasks,
        };
        adoption.supervisionVisits.push(visit);
        app.nextVisitYear =
          state.currentJalaliYear +
          (followUpRequired ? 1 : dataset.adoption.supervision.periodicIntervalYears);
        mutated = true;

        const statDelta =
          outcome === 'great'
            ? { happiness: 4, mentalHealth: 3 }
            : outcome === 'satisfactory'
              ? { mentalHealth: 2 }
              : outcome === 'needs_improvement'
                ? { mentalHealth: -2 }
                : { mentalHealth: -5, happiness: -3 };

        state.player.stats = applyStatDelta(state.player.stats, statDelta);
        if (childRel && outcome === 'great') {
          childRel.closeness = clampStat(childRel.closeness + 4);
        }

        const outcomeLabelFa =
          outcome === 'great'
            ? 'عالی'
            : outcome === 'satisfactory'
              ? 'قابل قبول'
              : outcome === 'needs_improvement'
                ? 'نیازمند بهبود'
                : 'نیازمند پیگیری جدی';

        state.timeline.push({
          id: `turn_${state.turn}_inspector_visit_${child.id}`,
          age: state.player.age,
          jalaliYear: state.currentJalaliYear,
          title: `بازدید ناظر بهزیستی (${outcomeLabelFa})`,
          text: `${inspector.firstName} ${inspector.lastName} وضعیت ${child.firstName} (${toPersianDigits(child.age)} ساله) را بررسی کرد: ${summaryFa}`,
          type: outcome === 'great' ? 'milestone' : 'life',
          statChanges: statDelta,
        });
      }
    } else if (!child || !child.isAlive) {
      adoption.activeApplication = null;
      mutated = true;
    }
  }

  // 4. Welfare center challenge pack milestones (ages 7, 13, 18)
  if (state.player.raisedInWelfareCenter) {
    for (const ms of dataset.adoption.challengePack.earlyLifeMilestones) {
      if (state.player.age === ms.age && !state.flags[`welfare_ms_${ms.age}`]) {
        state.flags[`welfare_ms_${ms.age}`] = true;
        if (ms.age === 18) {
          const grantToman = getBaselineScaleFromMinWage(
            dataset.adoption.challengePack.ageOutGrantMinWageMultiple.value,
            state,
            dataset,
          );
          state.player.moneyToman = Math.round(state.player.moneyToman + grantToman);
          state.player.stats = applyStatDelta(state.player.stats, {
            happiness: 6,
            mentalHealth: 5,
          });
          state.timeline.push({
            id: `turn_${state.turn}_welfare_ageout`,
            age: state.player.age,
            jalaliYear: state.currentJalaliYear,
            title: ms.titleFa,
            text: `${ms.textFa} (کمک‌هزینه توانمندسازی: ${formatToman(grantToman)})`,
            type: 'milestone',
            statChanges: { happiness: 6, mentalHealth: 5 },
          });
        } else {
          state.player.stats = applyStatDelta(state.player.stats, { happiness: 4 });
          state.timeline.push({
            id: `turn_${state.turn}_welfare_ms_${ms.age}`,
            age: state.player.age,
            jalaliYear: state.currentJalaliYear,
            title: ms.titleFa,
            text: ms.textFa,
            type: 'milestone',
            statChanges: { happiness: 4 },
          });
        }
      }
    }
  }

  if (mutated || state.adoption) {
    state.adoption = adoption;
  }
}

export function getAdoptionStepIndex(step: AdoptionStepId): number {
  const order: AdoptionStepId[] = [
    'readiness',
    'commitment',
    'application',
    'evaluation',
    'matching',
    'decree',
    'supervision',
  ];
  return Math.max(0, order.indexOf(step));
}

export const ADOPTION_STEP_ORDER: AdoptionStepId[] = [
  'readiness',
  'commitment',
  'application',
  'evaluation',
  'matching',
  'decree',
  'supervision',
];
