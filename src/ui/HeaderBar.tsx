import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatAgeLabel, formatToman, toPersianDigits } from '../engine/jalali';
import { IconCash, IconMenu } from './icons';
import { CurrencyText } from './components/Primitives';

interface HeaderBarProps {
  fullName: string;
  age: number;
  jalaliYear: number;
  moneyToman: number;
  moneyDelta?: { amount: number; key: number } | null;
  reducedMotion?: boolean;
  onOpenAssets: () => void;
  onOpenMenu: () => void;
}

export function HeaderBar({
  fullName,
  age,
  jalaliYear,
  moneyToman,
  moneyDelta = null,
  reducedMotion = false,
  onOpenAssets,
  onOpenMenu,
}: HeaderBarProps) {
  const [visibleDelta, setVisibleDelta] = useState<{ amount: number; key: number } | null>(null);

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

  return (
    <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-[18px] font-bold leading-snug text-[var(--text)]">
            {fullName}
          </h1>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={onOpenAssets}
              aria-label="مشاهده دارایی‌ها و نقدینگی"
              className="inline-flex min-h-[30px] max-w-full items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--primary-strong)] transition-colors hover:border-[var(--primary)]"
            >
              <IconCash className="h-3.5 w-3.5 shrink-0" />
              <CurrencyText amountToman={moneyToman} className="truncate" />
            </button>

            <AnimatePresence>
              {visibleDelta && (
                <motion.span
                  key={visibleDelta.key}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.92 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 14, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: reducedMotion ? 0.16 : 0.28 }}
                  className={`pointer-events-none absolute top-full right-0 z-30 mt-1 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-sm ${
                    visibleDelta.amount > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}
                >
                  <bdi dir="rtl">
                    {visibleDelta.amount > 0 ? '+' : '−'}
                    {formatToman(Math.abs(visibleDelta.amount))}
                  </bdi>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-0.5 text-xs font-medium tabular-nums text-[var(--text-muted)]">
          <bdi dir="rtl">
            {formatAgeLabel(age)} | {toPersianDigits(jalaliYear)}
          </bdi>
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
  );
}
