import { formatToman, toPersianDigits } from '../../../engine/jalali';
import type { JobMarketItem } from '../../../engine/jobCompass';
import { triggerHaptic } from '../../../utils/haptics';
import { IconCheck } from '../../icons';
import { EmojiSprite, JobIconTile } from './JobIcons';
import { MatchRing, ReadinessRing } from './JobRings';

interface JobRowProps {
  item: JobMarketItem;
  salaryUnit: 'monthly' | 'annual';
  isPinnedGoal: boolean;
  isShortlisted: boolean;
  compareMode?: boolean;
  isSelectedForCompare?: boolean;
  onSelect: () => void;
  rowRef?: (el: HTMLButtonElement | null) => void;
}

export function JobRow({
  item,
  salaryUnit,
  isPinnedGoal,
  isShortlisted,
  compareMode = false,
  isSelectedForCompare = false,
  onSelect,
  rowRef,
}: JobRowProps) {
  const { job, salary, readiness, match } = item;
  const locked = !readiness.eligible;

  const netAmount =
    salaryUnit === 'annual' ? salary.expectedAnnualNet : salary.expectedMonthlyNet;
  const usdAmount =
    salaryUnit === 'annual' ? salary.expectedAnnualUsd : salary.expectedMonthlyUsd;
  const unitLabel = salaryUnit === 'annual' ? '/ سال' : '/ ماه';

  // Locked state: first tag becomes the specific lock reason, keeping max 3 tags total
  const displayTags: { icon: string; labelFa: string; isLock?: boolean }[] = locked
    ? [
        {
          icon: '🔒',
          labelFa: (readiness.lockTagFa ?? '🔒 پیش‌نیاز مانده').replace(/^🔒\s*/, ''),
          isLock: true,
        },
        ...job.tags.slice(0, 2),
      ]
    : job.tags.slice(0, 3);

  const salaryBlock = (
    <>
      <bdi
        dir="rtl"
        className="text-[15px] font-bold leading-tight tabular-nums text-[var(--text)]"
      >
        {formatToman(netAmount).replace(' تومان', '')} {unitLabel}
      </bdi>
      <span className="text-xs leading-tight tabular-nums text-[var(--text-muted)]">
        معادل {toPersianDigits(usdAmount.toLocaleString('en-US'))} دلار
      </span>
    </>
  );

  return (
    <button
      ref={rowRef}
      type="button"
      data-testid={`job-row-${job.id}`}
      data-job-title={job.shortTitle}
      onClick={() => {
        triggerHaptic('light');
        onSelect();
      }}
      className={`group flex min-h-[72px] w-full items-center justify-between gap-3 px-3.5 py-3 text-right transition-colors active:scale-[0.99] active:bg-[var(--surface-2)] ${
        isSelectedForCompare
          ? 'bg-[var(--primary-soft)]/40'
          : readiness.isCurrentJob
            ? 'bg-[var(--success)]/6 hover:bg-[var(--success)]/10'
            : locked
              ? 'bg-[var(--surface)] hover:bg-[var(--surface-2)]/65'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-2)]/70'
      }`}
    >
      {/* Right (leading in RTL): 48px icon tile + middle title & tags */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {compareMode && (
          <span
            aria-hidden="true"
            className={`mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              isSelectedForCompare
                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-transparent'
            }`}
          >
            <IconCheck className="h-4 w-4" />
          </span>
        )}

        <JobIconTile
          iconKey={job.iconKey}
          talentMatched={match.talentMatched}
          talentReasonFa={match.talentMatchReasonFa}
          dimmed={locked}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4
              className={`text-base font-bold leading-snug break-words ${
                locked ? 'text-[var(--text)] opacity-85' : 'text-[var(--text)]'
              }`}
            >
              {job.shortTitle}
            </h4>
            {readiness.isCurrentJob && (
              <span className="inline-flex items-center rounded-lg bg-[var(--success)]/15 px-2 py-0.5 text-xs font-bold text-[var(--success)]">
                شغل فعلی
              </span>
            )}
            {isPinnedGoal && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-bold text-[var(--primary-strong)]">
                <EmojiSprite emoji="🎯" label="هدف" className="text-xs" />
                <span>هدف</span>
              </span>
            )}
            {isShortlisted && !isPinnedGoal && (
              <span
                className="inline-flex items-center rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300"
                aria-label="نشان‌شده"
              >
                ★
              </span>
            )}
            {readiness.isWaitlisted && (
              <span className="inline-flex items-center rounded-lg bg-[var(--warning)]/15 px-2 py-0.5 text-xs font-bold text-[var(--warning)]">
                در انتظار
              </span>
            )}
          </div>

          {/* Up to 3 mini-tags at 12px */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {displayTags.map((tag, idx) => (
              <span
                key={`${tag.labelFa}-${idx}`}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs leading-tight whitespace-nowrap ${
                  tag.isLock
                    ? 'border-[var(--warning)]/40 bg-[var(--warning)]/12 font-bold text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                <EmojiSprite emoji={tag.icon} className="text-xs" />
                <span>{tag.labelFa}</span>
              </span>
            ))}
          </div>

          {/* Near-ready 1-line gap */}
          {readiness.group === 'near_ready' && (
            <p className="mt-1 text-xs font-medium leading-snug text-[var(--primary-strong)]">
              {readiness.shortGapFa}
            </p>
          )}

          {/* Narrow screen (<380px): salary drops cleanly onto 3rd line under tags */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-[380px]:hidden">
            {salaryBlock}
          </div>
        </div>
      </div>

      {/* Left (trailing in RTL): salary (>=380px) + MatchRing / ReadinessRing */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="hidden flex-col items-end text-left min-[380px]:flex">
          {salaryBlock}
        </div>
        {locked ? (
          <ReadinessRing score={readiness.score} />
        ) : (
          <MatchRing score={match.score} />
        )}
      </div>
    </button>
  );
}
