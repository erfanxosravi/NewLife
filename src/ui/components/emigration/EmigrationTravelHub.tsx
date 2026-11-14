import { useEffect, useMemo, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import {
  ensureEmigrationState,
  getCountryApplicationDisplayStatusFa,
  getShortTripQuote,
} from '../../../engine/emigration';
import { getFxRate } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import type { CurrencyCode, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  dismissArrivalWelcomeAction,
  takeShortForeignTripAction,
  toggleShortlistCountryAction,
  type ActionOutcome,
} from '../../../state/actions';
import { getEmigrationHubSummary } from '../../../state/selectors';
import { AffordabilityBadge } from '../AffordabilityBadge';
import { ExchangeRateStrip } from '../ExchangeRateStrip';
import { ForeignPaymentSheet } from '../ForeignPaymentSheet';
import { MoneyText } from '../MoneyText';
import { CountryFlag } from '../flags/CountryFlag';
import { FullScreenSheet } from '../FullScreenSheet';
import {
  ActionButton,
  ActionRow,
  Badge,
  LockedNotice,
  ProgressRing,
  SectionGroup,
  SegmentedControl,
} from '../Primitives';
import { AbroadDashboard } from './AbroadDashboard';
import { CountryCompareModal } from './CountryCompareModal';
import { CountryDetailView } from './CountryDetailView';
import {
  IconPlane,
  IconSparkles,
  IconStar,
  IconWarning,
} from '../../icons';

type HubMode = 'abroad' | 'travel' | 'migration';
type TripTier = 'budget' | 'standard' | 'comfort';

interface EmigrationTravelHubProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSave: (nextSave: SaveGame) => void;
  onDeepLink?: (tab: 'work' | 'assets' | 'activities', subTarget?: string) => void;
}

