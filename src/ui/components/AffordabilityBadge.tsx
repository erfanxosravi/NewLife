import { useMemo } from 'react';
import { gameDataset } from '../../data/registry';
import {
  getAffordabilityState,
  type AffordabilityFixKind,
  type AffordabilityReport,
} from '../../engine/money';
import type { CurrencyCode, GameState } from '../../engine/types';
import { useMoneyContext } from './MoneyContext';

const FIX_LABELS: Record<AffordabilityFixKind, string> = {
  convert: 'تبدیل از پس‌انداز',
  sell_asset: 'فروش طلا / دلار / دارایی',
  loan: 'دریافت وام بانکی',
  cheaper_tier: 'انتخاب گزینه ارزان‌تر',
};

export function AffordabilityBadge({
  amount,
  currency,
  state,
  hasCheaperTier = false,
  onSelectCheaperTier,
  onFix,
  showFixes = true,
  compact = false,
  className = '',
}: {
  amount: number;
  currency: CurrencyCode;
  state: GameState;
  hasCheaperTier?: boolean;
  onSelectCheaperTier?: () => void;
  onFix?: (fix: AffordabilityFixKind) => void;
  showFixes?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const ctx = useMoneyContext();
  const report: AffordabilityReport = useMemo(
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

  const toneClasses =
    report.badgeTone === 'emerald'
      ? 'border-[var(--success)]/35 bg-[var(--success)]/10 text-[var(--success)]'
      : report.badgeTone === 'amber'
        ? 'border-[var(--warning)]/40 bg-[var(--warning)]/12 text-[var(--warning)]'
        : 'border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]';

  const iconPrefix =
    report.status === 'sufficient' ? '✓' : report.status === 'tight' ? '⚠' : '✕';

  const handleFixClick = (fix: AffordabilityFixKind) => {
    if (fix === 'cheaper_tier' && onSelectCheaperTier) {
      onSelectCheaperTier();
      return;
    }
    if (onFix) {
      onFix(fix);
      return;
    }
    ctx.onAffordabilityFix?.(fix, currency);
  };

  return (
    <div className={`space-y-1.5 ${className}`} data-testid="affordability-badge">
      <div className={`rounded-xl border px-3 py-2 text-xs leading-snug ${toneClasses}`}>
        <div className="flex items-center gap-1.5 font-bold">
          <span>{iconPrefix}</span>
          <bdi dir="rtl">{report.shortLabelFa}</bdi>
        </div>
        {!compact && (
          <div className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
            {report.detailFa}
          </div>
        )}
      </div>

      {showFixes && report.fixSuggestions.length > 0 && report.status !== 'sufficient' && (
        <div className="flex flex-wrap gap-1.5">
          {report.fixSuggestions.map((fix) => (
            <button
              key={fix}
              type="button"
              onClick={() => handleFixClick(fix)}
              className="min-h-[34px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--primary-strong)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              {FIX_LABELS[fix]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
