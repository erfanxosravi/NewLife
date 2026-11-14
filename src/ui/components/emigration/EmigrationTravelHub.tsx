import { useMemo, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import {
  ensureEmigrationState,
  getCountryApplicationDisplayStatusFa,
  getShortTripQuote,
} from '../../../engine/emigration';
import { formatCurrencyAmount } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import type { SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  dismissArrivalWelcomeAction,
  takeShortForeignTripAction,
  toggleShortlistCountryAction,
  type ActionOutcome,
} from '../../../state/actions';
import { getEmigrationHubSummary } from '../../../state/selectors';
import { CountryFlag } from '../flags/CountryFlag';
import { FullScreenSheet } from '../FullScreenSheet';
import {
  ActionButton,
  ActionRow,
  Badge,
  LockedNotice,
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
  const [compareOpen, setCompareOpen] = useState(false);

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

  const topRecommendedId = hubSummary.ranked[0]?.countryId;
  const shortlistedIds = emig.shortlistedCountryIds;

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
              className="shrink-0 rounded-lg bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--text)]"
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
                <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[var(--text)]">انتخاب مقصد سفر کوتاه</h3>
                    <span className="text-[11px] text-[var(--text-muted)]">یک بار در سال</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {destinationCountries.slice(0, 5).map((country) => {
                      const active = country.id === tripCountryId;
                      return (
                        <button
                          key={country.id}
                          type="button"
                          onClick={() => setTripCountryId(country.id)}
                          className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl border p-1.5 text-center transition-colors ${
                            active
                              ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)] font-bold'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          <CountryFlag countryId={country.id} size="sm" />
                          <span className="max-w-full truncate text-[10px]">{country.nameFa}</span>
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
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {tripQuote.visaLabelFa} · شانس تأیید: {toPersianDigits(tripQuote.visaApprovalPct)}٪
                          </div>
                        </div>
                      </div>
                      <Badge tone="primary">{tripQuote.tierLabelFa}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-center text-xs">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">جمع هزینه ارزی</div>
                        <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                          <bdi dir="rtl">
                            {formatCurrencyAmount(tripQuote.totalLocal, tripQuote.currencyCode, gameDataset)}
                          </bdi>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">معادل تومانی</div>
                        <div className="mt-0.5 font-bold tabular-nums text-[var(--text)]">
                          <bdi dir="rtl">
                            {formatCurrencyAmount(tripQuote.totalToman, 'IRT', gameDataset, { compact: true })}
                          </bdi>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">اثر روحیه و نشاط</div>
                        <div className="mt-0.5 font-bold tabular-nums text-[var(--success)]">
                          +{toPersianDigits(tripQuote.happinessBoost)} شادی · +{toPersianDigits(tripQuote.mentalBoost)} روان
                        </div>
                      </div>
                    </div>

                    <ActionButton
                      icon={<IconPlane className="h-4 w-4" />}
                      label={`انجام سفر به ${tripQuote.countryNameFa}`}
                      costText={formatCurrencyAmount(tripQuote.totalLocal, tripQuote.currencyCode, gameDataset)}
                      disabled={state.flags['cd_foreign_trip'] === state.turn}
                      disabledReason={
                        state.flags['cd_foreign_trip'] === state.turn
                          ? 'امسال سفر خارجی انجام داده‌ای'
                          : undefined
                      }
                      onClick={() =>
                        onUpdateSave(
                          takeShortForeignTripAction(saveGame, tripCountryId, tripTier, gameDataset),
                        )
                      }
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
            <section className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                  <IconSparkles className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
                  <span>رتبه‌بندی هوشمند بر پایه اولویت‌های تو</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  برای بررسی جزئیات یا نشان کردن تا ۳ کشور جهت مقایسه روی کارت بزن
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="min-h-[38px] shrink-0 rounded-xl border border-[var(--primary)]/45 bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
              >
                {t('emigrationHub.compareButton')} ({toPersianDigits(Math.max(shortlistedIds.length, 3))})
              </button>
            </section>

            <SectionGroup
              title="کشورهای مقصد مهاجرت"
              subtitle="مقایسه میانگین درآمد خالص، هزینه زندگی و سختی پذیرش"
            >
              {hubSummary.ranked.slice(0, 6).map((item) => {
                const app = emig.activeApplications[item.countryId];
                const isRes = state.player.countryId === item.countryId;
                const statusFa = getCountryApplicationDisplayStatusFa(
                  app?.status ?? 'unexplored',
                  isRes,
                );
                const isStarred = shortlistedIds.includes(item.countryId);
                const isTopMatch = item.countryId === topRecommendedId;
                const surplusLabel =
                  item.monthlySurplusLocal >= 0
                    ? `+${formatCurrencyAmount(item.monthlySurplusLocal, item.currencyCode, gameDataset)}`
                    : formatCurrencyAmount(item.monthlySurplusLocal, item.currencyCode, gameDataset);

                return (
                  <div
                    key={item.countryId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDetailCountryId(item.countryId)}
                      className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-right transition-opacity hover:opacity-85"
                    >
                      <CountryFlag countryId={item.countryId} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-[var(--text)]">
                            {item.nameFa}
                          </span>
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
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                          سختی: {toPersianDigits(item.difficulty.totalDifficulty)}٪ · تراز ماهانه:{' '}
                          <bdi dir="rtl" className="font-bold text-[var(--text)]">
                            {surplusLabel}
                          </bdi>{' '}
                          · {item.highlightFa}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSilentSave(toggleShortlistCountryAction(saveGame, item.countryId))}
                      aria-label={`افزودن ${item.nameFa} به مقایسه`}
                      className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isStarred
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }`}
                    >
                      <IconStar className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </SectionGroup>
          </>
        )}
      </div>

      <CountryDetailView
        open={selectedDetailCountryId !== null}
        countryId={selectedDetailCountryId}
        saveGame={saveGame}
        onClose={() => setSelectedDetailCountryId(null)}
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
        onSelectCountry={(cId) => setSelectedDetailCountryId(cId)}
      />
    </FullScreenSheet>
  );
}
