import type { GameDataset } from '../data/registry';
import { ensureAdoptionState, stepAdoptionYear } from './adoption';
import {
  calculateJobAnnualIncomeBreakdown,
  getAnnualLivingExpenseToman,
  getMinWageMonthlyForState,
  hasReachedFinancialFreedomMilestone,
  stepMacroYear,
} from './economy';
import { toPersianDigits } from './jalali';
import { ensureJobCompassState, resolveWaitlistedJobsOnYearAdvance } from './jobCompass';
import { SeededRNG } from './rng';
import {
  applyHiddenStatDelta,
  applyStatDelta,
  buildDeathSummary,
  clampStat,
  evaluateDeathRisk,
} from './stats';
import {
  calculateSpecialCareerAnnualIncomeBreakdown,
  evaluateYearlyTalentDiscovery,
  getOrdinaryJobAptitudeBonus,
  getTalentSkillState,
  isSpecialCareerJobId,
} from './talents';
import type { EventChoice, EventDefinition, GameState, SaveGame, TimelineEntry } from './types';

function cloneState(state: GameState): GameState {
  const clonedNpcs: GameState['npcs'] = {};
  for (const [id, person] of Object.entries(state.npcs)) {
    clonedNpcs[id] = { ...person };
  }
  const clonedTalentSkills: GameState['player']['talentSkills'] = {};
  for (const [k, v] of Object.entries(state.player.talentSkills ?? {})) {
    if (v) clonedTalentSkills[k as keyof typeof clonedTalentSkills] = { ...v };
  }
  return {
    ...state,
    player: {
      ...state.player,
      stats: { ...state.player.stats },
      hiddenStats: { ...state.player.hiddenStats },
      hiddenTalents: { ...state.player.hiddenTalents },
      discoveredTalents: (state.player.discoveredTalents ?? []).map((d) => ({ ...d })),
      talentSkills: clonedTalentSkills,
      education: { ...state.player.education },
      housing: { ...state.player.housing },
      job: state.player.job ? { ...state.player.job } : null,
      licenses: [...(state.player.licenses ?? [])],
    },
    npcs: clonedNpcs,
    relationships: state.relationships.map((r) => ({ ...r })),
    assets: state.assets.map((a) => ({ ...a })),
    loans: state.loans.map((l) => ({ ...l })),
    ownedBusiness: state.ownedBusiness
      ? {
          ...state.ownedBusiness,
          lastYearCostsToman: { ...state.ownedBusiness.lastYearCostsToman },
          staff: state.ownedBusiness.staff.map((s) => ({ ...s })),
        }
      : null,
    businessHistory: (state.businessHistory ?? []).map((h) => ({ ...h })),
    flags: { ...state.flags },
    eventHistory: { ...state.eventHistory },
    scheduledEvents: [...state.scheduledEvents],
    timeline: [...state.timeline],
    unlockedAchievements: [...state.unlockedAchievements],
    will: state.will
      ? {
          ...state.will,
          beneficiaries: state.will.beneficiaries.map((b) => ({ ...b })),
          specificItems: { ...state.will.specificItems },
        }
      : state.will ?? null,
    adoption: state.adoption ? ensureAdoptionState(state) : undefined,
    dynasty: state.dynasty
      ? {
          ...state.dynasty,
          unlockedDynastyRibbons: [...state.dynasty.unlockedDynastyRibbons],
          chapters: state.dynasty.chapters.map((c) => ({ ...c })),
          wealthTimeline: state.dynasty.wealthTimeline.map((w) => ({ ...w })),
          hallOfFame: state.dynasty.hallOfFame.map((h) => ({ ...h })),
          ancestorMemoriesFa: [...state.dynasty.ancestorMemoriesFa],
        }
      : undefined,
    jobCompass: state.jobCompass ? ensureJobCompassState(state) : undefined,
  };
}

