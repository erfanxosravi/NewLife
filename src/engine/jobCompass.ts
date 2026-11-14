import type { GameDataset } from '../data/registry';
import {
  getCredentialLabelFa,
  getPlayerSkillLevel,
  hasCredential,
  meetsMinEducation,
} from './careers';
import {
  calculateJobAnnualIncomeBreakdown,
  getMacroRatesForState,
  getMinWageMonthlyForState,
  type JobIncomeBreakdown,
} from './economy';
import { formatToman, toPersianDigits } from './jalali';
import { SeededRNG } from './rng';
import type {
  EducationLevel,
  GameState,
  InterviewQuestion,
  JobCompassAxis,
  JobCompassPriorities,
  JobCompassState,
  JobDefinition,
  TalentId,
} from './types';

export const JOB_COMPASS_AXES: {
  key: JobCompassAxis;
  icon: string;
  labelFa: string;
  shortFa: string;
}[] = [
  { key: 'income', icon: '💰', labelFa: 'درآمد', shortFa: 'درآمد' },
  { key: 'calm', icon: '🧘', labelFa: 'آرامش', shortFa: 'آرامش' },
  { key: 'security', icon: '🛡️', labelFa: 'امنیت', shortFa: 'امنیت' },
  { key: 'growth', icon: '🚀', labelFa: 'رشد', shortFa: 'رشد' },
  { key: 'freedom', icon: '🕊️', labelFa: 'آزادی', shortFa: 'آزادی' },
];

const EDUCATION_LABELS_FA: Record<EducationLevel, string> = {
  none: 'بدون مدرک',
  preschool: 'پیش‌دبستانی',
  elementary: 'ابتدایی',
  middle_school: 'سیکل',
  high_school: 'متوسطه',
  diploma: 'دیپلم',
  associate: 'کاردانی',
  bachelor: 'لیسانس',
  master: 'ارشد',
  phd: 'دکتری',
  medical_doctor: 'دکترای پزشکی',
};

