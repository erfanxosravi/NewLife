import type { GameDataset } from '../data/registry';
import { calculateJobAnnualIncomeBreakdown, getMinWageMonthlyForState } from './economy';
import { toPersianDigits } from './jalali';
import type { SeededRNG } from './rng';
import type {
  EducationLevel,
  GameState,
  JobDefinition,
  JobLadderStep,
  LicenseDefinition,
} from './types';

export const EDUCATION_RANK_ORDER: Record<EducationLevel, number> = {
  none: 0,
  preschool: 1,
  elementary: 2,
  middle_school: 3,
  high_school: 4,
  diploma: 5,
  associate: 6,
  bachelor: 7,
  master: 8,
  phd: 9,
  medical_doctor: 9,
};

export function meetsMinEducation(current: EducationLevel, required: EducationLevel): boolean {
  return EDUCATION_RANK_ORDER[current] >= EDUCATION_RANK_ORDER[required];
}

export function getSkillLevelsFromFlags(state: GameState): Record<string, number> {
  const raw = state.flags['skills_json'];
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getPlayerSkillLevel(state: GameState, skillId?: string): number {
  if (!skillId) return 0;
  const map = getSkillLevelsFromFlags(state);
  return typeof map[skillId] === 'number' ? map[skillId] : 0;
}

export function getYearsInCurrentRole(state: GameState): number {
  const raw = state.flags['job_years_in_role'];
  if (typeof raw === 'number' && raw >= 0) {
    return raw;
  }
  return state.player.job?.yearsInJob ?? 0;
}

export function getTrackExperienceYears(state: GameState, track: string): number {
  const flagVal = state.flags[`track_exp_${track}`];
  const stored = typeof flagVal === 'number' && flagVal >= 0 ? flagVal : 0;
  const currentActive =
    state.player.job && state.player.job.track === track ? state.player.job.yearsInJob : 0;
  return Math.max(stored, currentActive);
}

export function computeJobPerformance(state: GameState, jobDef: JobDefinition): number {
  const { player } = state;
  const skillLevel = getPlayerSkillLevel(state, jobDef.requiredSkillId);
  const yearsInJob = player.job?.yearsInJob ?? 0;
  const overtimeBoost = state.flags['career_overtime_boost'] === state.turn ? 6 : 0;
  const score =
    28 +
    player.stats.intelligence * 0.28 +
    player.hiddenStats.conscientiousness * 0.24 +
    skillLevel * 4.5 +
    Math.min(12, yearsInJob * 1.4) +
    overtimeBoost -
    Math.min(10, Math.max(0, 40 - player.stats.mentalHealth) * 0.25);
  return Math.max(10, Math.min(100, Math.round(score)));
}

export function hasCredential(state: GameState, credentialId?: string): boolean {
  if (!credentialId) return true;
  if (credentialId === 'edu_bachelor') {
    return meetsMinEducation(state.player.education.level, 'bachelor');
  }
  if (credentialId === 'edu_master') {
    return meetsMinEducation(state.player.education.level, 'master');
  }
  if (credentialId === 'edu_phd') {
    return meetsMinEducation(state.player.education.level, 'phd');
  }
  return (state.player.licenses ?? []).includes(credentialId);
}

export function getCredentialLabelFa(credentialId: string, dataset: GameDataset): string {
  if (credentialId === 'edu_bachelor') return 'مدرک کارشناسی یا بالاتر';
  if (credentialId === 'edu_master') return 'مدرک کارشناسی ارشد یا بالاتر';
  if (credentialId === 'edu_phd') return 'مدرک دکتری';
  const lic = dataset.businesses.licenses.find((l) => l.id === credentialId);
  return lic?.titleFa ?? credentialId;
}

export function getCurrentLadderStep(jobDef: JobDefinition, level: number): JobLadderStep {
  return (
    jobDef.ladder.find((s) => s.level === level) ??
    jobDef.ladder[Math.min(Math.max(0, level - 1), jobDef.ladder.length - 1)] ??
    jobDef.ladder[0]
  );
}

export function getNextLadderStep(jobDef: JobDefinition, level: number): JobLadderStep | null {
  const current = getCurrentLadderStep(jobDef, level);
  if (current.ceiling) return null;
  return jobDef.ladder.find((s) => s.level === current.level + 1) ?? null;
}

export function isAtCareerCeiling(jobDef: JobDefinition, level: number): boolean {
  const current = getCurrentLadderStep(jobDef, level);
  return Boolean(jobDef.noPromotions || current.ceiling || !getNextLadderStep(jobDef, level));
}

export interface PromotionRequirementCheck {
  id: string;
  labelFa: string;
  met: boolean;
  currentTextFa: string;
  requiredTextFa: string;
}

export interface PromotionEligibility {
  atCeiling: boolean;
  noPromotions: boolean;
  eligible: boolean;
  currentStep: JobLadderStep;
  nextStep: JobLadderStep | null;
  performance: number;
  yearsInRole: number;
  totalExperience: number;
  skillLevel: number;
  checks: PromotionRequirementCheck[];
  estimatedChancePct: number;
  blockedReason?: string;
}

export function checkPromotionEligibility(
  state: GameState,
  jobDef: JobDefinition,
  dataset: GameDataset,
): PromotionEligibility {
  const currentLevel = state.player.job?.level ?? 1;
  const currentStep = getCurrentLadderStep(jobDef, currentLevel);
  const nextStep = getNextLadderStep(jobDef, currentLevel);
  const performance = computeJobPerformance(state, jobDef);
  const yearsInRole = getYearsInCurrentRole(state);
  const totalExperience = Math.max(
    state.player.job?.yearsInJob ?? 0,
    getTrackExperienceYears(state, jobDef.track),
  );
  const skillLevel = getPlayerSkillLevel(state, jobDef.requiredSkillId);

  if (jobDef.noPromotions || currentStep.ceiling || !nextStep) {
    return {
      atCeiling: true,
      noPromotions: Boolean(jobDef.noPromotions),
      eligible: false,
      currentStep,
      nextStep: null,
      performance,
      yearsInRole,
      totalExperience,
      skillLevel,
      checks: [],
      estimatedChancePct: 0,
      blockedReason: jobDef.noPromotions
        ? 'این شغل ساختار ترفیع اداری ندارد؛ افزایش درآمد از مسیر ساعت کار یا تأسیس ناوگان است.'
        : 'به سقف مسیر کارمندی رسیده‌ای؛ ارتقای بیشتر مالکیت نمی‌آورد.',
    };
  }

  const checks: PromotionRequirementCheck[] = [
    {
      id: 'years_in_role',
      labelFa: 'سابقه در رده فعلی',
      met: yearsInRole >= nextStep.minYearsInRole,
      currentTextFa: `${toPersianDigits(yearsInRole)} سال`,
      requiredTextFa: `${toPersianDigits(nextStep.minYearsInRole)} سال`,
    },
    {
      id: 'total_exp',
      labelFa: 'سابقه کل مسیر شغلی',
      met: totalExperience >= nextStep.minTotalExperience,
      currentTextFa: `${toPersianDigits(totalExperience)} سال`,
      requiredTextFa: `${toPersianDigits(nextStep.minTotalExperience)} سال`,
    },
    {
      id: 'performance',
      labelFa: 'ارزیابی عملکرد',
      met: performance >= nextStep.minPerformance,
      currentTextFa: `${toPersianDigits(performance)} از ۱۰۰`,
      requiredTextFa: `${toPersianDigits(nextStep.minPerformance)} از ۱۰۰`,
    },
  ];

  if (nextStep.minSkillLevel > 0) {
    const skillName =
      dataset.skills.find((s) => s.id === jobDef.requiredSkillId)?.titleFa ?? 'مهارت تخصصی';
    checks.push({
      id: 'skill',
      labelFa: skillName,
      met: skillLevel >= nextStep.minSkillLevel,
      currentTextFa: `سطح ${toPersianDigits(skillLevel)}`,
      requiredTextFa: `سطح ${toPersianDigits(nextStep.minSkillLevel)}`,
    });
  }

  if (nextStep.requiredCredential) {
    const credLabel = getCredentialLabelFa(nextStep.requiredCredential, dataset);
    const hasCred = hasCredential(state, nextStep.requiredCredential);
    checks.push({
      id: 'credential',
      labelFa: 'مدرک یا مجوز لازم',
      met: hasCred,
      currentTextFa: hasCred ? 'دارد' : 'ندارد',
      requiredTextFa: credLabel,
    });
  }

  if (nextStep.requiresConnections) {
    const bizSkill = getPlayerSkillLevel(state, 'business');
    const hasConnections = state.player.stats.fame >= 20 || bizSkill >= 2;
    checks.push({
      id: 'connections',
      labelFa: 'اعتبار حرفه‌ای و ارتباطات',
      met: hasConnections,
      currentTextFa: hasConnections ? 'کافی' : 'محدود',
      requiredTextFa: 'جایگاه اجتماعی ۲۰+ یا مهارت مدیریت ۲+',
    });
  }

  const unmet = checks.filter((c) => !c.met);
  const perfBonus = Math.max(0, (performance - nextStep.minPerformance) * 0.004);
  const luckBonus = (state.player.hiddenStats.luck - 50) * 0.002;
  const chance = Math.max(0.08, Math.min(0.92, nextStep.promotionBaseChance + perfBonus + luckBonus));

  return {
    atCeiling: false,
    noPromotions: false,
    eligible: unmet.length === 0,
    currentStep,
    nextStep,
    performance,
    yearsInRole,
    totalExperience,
    skillLevel,
    checks,
    estimatedChancePct: Math.round(chance * 100),
    blockedReason:
      unmet.length > 0
        ? `شرط «${unmet[0].labelFa}» هنوز کامل نیست (${unmet[0].currentTextFa} از ${unmet[0].requiredTextFa})`
        : undefined,
  };
}

export interface PromotionExecutionResult {
  promoted: boolean;
  salaryRaisedOnly: boolean;
  newLevel: number;
  newTitleFa: string;
  newAnnualSalaryToman: number;
  reasonFa: string;
}

export function evaluateEmployeePromotionOrRaise(params: {
  state: GameState;
  jobDef: JobDefinition;
  rng: SeededRNG;
  dataset: GameDataset;
}): PromotionExecutionResult {
  const { state, jobDef, rng, dataset } = params;
  const currentJob = state.player.job!;
  const eligibility = checkPromotionEligibility(state, jobDef, dataset);
  const raiseMult = dataset.economy.baseline1405.policyAndModel.raiseMultiplier.value;

  const capAtCurrent = calculateJobAnnualIncomeBreakdown({
    job: jobDef,
    level: currentJob.level,
    state,
    dataset,
    positionOverride01: 1,
  }).netAnnual;

  // If eligible for next ladder step, roll promotion chance (NEVER grants ownership)
  if (eligibility.eligible && eligibility.nextStep && !eligibility.atCeiling) {
    if (rng.chance(eligibility.estimatedChancePct / 100)) {
      const nextStep = eligibility.nextStep;
      const maxAtNext = calculateJobAnnualIncomeBreakdown({
        job: jobDef,
        level: nextStep.level,
        state,
        dataset,
        positionOverride01: 0.92,
      }).netAnnual;
      const baseAtNext = Math.round(
        currentJob.annualSalaryToman *
          (nextStep.salaryMultiplier / Math.max(0.5, eligibility.currentStep.salaryMultiplier)),
      );
      const nextSalary = Math.min(
        maxAtNext,
        Math.max(Math.round(currentJob.annualSalaryToman * 1.12), baseAtNext),
      );
      return {
        promoted: true,
        salaryRaisedOnly: false,
        newLevel: nextStep.level,
        newTitleFa: `${jobDef.titleFa} (${nextStep.titleFa})`,
        newAnnualSalaryToman: nextSalary,
        reasonFa: `به رده «${nextStep.titleFa}» ارتقا پیدا کردی.`,
      };
    }

    return {
      promoted: false,
      salaryRaisedOnly: false,
      newLevel: currentJob.level,
      newTitleFa: currentJob.title,
      newAnnualSalaryToman: currentJob.annualSalaryToman,
      reasonFa: `در ارزیابی امسال، ارتقا به «${eligibility.nextStep.titleFa}» به تأخیر افتاد.`,
    };
  }

  // At ceiling or blocked from next rank: only modest salary raise within current rank cap (never advances level!)
  if (currentJob.annualSalaryToman < Math.round(capAtCurrent * 0.96) && rng.chance(0.52)) {
    const bumped = Math.min(capAtCurrent, Math.round(currentJob.annualSalaryToman * raiseMult));
    return {
      promoted: false,
      salaryRaisedOnly: true,
      newLevel: currentJob.level,
      newTitleFa: currentJob.title,
      newAnnualSalaryToman: bumped,
      reasonFa: eligibility.atCeiling
        ? 'در سقف رده استخدامی هستی؛ حقوقت در همان جایگاه تعدیل شد.'
        : 'ترفیع رده هنوز باز نیست، اما حقوق فعلی‌ات افزایش پیدا کرد.',
    };
  }

  return {
    promoted: false,
    salaryRaisedOnly: false,
    newLevel: currentJob.level,
    newTitleFa: currentJob.title,
    newAnnualSalaryToman: currentJob.annualSalaryToman,
    reasonFa:
      eligibility.blockedReason ??
      'امسال امکان ارتقا یا افزایش حقوق بیشتر در این جایگاه فراهم نشد.',
  };
}

export interface LicenseStatus {
  license: LicenseDefinition;
  owned: boolean;
  eligible: boolean;
  feeToman: number;
  missingReasons: string[];
}

export function getLicenseStatus(
  license: LicenseDefinition,
  state: GameState,
  dataset: GameDataset,
): LicenseStatus {
  const owned = (state.player.licenses ?? []).includes(license.id);
  const minWage = getMinWageMonthlyForState(state, dataset);
  const feeToman = Math.round(minWage * license.feeMinWageMultiple);
  const missingReasons: string[] = [];

  if (state.player.age < license.minAge) {
    missingReasons.push(`حداقل سن ${toPersianDigits(license.minAge)} سال`);
  }
  if (!meetsMinEducation(state.player.education.level, license.minEducation)) {
    missingReasons.push('مدرک تحصیلی لازم کامل نیست');
  }
  if (license.requiredSkillId && license.minSkillLevel) {
    const level = getPlayerSkillLevel(state, license.requiredSkillId);
    if (level < license.minSkillLevel) {
      const skillTitle =
        dataset.skills.find((s) => s.id === license.requiredSkillId)?.titleFa ?? 'مهارت';
      missingReasons.push(
        `نیاز به سطح ${toPersianDigits(license.minSkillLevel)} در «${skillTitle}»`,
      );
    }
  }
  if (license.examMinIntelligence && state.player.stats.intelligence < license.examMinIntelligence) {
    missingReasons.push(
      `آمادگی علمی/هوش حداقل ${toPersianDigits(license.examMinIntelligence)} برای آزمون`,
    );
  }
  if (state.player.moneyToman < feeToman) {
    missingReasons.push('موجودی نقدی برای هزینه صدور و آزمون کافی نیست');
  }

  return {
    license,
    owned,
    eligible: !owned && missingReasons.length === 0,
    feeToman,
    missingReasons,
  };
}
