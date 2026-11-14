import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import type {
  ActivityCategory,
  ActivityDefinition,
  CountryDefinition,
  SaveGame,
} from '../../engine/types';
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
  ActionRow,
  Card,
  ConfirmDialog,
  CurrencyText,
  DangerZoneGroup,
  DetailSheet,
  EmptyState,
  HubHeroCard,
  InfoSheet,
  LockedNotice,
  ProgressStepper,
  SectionGroup,
  SegmentedControl,
  StatBar,
} from '../components/Primitives';
import {
  IconActivities,
  IconBook,
  IconCharity,
  IconCoins,
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

const STANDARD_CATEGORIES: {
  id: CategoryKey;
  labelKey: string;
  desc: string;
  emoji: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'health',
    labelKey: 'activities.categories.health',
    desc: 'چکاپ، دندان‌پزشکی و روان',
    emoji: '🩺',
    icon: <IconDoctor className="h-4 w-4" />,
  },
  {
    id: 'leisure',
    labelKey: 'activities.categories.leisure',
    desc: 'سینما، طبیعت‌گردی و کافه',
    emoji: '☕',
    icon: <IconSparkles className="h-4 w-4" />,
  },
  {
    id: 'travel',
    labelKey: 'activities.categories.travel',
    desc: 'سفرهای داخلی و زیارتی',
    emoji: '🗺️',
    icon: <IconMapPin className="h-4 w-4" />,
  },
  {
    id: 'sport',
    labelKey: 'activities.categories.sport',
    desc: 'باشگاه، دویدن و کوهنوردی',
    emoji: '🏃',
    icon: <IconSport className="h-4 w-4" />,
  },
  {
    id: 'learning',
    labelKey: 'activities.categories.learning',
    desc: 'کتاب، زبان و هنر',
    emoji: '📚',
    icon: <IconBook className="h-4 w-4" />,
  },
  {
    id: 'charity',
    labelKey: 'activities.categories.charity',
    desc: 'نیکوکاری و مشارکت مدنی',
    emoji: '🤝',
    icon: <IconCharity className="h-4 w-4" />,
  },
  {
    id: 'migration',
    labelKey: 'activities.categories.migration',
    desc: 'مسیرهای مهاجرت و ویزا',
    emoji: '✈️',
    icon: <IconPlane className="h-4 w-4" />,
  },
];

