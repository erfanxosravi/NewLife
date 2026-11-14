import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { toPersianDigits } from '../../engine/jalali';
import { formatSpecialRouteChoiceSummary } from '../../engine/talents';
import {
  ensureJobCompassState,
  jobGapSteps,
  jobReadiness,
  jobSalaryRange,
} from '../../engine/jobCompass';
import type {
  HighSchoolTrack,
  SaveGame,
  SpecialCareerRouteId,
  TalentId,
  UniversityTier,
} from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  changeWorkplaceAction,
  developTalentAction,
  enrollUniversityAction,
  enterSpecialFallbackCareerAction,
  performCareerAction,
  performStudyAction,
  pinJobGoalAction,
  pursueSpecialCareerAction,
  selectHighSchoolTrackAction,
  selectMilitaryOptionAction,
  setStudyEffortAction,
  takeKonkurAction,
  trainSkillAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  getActionCooldownRemaining,
  getAllLicensesStatus,
  getCurrentJobPromotionState,
  getEducationHistory,
  getKonkurFeeToman,
  getMilitaryBuyoutCostToman,
  getPendingEmployerOffer,
  getPendingFamilyBizInheritance,
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
import {
  EmployerOfferDetailSheet,
  FamilyInheritanceDetailSheet,
  LicensesDetailSheet,
  OwnedBusinessDetailSheet,
  OwnershipFlowDetailSheet,
} from '../components/CareerOwnershipPanel';
import {
  EmojiSprite,
  JobIconTile,
  JobMarketSheet,
  type JobGapActionTarget,
} from '../components/jobCompass';
import { FullScreenSheet } from '../components/FullScreenSheet';
import { MoneyText } from '../components/MoneyText';
import {
  ActionButton,
  ActionRow,
  Badge,
  Card,
  ConfirmDialog,
  DangerZoneGroup,
  DetailSheet,
  EmptyState,
  FilterChips,
  HubHeroCard,
  InfoSheet,
  LockedNotice,
  ProgressRing,
  ProgressStepper,
  RequirementsChecklist,
  SectionGroup,
  SegmentedControl,
  Slider,
} from '../components/Primitives';
import {
  IconBook,
  IconBuilding,
  IconCareerEdu,
  IconCoins,
  IconEducation,
  IconShield,
  IconSkill,
  IconSparkles,
  IconStar,
  IconTrophy,
} from '../icons';

interface WorkEducationSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onEffortChange: (nextSave: SaveGame) => void;
}

