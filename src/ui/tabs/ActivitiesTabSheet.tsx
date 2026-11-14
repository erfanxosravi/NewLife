import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import type { ActivityCategory, CountryDefinition, SaveGame } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  advanceEmigrationStepAction,
  developTalentAction,
  performActivityAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  canPerformActivity,
  getEmigrationProgress,
  getEmigrationStepCostToman,
  getEmigrationTotalCostToman,
  getTalentPracticeOptions,
  isActivityVisibleByContentSettings,
} from '../../state/selectors';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  LockedNotice,
  SectionHeader,
  StatBar,
} from '../components/Primitives';
import {
  IconBook,
  IconCharity,
  IconCrime,
  IconDice,
  IconDoctor,
  IconHealth,
  IconMapPin,
  IconPlane,
  IconSparkles,
  IconSport,
} from '../icons';

interface ActivitiesTabSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

type CategoryKey = ActivityCategory | 'migration';

const CATEGORY_TILES: {
  id: CategoryKey;
  labelKey: string;
  desc: string;
  icon: React.ReactNode;
  gatedByCrime?: boolean;
}[] = [
  {
    id: 'health',
    labelKey: 'activities.categories.health',
    desc: 'چکاپ، دندان‌پزشکی و روان',
    icon: <IconDoctor className="h-5 w-5" />,
  },
  {
    id: 'leisure',
    labelKey: 'activities.categories.leisure',
    desc: 'سینما، طبیعت‌گردی و کافه',
    icon: <IconSparkles className="h-5 w-5" />,
  },
  {
    id: 'travel',
    labelKey: 'activities.categories.travel',
    desc: 'سفرهای داخلی و زیارتی',
    icon: <IconMapPin className="h-5 w-5" />,
  },
  {
    id: 'migration',
    labelKey: 'activities.categories.migration',
    desc: 'مسیرهای مهاجرت و ویزا',
    icon: <IconPlane className="h-5 w-5" />,
  },
  {
    id: 'sport',
    labelKey: 'activities.categories.sport',
    desc: 'باشگاه، دویدن و کوهنوردی',
    icon: <IconSport className="h-5 w-5" />,
  },
  {
    id: 'learning',
    labelKey: 'activities.categories.learning',
    desc: 'کتاب، زبان و هنر',
    icon: <IconBook className="h-5 w-5" />,
  },
  {
    id: 'charity',
    labelKey: 'activities.categories.charity',
    desc: 'نیکوکاری و مشارکت مدنی',
    icon: <IconCharity className="h-5 w-5" />,
  },
  {
    id: 'crime',
    labelKey: 'activities.categories.crime',
    desc: 'مسیرهای پرریسک و خلاف قانون',
    icon: <IconCrime className="h-5 w-5" />,
    gatedByCrime: true,
  },
  {
    id: 'gambling',
    labelKey: 'activities.categories.gambling',
    desc: 'شرط‌بندی و ریسک مالی بالا',
    icon: <IconDice className="h-5 w-5" />,
    gatedByCrime: true,
  },
];

const MIGRATION_STEPS = ['مدارک', 'آزمون زبان', 'پذیرش/پیشنهاد', 'ویزا'];

const PATH_LABELS: Record<'study' | 'work' | 'investment', string> = {
  study: 'تحصیلی',
  work: 'کاری',
  investment: 'سرمایه‌گذاری',
};