const RISKY_CATEGORIES: {
  id: ActivityCategory;
  labelKey: string;
  desc: string;
  emoji: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'crime',
    labelKey: 'activities.categories.crime',
    desc: 'مسیرهای پرریسک و خلاف قانون',
    emoji: '⚠️',
    icon: <IconCrime className="h-4 w-4" />,
  },
  {
    id: 'gambling',
    labelKey: 'activities.categories.gambling',
    desc: 'شرط‌بندی و ریسک مالی بالا',
    emoji: '🎲',
    icon: <IconDice className="h-4 w-4" />,
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
  const [confirmRiskActivity, setConfirmRiskActivity] = useState<ActivityDefinition | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const recommendedActivities = useMemo(() => {
    const safePool = gameDataset.activities.filter(
      (a) =>
        a.category !== 'crime' &&
        a.category !== 'gambling' &&
        isActivityVisibleByContentSettings(a, saveGame),
    );
    const available = safePool.filter((a) => canPerformActivity(a, saveGame).allowed);
    const scored = available.map((a) => {
      let score = 0;
      if (player.stats.health < 60 && a.category === 'health') score += 4;
      if (player.stats.happiness < 60 && (a.category === 'leisure' || a.category === 'travel'))
        score += 3;
      if (player.stats.mentalHealth < 60 && (a.category === 'sport' || a.category === 'leisure'))
        score += 3;
      if (player.stats.intelligence < 65 && a.category === 'learning') score += 2;
      if (a.costToman === 0) score += 1;
      return { a, score };
    });
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, 3).map((x) => x.a);
  }, [
    saveGame,
    player.stats.health,
    player.stats.happiness,
    player.stats.mentalHealth,
    player.stats.intelligence,
  ]);

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
    return getTalentPracticeOptions(state, gameDataset).filter((opt) =>
      targetIds.has(opt.talentId),
    );
  }, [selectedCategory, state]);

  const emigProgress = getEmigrationProgress(state);
  const abroadCountries = useMemo(() => gameDataset.countries.filter((c) => !c.isIran), []);

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

  const countForCategory = (catId: CategoryKey): number => {
    if (catId === 'migration') return abroadCountries.length;
    return gameDataset.activities.filter(
      (a) => a.category === catId && isActivityVisibleByContentSettings(a, saveGame),
    ).length;
  };

  const triggerActivity = (act: ActivityDefinition) => {
    const isHighRisk =
      act.category === 'crime' || act.category === 'gambling' || act.riskLabelFa === 'زیاد';
    if (isHighRisk) {
      setConfirmRiskActivity(act);
    } else {
      onUpdateSave(performActivityAction(saveGame, act));
    }
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.activities')}
      subtitle="کارهای روزمره، سلامت، سفر و مهاجرت"
    >
      <div className="space-y-4">
        <HubHeroCard
          icon={<IconActivities className="h-5 w-5" />}
          title="برنامه امسال"
          subtitle="فعالیت‌های سبک با یک ضربه نتیجه می‌دهند"
          onInfo={() => setInfoOpen(true)}
          metrics={[
            {
              label: 'سلامت',
              value: `${toPersianDigits(Math.round(player.stats.health))}٪`,
              tone: player.stats.health < 40 ? 'danger' : 'success',
            },
            {
              label: 'شادی',
              value: `${toPersianDigits(Math.round(player.stats.happiness))}٪`,
              tone: player.stats.happiness < 40 ? 'danger' : 'primary',
            },
            {
              label: 'نقدینگی',
              value: <CurrencyText amountToman={player.moneyToman} />,
            },
          ]}
        />

        {recommendedActivities.length > 0 && (
          <SectionGroup title="پیشنهادهای امسال" subtitle="یک ضربه برای اجرای سریع">
            {recommendedActivities.map((act) => {
              const check = canPerformActivity(act, saveGame);
              return (
                <ActionRow
                  key={act.id}
                  icon={<IconSparkles className="h-4 w-4" />}
                  title={act.titleFa}
                  subtitle={act.effectHintFa}
                  value={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                  state="recommended"
                  ctaLabel="انجام"
                  onClick={() => triggerActivity(act)}
                />
              );
            })}
          </SectionGroup>
        )}

        <SectionGroup title="دسته‌بندی فعالیت‌ها">
          {STANDARD_CATEGORIES.map((cat) => {
            const cnt = countForCategory(cat.id);
            const subtitle =
              cat.id === 'migration' && emigProgress.targetCountryId
                ? `پرونده فعال: ${gameDataset.countries.find((c) => c.id === emigProgress.targetCountryId)?.nameFa ?? ''}`
                : cat.desc;
            return (
              <ActionRow
                key={cat.id}
                icon={cat.icon}
                emoji={cat.emoji}
                title={t(cat.labelKey)}
                subtitle={subtitle}
                value={`${toPersianDigits(cnt)} مورد`}
                showChevron
                onClick={() => setSelectedCategory(cat.id)}
              />
            );
          })}
        </SectionGroup>

        {contentSettings.allowCrime && (
          <DangerZoneGroup title="گزینه‌های حساس و پرریسک">
            {RISKY_CATEGORIES.map((cat) => (
              <ActionRow
                key={cat.id}
                variant="danger"
                icon={cat.icon}
                emoji={cat.emoji}
                title={t(cat.labelKey)}
                subtitle={cat.desc}
                value={`${toPersianDigits(countForCategory(cat.id))} مورد`}
                showChevron
                onClick={() => setSelectedCategory(cat.id)}
              />
            ))}
          </DangerZoneGroup>
        )}
      </div>

      {/* Category & Migration Drill-down DetailSheet */}
      <DetailSheet
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory ? t(`activities.categories.${selectedCategory}`) : ''}
        subtitle={
          selectedCategory === 'migration'
            ? 'انتخاب کشور مقصد، مسیر و پیگیری مراحل ویزا'
            : 'برای انجام هر فعالیت روی ردیف بزن'
        }
        onInfo={() => setInfoOpen(true)}
        footer={
          selectedCategory === 'migration' && player.age >= 18 ? (
            <ActionButton
              label={`اجرای مرحله ${toPersianDigits(currentStep + 1)}: ${MIGRATION_STEPS[currentStep]}`}
              costText={formatToman(nextStepCost)}
              effectHint={`هزینه کل تقریبی مسیر: ${formatToman(totalEmigrationCost)}`}
              disabled={player.moneyToman < nextStepCost}
              disabledReason={player.moneyToman < nextStepCost ? 'موجودی کافی نیست' : undefined}
              onClick={() => setConfirmEmigrate(true)}
            />
          ) : undefined
        }
      >
        {selectedCategory === 'migration' ? (
          player.age < 18 ? (
            <LockedNotice message="فرآیند مستقل مهاجرت از ۱۸ سالگی فعال می‌شود." />
          ) : (
            <>
              <HubHeroCard
                icon={<IconPlane className="h-5 w-5" />}
                title={`مهاجرت به ${activeCountry.nameFa}`}
                subtitle={
                  player.countryId !== 'iran'
                    ? `اقامت فعلی: ${gameDataset.countries.find((c) => c.id === player.countryId)?.nameFa ?? ''}`
                    : `سختی پذیرش: ${toPersianDigits(Math.round(activeCountry.difficulty * 100))}٪`
                }
                status={currentStep > 0 ? 'in_progress' : 'waiting'}
                metrics={[
                  { label: 'مرحله فعلی', value: `${toPersianDigits(currentStep)} از ۴` },
                  { label: 'هزینه گام بعد', value: formatToman(nextStepCost) },
                  { label: 'برآورد کل', value: formatToman(totalEmigrationCost) },
                ]}
              />

              <ProgressStepper
                orientation="horizontal"
                steps={MIGRATION_STEPS.map((label, idx) => ({
                  id: label,
                  title: label,
                  status:
                    idx < currentStep
                      ? 'done'
                      : idx === currentStep
                        ? 'current'
                        : 'upcoming',
                }))}
              />

              <SectionGroup title="کشور مقصد">
                {abroadCountries.map((country) => {
                  const selected = country.id === activeCountry.id;
                  return (
                    <ActionRow
                      key={country.id}
                      icon={<IconPlane className="h-4 w-4" />}
                      title={country.nameFa}
                      subtitle={`سختی: ${toPersianDigits(Math.round(country.difficulty * 100))}٪`}
                      state={selected ? 'done' : 'enabled'}
                      ctaLabel={selected ? undefined : 'انتخاب'}
                      onClick={() => setSelectedCountry(country)}
                    />
                  );
                })}
              </SectionGroup>

              <SectionGroup title="مسیر پرونده">
                <div className="p-2.5">
                  <SegmentedControl
                    value={activePath}
                    onChange={setSelectedPath}
                    items={activeCountry.paths.map((p) => ({
                      value: p,
                      label: PATH_LABELS[p],
                    }))}
                  />
                </div>
              </SectionGroup>
            </>
          )
        ) : (
          <>
            {selectedCategory === 'health' && (
              <Card className="space-y-2">
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
              <SectionGroup
                title="پرورش گرایش و استعداد مرتبط"
                subtitle="تمرین فردی رایگان در کنار فعالیت‌ها"
              >
                {categoryTalents.map((opt) => {
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
                title="فعالیتی در این بخش نیست"
                description="ممکن است در تنظیمات محتوا محدود شده باشد."
              />
            ) : (
              <SectionGroup title="فهرست فعالیت‌ها">
                {categoryActivities.map((act) => {
                  const check = canPerformActivity(act, saveGame);
                  const isCooldown = check.reason?.includes('فقط یک بار در سال') || check.reason?.includes('تا نوبت بعد');
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

                  return (
                    <ActionRow
                      key={act.id}
                      variant={isDanger ? 'danger' : 'default'}
                      icon={<IconCoins className="h-4 w-4" />}
                      title={act.titleFa}
                      subtitle={`${act.effectHintFa} · ریسک ${act.riskLabelFa}`}
                      value={check.adjustedCost > 0 ? formatToman(check.adjustedCost) : 'رایگان'}
                      state={rowState}
                      reason={check.reason}
                      ctaLabel="انجام"
                      onClick={() => triggerActivity(act)}
                    />
                  );
                })}
              </SectionGroup>
            )}
          </>
        )}
      </DetailSheet>

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="درباره فعالیت‌ها"
        bullets={[
          'بیشتر فعالیت‌ها هر سال یک بار قابل انجام هستند و با حلقه انتظار مشخص می‌شوند.',
          'فعالیت‌های پرریسک یا غیرقانونی قبل از اجرا پنجره تأیید دارند.',
          'بخش مهاجرت مراحل پرونده را به‌صورت گام‌به‌گام ذخیره می‌کند.',
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
            onUpdateSave(performActivityAction(saveGame, confirmRiskActivity));
          }
          setConfirmRiskActivity(null);
        }}
      />

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

