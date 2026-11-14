import { useMemo } from 'react';
import { gameDataset } from '../../data/registry';
import { toPersianDigits } from '../../engine/jalali';
import { getTodayExchangeRatesSummary } from '../../engine/money';
import type { CurrencyCode, GameState } from '../../engine/types';
import { useMoneyContext } from './MoneyContext';
import { Sparkline } from './Primitives';

export function ExchangeRateStrip({
  state,
  highlightCurrency,
  compact = false,
  className = '',
}: {
  state: GameState;
  highlightCurrency?: CurrencyCode;
  compact?: boolean;
  className?: string;
}) {
  const ctx = useMoneyContext();
  const summary = useMemo(
    () => getTodayExchangeRatesSummary(state, gameDataset, highlightCurrency),
    [state, highlightCurrency],
  );

  return (
    <div
      data-testid="exchange-rate-strip"
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/75 p-2.5 space-y-2 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary)]" />
          <span>نرخ امروز</span>
          <span className="font-medium text-[var(--text-muted)]">
            · سال {toPersianDigits(summary.quoteYear)}
          </span>
        </div>
        {ctx.onOpenCalculator && (
          <button
            type="button"
            data-testid="open-currency-calculator-btn"
            onClick={() =>
              ctx.onOpenCalculator?.({
                fromCurrency:
                  highlightCurrency && highlightCurrency !== 'IRT' ? highlightCurrency : 'EUR',
                toCurrency: 'IRT',
              })
            }
            className="min-h-[32px] rounded-xl border border-[var(--primary)]/35 bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--primary-strong)] transition-colors hover:bg-[var(--primary-soft)]"
          >
            ماشین‌حساب ارز
          </button>
        )}
      </div>

      <div className={`grid gap-1.5 ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {summary.featured.map((item) => {
          const arrow = item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '•';
          const changeTone =
            item.direction === 'up'
              ? 'text-[var(--danger)]'
              : item.direction === 'down'
                ? 'text-[var(--success)]'
                : 'text-[var(--text-muted)]';

          return (
            <button
              key={item.code}
              type="button"
              onClick={() =>
                ctx.onOpenCalculator?.({
                  fromCurrency: item.code,
                  toCurrency: 'IRT',
                  amount: 100,
                })
              }
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-right transition-colors hover:border-[var(--primary)]"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text)]">
                  <bdi dir="rtl" className="tabular-nums">
                    ۱ {item.shortNameFa} = {item.rateIrtFormatted}
                  </bdi>
                </div>
                <div className={`mt-0.5 text-xs font-bold tabular-nums ${changeTone}`}>
                  <bdi dir="rtl">
                    {arrow}{' '}
                    {item.changePct === 0
                      ? 'ثابت'
                      : `${item.changePct > 0 ? '+' : '−'}${toPersianDigits(Math.abs(item.changePct))}٪ پارسال`}
                  </bdi>
                </div>
              </div>
              {!compact && item.sparkline.length >= 2 && (
                <div className="w-12 shrink-0">
                  <Sparkline
                    values={item.sparkline}
                    height={24}
                    colorVar={item.direction === 'up' ? '--danger' : '--primary'}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