export function EmigrationTravelHub({
  open,
  saveGame,
  onClose,
  onUpdateSave,
  onSilentSave,
  onDeepLink,
}: EmigrationTravelHubProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const isAbroad = state.player.countryId !== 'iran';
  const emig = ensureEmigrationState(state);

  const [mode, setMode] = useState<HubMode>(isAbroad ? 'abroad' : 'migration');
  const [tripCountryId, setTripCountryId] = useState<string>('turkey');
  const [tripTier, setTripTier] = useState<TripTier>('standard');
  const [selectedDetailCountryId, setSelectedDetailCountryId] = useState<string | null>(null);
  const [focusBreakdownSection, setFocusBreakdownSection] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [tripPayOpen, setTripPayOpen] = useState(false);
  const [tripLock, setTripLock] = useState<{
    currency: CurrencyCode;
    rateIrt: number;
    year: number;
  } | null>(null);

  const hubSummary = useMemo(
    () => getEmigrationHubSummary(state, gameDataset),
    [state],
  );

  const destinationCountries = useMemo(
    () => gameDataset.countriesMacro.filter((c) => !c.isTemplate),
    [],
  );

  const effectiveMode: HubMode = !isAbroad && mode === 'abroad' ? 'migration' : mode;
  const tripQuote = useMemo(
    () => getShortTripQuote(tripCountryId, tripTier, state, gameDataset),
    [tripCountryId, tripTier, state],
  );

  useEffect(() => {
    if (!open || !tripQuote) return;
    setTripLock((prev) => {
      if (prev && prev.currency === tripQuote.currencyCode && prev.year === state.currentJalaliYear) {
        return prev;
      }
      if (!prev || prev.currency !== tripQuote.currencyCode) {
        return {
          currency: tripQuote.currencyCode,
          rateIrt: getFxRate(state, tripQuote.currencyCode, 'IRT', gameDataset),
          year: state.currentJalaliYear,
        };
      }
      return prev;
    });
  }, [open, tripQuote?.currencyCode, state.currentJalaliYear, state]);

  const topRecommendedId = hubSummary.ranked[0]?.countryId;
  const shortlistedIds = emig.shortlistedCountryIds;

  const openCountryDetail = (countryId: string, focusBreakdown = false) => {
    setFocusBreakdownSection(focusBreakdown);
    setSelectedDetailCountryId(countryId);
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('emigrationHub.title')}
      subtitle="سفر کوتاه‌مدت، ارزیابی مسیر اقامت و مدیریت زندگی در خارج"
      stickySubHeader={
        <SegmentedControl<HubMode>
          value={effectiveMode}
          onChange={setMode}
          items={
            isAbroad
              ? [
                  { value: 'abroad', label: t('emigrationHub.abroadCenterTitle') },
                  { value: 'travel', label: t('emigrationHub.travelTab') },
                  { value: 'migration', label: t('emigrationHub.migrationTab') },
                ]
              : [
                  { value: 'travel', label: t('emigrationHub.travelTab') },
                  { value: 'migration', label: t('emigrationHub.migrationTab') },
                ]
          }
        />
      }
    >
      <div className="space-y-4">
        {!isAbroad && emig.residency.forcedReturnNoticeFa && (
          <section className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--warning)]/45 bg-[var(--warning)]/10 p-3 text-xs">
            <div className="flex items-start gap-2">
              <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <div className="leading-relaxed text-[var(--text)]">
                {emig.residency.forcedReturnNoticeFa}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSilentSave(dismissArrivalWelcomeAction(saveGame))}
              className="shrink-0 rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]"
            >
              بستن
            </button>
          </section>
        )}

        {effectiveMode === 'abroad' && isAbroad && (
          <AbroadDashboard
            saveGame={saveGame}
            onUpdateSave={onUpdateSave}
            onSilentSave={onSilentSave}
            onDeepLink={onDeepLink}
          />
        )}

        {effectiveMode === 'travel' && (
          <>
            {state.player.age < 16 ? (
              <LockedNotice message="سفر مستقل خارجی از ۱۶ سالگی به بعد فعال می‌شود." />
            ) : (
              <>
                <ExchangeRateStrip
                  state={state}
                  highlightCurrency={tripQuote?.currencyCode}
                />

                <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[var(--text)]">انتخاب مقصد سفر کوتاه</h3>
                    <span className="text-xs text-[var(--text-muted)]">یک بار در سال</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {destinationCountries.slice(0, 5).map((country) => {
                      const active = country.id === tripCountryId;
                      return (
                        <button
                          key={country.id}
                          type="button"
                          onClick={() => setTripCountryId(country.id)}
                          className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition-colors ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)] font-bold'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          <CountryFlag countryId={country.id} size="sm" />
                          <span className="text-xs leading-tight">{country.nameFa}</span>
                        </button>
                      );
                    })}
                  </div>

                  <SegmentedControl<TripTier>
                    value={tripTier}
                    onChange={setTripTier}
                    items={[
                      { value: 'budget', label: 'اقتصادی' },
                      { value: 'standard', label: 'استاندارد' },
                      { value: 'comfort', label: 'راحت' },
                    ]}
                  />
                </section>

                {tripQuote && (
                  <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CountryFlag countryId={tripQuote.countryId} size="sm" />
                        <div>
                          <div className="text-sm font-bold text-[var(--text)]">
                            سفر {toPersianDigits(tripQuote.durationDays)} روزه به {tripQuote.countryNameFa}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {tripQuote.visaLabelFa} · شانس تأیید: {toPersianDigits(tripQuote.visaApprovalPct)}٪
                          </div>
                        </div>
                      </div>
                      <Badge tone="primary">{tripQuote.tierLabelFa}</Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-3 sm:grid-cols-2">
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">هزینه کل سفر و معادل</div>
                        <div className="mt-1">
                          <MoneyText
                            amount={tripQuote.totalLocal}
                            currency={tripQuote.currencyCode}
                            mode="stacked"
                            stateOverride={state}
                          />
                        </div>
                      </div>
                      <div className="text-right sm:text-left">
                        <div className="text-xs text-[var(--text-muted)]">اثر روحیه و نشاط</div>
                        <div className="mt-1 text-xs font-bold tabular-nums text-[var(--success)]">
                          +{toPersianDigits(tripQuote.happinessBoost)} شادی · +{toPersianDigits(tripQuote.mentalBoost)} روان
                        </div>
                      </div>
                    </div>

                    <AffordabilityBadge
                      amount={tripQuote.totalLocal}
                      currency={tripQuote.currencyCode}
                      state={state}
                      hasCheaperTier={tripTier !== 'budget'}
                      onSelectCheaperTier={() => setTripTier('budget')}
                    />

                    <ActionButton
                      icon={<IconPlane className="h-4 w-4" />}
                      label={`انجام سفر به ${tripQuote.countryNameFa}`}
                      costText={
                        <MoneyText
                          amount={tripQuote.totalLocal}
                          currency={tripQuote.currencyCode}
                          mode="inline"
                          stateOverride={state}
                          interactive={false}
                        />
                      }
                      disabled={state.flags['cd_foreign_trip'] === state.turn}
                      disabledReason={
                        state.flags['cd_foreign_trip'] === state.turn
                          ? 'امسال سفر خارجی انجام داده‌ای'
                          : undefined
                      }
                      onClick={() => setTripPayOpen(true)}
                    />
                  </section>
                )}

                {emig.travelHistory.length > 0 && (
                  <SectionGroup title="سفرنامه‌های اخیر">
                    {emig.travelHistory
                      .slice(-5)
                      .reverse()
                      .map((item) => (
                        <ActionRow
                          key={item.id}
                          icon={<CountryFlag countryId={item.countryId} size="xs" />}
                          title={`${item.countryNameFa} · سال ${toPersianDigits(item.jalaliYear)}`}
                          subtitle={item.memoryFa}
                          value={item.totalCostDisplayFa}
                        />
                      ))}
                  </SectionGroup>
                )}
              </>
            )}
          </>
        )}

        {effectiveMode === 'migration' && (
          <>
            <ExchangeRateStrip state={state} compact />

            <section className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                  <IconSparkles className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
                  <span>رتبه‌بندی هوشمند بر پایه اولویت‌های تو</span>
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  برای دیدن جزئیات پرونده روی کارت یا حلقه سختی بزن و تا ۳ کشور را مقایسه کن
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="min-h-[40px] shrink-0 rounded-xl border border-[var(--primary)]/45 bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
              >
                {t('emigrationHub.compareButton')} ({toPersianDigits(Math.max(shortlistedIds.length, 3))})
              </button>
            </section>

            <section className="space-y-2.5" data-testid="emigration-country-list">
              <div className="px-1">
                <h3 className="text-xs font-bold text-[var(--text-muted)]">کشورهای مقصد مهاجرت</h3>
                <p className="text-xs text-[var(--text-muted)] opacity-85">
                  درآمد برآوردی ماهانه، سطح هزینه زندگی، گشودگی و سختی پذیرش
                </p>
              </div>

              <div className="space-y-2.5">
                {hubSummary.ranked.slice(0, 6).map((item) => {
                  const app = emig.activeApplications[item.countryId];
                  const isRes = state.player.countryId === item.countryId;
                  const statusFa = getCountryApplicationDisplayStatusFa(
                    app?.status ?? 'unexplored',
                    isRes,
                  );
                  const isStarred = shortlistedIds.includes(item.countryId);
                  const isTopMatch = item.countryId === topRecommendedId;
                  const diffScore = item.difficulty.totalDifficulty;
                  const diffToneVar =
                    diffScore <= 42
                      ? '--success'
                      : diffScore <= 68
                        ? '--warning'
                        : '--danger';

                  return (
                    <article
                      key={item.countryId}
                      data-testid={`country-card-${item.countryId}`}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-colors hover:border-[var(--primary)]/60"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => openCountryDetail(item.countryId, false)}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-right"
                        >
                          <CountryFlag countryId={item.countryId} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold text-[var(--text)]">
                                {item.nameFa}
                              </span>
                              <Badge tone="neutral">{item.currencyNameFa}</Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {isTopMatch && (
                                <Badge tone="primary">{t('emigrationHub.recommendedForYou')}</Badge>
                              )}
                              <Badge
                                tone={
                                  isRes || app?.status === 'approved'
                                    ? 'success'
                                    : app?.status === 'in_progress'
                                      ? 'warning'
                                      : 'neutral'
                                }
                              >
                                {statusFa}
                              </Badge>
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCountryDetail(item.countryId, true)}
                            aria-label={`تجزیه سختی ${item.nameFa}: ${toPersianDigits(diffScore)} درصد`}
                            className="flex flex-col items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 transition-colors hover:border-[var(--primary)]"
                          >
                            <ProgressRing
                              value={diffScore}
                              size={38}
                              strokeWidth={4}
                              colorVar={diffToneVar}
                              label={`${toPersianDigits(diffScore)}٪`}
                            />
                            <span className="text-xs font-medium text-[var(--text-muted)]">سختی</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSilentSave(toggleShortlistCountryAction(saveGame, item.countryId))}
                            aria-label={`افزودن ${item.nameFa} به مقایسه`}
                            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
                              isStarred
                                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                            }`}
                          >
                            <IconStar className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Key Figures Strip with Dual Currency Display */}
                      <button
                        type="button"
                        onClick={() => openCountryDetail(item.countryId, false)}
                        className="mt-3 grid w-full grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-right transition-colors hover:bg-[var(--primary-soft)]/35 sm:grid-cols-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-[var(--text-muted)]">درآمد ماهانه</div>
                          <div className="mt-0.5">
                            <MoneyText
                              amount={item.monthlyNetMedianLocal}
                              currency={item.currencyCode}
                              mode="stacked"
                              stateOverride={state}
                              interactive={false}
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs text-[var(--text-muted)]">
                            هزینه زندگی ({item.costLevelLabelFa})
                          </div>
                          <div className="mt-0.5">
                            <MoneyText
                              amount={item.monthlyBudgetLocal}
                              currency={item.currencyCode}
                              mode="stacked"
                              stateOverride={state}
                              interactive={false}
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs text-[var(--text-muted)]">گشودگی</div>
                          <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--primary-strong)]">
                            {toPersianDigits(item.opennessScore)}٪
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            شانس {toPersianDigits(item.difficulty.approvalChancePct)}٪
                          </div>
                        </div>
                      </button>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                        <span>{item.highlightFa}</span>
                        <button
                          type="button"
                          onClick={() => openCountryDetail(item.countryId, false)}
                          className="shrink-0 font-bold text-[var(--primary-strong)]"
                        >
                          بررسی پرونده ←
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {tripQuote && (
        <ForeignPaymentSheet
          open={tripPayOpen}
          onClose={() => setTripPayOpen(false)}
          title={`پرداخت هزینه سفر به ${tripQuote.countryNameFa}`}
          subtitle={`${tripQuote.tierLabelFa} · ${toPersianDigits(tripQuote.durationDays)} روز اقامت`}
          amount={tripQuote.totalLocal}
          currency={tripQuote.currencyCode}
          state={state}
          confirmLabel="تأیید و رزرو سفر"
          lockedRateToIrt={
            tripLock && tripLock.currency === tripQuote.currencyCode
              ? tripLock.rateIrt
              : undefined
          }
          lockedYear={
            tripLock && tripLock.currency === tripQuote.currencyCode
              ? tripLock.year
              : undefined
          }
          hasCheaperTier={tripTier !== 'budget'}
          onSelectCheaperTier={() => setTripTier('budget')}
          onConfirm={({ payFromCurrency }) => {
            onUpdateSave(
              takeShortForeignTripAction(saveGame, tripCountryId, tripTier, gameDataset, {
                payFromCurrency,
              }),
            );
            setTripPayOpen(false);
          }}
        />
      )}

      <CountryDetailView
        open={selectedDetailCountryId !== null}
        countryId={selectedDetailCountryId}
        initialFocusBreakdown={focusBreakdownSection}
        saveGame={saveGame}
        onClose={() => {
          setSelectedDetailCountryId(null);
          setFocusBreakdownSection(false);
        }}
        onUpdateSave={onUpdateSave}
        onSilentSave={onSilentSave}
        onDeepLink={onDeepLink}
      />

      <CountryCompareModal
        open={compareOpen}
        countryIds={
          shortlistedIds.length > 0
            ? shortlistedIds
            : hubSummary.ranked.slice(0, 3).map((r) => r.countryId)
        }
        state={state}
        onClose={() => setCompareOpen(false)}
        onSelectCountry={(cId) => openCountryDetail(cId, false)}
      />
    </FullScreenSheet>
  );
}
