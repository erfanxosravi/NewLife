import { useRef, useState } from 'react';
import { formatToman, toPersianDigits } from '../../../engine/jalali';
import type { JobMarketItem } from '../../../engine/jobCompass';
import { useI18n } from '../../../i18n/useI18n';
import { triggerHaptic } from '../../../utils/haptics';
import { IconReset, IconStar } from '../../icons';
import { Card } from '../Primitives';
import { EmojiSprite, JobIconTile } from './JobIcons';
import { MatchRing, ReadinessRing } from './JobRings';

interface JobDeckProps {
  items: JobMarketItem[];
  salaryUnit: 'monthly' | 'annual';
  shortlistedIds: string[];
  onShortlistAndNext: (jobId: string) => void;
  onOpenDetail: (item: JobMarketItem) => void;
}

export function JobDeck({
  items,
  salaryUnit,
  shortlistedIds,
  onShortlistAndNext,
  onOpenDetail,
}: JobDeckProps) {
  const { t } = useI18n();
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);

  const safeCursor = Math.min(cursor, items.length);
  const current = items[safeCursor] ?? null;

  const advance = (direction: 'skip' | 'save') => {
    if (!current) return;
    triggerHaptic(direction === 'save' ? 'medium' : 'light');
    if (direction === 'save' && !shortlistedIds.includes(current.job.id)) {
      onShortlistAndNext(current.job.id);
    }
    setHistory((prev) => [...prev, safeCursor]);
    setCursor((c) => c + 1);
    setDragX(0);
  };

  const undo = () => {
    if (history.length === 0) return;
    triggerHaptic('light');
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCursor(last);
    setDragX(0);
  };

  if (!current) {
    return (
      <Card className="space-y-3 py-8 text-center">
        <div className="text-base font-bold text-[var(--text)]">{t('careerMarket.deckEmpty')}</div>
        <p className="text-xs text-[var(--text-muted)]">
          همه شغل‌های این فهرست را مرور کردی. می‌توانی دوباره از ابتدا ببینی.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          {history.length > 0 && (
            <button
              type="button"
              onClick={undo}
              className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-bold text-[var(--text)]"
            >
              {t('careerMarket.deckUndo')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCursor(0);
              setHistory([]);
            }}
            className="min-h-[44px] rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)]"
          >
            {t('careerMarket.deckRestart')}
          </button>
        </div>
      </Card>
    );
  }

  const { job, salary, readiness, match } = current;
  const locked = !readiness.eligible;
  const netAmt =
    salaryUnit === 'annual' ? salary.expectedAnnualNet : salary.expectedMonthlyNet;
  const usdAmt =
    salaryUnit === 'annual' ? salary.expectedAnnualUsd : salary.expectedMonthlyUsd;
  const unitLabel = salaryUnit === 'annual' ? '/ سال' : '/ ماه';

  return (
    <div className="space-y-3" data-testid="job-deck-view">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
        <span>
          کارت {toPersianDigits(safeCursor + 1)} از {toPersianDigits(items.length)}
        </span>
        <span>برای نشان‌کردن به راست یا برای ردکردن به چپ بکش</span>
      </div>

      <div
        onPointerDown={(e) => {
          startXRef.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (startXRef.current === null) return;
          setDragX(Math.max(-140, Math.min(140, e.clientX - startXRef.current)));
        }}
        onPointerUp={() => {
          if (startXRef.current === null) return;
          startXRef.current = null;
          if (dragX > 65) advance('save');
          else if (dragX < -65) advance('skip');
          else setDragX(0);
        }}
        onPointerCancel={() => {
          startXRef.current = null;
          setDragX(0);
        }}
        style={{
          transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX * 0.04}deg)` : undefined,
        }}
        className="touch-pan-y rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-transform duration-150 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <JobIconTile
              iconKey={job.iconKey}
              talentMatched={match.talentMatched}
              talentReasonFa={match.talentMatchReasonFa}
              dimmed={locked}
              size="lg"
            />
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug text-[var(--text)]">
                {job.shortTitle}
              </h3>
              {job.tagline && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {job.tagline}
                </p>
              )}
            </div>
          </div>

          {locked ? (
            <ReadinessRing score={readiness.score} size={42} />
          ) : (
            <MatchRing score={match.score} size={42} />
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {locked && readiness.lockTagFa && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/12 px-2.5 py-1 text-xs font-bold text-[var(--text)]">
              <EmojiSprite emoji="🔒" className="text-xs" />
              <span>{readiness.lockTagFa.replace(/^🔒\s*/, '')}</span>
            </span>
          )}
          {job.tags.slice(0, locked ? 2 : 3).map((tg, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
            >
              <EmojiSprite emoji={tg.icon} className="text-xs" />
              <span>{tg.labelFa}</span>
            </span>
          ))}
        </div>

        <div className="rounded-2xl bg-[var(--surface-2)] p-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[var(--text-muted)]">خالص دریافتی</div>
            <div className="text-base font-bold tabular-nums text-[var(--text)]">
              {formatToman(netAmt).replace(' تومان', '')} {unitLabel}
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-[var(--text-muted)]">معادل ارزی</div>
            <div className="text-xs font-bold tabular-nums text-[var(--text-muted)]">
              {toPersianDigits(usdAmt.toLocaleString('en-US'))} دلار
            </div>
          </div>
        </div>

        <p className="text-xs leading-6 text-[var(--text)]">{match.explanationFa}</p>

        <button
          type="button"
          onClick={() => onOpenDetail(current)}
          className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold text-[var(--primary-strong)] hover:border-[var(--primary)]"
        >
          مشاهده جزئیات و مصاحبه
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => advance('skip')}
          className="flex min-h-[48px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          {t('careerMarket.deckSkip')}
        </button>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={undo}
          aria-label={t('careerMarket.deckUndo')}
          className="flex min-h-[48px] items-center justify-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
        >
          <IconReset className="h-4 w-4" />
          <span>{t('careerMarket.deckUndo')}</span>
        </button>
        <button
          type="button"
          onClick={() => advance('save')}
          className="flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--on-primary)] hover:bg-[var(--primary-strong)]"
        >
          <IconStar className="h-4 w-4" />
          <span>{t('careerMarket.deckSave')}</span>
        </button>
      </div>
    </div>
  );
}
