import { useState } from 'react';
import { gameDataset } from '../../../data/registry';
import {
  getAbroadLanguageLevel,
  getAbroadMonthlyBudget,
  getActiveRegionDef,
  getCountryMacroDef,
  getCountryPathsDef,
  getCredentialTrackForJob,
} from '../../../engine/countries';
import {
  INTEGRATION_CHECKLIST_ITEMS,
  ensureEmigrationState,
  getLanguageLevelLabelFa,
  getPassportStatusLabelFa,
  getStudyLanguageCost,
} from '../../../engine/emigration';
import { formatCurrencyAmount, getFxRate } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import { getWalletBalance } from '../../../engine/ledger';
import type { PassportStatusStage, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  completeIntegrationChecklistAction,
  dismissArrivalWelcomeAction,
  relicenseCredentialAbroadAction,
  returnToIranAction,
  sendRemittanceToIranAction,
  studyForeignLanguageAction,
  type ActionOutcome,
} from '../../../state/actions';
import { CountryFlag } from '../flags/CountryFlag';
import {
  ActionButton,
  ActionRow,
  Badge,
  ConfirmDialog,
  ProgressStepper,
  SectionGroup,
} from '../Primitives';
import { SellIranPropertyWizard } from './SellIranPropertyWizard';
import {
  IconBook,
  IconCheck,
  IconCoins,
  IconHome,
  IconPlane,
  IconShield,
  IconSparkles,
  IconWarning,
} from '../../icons';

interface AbroadDashboardProps {
  saveGame: SaveGame;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSave: (nextSave: SaveGame) => void;
  onDeepLink?: (tab: 'work' | 'assets' | 'activities', subTarget?: string) => void;
}

const STAGE_ORDER: PassportStatusStage[] = ['temporary', 'renewable', 'permanent', 'citizenship'];