function getStageLifeNote(age: number, state: GameState, rng: SeededRNG): {
  title: string;
  text: string;
  type: TimelineEntry['type'];
} {
  if (age === 1) {
    return {
      title: 'نخستین قدم‌ها',
      text: 'اولین کلماتت را به زبان آوردی و خانه پر از ذوق و خنده شد.',
      type: 'life',
    };
  }
  if (age === 7) {
    return {
      title: 'زنگ اول کلاس اول',
      text: 'با کوله و روکش دفترهای نو وارد دبستان شدی؛ بوی مداد تراش‌خورده همه‌جا پیچیده است.',
      type: 'milestone',
    };
  }
  if (age === 12) {
    return {
      title: 'پایان دبستان',
      text: 'دوره ابتدایی تمام شد و کم‌کم حال‌وهوای نوجوانی از راه می‌رسد.',
      type: 'life',
    };
  }
  if (age === 18) {
    return {
      title: 'آستانه جوانی',
      text: 'به ۱۸ سالگی رسیدی؛ حالا انتخاب‌های بزرگ زندگی پیش روی توست.',
      type: 'milestone',
    };
  }
  if (age === 30) {
    return {
      title: 'ورود به دهه سی',
      text: 'سی‌سالگی با تجربه‌های تازه و نگاه دقیق‌تر به آینده از راه رسید.',
      type: 'milestone',
    };
  }
  if (age === 60) {
    return {
      title: 'آستانه بازنشستگی و پختگی',
      text: 'در شصت‌سالگی بیشتر قدر لحظه‌های آرام کنار خانواده و دوستان قدیمی را می‌دانی.',
      type: 'milestone',
    };
  }
  if (age === 100) {
    return {
      title: 'جشن صدسالگی',
      text: 'یک قرن زندگی را پشت سر گذاشتی؛ کمتر کسی چنین مسیر پرباری را تجربه می‌کند.',
      type: 'milestone',
    };
  }

  const ambientLines = [
    'سالی آرام اما پر از تجربه‌های کوچک و روزمره را پشت سر گذاشتی.',
    'پاییز و زمستان گذشت و نوروز تازه با دیدوبازدیدهای فامیلی حال‌وهوایت را عوض کرد.',
    'در کنار دغدغه‌های روزمره، چند خاطره خوب با نزدیکانت ساختی.',
    'سالی گذشت و نگاهت به زندگی کمی پخته‌تر شد.',
  ];

  return {
    title: `سال ${toPersianDigits(state.currentJalaliYear)} · ${toPersianDigits(age)} سالگی`,
    text: rng.pick(ambientLines),
    type: 'life',
  };
}

