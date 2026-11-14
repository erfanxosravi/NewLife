import { useMemo } from 'react';
import { toPersianDigits } from '../../engine/jalali';
import type { CurrencyCode, GameState } from '../../engine/types';
import { BottomSheet } from './BottomSheet';
import {
  ForeignShareText,
  getMoneyDualDetails,
  MoneyText,
  RatePairLabel,
} from './MoneyText';

export function ForeignAmountPopoverSheet({
  open,
  onClose,
  amount,
  currency,
  state,
  onOpenCalculator,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: CurrencyCode;
  state: GameState;
  onOpenCalculator: () => void;
}) {
  const dual = useMemo(
    () => getMoneyDualDetails(amount, currency, state),
    [amount, currency, state],
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`جزئیات نرخ ${dual.currencyNameFa}`}
      subtitle={`نرخ متقاطع بازار در سال ${toPersianDigits(dual.quoteYear)}`}
      snap="half"
      zIndexClass="z-[63]"
    >
      <div className="space-y-3" data-testid="foreign-amount-popover">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[var(--text-muted)]">مبلغ و معادل</div>
            <div className="mt-1">
              <MoneyText
                amount={amount}
                currency={currency}
                mode="stacked"
                stateOverride={state}
                interactive={false}
              />
            </div>
          </div>
          <div className="rounded-xl bg-[var(--primary-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--primary-strong)]">
            <ForeignShareText pct={dual.shareOfNetWorthPct} />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">نرخ مرجع به تومان</span>
            <span className="font-bold text-[var(--text)]">
              <RatePairLabel fromCurrency={currency} toCurrency="IRT" rate={dual.midRateToIrt} />
            </span>
          </div>

          {dual.equivalentCurrencyCode && dual.amountConversionQuote && (
            <>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text-muted)]">طرف خرید / فروش و اختلاف</span>
                <span className="font-bold tabular-nums text-[var(--text)]">
                  اسپرد {toPersianDigits(dual.amountConversionQuote.spreadPct)}٪ · کارمزد{' '}
                  <MoneyText
                    amount={dual.amountConversionQuote.feeInFromCurrency}
                    currency={currency}
                    mode="single"
                    compact
                    interactive={false}
                  />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text-muted)]">خالص دریافتی پس از کارمزد تبدیل</span>
                <span className="font-bold text-[var(--text)]">
                  <MoneyText
                    amount={dual.amountConversionQuote.netToAmount}
                    currency={dual.equivalentCurrencyCode}
                    mode="single"
                    compact
                    interactive={false}
                  />
                </span>
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
            <span className="text-[var(--text-muted)]">معادل تومانی دقیق</span>
            <span className="font-bold text-[var(--text)]">
              <MoneyText
                amount={dual.tomanAmount}
                currency="IRT"
                mode="single"
                interactive={false}
              />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenCalculator();
          }}
          className="min-h-[44px] w-full rounded-2xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)]"
        >
          باز کردن ماشین‌حساب ارز
        </button>
      </div>
    </BottomSheet>
  );
}
