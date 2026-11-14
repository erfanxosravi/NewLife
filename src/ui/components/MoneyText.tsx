import { gameDataset } from '../../data/registry';
import { toPersianDigits } from '../../engine/jalali';
import { formatMoneyDual, formatSingleCurrency } from '../../engine/money';
import type { CurrencyCode, DisplayCurrencyMode, GameState } from '../../engine/types';
import { useMoneyContext } from './MoneyContext';

export type MoneyTextMode = 'stacked' | 'inline' | 'compact' | 'single';

export function MoneyText({
  amount,
  currency = 'IRT',
  mode = 'stacked',
  showSign = false,
  compact,
  stateOverride,
  primaryOverride,
  forceHideSecondary = false,
  interactive,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
}: {
  amount: number;
  currency?: CurrencyCode;
  mode?: MoneyTextMode;
  showSign?: boolean;
  compact?: boolean;
  stateOverride?: GameState;
  primaryOverride?: DisplayCurrencyMode;
  forceHideSecondary?: boolean;
  interactive?: boolean;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  const ctx = useMoneyContext();
  const effectiveState = stateOverride ?? ctx.state;
  const dual = formatMoneyDual(amount, currency, effectiveState, gameDataset, {
    compact: compact ?? (mode === 'inline' || mode === 'compact'),
    showSign,
    primaryOverride,
    forceHideSecondary,
  });

  const canOpenPopover =
    Boolean(ctx.onOpenForeignPopover) &&
    (interactive ?? (currency !== 'IRT' && mode !== 'single'));

  const handleOpenPopover = () => {
    if (!canOpenPopover || !ctx.onOpenForeignPopover) return;
    ctx.onOpenForeignPopover({ amount, currency });
  };

  if (mode === 'single') {
    const text = formatSingleCurrency(amount, currency, gameDataset, {
      compact: compact ?? false,
      showSign,
    });
    return (
      <bdi dir="rtl" className={`tabular-nums ${className} ${primaryClassName}`}>
        {text}
      </bdi>
    );
  }

  if (mode === 'inline' || mode === 'compact') {
    const content = (
      <bdi dir="rtl" className={`tabular-nums ${className} ${primaryClassName}`}>
        {dual.inlineText}
      </bdi>
    );
    if (!canOpenPopover) return content;
    return (
      <button
        type="button"
        onClick={handleOpenPopover}
        className={`inline-flex items-center gap-1 text-right underline decoration-dotted decoration-[var(--primary)]/60 underline-offset-4 transition-opacity hover:opacity-85 ${className}`}
        title="جزئیات نرخ تبدیل و سهم از دارایی"
      >
        {content}
      </button>
    );
  }

  // Stacked two-line mode (primary 15px/700, secondary 12px muted)
  const stackedContent = (
    <span className={`inline-flex flex-col items-start gap-0.5 leading-tight ${className}`}>
      <bdi
        dir="rtl"
        className={`text-[15px] font-bold tabular-nums leading-snug ${
          canOpenPopover ? 'underline decoration-dotted decoration-[var(--primary)]/55 underline-offset-4' : ''
        } ${primaryClassName}`}
      >
        {dual.primaryText}
      </bdi>
      {dual.secondaryText && (
        <bdi
          dir="rtl"
          className={`text-xs font-medium tabular-nums leading-snug text-[var(--text-muted)] ${secondaryClassName}`}
        >
          {dual.secondaryText}
        </bdi>
      )}
    </span>
  );

  if (!canOpenPopover) return stackedContent;

  return (
    <button
      type="button"
      onClick={handleOpenPopover}
      className="inline-flex flex-col items-start text-right transition-opacity hover:opacity-85"
      title="مشاهده نرخ تبدیل و جزئیات"
    >
      {stackedContent}
    </button>
  );
}

/**
 * Helper component for rendering Jalali rate value text cleanly without raw formatting in UI files.
 */
export function RatePairLabel({
  fromCurrency,
  toCurrency = 'IRT',
  rate,
  className = '',
}: {
  fromCurrency: CurrencyCode;
  toCurrency?: CurrencyCode;
  rate: number;
  className?: string;
}) {
  const oneText = formatSingleCurrency(1, fromCurrency, gameDataset, { compact: false });
  const eqText = formatSingleCurrency(rate, toCurrency, gameDataset, {
    compact: rate >= 1_000_000,
  });
  return (
    <bdi dir="rtl" className={`tabular-nums ${className}`}>
      {oneText} = {eqText}
    </bdi>
  );
}

export function ForeignShareText({ pct }: { pct: number }) {
  return (
    <bdi dir="rtl" className="tabular-nums">
      {toPersianDigits(pct)}٪ از دارایی‌ات
    </bdi>
  );
}

export function getMoneyDualDetails(
  amount: number,
  currency: CurrencyCode,
  state: GameState,
) {
  return formatMoneyDual(amount, currency, state, gameDataset);
}

export function formatMoneyTextForCanvas(
  amount: number,
  currency: CurrencyCode = 'IRT',
  state?: GameState,
): string {
  if (state) {
    const dual = formatMoneyDual(amount, currency, state, gameDataset, { compact: false });
    return dual.secondaryText ? `${dual.primaryText} (${dual.secondaryText})` : dual.primaryText;
  }
  return formatSingleCurrency(amount, currency, gameDataset, { compact: false });
}

