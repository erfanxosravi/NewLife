import { useMemo } from 'react';
import { gameDataset } from '../../../data/registry';
import { formatToman, toPersianDigits } from '../../../engine/jalali';
import {
  JOB_COMPASS_AXES,
  type JobMarketItem,
  type JobRequirementCheckItem,
} from '../../../engine/jobCompass';
import type { JobCompassPriorities, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import { formatUsdEquivalentHint } from '../../../state/selectors';
import { triggerHaptic } from '../../../utils/haptics';
import {
  IconCheck,
  IconClose,
  IconStar,
} from '../../icons';
import { Card, DetailSheet, ProgressStepper, SectionGroup } from '../Primitives';
import { EmojiSprite, JobIconTile } from './JobIcons';
import { MatchRing, ReadinessRing } from './JobRings';
import {
  FingerprintRadar,
  prioritiesToRadarValues,
} from './FingerprintRadar';

export type JobGapActionTarget = NonNullable<JobRequirementCheckItem['actionTarget']>;

interface JobDetailSheetProps {
  open: boolean;
  item: JobMarketItem | null;
  saveGame: SaveGame;
  priorities: JobCompassPriorities;
  salaryUnit: 'monthly' | 'annual';
  isShortlisted: boolean;
  isPinnedGoal: boolean;
  isInCompare: boolean;
  onClose: () => void;
  onToggleShortlist: (jobId: string) => void;
  onTogglePinGoal: (jobId: string) => void;
  onToggleCompare: (jobId: string) => void;
  onStartInterview: (item: JobMarketItem) => void;
  onNavigateGapTarget: (target: JobGapActionTarget) => void;
}

export function JobDetailSheet({
  open,
  item,
  saveGame,
  priorities,
  salaryUnit,
  isShortlisted,
  isPinnedGoal,
  isInCompare,
  onClose,
  onToggleShortlist,
  onTogglePinGoal,
  onToggleCompare,
  onStartInterview,
  onNavigateGapTarget,
}: JobDetailSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;

  const cityName = useMemo(() => {
    return (
      gameDataset.cities.find((c) => c.id === state.player.currentCityId)?.nameFa ?? 'شهر فعلی'
    );
  }, [state.player.currentCityId]);

  if (!item) {
    return (
      <DetailSheet open={false} onClose={onClose} title="">
        <div />
      </DetailSheet>
    );
  }

  const { job, salary, fingerprint, readiness, match, gapSteps } = item;
  const locked = !readiness.eligible;

  const expectedNet =
    salaryUnit === 'annual' ? salary.expectedAnnualNet : salary.expectedMonthlyNet;
  const p10Net = salaryUnit === 'annual' ? salary.p10AnnualNet : salary.p10MonthlyNet;
  const p90Net = salaryUnit === 'annual' ? salary.p90AnnualNet : salary.p90MonthlyNet;
  const unitText = salaryUnit === 'annual' ? t('careerMarket.perYear') : t('careerMarket.perMonth');

  const estimatedAxisLabels = fingerprint.estimatedAxes
    .map((ax) => JOB_COMPASS_AXES.find((a) => a.key === ax)?.labelFa ?? ax)
    .join('، ');

  const deductionsTotal =
    salary.expectedBreakdown.commission +
    salary.expectedBreakdown.runningCosts +
    salary.expectedBreakdown.bimeh +
    salary.expectedBreakdown.incomeTax;

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title={job.shortTitle}
      subtitle={`${job.employerType ?? 'خصوصی'} · ${cityName}`}
      zIndexClass="z-[56]"
      headerRight={
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onToggleShortlist(job.id);
          }}
          aria-label={isShortlisted ? 'حذف از نشان‌شده‌ها' : 'افزودن به نشان‌شده‌ها'}
          aria-pressed={isShortlisted}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
            isShortlisted
              ? 'border-amber-400 bg-amber-500/15 text-amber-600 dark:text-amber-300'
              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <IconStar className={`h-5 w-5 ${isShortlisted ? 'fill-current' : ''}`} />
        </button>
      }
      footer={
        <div className="space-y-2">
          <button
            type="button"
            data-testid="job-detail-apply-btn"
            disabled={!readiness.canApplyNow}
            onClick={() => {
              triggerHaptic('medium');
              onStartInterview(item);
            }}
            className={`flex min-h-[48px] w-full flex-col items-center justify-center rounded-2xl px-4 py-2 text-center transition-all ${
              readiness.canApplyNow
                ? 'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-strong)] active:scale-[0.99]'
                : 'cursor-not-allowed border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            <span className="text-sm font-bold">
              {readiness.isCurrentJob
                ? 'شغل فعلی تو'
                : readiness.isWaitlisted
                  ? 'پرونده در صف انتظار سال بعد'
                  : t('careerMarket.startInterview')}
            </span>
            {!readiness.canApplyNow && readiness.blockedReason && (
              <span className="mt-0.5 text-xs opacity-90">{readiness.blockedReason}</span>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="job-detail-pin-btn"
              onClick={() => {
                triggerHaptic('medium');
                onTogglePinGoal(job.id);
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                isPinnedGoal
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]'
              }`}
            >
              <span>{isPinnedGoal ? t('careerMarket.unpinGoal') : t('careerMarket.pinGoal')}</span>
            </button>
            <button
              type="button"
              data-testid="job-detail-compare-btn"
              onClick={() => {
                triggerHaptic('light');
                onToggleCompare(job.id);
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                isInCompare
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]'
              }`}
            >
              <span>{isInCompare ? 'حذف از مقایسه' : t('careerMarket.compare')}</span>
            </button>
          </div>
        </div>
      }
    >
      {/* Header summary card */}
      <Card className="space-y-3">
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
                {job.titleFa}
              </h3>
              {job.tagline && (
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  {job.tagline}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {job.tags.map((tg, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                  >
                    <EmojiSprite emoji={tg.icon} className="text-xs" />
                    <span>{tg.labelFa}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            {locked ? (
              <ReadinessRing score={readiness.score} size={42} />
            ) : (
              <MatchRing score={match.score} size={42} />
            )}
          </div>
        </div>

        {match.talentMatched && match.talentMatchReasonFa && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200">
            <EmojiSprite emoji="⭐" label="همسو با استعداد" />
            <span>{match.talentMatchReasonFa}</span>
          </div>
        )}

        <p className="text-sm leading-7 text-[var(--text)]">{job.longDescription}</p>

        {/* Metric Triplet (>=12px font floor) */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-2)] p-3">
          <div className="min-w-0 text-right">
            <div className="text-xs text-[var(--text-muted)]">
              {t('careerMarket.expectedPayLabel')}
            </div>
            <div className="mt-0.5 text-xs font-bold tabular-nums text-[var(--success)]">
              {formatToman(expectedNet).replace(' تومان', '')} {unitText}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-xs text-[var(--text-muted)]">ساعت کاری</div>
            <div className="mt-0.5 text-xs font-bold tabular-nums text-[var(--text)]">
              {toPersianDigits(job.weeklyHours)} {t('careerMarket.hoursUnit')}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-xs text-[var(--text-muted)]">فشار و استرس</div>
            <div
              className={`mt-0.5 text-xs font-bold tabular-nums ${
                job.stress >= 70 ? 'text-[var(--danger)]' : 'text-[var(--text)]'
              }`}
            >
              {toPersianDigits(job.stress)}٪
            </div>
          </div>
        </div>
      </Card>

      {/* Pay range & real breakdown */}
      <Card className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-[var(--text)]">
            {t('careerMarket.payRangeLabel')}
          </span>
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {formatUsdEquivalentHint(expectedNet, state, gameDataset)}
          </span>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">بازه خالص بازار ({unitText}):</span>
            <span className="font-bold tabular-nums text-[var(--text)]">
              از {formatToman(p10Net).replace(' تومان', '')} تا {formatToman(p90Net)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">درآمد ناخالص پایه:</span>
            <span className="font-bold tabular-nums text-[var(--text)]">
              {formatToman(
                salaryUnit === 'annual' ? salary.expectedAnnualGross : salary.expectedMonthlyGross,
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">کسورات سالانه (بیمه/مالیات/هزینه):</span>
            <span className="font-bold tabular-nums text-[var(--text)]">
              {formatToman(
                salaryUnit === 'annual' ? deductionsTotal : Math.round(deductionsTotal / 12),
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* 5-Axis Fingerprint Radar + Match Explanation */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[var(--text)]">{t('careerMarket.radarTitle')}</h4>
          <span className="rounded-lg bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
            تطابق {toPersianDigits(match.score)}٪
          </span>
        </div>

        <FingerprintRadar
          series={[
            {
              id: job.id,
              labelFa: job.shortTitle,
              values: fingerprint,
              stroke: '#F97316',
              fill: 'rgba(249, 115, 22, 0.24)',
            },
            {
              id: 'player_prefs',
              labelFa: t('careerMarket.radarPlayerLegend'),
              values: prioritiesToRadarValues(priorities),
              stroke: 'var(--text)',
              fill: 'rgba(138, 117, 104, 0.08)',
              dashed: true,
            },
          ]}
        />

        <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-medium leading-6 text-[var(--text)]">
          {match.explanationFa}
        </p>

        {fingerprint.isEstimate && (
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            یادداشت مدل: محورهای {estimatedAxisLabels} برآورد تحریریه بر اساس ساختار کارفرما و ساعت کاری هستند.
            {job.fingerprint.notesFa ? ` ${job.fingerprint.notesFa}` : ''}
          </p>
        )}
      </Card>

      {/* Requirements + Actionable Gap Roadmap */}
      <Card className="space-y-2.5" data-testid="job-detail-requirements">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[var(--text)]">
            {t('careerMarket.requirementsTitle')}
          </h4>
          <span className="text-xs font-bold tabular-nums text-[var(--primary-strong)]">
            آمادگی {toPersianDigits(readiness.score)}٪
          </span>
        </div>

        <div className="space-y-2">
          {gapSteps.map((step) => (
            <div
              key={step.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-3"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {step.done ? (
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                ) : (
                  <IconClose className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)]">{step.titleFa}</div>
                  {step.subtitleFa && (
                    <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                      {step.subtitleFa}
                    </div>
                  )}
                  {!step.done && step.estimatedYears && step.estimatedYears > 0 && (
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                      زمان تقریبی: حدود {toPersianDigits(step.estimatedYears)} سال
                    </div>
                  )}
                </div>
              </div>

              {!step.done && step.actionTarget && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNavigateGapTarget(step.actionTarget!);
                  }}
                  className="min-h-[44px] shrink-0 rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)]"
                >
                  {step.actionTarget.labelFa}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Career Ladder Preview */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[var(--text)]">{t('careerMarket.ladderTitle')}</h4>
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {toPersianDigits(job.ladder.length)} پله
          </span>
        </div>
        {job.noPromotions ? (
          <p className="text-xs leading-6 text-[var(--text-muted)]">{t('career.noPromotionsNote')}</p>
        ) : (
          <ProgressStepper
            orientation="vertical"
            steps={job.ladder.map((step) => ({
              id: `lad_${step.level}`,
              title: step.titleFa,
              subtitle: step.ceiling
                ? `${t('career.ceilingBadge')} · ضریب حقوق ${toPersianDigits(step.salaryMultiplier)}×`
                : `ضریب حقوق ${toPersianDigits(step.salaryMultiplier)}×`,
              status: step.level === 1 ? 'current' : 'upcoming',
            }))}
          />
        )}
        {job.ownershipPath.allowed && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/65 p-3 text-xs leading-6 text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text)]">
              {t('careerMarket.ownershipNoteTitle')}:{' '}
            </span>
            {job.ownershipPath.notesFa}
          </div>
        )}
      </Card>

      {/* Day in the Life */}
      <SectionGroup title={t('careerMarket.dayInLife')}>
        {job.dayInLife.map((scene, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] text-lg">
              <EmojiSprite emoji={scene.emoji} label={scene.timeFa} className="text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[var(--primary-strong)]">{scene.timeFa}</div>
              <p className="mt-1 text-sm leading-6 text-[var(--text)]">{scene.textFa}</p>
            </div>
          </div>
        ))}
      </SectionGroup>

      {/* Pros & Cons & Reality Check */}
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--success)]/8 p-3">
            <h5 className="text-xs font-bold text-[var(--success)]">
              {t('careerMarket.prosTitle')}
            </h5>
            <ul className="mt-2 space-y-1.5 text-xs leading-6 text-[var(--text)]">
              {job.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[var(--success)]">✓</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-[var(--danger)]/8 p-3">
            <h5 className="text-xs font-bold text-[var(--danger)]">
              {t('careerMarket.consTitle')}
            </h5>
            <ul className="mt-2 space-y-1.5 text-xs leading-6 text-[var(--text)]">
              {job.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[var(--danger)]">×</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-xs font-bold text-[var(--primary-strong)]">
            {t('careerMarket.realityCheck')}
          </div>
          <p className="mt-1 text-xs leading-6 text-[var(--text)]">{job.realityCheckFa}</p>
        </div>
      </Card>
    </DetailSheet>
  );
}
