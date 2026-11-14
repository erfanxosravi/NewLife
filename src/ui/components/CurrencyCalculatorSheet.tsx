import { useEffect, useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { ALL_CURRENCY_CODES, getCurrencyDef, quoteConversion } from '../../engine/fx';
import { toPersianDigits } from '../../engine/jalali';
import { getWalletBalance } from '../../engine/ledger';
import { normalizePersianNumberInput } from '../../engine/money';
import type { CurrencyCode, GameState } from '../../engine/types';
import { BottomSheet } from './BottomSheet';
import { MoneyText, RatePairLabel } from './MoneyText';
import { IconSwap } from '../icons';

export function CurrencyCalculatorSheet({
  open,
  onClose,
  state,
  initialFrom = 'EUR',
  initialTo = 'IRT',
  initialAmount = 100,
  onConvertWallet,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState;
  initialFrom?: CurrencyCode;
  initialTo?: CurrencyCode;
  initialAmount?: number;
  onConvertWallet?: (from: CurrencyCode, to: CurrencyCode, amount: number) => void;
}) {
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>(initialFrom);
  const [toCurrency, setToCurrency] = useState<CurrencyCode>(
    initialTo === initialFrom ? (initialFrom === 'IRT' ? 'EUR' : 'IRT') : initialTo,
  );
  const [amountInput, setAmountInput] = useState<string>(String(initialAmount));

  useEffect(() => {
    if (!open) return;
    setFromCurrency(initialFrom);
    setToCurrency(initialTo === initialFrom ? (initialFrom === 'IRT' ? 'EUR' : 'IRT') : initialTo);
    setAmountInput(String(initialAmount > 0 ? initialAmount : 100));
  }, [open, initialFrom, initialTo, initialAmount]);

  const parsedAmount = useMemo(() => normalizePersianNumberInput(amountInput), [amountInput]);
  const quote = useMemo(
    () =>
      quoteConversion({
        amount: parsedAmount,
        from: fromCurrency,
        to: toCurrency,
        state,
        dataset: gameDataset,
      }),
    [parsedAmount, fromCurrency, toCurrency, state],
  );

  const fromBalance = getWalletBalance(state, fromCurrency);
  const fromDef = getCurrencyDef(fromCurrency, gameDataset);
  const canExecute = parsedAmount > 0 && fromCurrency !== toCurrency && fromBalance + 1e-6 >= parsedAmount;
  const presets = fromCurrency === 'IRT' ? [10_000_000, 50_000_000, 150_000_000] : [100, 500, 1000];

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="ماشین‌حساب ارز و نرخ تبدیل"
      subtitle={`نرخ متقاطع بر مبنای سال ${toPersianDigits(state.currentJalaliYear)}`}
      snap="full"
      zIndexClass="z-[62]"
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-[var(--text)]" htmlFor="calc-amount-input">
              مبلغ مبدأ ({fromDef.nameFa})
            </label>
            <span className="text-xs font-medium text-[var(--text-muted)]">
              موجودی کیف:{' '}
              <MoneyText
                amount={fromBalance}
                currency={fromCurrency}
                mode="single"
                compact
                interactive={false}
              />
            </span>
          </div>

          <input
            id="calc-amount-input"
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="۱۰۰"
            className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[15px] font-bold tabular-nums text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />

          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountInput(String(preset))}
                className="min-h-[34px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
              >
                <MoneyText
                  amount={preset}
                  currency={fromCurrency}
                  mode="single"
                  compact
                  interactive={false}
                />
              </button>
            ))}
            {fromBalance > 0 && (
              <button
                type="button"
                onClick={() => setAmountInput(String(fromBalance))}
                className="min-h-[34px] rounded-xl border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--primary-strong)]"
              >
                کل کیف پول
              </button>
            )}
          </div>
        </div>

        {/* Currency Selectors */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <div className="mb-1 text-xs font-bold text-[var(--text-muted)]">از ارز</div>
            <select
              aria-label="ارز مبدأ"
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
              className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {ALL_CURRENCY_CODES.map((c) => {
                const d = getCurrencyDef(c, gameDataset);
                return (
                  <option key={c} value={c}>
                    {d.nameFa}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            aria-label="جابجایی ارز مبدأ و مقصد"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary-strong)] transition-colors hover:border-[var(--primary)]"
          >
            <IconSwap className="h-4 w-4" />
          </button>

          <div>
            <div className="mb-1 text-xs font-bold text-[var(--text-muted)]">به ارز</div>
            <select
              aria-label="ارز مقصد"
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
              className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {ALL_CURRENCY_CODES.map((c) => {
                const d = getCurrencyDef(c, gameDataset);
                return (
                  <option key={c} value={c}>
                    {d.nameFa}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Conversion Result Card */}
        <div className="rounded-2xl border border-[var(--primary)]/35 bg-[var(--primary-soft)]/35 p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)]">مبلغ خالص دریافتی</div>
              <div className="mt-1">
                <MoneyText
                  amount={quote.netToAmount}
                  currency={toCurrency}
                  mode="stacked"
                  stateOverride={state}
                  interactive={false}
                />
              </div>
            </div>
            <div className="text-left text-xs text-[var(--text-muted)]">
              <div>نرخ میانی</div>
              <div className="mt-0.5 font-bold text-[var(--text)]">
                {quote.midRate >= 1 ? (
                  <RatePairLabel
                    fromCurrency={fromCurrency}
                    toCurrency={toCurrency}
                    rate={quote.midRate}
                  />
                ) : (
                  <RatePairLabel
                    fromCurrency={toCurrency}
                    toCurrency={fromCurrency}
                    rate={1 / Math.max(1e-9, quote.midRate)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2 text-xs">
            <div>
              <div className="text-[var(--text-muted)]">اختلاف خرید/فروش</div>
              <div className="font-bold tabular-nums text-[var(--text)]">
                {toPersianDigits(quote.spreadPct)}٪
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">کارمزد صرافی</div>
              <div className="font-bold text-[var(--text)]">
                <MoneyText
                  amount={quote.feeInFromCurrency}
                  currency={fromCurrency}
                  mode="single"
                  compact
                  interactive={false}
                />
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">افت کل معامله</div>
              <div className="font-bold tabular-nums text-[var(--text)]">
                {toPersianDigits(quote.totalFrictionPct)}٪
              </div>
            </div>
          </div>
        </div>

        {onConvertWallet && (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={!canExecute}
              onClick={() => {
                if (!canExecute) return;
                onConvertWallet(fromCurrency, toCurrency, parsedAmount);
                onClose();
              }}
              className="min-h-[46px] w-full rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)]"
            >
              {fromCurrency === toCurrency ? (
                'ارز مبدأ و مقصد باید متفاوت باشند'
              ) : !canExecute ? (
                `موجودی کیف ${fromDef.shortNameFa} کافی نیست`
              ) : (
                <>
                  تبدیل در کیف پول (
                  <MoneyText
                    amount={parsedAmount}
                    currency={fromCurrency}
                    mode="single"
                    compact
                    interactive={false}
                  />
                  )
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