export function ActivitiesTabSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: ActivitiesTabSheetProps) {
  const { t } = useI18n();
  const { state, contentSettings } = saveGame;
  const { player } = state;

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryDefinition | null>(null);
  const [selectedPath, setSelectedPath] = useState<'study' | 'work' | 'investment'>('work');
  const [confirmEmigrate, setConfirmEmigrate] = useState(false);

  const visibleTiles = useMemo(
    () => CATEGORY_TILES.filter((tile) => !tile.gatedByCrime || contentSettings.allowCrime),
    [contentSettings.allowCrime],
  );

  const categoryActivities = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'migration') return [];
    return gameDataset.activities.filter(
      (a) => a.category === selectedCategory && isActivityVisibleByContentSettings(a, saveGame),
    );
  }, [selectedCategory, saveGame]);

  const categoryTalents = useMemo(() => {
    if (selectedCategory !== 'sport' && selectedCategory !== 'learning') return [];
    const targetIds =
      selectedCategory === 'sport'
        ? new Set(['athletics'])
        : new Set(['singing', 'music_instrument', 'visual_art', 'writing', 'acting', 'cooking']);
    return getTalentPracticeOptions(state, gameDataset).filter((opt) => targetIds.has(opt.talentId));
  }, [selectedCategory, state]);

  const emigProgress = getEmigrationProgress(state);
  const abroadCountries = useMemo(
    () => gameDataset.countries.filter((c) => !c.isIran),
    [],
  );

  const activeCountry =
    selectedCountry ??
    abroadCountries.find((c) => c.id === emigProgress.targetCountryId) ??
    abroadCountries[0];

  const activePath = activeCountry.paths.includes(selectedPath)
    ? selectedPath
    : activeCountry.paths[0];

  const isTrackingActive =
    emigProgress.targetCountryId === activeCountry.id && emigProgress.path === activePath;
  const currentStep = isTrackingActive ? emigProgress.step : 0;
  const nextStepCost = getEmigrationStepCostToman(activeCountry, currentStep, state, gameDataset);
  const totalEmigrationCost = getEmigrationTotalCostToman(activeCountry, state, gameDataset);

  return (
    <FullScreenSheet
      open={open}
      onClose={() => {
        if (selectedCategory) setSelectedCategory(null);
        else onClose();
      }}
      title={selectedCategory ? t(`activities.categories.${selectedCategory}`) : t('nav.activities')}
      subtitle={
        selectedCategory
          ? 'برای بازگشت به دسته‌بندی‌ها فلش بالا را بزن'
          : 'انتخاب دسته فعالیت در این سال'
      }
      headerRight={
        selectedCategory ? (
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="min-h-[38px] rounded-xl bg-[var(--surface-2)] px-2.5 text-xs font-bold text-[var(--primary-strong)]"
          >
            همه دسته‌ها
          </button>
        ) : undefined
      }
    >
      {/* 2-Column Category Grid */}
      {!selectedCategory && (
        <div className="grid grid-cols-2 gap-2.5">
          {visibleTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setSelectedCategory(tile.id)}
              className="flex min-h-[96px] flex-col items-start justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-right transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                {tile.icon}
              </div>
              <div className="mt-2.5 w-full">
                <div className="text-sm font-bold text-[var(--text)]">{t(tile.labelKey)}</div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                  {tile.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Emigration Dedicated Flow */}
      {selectedCategory === 'migration' && (
        <div className="space-y-4">
          {player.countryId !== 'iran' && (
            <Card tinted>
              <div className="text-xs font-bold text-[var(--primary-strong)]">
                محل اقامت فعلی: {gameDataset.countries.find((c) => c.id === player.countryId)?.nameFa}
              </div>
            </Card>
          )}

          {player.age < 18 ? (
            <LockedNotice message="فرآیند مستقل مهاجرت از ۱۸ سالگی فعال می‌شود." />
          ) : (
            <>
              <div className="space-y-2">
                <SectionHeader title="انتخاب کشور مقصد" />
                <div className="grid grid-cols-2 gap-2">
                  {abroadCountries.map((country) => {
                    const active = country.id === activeCountry.id;
                    return (
                      <button
                        key={country.id}
                        type="button"
                        onClick={() => setSelectedCountry(country)}
                        className={`rounded-2xl border p-3 text-right transition-colors ${
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                            : 'border-[var(--border)] bg-[var(--surface)]'
                        }`}
                      >
                        <div className="text-sm font-bold">{country.nameFa}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                          سختی: {toPersianDigits(Math.round(country.difficulty * 100))}٪
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Card className="space-y-3">
                <SectionHeader
                  title={`پرونده مهاجرت به ${activeCountry.nameFa}`}
                  subtitle="مسیر مورد نظر را انتخاب کن و مراحل را پیش ببر"
                />
                <FilterChips
                  value={activePath}
                  onChange={setSelectedPath}
                  items={activeCountry.paths.map((p) => ({
                    value: p,
                    label: PATH_LABELS[p],
                  }))}
                />

                {/* 4-Step Stepper */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {MIGRATION_STEPS.map((label, idx) => {
                    const done = idx < currentStep;
                    const isNext = idx === currentStep;
                    return (
                      <div
                        key={label}
                        className={`rounded-xl border px-1.5 py-2 text-center text-[10px] font-bold ${
                          done
                            ? 'border-[var(--success)] bg-[var(--success)]/12 text-[var(--success)]'
                            : isNext
                              ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                        }`}
                      >
                        <div>{toPersianDigits(idx + 1)}</div>
                        <div className="mt-0.5 truncate">{label}</div>
                      </div>
                    );
                  })}
                </div>

                <ActionButton
                  label={`اجرای مرحله ${toPersianDigits(currentStep + 1)}: ${MIGRATION_STEPS[currentStep]}`}
                  costText={formatToman(nextStepCost)}
                  effectHint={`هزینه کل تقریبی مسیر: ${formatToman(totalEmigrationCost)}`}
                  disabled={player.moneyToman < nextStepCost}
                  disabledReason={player.moneyToman < nextStepCost ? 'موجودی کافی نیست' : undefined}
                  onClick={() => setConfirmEmigrate(true)}
                />
              </Card>
            </>
          )}
        </div>
      )}

      {/* Regular Activity Category List */}
      {selectedCategory && selectedCategory !== 'migration' && (
        <div className="space-y-3">
          {selectedCategory === 'health' && (
            <Card className="space-y-2">
              <SectionHeader title="وضعیت فعلی سلامت" />
              <StatBar
                label="سلامت جسم"
                value={player.stats.health}
                colorVar="--stat-health"
                icon={<IconHealth className="h-3.5 w-3.5 text-[var(--stat-health)]" />}
              />
              <StatBar
                label="سلامت روان"
                value={player.stats.mentalHealth}
                colorVar="--stat-mental"
              />
            </Card>
          )}

          {categoryTalents.length > 0 && (
            <Card className="space-y-2.5" tinted>
              <SectionHeader
                title="پرورش گرایش و استعداد مرتبط"
                subtitle="تمرین هدفمند در کنار فعالیت‌ها شانس کشف و رشد استعداد را افزایش می‌دهد"
              />
              <div className="space-y-2">
                {categoryTalents.map((opt) => {
                  const ageLocked = player.age < opt.minPracticeAge;
                  const cooledDown = opt.cooldownRemaining > 0;
                  const disabledReason = ageLocked
                    ? `از ${toPersianDigits(opt.minPracticeAge)} سالگی`
                    : cooledDown
                      ? 'فقط یک بار در سال'
                      : undefined;
                  return (
                    <div
                      key={opt.talentId}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-[var(--text)]">
                            {opt.titleFa}
                            {opt.athleticDisciplineTitleFa
                              ? ` (${opt.athleticDisciplineTitleFa})`
                              : ''}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            مهارت: {opt.skillLevelLabelFa}
                          </div>
                        </div>
                        {opt.isDiscovered && opt.discoveredTierLabelFa && (
                          <Badge tone="primary">{opt.discoveredTierLabelFa}</Badge>
                        )}
                      </div>
                      <ActionButton
                        label="تمرین فردی"
                        costText="رایگان"
                        variant="secondary"
                        disabled={Boolean(disabledReason)}
                        disabledReason={disabledReason}
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
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {categoryActivities.length === 0 ? (
            <EmptyState
              title="فعالیتی در این بخش نیست"
              description="ممکن است در تنظیمات محتوا محدود شده باشد."
            />
          ) : (
            <div className="space-y-2.5">
              {categoryActivities.map((act) => {
                const check = canPerformActivity(act, saveGame);
                return (
                  <Card key={act.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--text)]">{act.titleFa}</span>
                      <Badge
                        tone={
                          act.riskLabelFa === 'زیاد'
                            ? 'danger'
                            : act.riskLabelFa === 'متوسط'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        ریسک: {act.riskLabelFa}
                      </Badge>
                    </div>
                    <ActionButton
                      label="انجام فعالیت"
                      costText={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                      effectHint={act.effectHintFa}
                      disabled={!check.allowed}
                      disabledReason={check.reason}
                      variant="secondary"
                      onClick={() => onUpdateSave(performActivityAction(saveGame, act))}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmEmigrate}
        title={`پیشبرد پرونده مهاجرت به ${activeCountry.nameFa}`}
        message={`هزینه مرحله «${MIGRATION_STEPS[currentStep]}» برابر با ${formatToman(nextStepCost)} است. آیا ادامه می‌دهی؟`}
        onCancel={() => setConfirmEmigrate(false)}
        onConfirm={() => {
          onUpdateSave(advanceEmigrationStepAction(saveGame, activeCountry, activePath));
          setConfirmEmigrate(false);
        }}
      />
    </FullScreenSheet>
  );
}
