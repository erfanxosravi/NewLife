import { useEffect, useMemo, useRef, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import {
  getAbroadLanguageLevel,
  getAbroadMonthlyBudget,
  getCountryMacroDef,
  getCountryPathsDef,
  getCredentialTrackForJob,
  getExpectedAbroadMonthlyNetRange,
} from '../../../engine/countries';
import {
  EMIGRATION_STEP_LABELS_FA,
  computeEmigrationDifficulty,
  ensureEmigrationState,
  getCountryApplicationDisplayStatusFa,
  getEmigrationStepFeeLocal,
  getLanguageLevelLabelFa,
  getStudyLanguageCost,
} from '../../../engine/emigration';
import { getRealExchangeRateAndPppGap } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import type { CurrencyCode, MigrationPathType, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  advanceEmigrationPipelineStepAction,
  completeAbroadArrivalAndMoveAction,
  startOrSelectEmigrationPathAction,
  studyForeignLanguageAction,
  toggleShortlistCountryAction,
  type ActionOutcome,
} from '../../../state/actions';
import { AffordabilityBadge } from '../AffordabilityBadge';
import { ExchangeRateStrip } from '../ExchangeRateStrip';
import { ForeignPaymentSheet } from '../ForeignPaymentSheet';
import { MoneyText } from '../MoneyText';
import { CountryFlag } from '../flags/CountryFlag';
import {
  ActionButton,
  ActionRow,
  Badge,
  DetailSheet,
  LockedNotice,
  ProgressStepper,
  SectionGroup,
  SegmentedControl,
  Sparkline,
} from '../Primitives';
import {
  IconBook,
  IconCheck,
  IconCoins,
  IconPlane,
  IconShield,
  IconSparkles,
  IconStar,
  IconWarning,
} from '../../icons';

type DetailTab = 'income' | 'paths' | 'life' | 'economy' | 'risks';

interface PendingCountryPayment {
  kind: 'step' | 'language';
  title: string;
  subtitle?: string;
  amount: number;
  currency: CurrencyCode;
  confirmLabel: string;
}

interface CountryDetailViewProps {
  open: boolean;
  countryId: string | null;
  initialFocusBreakdown?: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSave: (nextSave: SaveGame) => void;
  onDeepLink?: (tab: 'work' | 'assets' | 'activities', subTarget?: string) => void;
}

export function CountryDetailView({
  open,
  countryId,
  initialFocusBreakdown = false,
  saveGame,
  onClose,
  onUpdateSave,
  onSilentSave,
  onDeepLink,
}: CountryDetailViewProps) {
  const { t } = useI18n();
  const { state, contentSettings } = saveGame;
  const [activeTab, setActiveTab] = useState<DetailTab>('income');
  const [selectedPathOverride, setSelectedPathOverride] = useState<MigrationPathType | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [calcJobId, setCalcJobId] = useState<string>('');
  const [calcFamilySize, setCalcFamilySize] = useState<'1' | '2' | '3'>('1');
  const [pendingPayment, setPendingPayment] = useState<PendingCountryPayment | null>(null);
  const breakdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && initialFocusBreakdown) {
      setActiveTab('income');
      window.setTimeout(() => {
        breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, [open, initialFocusBreakdown, countryId]);

  const countryDef = useMemo(
    () => (countryId ? getCountryMacroDef(countryId, gameDataset) ?? null : null),
    [countryId],
  );
  const pathsDef = useMemo(
    () => (countryId ? getCountryPathsDef(countryId, gameDataset) ?? null : null),
    [countryId],
  );

  const emig = ensureEmigrationState(state);
  const app = countryId ? emig.activeApplications[countryId] : undefined;
  const activePathId: MigrationPathType =
    selectedPathOverride ??
    app?.selectedPathId ??
    pathsDef?.pathways[0]?.id ??
    'work';

  const activePathSpec = useMemo(
    () => pathsDef?.pathways.find((p) => p.id === activePathId) ?? pathsDef?.pathways[0] ?? null,
    [pathsDef, activePathId],
  );

  const difficulty = useMemo(
    () =>
      countryId
        ? computeEmigrationDifficulty({
            countryId,
            pathId: activePathId,
            state,
            dataset: gameDataset,
          })
        : null,
    [countryId, activePathId, state],
  );

  const effectiveRegionId = selectedRegionId ?? countryDef?.regions[0]?.id;
  const defaultJobId =
    state.player.job?.jobId ??
    gameDataset.jobs.find((j) => j.minEducation === state.player.education.level)?.id ??
    gameDataset.jobs[0]?.id ??
    '';
  const effectiveJobId = calcJobId || defaultJobId;
  const familyMembersCount = calcFamilySize === '1' ? 1 : calcFamilySize === '2' ? 2 : 3;

  const netRange = useMemo(
    () =>
      countryId
        ? getExpectedAbroadMonthlyNetRange({
            countryId,
            state,
            dataset: gameDataset,
            jobIdOverride: effectiveJobId || undefined,
            regionIdOverride: effectiveRegionId,
          })
        : null,
    [countryId, state, effectiveJobId, effectiveRegionId],
  );

  const monthlyBudget = useMemo(
    () =>
      countryId
        ? getAbroadMonthlyBudget(
            state,
            gameDataset,
            countryId,
            effectiveRegionId,
            familyMembersCount,
          )
        : null,
    [countryId, state, effectiveRegionId, familyMembersCount],
  );

  if (!open || !countryDef || !pathsDef || !difficulty || !netRange || !monthlyBudget || !activePathSpec) {
    return null;
  }

  const isCurrentResidency = state.player.countryId === countryDef.id;
  const isShortlisted = emig.shortlistedCountryIds.includes(countryDef.id);
  const statusLabel = getCountryApplicationDisplayStatusFa(
    app?.status ?? 'unexplored',
    isCurrentResidency,
  );
  const langLevel = getAbroadLanguageLevel(state, countryDef.id, gameDataset);
  const langCost = getStudyLanguageCost(countryDef.id, state, gameDataset);
  const realFx = getRealExchangeRateAndPppGap(state, countryDef.currencyCode, gameDataset);
  const stepIdx = app && app.selectedPathId === activePathSpec.id ? app.currentStepIndex : 0;
  const nextStepFee = getEmigrationStepFeeLocal(
    countryDef.id,
    activePathSpec,
    Math.min(5, stepIdx),
    state,
    gameDataset,
  );

  const selectedJobDef =
    gameDataset.jobs.find((j) => j.id === effectiveJobId) ?? gameDataset.jobs[0];
  const credTrack = selectedJobDef
    ? getCredentialTrackForJob(selectedJobDef, state.player.education.major)
    : state.player.education.major?.includes('پزشکی')
      ? 'medicine'
      : state.player.education.major?.includes('حقوق')
        ? 'law'
        : state.player.education.major?.includes('مهندسی') ||
            state.player.education.major?.includes('کامپیوتر')
          ? 'engineering'
          : 'general';
  const credSpec = countryDef.credentials[credTrack] ?? countryDef.credentials.general;

  const macroHistory = state.countryMacros?.[countryDef.id]?.history ?? [];
  const fxSparkValues = (state.fxState?.history ?? [])
    .slice(-14)
    .map((h) => h.usdRates.IRT / Math.max(0.0001, h.usdRates[countryDef.currencyCode] ?? 1));

  const sortedFactors = [...difficulty.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const maxFactorPoints = Math.max(25, ...sortedFactors.map((f) => Math.abs(f.points)));
  const surplusLocal = netRange.monthlyNetMedian - monthlyBudget.totalMonthlyLocal;
  const affordabilityPct = Math.max(
    8,
    Math.min(100, Math.round((netRange.monthlyNetMedian / Math.max(1, monthlyBudget.totalMonthlyLocal)) * 65)),
  );
  const inflationPct = Number(
    ((state.countryMacros?.[countryDef.id]?.lastInflationRate ?? countryDef.macro.inflationRate.value) * 100).toFixed(1),
  );
  const unemploymentPct = Number(
    ((state.countryMacros?.[countryDef.id]?.unemploymentRate ?? countryDef.macro.unemploymentRate.value) * 100).toFixed(1),
  );
  const minWageLocal =
    state.countryMacros?.[countryDef.id]?.minWageMonthlyLocal ??
    countryDef.macro.minWageMonthlyLocal.value;

  const handleSolveAction = (tab: 'work' | 'assets' | 'activities' | 'emigration', subTarget: string) => {
    if (tab === 'emigration' && subTarget === 'language') {
      setActiveTab('paths');
      return;
    }
    if (tab !== 'emigration' && onDeepLink) {
      onDeepLink(tab, subTarget);
    }
  };

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title={countryDef.nameFa}
      subtitle={`${statusLabel} · سختی پذیرش ${toPersianDigits(difficulty.totalDifficulty)}٪`}
      zIndexClass="z-[57]"
      headerRight={
        <div className="flex items-center gap-1.5">
          <CountryFlag countryId={countryDef.id} size="sm" />
          <button
            type="button"
            onClick={() => onSilentSave(toggleShortlistCountryAction(saveGame, countryDef.id))}
            aria-label="افزودن به مقایسه"
            className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors ${
              isShortlisted
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            <IconStar className="h-4 w-4" />
          </button>
        </div>
      }
      stickySubHeader={
        <SegmentedControl<DetailTab>
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'income', label: 'درآمد و هزینه' },
            { value: 'paths', label: 'مسیرها' },
            { value: 'life', label: 'زندگی' },
            { value: 'economy', label: 'اقتصاد' },
            { value: 'risks', label: 'خطرها' },
          ]}
        />
      }
    >
      {activeTab === 'income' && (
        <div className="space-y-4">
          <ExchangeRateStrip state={state} highlightCurrency={countryDef.currencyCode} compact />

          {/* Interactive Monthly Income & Living Cost Calculator */}
          <section
            data-testid="abroad-income-calculator"
            className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[var(--text)]">ماشین‌حساب درآمد و هزینه ماهانه</h3>
              <Badge tone={surplusLocal >= 0 ? 'success' : 'warning'}>
                {surplusLocal >= 0 ? 'قابل پرداخت و پس‌انداز' : 'نیاز به پشتوانه'}
              </Badge>
            </div>

            {/* Profession, City Tier, Family Size Controls */}
            <div className="space-y-2.5 rounded-2xl bg-[var(--surface-2)] p-3 text-xs">
              <label className="block space-y-1">
                <span className="font-bold text-[var(--text)]">شغل نمونه در مقصد</span>
                <select
                  aria-label="انتخاب شغل برای محاسبه درآمد مقصد"
                  value={effectiveJobId}
                  onChange={(e) => setCalcJobId(e.target.value)}
                  className="min-h-[40px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text)]"
                >
                  {gameDataset.jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.shortTitle || job.titleFa}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1">
                <span className="font-bold text-[var(--text)]">شهر و سطح هزینه</span>
                <div className="flex flex-wrap gap-1.5">
                  {countryDef.regions.map((reg) => {
                    const active = effectiveRegionId === reg.id;
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => setSelectedRegionId(reg.id)}
                        className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold transition-colors ${
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
                        }`}
                      >
                        {reg.nameFa}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-[var(--text)]">اندازه خانوار</span>
                <SegmentedControl<'1' | '2' | '3'>
                  value={calcFamilySize}
                  onChange={setCalcFamilySize}
                  items={[
                    { value: '1', label: '۱ نفر (مجرد)' },
                    { value: '2', label: '۲ نفر (زوج)' },
                    { value: '3', label: 'خانواده ۳+ نفر' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">میانه حقوق خالص</div>
                <div className="mt-1">
                  <MoneyText
                    amount={netRange.monthlyNetMedian}
                    currency={netRange.currencyCode}
                    mode="stacked"
                    stateOverride={state}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">سبد هزینه ماهانه</div>
                <div className="mt-1">
                  <MoneyText
                    amount={monthlyBudget.totalMonthlyLocal}
                    currency={monthlyBudget.currencyCode}
                    mode="stacked"
                    stateOverride={state}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">مانده ماهانه</div>
                <div className="mt-1">
                  <MoneyText
                    amount={surplusLocal}
                    currency={netRange.currencyCode}
                    mode="stacked"
                    showSign
                    stateOverride={state}
                    primaryClassName={surplusLocal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
                  />
                </div>
              </div>
            </div>

            {/* Affordability Visual Bar */}
            <div className="space-y-1.5 rounded-xl bg-[var(--surface-2)] p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--text)]">توان پوشش هزینه با حقوق شغلی</span>
                <span
                  className={`font-bold tabular-nums ${
                    surplusLocal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}
                >
                  {surplusLocal >= 0
                    ? `مازاد ${toPersianDigits(Math.round((surplusLocal / Math.max(1, monthlyBudget.totalMonthlyLocal)) * 100))}٪`
                    : `کسری ${toPersianDigits(Math.round((Math.abs(surplusLocal) / Math.max(1, monthlyBudget.totalMonthlyLocal)) * 100))}٪`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${affordabilityPct}%`,
                    backgroundColor: surplusLocal >= 0 ? 'var(--success)' : 'var(--warning)',
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
                <span>بازه حقوق:</span>
                <MoneyText
                  amount={netRange.monthlyNetLow}
                  currency={netRange.currencyCode}
                  mode="single"
                  stateOverride={state}
                />
                <span>تا</span>
                <MoneyText
                  amount={netRange.monthlyNetHigh}
                  currency={netRange.currencyCode}
                  mode="inline"
                  stateOverride={state}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                <span>اجاره مسکن:</span>
                <MoneyText
                  amount={monthlyBudget.rentLocal}
                  currency={monthlyBudget.currencyCode}
                  mode="inline"
                  stateOverride={state}
                  primaryClassName="font-bold text-[var(--text)]"
                />
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                <span>خوراک و خرید:</span>
                <MoneyText
                  amount={monthlyBudget.foodLocal}
                  currency={monthlyBudget.currencyCode}
                  mode="inline"
                  stateOverride={state}
                  primaryClassName="font-bold text-[var(--text)]"
                />
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                <span>حمل‌ونقل و قبوض:</span>
                <MoneyText
                  amount={monthlyBudget.utilitiesTransportLocal}
                  currency={monthlyBudget.currencyCode}
                  mode="inline"
                  stateOverride={state}
                  primaryClassName="font-bold text-[var(--text)]"
                />
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                <span>بیمه و درمان:</span>
                <MoneyText
                  amount={monthlyBudget.healthcareMiscLocal}
                  currency={monthlyBudget.currencyCode}
                  mode="inline"
                  stateOverride={state}
                  primaryClassName="font-bold text-[var(--text)]"
                />
              </div>
            </div>
          </section>

          <div ref={breakdownRef}>
            <SectionGroup
              title={`تجزیه سختی پرونده (سختی کل ${toPersianDigits(difficulty.totalDifficulty)}٪)`}
              subtitle={`شانس برآوردی تأیید در مسیر «${activePathSpec.titleFa}»: ${toPersianDigits(difficulty.approvalChancePct)}٪`}
            >
              {sortedFactors.slice(0, 7).map((factor) => {
                const isHelpful = factor.impact === 'helpful';
                const isBarrier = factor.impact === 'barrier';
                const textTone = isHelpful
                  ? 'text-[var(--success)]'
                  : isBarrier
                    ? 'text-[var(--danger)]'
                    : 'text-[var(--text-muted)]';
                const barFill = isHelpful
                  ? 'var(--success)'
                  : isBarrier
                    ? 'var(--danger)'
                    : 'var(--border-strong)';
                const barPct = Math.max(
                  10,
                  Math.min(100, Math.round((Math.abs(factor.points) / maxFactorPoints) * 100)),
                );

                return (
                  <div
                    key={factor.id}
                    className="space-y-1.5 px-3.5 py-2.5 text-right"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--text)]">
                            {factor.labelFa}
                          </span>
                          <span className={`text-xs font-bold tabular-nums ${textTone}`}>
                            <bdi dir="rtl">
                              {factor.points > 0
                                ? `+${toPersianDigits(factor.points)} سختی`
                                : `${toPersianDigits(factor.points)} تسهیل`}
                            </bdi>
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {factor.detailFa}
                        </div>
                      </div>
                      {factor.fixAction && (
                        <button
                          type="button"
                          onClick={() => handleSolveAction(factor.fixAction!.tab, factor.fixAction!.subTarget)}
                          className="min-h-[38px] shrink-0 rounded-xl border border-[var(--primary)]/45 bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
                        >
                          {t('emigrationHub.solveAction')}
                        </button>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${barPct}%`, backgroundColor: barFill }}
                      />
                    </div>
                  </div>
                );
              })}
            </SectionGroup>
          </div>
        </div>
      )}

      {activeTab === 'paths' && (
        <div className="space-y-4">
          {state.player.age < 18 ? (
            <LockedNotice message="شروع پرونده مستقل مهاجرت از ۱۸ سالگی فعال می‌شود." />
          ) : (
            <>
              <ExchangeRateStrip state={state} highlightCurrency={countryDef.currencyCode} compact />

              <section className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[var(--text)]">انتخاب مسیر مهاجرت</h3>
                  {app?.selectedPathId !== activePathSpec.id && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSave(
                          startOrSelectEmigrationPathAction(
                            saveGame,
                            countryDef.id,
                            activePathSpec.id,
                            gameDataset,
                          ),
                        )
                      }
                      className="min-h-[36px] rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
                    >
                      تثبیت این مسیر
                    </button>
                  )}
                </div>
                <SegmentedControl<MigrationPathType>
                  value={activePathSpec.id}
                  onChange={(val) => setSelectedPathOverride(val)}
                  items={pathsDef.pathways.slice(0, 5).map((p) => ({
                    value: p.id,
                    label: p.titleFa,
                  }))}
                />
                <div className="flex flex-wrap items-center gap-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  <span>{activePathSpec.summaryFa} · تمکن مالی لازم:</span>
                  <MoneyText
                    amount={activePathSpec.proofOfFundsLocal}
                    currency={countryDef.currencyCode}
                    mode="inline"
                    stateOverride={state}
                    primaryClassName="font-bold text-[var(--text)]"
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <h3 className="text-xs font-bold text-[var(--text)]">
                  مسیر شش‌گام پرونده ({toPersianDigits(stepIdx)} از ۶)
                </h3>
                <ProgressStepper
                  orientation="horizontal"
                  steps={EMIGRATION_STEP_LABELS_FA.map((lbl, idx) => ({
                    id: String(idx),
                    title: lbl,
                    status:
                      idx < stepIdx ? 'done' : idx === stepIdx ? 'current' : 'upcoming',
                  }))}
                />

                {app?.status === 'approved' && !isCurrentResidency ? (
                  <div className="space-y-3 rounded-xl border border-[var(--success)]/35 bg-[var(--success)]/10 p-3">
                    <div className="text-xs font-bold text-[var(--success)]">
                      ویزای {countryDef.nameFa} تأیید شده است! شهر محل استقرار را انتخاب کن:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {countryDef.regions.map((reg) => (
                        <button
                          key={reg.id}
                          type="button"
                          onClick={() => setSelectedRegionId(reg.id)}
                          className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold ${
                            effectiveRegionId === reg.id
                              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
                          }`}
                        >
                          {reg.nameFa}
                        </button>
                      ))}
                    </div>
                    <ActionButton
                      icon={<IconPlane className="h-4 w-4" />}
                      label={`سفر و آغاز زندگی در ${countryDef.nameFa}`}
                      effectHint="اقامتگاه و بازار کار این کشور فعال می‌شوند"
                      onClick={() => {
                        onUpdateSave(
                          completeAbroadArrivalAndMoveAction(
                            saveGame,
                            countryDef.id,
                            effectiveRegionId,
                            gameDataset,
                          ),
                        );
                        onClose();
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {!isCurrentResidency && nextStepFee.feeLocal > 0 && (
                      <AffordabilityBadge
                        amount={nextStepFee.feeLocal}
                        currency={nextStepFee.currencyCode}
                        state={state}
                      />
                    )}
                    <ActionButton
                      icon={<IconCheck className="h-4 w-4" />}
                      label={`اجرای گام ${toPersianDigits(stepIdx + 1)}: ${EMIGRATION_STEP_LABELS_FA[Math.min(5, stepIdx)]}`}
                      costText={
                        <MoneyText
                          amount={nextStepFee.feeLocal}
                          currency={nextStepFee.currencyCode}
                          mode="inline"
                          stateOverride={state}
                          interactive={false}
                        />
                      }
                      disabled={isCurrentResidency}
                      disabledReason={isCurrentResidency ? 'هم‌اکنون در این کشور اقامت داری' : undefined}
                      onClick={() => {
                        if (nextStepFee.feeLocal <= 0) {
                          onUpdateSave(
                            advanceEmigrationPipelineStepAction(
                              saveGame,
                              countryDef.id,
                              activePathSpec.id,
                              gameDataset,
                            ),
                          );
                          return;
                        }
                        setPendingPayment({
                          kind: 'step',
                          title: `پرداخت گام ${toPersianDigits(stepIdx + 1)}: ${EMIGRATION_STEP_LABELS_FA[Math.min(5, stepIdx)]}`,
                          subtitle: `پرونده ${countryDef.nameFa} · مسیر «${activePathSpec.titleFa}»`,
                          amount: nextStepFee.feeLocal,
                          currency: nextStepFee.currencyCode,
                          confirmLabel: 'تأیید و اجرای گام',
                        });
                      }}
                    />
                  </div>
                )}
              </section>

              <SectionGroup title="آموزش و آزمون زبان مقصد">
                <ActionRow
                  icon={<IconBook className="h-4 w-4" />}
                  title={`سطح زبان فعلی: ${getLanguageLevelLabelFa(langLevel)}`}
                  subtitle={`حداقل سطح مورد نیاز مسیر «${activePathSpec.titleFa}»: ${getLanguageLevelLabelFa(activePathSpec.requiredLanguageLevel)}`}
                  value={
                    langLevel >= 6 ? (
                      'تکمیل'
                    ) : (
                      <MoneyText
                        amount={langCost.costLocal}
                        currency={langCost.currencyCode}
                        mode="inline"
                        stateOverride={state}
                        interactive={false}
                      />
                    )
                  }
                  state={
                    langLevel >= 6
                      ? 'done'
                      : state.flags[`cd_lang_${countryDef.id}`] === state.turn
                        ? 'cooldown'
                        : 'enabled'
                  }
                  ctaLabel={langLevel >= 6 ? undefined : 'دوره فشرده'}
                  onClick={() => {
                    if (langCost.costLocal <= 0) {
                      onUpdateSave(studyForeignLanguageAction(saveGame, countryDef.id, gameDataset));
                      return;
                    }
                    setPendingPayment({
                      kind: 'language',
                      title: `ثبت‌نام دوره فشرده زبان ${countryDef.nameFa}`,
                      subtitle: `ارتقای سطح زبان از ${getLanguageLevelLabelFa(langLevel)}`,
                      amount: langCost.costLocal,
                      currency: langCost.currencyCode,
                      confirmLabel: 'پرداخت و شروع دوره',
                    });
                  }}
                />
              </SectionGroup>
            </>
          )}
        </div>
      )}

      {activeTab === 'life' && (
        <div className="space-y-4">
          <SectionGroup title="شهرها و مناطق پیشنهادی">
            {countryDef.regions.slice(0, 5).map((reg) => (
              <div
                key={reg.id}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0 text-right">
                  <div className="font-bold text-[var(--text)]">{reg.nameFa}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    شاخص فرصت شغلی: {toPersianDigits(Math.round(reg.jobOpportunityIndex * 100))}٪
                  </div>
                </div>
                <div className="shrink-0 text-left tabular-nums">
                  <div className="font-bold text-[var(--text)]">
                    هزینه {toPersianDigits(Math.round(reg.colMultiplier * 100))}٪
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    اجاره {toPersianDigits(Math.round(reg.rentMultiplier * 100))}٪
                  </div>
                </div>
              </div>
            ))}
          </SectionGroup>

          <SectionGroup title="مالیات، بیمه‌ها و تطبیق مدرک">
            <ActionRow
              icon={<IconShield className="h-4 w-4" />}
              title="سهم بیمه اجتماعی کارمند"
              subtitle="پوشش بازنشستگی و بیکاری پس از اشتغال رسمی"
              value={`${toPersianDigits(Math.round(countryDef.taxAndBenefits.socialSecurityEmployeeRate.value * 100))}٪`}
            />
            <ActionRow
              icon={<IconCoins className="h-4 w-4" />}
              title="حمایت بیمه بیکاری"
              subtitle={`پس از ${toPersianDigits(countryDef.taxAndBenefits.unemploymentEligibleMonthsWorked)} ماه سابقه کار قانونی`}
              value={`${toPersianDigits(Math.round(countryDef.taxAndBenefits.unemploymentBenefitRatio * 100))}٪ حقوق`}
            />
            <ActionRow
              icon={<IconBook className="h-4 w-4" />}
              title="وضعیت تطبیق مدرک رشته تو"
              subtitle={
                credSpec.needsRelicensing
                  ? `نیازمند آزمون تطبیق و حداقل سطح زبان «${getLanguageLevelLabelFa(credSpec.minLanguageLevel)}»`
                  : 'رشته با اعتبار مستقیم در بازار کار مقصد'
              }
              value={`${toPersianDigits(Math.round(credSpec.recognitionFactor * 100))}٪ ضریب اولیه`}
            />
          </SectionGroup>
        </div>
      )}

      {activeTab === 'economy' && (
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[var(--text)]">روند شبیه‌سازی نرخ ارز و شاخص</h3>
              <Badge tone="warning">{t('emigrationHub.simulationBadge')}</Badge>
            </div>
            <Sparkline
              values={
                fxSparkValues.length >= 2
                  ? fxSparkValues
                  : macroHistory.map((h) => h.minWageMonthlyLocal)
              }
              height={46}
            />
            <div className="text-xs leading-relaxed text-[var(--text-muted)]">
              {countryDef.macro.verifiedAnchorNoteFa} · وضعیت نرخ برابری قدرت خرید: {realFx.assessmentFa}
            </div>
          </section>

          <SectionGroup title="شاخص‌های کلان مقصد">
            <ActionRow
              icon={<IconSparkles className="h-4 w-4" />}
              title="حداقل دستمزد ماهانه"
              subtitle={
                countryDef.macro.hasStatutoryMinWage === false
                  ? 'بدون حداقل دستمزد قانونی عام (نرخ مرجع بازار کار)'
                  : countryDef.macro.minWageMonthlyLocal.confidence === 'estimate'
                    ? 'برآوردی بر پایه داده‌های مرجع'
                    : 'مصوب قانونی کشور مقصد'
              }
              value={
                <MoneyText
                  amount={minWageLocal}
                  currency={countryDef.currencyCode}
                  mode="inline"
                  stateOverride={state}
                />
              }
            />
            <ActionRow
              icon={<IconCoins className="h-4 w-4" />}
              title="نرخ تورم سالانه مقصد"
              subtitle="به‌روزرسانی سالانه بر پایه مدل اقتصاد کلان"
              value={`${toPersianDigits(inflationPct)}٪`}
            />
            <ActionRow
              icon={<IconShield className="h-4 w-4" />}
              title="نرخ بیکاری کل"
              subtitle="تأثیرگذار بر شانس مصاحبه و رشد دستمزد"
              value={`${toPersianDigits(unemploymentPct)}٪`}
            />
          </SectionGroup>
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="space-y-4">
          <SectionGroup title="قواعد ویزا و ریسک‌های اقامت">
            <ActionRow
              icon={<IconWarning className="h-4 w-4" />}
              iconTone="warning"
              title="وابستگی ویزا به کارفرما"
              subtitle={
                countryDef.visaRules.employerTiedWorkPermit
                  ? `در صورت بیکاری تا ${toPersianDigits(countryDef.visaRules.jobLossGraceMonths)} ماه فرصت یافتن شغل جدید وجود دارد`
                  : 'ویزای کار منعطف با ریسک پایین‌تر لغو فوری اقامت'
              }
              value={
                countryDef.visaRules.employerTiedWorkPermit
                  ? `${toPersianDigits(countryDef.visaRules.jobLossGraceMonths)} ماه مهلت`
                  : 'منعطف'
              }
            />
            <ActionRow
              icon={<IconPlane className="h-4 w-4" />}
              title="تعداد ماه‌های تمکن مورد نیاز"
              subtitle="ارزیابی نقدینگی در کیف‌پول ارزی برای صدور ویزا"
              value={`${toPersianDigits(countryDef.visaRules.proofOfFundsMonths)} ماه`}
            />
          </SectionGroup>

          <SectionGroup title="نقاط قوت، چالش‌ها و واقعیت‌ها">
            {countryDef.prosFa.slice(0, 2).map((line, i) => (
              <div key={`pro_${i}`} className="px-3.5 py-2.5 text-xs text-[var(--text)]">
                <span className="font-bold text-[var(--success)]">مزیت: </span>
                <span>{line}</span>
              </div>
            ))}
            {countryDef.consFa.slice(0, 2).map((line, i) => (
              <div key={`con_${i}`} className="px-3.5 py-2.5 text-xs text-[var(--text)]">
                <span className="font-bold text-[var(--warning)]">چالش: </span>
                <span>{line}</span>
              </div>
            ))}
            {(contentSettings.allowSocialPolitical ? countryDef.realityNotesFa : countryDef.realityNotesFa.slice(0, 1))
              .slice(0, 2)
              .map((line, i) => (
                <div key={`real_${i}`} className="px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
                  <span className="font-bold text-[var(--text)]">نکته واقعی: </span>
                  <span>{line}</span>
                </div>
              ))}
          </SectionGroup>
        </div>
      )}

      {pendingPayment && (
        <ForeignPaymentSheet
          open={true}
          onClose={() => setPendingPayment(null)}
          title={pendingPayment.title}
          subtitle={pendingPayment.subtitle}
          amount={pendingPayment.amount}
          currency={pendingPayment.currency}
          state={state}
          confirmLabel={pendingPayment.confirmLabel}
          lockedRateToIrt={app?.lockedRates?.ratesToIrt?.[countryDef.currencyCode]}
          lockedYear={app?.lockedRates?.year}
          onConfirm={({ payFromCurrency }) => {
            if (pendingPayment.kind === 'step') {
              onUpdateSave(
                advanceEmigrationPipelineStepAction(
                  saveGame,
                  countryDef.id,
                  activePathSpec.id,
                  gameDataset,
                  { payFromCurrency },
                ),
              );
            } else {
              onUpdateSave(
                studyForeignLanguageAction(saveGame, countryDef.id, gameDataset, {
                  payFromCurrency,
                }),
              );
            }
            setPendingPayment(null);
          }}
        />
      )}
    </DetailSheet>
  );
}
