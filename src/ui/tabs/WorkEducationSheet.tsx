import { useMemo, useRef, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import { formatSpecialRouteChoiceSummary } from '../../engine/talents';
import type {
  HighSchoolTrack,
  JobDefinition,
  SaveGame,
  SpecialCareerRouteId,
  UniversityTier,
} from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  applyForJobAction,
  changeWorkplaceAction,
  developTalentAction,
  enrollUniversityAction,
  enterSpecialFallbackCareerAction,
  performCareerAction,
  performStudyAction,
  pursueSpecialCareerAction,
  selectHighSchoolTrackAction,
  selectMilitaryOptionAction,
  setStudyEffortAction,
  takeKonkurAction,
  trainSkillAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  formatUsdEquivalentHint,
  getActionCooldownRemaining,
  getCurrentJobPromotionState,
  getEducationHistory,
  getJobApplicationStatus,
  getKonkurFeeToman,
  getMilitaryBuyoutCostToman,
  getQualitativeSkillLabelFa,
  getSkillLevel,
  getSkillTrainingCost,
  getSpecialCareerCards,
  getStudyEffort,
  getTalentPracticeOptions,
  getTutorCostToman,
  getUniversityTuitionToman,
  getWorkHistory,
} from '../../state/selectors';
import { CareerOwnershipPanel } from '../components/CareerOwnershipPanel';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  CurrencyText,
  EmptyState,
  FilterChips,
  LockedNotice,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  Slider,
} from '../components/Primitives';
import { IconCareerEdu, IconEducation, IconShield, IconSkill } from '../icons';

interface WorkEducationSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onEffortChange: (nextSave: SaveGame) => void;
}

type SubTab = 'education' | 'career' | 'skills' | 'military';
type JobFilter = 'all' | 'دولتی' | 'خصوصی' | 'آزاد' | 'خانوادگی';

const TRACK_INFO: {
  id: HighSchoolTrack;
  label: string;
  focus: string;
  jobs: string;
}[] = [
  { id: 'math', label: 'ریاضی و فیزیک', focus: 'تحلیل و مهندسی', jobs: 'نرم‌افزار، فنی، مدیریت' },
  { id: 'science', label: 'علوم تجربی', focus: 'زیست و علوم پایه', jobs: 'پزشکی، پرستاری، آزمایشگاه' },
  { id: 'humanities', label: 'علوم انسانی', focus: 'ادبیات، حقوق و آموزش', jobs: 'تدریس، اداری، بازرگانی' },
  { id: 'vocational', label: 'فنی و حرفه‌ای', focus: 'مهارت عملی و بازار کار', jobs: 'کسب‌وکار، فنون و خدمات' },
];

const UNI_OFFERS: {
  tier: UniversityTier;
  tierLabel: string;
  majorFa: string;
  degree: 'associate' | 'bachelor' | 'medical_doctor';
  years: number;
  maxRank: number;
}[] = [
  {
    tier: 'state_top',
    tierLabel: 'دولتی برتر (روزانه)',
    majorFa: 'مهندسی کامپیوتر',
    degree: 'bachelor',
    years: 4,
    maxRank: 4000,
  },
  {
    tier: 'state_top',
    tierLabel: 'دولتی برتر (روزانه)',
    majorFa: 'پزشکی عمومی',
    degree: 'medical_doctor',
    years: 7,
    maxRank: 2500,
  },
  {
    tier: 'state_top',
    tierLabel: 'دولتی برتر (روزانه)',
    majorFa: 'داروسازی',
    degree: 'medical_doctor',
    years: 6,
    maxRank: 3500,
  },
  {
    tier: 'state',
    tierLabel: 'دانشگاه دولتی',
    majorFa: 'حقوق',
    degree: 'bachelor',
    years: 4,
    maxRank: 18000,
  },
  {
    tier: 'state',
    tierLabel: 'دانشگاه دولتی',
    majorFa: 'مدیریت و اقتصاد',
    degree: 'bachelor',
    years: 4,
    maxRank: 22000,
  },
  {
    tier: 'azad',
    tierLabel: 'دانشگاه آزاد',
    majorFa: 'مهندسی یا حقوق',
    degree: 'bachelor',
    years: 4,
    maxRank: 150000,
  },
  {
    tier: 'applied_science',
    tierLabel: 'علمی‌کاربردی',
    majorFa: 'کاردانی مهارتی',
    degree: 'associate',
    years: 2,
    maxRank: 200000,
  },
];

