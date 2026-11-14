import { useMemo, useState, type ReactNode } from 'react';
import { gameDataset } from '../../data/registry';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import { STANDARD_ACTIVITY_CATEGORIES } from '../../engine/recommendation';
import type {
  ActivityCategory,
  ActivityDefinition,
  ActivityOutcome,
  SaveGame,
} from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  developTalentAction,
  performActivityAction,
  toggleFavoriteActivityAction,
  undoLastActivityAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  canPerformActivity,
  getActivitiesHubSummary,
  getTalentPracticeOptions,
  isActivityVisibleByContentSettings,
} from '../../state/selectors';
import { ActivityResultSheet } from '../components/ActivityResultSheet';
import { CountryFlag } from '../components/flags/CountryFlag';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionRow,
  ConfirmDialog,
  DangerZoneGroup,
  DetailSheet,
  EmptyState,
  InfoSheet,
  ProgressRing,
  SectionGroup,
  SegmentedControl,
} from '../components/Primitives';
import {
  IconBank,
  IconBook,
  IconCharity,
  IconCoins,
  IconCrime,
  IconDice,
  IconDoctor,
  IconFlame,
  IconMapPin,
  IconPalette,
  IconPlane,
  IconRelations,
  IconShield,
  IconShop,
  IconSparkles,
  IconSport,
  IconStar,
  IconTrendUp,
  IconWarning,
} from '../icons';

interface ActivitiesTabSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSave?: (nextSave: SaveGame) => void;
  onQuickExecuteWithUndo?: (activity: ActivityDefinition) => ActionOutcome;
  onOpenEmigration?: () => void;
}

type DiscoveryMode = 'seasonal' | 'favorites' | 'recent';

interface CategoryTileMeta {
  id: ActivityCategory;
  descFa: string;
  icon: ReactNode;
  accentBg: string;
  accentText: string;
}

const CATEGORY_TILES: CategoryTileMeta[] = [
  {
    id: 'health',
    descFa: 'چکاپ، دندان و آرامش',
    icon: <IconDoctor className="h-5 w-5" />,
    accentBg: 'bg-emerald-500/12',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'leisure',
    descFa: 'سینما، کافه و فرهنگ',
    icon: <IconSparkles className="h-5 w-5" />,
    accentBg: 'bg-amber-500/12',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'travel',
    descFa: 'ایران‌گردی و طبیعت',
    icon: <IconMapPin className="h-5 w-5" />,
    accentBg: 'bg-sky-500/12',
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'sport',
    descFa: 'باشگاه، دو و کوه',
    icon: <IconSport className="h-5 w-5" />,
    accentBg: 'bg-orange-500/12',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'learning',
    descFa: 'مطالعه، زبان و پژوهش',
    icon: <IconBook className="h-5 w-5" />,
    accentBg: 'bg-indigo-500/12',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'charity',
    descFa: 'نیکوکاری و داوطلبی',
    icon: <IconCharity className="h-5 w-5" />,
    accentBg: 'bg-rose-500/12',
    accentText: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 'arts_talent',
    descFa: 'موسیقی، قلم و هنر',
    icon: <IconPalette className="h-5 w-5" />,
    accentBg: 'bg-fuchsia-500/12',
    accentText: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    id: 'pets',
    descFa: 'حیوانات خانگی و باغچه',
    icon: <IconFlame className="h-5 w-5" />,
    accentBg: 'bg-lime-500/12',
    accentText: 'text-lime-600 dark:text-lime-400',
  },
  {
    id: 'social_digital',
    descFa: 'جمع، گفتگو و رسانه',
    icon: <IconRelations className="h-5 w-5" />,
    accentBg: 'bg-cyan-500/12',
    accentText: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'business_trade',
    descFa: 'معامله، پروژه و شبکه',
    icon: <IconTrendUp className="h-5 w-5" />,
    accentBg: 'bg-teal-500/12',
    accentText: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'legal_civic',
    descFa: 'امور مدنی، بیمه و حقوق',
    icon: <IconShield className="h-5 w-5" />,
    accentBg: 'bg-slate-500/12',
    accentText: 'text-slate-600 dark:text-slate-300',
  },
  {
    id: 'lifestyle_shop',
    descFa: 'نظم، خانه و سبک زندگی',
    icon: <IconShop className="h-5 w-5" />,
    accentBg: 'bg-orange-500/12',
    accentText: 'text-[var(--primary-strong)]',
  },
];