export function advanceYear(save: SaveGame, dataset: GameDataset): SaveGame {
  if (!save.state.isAlive) {
    return save;
  }

  const rng = new SeededRNG(save.seed);
  rng.setState(save.rngState);

  const nextState = cloneState(save.state);

  // 1. Age & Calendar progression + Macro Horizon Guard
  const maxYear = dataset.inheritance.rules.maxMacroJalaliYear;
  if (nextState.currentJalaliYear >= maxYear) {
    nextState.isAlive = false;
    nextState.horizonEnded = true;
    const summary = buildDeathSummary(
      nextState,
      'پایان دوران شبیه‌سازی افق تاریخی',
      dataset,
    );
    nextState.deathSummary = {
      ...summary,
      legacyTitle: 'پایان یک دوران تاریخی',
      highlights: [
        `دوران شبیه‌سازی در سال ${toPersianDigits(nextState.currentJalaliYear)} با آرامش به پایان رسید.`,
        ...summary.highlights,
      ],
    };
    nextState.timeline.push({
      id: `turn_${nextState.turn}_horizon_end`,
      age: nextState.player.age,
      jalaliYear: nextState.currentJalaliYear,
      title: 'پایان یک دوران',
      text: `در سال ${toPersianDigits(nextState.currentJalaliYear)} و در ${toPersianDigits(nextState.player.age)} سالگی، دفتر این دوران تاریخی بسته شد.`,
      type: 'death',
    });
    return {
      ...save,
      rngState: rng.getState(),
      updatedAt: new Date().toISOString(),
      state: nextState,
    };
  }

  nextState.turn += 1;
  nextState.player.age += 1;
  nextState.currentJalaliYear += 1;
  const age = nextState.player.age;

  // 2. Step Macro Economy (Historical 1340-1405 or Scenario-based > 1405)
  const macroStep = stepMacroYear(nextState, nextState.currentJalaliYear, rng, dataset);
  nextState.inflationMultiplier = macroStep.nextMultiplier;
  nextState.lastInflationRate = macroStep.rate;
  for (const [k, v] of Object.entries(macroStep.macroFlags)) {
    nextState.flags[k] = v;
  }

  // 3. Age NPCs, check natural mortality, and process estate inheritance
  for (const npc of Object.values(nextState.npcs)) {
    if (!npc.isAlive) continue;
    npc.age += 1;
    const npcDeathChance = npc.age > 85 ? 0.14 : npc.age > 72 ? 0.04 : 0.002;
    if (rng.chance(npcDeathChance)) {
      npc.isAlive = false;
      nextState.player.stats = applyStatDelta(nextState.player.stats, {
        happiness: -12,
        mentalHealth: -10,
      });
      nextState.timeline.push({
        id: `turn_${nextState.turn}_npc_death_${npc.id}`,
        age,
        jalaliYear: nextState.currentJalaliYear,
        title: `فقدان ${npc.firstName}`,
        text: `متأسفانه ${npc.firstName} ${npc.lastName} در ${toPersianDigits(npc.age)} سالگی دار فانی را وداع گفت.`,
        type: 'life',
      });
    }
  }

  // Estate inheritance if both parents have passed away
  const fatherAlive = Boolean(nextState.npcs['npc_father']?.isAlive);
  const motherAlive = Boolean(nextState.npcs['npc_mother']?.isAlive);
  const hadParents = Boolean(nextState.npcs['npc_father'] || nextState.npcs['npc_mother']);
  if (hadParents && !fatherAlive && !motherAlive && !nextState.flags['received_inheritance']) {
    nextState.flags['received_inheritance'] = true;
    const p = dataset.economy.baseline1405.policyAndModel;
    const minWage = getMinWageMonthlyForState(nextState, dataset);
    const baseMultiple =
      nextState.player.socialClass === 'wealthy'
        ? p.inheritanceWealthyMinWageMultiple.value
        : nextState.player.socialClass === 'upper_middle'
          ? p.inheritanceUpperMiddleMinWageMultiple.value
          : nextState.player.socialClass === 'middle'
            ? p.inheritanceMiddleMinWageMultiple.value
            : p.inheritancePoorMinWageMultiple.value;
    const siblingCount = nextState.relationships.filter(
      (r) => r.role === 'sibling' && nextState.npcs[r.personId]?.isAlive,
    ).length;
    const share = Math.round((minWage * baseMultiple) / (1 + siblingCount * 0.65));
    if (share > 0) {
      nextState.player.moneyToman = Math.round(nextState.player.moneyToman + share);
      nextState.timeline.push({
        id: `turn_${nextState.turn}_inheritance`,
        age,
        jalaliYear: nextState.currentJalaliYear,
        title: 'انحصار وراثت و سهم‌الارث خانوادگی',
        text: `پس از درگذشت والدین، سهم‌الارث خانوادگی به ارزش ${toPersianDigits(share.toLocaleString('en-US'))} تومان به تو رسید.`,
        type: 'milestone',
      });
    }
    // Check if parents ran a compatible trade that can be inherited as a family business
    if (!nextState.ownedBusiness && !nextState.flags['pending_family_biz_inheritance']) {
      const fatherTitle = nextState.npcs['npc_father']?.jobTitle ?? '';
      const motherTitle = nextState.npcs['npc_mother']?.jobTitle ?? '';
      const matchingBiz = dataset.businesses.businesses.find((b) =>
        b.familyTradeKeywords.some((kw) => fatherTitle.includes(kw) || motherTitle.includes(kw)),
      );
      if (matchingBiz && rng.chance(0.45)) {
        nextState.flags['pending_family_biz_inheritance'] = JSON.stringify({
          businessTypeId: matchingBiz.id,
          businessNameFa: `${matchingBiz.titleFa} خانوادگی`,
          offeredYear: nextState.currentJalaliYear,
        });
        nextState.timeline.push({
          id: `turn_${nextState.turn}_family_biz_inheritance`,
          age,
          jalaliYear: nextState.currentJalaliYear,
          title: 'واگذاری ماترک کسب‌وکار خانوادگی',
          text: `در انحصار وراثت، امکان ادامه یا واگذاری «${matchingBiz.titleFa} خانوادگی» پیش رویت قرار گرفت؛ در بخش شغل می‌توانی بپذیری یا صرف‌نظر کنی.`,
          type: 'milestone',
        });
      }
    }
  }

  // Rare family housing help for wealthy/upper_middle adults in early adulthood
  if (
    age >= 25 &&
    age <= 31 &&
    (fatherAlive || motherAlive) &&
    !nextState.flags['family_housing_help'] &&
    (nextState.player.socialClass === 'wealthy' || nextState.player.socialClass === 'upper_middle') &&
    rng.chance(dataset.economy.baseline1405.policyAndModel.familyHelpProbability.value)
  ) {
    nextState.flags['family_housing_help'] = true;
    const p = dataset.economy.baseline1405.policyAndModel;
    const minWage = getMinWageMonthlyForState(nextState, dataset);
    const helpMultiple =
      nextState.player.socialClass === 'wealthy'
        ? p.familyHelpWealthyMinWageMultiple.value
        : p.familyHelpUpperMiddleMinWageMultiple.value;
    const helpAmount = Math.round(minWage * helpMultiple);
    nextState.player.moneyToman = Math.round(nextState.player.moneyToman + helpAmount);
    nextState.timeline.push({
      id: `turn_${nextState.turn}_family_help`,
      age,
      jalaliYear: nextState.currentJalaliYear,
      title: 'پشتیبانی مالی خانواده',
      text: `خانواده‌ات برای کمک به مستقل‌شدن و تأمین مسکن، مبلغی قابل توجه به حساب تو واریز کردند.`,
      type: 'milestone',
      statChanges: { happiness: 6 },
    });
    nextState.player.stats = applyStatDelta(nextState.player.stats, { happiness: 6 });
  }

  // 4. Natural stage progression for education & stats
  if (age === 7 && nextState.player.education.level === 'none') {
    nextState.player.education.level = 'elementary';
    nextState.player.education.inSchool = true;
  } else if (age === 13 && nextState.player.education.level === 'elementary') {
    nextState.player.education.level = 'middle_school';
  } else if (age === 16 && nextState.player.education.level === 'middle_school') {
    nextState.player.education.level = 'high_school';
  } else if (age === 18 && nextState.player.education.level === 'high_school') {
    nextState.player.education.level = 'diploma';
    nextState.player.education.inSchool = false;
  }

  // Natural stat drift by age
  let healthDrift = 0;
  let intelDrift = 0;
  let looksDrift = 0;
  let happinessDrift = rng.int(-2, 2);
  let mentalDrift = rng.int(-2, 2);

  if (age <= 18) {
    intelDrift = rng.int(1, 3);
    healthDrift = rng.int(-1, 2);
  } else if (age <= 35) {
    healthDrift = rng.int(-1, 1);
    intelDrift = rng.int(0, 1);
  } else if (age <= 55) {
    healthDrift = rng.int(-3, 0);
    looksDrift = rng.int(-2, 0);
  } else if (age <= 75) {
    healthDrift = rng.int(-5, -1);
    looksDrift = rng.int(-3, -1);
  } else {
    healthDrift = rng.int(-9, -3);
    looksDrift = rng.int(-4, -1);
  }

  nextState.player.stats = applyStatDelta(nextState.player.stats, {
    health: healthDrift,
    intelligence: intelDrift,
    looks: looksDrift,
    happiness: happinessDrift,
    mentalHealth: mentalDrift,
  });

  // 4b. Hidden Talent Discovery Tick (ages 5-18 peak + adult late bloomers)
  const discovery = evaluateYearlyTalentDiscovery(nextState, rng, dataset);
  if (discovery.discovered && discovery.timelineTitle && discovery.timelineText) {
    nextState.player.discoveredTalents.push(discovery.discovered);
    const isClearOrBrilliant =
      discovery.discovered.tier === 'clear_talent' ||
      discovery.discovered.tier === 'brilliant_talent';
    nextState.timeline.push({
      id: `turn_${nextState.turn}_talent_${discovery.discovered.talentId}`,
      age,
      jalaliYear: nextState.currentJalaliYear,
      title: discovery.timelineTitle,
      text: discovery.timelineText,
      type: isClearOrBrilliant ? 'milestone' : 'life',
      statChanges: { happiness: isClearOrBrilliant ? 5 : 2 },
    });
    nextState.player.stats = applyStatDelta(nextState.player.stats, {
      happiness: isClearOrBrilliant ? 5 : 2,
    });
  }

  // 5. Real-data economy tick (net job income & city-adjusted living expenses)
  const annualExpense = getAnnualLivingExpenseToman(nextState, dataset);
  if (nextState.player.job) {
    const specialRef = isSpecialCareerJobId(nextState.player.job.jobId);
    const specialDef = specialRef
      ? dataset.specialCareers.find((c) => c.id === specialRef.careerId)
      : undefined;
    const jobDef = specialDef
      ? undefined
      : dataset.jobs.find((j) => j.id === nextState.player.job!.jobId);

    let netSalary = nextState.player.job.annualSalaryToman;
    if (specialDef && specialRef) {
      const skillState = getTalentSkillState(nextState, specialDef.requiredTalentId);
      const breakdown = calculateSpecialCareerAnnualIncomeBreakdown({
        career: specialDef,
        stage: Math.max(1, skillState.careerStage || nextState.player.job.level),
        state: nextState,
        dataset,
        rng,
        allowTail: true,
        isFallback: specialRef.isFallback,
      });
      netSalary = breakdown.netAnnual;
      nextState.flags['last_job_gross'] = breakdown.grossAnnual;
      nextState.flags['last_job_net'] = breakdown.netAnnual;
      nextState.flags['last_job_deductions'] = breakdown.bimeh + breakdown.incomeTax;
      if (breakdown.tailTriggered) {
        nextState.timeline.push({
          id: `turn_${nextState.turn}_job_tail`,
          age,
          jalaliYear: nextState.currentJalaliYear,
          title: breakdown.tailTriggered.titleFa,
          text: breakdown.tailTriggered.resultTextFa,
          type: 'milestone',
          statChanges: { happiness: 6, fame: 4 },
        });
        nextState.player.stats = applyStatDelta(nextState.player.stats, {
          happiness: 6,
          fame: 4,
        });
      }
    } else if (jobDef) {
      const aptitudeEdge = getOrdinaryJobAptitudeBonus(jobDef.track, nextState);
      const maxLvl = Math.max(1, jobDef.ladder.length);
      const basePos =
        maxLvl > 1
          ? 0.25 + ((Math.min(maxLvl, nextState.player.job.level) - 1) / (maxLvl - 1)) * 0.5
          : 0.45;
      const breakdown = calculateJobAnnualIncomeBreakdown({
        job: jobDef,
        level: nextState.player.job.level,
        state: nextState,
        dataset,
        rng,
        allowTail: true,
        positionOverride01: aptitudeEdge > 0 ? Math.min(0.95, basePos + aptitudeEdge) : undefined,
      });
      netSalary = breakdown.netAnnual;
      nextState.flags['last_job_gross'] = breakdown.grossAnnual;
      nextState.flags['last_job_net'] = breakdown.netAnnual;
      nextState.flags['last_job_deductions'] =
        breakdown.commission + breakdown.runningCosts + breakdown.bimeh + breakdown.incomeTax;
      if (breakdown.tailTriggered) {
        nextState.timeline.push({
          id: `turn_${nextState.turn}_job_tail`,
          age,
          jalaliYear: nextState.currentJalaliYear,
          title: breakdown.tailTriggered.titleFa,
          text: breakdown.tailTriggered.resultTextFa,
          type: 'milestone',
          statChanges: { happiness: 6 },
        });
        nextState.player.stats = applyStatDelta(nextState.player.stats, { happiness: 6 });
      }
      const prevTrackExp =
        typeof nextState.flags[`track_exp_${jobDef.track}`] === 'number'
          ? (nextState.flags[`track_exp_${jobDef.track}`] as number)
          : 0;
      nextState.flags[`track_exp_${jobDef.track}`] = prevTrackExp + 1;
    }
    const prevRoleYears =
      typeof nextState.flags['job_years_in_role'] === 'number'
        ? (nextState.flags['job_years_in_role'] as number)
        : nextState.player.job.yearsInJob;
    nextState.flags['job_years_in_role'] = prevRoleYears + 1;
    nextState.player.job.annualSalaryToman = netSalary;
    nextState.player.job.yearsInJob += 1;
    nextState.player.moneyToman = Math.round(nextState.player.moneyToman + netSalary - annualExpense);

    // Rare retiring-employer buyout offer (ONLY for loyal tenured employees; never automatic ownership)
    if (
      jobDef &&
      jobDef.ownershipPath.allowed &&
      jobDef.ownershipPath.employerOfferEligible &&
      jobDef.ownershipPath.businessTypeId &&
      !nextState.ownedBusiness &&
      !nextState.flags['pending_employer_offer'] &&
      !nextState.flags[`employer_offer_seen_${jobDef.id}`] &&
      nextState.player.age >= 28 &&
      nextState.player.job.yearsInJob >= 10 &&
      nextState.player.hiddenStats.conscientiousness >= 50 &&
      rng.chance(0.022)
    ) {
      const bizDef = dataset.businesses.businesses.find(
        (b) => b.id === jobDef.ownershipPath.businessTypeId,
      );
      if (bizDef) {
        const minWage = getMinWageMonthlyForState(nextState, dataset);
        const fullPrice = Math.round(minWage * (jobDef.ownershipPath.capitalMinWageMultiple.min + 12));
        const discountedPrice = Math.round(fullPrice * 0.65);
        nextState.flags[`employer_offer_seen_${jobDef.id}`] = true;
        nextState.flags['pending_employer_offer'] = JSON.stringify({
          businessTypeId: bizDef.id,
          businessNameFa: `${bizDef.titleFa} (واگذاری کارفرما)`,
          jobId: jobDef.id,
          discountedPriceToman: discountedPrice,
          fullPriceToman: fullPrice,
          offeredYear: nextState.currentJalaliYear,
        });
        nextState.timeline.push({
          id: `turn_${nextState.turn}_employer_offer`,
          age,
          jalaliYear: nextState.currentJalaliYear,
          title: 'پیشنهاد واگذاری از طرف کارفرمای بازنشسته',
          text: `صاحب کار قدیمی‌ات بعد از سال‌ها وفاداری و کار با تو، پیشنهاد خرید با تخفیفِ «${bizDef.titleFa}» را مطرح کرد. در بخش شغل می‌توانی بررسی کنی و تصمیم بگیری.`,
          type: 'milestone',
        });
      }
    }
  } else if (annualExpense > 0) {
    nextState.player.moneyToman = Math.round(nextState.player.moneyToman - annualExpense);
  }

  if (nextState.player.moneyToman < 0) {
    nextState.player.debtToman = Math.round(
      nextState.player.debtToman + Math.abs(nextState.player.moneyToman),
    );
    nextState.player.moneyToman = 0;
  }

  // 5b. Adoption supervision, queue progression, and welfare center milestones
  stepAdoptionYear(nextState, rng, dataset);

  // 5c. Resolve waitlisted job interviews
  const waitlistNotes = resolveWaitlistedJobsOnYearAdvance(nextState, rng, dataset);
  for (const note of waitlistNotes) {
    nextState.timeline.push({
      id: `turn_${nextState.turn}_job_waitlist_${nextState.timeline.length}`,
      age,
      jalaliYear: nextState.currentJalaliYear,
      title: note.includes('تأیید شد') ? 'پذیرش نهایی از فهرست انتظار' : 'نتیجه فهرست انتظار شغلی',
      text: note,
      type: note.includes('تأیید شد') ? 'milestone' : 'life',
    });
  }

  // 6. Achievement checks (using real purchasing power for financial freedom!)
  if (age >= 100 && !nextState.unlockedAchievements.includes('centenarian')) {
    nextState.unlockedAchievements.push('centenarian');
  }
  if (
    hasReachedFinancialFreedomMilestone(nextState, dataset) &&
    !nextState.unlockedAchievements.includes('billionaire')
  ) {
    nextState.unlockedAchievements.push('billionaire');
  }

  // 7. Evaluate mortality
  const mortality = evaluateDeathRisk(nextState, rng);
  if (mortality.died) {
    nextState.isAlive = false;
    nextState.player.stats.health = clampStat(0);
    const summary = buildDeathSummary(nextState, mortality.causeOfDeath, dataset);
    nextState.deathSummary = summary;
    nextState.timeline.push({
      id: `turn_${nextState.turn}_death`,
      age,
      jalaliYear: nextState.currentJalaliYear,
      title: 'پایان زندگی',
      text: `در سال ${toPersianDigits(nextState.currentJalaliYear)} و در ${toPersianDigits(age)} سالگی بر اثر ${mortality.causeOfDeath} چشم از جهان فروبستی.`,
      type: 'death',
    });
  } else {
    const note = getStageLifeNote(age, nextState, rng);
    nextState.timeline.push({
      id: `turn_${nextState.turn}_life`,
      age,
      jalaliYear: nextState.currentJalaliYear,
      title: note.title,
      text: note.text,
      type: note.type,
    });

    const memories = nextState.dynasty?.ancestorMemoriesFa ?? [];
    const memoryCount =
      typeof nextState.flags['legacy_memory_count'] === 'number'
        ? (nextState.flags['legacy_memory_count'] as number)
        : 0;
    if (memories.length > 0 && age >= 8 && memoryCount < 2 && rng.chance(0.14)) {
      const chosenMemory = memories[memoryCount % memories.length];
      nextState.flags['legacy_memory_count'] = memoryCount + 1;
      nextState.player.stats = applyStatDelta(nextState.player.stats, {
        happiness: 2,
        mentalHealth: 1,
      });
      nextState.timeline.push({
        id: `turn_${nextState.turn}_ancestor_memory`,
        age,
        jalaliYear: nextState.currentJalaliYear,
        title: 'یادگار نسل‌های پیشین',
        text: chosenMemory,
        type: 'event',
        statChanges: { happiness: 2, mentalHealth: 1 },
      });
    }
  }

  return {
    ...save,
    rngState: rng.getState(),
    updatedAt: new Date().toISOString(),
    state: nextState,
  };
}