export function WorkEducationSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
  onEffortChange,
}: WorkEducationSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;
  const showMilitary = player.gender === 'male' && player.age >= 17;

  const [subTab, setSubTab] = useState<SubTab>(player.age < 18 ? 'education' : 'career');
  const [jobFilter, setJobFilter] = useState<JobFilter>('all');
  const [talentFilter, setTalentFilter] = useState<'discovered' | 'all'>('all');
  const [specialFilter, setSpecialFilter] = useState<'ready' | 'all'>('all');
  const [selectedRoutes, setSelectedRoutes] = useState<Record<string, SpecialCareerRouteId>>({});
  const [confirmQuitMode, setConfirmQuitMode] = useState<'quit' | 'retire' | null>(null);
  const [ownershipFlowOpen, setOwnershipFlowOpen] = useState<boolean>(false);
  const [preferredBizTypeId, setPreferredBizTypeId] = useState<string | undefined>(undefined);
  const jobBoardRef = useRef<HTMLDivElement | null>(null);
  const ownershipRef = useRef<HTMLDivElement | null>(null);

  const studyEffort = getStudyEffort(state);
  const eduHistory = getEducationHistory(state);
  const workHistory = getWorkHistory(state);
  const promotionState = useMemo(
    () => getCurrentJobPromotionState(state, gameDataset),
    [state],
  );
  const talentOptions = useMemo(
    () => getTalentPracticeOptions(state, gameDataset),
    [state],
  );
  const specialCareerCards = useMemo(
    () => getSpecialCareerCards(state, gameDataset),
    [state],
  );

  const tabItems = useMemo(() => {
    const base: { value: SubTab; label: string }[] = [
      { value: 'education', label: t('tabs.education') },
      { value: 'career', label: t('tabs.career') },
      { value: 'skills', label: t('tabs.skills') },
    ];
    if (showMilitary) {
      base.push({ value: 'military', label: t('tabs.military') });
    }
    return base;
  }, [showMilitary, t]);

  const filteredJobs = useMemo(() => {
    if (jobFilter === 'all') return gameDataset.jobs;
    return gameDataset.jobs.filter((j) => (j.employerType ?? 'خصوصی') === jobFilter);
  }, [jobFilter]);

  const currentStageLabel = t(`education.stageLabels.${player.education.level}`);
  const tutorCost = getTutorCostToman(state, gameDataset);
  const konkurFee = getKonkurFeeToman(state, gameDataset);
  const buyoutCost = getMilitaryBuyoutCostToman(state, gameDataset);
  const uniYearsLeft =
    typeof state.flags['uni_years_left'] === 'number' ? state.flags['uni_years_left'] : 0;
  const lastJobGross =
    typeof state.flags['last_job_gross'] === 'number' ? state.flags['last_job_gross'] : null;
  const lastJobDeductions =
    typeof state.flags['last_job_deductions'] === 'number'
      ? state.flags['last_job_deductions']
      : null;

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.workEducation')}
      subtitle={`${player.firstName} ${player.lastName} · ${currentStageLabel}`}
    >
      <div className="space-y-4">
        <SegmentedControl
          value={subTab === 'military' && !showMilitary ? 'career' : subTab}
          onChange={setSubTab}
          items={tabItems}
        />

        {/* 1. EDUCATION TAB */}
        {subTab === 'education' && (
          <div className="space-y-3.5">
            <Card className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <IconEducation className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-bold">{currentStageLabel}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {player.education.inSchool
                    ? uniYearsLeft > 0
                      ? `${player.education.major ?? 'دانشجو'} · ${toPersianDigits(uniYearsLeft)} سال تا فراغت`
                      : 'در حال تحصیل در مدرسه'
                    : 'در حال حاضر دانش‌آموز یا دانشجو نیستی'}
                </p>
                {player.education.highSchoolTrack && (
                  <Badge tone="primary">
                    رشته: {t(`education.trackLabels.${player.education.highSchoolTrack}`)}
                  </Badge>
                )}
              </div>
              <ProgressRing
                value={player.education.gpa}
                max={20}
                label={toPersianDigits(player.education.gpa.toFixed(1))}
                colorVar="--stat-smarts"
              />
            </Card>

            {player.age < 7 ? (
              <LockedNotice message="تحصیل رسمی از ۷ سالگی با ورود به دبستان آغاز می‌شود." />
            ) : (
              <>
                {player.education.inSchool && (
                  <Card className="space-y-3">
                    <Slider
                      label={t('education.studyEffort')}
                      value={studyEffort}
                      minLabel="آرام"
                      maxLabel="فشرده"
                      valueLabel={`${toPersianDigits(studyEffort)}٪`}
                      onChange={(val) => onEffortChange(setStudyEffortAction(saveGame, val))}
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {studyEffort >= 75
                        ? 'تلاش بالا: شانس معدل عالی و قبولی کنکور بیشتر، فشار روانی کمی بالاتر.'
                        : studyEffort <= 35
                          ? 'تلاش کم: فشار روانی کمتر، اما افت معدل و شانس کمتر در آزمون‌ها.'
                          : 'تعادل مناسب بین یادگیری و آرامش.'}
                    </p>

                    <div className="space-y-2">
                      <ActionButton
                        label="مطالعه جدی و مرور درس‌ها"
                        costText="رایگان"
                        effectHint="هوش +۴ · معدل بالاتر · سلامت روان -۳"
                        disabled={getActionCooldownRemaining(state, 'edu_study_hard') > 0}
                        disabledReason={
                          getActionCooldownRemaining(state, 'edu_study_hard') > 0
                            ? 'فقط یک بار در سال'
                            : undefined
                        }
                        onClick={() =>
                          onUpdateSave(performStudyAction(saveGame, 'study_hard', gameDataset))
                        }
                      />
                      <ActionButton
                        label="کلاس تقویتی و معلم خصوصی"
                        costText={formatToman(tutorCost)}
                        effectHint="هوش +۶ · جهش معدل"
                        variant="secondary"
                        disabled={
                          getActionCooldownRemaining(state, 'edu_tutor') > 0 ||
                          player.moneyToman < tutorCost
                        }
                        disabledReason={
                          getActionCooldownRemaining(state, 'edu_tutor') > 0
                            ? 'فقط یک بار در سال'
                            : player.moneyToman < tutorCost
                              ? 'موجودی کافی نیست'
                              : undefined
                        }
                        onClick={() =>
                          onUpdateSave(performStudyAction(saveGame, 'tutor', gameDataset))
                        }
                      />
                      <ActionButton
                        label="کمی فاصله گرفتن از کتاب"
                        costText="رایگان"
                        effectHint="شادی +۵ · افت جزئی معدل"
                        variant="secondary"
                        disabled={getActionCooldownRemaining(state, 'edu_skip') > 0}
                        disabledReason={
                          getActionCooldownRemaining(state, 'edu_skip') > 0
                            ? 'فقط یک بار در سال'
                            : undefined
                        }
                        onClick={() =>
                          onUpdateSave(performStudyAction(saveGame, 'skip', gameDataset))
                        }
                      />
                    </div>
                  </Card>
                )}

                {/* High School Track Picker */}
                {(player.education.level === 'high_school' ||
                  (player.age >= 15 && !player.education.highSchoolTrack)) && (
                  <Card className="space-y-2.5">
                    <SectionHeader
                      title={t('education.chooseTrack')}
                      subtitle="مسیر رشته‌های دانشگاهی و مشاغل آینده"
                    />
                    <div className="space-y-2">
                      {TRACK_INFO.map((tr) => {
                        const selected = player.education.highSchoolTrack === tr.id;
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() =>
                              onUpdateSave(selectHighSchoolTrackAction(saveGame, tr.id))
                            }
                            className={`w-full rounded-2xl border p-3 text-right transition-colors ${
                              selected
                                ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                                : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--primary)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold">{tr.label}</span>
                              <Badge tone={selected ? 'primary' : 'neutral'}>{tr.focus}</Badge>
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                              مشاغل مرتبط: {tr.jobs}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Konkur & University */}
                {player.age >= 17 && (
                  <Card className="space-y-3">
                    <SectionHeader
                      title={t('education.konkur')}
                      subtitle="آزمون ورود به دانشگاه و انتخاب رشته"
                      action={
                        player.education.konkurRank ? (
                          <Badge tone="success">
                            رتبه:{' '}
                            {toPersianDigits(player.education.konkurRank.toLocaleString('en-US'))}
                          </Badge>
                        ) : undefined
                      }
                    />
                    <ActionButton
                      label={t('education.takeKonkur')}
                      costText={formatToman(konkurFee)}
                      effectHint="نتیجه بر پایه هوش، معدل و تلاش درسی"
                      disabled={
                        getActionCooldownRemaining(state, 'konkur') > 0 ||
                        player.moneyToman < konkurFee
                      }
                      disabledReason={
                        getActionCooldownRemaining(state, 'konkur') > 0
                          ? 'فقط یک بار در سال'
                          : player.moneyToman < konkurFee
                            ? 'موجودی کافی نیست'
                            : undefined
                      }
                      onClick={() => onUpdateSave(takeKonkurAction(saveGame, gameDataset))}
                    />

                    {!player.education.inSchool &&
                      player.education.konkurRank !== undefined && (
                        <div className="space-y-2 pt-1">
                          <div className="text-xs font-bold text-[var(--text-muted)]">
                            گزینه‌های ثبت‌نام دانشگاه با رتبه فعلی:
                          </div>
                          {UNI_OFFERS.map((offer) => {
                            const tuition = getUniversityTuitionToman(
                              offer.tier,
                              offer.majorFa,
                              state,
                              gameDataset,
                            );
                            const rankOk = (player.education.konkurRank ?? 999999) <= offer.maxRank;
                            const moneyOk = player.moneyToman >= tuition;
                            return (
                              <ActionButton
                                key={`${offer.tier}_${offer.majorFa}`}
                                label={`${offer.majorFa} — ${offer.tierLabel}`}
                                costText={formatToman(tuition)}
                                effectHint={`${toPersianDigits(offer.years)} سال تحصیل`}
                                variant="secondary"
                                disabled={!rankOk || !moneyOk}
                                disabledReason={
                                  !rankOk
                                    ? `نیازمند رتبه بهتر از ${toPersianDigits(offer.maxRank.toLocaleString('en-US'))}`
                                    : !moneyOk
                                      ? 'موجودی کافی نیست'
                                      : undefined
                                }
                                onClick={() =>
                                  onUpdateSave(
                                    enrollUniversityAction(
                                      saveGame,
                                      offer.tier,
                                      offer.majorFa,
                                      offer.degree,
                                      offer.years,
                                      gameDataset,
                                    ),
                                  )
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                  </Card>
                )}

                {/* Education History */}
                <Card>
                  <SectionHeader title={t('education.graduateHistory')} />
                  {eduHistory.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      هنوز مدرک دانشگاهی ثبت نشده است.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {eduHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs"
                        >
                          <div>
                            <div className="font-bold">{item.stageFa}</div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {item.detailFa}
                            </div>
                          </div>
                          <Badge tone="neutral">{toPersianDigits(item.year)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        )}

        {/* 2. CAREER TAB */}
        {subTab === 'career' && (
          <div className="space-y-3.5">
            {player.age < 16 ? (
              <LockedNotice message="بازار کار رسمی از ۱۸ سالگی و مسیرهای ویژه ورزشی و رسانه‌ای از ۱۶ سالگی فعال می‌شوند." />
            ) : (
              <>
                {player.age < 18 && (
                  <LockedNotice message="استخدام در مشاغل عمومی و اداری از ۱۸ سالگی فعال می‌شود؛ مسیرهای ورزشی و محتوایی زودهنگام در پایین باز هستند." />
                )}
                {player.job && (
                  <Card className="space-y-3" data-testid="active-job-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <IconCareerEdu className="h-4 w-4 text-[var(--primary)]" />
                          <span className="text-sm font-bold">{player.job.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          سابقه در شغل: {toPersianDigits(player.job.yearsInJob)} سال · استرس:{' '}
                          {toPersianDigits(player.job.stress)}٪
                          {promotionState && (
                            <>
                              {' '}
                              · عملکرد: {toPersianDigits(promotionState.eligibility.performance)} از ۱۰۰
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge tone="success">
                          خالص: <CurrencyText amountToman={player.job.annualSalaryToman} /> / سال
                        </Badge>
                        <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                          {formatUsdEquivalentHint(player.job.annualSalaryToman, state, gameDataset)}
                        </div>
                      </div>
                    </div>

                    {lastJobGross !== null && lastJobDeductions !== null && (
                      <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-muted)] tabular-nums">
                        ناخالص سالانه: {formatToman(lastJobGross)} · کسورات، مالیات و هزینه جاری:{' '}
                        {formatToman(lastJobDeductions)}
                      </div>
                    )}

                    {/* Vertical Employee Ladder Timeline */}
                    {promotionState && (
                      <div
                        className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
                        data-testid="career-ladder-timeline"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text)]">
                            {t('career.ladderTitle')}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            رده {toPersianDigits(promotionState.eligibility.currentStep.level)} از{' '}
                            {toPersianDigits(promotionState.jobDef.ladder.length)}
                          </span>
                        </div>

                        {promotionState.eligibility.noPromotions ? (
                          <p className="text-xs leading-5 text-[var(--text-muted)]">
                            {t('career.noPromotionsNote')}
                          </p>
                        ) : (
                          <div className="space-y-2 pr-1">
                            {promotionState.jobDef.ladder.map((step, idx) => {
                              const currentLvl = promotionState.eligibility.currentStep.level;
                              const isCurrent = step.level === currentLvl;
                              const isCompleted = step.level < currentLvl;
                              const isLast = idx === promotionState.jobDef.ladder.length - 1;
                              return (
                                <div key={step.level} className="relative flex items-start gap-2.5">
                                  <div className="flex flex-col items-center pt-1">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full border ${
                                        isCurrent
                                          ? 'border-[var(--primary)] bg-[var(--primary)]'
                                          : isCompleted
                                            ? 'border-[var(--success)] bg-[var(--success)]'
                                            : 'border-[var(--border)] bg-[var(--surface)]'
                                      }`}
                                    />
                                    {!isLast && (
                                      <span className="mt-1 h-4 w-px bg-[var(--border)]" />
                                    )}
                                  </div>
                                  <div className="flex flex-1 items-center justify-between gap-2 text-xs">
                                    <span
                                      className={
                                        isCurrent
                                          ? 'font-bold text-[var(--primary-strong)]'
                                          : isCompleted
                                            ? 'text-[var(--text)]'
                                            : 'text-[var(--text-muted)]'
                                      }
                                    >
                                      {step.titleFa}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      {isCurrent && (
                                        <Badge tone="primary">جایگاه فعلی</Badge>
                                      )}
                                      {step.ceiling && (
                                        <Badge tone="neutral">{t('career.ceilingBadge')}</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Next step requirements */}
                        {!promotionState.eligibility.atCeiling &&
                          !promotionState.eligibility.noPromotions &&
                          promotionState.eligibility.nextStep && (
                            <div className="space-y-1 border-t border-[var(--border)] pt-2">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span>
                                  پیش‌نیاز رده بعد: {promotionState.eligibility.nextStep.titleFa}
                                </span>
                                <span className="text-[var(--primary-strong)] tabular-nums">
                                  شانس ترفیع: {toPersianDigits(promotionState.eligibility.estimatedChancePct)}٪
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {promotionState.eligibility.checks.map((chk) => (
                                  <div
                                    key={chk.id}
                                    className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-2 py-1 text-[11px]"
                                  >
                                    <span
                                      className={
                                        chk.met ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
                                      }
                                    >
                                      {chk.met ? '✓' : '○'} {chk.labelFa}
                                    </span>
                                    <span className="tabular-nums text-[var(--text-muted)]">
                                      {chk.currentTextFa} / {chk.requiredTextFa}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* At Ceiling Card (Non-owner career limit) */}
                        {promotionState.eligibility.atCeiling &&
                          !promotionState.eligibility.noPromotions && (
                            <div
                              className="space-y-2 border-t border-[var(--border)] pt-2.5"
                              data-testid="career-ceiling-card"
                            >
                              <div className="text-xs font-bold text-[var(--primary-strong)]">
                                {t('career.atCeilingTitle')}
                              </div>
                              <p className="text-[11px] leading-5 text-[var(--text-muted)]">
                                {t('career.atCeilingBody')}
                              </p>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  disabled={
                                    getActionCooldownRemaining(state, 'change_workplace') > 0
                                  }
                                  onClick={() =>
                                    onUpdateSave(changeWorkplaceAction(saveGame, gameDataset))
                                  }
                                  className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-bold text-[var(--text)] disabled:opacity-50"
                                >
                                  {t('career.changeWorkplace')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubTab('skills')}
                                  className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-bold text-[var(--text)]"
                                >
                                  ارتقای مهارت‌ها
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    jobBoardRef.current?.scrollIntoView({ behavior: 'smooth' })
                                  }
                                  className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-bold text-[var(--text)]"
                                >
                                  تغییر مسیر شغلی
                                </button>
                                {promotionState.jobDef.ownershipPath.allowed ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreferredBizTypeId(
                                        promotionState.jobDef.ownershipPath.businessTypeId,
                                      );
                                      setOwnershipFlowOpen(true);
                                      ownershipRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="min-h-[44px] rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-1.5 text-[11px] font-bold text-[var(--primary-strong)]"
                                  >
                                    {t('career.openOwnershipFlow')}
                                  </button>
                                ) : (
                                  <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center text-[10px] text-[var(--text-muted)]">
                                    مالکیت هم‌زمان با شغل دولتی مجاز نیست
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    <div
                      className={`grid gap-2 ${
                        promotionState?.eligibility.noPromotions ? 'grid-cols-1' : 'grid-cols-2'
                      }`}
                    >
                      <ActionButton
                        label={t('career.overtime')}
                        effectHint="پاداش نقدی · سلامت -۳"
                        variant="secondary"
                        disabled={getActionCooldownRemaining(state, 'career_overtime') > 0}
                        disabledReason={
                          getActionCooldownRemaining(state, 'career_overtime') > 0
                            ? 'فقط یک بار در سال'
                            : undefined
                        }
                        onClick={() =>
                          onUpdateSave(performCareerAction(saveGame, 'overtime', gameDataset))
                        }
                      />
                      {!promotionState?.eligibility.noPromotions && (
                        <ActionButton
                          label={
                            promotionState?.eligibility.atCeiling
                              ? 'تعدیل دستمزد در سقف رده'
                              : t('career.requestRaise')
                          }
                          effectHint={
                            promotionState?.eligibility.atCeiling
                              ? 'تعدیل حقوق بدون تغییر رده'
                              : 'ارزیابی ترفیع و تعدیل حقوق'
                          }
                          variant="secondary"
                          disabled={getActionCooldownRemaining(state, 'career_raise') > 0}
                          disabledReason={
                            getActionCooldownRemaining(state, 'career_raise') > 0
                              ? 'فقط یک بار در سال'
                              : undefined
                          }
                          onClick={() =>
                            onUpdateSave(performCareerAction(saveGame, 'raise', gameDataset))
                          }
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton
                        label={t('career.retire')}
                        variant="secondary"
                        disabled={player.age < 60 && player.job.yearsInJob < 25}
                        disabledReason={
                          player.age < 60 && player.job.yearsInJob < 25
                            ? 'نیاز به ۶۰ سال سن یا ۲۵ سال سابقه'
                            : undefined
                        }
                        onClick={() => setConfirmQuitMode('retire')}
                      />
                      <ActionButton
                        label={t('career.quit')}
                        variant="danger"
                        onClick={() => setConfirmQuitMode('quit')}
                      />
                    </div>
                  </Card>
                )}
                {!player.job && player.age >= 18 && (
                  <EmptyState
                    icon={<IconCareerEdu className="h-5 w-5" />}
                    title={t('career.unemployed')}
                    description="از بازار کار زیر شغل مناسب خودت را پیدا کن یا برای راه‌اندازی کسب‌وکار مستقل اقدام کن."
                  />
                )}

                {/* Business Ownership, Explicit Flow & Licenses */}
                {player.age >= 18 && (
                  <div ref={ownershipRef}>
                    <CareerOwnershipPanel
                      saveGame={saveGame}
                      preferredBusinessTypeId={preferredBizTypeId}
                      flowExpanded={ownershipFlowOpen}
                      onToggleFlow={setOwnershipFlowOpen}
                      onUpdateSave={onUpdateSave}
                    />
                  </div>
                )}

                {/* Special Careers (Art, Sports, Media) */}
                <div className="space-y-2.5">
                  <SectionHeader
                    title="مسیرهای حرفه‌ای ویژه"
                    subtitle="ورود نیازمند گرایش کشف‌شده، مهارت کافی و قبولی در آزمون یا فراخوان است"
                  />
                  <FilterChips
                    value={specialFilter}
                    onChange={setSpecialFilter}
                    items={[
                      { value: 'all', label: 'همه مسیرهای ویژه' },
                      { value: 'ready', label: 'مرتبط با گرایش‌های من' },
                    ]}
                  />
                  <div className="space-y-2.5">
                    {specialCareerCards
                      .filter(
                        (item) =>
                          specialFilter === 'all' ||
                          Boolean(item.eligibility.discovered) ||
                          item.isCurrentSpecialJob ||
                          item.isCurrentFallbackJob,
                      )
                      .map((item) => {
                        const { career, eligibility } = item;
                        const activeRoute: SpecialCareerRouteId =
                          selectedRoutes[career.id] ?? career.alternativeRoutes[0].id;
                        const routeNote = formatSpecialRouteChoiceSummary(
                          career,
                          activeRoute,
                          state,
                        );
                        const cdRemaining = getActionCooldownRemaining(
                          state,
                          `special_${career.id}`,
                          1,
                        );
                        const tryDisabled = !eligibility.eligible || cdRemaining > 0;
                        const tryDisabledReason =
                          cdRemaining > 0 ? 'فقط یک بار در سال' : eligibility.reason;

                        return (
                          <Card key={career.id} className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-[var(--text)]">
                                    {career.titleFa}
                                  </span>
                                  {eligibility.currentStage > 0 && (
                                    <Badge tone="success">
                                      مرحله {toPersianDigits(eligibility.currentStage)} از ۴
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                  مرحله بعدی: {eligibility.nextStageTitleFa} · سطح مهارت فعلی:{' '}
                                  {getQualitativeSkillLabelFa(eligibility.currentSkill)}
                                </div>
                              </div>
                              <Badge tone={eligibility.eligible ? 'primary' : 'neutral'}>
                                {eligibility.eligible
                                  ? `شانس ${toPersianDigits(eligibility.estimatedChancePct)}٪`
                                  : 'در انتظار آمادگی'}
                              </Badge>
                            </div>

                            {/* Alternative Routes */}
                            <div className="flex flex-wrap gap-1.5">
                              {career.alternativeRoutes.map((route) => {
                                const selected = activeRoute === route.id;
                                return (
                                  <button
                                    key={route.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedRoutes((prev) => ({
                                        ...prev,
                                        [career.id]: route.id,
                                      }))
                                    }
                                    className={`min-h-[36px] rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                      selected
                                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {route.titleFa}
                                  </button>
                                );
                              })}
                            </div>

                            {routeNote && (
                              <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] leading-5 text-[var(--text-muted)]">
                                {routeNote}
                              </p>
                            )}

                            <ActionButton
                              label={
                                item.isCurrentSpecialJob && eligibility.currentStage < 4
                                  ? `ارتقا به مرحله بعد: ${eligibility.nextStageTitleFa}`
                                  : `آزمون و پیگیری: ${eligibility.nextStageTitleFa}`
                              }
                              costText={item.salaryText}
                              effectHint="درآمد واقعی متغیر + افزایش شهرت در صورت پذیرش"
                              disabled={tryDisabled}
                              disabledReason={tryDisabledReason}
                              variant={eligibility.eligible ? 'primary' : 'secondary'}
                              onClick={() =>
                                onUpdateSave(
                                  pursueSpecialCareerAction(
                                    saveGame,
                                    career.id,
                                    activeRoute,
                                    gameDataset,
                                  ),
                                )
                              }
                            />

                            {item.fallbackEligible && !item.isCurrentFallbackJob && (
                              <ActionButton
                                label={`مسیر جایگزین پایدار: ${career.fallbackCareerFa}`}
                                costText={item.fallbackSalaryText}
                                effectHint="درآمد باثبات‌تر و اتکا به مهارت و آموزش"
                                variant="secondary"
                                onClick={() =>
                                  onUpdateSave(
                                    enterSpecialFallbackCareerAction(
                                      saveGame,
                                      career.id,
                                      gameDataset,
                                    ),
                                  )
                                }
                              />
                            )}
                          </Card>
                        );
                      })}
                  </div>
                </div>

                {/* Filterable Job Board (18+) */}
                {player.age >= 18 && (
                <div className="space-y-2.5" ref={jobBoardRef}>
                  <SectionHeader
                    title={t('career.jobBoard')}
                    subtitle="مبالغ زیر خالص دریافتی پس از کسر کارمزد، هزینه جاری، بیمه و مالیات است"
                  />
                  <FilterChips
                    value={jobFilter}
                    onChange={setJobFilter}
                    items={[
                      { value: 'all', label: 'همه' },
                      { value: 'دولتی', label: 'دولتی' },
                      { value: 'خصوصی', label: 'خصوصی' },
                      { value: 'آزاد', label: 'آزاد' },
                      { value: 'خانوادگی', label: 'خانوادگی' },
                    ]}
                  />
                  <div className="space-y-2">
                    {filteredJobs.map((job: JobDefinition) => {
                      const status = getJobApplicationStatus(job, state, gameDataset);
                      const isCurrent = player.job?.jobId === job.id;
                      const ceilingStep = job.ladder[job.ladder.length - 1];
                      const requiredLicenseTitle = job.requiredLicenseId
                        ? gameDataset.businesses.licenses.find((l) => l.id === job.requiredLicenseId)
                            ?.titleFa
                        : undefined;
                      const deductions =
                        status.breakdown.commission +
                        status.breakdown.runningCosts +
                        status.breakdown.bimeh +
                        status.breakdown.incomeTax;
                      return (
                        <Card key={job.id} className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold">{job.titleFa}</div>
                              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
                                <span>{job.employerType ?? 'خصوصی'}</span>
                                <span>·</span>
                                <span>حداقل مدرک: {t(`education.stageLabels.${job.minEducation}`)}</span>
                                <span>·</span>
                                <span>استرس {toPersianDigits(job.stress)}٪</span>
                                {requiredLicenseTitle && (
                                  <>
                                    <span>·</span>
                                    <span>نیازمند {requiredLicenseTitle}</span>
                                  </>
                                )}
                                {job.entryExamRequired && (
                                  <>
                                    <span>·</span>
                                    <span>آزمون ورودی</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                                {job.noPromotions
                                  ? 'شغل آزاد بدون ترفیع سازمانی'
                                  : `سقف مسیر استخدامی: ${ceilingStep.titleFa}`}
                              </div>
                            </div>
                            <Badge tone={status.eligible ? 'primary' : 'neutral'}>
                              شانس {toPersianDigits(status.estimatedChancePct)}٪
                            </Badge>
                          </div>
                          <ActionButton
                            label={isCurrent ? 'شغل فعلی تو' : 'ارسال درخواست و مصاحبه'}
                            costText={`خالص ${formatToman(status.estimatedSalary)} / سال`}
                            effectHint={`ناخالص ${formatToman(status.breakdown.grossAnnual)} · کسورات ${formatToman(deductions)} · ${formatUsdEquivalentHint(status.estimatedSalary, state, gameDataset)}`}
                            disabled={isCurrent || !status.eligible}
                            disabledReason={isCurrent ? 'در حال فعالیت' : status.reason}
                            variant={isCurrent ? 'disabled' : 'secondary'}
                            onClick={() =>
                              onUpdateSave(applyForJobAction(saveGame, job, gameDataset))
                            }
                          />
                        </Card>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Work History */}
                {workHistory.length > 0 && (
                  <Card className="space-y-2">
                    <SectionHeader title={t('career.workHistory')} />
                    {workHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="font-bold">{item.title}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {item.employer}
                          </div>
                        </div>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          {toPersianDigits(item.fromYear)} –{' '}
                          {item.toYear ? toPersianDigits(item.toYear) : 'اکنون'}
                        </span>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* 3. SKILLS TAB */}
        {subTab === 'skills' && (
          <div className="space-y-4">
            {/* Talent Discovery & Practice Section */}
            <div className="space-y-2.5">
              <SectionHeader
                title="پرورش استعدادها و گرایش‌های فردی"
                subtitle="تمرین و کلاس در طول زمان گرایش‌های پنهان را آشکار و مهارت را شکوفا می‌کند"
              />
              <FilterChips
                value={talentFilter}
                onChange={setTalentFilter}
                items={[
                  { value: 'all', label: 'همه زمینه‌ها' },
                  { value: 'discovered', label: 'گرایش‌های کشف‌شده' },
                ]}
              />
              {talentFilter === 'discovered' &&
              talentOptions.every((opt) => !opt.isDiscovered) ? (
                <Card>
                  <p className="text-xs leading-6 text-[var(--text-muted)]">
                    هنوز گرایش خاصی آشکار نشده است. با گذر سال‌ها یا امتحان کردن زمینه‌های مختلف،
                    نشانه‌های استعدادت پیدا می‌شوند.
                  </p>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {talentOptions
                    .filter((opt) => talentFilter === 'all' || opt.isDiscovered)
                    .map((opt) => {
                      const ageLocked = player.age < opt.minPracticeAge;
                      const cooledDown = opt.cooldownRemaining > 0;
                      const cantAffordLesson = player.moneyToman < opt.lessonCostToman;
                      const auditionCost = Math.round(opt.lessonCostToman * 0.5);
                      const cantAffordAudition = player.moneyToman < auditionCost;
                      const commonDisabledReason = ageLocked
                        ? `از ${toPersianDigits(opt.minPracticeAge)} سالگی فعال می‌شود`
                        : cooledDown
                          ? 'فقط یک بار در سال برای هر زمینه'
                          : undefined;

                      return (
                        <Card key={opt.talentId} className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <IconSkill className="h-4 w-4 text-[var(--primary)]" />
                                <span className="text-sm font-bold text-[var(--text)]">
                                  {opt.titleFa}
                                </span>
                                {opt.athleticDisciplineTitleFa && (
                                  <Badge tone="neutral">{opt.athleticDisciplineTitleFa}</Badge>
                                )}
                              </div>
                              <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                                {opt.categoryFa} · مهارت: {opt.skillLevelLabelFa}
                              </div>
                            </div>
                            {opt.isDiscovered && opt.discoveredTierLabelFa ? (
                              <Badge tone="primary">{opt.discoveredTierLabelFa}</Badge>
                            ) : (
                              <Badge tone="neutral">کشف‌نشده</Badge>
                            )}
                          </div>

                          <div className="space-y-2">
                            <ActionButton
                              label="تمرین فردی"
                              costText="رایگان"
                              variant="secondary"
                              disabled={Boolean(commonDisabledReason)}
                              disabledReason={commonDisabledReason}
                              onClick={() =>
                                onUpdateSave(
                                  developTalentAction(
                                    saveGame,
                                    opt.talentId,
                                    'self_practice',
                                    gameDataset,
                                  ),
                                )
                              }
                            />
                            <ActionButton
                              label={opt.lessonTitleFa}
                              costText={formatToman(opt.lessonCostToman)}
                              variant="secondary"
                              disabled={Boolean(commonDisabledReason) || cantAffordLesson}
                              disabledReason={
                                commonDisabledReason ??
                                (cantAffordLesson ? 'موجودی کافی نیست' : undefined)
                              }
                              onClick={() =>
                                onUpdateSave(
                                  developTalentAction(
                                    saveGame,
                                    opt.talentId,
                                    'lesson_or_club',
                                    gameDataset,
                                  ),
                                )
                              }
                            />
                          </div>

                          {player.age >= 10 && (
                            <div className="space-y-2">
                              <ActionButton
                                label="مسابقه و فراخوان"
                                costText={formatToman(auditionCost)}
                                variant="secondary"
                                disabled={Boolean(commonDisabledReason) || cantAffordAudition}
                                disabledReason={
                                  commonDisabledReason ??
                                  (cantAffordAudition ? 'موجودی کافی نیست' : undefined)
                                }
                                onClick={() =>
                                  onUpdateSave(
                                    developTalentAction(
                                      saveGame,
                                      opt.talentId,
                                      'audition_or_contest',
                                      gameDataset,
                                    ),
                                  )
                                }
                              />
                              {player.age >= 14 && (
                                <ActionButton
                                  label="انتشار آنلاین"
                                  costText="رایگان"
                                  variant="secondary"
                                  disabled={Boolean(commonDisabledReason)}
                                  disabledReason={commonDisabledReason}
                                  onClick={() =>
                                    onUpdateSave(
                                      developTalentAction(
                                        saveGame,
                                        opt.talentId,
                                        'publish_online',
                                        gameDataset,
                                      ),
                                    )
                                  }
                                />
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>

            {/* General Work Skills Section */}
            <div className="space-y-2.5">
              <SectionHeader
                title={t('tabs.skills')}
                subtitle="افزایش مهارت‌های شغلی شانس استخدام و درآمد را بالا می‌برد"
              />
              {gameDataset.skills.map((skill) => {
                const level = getSkillLevel(state, skill.id);
                const cost = getSkillTrainingCost(skill, state);
                const cd = getActionCooldownRemaining(state, `skill_${skill.id}`);
                const ageLocked = player.age < skill.minAge;
                const maxed = level >= 5;
                const poor = player.moneyToman < cost;
                const disabledReason = maxed
                  ? 'به حداکثر سطح رسیده است'
                  : ageLocked
                    ? `از ${toPersianDigits(skill.minAge)} سالگی فعال می‌شود`
                    : cd > 0
                      ? 'فقط یک بار در سال'
                      : poor
                        ? 'موجودی کافی نیست'
                        : undefined;

                return (
                  <Card key={skill.id} className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <IconSkill className="h-4 w-4 text-[var(--primary)]" />
                          <span className="text-sm font-bold">{skill.titleFa}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {skill.descriptionFa}
                        </p>
                      </div>
                      <Badge tone={maxed ? 'success' : 'primary'}>
                        سطح {toPersianDigits(level)} / ۵
                      </Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full ${
                            step <= level ? 'bg-[var(--primary)]' : 'bg-[var(--surface-2)]'
                          }`}
                        />
                      ))}
                    </div>
                    <ActionButton
                      label={maxed ? 'تکمیل شده' : 'تمرین و ارتقا'}
                      costText={maxed ? undefined : formatToman(cost)}
                      effectHint={skill.effectHintFa}
                      disabled={Boolean(disabledReason)}
                      disabledReason={disabledReason}
                      variant="secondary"
                      onClick={() => onUpdateSave(trainSkillAction(saveGame, skill))}
                    />
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. MILITARY SERVICE TAB (MALE 17+) */}
        {subTab === 'military' && showMilitary && (
          <div className="space-y-3">
            <Card className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconShield className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-bold">وضعیت فعلی نظام وظیفه</span>
                </div>
                <Badge tone="primary">{t(`military.${player.militaryStatus}`)}</Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                گزینه‌های پیش رو برای تعیین تکلیف خدمت سربازی:
              </p>
            </Card>

            {player.militaryStatus === 'pending' ||
            player.militaryStatus === 'exempt_educational' ? (
              <div className="space-y-2.5">
                <ActionButton
                  label="اعزام به خدمت سربازی (۲ سال)"
                  costText="رایگان"
                  effectHint="پس از پایان ۲ سال کارت پایان خدمت می‌گیری"
                  onClick={() =>
                    onUpdateSave(selectMilitaryOptionAction(saveGame, 'serve', gameDataset))
                  }
                />
                <ActionButton
                  label="درخواست امریه سربازی"
                  costText="رایگان"
                  effectHint="نیازمند مدرک کارشناسی یا بالاتر؛ خدمت در محیط اداری"
                  variant="secondary"
                  onClick={() =>
                    onUpdateSave(selectMilitaryOptionAction(saveGame, 'amrieh', gameDataset))
                  }
                />
                <ActionButton
                  label="کمیسیون معافیت پزشکی"
                  costText="رایگان"
                  effectHint="شانس بیشتر در صورت سلامت پایین"
                  variant="secondary"
                  onClick={() =>
                    onUpdateSave(
                      selectMilitaryOptionAction(saveGame, 'exempt_medical', gameDataset),
                    )
                  }
                />
                <ActionButton
                  label="درخواست معافیت کفالت"
                  costText="رایگان"
                  effectHint="ویژه سرپرستان خانواده"
                  variant="secondary"
                  onClick={() =>
                    onUpdateSave(
                      selectMilitaryOptionAction(saveGame, 'exempt_breadwinner', gameDataset),
                    )
                  }
                />
                <ActionButton
                  label="خرید جریمه / معافیت نقدی"
                  costText={formatToman(buyoutCost)}
                  effectHint="حل فوری وضعیت نظام وظیفه"
                  variant="secondary"
                  disabled={player.moneyToman < buyoutCost}
                  disabledReason={player.moneyToman < buyoutCost ? 'موجودی کافی نیست' : undefined}
                  onClick={() =>
                    onUpdateSave(selectMilitaryOptionAction(saveGame, 'buyout', gameDataset))
                  }
                />
                <ActionButton
                  label="به تعویق انداختن / غیبت"
                  costText="بدون هزینه"
                  effectHint="سلامت روان -۳ · محدودیت استخدام دولتی"
                  variant="danger"
                  onClick={() =>
                    onUpdateSave(selectMilitaryOptionAction(saveGame, 'defer', gameDataset))
                  }
                />
              </div>
            ) : (
              <Card>
                <p className="text-xs text-[var(--text-muted)]">
                  وضعیت فعلی تو ({t(`military.${player.militaryStatus}`)}) ثبت شده است و تا
                  پایان این مرحله نیازی به اقدام تازه نیست.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmQuitMode !== null}
        title={confirmQuitMode === 'retire' ? 'تأیید بازنشستگی' : 'تأیید استعفا'}
        message={
          confirmQuitMode === 'retire'
            ? 'آیا می‌خواهی بازنشسته شوی و حقوق مستمری سالانه دریافت کنی؟'
            : 'آیا مطمئنی که می‌خواهی از شغل فعلی استعفا بدهی؟'
        }
        destructive={confirmQuitMode === 'quit'}
        onCancel={() => setConfirmQuitMode(null)}
        onConfirm={() => {
          if (confirmQuitMode) {
            onUpdateSave(performCareerAction(saveGame, confirmQuitMode, gameDataset));
          }
          setConfirmQuitMode(null);
        }}
      />
    </FullScreenSheet>
  );
}
