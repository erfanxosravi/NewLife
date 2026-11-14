import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { gameDataset } from '../data/registry';
import { getCountryMacroDef } from '../engine/countries';
import { getCurrencyDef } from '../engine/fx';
import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import type { DisplayCurrencyMode, GameState } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getHeaderMoneySummary } from '../state/selectors';
import { BottomSheet } from './components/BottomSheet';
import { useMoneyContext } from './components/MoneyContext';
import { MoneyText } from './components/MoneyText';
import { SectionGroup, SegmentedControl } from './components/Primitives';
import { CountryFlag } from './components/flags/CountryFlag';
import { IconAssets, IconCash, IconMenu } from './icons';

interface HeaderBarProps {
  fullName: string;
  age: number;
  jalaliYear: number;
  moneyToman: number;
  state?: GameState;
  moneyDelta?: { amount: number; key: number } | null;
  reducedMotion?: boolean;
  onChangeDisplayCurrency?: (mode: DisplayCurrencyMode) => void;
  onOpenAssets: () => void;
  onOpenMenu: () => void;
}

export function HeaderBar({
  fullName,
  age,
  jalaliYear,
  moneyToman,
  state,
  moneyDelta = null,
  reducedMotion = false,
  onChangeDisplayCurrency,
  onOpenAssets,
  onOpenMenu,
}: HeaderBarProps) {
  const { t } = useI18n();
  const moneyCtx = useMoneyContext();
  const [visibleDelta, setVisibleDelta] = useState<{ amount: number; key: number } | null>(null);
  const [moneySheetOpen, setMoneySheetOpen] = useState(false);

  const moneySummary = useMemo(
    () => (state ? getHeaderMoneySummary(state, gameDataset) : null),
    [state],
  );

  const residenceCountry = useMemo(
    () => (state ? getCountryMacroDef(state.player.countryId, gameDataset) : null),
    [state],
  );

  useEffect(() => {
    if (!moneyDelta || moneyDelta.amount === 0) {
      setVisibleDelta(null);
      return;
    }
    setVisibleDelta(moneyDelta);
    const timer = window.setTimeout(() => {
      setVisibleDelta((cur) => (cur?.key === moneyDelta.key ? null : cur));
    }, 1550);
    return () => window.clearTimeout(timer);
  }, [moneyDelta]);

  const handleChipClick = () => {
    if (state && onChangeDisplayCurrency) {
      setMoneySheetOpen(true);
    } else {
      onOpenAssets();
    }
  };

  return (
    <>
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-bold leading-snug text-[var(--text)]">
              {fullName}
            </h1>
            {state && state.player.countryId !== 'iran' && (
              <CountryFlag
                countryId={state.player.countryId}
                labelFa={residenceCountry?.nameFa}
                size="xs"
              />
            )}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={handleChipClick}
                aria-label="مشاهده دارایی‌ها و نقدینگی"
                className="inline-flex min-h-[32px] max-w-full items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold text-[var(--primary-strong)] tabular-nums transition-colors hover:border-[var(--primary)]"
              >
                <IconCash className="h-3.5 w-3.5 shrink-0" />
                {moneySummary ? (
                  <MoneyText
                    amount={moneySummary.cashDisplayAmount}
                    currency={moneySummary.displayCurrency}
                    mode="single"
                    compact
                    interactive={false}
                  />
                ) : (
                  <MoneyText
                    amount={moneyToman}
                    currency="IRT"
                    mode="single"
                    compact
                    interactive={false}
                  />
                )}
              </button>

              <AnimatePresence>
                {visibleDelta && (
                  <motion.span
                    key={visibleDelta.key}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.92 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 14, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: reducedMotion ? 0.16 : 0.28 }}
                    className={`pointer-events-none absolute top-full right-0 z-30 mt-1 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-bold tabular-nums shadow-sm ${
                      visibleDelta.amount > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                    }`}
                  >
                    <MoneyText
                      amount={visibleDelta.amount}
                      currency="IRT"
                      mode="single"
                      showSign
                      compact
                      interactive={false}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium tabular-nums text-[var(--text-muted)]">
            <bdi dir="rtl">
              {formatAgeLabel(age)} | {toPersianDigits(jalaliYear)}
            </bdi>
            {state && state.player.countryId !== 'iran' && residenceCountry && (
              <span>· {residenceCountry.nameFa}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="منو و تنظیمات"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          <IconMenu className="h-5 w-5" />
        </button>
      </header>

      {state && moneySummary && onChangeDisplayCurrency && (
        <BottomSheet
          open={moneySheetOpen}
          onClose={() => setMoneySheetOpen(false)}
          title="کیف‌پول و ارز نمایش"
          subtitle={residenceCountry ? `اقامتگاه فعلی: ${residenceCountry.nameFa}` : 'خلاصه ارزش دارایی'}
        >
          <div className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 text-right">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                دارایی خالص ({t(`currencySwitch.${state.displayCurrencyMode ?? 'local'}`)})
              </div>
              <div className="mt-1">
                <MoneyText
                  amount={moneySummary.netWorth.displayAmount}
                  currency={moneySummary.netWorth.displayCurrency}
                  mode="stacked"
                  stateOverride={state}
                  primaryClassName="text-lg font-bold text-[var(--text)]"
                />
              </div>
              <div className="mt-2 inline-block rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
                {moneySummary.netWorth.purchasingPowerHintFa}
              </div>
            </section>

            <section className="space-y-1.5">
              <div className="px-1 text-xs font-bold text-[var(--text-muted)]">
                {t('currencySwitch.label')}
              </div>
              <SegmentedControl<DisplayCurrencyMode>
                value={state.displayCurrencyMode ?? 'local'}
                onChange={onChangeDisplayCurrency}
                items={[
                  { value: 'local', label: t('currencySwitch.local') },
                  { value: 'IRT', label: t('currencySwitch.toman') },
                  { value: 'USD', label: t('currencySwitch.usd') },
                ]}
              />
            </section>

            {state.ledger && state.ledger.wallets.length > 0 && (
              <SectionGroup title="حساب‌ها و کیف‌پول‌ها">
                {state.ledger.wallets.slice(0, 6).map((w) => {
                  const def = getCurrencyDef(w.currencyCode, gameDataset);
                  return (
                    <div
                      key={w.id}
                      className="flex min-h-[48px] items-center justify-between gap-2 px-3.5 py-2 text-xs"
                    >
                      <div className="min-w-0 text-right">
                        <div className="font-bold text-[var(--text)]">{w.labelFa}</div>
                        <div className="text-xs text-[var(--text-muted)]">{def.nameFa}</div>
                      </div>
                      <div className="shrink-0 text-left">
                        <MoneyText
                          amount={w.balance}
                          currency={w.currencyCode}
                          mode="stacked"
                          stateOverride={state}
                        />
                      </div>
                    </div>
                  );
                })}
              </SectionGroup>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {moneyCtx.onOpenCalculator && (
                <button
                  type="button"
                  data-testid="header-open-calculator-btn"
                  onClick={() => {
                    setMoneySheetOpen(false);
                    moneyCtx.onOpenCalculator?.({ fromCurrency: 'EUR', toCurrency: 'IRT' });
                  }}
                  className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--primary)] bg-[var(--primary-soft)] px-4 text-xs font-bold text-[var(--primary-strong)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)]"
                >
                  <span>ماشین‌حساب ارز</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMoneySheetOpen(false);
                  onOpenAssets();
                }}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)]"
              >
                <IconAssets className="h-4 w-4" />
                <span>مدیریت دارایی‌ها و تبدیل</span>
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
