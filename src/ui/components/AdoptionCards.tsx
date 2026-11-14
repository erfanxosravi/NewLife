import type { ReactNode } from 'react';
import { formatAgeLabel, toPersianDigits } from '../../engine/jalali';
import type { AdoptionInspectorVisit, Gender, InspectorOutcome } from '../../engine/types';
import { IconCheck, IconLock, IconShield } from '../icons';
import { MoneyText } from './MoneyText';
import { PersonAvatar } from './PersonAvatar';
import { Badge } from './Primitives';

export interface ChecklistCardItem {
  id: string;
  title: string;
  subtitle?: string;
  done: boolean;
  valueText?: ReactNode;
  ctaLabel?: string;
  disabled?: boolean;
  reason?: string;
  onAction?: () => void;
}

export function ChecklistCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: ChecklistCardItem[];
}) {
  const completedCount = items.filter((i) => i.done).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]/55 px-3.5 py-2.5">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-[var(--text)]">{title}</h4>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
          {toPersianDigits(completedCount)} از {toPersianDigits(items.length)}
        </span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex min-h-[56px] items-center justify-between gap-3 px-3.5 py-2.5"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                  item.done
                    ? 'bg-[var(--success)]/14 text-[var(--success)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {item.done ? (
                  <IconCheck className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-2 w-2 rounded-full border border-current" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold ${
                    item.done ? 'text-[var(--text)]' : 'text-[var(--text)]'
                  }`}
                >
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                    {item.subtitle}
                  </div>
                )}
                {item.reason && !item.done && (
                  <div className="mt-0.5 text-xs font-medium text-[var(--warning)]">
                    {item.reason}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {item.valueText && !item.done && (
                <span className="text-xs font-bold tabular-nums text-[var(--text-muted)]">
                  {item.valueText}
                </span>
              )}
              {item.done ? (
                <span className="text-xs font-bold text-[var(--success)]">تکمیل</span>
              ) : item.onAction ? (
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={item.onAction}
                  className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl border px-3 text-xs font-bold transition-colors ${
                    item.disabled
                      ? 'cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-60'
                      : 'border-transparent bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-strong)]'
                  }`}
                >
                  {item.disabled && <IconLock className="h-3 w-3" />}
                  <span>{item.ctaLabel ?? 'ثبت'}</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const OUTCOME_BADGE_MAP: Record<
  InspectorOutcome,
  { label: string; tone: 'success' | 'primary' | 'warning' | 'danger' }
> = {
  great: { label: 'عالی', tone: 'success' },
  satisfactory: { label: 'قابل قبول', tone: 'primary' },
  needs_improvement: { label: 'نیازمند بهبود', tone: 'warning' },
  serious_concern: { label: 'نیازمند پیگیری جدی', tone: 'danger' },
};

export function InspectorVisitCard({
  visit,
  inspectorGender,
  playerMoneyToman,
  onCompleteTask,
}: {
  visit: AdoptionInspectorVisit;
  inspectorGender?: Gender;
  playerMoneyToman?: number;
  onCompleteTask?: (visitId: string, taskId: string) => void;
}) {
  const outcomeCfg = OUTCOME_BADGE_MAP[visit.outcome];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar
            seed={visit.inspectorAvatarSeed}
            gender={inspectorGender ?? 'female'}
            age={36}
            size={42}
            originKind="inspector"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <IconShield className="h-3.5 w-3.5 shrink-0 text-[var(--primary-strong)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                {visit.inspectorNameFa}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              ناظر بهزیستی · سال {toPersianDigits(visit.jalaliYear)} · {visit.childNameFa} ({formatAgeLabel(visit.childAge)})
            </div>
          </div>
        </div>
        <Badge tone={outcomeCfg.tone}>{outcomeCfg.label}</Badge>
      </div>

      <p className="rounded-xl bg-[var(--surface-2)]/70 px-3 py-2 text-xs leading-relaxed text-[var(--text)]">
        {visit.summaryFa}
      </p>

      {visit.tasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[var(--text-muted)]">
            توصیه‌ها و تکالیف حمایتی تا بازدید بعدی:
          </div>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {visit.tasks.map((task) => {
              const cannotAfford =
                playerMoneyToman !== undefined && playerMoneyToman < task.costToman;
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2.5 bg-[var(--surface)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--text)]">{task.titleFa}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {task.descriptionFa}
                    </div>
                  </div>
                  {task.completed ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--success)]">
                      <IconCheck className="h-3.5 w-3.5" />
                      <span>انجام شد</span>
                    </span>
                  ) : onCompleteTask ? (
                    <button
                      type="button"
                      disabled={cannotAfford}
                      onClick={() => onCompleteTask(visit.id, task.id)}
                      className={`inline-flex shrink-0 min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs font-bold transition-colors ${
                        cannotAfford
                          ? 'cursor-not-allowed border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-60'
                          : 'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-strong)]'
                      }`}
                    >
                      <MoneyText amount={task.costToman} currency="IRT" mode="inline" interactive={false} />
                      <span>· اجرا</span>
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--text-muted)]">
                      <MoneyText amount={task.costToman} currency="IRT" mode="inline" interactive={false} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