type SubTab = 'education' | 'career' | 'skills' | 'military';

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
  const [talentFilter, setTalentFilter] = useState<'discovered' | 'all'>('all');
  const [specialFilter, setSpecialFilter] = useState<'ready' | 'all'>('all');
  const [selectedRoutes, setSelectedRoutes] = useState<Record<string, SpecialCareerRouteId>>({});
  const [confirmQuitMode, setConfirmQuitMode] = useState<'quit' | 'retire' | null>(null);
  const [confirmMilitaryDefer, setConfirmMilitaryDefer] = useState(false);

  // Drill-down sheets state
  const [infoTopic, setInfoTopic] = useState<
    null | 'education' | 'career' | 'skills' | 'military' | 'salary_breakdown'
  >(null);
  const [openTrackSheet, setOpenTrackSheet] = useState(false);
  const [openUniSheet, setOpenUniSheet] = useState(false);
  const [openEduHistorySheet, setOpenEduHistorySheet] = useState(false);

  const [openLadderSheet, setOpenLadderSheet] = useState(false);
  const [openJobBoardSheet, setOpenJobBoardSheet] = useState(false);
  const [initialMarketJobId, setInitialMarketJobId] = useState<string | null>(null);
  const [openSpecialListSheet, setOpenSpecialListSheet] = useState(false);
  const [selectedSpecialId, setSelectedSpecialId] = useState<string | null>(null);
  const [openOwnedBizSheet, setOpenOwnedBizSheet] = useState(false);
  const [openOwnershipFlowSheet, setOpenOwnershipFlowSheet] = useState(false);
  const [preferredBizTypeId, setPreferredBizTypeId] = useState<string | undefined>(undefined);
  const [openLicensesSheet, setOpenLicensesSheet] = useState(false);
  const [openWorkHistorySheet, setOpenWorkHistorySheet] = useState(false);
  const [openEmployerOfferSheet, setOpenEmployerOfferSheet] = useState(false);
  const [openFamilyBizSheet, setOpenFamilyBizSheet] = useState(false);

  const [selectedTalentId, setSelectedTalentId] = useState<TalentId | null>(null);
  const [openAllTalentsSheet, setOpenAllTalentsSheet] = useState(false);
  const [openAllSkillsSheet, setOpenAllSkillsSheet] = useState(false);

  const effectiveSubTab: SubTab = subTab === 'military' && !showMilitary ? 'career' : subTab;

  const studyEffort = getStudyEffort(state);
  const eduHistory = getEducationHistory(state);
  const workHistory = getWorkHistory(state);
  const promotionState = useMemo(() => getCurrentJobPromotionState(state, gameDataset), [state]);
  const talentOptions = useMemo(() => getTalentPracticeOptions(state, gameDataset), [state]);
  const specialCareerCards = useMemo(() => getSpecialCareerCards(state, gameDataset), [state]);
  const licensesStatus = useMemo(() => getAllLicensesStatus(state, gameDataset), [state]);
  const pendingEmployerOffer = getPendingEmployerOffer(state);
  const pendingFamilyInheritance = getPendingFamilyBizInheritance(state);
  const ownedBiz = state.ownedBusiness;
  const compassState = useMemo(() => ensureJobCompassState(state), [state]);

  const pinnedGoalInfo = useMemo(() => {
    if (!compassState.pinnedJobId) return null;
    const job = gameDataset.jobs.find((j) => j.id === compassState.pinnedJobId);
    if (!job) return null;
    const readiness = jobReadiness(state, job, gameDataset);
    const gapSteps = jobGapSteps(state, job, gameDataset);
    const salary = jobSalaryRange(job, state, gameDataset);
    return { job, readiness, gapSteps, salary };
  }, [compassState.pinnedJobId, state]);

  const handleNavigateGapTarget = (target: JobGapActionTarget) => {
    setOpenJobBoardSheet(false);
    setInitialMarketJobId(null);
    if (target.type === 'education' || target.type === 'konkur') {
      setSubTab('education');
    } else if (target.type === 'uni') {
      setSubTab('education');
      if (player.education.konkurRank !== undefined && !player.education.inSchool) {
        setOpenUniSheet(true);
      }
    } else if (target.type === 'license') {
      setSubTab('career');
      setOpenLicensesSheet(true);
    } else if (target.type === 'skill') {
      setSubTab('skills');
      if (
        target.id &&
        gameDataset.skills.findIndex((s) => s.id === target.id) >= 6
      ) {
        setOpenAllSkillsSheet(true);
      }
    } else if (target.type === 'military' && showMilitary) {
      setSubTab('military');
    }
  };

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

  const discoveredTalentsCount = talentOptions.filter((o) => o.isDiscovered).length;
  const maxedSkillsCount = gameDataset.skills.filter((s) => getSkillLevel(state, s.id) >= 5).length;

  const activeTalent = selectedTalentId
    ? talentOptions.find((o) => o.talentId === selectedTalentId) ?? null
    : null;
  const activeSpecialCard = selectedSpecialId
    ? specialCareerCards.find((c) => c.career.id === selectedSpecialId) ?? null
    : null;

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.workEducation')}
      subtitle={`${player.firstName} ${player.lastName} · ${currentStageLabel}`}
      stickySubHeader={
        <SegmentedControl
          value={effectiveSubTab}
          onChange={setSubTab}
          items={tabItems}
        />
      }
      scrollKey={effectiveSubTab}
    >
      <div className="space-y-4">
        {/* ================= 1. EDUCATION HUB ================= */}
        {effectiveSubTab === 'education' && (
          <div className="space-y-4">
            <HubHeroCard
              icon={<IconEducation className="h-5 w-5" />}
              title={currentStageLabel}
              subtitle={
                player.education.inSchool
                  ? uniYearsLeft > 0
                    ? `${player.education.major ?? 'دانشجو'} · ${toPersianDigits(uniYearsLeft)} سال تا فراغت`
                    : player.education.highSchoolTrack
                      ? `رشته: ${t(`education.trackLabels.${player.education.highSchoolTrack}`)}`
                      : 'در حال تحصیل در مدرسه'
                  : 'در حال حاضر دانش‌آموز یا دانشجو نیستی'
              }
              badge={
                <ProgressRing
                  value={player.education.gpa}
                  max={20}
                  size={50}
                  strokeWidth={5}
                  label={toPersianDigits(player.education.gpa.toFixed(1))}
                  colorVar="--stat-smarts"
                />
              }
              onInfo={() => setInfoTopic('education')}
              metrics={[
                {
                  label: 'معدل کل',
                  value: `${toPersianDigits(player.education.gpa.toFixed(1))} از ۲۰`,
                  tone: player.education.gpa >= 16 ? 'success' : 'default',
                },
                { label: 'تلاش درسی', value: `${toPersianDigits(studyEffort)}٪` },
                {
                  label: 'رتبه کنکور',
                  value: player.education.konkurRank
                    ? toPersianDigits(player.education.konkurRank.toLocaleString('en-US'))
                    : 'ندارد',
                },
              ]}
            />

            {player.age < 7 ? (
              <LockedNotice message="تحصیل رسمی از ۷ سالگی با ورود به دبستان آغاز می‌شود." />
            ) : (
              <>
                {player.education.inSchool && (
                  <SectionGroup title="برنامه و فعالیت درسی">
                    <div className="p-3.5 space-y-2">
                      <Slider
                        label={t('education.studyEffort')}
                        value={studyEffort}
                        minLabel="آرام"
                        maxLabel="فشرده"
                        valueLabel={`${toPersianDigits(studyEffort)}٪`}
                        onChange={(val) => onEffortChange(setStudyEffortAction(saveGame, val))}
                      />
                    </div>
                    <ActionRow
                      icon={<IconBook className="h-4 w-4" />}
                      title="مطالعه جدی و مرور درس‌ها"
                      subtitle="هوش +۴ · معدل بالاتر · سلامت روان -۳"
                      value="رایگان"
                      state={
                        getActionCooldownRemaining(state, 'edu_study_hard') > 0
                          ? 'cooldown'
                          : 'enabled'
                      }
                      ctaLabel="مطالعه"
                      onClick={() =>
                        onUpdateSave(performStudyAction(saveGame, 'study_hard', gameDataset))
                      }
                    />
                    <ActionRow
                      icon={<IconEducation className="h-4 w-4" />}
                      title="کلاس تقویتی و معلم خصوصی"
                      subtitle="هوش +۶ · جهش معدل"
                      value={
                        <MoneyText
                          amount={tutorCost}
                          currency="IRT"
                          mode="inline"
                          interactive={false}
                        />
                      }
                      state={
                        getActionCooldownRemaining(state, 'edu_tutor') > 0
                          ? 'cooldown'
                          : player.moneyToman < tutorCost
                            ? 'disabled'
                            : 'enabled'
                      }
                      reason={player.moneyToman < tutorCost ? 'موجودی کافی نیست' : undefined}
                      ctaLabel="ثبت‌نام"
                      onClick={() =>
                        onUpdateSave(performStudyAction(saveGame, 'tutor', gameDataset))
                      }
                    />
                    <ActionRow
                      icon={<IconSparkles className="h-4 w-4" />}
                      iconTone="neutral"
                      title="کمی فاصله گرفتن از کتاب"
                      subtitle="شادی +۵ · افت جزئی معدل"
                      value="رایگان"
                      state={
                        getActionCooldownRemaining(state, 'edu_skip') > 0 ? 'cooldown' : 'enabled'
                      }
                      ctaLabel="استراحت"
                      onClick={() =>
                        onUpdateSave(performStudyAction(saveGame, 'skip', gameDataset))
                      }
                    />
                    {(player.education.level === 'high_school' ||
                      (player.age >= 15 && !player.education.highSchoolTrack)) && (
                      <ActionRow
                        icon={<IconStar className="h-4 w-4" />}
                        title={t('education.chooseTrack')}
                        subtitle={
                          player.education.highSchoolTrack
                            ? `فعلی: ${t(`education.trackLabels.${player.education.highSchoolTrack}`)}`
                            : 'مسیر رشته‌های دانشگاهی و مشاغل آینده'
                        }
                        state={player.education.highSchoolTrack ? 'done' : 'recommended'}
                        showChevron
                        onClick={() => setOpenTrackSheet(true)}
                      />
                    )}
                  </SectionGroup>
                )}

                {player.age >= 17 && (
                  <SectionGroup title="کنکور و دانشگاه">
                    <ActionRow
                      icon={<IconTrophy className="h-4 w-4" />}
                      title={t('education.takeKonkur')}
                      subtitle="نتیجه بر پایه هوش، معدل و تلاش درسی"
                      value={
                        <MoneyText
                          amount={konkurFee}
                          currency="IRT"
                          mode="inline"
                          interactive={false}
                        />
                      }
                      state={
                        getActionCooldownRemaining(state, 'konkur') > 0
                          ? 'cooldown'
                          : player.moneyToman < konkurFee
                            ? 'disabled'
                            : 'enabled'
                      }
                      reason={player.moneyToman < konkurFee ? 'موجودی کافی نیست' : undefined}
                      ctaLabel="شرکت"
                      onClick={() => onUpdateSave(takeKonkurAction(saveGame, gameDataset))}
                    />
                    {!player.education.inSchool &&
                      player.education.konkurRank !== undefined && (
                        <ActionRow
                          icon={<IconEducation className="h-4 w-4" />}
                          title="انتخاب رشته و ثبت‌نام دانشگاه"
                          subtitle="مشاهده گزینه‌های مجاز بر اساس رتبه فعلی"
                          value={`رتبه ${toPersianDigits(player.education.konkurRank.toLocaleString('en-US'))}`}
                          state="recommended"
                          showChevron
                          onClick={() => setOpenUniSheet(true)}
                        />
                      )}
                  </SectionGroup>
                )}

                {eduHistory.length > 0 && (
                  <SectionGroup title="سوابق و مدارک">
                    <ActionRow
                      icon={<IconBook className="h-4 w-4" />}
                      iconTone="neutral"
                      title={t('education.graduateHistory')}
                      subtitle="مدارک و مراحل تحصیلی ثبت‌شده"
                      value={`${toPersianDigits(eduHistory.length)} مورد`}
                      showChevron
                      onClick={() => setOpenEduHistorySheet(true)}
                    />
                  </SectionGroup>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= 2. CAREER HUB ================= */}
        {effectiveSubTab === 'career' && (
          <div className="space-y-4">
            {player.age < 16 ? (
              <LockedNotice message="بازار کار رسمی از ۱۸ سالگی و مسیرهای ویژه ورزشی و رسانه‌ای از ۱۶ سالگی فعال می‌شوند." />
            ) : (
              <>
                {player.job ? (
                  <HubHeroCard
                    testId="active-job-card"
                    icon={<IconCareerEdu className="h-5 w-5" />}
                    title={player.job.title}
                    subtitle={
                      promotionState
                        ? `${promotionState.jobDef.employerType ?? 'شغلی'} · عملکرد ${toPersianDigits(promotionState.eligibility.performance)} از ۱۰۰`
                        : 'شاغل تمام‌وقت'
                    }
                    status={promotionState?.eligibility.atCeiling ? 'done' : 'in_progress'}
                    detailsLabel="رده و جزئیات"
                    onDetails={() => setOpenLadderSheet(true)}
                    onInfo={() => setInfoTopic('career')}
                    metrics={[
                      {
                        label: 'خالص حقوق ماهانه',
                        value: (
                          <span className="inline-flex items-center gap-1">
                            <MoneyText
                              amount={Math.round(player.job.annualSalaryToman / 12)}
                              currency="IRT"
                              mode="inline"
                              interactive={false}
                            />
                            <span>/ ماه</span>
                          </span>
                        ),
                        tone: 'success',
                      },
                      {
                        label: 'سابقه',
                        value: `${toPersianDigits(player.job.yearsInJob)} سال`,
                      },
                      {
                        label: 'استرس',
                        value: `${toPersianDigits(player.job.stress)}٪`,
                        tone: player.job.stress >= 70 ? 'danger' : 'default',
                      },
                    ]}
                  />
                ) : (
                  <HubHeroCard
                    icon={<IconCareerEdu className="h-5 w-5" />}
                    title={player.age < 18 ? 'پیش از سن استخدام عمومی' : t('career.unemployed')}
                    subtitle={
                      player.age < 18
                        ? 'استخدام عمومی از ۱۸ سالگی است؛ مسیرهای ویژه ورزشی و رسانه‌ای باز هستند.'
                        : 'از بازار کار شغل انتخاب کن یا کسب‌وکار مستقل بساز.'
                    }
                    status="waiting"
                    onInfo={() => setInfoTopic('career')}
                    metrics={[
                      { label: 'مدرک فعلی', value: currentStageLabel },
                      {
                        label: 'نقدینگی',
                        value: (
                          <MoneyText
                            amount={player.moneyToman}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                        ),
                      },
                      {
                        label: 'مسیر ویژه',
                        value: `${toPersianDigits(specialCareerCards.length)} مسیر`,
                      },
                    ]}
                  />
                )}

                {pinnedGoalInfo && (
                  <Card className="space-y-3" data-testid="career-goal-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <JobIconTile iconKey={pinnedGoalInfo.job.iconKey} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-strong)]">
                            <EmojiSprite emoji="🎯" label="هدف شغلی" className="text-xs" />
                            <span>{t('careerMarket.goalCardTitle')}</span>
                          </div>
                          <h4 className="mt-0.5 text-base font-bold leading-snug text-[var(--text)]">
                            {pinnedGoalInfo.job.shortTitle}
                          </h4>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {pinnedGoalInfo.readiness.shortGapFa}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-xl bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
                        {toPersianDigits(pinnedGoalInfo.readiness.score)}٪
                      </span>
                    </div>

                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
                      role="progressbar"
                      aria-valuenow={pinnedGoalInfo.readiness.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                        style={{ width: `${pinnedGoalInfo.readiness.score}%` }}
                      />
                    </div>

                    <ProgressStepper
                      orientation="vertical"
                      steps={pinnedGoalInfo.gapSteps.map((step) => ({
                        id: step.id,
                        title: step.titleFa,
                        subtitle: step.subtitleFa,
                        status: step.done ? 'done' : step.actionTarget ? 'current' : 'upcoming',
                      }))}
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(() => {
                        const nextActionable = pinnedGoalInfo.gapSteps.find(
                          (s) => !s.done && s.actionTarget,
                        );
                        if (nextActionable?.actionTarget) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleNavigateGapTarget(nextActionable.actionTarget!)}
                              className="min-h-[44px] flex-1 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--on-primary)] hover:bg-[var(--primary-strong)]"
                            >
                              {nextActionable.actionTarget.labelFa}
                            </button>
                          );
                        }
                        return null;
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          setInitialMarketJobId(pinnedGoalInfo.job.id);
                          setOpenJobBoardSheet(true);
                        }}
                        className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
                      >
                        مشاهده شغل
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSave(pinJobGoalAction(saveGame, pinnedGoalInfo.job.id))
                        }
                        className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        {t('careerMarket.unpinGoal')}
                      </button>
                    </div>
                  </Card>
                )}

                {(player.job ||
                  (!ownedBiz && pendingEmployerOffer) ||
                  (!ownedBiz && pendingFamilyInheritance)) && (
                  <SectionGroup title="اقدام‌های شغلی">
                    {!ownedBiz && pendingEmployerOffer && (
                      <ActionRow
                        icon={<IconCoins className="h-4 w-4" />}
                        emoji="💼"
                        title="پیشنهاد واگذاری کارفرما"
                        subtitle={pendingEmployerOffer.businessNameFa}
                        value={
                          <MoneyText
                            amount={pendingEmployerOffer.discountedPriceToman}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                        }
                        state="recommended"
                        isNew
                        showChevron
                        onClick={() => setOpenEmployerOfferSheet(true)}
                      />
                    )}
                    {!ownedBiz && pendingFamilyInheritance && (
                      <ActionRow
                        icon={<IconBuilding className="h-4 w-4" />}
                        title="ماترک کسب‌وکار خانوادگی"
                        subtitle={pendingFamilyInheritance.businessNameFa}
                        state="recommended"
                        isNew
                        showChevron
                        onClick={() => setOpenFamilyBizSheet(true)}
                      />
                    )}
                    {player.job && (
                      <>
                        <ActionRow
                          icon={<IconCareerEdu className="h-4 w-4" />}
                          title={t('career.overtime')}
                          subtitle="پاداش نقدی · سلامت -۳"
                          state={
                            getActionCooldownRemaining(state, 'career_overtime') > 0
                              ? 'cooldown'
                              : 'enabled'
                          }
                          ctaLabel="انجام"
                          onClick={() =>
                            onUpdateSave(performCareerAction(saveGame, 'overtime', gameDataset))
                          }
                        />
                        {!promotionState?.eligibility.noPromotions && (
                          <ActionRow
                            icon={<IconTrophy className="h-4 w-4" />}
                            title={
                              promotionState?.eligibility.atCeiling
                                ? 'تعدیل دستمزد در سقف رده'
                                : t('career.requestRaise')
                            }
                            subtitle={
                              promotionState?.eligibility.atCeiling
                                ? 'تعدیل حقوق بدون تغییر رده'
                                : 'ارزیابی ترفیع و تعدیل حقوق'
                            }
                            state={
                              getActionCooldownRemaining(state, 'career_raise') > 0
                                ? 'cooldown'
                                : 'enabled'
                            }
                            ctaLabel="درخواست"
                            onClick={() =>
                              onUpdateSave(performCareerAction(saveGame, 'raise', gameDataset))
                            }
                          />
                        )}
                        {promotionState && !promotionState.eligibility.noPromotions && (
                          <ActionRow
                            icon={<IconStar className="h-4 w-4" />}
                            iconTone="neutral"
                            title={t('career.ladderTitle')}
                            subtitle="پیش‌نیازهای رده بعد و تغییر محل کار"
                            value={`رده ${toPersianDigits(promotionState.eligibility.currentStep.level)} از ${toPersianDigits(promotionState.jobDef.ladder.length)}`}
                            showChevron
                            onClick={() => setOpenLadderSheet(true)}
                          />
                        )}
                      </>
                    )}
                  </SectionGroup>
                )}

                {ownedBiz && (
                  <SectionGroup title="کسب‌وکار شخصی">
                    <ActionRow
                      testId="owned-business-row"
                      icon={<IconBuilding className="h-4 w-4" />}
                      title={ownedBiz.nameFa}
                      subtitle={`${toPersianDigits(ownedBiz.branchCount)} شعبه · ${toPersianDigits(ownedBiz.yearsOperating)} سال فعالیت`}
                      value={
                        ownedBiz.yearsOperating === 0 ? (
                          'سال نخست'
                        ) : (
                          <MoneyText
                            amount={ownedBiz.lastYearProfitToman}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                        )
                      }
                      showChevron
                      onClick={() => setOpenOwnedBizSheet(true)}
                    />
                  </SectionGroup>
                )}

                <SectionGroup title="بازار کار و مسیرها">
                  {player.age >= 18 && (
                    <ActionRow
                      testId="job-board-entry"
                      icon={<IconCareerEdu className="h-4 w-4" />}
                      title={t('career.jobBoard')}
                      subtitle="مشاغل دولتی، خصوصی، آزاد و خانوادگی"
                      value={`${toPersianDigits(gameDataset.jobs.length)} شغل`}
                      showChevron
                      onClick={() => setOpenJobBoardSheet(true)}
                    />
                  )}
                  {player.age >= 18 && !ownedBiz && (
                    <ActionRow
                      testId="ownership-flow-card"
                      icon={<IconBuilding className="h-4 w-4" />}
                      title={t('career.ownershipFlowTitle')}
                      subtitle="تأسیس، خرید سرقفلی یا شراکت"
                      showChevron
                      onClick={() => {
                        setPreferredBizTypeId(undefined);
                        setOpenOwnershipFlowSheet(true);
                      }}
                    />
                  )}
                  <ActionRow
                    icon={<IconTrophy className="h-4 w-4" />}
                    title="مسیرهای حرفه‌ای ویژه"
                    subtitle="ورزش، موسیقی، هنر، بازیگری و رسانه"
                    value={`${toPersianDigits(specialCareerCards.length)} مسیر`}
                    showChevron
                    onClick={() => setOpenSpecialListSheet(true)}
                  />
                  {player.age >= 18 && (
                    <ActionRow
                      testId="licenses-card"
                      icon={<IconShield className="h-4 w-4" />}
                      title={t('career.licensesTitle')}
                      subtitle="پروانه و مجوزهای تخصصی رسمی"
                      value={`${toPersianDigits((player.licenses ?? []).length)} از ${toPersianDigits(licensesStatus.length)}`}
                      showChevron
                      onClick={() => setOpenLicensesSheet(true)}
                    />
                  )}
                  {workHistory.length > 0 && (
                    <ActionRow
                      icon={<IconBook className="h-4 w-4" />}
                      iconTone="neutral"
                      title={t('career.workHistory')}
                      subtitle="فهرست مشاغل و سال‌های گذشته"
                      value={`${toPersianDigits(workHistory.length)} سابقه`}
                      showChevron
                      onClick={() => setOpenWorkHistorySheet(true)}
                    />
                  )}
                </SectionGroup>

                {player.job && (
                  <DangerZoneGroup>
                    <ActionRow
                      variant="danger"
                      title={t('career.retire')}
                      subtitle="خروج از کار با مستمری بازنشستگی"
                      state={
                        player.age < 60 && player.job.yearsInJob < 25 ? 'locked' : 'enabled'
                      }
                      reason={
                        player.age < 60 && player.job.yearsInJob < 25
                          ? 'نیاز به ۶۰ سال سن یا ۲۵ سال سابقه'
                          : undefined
                      }
                      ctaLabel="بررسی"
                      onClick={() => setConfirmQuitMode('retire')}
                    />
                    <ActionRow
                      variant="danger"
                      title={t('career.quit')}
                      subtitle="قطع همکاری فوری و بی‌درآمد شدن"
                      ctaLabel="استعفا"
                      onClick={() => setConfirmQuitMode('quit')}
                    />
                  </DangerZoneGroup>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= 3. SKILLS HUB ================= */}
        {effectiveSubTab === 'skills' && (
          <div className="space-y-4">
            <HubHeroCard
              icon={<IconSkill className="h-5 w-5" />}
              title="پرورش استعدادها و مهارت‌ها"
              subtitle="تمرین سالانه گرایش‌های پنهان را کشف و شانس استخدام را تقویت می‌کند"
              onInfo={() => setInfoTopic('skills')}
              metrics={[
                {
                  label: 'استعداد کشف‌شده',
                  value: `${toPersianDigits(discoveredTalentsCount)} از ${toPersianDigits(talentOptions.length)}`,
                  tone: discoveredTalentsCount > 0 ? 'primary' : 'default',
                },
                {
                  label: 'مهارت تکمیل‌شده',
                  value: `${toPersianDigits(maxedSkillsCount)} از ${toPersianDigits(gameDataset.skills.length)}`,
                },
                {
                  label: 'نقدینگی',
                  value: (
                    <MoneyText
                      amount={player.moneyToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
              ]}
            />

            <SectionGroup
              title="استعدادها و گرایش‌های فردی"
              subtitle="برای تمرین، کلاس یا مسابقه روی هر زمینه بزن"
              action={
                <FilterChips
                  value={talentFilter}
                  onChange={setTalentFilter}
                  items={[
                    { value: 'all', label: 'همه' },
                    { value: 'discovered', label: 'کشف‌شده' },
                  ]}
                />
              }
            >
              {(() => {
                const filteredTalents = talentOptions.filter(
                  (opt) => talentFilter === 'all' || opt.isDiscovered,
                );
                if (talentFilter === 'discovered' && filteredTalents.length === 0) {
                  return (
                    <div className="p-4 text-xs leading-6 text-[var(--text-muted)]">
                      هنوز گرایش خاصی آشکار نشده است. با تمرین در زمینه‌های مختلف نشانه‌های استعدادت پیدا می‌شوند.
                    </div>
                  );
                }
                const visibleTalents =
                  filteredTalents.length > 7 ? filteredTalents.slice(0, 6) : filteredTalents;
                return (
                  <>
                    {visibleTalents.map((opt) => {
                      const ageLocked = player.age < opt.minPracticeAge;
                      const cooledDown = opt.cooldownRemaining > 0;
                      return (
                        <ActionRow
                          key={opt.talentId}
                          icon={<IconSkill className="h-4 w-4" />}
                          title={
                            opt.athleticDisciplineTitleFa
                              ? `${opt.titleFa} (${opt.athleticDisciplineTitleFa})`
                              : opt.titleFa
                          }
                          subtitle={`${opt.categoryFa} · مهارت: ${opt.skillLevelLabelFa}`}
                          statusChip={
                            ageLocked
                              ? 'locked'
                              : opt.isDiscovered
                                ? 'in_progress'
                                : 'waiting'
                          }
                          value={cooledDown ? 'یک بار در سال' : opt.discoveredTierLabelFa}
                          showChevron
                          onClick={() => setSelectedTalentId(opt.talentId)}
                        />
                      );
                    })}
                    {filteredTalents.length > 7 && (
                      <ActionRow
                        icon={<IconSkill className="h-4 w-4" />}
                        iconTone="neutral"
                        title={`مشاهده همه استعدادها (${toPersianDigits(filteredTalents.length)} زمینه)`}
                        subtitle="فهرست کامل گرایش‌های هنری، ورزشی و مهارتی"
                        showChevron
                        onClick={() => setOpenAllTalentsSheet(true)}
                      />
                    )}
                  </>
                );
              })()}
            </SectionGroup>

            <SectionGroup
              title="مهارت‌های کلیدی شغلی"
              subtitle="یک ضربه برای تمرین و ارتقای مستقیم"
            >
              {gameDataset.skills.slice(0, 6).map((skill) => {
                const level = getSkillLevel(state, skill.id);
                const cost = getSkillTrainingCost(skill, state);
                const cd = getActionCooldownRemaining(state, `skill_${skill.id}`);
                const ageLocked = player.age < skill.minAge;
                const maxed = level >= 5;
                const poor = player.moneyToman < cost;
                const rowState = maxed
                  ? 'done'
                  : ageLocked
                    ? 'locked'
                    : cd > 0
                      ? 'cooldown'
                      : poor
                        ? 'disabled'
                        : 'enabled';
                const reason = ageLocked
                  ? `از ${toPersianDigits(skill.minAge)} سالگی`
                  : poor
                    ? 'موجودی کافی نیست'
                    : undefined;

                return (
                  <ActionRow
                    key={skill.id}
                    icon={<IconSkill className="h-4 w-4" />}
                    title={skill.titleFa}
                    subtitle={skill.effectHintFa}
                    value={
                      maxed ? undefined : (
                        <span className="inline-flex items-center gap-1">
                          <MoneyText
                            amount={cost}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                          <span>· سطح {toPersianDigits(level)}/۵</span>
                        </span>
                      )
                    }
                    state={rowState}
                    reason={reason}
                    ctaLabel={maxed ? undefined : 'ارتقا'}
                    onClick={() => onUpdateSave(trainSkillAction(saveGame, skill))}
                  />
                );
              })}
              {gameDataset.skills.length > 6 && (
                <ActionRow
                  icon={<IconBook className="h-4 w-4" />}
                  iconTone="neutral"
                  title={`مشاهده همه مهارت‌ها (${toPersianDigits(gameDataset.skills.length)} مورد)`}
                  subtitle="فهرست کامل مهارت‌ها و نوار پیشرفت"
                  showChevron
                  onClick={() => setOpenAllSkillsSheet(true)}
                />
              )}
            </SectionGroup>
          </div>
        )}

        {/* ================= 4. MILITARY HUB ================= */}
        {effectiveSubTab === 'military' && showMilitary && (
          <div className="space-y-4">
            <HubHeroCard
              icon={<IconShield className="h-5 w-5" />}
              title="نظام وظیفه و سربازی"
              subtitle={`وضعیت فعلی: ${t(`military.${player.militaryStatus}`)}`}
              status={
                player.militaryStatus === 'serving'
                  ? 'in_progress'
                  : player.militaryStatus === 'completed' ||
                      player.militaryStatus.startsWith('exempt')
                    ? 'done'
                    : 'waiting'
              }
              onInfo={() => setInfoTopic('military')}
            />

            {player.militaryStatus === 'pending' ||
            player.militaryStatus === 'exempt_educational' ? (
              <>
                <SectionGroup title="مسیرهای تعیین تکلیف">
                  <ActionRow
                    icon={<IconShield className="h-4 w-4" />}
                    title="اعزام به خدمت سربازی (۲ سال)"
                    subtitle="پس از پایان ۲ سال کارت پایان خدمت می‌گیری"
                    value="رایگان"
                    ctaLabel="اعزام"
                    onClick={() =>
                      onUpdateSave(selectMilitaryOptionAction(saveGame, 'serve', gameDataset))
                    }
                  />
                  <ActionRow
                    icon={<IconCareerEdu className="h-4 w-4" />}
                    title="درخواست امریه سربازی"
                    subtitle="نیازمند مدرک کارشناسی یا بالاتر؛ خدمت اداری"
                    value="رایگان"
                    ctaLabel="درخواست"
                    onClick={() =>
                      onUpdateSave(selectMilitaryOptionAction(saveGame, 'amrieh', gameDataset))
                    }
                  />
                  <ActionRow
                    icon={<IconShield className="h-4 w-4" />}
                    title="کمیسیون معافیت پزشکی"
                    subtitle="شانس بیشتر در صورت سلامت پایین"
                    value="رایگان"
                    ctaLabel="بررسی"
                    onClick={() =>
                      onUpdateSave(
                        selectMilitaryOptionAction(saveGame, 'exempt_medical', gameDataset),
                      )
                    }
                  />
                  <ActionRow
                    icon={<IconShield className="h-4 w-4" />}
                    title="درخواست معافیت کفالت"
                    subtitle="ویژه سرپرستان خانواده"
                    value="رایگان"
                    ctaLabel="درخواست"
                    onClick={() =>
                      onUpdateSave(
                        selectMilitaryOptionAction(saveGame, 'exempt_breadwinner', gameDataset),
                      )
                    }
                  />
                  <ActionRow
                    icon={<IconCoins className="h-4 w-4" />}
                    title="خرید جریمه / معافیت نقدی"
                    subtitle="حل فوری وضعیت نظام وظیفه"
                    value={
                      <MoneyText
                        amount={buyoutCost}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    }
                    state={player.moneyToman < buyoutCost ? 'disabled' : 'enabled'}
                    reason={player.moneyToman < buyoutCost ? 'موجودی کافی نیست' : undefined}
                    ctaLabel="خرید"
                    onClick={() =>
                      onUpdateSave(selectMilitaryOptionAction(saveGame, 'buyout', gameDataset))
                    }
                  />
                </SectionGroup>

                <DangerZoneGroup>
                  <ActionRow
                    variant="danger"
                    title="به تعویق انداختن / غیبت"
                    subtitle="سلامت روان -۳ · محدودیت استخدام دولتی"
                    ctaLabel="ثبت"
                    onClick={() => setConfirmMilitaryDefer(true)}
                  />
                </DangerZoneGroup>
              </>
            ) : (
              <LockedNotice
                message={`وضعیت فعلی تو (${t(`military.${player.militaryStatus}`)}) ثبت شده است و تا پایان این مرحله نیازی به اقدام تازه نیست.`}
              />
            )}
          </div>
        )}
      </div>

      {/* ================= DRILL-DOWN SHEETS: EDUCATION ================= */}
      <DetailSheet
        open={openTrackSheet}
        onClose={() => setOpenTrackSheet(false)}
        title={t('education.chooseTrack')}
        subtitle="تأثیر مستقیم بر گرایش رشته‌های دانشگاهی"
      >
        <SectionGroup title="رشته‌های دوره دوم متوسطه">
          {TRACK_INFO.map((tr) => {
            const selected = player.education.highSchoolTrack === tr.id;
            return (
              <ActionRow
                key={tr.id}
                icon={<IconBook className="h-4 w-4" />}
                title={tr.label}
                subtitle={`${tr.focus} · مشاغل: ${tr.jobs}`}
                state={selected ? 'done' : 'enabled'}
                ctaLabel={selected ? undefined : 'انتخاب'}
                onClick={() => {
                  onUpdateSave(selectHighSchoolTrackAction(saveGame, tr.id));
                  setOpenTrackSheet(false);
                }}
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      <DetailSheet
        open={openUniSheet}
        onClose={() => setOpenUniSheet(false)}
        title="انتخاب رشته و ثبت‌نام دانشگاه"
        subtitle={
          player.education.konkurRank
            ? `رتبه فعلی: ${toPersianDigits(player.education.konkurRank.toLocaleString('en-US'))}`
            : undefined
        }
      >
        <SectionGroup title="گزینه‌های پذیرش دانشگاه">
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
              <ActionRow
                key={`${offer.tier}_${offer.majorFa}`}
                icon={<IconEducation className="h-4 w-4" />}
                title={`${offer.majorFa} — ${offer.tierLabel}`}
                subtitle={`${toPersianDigits(offer.years)} سال تحصیل`}
                value={
                  <MoneyText
                    amount={tuition}
                    currency="IRT"
                    mode="inline"
                    interactive={false}
                  />
                }
                state={!rankOk ? 'locked' : !moneyOk ? 'disabled' : 'enabled'}
                reason={
                  !rankOk
                    ? `نیازمند رتبه بهتر از ${toPersianDigits(offer.maxRank.toLocaleString('en-US'))}`
                    : !moneyOk
                      ? 'موجودی کافی نیست'
                      : undefined
                }
                ctaLabel="ثبت‌نام"
                onClick={() => {
                  const res = enrollUniversityAction(
                    saveGame,
                    offer.tier,
                    offer.majorFa,
                    offer.degree,
                    offer.years,
                    gameDataset,
                  );
                  onUpdateSave(res);
                  if (res.success) setOpenUniSheet(false);
                }}
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      <DetailSheet
        open={openEduHistorySheet}
        onClose={() => setOpenEduHistorySheet(false)}
        title={t('education.graduateHistory')}
      >
        <SectionGroup title="مقاطع ثبت‌شده">
          {eduHistory.map((item, idx) => (
            <ActionRow
              key={idx}
              icon={<IconEducation className="h-4 w-4" />}
              iconTone="neutral"
              title={item.stageFa}
              subtitle={item.detailFa}
              value={toPersianDigits(item.year)}
            />
          ))}
        </SectionGroup>
      </DetailSheet>

      {/* ================= DRILL-DOWN SHEETS: CAREER ================= */}
      <DetailSheet
        open={openLadderSheet}
        onClose={() => setOpenLadderSheet(false)}
        title={player.job?.title ?? t('career.ladderTitle')}
        subtitle="جزئیات حقوق، رده شغلی و پیش‌نیاز ترفیع"
        onInfo={() => setInfoTopic('salary_breakdown')}
      >
        {player.job && (
          <>
            <HubHeroCard
              icon={<IconCareerEdu className="h-5 w-5" />}
              title={player.job.title}
              subtitle={
                <span className="inline-flex items-center gap-1">
                  <span>معادل</span>
                  <MoneyText
                    amount={player.job.annualSalaryToman}
                    currency="IRT"
                    mode="single"
                    primaryOverride="USD"
                  />
                </span>
              }
              status={promotionState?.eligibility.atCeiling ? 'done' : 'in_progress'}
              onInfo={() => setInfoTopic('salary_breakdown')}
              metrics={[
                {
                  label: 'خالص سالانه',
                  value: (
                    <MoneyText
                      amount={player.job.annualSalaryToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                  tone: 'success',
                },
                {
                  label: 'ناخالص پارسال',
                  value:
                    lastJobGross !== null ? (
                      <MoneyText
                        amount={lastJobGross}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ) : (
                      '—'
                    ),
                },
                {
                  label: 'کسورات و مالیات',
                  value:
                    lastJobDeductions !== null ? (
                      <MoneyText
                        amount={lastJobDeductions}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ) : (
                      '—'
                    ),
                },
              ]}
            />

            {promotionState && (
              <Card className="space-y-3" data-testid="career-ladder-timeline">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{t('career.ladderTitle')}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    رده {toPersianDigits(promotionState.eligibility.currentStep.level)} از{' '}
                    {toPersianDigits(promotionState.jobDef.ladder.length)}
                  </span>
                </div>
                {promotionState.eligibility.noPromotions ? (
                  <p className="text-xs leading-5 text-[var(--text-muted)]">
                    {t('career.noPromotionsNote')}
                  </p>
                ) : (
                  <ProgressStepper
                    orientation="vertical"
                    steps={promotionState.jobDef.ladder.map((step) => {
                      const curr = promotionState.eligibility.currentStep.level;
                      return {
                        id: String(step.level),
                        title: step.titleFa,
                        subtitle: step.ceiling ? t('career.ceilingBadge') : undefined,
                        status: step.level < curr ? 'done' : step.level === curr ? 'current' : 'upcoming',
                      };
                    })}
                  />
                )}
              </Card>
            )}

            {promotionState &&
              !promotionState.eligibility.atCeiling &&
              !promotionState.eligibility.noPromotions &&
              promotionState.eligibility.nextStep && (
                <RequirementsChecklist
                  title={`پیش‌نیاز رده بعد: ${promotionState.eligibility.nextStep.titleFa} (شانس ${toPersianDigits(promotionState.eligibility.estimatedChancePct)}٪)`}
                  items={promotionState.eligibility.checks.map((chk) => ({
                    id: chk.id,
                    label: chk.labelFa,
                    met: chk.met,
                    currentText: chk.currentTextFa,
                    requiredText: chk.requiredTextFa,
                  }))}
                />
              )}

            {promotionState &&
              promotionState.eligibility.atCeiling &&
              !promotionState.eligibility.noPromotions && (
                <SectionGroup title={t('career.atCeilingTitle')} subtitle={t('career.atCeilingBody')}>
                  <ActionRow
                    title={t('career.changeWorkplace')}
                    subtitle="تلاش برای فرصت جدید در همین سطح"
                    state={
                      getActionCooldownRemaining(state, 'change_workplace') > 0
                        ? 'cooldown'
                        : 'enabled'
                    }
                    ctaLabel="تغییر"
                    onClick={() => onUpdateSave(changeWorkplaceAction(saveGame, gameDataset))}
                  />
                  <ActionRow
                    title="ارتقای مهارت‌ها"
                    subtitle="تقویت توانمندی برای مشاغل بالاتر"
                    showChevron
                    onClick={() => {
                      setOpenLadderSheet(false);
                      setSubTab('skills');
                    }}
                  />
                  <ActionRow
                    title="تغییر مسیر شغلی"
                    subtitle="جست‌وجو در بازار کار"
                    showChevron
                    onClick={() => {
                      setOpenLadderSheet(false);
                      setOpenJobBoardSheet(true);
                    }}
                  />
                  {promotionState.jobDef.ownershipPath.allowed ? (
                    <ActionRow
                      title={t('career.openOwnershipFlow')}
                      subtitle="راه‌اندازی کسب‌وکار مستقل در همین حوزه"
                      state="recommended"
                      showChevron
                      onClick={() => {
                        setPreferredBizTypeId(
                          promotionState.jobDef.ownershipPath.businessTypeId,
                        );
                        setOpenLadderSheet(false);
                        setOpenOwnershipFlowSheet(true);
                      }}
                    />
                  ) : (
                    <ActionRow
                      title="راه‌اندازی کسب‌وکار هم‌زمان"
                      state="locked"
                      reason="مالکیت هم‌زمان با شغل دولتی مجاز نیست"
                    />
                  )}
                </SectionGroup>
              )}
          </>
        )}
      </DetailSheet>

      {/* Job Compass Market Sheet */}
      <JobMarketSheet
        open={openJobBoardSheet}
        saveGame={saveGame}
        initialJobId={initialMarketJobId}
        onClose={() => {
          setOpenJobBoardSheet(false);
          setInitialMarketJobId(null);
        }}
        onUpdateSave={onUpdateSave}
        onSilentSaveUpdate={onEffortChange}
        onNavigateGapTarget={handleNavigateGapTarget}
      />

      {/* Special Careers List DetailSheet */}
      <DetailSheet
        open={openSpecialListSheet}
        onClose={() => setOpenSpecialListSheet(false)}
        title="مسیرهای حرفه‌ای ویژه"
        subtitle="هنر، ورزش، موسیقی، بازیگری و تولید محتوا"
        stickySubHeader={
          <FilterChips
            value={specialFilter}
            onChange={setSpecialFilter}
            items={[
              { value: 'all', label: 'همه مسیرهای ویژه' },
              { value: 'ready', label: 'مرتبط با گرایش‌های من' },
            ]}
          />
        }
      >
        <SectionGroup title="فهرست مسیرهای ویژه">
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
              return (
                <ActionRow
                  key={career.id}
                  icon={<IconTrophy className="h-4 w-4" />}
                  title={career.titleFa}
                  subtitle={`مرحله بعدی: ${eligibility.nextStageTitleFa} · مهارت: ${getQualitativeSkillLabelFa(eligibility.currentSkill)}`}
                  statusChip={
                    item.isCurrentSpecialJob
                      ? 'in_progress'
                      : eligibility.eligible
                        ? 'waiting'
                        : 'locked'
                  }
                  value={item.salaryText}
                  showChevron
                  onClick={() => setSelectedSpecialId(career.id)}
                />
              );
            })}
        </SectionGroup>
      </DetailSheet>

      {/* Single Special Career DetailSheet (z-[56]) */}
      <DetailSheet
        open={Boolean(activeSpecialCard)}
        onClose={() => setSelectedSpecialId(null)}
        title={activeSpecialCard?.career.titleFa ?? ''}
        subtitle="مراحل پیشرفت و مسیرهای ورود"
        zIndexClass="z-[56]"
      >
        {activeSpecialCard && (() => {
          const { career, eligibility } = activeSpecialCard;
          const activeRoute: SpecialCareerRouteId =
            selectedRoutes[career.id] ?? career.alternativeRoutes[0].id;
          const routeNote = formatSpecialRouteChoiceSummary(career, activeRoute, state);
          const cdRemaining = getActionCooldownRemaining(state, `special_${career.id}`, 1);
          const tryDisabled = !eligibility.eligible || cdRemaining > 0;
          const tryDisabledReason =
            cdRemaining > 0 ? 'فقط یک بار در سال' : eligibility.reason;

          return (
            <>
              <HubHeroCard
                icon={<IconTrophy className="h-5 w-5" />}
                title={career.titleFa}
                subtitle={`مرحله فعلی: ${toPersianDigits(eligibility.currentStage)} از ۴ · مهارت: ${getQualitativeSkillLabelFa(eligibility.currentSkill)}`}
                status={
                  activeSpecialCard.isCurrentSpecialJob
                    ? 'in_progress'
                    : eligibility.eligible
                      ? 'waiting'
                      : 'locked'
                }
                metrics={[
                  { label: 'درآمد مرحله بعد', value: activeSpecialCard.salaryText, tone: 'success' },
                  { label: 'شانس پذیرش', value: `${toPersianDigits(eligibility.estimatedChancePct)}٪` },
                  { label: 'جایگزین پایدار', value: career.fallbackCareerFa },
                ]}
              />

              <Card className="space-y-3">
                <div className="text-xs font-bold">مراحل حرفه‌ای مسیر</div>
                <ProgressStepper
                  orientation="vertical"
                  steps={career.stageTitlesFa.slice(0, 4).map((titleFa, idx) => ({
                    id: `stg_${idx}`,
                    title: titleFa,
                    status:
                      idx < eligibility.currentStage
                        ? 'done'
                        : idx === eligibility.currentStage
                          ? 'current'
                          : 'upcoming',
                  }))}
                />
              </Card>

              <SectionGroup title="انتخاب مسیر ورود">
                <div className="p-2.5 space-y-2">
                  <SegmentedControl
                    value={activeRoute}
                    onChange={(routeId) =>
                      setSelectedRoutes((prev) => ({ ...prev, [career.id]: routeId }))
                    }
                    items={career.alternativeRoutes.map((r) => ({
                      value: r.id,
                      label: r.titleFa,
                    }))}
                  />
                  {routeNote && (
                    <p className="text-xs leading-5 text-[var(--text-muted)]">{routeNote}</p>
                  )}
                </div>
              </SectionGroup>

              <div className="space-y-2">
                <ActionButton
                  label={
                    activeSpecialCard.isCurrentSpecialJob && eligibility.currentStage < 4
                      ? `ارتقا به مرحله بعد: ${eligibility.nextStageTitleFa}`
                      : `آزمون و پیگیری: ${eligibility.nextStageTitleFa}`
                  }
                  costText={activeSpecialCard.salaryText}
                  effectHint="درآمد متغیر + شهرت در صورت پذیرش"
                  disabled={tryDisabled}
                  disabledReason={tryDisabledReason}
                  onClick={() =>
                    onUpdateSave(
                      pursueSpecialCareerAction(saveGame, career.id, activeRoute, gameDataset),
                    )
                  }
                />
                {activeSpecialCard.fallbackEligible && !activeSpecialCard.isCurrentFallbackJob && (
                  <ActionButton
                    label={`مسیر جایگزین پایدار: ${career.fallbackCareerFa}`}
                    costText={activeSpecialCard.fallbackSalaryText}
                    effectHint="درآمد باثبات‌تر و اتکا به مهارت"
                    variant="secondary"
                    onClick={() =>
                      onUpdateSave(
                        enterSpecialFallbackCareerAction(saveGame, career.id, gameDataset),
                      )
                    }
                  />
                )}
              </div>
            </>
          );
        })()}
      </DetailSheet>

      {/* Work History DetailSheet */}
      <DetailSheet
        open={openWorkHistorySheet}
        onClose={() => setOpenWorkHistorySheet(false)}
        title={t('career.workHistory')}
      >
        <SectionGroup title="سوابق کاری ثبت‌شده">
          {workHistory.map((item, idx) => (
            <ActionRow
              key={idx}
              icon={<IconCareerEdu className="h-4 w-4" />}
              iconTone="neutral"
              title={item.title}
              subtitle={item.employer}
              value={`${toPersianDigits(item.fromYear)} – ${item.toYear ? toPersianDigits(item.toYear) : 'اکنون'}`}
            />
          ))}
        </SectionGroup>
      </DetailSheet>

      {/* Ownership & Business DetailSheets */}
      {ownedBiz && (
        <OwnedBusinessDetailSheet
          open={openOwnedBizSheet}
          saveGame={saveGame}
          ownedBiz={ownedBiz}
          onClose={() => setOpenOwnedBizSheet(false)}
          onUpdateSave={onUpdateSave}
        />
      )}

      <OwnershipFlowDetailSheet
        open={openOwnershipFlowSheet}
        saveGame={saveGame}
        preferredBusinessTypeId={preferredBizTypeId}
        onClose={() => setOpenOwnershipFlowSheet(false)}
        onUpdateSave={onUpdateSave}
      />

      <LicensesDetailSheet
        open={openLicensesSheet}
        saveGame={saveGame}
        onClose={() => setOpenLicensesSheet(false)}
        onUpdateSave={onUpdateSave}
      />

      {pendingEmployerOffer && (
        <EmployerOfferDetailSheet
          open={openEmployerOfferSheet}
          saveGame={saveGame}
          offer={pendingEmployerOffer}
          onClose={() => setOpenEmployerOfferSheet(false)}
          onUpdateSave={onUpdateSave}
        />
      )}

      {pendingFamilyInheritance && (
        <FamilyInheritanceDetailSheet
          open={openFamilyBizSheet}
          saveGame={saveGame}
          pending={pendingFamilyInheritance}
          onClose={() => setOpenFamilyBizSheet(false)}
          onUpdateSave={onUpdateSave}
        />
      )}

      {/* ================= DRILL-DOWN SHEETS: SKILLS ================= */}
      <DetailSheet
        open={openAllTalentsSheet}
        onClose={() => setOpenAllTalentsSheet(false)}
        title="همه استعدادها و گرایش‌ها"
        subtitle="برای تمرین، کلاس یا مسابقه روی هر زمینه بزن"
      >
        <SectionGroup title="زمینه‌های فردی">
          {talentOptions.map((opt) => {
            const ageLocked = player.age < opt.minPracticeAge;
            const cooledDown = opt.cooldownRemaining > 0;
            return (
              <ActionRow
                key={opt.talentId}
                icon={<IconSkill className="h-4 w-4" />}
                title={
                  opt.athleticDisciplineTitleFa
                    ? `${opt.titleFa} (${opt.athleticDisciplineTitleFa})`
                    : opt.titleFa
                }
                subtitle={`${opt.categoryFa} · مهارت: ${opt.skillLevelLabelFa}`}
                statusChip={
                  ageLocked ? 'locked' : opt.isDiscovered ? 'in_progress' : 'waiting'
                }
                value={cooledDown ? 'یک بار در سال' : opt.discoveredTierLabelFa}
                showChevron
                onClick={() => setSelectedTalentId(opt.talentId)}
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      <DetailSheet
        open={Boolean(activeTalent)}
        onClose={() => setSelectedTalentId(null)}
        title={activeTalent?.titleFa ?? ''}
        subtitle={
          activeTalent
            ? `${activeTalent.categoryFa} · مهارت: ${activeTalent.skillLevelLabelFa}`
            : undefined
        }
        zIndexClass="z-[56]"
      >
        {activeTalent && (() => {
          const ageLocked = player.age < activeTalent.minPracticeAge;
          const cooledDown = activeTalent.cooldownRemaining > 0;
          const cantAffordLesson = player.moneyToman < activeTalent.lessonCostToman;
          const auditionCost = Math.round(activeTalent.lessonCostToman * 0.5);
          const cantAffordAudition = player.moneyToman < auditionCost;
          const commonBlockedState = ageLocked ? 'locked' : cooledDown ? 'cooldown' : 'enabled';
          const commonReason = ageLocked
            ? `از ${toPersianDigits(activeTalent.minPracticeAge)} سالگی فعال می‌شود`
            : undefined;

          return (
            <>
              <HubHeroCard
                icon={<IconSkill className="h-5 w-5" />}
                title={activeTalent.titleFa}
                subtitle={
                  activeTalent.athleticDisciplineTitleFa
                    ? `رشته: ${activeTalent.athleticDisciplineTitleFa}`
                    : activeTalent.categoryFa
                }
                status={
                  ageLocked ? 'locked' : activeTalent.isDiscovered ? 'in_progress' : 'waiting'
                }
                metrics={[
                  {
                    label: 'وضعیت استعداد',
                    value: activeTalent.discoveredTierLabelFa ?? 'کشف‌نشده',
                    tone: activeTalent.isDiscovered ? 'primary' : 'default',
                  },
                  { label: 'سطح مهارت', value: activeTalent.skillLevelLabelFa },
                  {
                    label: 'هزینه کلاس',
                    value: (
                      <MoneyText
                        amount={activeTalent.lessonCostToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                ]}
              />

              <SectionGroup title="روش‌های پرورش و شکوفایی">
                <ActionRow
                  title="تمرین فردی"
                  subtitle="افزایش تدریجی مهارت و احتمال کشف گرایش"
                  value="رایگان"
                  state={commonBlockedState}
                  reason={commonReason}
                  ctaLabel="تمرین"
                  onClick={() =>
                    onUpdateSave(
                      developTalentAction(
                        saveGame,
                        activeTalent.talentId,
                        'self_practice',
                        gameDataset,
                      ),
                    )
                  }
                />
                <ActionRow
                  title={activeTalent.lessonTitleFa}
                  subtitle="رشد سریع‌تر زیر نظر مربی یا استاد"
                  value={
                    <MoneyText
                      amount={activeTalent.lessonCostToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
                  state={
                    commonBlockedState !== 'enabled'
                      ? commonBlockedState
                      : cantAffordLesson
                        ? 'disabled'
                        : 'enabled'
                  }
                  reason={
                    commonReason ?? (cantAffordLesson ? 'موجودی کافی نیست' : undefined)
                  }
                  ctaLabel="شرکت"
                  onClick={() =>
                    onUpdateSave(
                      developTalentAction(
                        saveGame,
                        activeTalent.talentId,
                        'lesson_or_club',
                        gameDataset,
                      ),
                    )
                  }
                />
                {player.age >= 10 && (
                  <ActionRow
                    title="مسابقه و فراخوان"
                    subtitle="آزمون توانمندی و افزایش شهرت"
                    value={
                      <MoneyText
                        amount={auditionCost}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    }
                    state={
                      commonBlockedState !== 'enabled'
                        ? commonBlockedState
                        : cantAffordAudition
                          ? 'disabled'
                          : 'enabled'
                    }
                    reason={
                      commonReason ?? (cantAffordAudition ? 'موجودی کافی نیست' : undefined)
                    }
                    ctaLabel="شرکت"
                    onClick={() =>
                      onUpdateSave(
                        developTalentAction(
                          saveGame,
                          activeTalent.talentId,
                          'audition_or_contest',
                          gameDataset,
                        ),
                      )
                    }
                  />
                )}
                {player.age >= 14 && (
                  <ActionRow
                    title="انتشار آنلاین"
                    subtitle="نمایش نمونه کار و جذب مخاطب"
                    value="رایگان"
                    state={commonBlockedState}
                    reason={commonReason}
                    ctaLabel="انتشار"
                    onClick={() =>
                      onUpdateSave(
                        developTalentAction(
                          saveGame,
                          activeTalent.talentId,
                          'publish_online',
                          gameDataset,
                        ),
                      )
                    }
                  />
                )}
              </SectionGroup>
            </>
          );
        })()}
      </DetailSheet>

      <DetailSheet
        open={openAllSkillsSheet}
        onClose={() => setOpenAllSkillsSheet(false)}
        title="همه مهارت‌های کلیدی شغلی"
        subtitle="فهرست کامل مهارت‌ها و ارتقای یک‌ضرب"
      >
        <SectionGroup title="مهارت‌های تخصصی و عمومی">
          {gameDataset.skills.map((skill) => {
            const level = getSkillLevel(state, skill.id);
            const cost = getSkillTrainingCost(skill, state);
            const cd = getActionCooldownRemaining(state, `skill_${skill.id}`);
            const ageLocked = player.age < skill.minAge;
            const maxed = level >= 5;
            const poor = player.moneyToman < cost;
            const rowState = maxed
              ? 'done'
              : ageLocked
                ? 'locked'
                : cd > 0
                  ? 'cooldown'
                  : poor
                    ? 'disabled'
                    : 'enabled';
            const reason = ageLocked
              ? `از ${toPersianDigits(skill.minAge)} سالگی`
              : poor
                ? 'موجودی کافی نیست'
                : undefined;

            return (
              <ActionRow
                key={skill.id}
                icon={<IconSkill className="h-4 w-4" />}
                title={skill.titleFa}
                subtitle={skill.descriptionFa}
                value={
                  maxed ? undefined : (
                    <span className="inline-flex items-center gap-1">
                      <MoneyText amount={cost} currency="IRT" mode="inline" interactive={false} />
                      <span>· سطح {toPersianDigits(level)}/۵</span>
                    </span>
                  )
                }
                state={rowState}
                reason={reason}
                ctaLabel={maxed ? undefined : 'ارتقا'}
                onClick={() => onUpdateSave(trainSkillAction(saveGame, skill))}
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      {/* ================= INFO & CONFIRM DIALOGS ================= */}
      <InfoSheet
        open={infoTopic === 'education'}
        onClose={() => setInfoTopic(null)}
        title="راهنمای تحصیل و کنکور"
        bullets={[
          'تلاش درسی بالاتر معدل و شانس کنکور را افزایش می‌دهد اما فشار روانی را بالا می‌برد.',
          'کلاس تقویتی یک بار در سال قابل استفاده است و جهش قابل توجهی در معدل ایجاد می‌کند.',
          'پس از اخذ دیپلم، با شرکت در کنکور می‌توانی بر اساس رتبه در دانشگاه ثبت‌نام کنی.',
        ]}
      />

      <InfoSheet
        open={infoTopic === 'career'}
        onClose={() => setInfoTopic(null)}
        title="راهنمای بازار کار و مالکیت"
        bullets={[
          'مبالغ نمایش‌داده‌شده در بازار کار، خالص دریافتی پس از کسر بیمه، مالیات و هزینه جاری هستند.',
          'در هر شغل کارمندی می‌توانی تا سقف رده استخدامی ارتقا بگیری و سپس به فکر تغییر مسیر یا کسب‌وکار باشی.',
        ]}
      />

      <InfoSheet
        open={infoTopic === 'salary_breakdown'}
        onClose={() => setInfoTopic(null)}
        title="جزئیات فیش حقوقی سالانه"
        bullets={[
          'حقوق ناخالص شامل پایه حقوق، مزایا و اضافه‌کاری‌های احتمالی است.',
          'مالیات بر درآمد پلکانی، حق بیمه و هزینه‌های شغلی از حقوق ناخالص کسر می‌شوند.',
          'در صورت رسیدن به سقف رده سازمانی، می‌توانی تعدیل دستمزد بگیری یا کسب‌وکار مستقل باز کنی.',
        ]}
      />

      <InfoSheet
        open={infoTopic === 'skills'}
        onClose={() => setInfoTopic(null)}
        title="استعدادهای پنهان و مهارت شغلی"
        bullets={[
          'تمرین مستمر در یک زمینه می‌تواند گرایش ذاتی تو را آشکار کند.',
          'کشف استعداد و رساندن مهارت به سطح مناسب، دروازه ورود به مسیرهای ویژه هنری و ورزشی است.',
        ]}
      />

      <InfoSheet
        open={infoTopic === 'military'}
        onClose={() => setInfoTopic(null)}
        title="قوانین نظام وظیفه"
        bullets={[
          'در زمان تحصیل دانشگاهی از معافیت تحصیلی برخوردار هستی.',
          'در حین خدمت سربازی تمام‌وقت، استخدام عمومی موقتاً متوقف می‌شود.',
          'غیبت و تعویق مکرر محدودیت استخدام دولتی ایجاد می‌کند.',
        ]}
      />

      <ConfirmDialog
        open={confirmQuitMode !== null}
        title={confirmQuitMode === 'retire' ? 'تأیید بازنشستگی' : 'تأیید استعفا'}
        message={
          confirmQuitMode === 'retire'
            ? 'آیا می‌خواهی بازنشسته شوی و حقوق مستمری سالانه دریافت کنی؟'
            : 'آیا مطمئنی که می‌خواهی از شغل فعلی استعفا بدهی؟ درآمد شغلی متوقف می‌شود.'
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

      <ConfirmDialog
        open={confirmMilitaryDefer}
        title="تأیید به تعویق انداختن خدمت"
        message="ثبت غیبت یا تعویق موجب افت سلامت روان و محدودیت در استخدام‌های دولتی می‌شود. ادامه می‌دهی؟"
        destructive
        onCancel={() => setConfirmMilitaryDefer(false)}
        onConfirm={() => {
          onUpdateSave(selectMilitaryOptionAction(saveGame, 'defer', gameDataset));
          setConfirmMilitaryDefer(false);
        }}
      />
    </FullScreenSheet>
  );
}