const RISKY_CATEGORIES: {
  id: ActivityCategory;
  descFa: string;
  icon: ReactNode;
}[] = [
  {
    id: 'crime',
    descFa: 'مسیرهای پرریسک و خلاف قانون',
    icon: <IconCrime className="h-4 w-4" />,
  },
  {
    id: 'gambling',
    descFa: 'شرط‌بندی و ریسک مالی بالا',
    icon: <IconDice className="h-4 w-4" />,
  },
];

export function ActivitiesTabSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
  onSilentSave,
  onQuickExecuteWithUndo,
  onOpenEmigration,
}: ActivitiesTabSheetProps) {
  const { t } = useI18n();
  const { state, contentSettings } = saveGame;
  const { player } = state;

  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('seasonal');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
  const [confirmRiskActivity, setConfirmRiskActivity] = useState<ActivityDefinition | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [resultModal, setResultModal] = useState<{
    activity: ActivityDefinition;
    outcome: ActivityOutcome;
  } | null>(null);

  const summary = useMemo(
    () => getActivitiesHubSummary(saveGame, gameDataset),
    [saveGame],
  );

  const { runtime, urgentAlert, smartRecommendations, seasonal, favorites, recents, moneySummary } =
    summary;

  const quotaRemaining = Math.max(0, runtime.maxQuotaPerTurn - runtime.quotaUsedThisTurn);
  const favoriteSet = useMemo(() => new Set(runtime.favoriteIds), [runtime.favoriteIds]);

  const categoryActivities = useMemo(() => {
    if (!selectedCategory) return [];
    return gameDataset.activities.filter(
      (a) => a.category === selectedCategory && isActivityVisibleByContentSettings(a, saveGame),
    );
  }, [selectedCategory, saveGame]);

  const categoryTalents = useMemo(() => {
    if (selectedCategory !== 'sport' && selectedCategory !== 'arts_talent' && selectedCategory !== 'learning') {
      return [];
    }
    const targetIds =
      selectedCategory === 'sport'
        ? new Set(['athletics'])
        : new Set(['singing', 'music_instrument', 'visual_art', 'writing', 'acting', 'cooking']);
    return getTalentPracticeOptions(state, gameDataset).filter((opt) =>
      targetIds.has(opt.talentId),
    );
  }, [selectedCategory, state]);

  const handleToggleFavorite = (activityId: string) => {
    const next = toggleFavoriteActivityAction(saveGame, activityId);
    if (onSilentSave) {
      onSilentSave(next);
    } else {
      onUpdateSave({ save: next, success: true, message: 'فهرست علاقه‌مندی‌ها به‌روزرسانی شد' });
    }
  };

  const runActivity = (act: ActivityDefinition, showResultModal: boolean) => {
    const outcome =
      !showResultModal && onQuickExecuteWithUndo
        ? onQuickExecuteWithUndo(act)
        : (() => {
            const out = performActivityAction(saveGame, act);
            onUpdateSave(out);
            return out;
          })();
    if (showResultModal && outcome.success && outcome.pickedOutcome) {
      setResultModal({ activity: act, outcome: outcome.pickedOutcome });
    }
  };

  const triggerActivity = (act: ActivityDefinition, showResultModal: boolean) => {
    const isHighRisk =
      act.category === 'crime' || act.category === 'gambling' || act.riskLabelFa === 'زیاد';
    if (isHighRisk) {
      setConfirmRiskActivity(act);
    } else {
      runActivity(act, showResultModal);
    }
  };

  const discoveryItems: ActivityDefinition[] =
    discoveryMode === 'seasonal'
      ? seasonal.items.slice(0, 6)
      : discoveryMode === 'favorites'
        ? favorites.slice(0, 6)
        : recents.slice(0, 6);

  const countForCategory = (catId: ActivityCategory): number =>
    gameDataset.activities.filter(
      (a) => a.category === catId && isActivityVisibleByContentSettings(a, saveGame),
    ).length;

  const firstChunk = categoryActivities.slice(0, 6);
  const secondChunk = categoryActivities.slice(6, 12);

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.activities')}
      subtitle="برنامه سالانه، پیشنهادهای هوشمند و دسته‌بندی فعالیت‌ها"
    >
      <div className="space-y-4">
        {/* Section 1: Hero «برنامه امسال» (5 quota dots + 4 SVG mini-gauges + cash + optional urgent priority) */}
        <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {t('activitiesHub.heroTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  aria-label="راهنمای فعالیت‌ها"
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--primary-strong)]"
                >
                  <IconSparkles className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {quotaRemaining > 0
                  ? `${toPersianDigits(quotaRemaining)} سهمیه از ${toPersianDigits(runtime.maxQuotaPerTurn)} باقی مانده · ${seasonal.seasonLabelFa}`
                  : t('activitiesHub.quotaFull')}
              </p>
            </div>

            <div className="shrink-0 text-left">
              <div className="text-[10px] text-[var(--text-muted)]">{t('cashLabel')}</div>
              <div className="text-xs font-bold tabular-nums text-[var(--primary-strong)]">
                <bdi dir="rtl">{moneySummary.cashDisplayText}</bdi>
              </div>
            </div>
          </div>

          {/* 5 Circular Quota Dots */}
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)]">ظرفیت امسال</span>
            <div className="flex items-center gap-1.5" aria-label="سهمیه فعالیت امسال">
              {Array.from({ length: runtime.maxQuotaPerTurn }).map((_, idx) => {
                const used = idx < runtime.quotaUsedThisTurn;
                return (
                  <span
                    key={idx}
                    className={`h-3 w-3 rounded-full border transition-colors ${
                      used
                        ? 'border-[var(--primary)] bg-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* 4 SVG Mini-Gauges */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'سلامت', val: player.stats.health, colorVar: '--stat-health' },
              { label: 'شادی', val: player.stats.happiness, colorVar: '--stat-happiness' },
              { label: 'روان', val: player.stats.mentalHealth, colorVar: '--stat-mental' },
              { label: 'هوش', val: player.stats.intelligence, colorVar: '--stat-smarts' },
            ].map((g) => (
              <div key={g.label} className="flex flex-col items-center gap-1 rounded-xl bg-[var(--surface-2)] py-2">
                <ProgressRing value={g.val} size={40} strokeWidth={4} colorVar={g.colorVar} />
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{g.label}</span>
              </div>
            ))}
          </div>

          {/* Pinned Urgent Alert when Health < 20 */}
          {urgentAlert && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
                <div className="min-w-0 text-right">
                  <div className="text-xs font-bold text-[var(--danger)]">
                    {t('activitiesHub.urgentPriorityTitle')}: {urgentAlert.titleFa}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text)]">
                    {urgentAlert.bodyFa}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => triggerActivity(urgentAlert.activity, false)}
                className="min-h-[38px] shrink-0 rounded-xl bg-[var(--danger)] px-3 text-xs font-bold text-[var(--on-primary)]"
              >
                {urgentAlert.activity.titleFa}
              </button>
            </div>
          )}
        </section>

        {/* Section 2: Smart 1-Tap Horizontal Carousel */}
        {smartRecommendations.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-[var(--text-muted)]">
                {t('activitiesHub.smartCarouselTitle')}
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">اجرای فوری با امکان بازگردانی</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {smartRecommendations.map((rec) => {
                const tileMeta = CATEGORY_TILES.find((c) => c.id === rec.activity.category);
                const check = canPerformActivity(rec.activity, saveGame);
                return (
                  <button
                    key={rec.activity.id}
                    type="button"
                    onClick={() => triggerActivity(rec.activity, false)}
                    className="flex min-h-[112px] w-[164px] shrink-0 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-right transition-colors hover:border-[var(--primary)] active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${tileMeta?.accentBg ?? 'bg-[var(--primary-soft)]'} ${tileMeta?.accentText ?? 'text-[var(--primary-strong)]'}`}
                      >
                        {tileMeta?.icon ?? <IconSparkles className="h-4 w-4" />}
                      </span>
                      <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text)]">
                        {check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                      </span>
                    </div>
                    <div className="mt-2 min-w-0">
                      <div className="truncate text-xs font-bold text-[var(--text)]">
                        {rec.activity.titleFa}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)]">
                        {rec.reasonFa}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 3: Unified Discovery (Seasonal / Favorites / Recent) */}
        <SectionGroup
          title="فصلی، علاقه‌مندی‌ها و اخیر"
          action={
            <div className="w-[196px]">
              <SegmentedControl<DiscoveryMode>
                value={discoveryMode}
                onChange={setDiscoveryMode}
                items={[
                  { value: 'seasonal', label: 'فصلی' },
                  { value: 'favorites', label: 'علاقه' },
                  { value: 'recent', label: 'اخیر' },
                ]}
              />
            </div>
          }
        >
          {discoveryItems.length === 0 ? (
            <div className="px-3.5 py-4 text-center text-xs text-[var(--text-muted)]">
              {discoveryMode === 'favorites'
                ? 'با زدن ستاره کنار هر فعالیت، آن را اینجا پین کن.'
                : 'هنوز فعالیتی در این بخش ثبت نشده است.'}
            </div>
          ) : (
            discoveryItems.map((act) => {
              const check = canPerformActivity(act, saveGame);
              const isFav = favoriteSet.has(act.id);
              const isCooldown = check.reason?.includes('یک بار');
              return (
                <div key={act.id} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <ActionRow
                      icon={<IconSparkles className="h-4 w-4" />}
                      title={act.titleFa}
                      subtitle={act.effectHintFa}
                      value={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                      state={check.allowed ? 'enabled' : isCooldown ? 'cooldown' : 'disabled'}
                      reason={check.reason}
                      ctaLabel="انجام"
                      onClick={() => triggerActivity(act, true)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(act.id)}
                    aria-label={`نشان کردن ${act.titleFa}`}
                    className={`flex min-h-[48px] min-w-[44px] shrink-0 items-center justify-center border-r border-[var(--border)] transition-colors ${
                      isFav ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <IconStar className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </SectionGroup>

        {/* Section 4: 2-Col Duotone Vector Category Tiles + Highlighted Travel & Migration Tile */}
        <section className="space-y-2.5">
          <div className="px-1">
            <h3 className="text-xs font-bold text-[var(--text-muted)]">
              {t('activitiesHub.categoriesTitle')}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STANDARD_ACTIVITY_CATEGORIES.map((catId) => {
              const meta = CATEGORY_TILES.find((m) => m.id === catId)!;
              const cnt = countForCategory(catId);
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategory(catId)}
                  className="flex min-h-[74px] items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-right transition-colors hover:border-[var(--primary)] active:scale-[0.99]"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.accentBg} ${meta.accentText}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-[var(--text)]">
                      {t(`activities.categories.${catId}`)}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                      {meta.descFa} · {toPersianDigits(cnt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {onOpenEmigration && (
            <button
              type="button"
              onClick={onOpenEmigration}
              className="flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary-soft)]/60 px-3.5 py-3 text-right transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--on-primary)]">
                  <IconPlane className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[var(--primary-strong)]">
                    {t('activitiesHub.travelMigrationTile')}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--text)]">
                    {t('activitiesHub.travelMigrationSubtitle')}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center -space-x-1 space-x-reverse">
                <CountryFlag countryId="turkey" size="xs" />
                <CountryFlag countryId="germany" size="xs" />
                <CountryFlag countryId="canada" size="xs" />
              </div>
            </button>
          )}
        </section>

        {/* Section 5: Optional DangerZone for Risky Categories */}
        {contentSettings.allowCrime && (
          <DangerZoneGroup title="گزینه‌های حساس و پرریسک">
            {RISKY_CATEGORIES.map((cat) => (
              <ActionRow
                key={cat.id}
                variant="danger"
                icon={cat.icon}
                title={t(`activities.categories.${cat.id}`)}
                subtitle={cat.descFa}
                value={`${toPersianDigits(countForCategory(cat.id))} مورد`}
                showChevron
                onClick={() => setSelectedCategory(cat.id)}
              />
            ))}
          </DangerZoneGroup>
        )}
      </div>

      {/* Category Drill-down DetailSheet (chunks <= 6 rows each) */}
      <DetailSheet
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory ? t(`activities.categories.${selectedCategory}`) : ''}
        subtitle="برای ثبت در کارنامه سالانه روی فعالیت ضربه بزن"
        onInfo={() => setInfoOpen(true)}
      >
        {categoryTalents.length > 0 && (
          <SectionGroup
            title="پرورش گرایش و استعداد مرتبط"
            subtitle="تمرین فردی در کنار فعالیت‌های روزمره"
          >
            {categoryTalents.slice(0, 6).map((opt) => {
              const ageLocked = player.age < opt.minPracticeAge;
              const cooledDown = opt.cooldownRemaining > 0;
              return (
                <ActionRow
                  key={opt.talentId}
                  icon={<IconSport className="h-4 w-4" />}
                  title={
                    opt.athleticDisciplineTitleFa
                      ? `${opt.titleFa} (${opt.athleticDisciplineTitleFa})`
                      : opt.titleFa
                  }
                  subtitle={`مهارت: ${opt.skillLevelLabelFa}${opt.discoveredTierLabelFa ? ` · ${opt.discoveredTierLabelFa}` : ''}`}
                  value="رایگان"
                  state={ageLocked ? 'locked' : cooledDown ? 'cooldown' : 'enabled'}
                  reason={
                    ageLocked ? `از ${toPersianDigits(opt.minPracticeAge)} سالگی` : undefined
                  }
                  ctaLabel="تمرین"
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
              );
            })}
          </SectionGroup>
        )}

        {categoryActivities.length === 0 ? (
          <EmptyState
            title="فعالیتی در این دسته‌بندی نیست"
            description="ممکن است در تنظیمات محتوا محدود شده باشد."
          />
        ) : (
          <>
            <SectionGroup title="فعالیت‌های اصلی">
              {firstChunk.map((act) => {
                const check = canPerformActivity(act, saveGame);
                const isCooldown =
                  check.reason?.includes('فقط یک بار در سال') ||
                  check.reason?.includes('تا نوبت بعد');
                const isDisabledMoney = check.reason === 'موجودی کافی نیست';
                const rowState = check.allowed
                  ? 'enabled'
                  : isCooldown
                    ? 'cooldown'
                    : isDisabledMoney
                      ? 'disabled'
                      : 'locked';
                const isDanger =
                  act.category === 'crime' ||
                  act.category === 'gambling' ||
                  act.riskLabelFa === 'زیاد';
                const isFav = favoriteSet.has(act.id);

                return (
                  <div key={act.id} className="flex items-center">
                    <div className="min-w-0 flex-1">
                      <ActionRow
                        variant={isDanger ? 'danger' : 'default'}
                        icon={<IconCoins className="h-4 w-4" />}
                        title={act.titleFa}
                        subtitle={`${act.effectHintFa} · ریسک ${act.riskLabelFa}`}
                        value={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                        state={rowState}
                        reason={check.reason}
                        ctaLabel="انجام"
                        onClick={() => triggerActivity(act, true)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(act.id)}
                      aria-label={`افزودن ${act.titleFa} به علاقه‌مندی‌ها`}
                      className={`flex min-h-[48px] min-w-[44px] shrink-0 items-center justify-center border-r border-[var(--border)] transition-colors ${
                        isFav ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <IconStar className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </SectionGroup>

            {secondChunk.length > 0 && (
              <SectionGroup title="گزینه‌های تکمیلی">
                {secondChunk.map((act) => {
                  const check = canPerformActivity(act, saveGame);
                  const isCooldown =
                    check.reason?.includes('فقط یک بار در سال') ||
                    check.reason?.includes('تا نوبت بعد');
                  const isDisabledMoney = check.reason === 'موجودی کافی نیست';
                  const rowState = check.allowed
                    ? 'enabled'
                    : isCooldown
                      ? 'cooldown'
                      : isDisabledMoney
                        ? 'disabled'
                        : 'locked';
                  const isFav = favoriteSet.has(act.id);

                  return (
                    <div key={act.id} className="flex items-center">
                      <div className="min-w-0 flex-1">
                        <ActionRow
                          icon={<IconBank className="h-4 w-4" />}
                          title={act.titleFa}
                          subtitle={`${act.effectHintFa} · ریسک ${act.riskLabelFa}`}
                          value={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                          state={rowState}
                          reason={check.reason}
                          ctaLabel="انجام"
                          onClick={() => triggerActivity(act, true)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(act.id)}
                        aria-label={`افزودن ${act.titleFa} به علاقه‌مندی‌ها`}
                        className={`flex min-h-[48px] min-w-[44px] shrink-0 items-center justify-center border-r border-[var(--border)] transition-colors ${
                          isFav ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        <IconStar className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </SectionGroup>
            )}
          </>
        )}
      </DetailSheet>

      <ActivityResultSheet
        open={resultModal !== null}
        activity={resultModal?.activity ?? null}
        outcome={resultModal?.outcome ?? null}
        saveGame={saveGame}
        onClose={() => setResultModal(null)}
        onToggleFavorite={handleToggleFavorite}
        onUndo={() => onUpdateSave(undoLastActivityAction(saveGame))}
      />

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="درباره فعالیت‌ها"
        bullets={[
          'هر سال تا ۵ سهمیه فعالیت داری و پیشنهادهای هوشمند بر پایه وضعیت فعلی شاخص‌هایت مرتب می‌شوند.',
          'اجرای سریع از نوار پیشنهاد هوشمند تا پیش از رفتن به سال بعد قابل بازگردانی است.',
          'برای سفر کوتاه‌مدت خارجی یا پیگیری پرونده مهاجرت از کاشی ویژه «سفر خارجی و مهاجرت» وارد شو.',
        ]}
      />

      <ConfirmDialog
        open={confirmRiskActivity !== null}
        title={confirmRiskActivity ? `تأیید اقدام پرریسک: ${confirmRiskActivity.titleFa}` : ''}
        message={
          confirmRiskActivity
            ? `${confirmRiskActivity.effectHintFa} — این انتخاب ریسک بالایی دارد و ممکن است پیامد مالی یا قانونی ایجاد کند. ادامه می‌دهی؟`
            : ''
        }
        destructive
        onCancel={() => setConfirmRiskActivity(null)}
        onConfirm={() => {
          if (confirmRiskActivity) {
            runActivity(confirmRiskActivity, true);
          }
          setConfirmRiskActivity(null);
        }}
      />
    </FullScreenSheet>
  );
}