const JOB_TALENT_AFFINITY: Record<string, TalentId[]> = {
  snapp_driver: ['mechanical'],
  barber: ['visual_art', 'cooking'],
  bazaar_merchant: ['business_sense', 'leadership'],
  software_engineer: ['programming_tech', 'math_science'],
  teacher: ['writing', 'leadership', 'math_science'],
  civil_servant: ['writing', 'leadership'],
  nurse: ['math_science'],
  doctor: ['math_science'],
  pharmacist: ['math_science'],
  lawyer: ['writing', 'leadership', 'business_sense'],
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function clampPriority(v: number): number {
  return Math.max(0, Math.min(3, Math.round(v)));
}

export function deriveDefaultPriorities(state: GameState): JobCompassPriorities {
  const { player } = state;
  const hasAliveChildren = state.relationships.some(
    (r) => r.role === 'child' && Boolean(state.npcs[r.personId]?.isAlive),
  );
  const isMarried = player.maritalStatus === 'married' || player.maritalStatus === 'engaged';
  const highRisk = player.hiddenStats.riskAppetite >= 62;
  const highConscientious = player.hiddenStats.conscientiousness >= 62;
  const youngCareerStart = player.age < 28;

  let income = 2;
  let calm = 1;
  let security = 2;
  let growth = 2;
  let freedom = 1;

  if (isMarried || hasAliveChildren) {
    security = 3;
    calm = 2;
    freedom = 1;
  } else if (youngCareerStart) {
    growth = 3;
    income = 3;
    security = 1;
  }

  if (highRisk) {
    freedom = Math.min(3, freedom + 1);
    growth = 3;
    security = Math.max(1, security - 1);
  }
  if (highConscientious) {
    security = Math.min(3, security + 1);
    calm = Math.min(3, calm + 1);
  }
  if (player.stats.mentalHealth < 50) {
    calm = 3;
  }
  if (player.age >= 45) {
    calm = Math.min(3, calm + 1);
    security = 3;
  }

  return {
    income: clampPriority(income),
    calm: clampPriority(calm),
    security: clampPriority(security),
    growth: clampPriority(growth),
    freedom: clampPriority(freedom),
  };
}

export function createDefaultJobCompassState(state?: GameState): JobCompassState {
  return {
    priorities: state
      ? deriveDefaultPriorities(state)
      : { income: 2, calm: 2, security: 2, growth: 2, freedom: 1 },
    prioritiesCustomized: false,
    shortlistedJobIds: [],
    pinnedJobId: null,
    salaryUnit: 'monthly',
    waitlistedJobs: [],
  };
}

export function ensureJobCompassState(state: GameState): JobCompassState {
  const raw = state.jobCompass;
  if (!raw) {
    return createDefaultJobCompassState(state);
  }
  const priorities = raw.prioritiesCustomized
    ? {
        income: clampPriority(raw.priorities.income),
        calm: clampPriority(raw.priorities.calm),
        security: clampPriority(raw.priorities.security),
        growth: clampPriority(raw.priorities.growth),
        freedom: clampPriority(raw.priorities.freedom),
      }
    : deriveDefaultPriorities(state);

  return {
    priorities,
    prioritiesCustomized: Boolean(raw.prioritiesCustomized),
    shortlistedJobIds: [...new Set(raw.shortlistedJobIds ?? [])].slice(0, 8),
    pinnedJobId: raw.pinnedJobId ?? null,
    salaryUnit: raw.salaryUnit === 'annual' ? 'annual' : 'monthly',
    waitlistedJobs: (raw.waitlistedJobs ?? []).map((w) => ({ ...w })),
  };
}

export interface JobSalaryRangeInfo {
  minWageMonthly: number;
  usdRate: number;
  p10AnnualNet: number;
  medianAnnualNet: number;
  p90AnnualNet: number;
  expectedAnnualNet: number;
  p10MonthlyNet: number;
  medianMonthlyNet: number;
  p90MonthlyNet: number;
  expectedMonthlyNet: number;
  expectedMonthlyGross: number;
  expectedAnnualGross: number;
  expectedBreakdown: JobIncomeBreakdown;
  expectedMonthlyUsd: number;
  expectedAnnualUsd: number;
  medianMonthlyUsd: number;
}

export function jobSalaryRange(
  job: JobDefinition,
  state: GameState,
  dataset: GameDataset,
): JobSalaryRangeInfo {
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  const usdRate = Math.max(1, getMacroRatesForState(state, dataset).usdFree);
  const b10 = calculateJobAnnualIncomeBreakdown({
    job,
    level: 1,
    state,
    dataset,
    positionOverride01: 0,
  });
  const bMed = calculateJobAnnualIncomeBreakdown({
    job,
    level: 1,
    state,
    dataset,
    positionOverride01: 0.5,
  });
  const b90 = calculateJobAnnualIncomeBreakdown({
    job,
    level: 1,
    state,
    dataset,
    positionOverride01: 1,
  });
  const bExp = calculateJobAnnualIncomeBreakdown({
    job,
    level: 1,
    state,
    dataset,
    positionOverride01: 0.35,
  });

  const expectedMonthlyNet = Math.round(bExp.netAnnual / 12);
  const medianMonthlyNet = Math.round(bMed.netAnnual / 12);

  return {
    minWageMonthly,
    usdRate,
    p10AnnualNet: b10.netAnnual,
    medianAnnualNet: bMed.netAnnual,
    p90AnnualNet: b90.netAnnual,
    expectedAnnualNet: bExp.netAnnual,
    p10MonthlyNet: Math.round(b10.netAnnual / 12),
    medianMonthlyNet,
    p90MonthlyNet: Math.round(b90.netAnnual / 12),
    expectedMonthlyNet,
    expectedMonthlyGross: Math.round(bExp.grossAnnual / 12),
    expectedAnnualGross: bExp.grossAnnual,
    expectedBreakdown: bExp,
    expectedMonthlyUsd: Math.round(expectedMonthlyNet / usdRate),
    expectedAnnualUsd: Math.round(bExp.netAnnual / usdRate),
    medianMonthlyUsd: Math.round(medianMonthlyNet / usdRate),
  };
}

export interface ComputedJobFingerprint {
  income: number;
  calm: number;
  security: number;
  growth: number;
  freedom: number;
  isEstimate: boolean;
  estimatedAxes: JobCompassAxis[];
}

export function jobFingerprint(
  job: JobDefinition,
  state: GameState,
  dataset: GameDataset,
): ComputedJobFingerprint {
  const medians = dataset.jobs.map((j) =>
    calculateJobAnnualIncomeBreakdown({
      job: j,
      level: 1,
      state,
      dataset,
      positionOverride01: 0.5,
    }).netAnnual,
  );
  const minIncome = Math.min(...medians);
  const maxIncome = Math.max(...medians);
  const thisMed = calculateJobAnnualIncomeBreakdown({
    job,
    level: 1,
    state,
    dataset,
    positionOverride01: 0.5,
  }).netAnnual;
  const incomeNorm =
    maxIncome > minIncome ? (thisMed - minIncome) / (maxIncome - minIncome) : 0.5;
  const derivedIncome = clamp100(22 + incomeNorm * 74);

  // Derived calm from stress (0..100) + weekly hours (30..54)
  const hoursPenalty = Math.max(0, job.weeklyHours - 30) * 1.1;
  const derivedCalm = clamp100(100 - (job.stress * 0.72 + hoursPenalty));

  // Derived growth from ladder length + ceiling salary multiplier + ownership path
  const maxMult = job.ladder[job.ladder.length - 1]?.salaryMultiplier ?? 1;
  const ladderBonus = job.noPromotions ? 0 : Math.min(35, (job.ladder.length - 1) * 9);
  const multBonus = Math.min(35, Math.max(0, (maxMult - 1) * 14));
  const ownBonus = job.ownershipPath.allowed ? 16 : 0;
  const derivedGrowth = clamp100(16 + ladderBonus + multBonus + ownBonus);

  // Security & freedom blend derived employer structure with calibrated job baseline
  const employerSecurityBase =
    job.employerType === 'دولتی'
      ? 88
      : job.employerType === 'خصوصی'
        ? 58
        : job.employerType === 'خانوادگی'
          ? 48
          : 30;
  const derivedSecurity = clamp100(employerSecurityBase * 0.65 + job.fingerprint.security * 0.35);

  const employerFreedomBase =
    job.employerType === 'آزاد'
      ? 92
      : job.employerType === 'خصوصی'
        ? 56
        : job.employerType === 'خانوادگی'
          ? 44
          : 26;
  const derivedFreedom = clamp100(employerFreedomBase * 0.6 + job.fingerprint.freedom * 0.4);

  return {
    income: derivedIncome,
    calm: derivedCalm,
    security: derivedSecurity,
    growth: derivedGrowth,
    freedom: derivedFreedom,
    isEstimate: job.fingerprint.isEstimate,
    estimatedAxes: job.fingerprint.estimatedAxes,
  };
}

export interface JobRequirementCheckItem {
  id: string;
  labelFa: string;
  met: boolean;
  currentTextFa: string;
  requiredTextFa: string;
  costToman?: number;
  estimatedYears?: number;
  actionTarget?: {
    type: 'education' | 'uni' | 'konkur' | 'license' | 'skill' | 'military';
    id?: string;
    labelFa: string;
  };
}

export interface JobGapStep {
  id: string;
  titleFa: string;
  subtitleFa?: string;
  done: boolean;
  costToman?: number;
  estimatedYears?: number;
  actionTarget?: JobRequirementCheckItem['actionTarget'];
}

export interface JobReadinessResult {
  score: number; // 0..100
  eligible: boolean;
  group: 'ready' | 'near_ready' | 'future';
  missingCount: number;
  checks: JobRequirementCheckItem[];
  shortGapFa: string;
  lockTagFa?: string;
  isCurrentJob: boolean;
  onCooldown: boolean;
  isWaitlisted: boolean;
  canApplyNow: boolean;
  blockedReason?: string;
}

function estimateEducationYearsLeft(current: EducationLevel, required: EducationLevel): number {
  const rankMap: Record<EducationLevel, number> = {
    none: 0,
    preschool: 0,
    elementary: 6,
    middle_school: 9,
    high_school: 11,
    diploma: 12,
    associate: 14,
    bachelor: 16,
    master: 18,
    phd: 22,
    medical_doctor: 19,
  };
  return Math.max(1, (rankMap[required] ?? 12) - (rankMap[current] ?? 0));
}

export function jobReadiness(
  state: GameState,
  job: JobDefinition,
  dataset: GameDataset,
): JobReadinessResult {
  const { player } = state;
  const checks: JobRequirementCheckItem[] = [];

  // 1. Minimum age 18
  const ageMet = player.age >= 18;
  checks.push({
    id: 'age_18',
    labelFa: 'حداقل سن ۱۸ سال',
    met: ageMet,
    currentTextFa: `${toPersianDigits(player.age)} سال`,
    requiredTextFa: '۱۸ سال',
    estimatedYears: ageMet ? 0 : Math.max(1, 18 - player.age),
  });

  // 2. Minimum education
  if (job.minEducation !== 'none') {
    const eduMet = meetsMinEducation(player.education.level, job.minEducation);
    const neededLabel = EDUCATION_LABELS_FA[job.minEducation];
    const currentLabel = EDUCATION_LABELS_FA[player.education.level];
    const yearsLeft = eduMet
      ? 0
      : estimateEducationYearsLeft(player.education.level, job.minEducation);
    const hasKonkur = Boolean(player.education.konkurRank);
    const uniAction: JobRequirementCheckItem['actionTarget'] = eduMet
      ? undefined
      : !meetsMinEducation(player.education.level, 'diploma')
        ? { type: 'education', labelFa: 'ادامه تحصیل' }
        : hasKonkur && !player.education.inSchool
          ? { type: 'uni', labelFa: 'ثبت‌نام دانشگاه' }
          : !player.education.inSchool
            ? { type: 'konkur', labelFa: 'شرکت در کنکور' }
            : { type: 'education', labelFa: 'وضعیت تحصیل' };

    checks.push({
      id: `edu_${job.minEducation}`,
      labelFa: `مدرک ${neededLabel}`,
      met: eduMet,
      currentTextFa: currentLabel,
      requiredTextFa: neededLabel,
      estimatedYears: yearsLeft,
      actionTarget: uniAction,
    });
  }

  // 3. Military service check (mirrors getJobApplicationStatus)
  if (player.gender === 'male') {
    const milMet = player.militaryStatus !== 'serving';
    checks.push({
      id: 'military_free',
      labelFa: 'عدم اشتغال به خدمت سربازی',
      met: milMet,
      currentTextFa: milMet ? 'آزاد' : 'در حال خدمت',
      requiredTextFa: 'پایان خدمت یا معافیت',
      estimatedYears: milMet ? 0 : 2,
      actionTarget: milMet ? undefined : { type: 'military', labelFa: 'بخش خدمت' },
    });
  }

  // 4. Clean criminal record for public sector
  if (job.employerType === 'دولتی') {
    const cleanMet = player.criminalRecord === 0;
    checks.push({
      id: 'clean_record',
      labelFa: 'عدم سوءپیشینه (استخدام دولتی)',
      met: cleanMet,
      currentTextFa: cleanMet ? 'پاک' : `${toPersianDigits(player.criminalRecord)} سابقه`,
      requiredTextFa: 'سابقه پاک',
    });
  }

  // 5. Required license
  if (job.requiredLicenseId) {
    const licDef = dataset.businesses.licenses.find((l) => l.id === job.requiredLicenseId);
    const licMet = hasCredential(state, job.requiredLicenseId);
    const minWage = getMinWageMonthlyForState(state, dataset);
    const feeToman = licDef ? Math.round(minWage * licDef.feeMinWageMultiple) : 0;
    checks.push({
      id: `lic_${job.requiredLicenseId}`,
      labelFa: licDef?.titleFa ?? 'مجوز تخصصی',
      met: licMet,
      currentTextFa: licMet ? 'دارد' : 'ندارد',
      requiredTextFa: licDef?.titleFa ?? 'مجوز',
      costToman: licMet ? 0 : feeToman,
      estimatedYears: licMet ? 0 : 1,
      actionTarget: licMet
        ? undefined
        : { type: 'license', id: job.requiredLicenseId, labelFa: 'دریافت مجوز' },
    });
  }

  const unmet = checks.filter((c) => !c.met);
  const missingCount = unmet.length;
  const score =
    checks.length > 0 ? Math.round(((checks.length - missingCount) / checks.length) * 100) : 100;
  const eligible = missingCount === 0;
  const group: JobReadinessResult['group'] =
    eligible ? 'ready' : missingCount <= 2 ? 'near_ready' : 'future';

  // Build concise lock tag & 1-line gap summary
  let lockTagFa: string | undefined;
  let shortGapFa = 'همه پیش‌نیازها آماده است';
  if (unmet.length > 0) {
    const first = unmet[0];
    if (first.id === 'age_18') {
      lockTagFa = '🔒 سن ۱۸+';
    } else if (first.id.startsWith('edu_')) {
      lockTagFa = `🔒 نیاز: ${first.requiredTextFa}`;
    } else if (first.id.startsWith('lic_')) {
      lockTagFa = `🔒 نیاز: ${first.labelFa.replace('پروانه ', '').replace('گواهی‌نامه ', '')}`;
      if (lockTagFa.length > 24) lockTagFa = `🔒 نیاز: مجوز`;
    } else if (first.id === 'military_free') {
      lockTagFa = '🔒 در حال خدمت';
    } else {
      lockTagFa = '🔒 سابقه پاک';
    }

    const parts: string[] = [];
    const hasEduMissing = unmet.some((c) => c.id.startsWith('edu_'));
    const hasLicMissing = unmet.some((c) => c.id.startsWith('lic_'));
    const hasAgeMissing = unmet.some((c) => c.id === 'age_18');
    const hasMilMissing = unmet.some((c) => c.id === 'military_free');
    const hasRecordMissing = unmet.some((c) => c.id === 'clean_record');

    if (hasAgeMissing) {
      parts.push(`${toPersianDigits(Math.max(1, 18 - player.age))} سال تا ۱۸ سالگی`);
    }
    if (hasEduMissing) {
      parts.push(`مدرک ${EDUCATION_LABELS_FA[job.minEducation]}`);
    }
    if (hasLicMissing) {
      parts.push('۱ مجوز تخصصی');
    }
    if (hasMilMissing) {
      parts.push('پایان خدمت');
    }
    if (hasRecordMissing) {
      parts.push('محدودیت سوءپیشینه');
    }
    shortGapFa = parts.length > 0 ? `${parts.join(' و ')} مانده` : `${toPersianDigits(missingCount)} پیش‌نیاز مانده`;
  }

  const isCurrentJob = player.job?.jobId === job.id;
  const cdFlag = state.flags[`cd_apply_job_${job.id}`];
  const onCooldown = typeof cdFlag === 'number' && state.turn - cdFlag < 1;
  const isWaitlisted = ensureJobCompassState(state).waitlistedJobs.some(
    (w) => w.jobId === job.id,
  );
  const canApplyNow = eligible && !isCurrentJob && !onCooldown && !isWaitlisted;

  let blockedReason: string | undefined;
  if (isCurrentJob) blockedReason = 'هم‌اکنون در این شغل فعال هستی';
  else if (!eligible) blockedReason = unmet[0]?.labelFa ? `نیازمند ${unmet[0].labelFa}` : 'پیش‌نیازها کامل نیست';
  else if (isWaitlisted) blockedReason = 'پرونده در صف بررسی مصاحبه تا سال بعد است';
  else if (onCooldown) blockedReason = 'امسال درخواست داده‌ای؛ سال بعد دوباره تلاش کن';

  return {
    score,
    eligible,
    group,
    missingCount,
    checks,
    shortGapFa,
    lockTagFa,
    isCurrentJob,
    onCooldown,
    isWaitlisted,
    canApplyNow,
    blockedReason,
  };
}

export function jobGapSteps(
  state: GameState,
  job: JobDefinition,
  dataset: GameDataset,
): JobGapStep[] {
  const readiness = jobReadiness(state, job, dataset);
  const steps: JobGapStep[] = readiness.checks.map((chk) => ({
    id: chk.id,
    titleFa: chk.labelFa,
    subtitleFa: chk.met
      ? `تکمیل (${chk.currentTextFa})`
      : `فعلی: ${chk.currentTextFa} ← لازم: ${chk.requiredTextFa}${chk.costToman ? ` · هزینه ${formatToman(chk.costToman)}` : ''}`,
    done: chk.met,
    costToman: chk.costToman,
    estimatedYears: chk.estimatedYears,
    actionTarget: chk.actionTarget,
  }));

  if (job.requiredSkillId) {
    const skillDef = dataset.skills.find((s) => s.id === job.requiredSkillId);
    const level = getPlayerSkillLevel(state, job.requiredSkillId);
    if (skillDef) {
      steps.push({
        id: `skill_boost_${skillDef.id}`,
        titleFa: `تقویت مهارت «${skillDef.titleFa}» (توصیه‌شده)`,
        subtitleFa:
          level >= 2
            ? `سطح ${toPersianDigits(level)} · امتیاز مثبت در مصاحبه`
            : `سطح فعلی ${toPersianDigits(level)} · ارتقا تا سطح ۲ شانس پذیرش را بالا می‌برد`,
        done: level >= 2,
        costToman: level >= 2 ? 0 : skillDef.costToman,
        actionTarget:
          level >= 2
            ? undefined
            : { type: 'skill', id: skillDef.id, labelFa: 'تمرین مهارت' },
      });
    }
  }

  return steps;
}

export interface JobMatchResult {
  score: number; // 0..100
  explanationFa: string;
  talentMatched: boolean;
  talentMatchReasonFa?: string;
  topAxes: JobCompassAxis[];
  weakAxes: JobCompassAxis[];
}

export function jobMatch(
  prefs: JobCompassPriorities,
  job: JobDefinition,
  state: GameState,
  dataset: GameDataset,
): JobMatchResult {
  const fp = jobFingerprint(job, state, dataset);
  const weights: Record<JobCompassAxis, number> = {
    income: prefs.income,
    calm: prefs.calm,
    security: prefs.security,
    growth: prefs.growth,
    freedom: prefs.freedom,
  };
  const totalWeight =
    weights.income + weights.calm + weights.security + weights.growth + weights.freedom;
  const effectiveWeights: Record<JobCompassAxis, number> =
    totalWeight > 0
      ? weights
      : { income: 1, calm: 1, security: 1, growth: 1, freedom: 1 };
  const sumW =
    effectiveWeights.income +
    effectiveWeights.calm +
    effectiveWeights.security +
    effectiveWeights.growth +
    effectiveWeights.freedom;

  const weightedScore =
    (fp.income * effectiveWeights.income +
      fp.calm * effectiveWeights.calm +
      fp.security * effectiveWeights.security +
      fp.growth * effectiveWeights.growth +
      fp.freedom * effectiveWeights.freedom) /
    sumW;

  // Talent alignment check ONLY against discovered talents (so ⭐ badge is never unexplained)
  const affinityIds = JOB_TALENT_AFFINITY[job.id] ?? [];
  const matchedDiscovered = (state.player.discoveredTalents ?? []).find((dt) =>
    affinityIds.includes(dt.talentId),
  );
  const talentMatched = Boolean(matchedDiscovered);
  let talentMatchReasonFa: string | undefined;
  if (matchedDiscovered) {
    const tDef = dataset.talents.talents.find((t) => t.id === matchedDiscovered.talentId);
    talentMatchReasonFa = `همسو با استعداد کشف‌شده «${tDef?.titleFa ?? matchedDiscovered.talentId}»`;
  }

  const aptitudeBoost = matchedDiscovered ? 7 : 0;
  const skillBoost = job.requiredSkillId
    ? Math.min(5, getPlayerSkillLevel(state, job.requiredSkillId) * 1.5)
    : 0;
  const finalScore = clamp100(weightedScore + aptitudeBoost + skillBoost);

  // Rank axes by weighted contribution
  const axisContributions = JOB_COMPASS_AXES.map((a) => ({
    key: a.key,
    labelFa: a.labelFa,
    val: fp[a.key],
    weight: effectiveWeights[a.key],
  })).sort((a, b) => b.val * (b.weight + 0.5) - a.val * (a.weight + 0.5));

  const topAxes = axisContributions.slice(0, 2).map((a) => a.key);
  const weakAxes = [...axisContributions]
    .sort((a, b) => a.val - b.val)
    .slice(0, 1)
    .map((a) => a.key);

  const highPriorities = JOB_COMPASS_AXES.filter((a) => effectiveWeights[a.key] >= 2);
  const topHigh = highPriorities
    .filter((a) => fp[a.key] >= 62)
    .map((a) => a.labelFa);
  const lowHigh = highPriorities
    .filter((a) => fp[a.key] < 45)
    .map((a) => a.labelFa);

  let explanationFa = '';
  if (topHigh.length > 0 && lowHigh.length > 0) {
    explanationFa = `در ${topHigh.slice(0, 2).join(' و ')} هم‌سو با اولویت توست، اما در ${lowHigh[0]} پایین‌تر از انتظار است.`;
  } else if (topHigh.length >= 2) {
    explanationFa = `در ${topHigh.slice(0, 2).join(' و ')} دقیقاً هم‌راستای اولویت‌های الان توست${talentMatched ? ' و با استعدادت هم می‌خواند.' : '.'}`;
  } else if (finalScore >= 65) {
    explanationFa = `ترکیب متعادلی از ${axisContributions[0].labelFa} و ${axisContributions[1].labelFa} برای شرایط فعلی تو دارد.`;
  } else {
    const weakestLabel =
      JOB_COMPASS_AXES.find((a) => a.key === weakAxes[0])?.labelFa ?? 'آرامش';
    explanationFa = `برای اولویت‌های فعلی تو در محور «${weakestLabel}» نمره کمتری می‌گیرد.`;
  }

  return {
    score: finalScore,
    explanationFa,
    talentMatched,
    talentMatchReasonFa,
    topAxes,
    weakAxes,
  };
}

export function estimateJobSuccessChance(
  job: JobDefinition,
  state: GameState,
  dataset: GameDataset,
): {
  baseChancePct: number;
  factors: { labelFa: string; deltaTextFa: string; positive: boolean }[];
} {
  const base = job.baseSuccessChance ?? 0.7;
  const intelDiff = state.player.stats.intelligence - 50;
  const intelBonus = intelDiff * 0.003;
  const skillLevel = job.requiredSkillId ? getPlayerSkillLevel(state, job.requiredSkillId) : 0;
  const skillBonus = skillLevel * 0.06;
  const city = dataset.cities.find((c) => c.id === state.player.currentCityId);
  const cityBonus = city ? (city.jobOpportunityIndex - 1) * 0.1 : 0;

  const totalPct = Math.round(
    Math.max(12, Math.min(96, (base + intelBonus + skillBonus + cityBonus) * 100)),
  );

  const factors: { labelFa: string; deltaTextFa: string; positive: boolean }[] = [
    {
      labelFa: 'پذیرش پایه این شغل',
      deltaTextFa: `${toPersianDigits(Math.round(base * 100))}٪`,
      positive: true,
    },
  ];
  if (Math.round(intelBonus * 100) !== 0) {
    const d = Math.round(intelBonus * 100);
    factors.push({
      labelFa: 'هوش و آمادگی ذهنی',
      deltaTextFa: `${d > 0 ? '+' : ''}${toPersianDigits(d)}٪`,
      positive: d > 0,
    });
  }
  if (job.requiredSkillId) {
    const skillName =
      dataset.skills.find((s) => s.id === job.requiredSkillId)?.titleFa ?? 'مهارت مرتبط';
    const d = Math.round(skillBonus * 100);
    factors.push({
      labelFa: `مهارت «${skillName}» (سطح ${toPersianDigits(skillLevel)})`,
      deltaTextFa: d > 0 ? `+${toPersianDigits(d)}٪` : '۰٪',
      positive: d > 0,
    });
  }
  if (city && Math.round(cityBonus * 100) !== 0) {
    const d = Math.round(cityBonus * 100);
    factors.push({
      labelFa: `بازار کار شهر ${city.nameFa}`,
      deltaTextFa: `${d > 0 ? '+' : ''}${toPersianDigits(d)}٪`,
      positive: d > 0,
    });
  }

  return { baseChancePct: totalPct, factors };
}

export function pickInterviewQuestionsForJob(
  jobId: string,
  state: GameState,
  dataset: GameDataset,
): InterviewQuestion[] {
  const specific = dataset.interviews.byJobId[jobId] ?? [];
  const general = dataset.interviews.generalQuestions;
  const rng = new SeededRNG(`iq:${jobId}:${state.turn}:${state.player.age}`);
  const pickedGeneral = [...general].sort(() => rng.float(-1, 1)).slice(0, 2);
  return [...specific.slice(0, 1), ...pickedGeneral].slice(0, 3);
}

export type JobMarketSortMode = 'match' | 'salary' | 'readiness';
export type JobEmployerFilter = 'all' | 'دولتی' | 'خصوصی' | 'آزاد' | 'خانوادگی';

export interface JobMarketItem {
  job: JobDefinition;
  salary: JobSalaryRangeInfo;
  fingerprint: ComputedJobFingerprint;
  readiness: JobReadinessResult;
  match: JobMatchResult;
  gapSteps: JobGapStep[];
  chanceInfo: ReturnType<typeof estimateJobSuccessChance>;
}

export interface JobMarketListingsResult {
  allItems: JobMarketItem[];
  ready: JobMarketItem[];
  nearReady: JobMarketItem[];
  future: JobMarketItem[];
  totalCount: number;
}

export function getJobMarketListings(
  state: GameState,
  dataset: GameDataset,
  options: {
    priorities?: JobCompassPriorities;
    searchQuery?: string;
    employerFilter?: JobEmployerFilter;
    sortBy?: JobMarketSortMode;
    eligibleOnly?: boolean;
  } = {},
): JobMarketListingsResult {
  const compass = ensureJobCompassState(state);
  const prefs = options.priorities ?? compass.priorities;
  const query = (options.searchQuery ?? '').trim().toLowerCase();
  const employer = options.employerFilter ?? 'all';
  const sortBy = options.sortBy ?? 'match';

  const items: JobMarketItem[] = dataset.jobs
    .filter((job) => {
      if (employer !== 'all' && (job.employerType ?? 'خصوصی') !== employer) return false;
      if (query) {
        const hay = `${job.shortTitle} ${job.titleFa} ${job.tagline ?? ''} ${job.tags.map((t) => t.labelFa).join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .map((job) => {
      const salary = jobSalaryRange(job, state, dataset);
      const fingerprint = jobFingerprint(job, state, dataset);
      const readiness = jobReadiness(state, job, dataset);
      const match = jobMatch(prefs, job, state, dataset);
      const gapSteps = jobGapSteps(state, job, dataset);
      const chanceInfo = estimateJobSuccessChance(job, state, dataset);
      return { job, salary, fingerprint, readiness, match, gapSteps, chanceInfo };
    })
    .filter((item) => (options.eligibleOnly ? item.readiness.eligible : true));

  const sortFn = (a: JobMarketItem, b: JobMarketItem): number => {
    if (sortBy === 'salary') {
      const diff = b.salary.expectedMonthlyNet - a.salary.expectedMonthlyNet;
      if (diff !== 0) return diff;
    } else if (sortBy === 'readiness') {
      const diff = b.readiness.score - a.readiness.score;
      if (diff !== 0) return diff;
      const mDiff = b.match.score - a.match.score;
      if (mDiff !== 0) return mDiff;
    } else {
      const diff = b.match.score - a.match.score;
      if (diff !== 0) return diff;
      const rDiff = b.readiness.score - a.readiness.score;
      if (rDiff !== 0) return rDiff;
    }
    return a.job.id.localeCompare(b.job.id);
  };

  const ready = items.filter((i) => i.readiness.group === 'ready').sort(sortFn);
  const nearReady = items.filter((i) => i.readiness.group === 'near_ready').sort(sortFn);
  const future = items.filter((i) => i.readiness.group === 'future').sort(sortFn);

  return {
    allItems: [...ready, ...nearReady, ...future],
    ready,
    nearReady,
    future,
    totalCount: items.length,
  };
}

export function getRequirementSummaryForJob(
  state: GameState,
  job: JobDefinition,
  dataset: GameDataset,
): string {
  const readiness = jobReadiness(state, job, dataset);
  if (readiness.eligible) return 'همه شرایط ورود را داری';
  const unmet = readiness.checks.filter((c) => !c.met);
  return unmet.map((u) => `${u.labelFa}: ${u.requiredTextFa}`).join(' · ');
}

export function getWorkHistoryCountEstimate(state: GameState): number {
  const raw = state.flags['hist_work'];
  if (typeof raw !== 'string') return 0;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export function getCredentialShortLabel(credId: string, dataset: GameDataset): string {
  return getCredentialLabelFa(credId, dataset);
}

export function clampChancePct(v: number): number {
  return Math.max(8, Math.min(97, Math.round(v)));
}

export function resolveWaitlistedJobsOnYearAdvance(
  state: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): string[] {
  if (!state.jobCompass || state.jobCompass.waitlistedJobs.length === 0) {
    return [];
  }
  const notes: string[] = [];
  const remaining = [];
  for (const entry of state.jobCompass.waitlistedJobs) {
    const job = dataset.jobs.find((j) => j.id === entry.jobId);
    if (!job) continue;
    const readiness = jobReadiness(state, job, dataset);
    if (!readiness.eligible) continue;
    // Only auto-hire if player does not currently hold this job; if unemployed or user can accept if unemployed
    const base = estimateJobSuccessChance(job, state, dataset).baseChancePct;
    const finalChance = clampChancePct(base + entry.interviewBonusPct + 6);
    if (!state.player.job && rng.chance(finalChance / 100)) {
      const level1 = job.ladder[0];
      const breakdown = calculateJobAnnualIncomeBreakdown({
        job,
        level: 1,
        state,
        dataset,
        positionOverride01: 0.35,
      });
      state.player.job = {
        jobId: job.id,
        title: `${job.titleFa} (${level1.titleFa})`,
        track: job.track,
        level: 1,
        annualSalaryToman: breakdown.netAnnual,
        stress: job.stress,
        yearsInJob: 0,
      };
      state.flags['job_years_in_role'] = 0;
      state.flags['last_job_gross'] = breakdown.grossAnnual;
      state.flags['last_job_net'] = breakdown.netAnnual;
      state.flags['last_job_deductions'] =
        breakdown.commission + breakdown.runningCosts + breakdown.bimeh + breakdown.incomeTax;
      state.flags['retired'] = false;
      notes.push(
        `پرونده «${job.shortTitle}» از فهرست انتظار تأیید شد و با خالص ${formatToman(Math.round(breakdown.netAnnual / 12))} در ماه مشغول به کار شدی.`,
      );
    } else if (state.turn - entry.appliedTurn >= 2) {
      notes.push(`فهرست انتظار شغل «${job.shortTitle}» بدون جایگاه خالی جدید بسته شد.`);
    } else {
      remaining.push(entry);
    }
  }
  state.jobCompass.waitlistedJobs = remaining;
  return notes;
}
