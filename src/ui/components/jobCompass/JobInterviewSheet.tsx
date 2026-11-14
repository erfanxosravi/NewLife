import { useMemo, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import { formatToman, toPersianDigits } from '../../../engine/jalali';
import {
  pickInterviewQuestionsForJob,
  type JobMarketItem,
} from '../../../engine/jobCompass';
import type { JobInterviewOutcome } from '../../../state/actions';
import type { InterviewAnswer, SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import { triggerHaptic } from '../../../utils/haptics';
import { Card, DetailSheet } from '../Primitives';
import { JobIconTile } from './JobIcons';

interface JobInterviewSheetProps {
  open: boolean;
  item: JobMarketItem | null;
  saveGame: SaveGame;
  onClose: () => void;
  onSubmitInterview: (
    item: JobMarketItem,
    answers: { questionId: string; answerId: string }[],
  ) => JobInterviewOutcome;
}

export function JobInterviewSheet({
  open,
  item,
  saveGame,
  onClose,
  onSubmitInterview,
}: JobInterviewSheetProps) {
  const { t } = useI18n();
  const [stepIndex, setStepIndex] = useState<'briefing' | number>('briefing');
  const [pickedByQid, setPickedByQid] = useState<Record<string, InterviewAnswer>>({});
  const [result, setResult] = useState<JobInterviewOutcome | null>(null);

  const questions = useMemo(() => {
    if (!item) return [];
    return pickInterviewQuestionsForJob(item.job.id, saveGame.state, gameDataset);
  }, [item, saveGame.state]);

  const resetAndClose = () => {
    setStepIndex('briefing');
    setPickedByQid({});
    setResult(null);
    onClose();
  };

  if (!item) {
    return (
      <DetailSheet open={false} onClose={resetAndClose} title="">
        <div />
      </DetailSheet>
    );
  }

  const { job, chanceInfo } = item;
  const currentQuestion = typeof stepIndex === 'number' ? questions[stepIndex] : null;
  const pickedAnswer = currentQuestion ? pickedByQid[currentQuestion.id] : undefined;

  const handleFinish = () => {
    const payload = questions
      .map((q) => {
        const a = pickedByQid[q.id];
        return a ? { questionId: q.id, answerId: a.id } : null;
      })
      .filter((x): x is { questionId: string; answerId: string } => Boolean(x));

    const outcome = onSubmitInterview(item, payload);
    triggerHaptic(outcome.outcome === 'hired' ? 'success' : 'warning');
    setResult(outcome);
  };

  return (
    <DetailSheet
      open={open}
      onClose={resetAndClose}
      title={t('careerMarket.interviewTitle')}
      subtitle={job.shortTitle}
      zIndexClass="z-[58]"
    >
      {result ? (
        <Card className="space-y-4" data-testid="interview-result-card">
          <div className="flex items-center gap-3">
            <JobIconTile iconKey={job.iconKey} size="lg" />
            <div>
              <div
                className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${
                  result.outcome === 'hired'
                    ? 'bg-[var(--success)]/15 text-[var(--success)]'
                    : result.outcome === 'waitlist'
                      ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
                      : 'bg-[var(--danger)]/15 text-[var(--danger)]'
                }`}
              >
                {result.outcome === 'hired'
                  ? t('careerMarket.interviewHired')
                  : result.outcome === 'waitlist'
                    ? t('careerMarket.interviewWaitlist')
                    : t('careerMarket.interviewRejected')}
              </div>
              <h3 className="mt-1.5 text-base font-bold text-[var(--text)]">{result.message}</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-2)] p-3 text-xs">
            <div>
              <div className="text-[var(--text-muted)]">شانس نهایی مصاحبه</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">
                {toPersianDigits(result.finalChancePct)}٪
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">تأثیر پاسخ‌های تو</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--primary-strong)]">
                {result.interviewShiftPct > 0 ? '+' : ''}
                {toPersianDigits(result.interviewShiftPct)}٪
              </div>
            </div>
          </div>

          {result.outcome === 'hired' && result.startingMonthlyNet && (
            <div className="rounded-xl border border-[var(--success)]/35 bg-[var(--success)]/10 p-3 text-xs font-bold text-[var(--text)]">
              حقوق خالص آغازین: {formatToman(result.startingMonthlyNet)} / ماه
            </div>
          )}

          <p className="text-sm leading-7 text-[var(--text-muted)]">{result.adviceFa}</p>

          <button
            type="button"
            data-testid="interview-done-btn"
            onClick={resetAndClose}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] hover:bg-[var(--primary-strong)]"
          >
            {t('close')}
          </button>
        </Card>
      ) : stepIndex === 'briefing' ? (
        <Card className="space-y-4" data-testid="interview-briefing-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <JobIconTile iconKey={job.iconKey} />
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">{job.shortTitle}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('careerMarket.interviewBriefing')}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--primary-soft)] px-3 py-2 text-center">
              <div className="text-xs text-[var(--primary-strong)]">شانس پایه</div>
              <div className="text-base font-bold tabular-nums text-[var(--primary-strong)]">
                {toPersianDigits(chanceInfo.baseChancePct)}٪
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl bg-[var(--surface-2)] p-3">
            {chanceInfo.factors.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-[var(--text)]">{f.labelFa}</span>
                <span
                  className={`font-bold tabular-nums ${
                    f.positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}
                >
                  {f.deltaTextFa}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs leading-6 text-[var(--text-muted)]">
            {toPersianDigits(questions.length)} پرسش کوتاه از تو پرسیده می‌شود؛ سبک پاسخ‌گویی‌ات روی شانس نهایی مصاحبه اثر می‌گذارد.
          </p>

          <button
            type="button"
            data-testid="interview-begin-btn"
            onClick={() => {
              triggerHaptic('light');
              setStepIndex(0);
            }}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] hover:bg-[var(--primary-strong)]"
          >
            {t('careerMarket.interviewBegin')}
          </button>
        </Card>
      ) : currentQuestion ? (
        <div className="space-y-4" data-testid="interview-question-card">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
            <span>
              پرسش {toPersianDigits(stepIndex + 1)} از {toPersianDigits(questions.length)}
            </span>
            <span>{job.shortTitle}</span>
          </div>

          <Card className="space-y-3">
            <h3 className="text-sm font-bold leading-7 text-[var(--text)]">
              {currentQuestion.promptFa}
            </h3>

            <div className="space-y-2">
              {currentQuestion.answers.map((ans) => {
                const selected = pickedAnswer?.id === ans.id;
                return (
                  <button
                    key={ans.id}
                    type="button"
                    disabled={Boolean(pickedAnswer)}
                    onClick={() => {
                      triggerHaptic('light');
                      setPickedByQid((prev) => ({
                        ...prev,
                        [currentQuestion.id]: ans,
                      }));
                    }}
                    className={`flex min-h-[48px] w-full flex-col items-start gap-1 rounded-2xl border p-3 text-right transition-colors ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]/55 text-[var(--text)]'
                        : pickedAnswer
                          ? 'border-[var(--border)] bg-[var(--surface-2)]/40 text-[var(--text-muted)] opacity-70'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-xs font-bold text-[var(--primary-strong)]">
                      {ans.styleLabelFa}
                    </span>
                    <span className="text-xs leading-6 font-medium">{ans.labelFa}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {pickedAnswer && (
            <Card tinted className="space-y-3" data-testid="interview-reaction-card">
              <p className="text-xs leading-6 text-[var(--text)]">{pickedAnswer.reactionFa}</p>
              <button
                type="button"
                data-testid="interview-next-btn"
                onClick={() => {
                  triggerHaptic('medium');
                  if (stepIndex + 1 < questions.length) {
                    setStepIndex(stepIndex + 1);
                  } else {
                    handleFinish();
                  }
                }}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] hover:bg-[var(--primary-strong)]"
              >
                {stepIndex + 1 < questions.length
                  ? t('careerMarket.interviewNext')
                  : t('careerMarket.interviewFinish')}
              </button>
            </Card>
          )}
        </div>
      ) : null}
    </DetailSheet>
  );
}
