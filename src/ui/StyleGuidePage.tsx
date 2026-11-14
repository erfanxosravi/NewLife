import { useMemo, useState } from 'react';
import { gameDataset } from '../data/registry';
import { createNewSaveGame } from '../engine/generator';
import { toPersianDigits } from '../engine/jalali';
import {
  deriveDefaultPriorities,
  getJobMarketListings,
  type JobMarketItem,
} from '../engine/jobCompass';
import type { JobCompassPriorities } from '../engine/types';
import {
  ActionButton,
  ActionRow,
  AgeBadge,
  Badge,
  Card,
  ConfirmDialog,
  CurrencyText,
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
  SectionHeader,
  SegmentedControl,
  Slider,
  Sparkline,
  StatBar,
  StatusChip,
  Toast,
  Toggle,
} from './components/Primitives';
import { PersonAvatar } from './components/PersonAvatar';
import { ChecklistCard, InspectorVisitCard } from './components/AdoptionCards';
import { BottomSheet } from './components/BottomSheet';
import {
  COMPARE_SERIES_COLORS,
  CompareSheet,
  FingerprintRadar,
  JobDeck,
  JobDetailSheet,
  JobRow,
  MatchRing,
  PrioritySheet,
  PriorityStrip,
  ReadinessRing,
  prioritiesToRadarValues,
} from './components/jobCompass';
import {
  IconBackRtl,
  IconBrandMark,
  IconCareerEdu,
  IconCoins,
  IconEducation,
  IconHappiness,
  IconHealth,
  IconLooks,
  IconMentalHealth,
  IconMoon,
  IconShield,
  IconSmarts,
  IconStanding,
  IconSun,
  IconTrophy,
} from './icons';
import type { ThemePreference } from '../storage/saveStore';

interface StyleGuidePageProps {
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onChangeTheme: (next: ThemePreference) => void;
  onExit: () => void;
}

