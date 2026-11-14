import { useMemo, useState } from 'react';
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
import { formatCurrencyAmount, getFxRate, getRealExchangeRateAndPppGap } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import type { MigrationPathType, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  advanceEmigrationPipelineStepAction,
  completeAbroadArrivalAndMoveAction,
  startOrSelectEmigrationPathAction,
  studyForeignLanguageAction,
  toggleShortlistCountryAction,
  type ActionOutcome,
} from '../../../state/actions';
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

interface CountryDetailViewProps {
  open: boolean;
  countryId: string | null;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSave: (nextSave: SaveGame) => void;
  onDeepLink?: (tab: 'work' | 'assets' | 'activities', subTarget?: string) => void;
}

export function CountryDetailView({
  open,
  countryId,
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

  const netRange = useMemo(
    () =>
      countryId
        ? getExpectedAbroadMonthlyNetRange({
            countryId,
            state,
            dataset: gameDataset,
          })
        : null,
    [countryId, state],
  );

  const effectiveRegionId = selectedRegionId ?? countryDef?.regions[0]?.id;
  const monthlyBudget = useMemo(
    () =>
      countryId
        ? getAbroadMonthlyBudget(state, gameDataset, countryId, effectiveRegionId)
        : null,
    [countryId, state, effectiveRegionId],
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
  const fxToIrt = getFxRate(state, countryDef.currencyCode, 'IRT', gameDataset);
  const realFx = getRealExchangeRateAndPppGap(state, countryDef.currencyCode, gameDataset);
  const stepIdx = app && app.selectedPathId === activePathSpec.id ? app.currentStepIndex : 0;
  const nextStepFee = getEmigrationStepFeeLocal(
    countryDef.id,
    activePathSpec,
    Math.min(5, stepIdx),
    state,
    gameDataset,
  );

  const currentJobDef = state.player.job
    ? gameDataset.jobs.find((j) => j.id === state.player.job!.jobId)
    : undefined;
  const credTrack = currentJobDef
    ? getCredentialTrackForJob(currentJobDef, state.player.education.major)
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

  const sortedFactors = [...difficulty.factors].sort((a, b) => b.points - a.points);
  const surplusLocal = netRange.monthlyNetMedian - monthlyBudget.totalMonthlyLocal;
  const surplusToman = Math.round(surplusLocal * fxToIrt);
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
          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[var(--text)]">تراز ماهانه درآمد و هزینه</h3>
              <Badge tone={surplusLocal >= 0 ? 'success' : 'warning'}>
                {surplusLocal >= 0 ? 'تراز مثبت' : 'نیاز به پس‌انداز'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-center text-xs">
              <div>
                <div className="text-[10px] text-[var(--text-muted)]">میانه حقوق خالص</div>
                <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                  <bdi dir="rtl">
                    {formatCurrencyAmount(netRange.monthlyNetMedian, netRange.currencyCode, gameDataset)}
                  </bdi>
                </div>
                <div className="text-[10px] tabular-nums text-[var(--text-muted)]">
                  <bdi dir="rtl">
                    {formatCurrencyAmount(Math.round(netRange.monthlyNetMedian * fxToIrt), 'IRT', gameDataset, { compact: true })}
                  </bdi>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-muted)]">سبد هزینه ماهانه</div>
                <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                  <bdi dir="rtl">
                    {formatCurrencyAmount(monthlyBudget.totalMonthlyLocal, monthlyBudget.currencyCode, gameDataset)}
                  </bdi>
                </div>
                <div className="text-[10px] tabular-nums text-[var(--text-muted)]">
                  <bdi dir="rtl">
                    {formatCurrencyAmount(monthlyBudget.totalMonthlyToman, 'IRT', gameDataset, { compact: true })}
                  </bdi>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-muted)]">مانده ماهانه</div>
                <div
                  className={`mt-0.5 font-bold tabular-nums ${
                    surplusLocal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}
                >
                  <bdi dir="rtl">
                    {formatCurrencyAmount(surplusLocal, netRange.currencyCode, gameDataset)}
                  </bdi>
                </div>
                <div className="text-[10px] tabular-nums text-[var(--text-muted)]">
                  <bdi dir="rtl">
                    {formatCurrencyAmount(surplusToman, 'IRT', gameDataset, { compact: true })}
                  </bdi>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)]">
              <div className="flex justify-between rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                <span>اجاره مسکن:</span>
                <bdi dir="rtl" className="font-bold tabular-nums text-[var(--text)]">
                  {formatCurrencyAmount(monthlyBudget.rentLocal, monthlyBudget.currencyCode, gameDataset)}
                </bdi>
              </div>
              <div className="flex justify-between rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                <span>خوراک و خرید:</span>
                <bdi dir="rtl" className="font-bold tabular-nums text-[var(--text)]">
                  {formatCurrencyAmount(monthlyBudget.foodLocal, monthlyBudget.currencyCode, gameDataset)}
                </bdi>
              </div>
              <div className="flex justify-between rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                <span>حمل‌ونقل و قبوض:</span>
                <bdi dir="rtl" className="font-bold tabular-nums text-[var(--text)]">
                  {formatCurrencyAmount(monthlyBudget.utilitiesTransportLocal, monthlyBudget.currencyCode, gameDataset)}
                </bdi>
              </div>
              <div className="flex justify-between rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                <span>بیمه و درمان:</span>
                <bdi dir="rtl" className="font-bold tabular-nums text-[var(--text)]">
                  {formatCurrencyAmount(monthlyBudget.healthcareMiscLocal, monthlyBudget.currencyCode, gameDataset)}
                </bdi>
              </div>
            </div>
          </section>

          <SectionGroup
            title={`تجزیه سختی پرونده (سختی کل ${toPersianDigits(difficulty.totalDifficulty)}٪)`}
            subtitle={`شانس برآوردی تأیید در مسیر «${activePathSpec.titleFa}»: ${toPersianDigits(difficulty.approvalChancePct)}٪`}
          >
            {sortedFactors.slice(0, 7).map((factor) => {
              const barColor =
                factor.impact === 'helpful'
                  ? 'text-[var(--success)]'
                  : factor.impact === 'barrier'
                    ? 'text-[var(--danger)]'
                    : 'text-[var(--text-muted)]';
              return (
                <div
                  key={factor.id}
                  className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-right"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-[var(--text)]">
                        {factor.labelFa}
                      </span>
                      <span className={`text-[11px] font-bold tabular-nums ${barColor}`}>
                        <bdi dir="rtl">
                          {factor.points > 0
                            ? `+${toPersianDigits(factor.points)}`
                            : toPersianDigits(factor.points)}
                        </bdi>
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {factor.detailFa}
                    </div>
                  </div>
                  {factor.fixAction && (
                    <button
                      type="button"
                      onClick={() => handleSolveAction(factor.fixAction!.tab, factor.fixAction!.subTarget)}
                      className="min-h-[36px] shrink-0 rounded-xl border border-[var(--primary)]/45 bg-[var(--primary-soft)] px-2.5 text-[11px] font-bold text-[var(--primary-strong)]"
                    >
                      {t('emigrationHub.solveAction')}
                    </button>
                  )}
                </div>
              );
            })}
          </SectionGroup>
        </div>
      )}

      {activeTab === 'paths' && (
        <div className="space-y-4">
          {state.player.age < 18 ? (
            <LockedNotice message="شروع پرونده مستقل مهاجرت از ۱۸ سالگی فعال می‌شود." />
          ) : (
            <>
              <section className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <div className="flex items-center justify-between">
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
                      className="min-h-[32px] rounded-xl bg-[var(--primary-soft)] px-2.5 text-[11px] font-bold text-[var(--primary-strong)]"
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
                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {activePathSpec.summaryFa} · تمکن مالی لازم:{' '}
                  <bdi dir="rtl" className="font-bold text-[var(--text)]">
                    {formatCurrencyAmount(
                      activePathSpec.proofOfFundsLocal,
                      countryDef.currencyCode,
                      gameDataset,
                    )}
                  </bdi>
                </p>
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
                  <ActionButton
                    icon={<IconCheck className="h-4 w-4" />}
                    label={`اجرای گام ${toPersianDigits(stepIdx + 1)}: ${EMIGRATION_STEP_LABELS_FA[Math.min(5, stepIdx)]}`}
                    costText={formatCurrencyAmount(nextStepFee.feeLocal, nextStepFee.currencyCode, gameDataset)}
                    effectHint={`معادل ${formatCurrencyAmount(nextStepFee.feeToman, 'IRT', gameDataset, { compact: true })}`}
                    disabled={isCurrentResidency}
                    disabledReason={isCurrentResidency ? 'هم‌اکنون در این کشور اقامت داری' : undefined}
                    onClick={() =>
                      onUpdateSave(
                        advanceEmigrationPipelineStepAction(
                          saveGame,
                          countryDef.id,
                          activePathSpec.id,
                          gameDataset,
                        ),
                      )
                    }
                  />
                )}
              </section>

              <SectionGroup title="آموزش و آزمون زبان مقصد">
                <ActionRow
                  icon={<IconBook className="h-4 w-4" />}
                  title={`سطح زبان فعلی: ${getLanguageLevelLabelFa(langLevel)}`}
                  subtitle={`حداقل سطح مورد نیاز مسیر «${activePathSpec.titleFa}»: ${getLanguageLevelLabelFa(activePathSpec.requiredLanguageLevel)}`}
                  value={
                    langLevel >= 6
                      ? 'تکمیل'
                      : formatCurrencyAmount(langCost.costLocal, langCost.currencyCode, gameDataset)
                  }
                  state={
                    langLevel >= 6
                      ? 'done'
                      : state.flags[`cd_lang_${countryDef.id}`] === state.turn
                        ? 'cooldown'
                        : 'enabled'
                  }
                  ctaLabel={langLevel >= 6 ? undefined : 'دوره فشرده'}
                  onClick={() =>
                    onUpdateSave(studyForeignLanguageAction(saveGame, countryDef.id, gameDataset))
                  }
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
                  <div className="text-[11px] text-[var(--text-muted)]">
                    شاخص فرصت شغلی: {toPersianDigits(Math.round(reg.jobOpportunityIndex * 100))}٪
                  </div>
                </div>
                <div className="shrink-0 text-left tabular-nums">
                  <div className="font-bold text-[var(--text)]">
                    هزینه {toPersianDigits(Math.round(reg.colMultiplier * 100))}٪
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
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
            <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
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
              value={formatCurrencyAmount(minWageLocal, countryDef.currencyCode, gameDataset)}
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
    </DetailSheet>
  );
}