export function AbroadDashboard({
  saveGame,
  onUpdateSave,
  onSilentSave,
  onDeepLink,
}: AbroadDashboardProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const countryDef = getCountryMacroDef(state.player.countryId, gameDataset);
  const pathsDef = getCountryPathsDef(state.player.countryId, gameDataset);
  const emig = ensureEmigrationState(state);

  const [confirmReturn, setConfirmReturn] = useState(false);
  const [showSellWizard, setShowSellWizard] = useState(false);

  if (!countryDef || !pathsDef || state.player.countryId === 'iran') {
    return null;
  }

  const regionDef = getActiveRegionDef(countryDef.id, emig.residency.regionId, gameDataset);
  const budget = getAbroadMonthlyBudget(state, gameDataset, countryDef.id, emig.residency.regionId);
  const langLevel = getAbroadLanguageLevel(state, countryDef.id, gameDataset);
  const langCost = getStudyLanguageCost(countryDef.id, state, gameDataset);
  const localBalance = getWalletBalance(state, countryDef.currencyCode);
  const minWage =
    state.countryMacros?.[countryDef.id]?.minWageMonthlyLocal ??
    countryDef.macro.minWageMonthlyLocal.value;
  const remitPresetSmall = Math.max(50, Math.round(minWage * 0.2));
  const remitPresetMed = Math.max(100, Math.round(minWage * 0.45));

  const stageIdx = Math.max(0, STAGE_ORDER.indexOf(emig.residency.statusStage));
  const showWelcome = emig.residency.lastArrivalWelcomeSeenYear === state.currentJalaliYear;
  const iranPropValue =
    typeof state.flags['iran_owned_property_toman'] === 'number'
      ? (state.flags['iran_owned_property_toman'] as number)
      : 0;

  const currentJobDef = state.player.job
    ? gameDataset.jobs.find((j) => j.id === state.player.job!.jobId)
    : undefined;
  const credTrack = currentJobDef
    ? getCredentialTrackForJob(currentJobDef, state.player.education.major)
    : state.player.education.major?.includes('پزشکی')
      ? 'medicine'
      : state.player.education.major?.includes('حقوق')
        ? 'law'
        : state.player.education.major?.includes('مهندسی')
          ? 'engineering'
          : 'general';
  const credSpec = countryDef.credentials[credTrack] ?? countryDef.credentials.general;
  const isRelicensed = emig.residency.credentialRelicensedTracks.includes(credTrack);

  return (
    <div className="space-y-4">
      {/* Section 1: Abroad Hero & Passport Ladder */}
      <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <CountryFlag countryId={countryDef.id} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-bold text-[var(--text)]">
                  {countryDef.nameFa} {regionDef ? `· ${regionDef.nameFa}` : ''}
                </h3>
                <Badge tone="primary">{getPassportStatusLabelFa(emig.residency.statusStage)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                سال حضور: {toPersianDigits(emig.residency.yearsAbroad)} · زبان: {getLanguageLevelLabelFa(langLevel)}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <div className="text-[10px] text-[var(--text-muted)]">کیف‌پول محلی</div>
            <div className="text-xs font-bold tabular-nums text-[var(--text)]">
              <bdi dir="rtl">
                {formatCurrencyAmount(localBalance, countryDef.currencyCode, gameDataset)}
              </bdi>
            </div>
          </div>
        </div>

        <ProgressStepper
          orientation="horizontal"
          steps={[
            { id: 'temporary', title: 'موقت', status: stageIdx > 0 ? 'done' : 'current' },
            {
              id: 'renewable',
              title: 'تمدیدپذیر',
              status: stageIdx > 1 ? 'done' : stageIdx === 1 ? 'current' : 'upcoming',
            },
            {
              id: 'permanent',
              title: 'اقامت دائم',
              status: stageIdx > 2 ? 'done' : stageIdx === 2 ? 'current' : 'upcoming',
            },
            {
              id: 'citizenship',
              title: 'تابعیت',
              status: stageIdx >= 3 ? 'done' : 'upcoming',
            },
          ]}
        />

        {showWelcome && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--primary)]/35 bg-[var(--primary-soft)] px-3 py-2 text-xs">
            <span className="font-bold text-[var(--primary-strong)]">
              خوش آمدی! فهرست کارهای سال اول و جست‌وجوی شغل را از همین صفحه دنبال کن.
            </span>
            <button
              type="button"
              onClick={() => onSilentSave(dismissArrivalWelcomeAction(saveGame))}
              className="shrink-0 rounded-lg bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--text)]"
            >
              متوجه شدم
            </button>
          </div>
        )}

        {emig.residency.jobLossGraceMonthsRemaining !== undefined && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--warning)]/45 bg-[var(--warning)]/10 px-3 py-2.5 text-xs">
            <div className="flex items-start gap-2">
              <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <div>
                <div className="font-bold text-[var(--text)]">
                  مهلت ویزای کار: {toPersianDigits(emig.residency.jobLossGraceMonthsRemaining)} ماه باقی‌مانده
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  برای تمدید اقامت، قرارداد کاری تازه ببند.
                </div>
              </div>
            </div>
            {onDeepLink && (
              <button
                type="button"
                onClick={() => onDeepLink('work', 'jobs')}
                className="min-h-[34px] shrink-0 rounded-xl bg-[var(--primary)] px-2.5 text-[11px] font-bold text-[var(--on-primary)]"
              >
                بازار کار
              </button>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Annual Economic Report & Monthly Cost */}
      <section className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text)]">گزارش اقتصادی اقامت</h3>
          <span className="text-[11px] text-[var(--text-muted)]">
            هزینه ماهانه: <bdi dir="rtl">{formatCurrencyAmount(budget.totalMonthlyLocal, budget.currencyCode, gameDataset)}</bdi>
          </span>
        </div>
        {emig.lastReportCard ? (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-center text-xs">
            <div>
              <div className="text-[10px] text-[var(--text-muted)]">درآمد خالص سال</div>
              <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                <bdi dir="rtl">
                  {formatCurrencyAmount(emig.lastReportCard.netIncomeLocal, emig.lastReportCard.currencyCode, gameDataset)}
                </bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)]">مخارج و مالیات</div>
              <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                <bdi dir="rtl">
                  {formatCurrencyAmount(emig.lastReportCard.livingCostsLocal, emig.lastReportCard.currencyCode, gameDataset)}
                </bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)]">تراز سال اخیر</div>
              <div
                className={`mt-0.5 font-bold tabular-nums ${
                  emig.lastReportCard.savingsDeltaLocal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                }`}
              >
                <bdi dir="rtl">
                  {formatCurrencyAmount(emig.lastReportCard.savingsDeltaLocal, emig.lastReportCard.currencyCode, gameDataset)}
                </bdi>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
            گزارش سالانه درآمد، مالیات و پس‌انداز از پایان نخستین سال اقامت در این بخش ثبت می‌شود.
          </div>
        )}
      </section>

      {/* Section 3: 12-Month Integration Checklist */}
      <SectionGroup
        title="فهرست استقرار سال نخست"
        subtitle={`${toPersianDigits(emig.residency.checklistDoneIds.length)} از ${toPersianDigits(INTEGRATION_CHECKLIST_ITEMS.length)} تکمیل شده`}
      >
        {INTEGRATION_CHECKLIST_ITEMS.map((item) => {
          const done = emig.residency.checklistDoneIds.includes(item.id);
          const costLocal = Math.max(1, Math.round(minWage * item.costLocalMinWageShare));
          return (
            <ActionRow
              key={item.id}
              icon={<IconCheck className="h-4 w-4" />}
              title={item.titleFa}
              subtitle={item.subtitleFa}
              value={done ? undefined : formatCurrencyAmount(costLocal, countryDef.currencyCode, gameDataset)}
              state={done ? 'done' : 'enabled'}
              ctaLabel={done ? undefined : 'انجام'}
              onClick={() =>
                onUpdateSave(completeIntegrationChecklistAction(saveGame, item.id, gameDataset))
              }
            />
          );
        })}
      </SectionGroup>

      {/* Section 4: Language, Relicensing, Remittance & Housing */}
      <SectionGroup title="کارهای روزمره و مالی در مقصد">
        <ActionRow
          icon={<IconBook className="h-4 w-4" />}
          title={`تقویت زبان (${getLanguageLevelLabelFa(langLevel)})`}
          subtitle="سطح بالاتر زبان درآمد و مسیر اقامت دائم را تسریع می‌کند"
          value={
            langLevel >= 6
              ? 'پیشرفته'
              : formatCurrencyAmount(langCost.costLocal, langCost.currencyCode, gameDataset)
          }
          state={
            langLevel >= 6
              ? 'done'
              : state.flags[`cd_lang_${countryDef.id}`] === state.turn
                ? 'cooldown'
                : 'enabled'
          }
          ctaLabel={langLevel >= 6 ? undefined : 'کلاس زبان'}
          onClick={() =>
            onUpdateSave(studyForeignLanguageAction(saveGame, countryDef.id, gameDataset))
          }
        />

        {credSpec.needsRelicensing && !isRelicensed && (
          <ActionRow
            icon={<IconSparkles className="h-4 w-4" />}
            title="آزمون معادل‌سازی مدرک تخصصی"
            subtitle={`پیش‌نیاز زبان: ${getLanguageLevelLabelFa(credSpec.minLanguageLevel)}`}
            value={formatCurrencyAmount(credSpec.costLocal, countryDef.currencyCode, gameDataset)}
            ctaLabel="معادل‌سازی"
            onClick={() =>
              onUpdateSave(relicenseCredentialAbroadAction(saveGame, credTrack, gameDataset))
            }
          />
        )}

        <ActionRow
          icon={<IconCoins className="h-4 w-4" />}
          title="ارسال حواله حمایتی به خانواده"
          subtitle={`معادل حدود ${formatCurrencyAmount(Math.round(remitPresetSmall * getFxRate(state, countryDef.currencyCode, 'IRT', gameDataset)), 'IRT', gameDataset, { compact: true })}`}
          value={formatCurrencyAmount(remitPresetSmall, countryDef.currencyCode, gameDataset)}
          ctaLabel="ارسال"
          onClick={() =>
            onUpdateSave(sendRemittanceToIranAction(saveGame, remitPresetSmall, gameDataset))
          }
        />

        {localBalance >= remitPresetMed && (
          <ActionRow
            icon={<IconCoins className="h-4 w-4" />}
            title="حمایت ویژه مالی از خانواده"
            subtitle="ارسال مبلغ بیشتر و تقویت پیوند عاطفی"
            value={formatCurrencyAmount(remitPresetMed, countryDef.currencyCode, gameDataset)}
            ctaLabel="ارسال"
            onClick={() =>
              onUpdateSave(sendRemittanceToIranAction(saveGame, remitPresetMed, gameDataset))
            }
          />
        )}

        {onDeepLink && (
          <ActionRow
            icon={<IconHome className="h-4 w-4" />}
            title="اجاره یا خرید مسکن در مقصد"
            subtitle="تنظیم قرارداد مسکن محلی در تب دارایی‌ها"
            showChevron
            onClick={() => onDeepLink('assets', 'housing')}
          />
        )}

        {iranPropValue > 0 && (
          <ActionRow
            icon={<IconShield className="h-4 w-4" />}
            title="فروش ملک ایران و انتقال سرمایه"
            subtitle={`ارزش روز ملک: ${formatCurrencyAmount(iranPropValue, 'IRT', gameDataset, { compact: true })}`}
            ctaLabel="شروع جادوگر"
            onClick={() => setShowSellWizard(true)}
          />
        )}
      </SectionGroup>

      {/* Section 5: Return Home */}
      <section>
        <ActionButton
          variant="danger"
          icon={<IconPlane className="h-4 w-4" />}
          label={t('emigrationHub.returnHome')}
          effectHint="پایان اقامت در خارج و بازگشت به ایران"
          onClick={() => setConfirmReturn(true)}
        />
      </section>

      <ConfirmDialog
        open={confirmReturn}
        title="بازگشت داوطلبانه به ایران"
        message={`با بازگشت به ایران، قرارداد کاری و اجاره فعلی در ${countryDef.nameFa} خاتمه می‌یابد و دارایی‌های ارزی کیف‌پول حفظ می‌شوند. ادامه می‌دهی؟`}
        destructive
        confirmLabel="تأیید بازگشت"
        onCancel={() => setConfirmReturn(false)}
        onConfirm={() => {
          onUpdateSave(returnToIranAction(saveGame, gameDataset));
          setConfirmReturn(false);
        }}
      />

      <SellIranPropertyWizard
        open={showSellWizard}
        saveGame={saveGame}
        onClose={() => setShowSellWizard(false)}
        onUpdateSave={onUpdateSave}
      />
    </div>
  );
}