export function StyleGuidePage({
  resolvedTheme,
  onChangeTheme,
  onExit,
}: StyleGuidePageProps) {
  const [segment, setSegment] = useState<'a' | 'b' | 'c'>('a');
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>('all');
  const [toggleOn, setToggleOn] = useState(true);
  const [sliderVal, setSliderVal] = useState(65);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  // Job Compass StyleGuide fixture state
  const sampleSave = useMemo(() => {
    const sg = createNewSaveGame(
      { seed: 'styleguide-job-compass', birthCityId: 'tehran', birthJalaliYear: 1384 },
      gameDataset,
    );
    sg.state.currentJalaliYear = 1405;
    sg.state.player.age = 21;
    sg.state.player.education.level = 'diploma';
    sg.state.player.education.inSchool = false;
    sg.state.player.militaryStatus = 'completed';
    sg.state.player.discoveredTalents = [
      {
        talentId: 'visual_art',
        tier: 'clear_talent',
        discoveredAge: 16,
        hintTextFa: 'استعداد هنری و کار با فرم و رنگ',
      },
    ];
    return sg;
  }, []);
  const defaultPriorities = useMemo(
    () => deriveDefaultPriorities(sampleSave.state),
    [sampleSave],
  );
  const [jcPriorities, setJcPriorities] = useState<JobCompassPriorities>(defaultPriorities);
  const [jcCustomized, setJcCustomized] = useState(false);
  const [jcPriorityOpen, setJcPriorityOpen] = useState(false);
  const [jcSalaryUnit, setJcSalaryUnit] = useState<'monthly' | 'annual'>('monthly');
  const [jcSelectedItem, setJcSelectedItem] = useState<JobMarketItem | null>(null);
  const [jcCompareOpen, setJcCompareOpen] = useState(false);
  const [jcShortlist, setJcShortlist] = useState<string[]>(['barber']);
  const [jcPinnedId, setJcPinnedId] = useState<string | null>('software_engineer');

  const jcListings = useMemo(
    () =>
      getJobMarketListings(sampleSave.state, gameDataset, {
        priorities: jcPriorities,
      }),
    [sampleSave, jcPriorities],
  );
  const sampleReady = jcListings.ready[0] ?? jcListings.allItems[0];
  const sampleNearLocked = jcListings.nearReady[0] ?? jcListings.allItems[1];
  const sampleFutureLocked = jcListings.future[0] ?? jcListings.allItems[2];
  const sampleCompareItems = [sampleReady, sampleNearLocked].filter(Boolean);

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--surface-2)]">
      <div className="flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg)] text-[var(--text)] sm:border-x sm:border-[var(--border)]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onExit}
              aria-label="بازگشت به بازی"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <IconBackRtl className="h-5 w-5" />
            </button>
            <IconBrandMark className="h-7 w-7" />
            <div>
              <h1 className="text-base font-bold">راهنمای اجزا و رنگ‌ها</h1>
              <p className="text-[11px] text-[var(--text-muted)]">الگوی هاب + فهرست گروهی + صفحه جزئیات</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChangeTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)]"
          >
            {resolvedTheme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            <span>{resolvedTheme === 'dark' ? 'روشن' : 'تیره'}</span>
          </button>
        </header>

        <main className="flex-1 space-y-5 p-4 pb-10">
          {/* HubHeroCard + MetricTriplet */}
          <div className="space-y-3">
            <SectionHeader title="کارت خلاصه هاب و سه‌گانه آمار" subtitle="الگوی ثابت بالای هر صفحه" />
            <HubHeroCard
              icon={<IconCareerEdu className="h-5 w-5" />}
              title="کارشناس ارشد نرم‌افزار"
              subtitle="شرکت خصوصی · مسیر ترفیع فعال است"
              status="in_progress"
              onInfo={() => setInfoOpen(true)}
              onDetails={() => setDetailOpen(true)}
              metrics={[
                { label: 'خالص سالانه', value: '۴۸۰ میلیون تومان', tone: 'success' },
                { label: 'سابقه', value: '۴ سال' },
                { label: 'استرس', value: '۳۲٪', tone: 'primary' },
              ]}
            />
            <HubHeroCard
              tone="primary"
              icon={<IconCoins className="h-5 w-5" />}
              title="دارایی خالص"
              subtitle="وضعیت مالی پایدار · رشد سالانه مثبت"
              onInfo={() => setInfoOpen(true)}
              metrics={[
                { label: 'نقدینگی', value: '۲۵۰ میلیون' },
                { label: 'درآمد خالص', value: '۴۸۰ میلیون' },
                { label: 'بدهی کل', value: '۰ تومان' },
              ]}
            />
          </div>

          {/* SectionGroup + ActionRow all 6 states */}
          <SectionGroup
            title="گروه ردیف‌های اقدام (تمام وضعیت‌ها)"
            onInfo={() => setInfoOpen(true)}
          >
            <ActionRow
              icon={<IconTrophy className="h-5 w-5" />}
              emoji="⭐"
              title="ردیف پیشنهادی (پیشنهاد ویژه)"
              subtitle="دارای زمینه نارنجی ملایم و نشان ستاره"
              state="recommended"
              isNew
              ctaLabel="اجرا"
              onClick={() => {
                setToastOpen(true);
                window.setTimeout(() => setToastOpen(false), 2000);
              }}
            />
            <ActionRow
              icon={<IconEducation className="h-5 w-5" />}
              title="ردیف فعال استاندارد"
              subtitle="زیرنویس کوتاه یک‌خطی برای توضیح اثر"
              value="۵ میلیون تومان"
              showChevron
              onClick={() => setDetailOpen(true)}
            />
            <ActionRow
              icon={<IconSmarts className="h-5 w-5" />}
              title="ردیف انجام‌شده"
              subtitle="پیش‌نیاز یا خرید غیرتکراری تکمیل شده است"
              state="done"
            />
            <ActionRow
              icon={<IconSun className="h-5 w-5" />}
              title="ردیف در انتظار سال بعد"
              subtitle="سهمیه سال جاری مصرف شده است"
              state="cooldown"
            />
            <ActionRow
              icon={<IconShield className="h-5 w-5" />}
              title="ردیف قفل با دلیل مشخص"
              state="locked"
              reason="نیازمند حداقل ۱۸ سال سن و مدرک دیپلم"
              onClick={() => {}}
            />
            <ActionRow
              icon={<IconCoins className="h-5 w-5" />}
              title="ردیف غیرفعال (کمبود بودجه)"
              state="disabled"
              reason="موجودی کافی نیست"
              onClick={() => {}}
            />
          </SectionGroup>

          {/* Collapsed DangerZoneGroup */}
          <DangerZoneGroup>
            <ActionRow
              variant="danger"
              title="استعفا یا اقدام حساس"
              subtitle="همیشه همراه با پنجره تأیید و پیامد مشخص"
              ctaLabel="بررسی"
              onClick={() => setConfirmOpen(true)}
            />
          </DangerZoneGroup>

          {/* StatusChips */}
          <Card className="space-y-2.5">
            <SectionHeader title="برچسب وضعیت استاندارد" subtitle="دقیقاً چهار وضعیت رسمی" />
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status="waiting" />
              <StatusChip status="in_progress" />
              <StatusChip status="locked" />
              <StatusChip status="done" />
            </div>
          </Card>

          {/* ProgressStepper & RequirementsChecklist */}
          <Card className="space-y-4">
            <SectionHeader title="مراحل پیشرفت و فهرست پیش‌نیازها" />
            <ProgressStepper
              orientation="horizontal"
              steps={[
                { id: '1', title: 'مدارک', status: 'done' },
                { id: '2', title: 'زبان', status: 'current' },
                { id: '3', title: 'پذیرش', status: 'upcoming' },
                { id: '4', title: 'ویزا', status: 'locked' },
              ]}
            />
            <ProgressStepper
              orientation="vertical"
              steps={[
                { id: '1', title: 'کارآموز', subtitle: 'گام آغازین مسیر', status: 'done' },
                { id: '2', title: 'کارشناس میانی', subtitle: 'رده فعلی شغلی', status: 'current' },
                { id: '3', title: 'کارشناس ارشد', subtitle: 'نیازمند سابقه و عملکرد بالا', status: 'upcoming' },
              ]}
            />
            <RequirementsChecklist
              title="پیش‌نیازهای ارتقا"
              items={[
                { id: 'edu', label: 'مدرک کارشناسی', met: true, currentText: 'دارا', requiredText: 'کارشناسی' },
                {
                  id: 'exp',
                  label: 'سابقه کاری مرتبط',
                  met: false,
                  currentText: '۲ سال',
                  requiredText: '۴ سال',
                  fixHint: 'با گذراندن سال‌های کاری سابقه تکمیل می‌شود.',
                },
              ]}
            />
          </Card>

          {/* Stat Bars */}
          <Card>
            <SectionHeader title="شاخص‌های رنگی و مبالغ" />
            <div className="space-y-2.5">
              <StatBar label="شادی" value={82} delta={4} colorVar="--stat-happiness" icon={<IconHappiness className="h-3.5 w-3.5 text-[var(--stat-happiness)]" />} />
              <StatBar label="سلامت" value={74} delta={-2} colorVar="--stat-health" icon={<IconHealth className="h-3.5 w-3.5 text-[var(--stat-health)]" />} />
              <StatBar label="هوش" value={68} colorVar="--stat-smarts" icon={<IconSmarts className="h-3.5 w-3.5 text-[var(--stat-smarts)]" />} />
              <StatBar label="ظاهر" value={61} colorVar="--stat-looks" icon={<IconLooks className="h-3.5 w-3.5 text-[var(--stat-looks)]" />} />
              <StatBar label="سلامت روان" value={79} colorVar="--stat-mental" icon={<IconMentalHealth className="h-3.5 w-3.5 text-[var(--stat-mental)]" />} />
              <StatBar label="جایگاه اجتماعی" value={44} colorVar="--stat-standing" icon={<IconStanding className="h-3.5 w-3.5 text-[var(--stat-standing)]" />} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AgeBadge age={24} jalaliYear={1403} />
              <Badge tone="primary">شغل فعلی</Badge>
              <Badge tone="success">تأیید شده</Badge>
              <Badge tone="warning">هشدار مالی</Badge>
              <Badge tone="danger">ریسک بالا</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">موجودی نمونه</div>
                <div className="text-base font-bold text-[var(--primary-strong)]">
                  <CurrencyText amountToman={1_450_000_000} />
                </div>
              </div>
              <ProgressRing value={17.5} max={20} label="۱۷.۵" />
            </div>
            <div className="mt-3">
              <Sparkline values={[42, 48, 45, 55, 62, 60, 74]} />
            </div>
          </Card>

          {/* Controls & Navigation */}
          <Card className="space-y-3">
            <SectionHeader title="کنترل‌ها و ناوبری" />
            <SegmentedControl
              value={segment}
              onChange={setSegment}
              items={[
                { value: 'a', label: 'تحصیل' },
                { value: 'b', label: 'شغل' },
                { value: 'c', label: 'مهارت‌ها' },
              ]}
            />
            <FilterChips
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'همه' },
                { value: 'work', label: 'فقط کاری' },
                { value: 'life', label: 'شخصی' },
              ]}
            />
            <Slider
              label="تلاش درسی"
              value={sliderVal}
              minLabel="آرام"
              maxLabel="فشرده"
              valueLabel={`${toPersianDigits(sliderVal)}٪`}
              onChange={setSliderVal}
            />
            <Toggle
              checked={toggleOn}
              onChange={setToggleOn}
              label="نمایش رویدادهای اجتماعی"
              description="نمونه سوییچ با توضیح کوتاه"
            />
          </Card>

          {/* Button Hierarchy */}
          <Card className="space-y-2.5">
            <SectionHeader title="سلسله‌مراتب دکمه‌ها" subtitle="قرمز توپر فقط داخل پنجره تأیید نهایی مجاز است" />
            <ActionButton
              label="دکمه اصلی (پررنگ نارنجی)"
              costText="۴۵ میلیون تومان"
              effectHint="افزایش مهارت و شانس استخدام"
              variant="primary"
              onClick={() => {
                setToastOpen(true);
                window.setTimeout(() => setToastOpen(false), 2200);
              }}
            />
            <ActionButton
              label="دکمه ثانویه (خط‌دار سفید)"
              costText="رایگان"
              effectHint="باز کردن برگه کشویی نمونه"
              variant="secondary"
              onClick={() => setBottomOpen(true)}
            />
            <ActionButton
              label="دکمه کمکی سوم (متنی)"
              effectHint="نمایش راهنمای بخش"
              variant="tertiary"
              onClick={() => setInfoOpen(true)}
            />
            <ActionButton
              label="دکمه حساس خط‌دار قرمز"
              variant="danger"
              onClick={() => setConfirmOpen(true)}
            />
            <ActionButton
              label="دکمه غیرفعال"
              disabledReason="فقط یک بار در سال"
              disabled
            />
            <LockedNotice message="این بخش از ۱۸ سالگی فعال می‌شود." />
          </Card>

          <EmptyState
            title="نمونه وضعیت خالی"
            description="وقتی هنوز موردی ثبت نشده باشد، این پیام راهنما نمایش داده می‌شود."
          />

          {/* PersonAvatar + Adoption Cards Showcase */}
          <Card className="space-y-3">
            <SectionHeader
              title="آواتارهای اختصاصی شخصیت‌ها"
              subtitle="تولید قطعی و آفلاین بر اساس سن، جنسیت و شناسه یکتا"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_infant" gender="female" age={1} size={46} />
                <span className="text-[10px] text-[var(--text-muted)]">نوزاد</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_child" gender="male" age={8} size={46} />
                <span className="text-[10px] text-[var(--text-muted)]">کودک</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_woman" gender="female" age={29} size={46} />
                <span className="text-[10px] text-[var(--text-muted)]">جوان</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_man" gender="male" age={38} size={46} />
                <span className="text-[10px] text-[var(--text-muted)]">میان‌سال</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_inspector" gender="female" age={42} size={46} originKind="inspector" />
                <span className="text-[10px] text-[var(--text-muted)]">ناظر</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <PersonAvatar seed="sg_elder" gender="male" age={68} size={46} />
                <span className="text-[10px] text-[var(--text-muted)]">سالمند</span>
              </div>
            </div>
          </Card>

          <ChecklistCard
            title="فهرست مدارک نمونه (کارت چک‌لیست)"
            subtitle="ساختار یک‌ضربه‌ای برای تکمیل مدارک"
            items={[
              {
                id: 'sg_doc_1',
                title: 'گواهی عدم سوءپیشینه',
                subtitle: 'استعلام الکترونیکی قوه قضاییه',
                done: true,
              },
              {
                id: 'sg_doc_2',
                title: 'بیمه آتیه و مدارک مسکن',
                subtitle: 'سند یا اجاره‌نامه رسمی و تعهد آتیه',
                done: false,
                valueText: '۴ میلیون تومان',
                ctaLabel: 'ثبت مدرک',
                onAction: () => {
                  setToastOpen(true);
                  window.setTimeout(() => setToastOpen(false), 1800);
                },
              },
            ]}
          />

          <InspectorVisitCard
            inspectorGender="female"
            visit={{
              id: 'sg_visit_1',
              childPersonId: 'sg_c1',
              childNameFa: 'مهسا رضایی',
              jalaliYear: 1406,
              playerAge: 34,
              childAge: 6,
              inspectorPersonId: 'sg_insp_1',
              inspectorNameFa: 'سرکار خانم نرگس فرهادی',
              inspectorAvatarSeed: 'sg_inspector_seed',
              outcome: 'needs_improvement',
              summaryFa: 'محیط خانه بسیار صمیمی و آرام است؛ برای تقویت مهارت گفتار و آمادگی مدرسه یک نشست مشاوره پیشنهاد می‌شود.',
              followUpRequired: true,
              tasks: [
                {
                  id: 'sg_task_1',
                  titleFa: 'جلسه مشاوره خانواده و پیوند عاطفی',
                  descriptionFa: 'شرکت در دو نشست با مشاور بهزیستی',
                  costToman: 3500000,
                  completed: false,
                },
              ],
            }}
            playerMoneyToman={25000000}
            onCompleteTask={() => {
              setToastOpen(true);
              window.setTimeout(() => setToastOpen(false), 1800);
            }}
          />

          {/* Job Compass & Job Market Redesign Showcase */}
          <Card className="space-y-4" data-testid="styleguide-job-compass">
            <SectionHeader
              title="قطب‌نمای شغل و ردیف‌های بازار کار"
              subtitle="نمایش کامل عنوان بدون بریدگی، حقوق با واحد، حلقه تناسب و نمودار پنج‌محوری"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <MatchRing score={86} />
                <MatchRing score={58} />
                <ReadinessRing score={67} />
              </div>
              <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
                {(['monthly', 'annual'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setJcSalaryUnit(unit)}
                    className={`min-h-[40px] rounded-lg px-2.5 text-xs font-bold ${
                      jcSalaryUnit === unit
                        ? 'bg-[var(--surface)] text-[var(--primary-strong)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {unit === 'monthly' ? 'ماهانه' : 'سالانه'}
                  </button>
                ))}
              </div>
            </div>

            <PriorityStrip
              priorities={jcPriorities}
              customized={jcCustomized}
              onOpenEditor={() => setJcPriorityOpen(true)}
            />

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {[sampleReady, sampleNearLocked, sampleFutureLocked]
                .filter((x): x is JobMarketItem => Boolean(x))
                .map((item) => (
                  <JobRow
                    key={`sg-row-${item.job.id}`}
                    item={item}
                    salaryUnit={jcSalaryUnit}
                    isPinnedGoal={jcPinnedId === item.job.id}
                    isShortlisted={jcShortlist.includes(item.job.id)}
                    onSelect={() => setJcSelectedItem(item)}
                  />
                ))}
            </div>

            {sampleReady && (
              <FingerprintRadar
                series={[
                  {
                    id: sampleReady.job.id,
                    labelFa: sampleReady.job.shortTitle,
                    values: sampleReady.fingerprint,
                    stroke: COMPARE_SERIES_COLORS[0].stroke,
                    fill: COMPARE_SERIES_COLORS[0].fill,
                  },
                  {
                    id: 'sg-player',
                    labelFa: 'اولویت‌های تو',
                    values: prioritiesToRadarValues(jcPriorities),
                    stroke: 'var(--text)',
                    fill: 'rgba(138, 117, 104, 0.08)',
                    dashed: true,
                  },
                ]}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="پیش‌نمایش جزئیات شغل"
                variant="secondary"
                onClick={() => sampleReady && setJcSelectedItem(sampleReady)}
              />
              <ActionButton
                label="مقایسه دو شغل"
                variant="secondary"
                onClick={() => setJcCompareOpen(true)}
              />
            </div>

            <JobDeck
              items={jcListings.allItems.slice(0, 4)}
              salaryUnit={jcSalaryUnit}
              shortlistedIds={jcShortlist}
              onShortlistAndNext={(jobId) =>
                setJcShortlist((prev) =>
                  prev.includes(jobId) ? prev : [...prev, jobId],
                )
              }
              onOpenDetail={(item) => setJcSelectedItem(item)}
            />
          </Card>
        </main>

        <BottomSheet
          open={bottomOpen}
          onClose={() => setBottomOpen(false)}
          title="برگه کشویی نمونه"
          subtitle="قابل کشیدن به پایین برای بستن"
          allowSnapToggle
        >
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            این برگه از پایین صفحه باز می‌شود، با کلید گریز یا کشیدن دستگیره بسته می‌شود و از رنگ‌های متغیر تم تبعیت می‌کند.
          </p>
        </BottomSheet>

        <InfoSheet
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="راهنمای بخش نمونه"
          subtitle="توضیحات طولانی بدون شلوغ کردن هاب اینجا قرار می‌گیرند"
          bullets={[
            'هاب هر بخش حداکثر ۵ گروه و هر گروه حداکثر ۷ ردیف دارد.',
            'پیشنهادهای فوری با نشان ستاره و هزینه شفاف نمایش داده می‌شوند.',
            'توضیحات تفصیلی و فهرست شرایط همیشه یک لایه عمیق‌تر باز می‌شوند.',
          ]}
        />

        <DetailSheet
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title="صفحه جزئیات نمونه"
          subtitle="فلش بازگشت در سمت راست · حفظ اسکرول قبلی"
          onInfo={() => setInfoOpen(true)}
          footer={
            <ActionButton
              label="اقدام نهایی نمونه"
              variant="primary"
              onClick={() => {
                setDetailOpen(false);
                setToastOpen(true);
                window.setTimeout(() => setToastOpen(false), 2000);
              }}
            />
          }
        >
          <SectionGroup title="اطلاعات تکمیلی">
            <ActionRow
              title="سابقه ثبت‌شده"
              subtitle="نمونه ردیف داخل صفحه جزئیات"
              value="۱۴۰۳"
            />
          </SectionGroup>
        </DetailSheet>

        <ConfirmDialog
          open={confirmOpen}
          title="تأیید عملیات حساس"
          message="این اقدام غیرقابل بازگشت است و دکمه تأیید قرمز توپر فقط در این پنجره ظاهر می‌شود."
          destructive
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />

        <Toast visible={toastOpen} message="عملیات نمونه با موفقیت اجرا شد" tone="success" />

        <PrioritySheet
          open={jcPriorityOpen}
          priorities={jcPriorities}
          customized={jcCustomized}
          onClose={() => setJcPriorityOpen(false)}
          onChange={(next) => {
            setJcPriorities(next);
            setJcCustomized(true);
          }}
          onReset={() => {
            setJcPriorities(defaultPriorities);
            setJcCustomized(false);
          }}
        />

        <JobDetailSheet
          open={Boolean(jcSelectedItem)}
          item={jcSelectedItem}
          saveGame={sampleSave}
          priorities={jcPriorities}
          salaryUnit={jcSalaryUnit}
          isShortlisted={jcSelectedItem ? jcShortlist.includes(jcSelectedItem.job.id) : false}
          isPinnedGoal={jcSelectedItem ? jcPinnedId === jcSelectedItem.job.id : false}
          isInCompare={false}
          onClose={() => setJcSelectedItem(null)}
          onToggleShortlist={(jobId) =>
            setJcShortlist((prev) =>
              prev.includes(jobId) ? prev.filter((x) => x !== jobId) : [...prev, jobId],
            )
          }
          onTogglePinGoal={(jobId) =>
            setJcPinnedId((prev) => (prev === jobId ? null : jobId))
          }
          onToggleCompare={() => {
            setJcSelectedItem(null);
            setJcCompareOpen(true);
          }}
          onStartInterview={() => {
            setJcSelectedItem(null);
            setToastOpen(true);
            window.setTimeout(() => setToastOpen(false), 1800);
          }}
          onNavigateGapTarget={() => {
            setJcSelectedItem(null);
            setToastOpen(true);
            window.setTimeout(() => setToastOpen(false), 1800);
          }}
        />

        <CompareSheet
          open={jcCompareOpen}
          items={sampleCompareItems}
          salaryUnit={jcSalaryUnit}
          onClose={() => setJcCompareOpen(false)}
          onOpenJobDetail={(item) => {
            setJcCompareOpen(false);
            setJcSelectedItem(item);
          }}
        />
      </div>
    </div>
  );
}
