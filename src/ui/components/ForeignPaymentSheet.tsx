import { useEffect, useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { ALL_CURRENCY_CODES, getCurrencyDef } from '../../engine/fx';
import { toPersianDigits } from '../../engine/jalali';
import { getWalletBalance, quotePayFromWallet } from '../../engine/ledger';
import {
  checkLockedRateDrift,
  getAffordabilityState,
  type AffordabilityFixKind,
} from '../../engine/money';
import type { CurrencyCode, GameState, TransferChannelDef } from '../../engine/types';
import { AffordabilityBadge } from './AffordabilityBadge';
import { BottomSheet } from './BottomSheet';
import { ExchangeRateStrip } from './ExchangeRateStrip';
import { MoneyText, RatePairLabel } from './MoneyText';

export interface ForeignPaymentConfirmPayload {
  payFromCurrency: CurrencyCode;
  channelId?: TransferChannelDef['id'];
}

export function ForeignPaymentSheet({
  open,
  onClose,
  title,
  subtitle,
  amount,
  currency,
  state,
  confirmLabel = 'تأیید و پرداخت',
  lockedRateToIrt,
  lockedYear,
  hasCheaperTier = false,
  onSelectCheaperTier,
  onFix,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amount: number;
  currency: CurrencyCode;
  state: GameState;
  confirmLabel?: string;
  lockedRateToIrt?: number;
  lockedYear?: number;
  hasCheaperTier?: boolean;
  onSelectCheaperTier?: () => void;
  onFix?: (fix: AffordabilityFixKind) => void;
  onConfirm: (payload: ForeignPaymentConfirmPayload) => void;
}) {
  const affordability = useMemo(
    () =>
      getAffordabilityState({
        amount,
        currency,
        state,
        dataset: gameDataset,
        hasCheaperTier,
      }),
    [amount, currency, state, hasCheaperTier],
  );

  const [payFrom, setPayFrom] = useState<CurrencyCode>(affordability.preferredPayFromCurrency);

  useEffect(() => {
    if (open) {
      setPayFrom(affordability.preferredPayFromCurrency);
    }
  }, [open, affordability.preferredPayFromCurrency]);

  const walletOptions = useMemo(() => {
    const list: { code: CurrencyCode; shortNameFa: string; balance: number }[] = [];
    for (const code of ALL_CURRENCY_CODES) {
      const bal = getWalletBalance(state, code);
      if (bal > 0 || code === currency || code === 'IRT' || code === 'USD') {
        const def = getCurrencyDef(code, gameDataset);
        list.push({ code, shortNameFa: def.shortNameFa, balance: bal });
      }
    }
    return list;
  }, [state, currency]);

  const quote = useMemo(
    () =>
      quotePayFromWallet({
        targetAmount: amount,
        targetCurrency: currency,
        sourceCurrency: payFrom,
        state,
        dataset: gameDataset,
      }),
    [amount, currency, payFrom, state],
  );

  const drift = useMemo(
    () =>
      checkLockedRateDrift({
        lockedRateIrt: lockedRateToIrt,
        lockedYear,
        currencyCode: currency,
        state,
        dataset: gameDataset,
      }),
    [lockedRateToIrt, lockedYear, currency, state],
  );

  const sourceDef = getCurrencyDef(payFrom, gameDataset);
  const targetDef = getCurrencyDef(currency, gameDataset);
  const needsConversion = payFrom !== currency;
  const shortfallInSource = quote.canAfford
    ? 0
    : Math.max(0, quote.sourceRequired - quote.sourceBalanceBefore);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      snap="full"
      zIndexClass="z-[61]"
    >
      <div className="space-y-3" data-testid="foreign-payment-sheet">
        {/* Dual Price Header */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)]">مبلغ قابل پرداخت</div>
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
          {needsConversion && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1.5 text-left text-xs">
              <div className="text-[var(--text-muted)]">نرخ مبنای تبدیل</div>
              <div className="mt-0.5 font-bold text-[var(--text)]">
                {quote.midRateSourceToTarget >= 1 ? (
                  <RatePairLabel
                    fromCurrency={payFrom}
                    toCurrency={currency}
                    rate={quote.midRateSourceToTarget}
                  />
                ) : (
                  <RatePairLabel
                    fromCurrency={currency}
                    toCurrency={payFrom}
                    rate={1 / Math.max(1e-9, quote.midRateSourceToTarget)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Locked-Rate Snapshot & Drift Warning */}
        {drift && (
          <div
            className={`rounded-2xl border p-3 text-xs leading-relaxed ${
              drift.drifted
                ? 'border-[var(--warning)]/50 bg-[var(--warning)]/12 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span>نرخ قفل‌شده در این معامله (سال {toPersianDigits(drift.lockedYear)})</span>
              <RatePairLabel fromCurrency={currency} toCurrency="IRT" rate={drift.lockedRateIrt} />
            </div>
            {drift.drifted && (
              <div className="mt-1 font-bold text-[var(--warning)]">
                هشدار تغییر نرخ: نرخ بازار نسبت به زمان ثبت معامله{' '}
                <bdi dir="rtl">
                  {drift.driftPct > 0 ? `+${toPersianDigits(drift.driftPct)}` : `−${toPersianDigits(Math.abs(drift.driftPct))}`}٪
                </bdi>{' '}
                تغییر کرده است.
              </div>
            )}
          </div>
        )}

        {/* Pay-From Wallet Selector */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[var(--text)]">پرداخت از:</div>
          <div className="flex flex-wrap gap-1.5">
            {walletOptions.map((opt) => {
              const selected = opt.code === payFrom;
              const optQuote = quotePayFromWallet({
                targetAmount: amount,
                targetCurrency: currency,
                sourceCurrency: opt.code,
                state,
                dataset: gameDataset,
              });
              return (
                <button
                  key={opt.code}
                  type="button"
                  data-testid={`pay-from-wallet-${opt.code}`}
                  onClick={() => setPayFrom(opt.code)}
                  className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-right text-xs transition-colors ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)] font-bold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>کیف {opt.shortNameFa}</span>
                    {!optQuote.canAfford && (
                      <span className="text-xs font-medium text-[var(--danger)]">(ناکافی)</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                    موجودی:{' '}
                    <MoneyText
                      amount={opt.balance}
                      currency={opt.code}
                      mode="single"
                      compact
                      interactive={false}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversion Breakdown + Post-Payment Balances */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2 text-xs">
          {needsConversion ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">نرخ و کارمزد تبدیل</span>
                <span className="font-bold text-[var(--text)]">
                  کارمزد:{' '}
                  <MoneyText
                    amount={quote.feeInSource}
                    currency={payFrom}
                    mode="single"
                    compact
                    interactive={false}
                  />{' '}
                  · اختلاف {toPersianDigits(quote.spreadPct)}٪
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                <span className="font-bold text-[var(--text)]">
                  مبلغ کسرشده از کیف {sourceDef.shortNameFa}:
                </span>
                <MoneyText
                  amount={quote.sourceRequired}
                  currency={payFrom}
                  mode="inline"
                  stateOverride={state}
                  interactive={false}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[var(--text)]">پرداخت مستقیم ارزی (بدون کارمزد تبدیل)</span>
              <MoneyText
                amount={quote.sourceRequired}
                currency={payFrom}
                mode="single"
                compact
                interactive={false}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[var(--border)] pt-2">
            <div className="rounded-xl bg-[var(--surface-2)]/75 px-2.5 py-2">
              <div className="text-[var(--text-muted)]">
                مانده کیف {sourceDef.shortNameFa} پس از پرداخت
              </div>
              <div className="mt-0.5 font-bold text-[var(--text)]">
                <MoneyText
                  amount={quote.sourceBalanceAfter}
                  currency={payFrom}
                  mode="single"
                  compact
                  interactive={false}
                />
              </div>
            </div>
            {needsConversion && (
              <div className="rounded-xl bg-[var(--surface-2)]/75 px-2.5 py-2">
                <div className="text-[var(--text-muted)]">
                  مانده کیف {targetDef.shortNameFa} پس از پرداخت
                </div>
                <div className="mt-0.5 font-bold text-[var(--text)]">
                  <MoneyText
                    amount={quote.targetBalanceAfter}
                    currency={currency}
                    mode="single"
                    compact
                    interactive={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Affordability Badge & Quick Fixes */}
        <AffordabilityBadge
          amount={amount}
          currency={currency}
          state={state}
          hasCheaperTier={hasCheaperTier}
          onSelectCheaperTier={() => {
            onClose();
            onSelectCheaperTier?.();
          }}
          onFix={(fix) => {
            onClose();
            onFix?.(fix);
          }}
        />

        {/* Today's Rates Context */}
        <ExchangeRateStrip state={state} highlightCurrency={currency} compact />

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-bold text-[var(--text)]"
          >
            انصراف
          </button>
          <button
            type="button"
            data-testid="confirm-foreign-payment-btn"
            disabled={!quote.canAfford}
            onClick={() => {
              if (!quote.canAfford) return;
              onConfirm({ payFromCurrency: payFrom });
            }}
            className="min-h-[46px] flex-1 rounded-2xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)]"
          >
            {quote.canAfford ? (
              confirmLabel
            ) : (
              <>
                کیف {sourceDef.shortNameFa} ناکافی است (
                <MoneyText
                  amount={shortfallInSource}
                  currency={payFrom}
                  mode="single"
                  compact
                  interactive={false}
                />{' '}
                کم داری)
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