export function applyEventChoice(
  save: SaveGame,
  event: EventDefinition,
  choice: EventChoice,
): SaveGame {
  if (!save.state.isAlive) return save;

  const nextState = cloneState(save.state);
  const { effects } = choice;

  if (effects.stats) {
    nextState.player.stats = applyStatDelta(nextState.player.stats, effects.stats);
  }
  if (effects.hiddenStats) {
    nextState.player.hiddenStats = applyHiddenStatDelta(
      nextState.player.hiddenStats,
      effects.hiddenStats,
    );
  }
  if (typeof effects.moneyToman === 'number' && Number.isFinite(effects.moneyToman)) {
    const adjustedMoney = Math.round(effects.moneyToman * nextState.inflationMultiplier);
    nextState.player.moneyToman = Math.round(nextState.player.moneyToman + adjustedMoney);
    if (nextState.player.moneyToman < 0) {
      nextState.player.debtToman = Math.round(
        nextState.player.debtToman + Math.abs(nextState.player.moneyToman),
      );
      nextState.player.moneyToman = 0;
    }
  }
  if (effects.setFlags) {
    for (const [key, val] of Object.entries(effects.setFlags)) {
      nextState.flags[key] = val;
    }
  }
  if (effects.scheduleEvents) {
    for (const item of effects.scheduleEvents) {
      nextState.scheduledEvents.push({
        eventId: item.eventId,
        triggerAtAge: nextState.player.age + item.delayYears,
      });
    }
  }

  nextState.eventHistory[event.id] = (nextState.eventHistory[event.id] ?? 0) + 1;
  nextState.timeline.push({
    id: `turn_${nextState.turn}_event_${event.id}_${nextState.timeline.length}`,
    age: nextState.player.age,
    jalaliYear: nextState.currentJalaliYear,
    title: event.titleFa,
    text: effects.resultTextFa,
    type: 'event',
    statChanges: effects.stats,
  });

  return {
    ...save,
    updatedAt: new Date().toISOString(),
    state: nextState,
  };
}
