import { toPersianDigits } from '../../../engine/jalali';
import { JOB_COMPASS_AXES } from '../../../engine/jobCompass';
import type { JobCompassAxis, JobCompassPriorities } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import { triggerHaptic } from '../../../utils/haptics';
import { IconReset } from '../../icons';
import { BottomSheet } from '../BottomSheet';
import { EmojiSprite } from './JobIcons';

export function PriorityStrip({
  priorities,
  customized,
  onOpenEditor,
}: {
  priorities: JobCompassPriorities;
  customized: boolean;
  onOpenEditor: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      data-testid="priority-strip"
      onClick={() => {
        triggerHaptic('light');
        onOpenEditor();
      }}
      className="flex min-h-[48px] w-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-right transition-colors hover:border-[var(--primary)] active:bg-[var(--surface-2)]"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm font-bold text-[var(--text)]">
          {t('careerMarket.whatsImportant')}
        </span>
        <span className="rounded-lg bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-bold text-[var(--primary-strong)]">
          {customized ? t('careerMarket.priorityCustom') : t('careerMarket.priorityAuto')}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {JOB_COMPASS_AXES.map((axis) => {
          const level = priorities[axis.key];
          return (
            <span
              key={axis.key}
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs font-medium ${
                level >= 2
                  ? 'border-[var(--primary)]/40 bg-[var(--primary-soft)]/55 font-bold text-[var(--text)]'
                  : level === 0
                    ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-65'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              <EmojiSprite emoji={axis.icon} label={axis.labelFa} className="text-xs" />
              <span>{axis.shortFa}</span>
              <span className="tabular-nums text-[var(--primary-strong)]">
                {toPersianDigits(level)}★
              </span>
            </span>
          );
        })}
      </div>
    </button>
  );
}

const AXIS_HINTS: Record<JobCompassAxis, string> = {
  income: 'اولویت به حقوق و مزایای نقدی بالاتر در مقایسه با بازار',
  calm: 'ساعت کاری متعادل، شیفت منظم و استرس روانی کمتر',
  security: 'ثبات قرارداد، بیمه کامل و ریسک پایین بیکاری',
  growth: 'تعداد پله‌های ترفیع، افزایش دستمزد و مسیر کارآفرینی',
  freedom: 'اختیار روی ساعت کار، استقلال عمل و انعطاف',
};

export function PrioritySheet({
  open,
  priorities,
  customized,
  onClose,
  onChange,
  onReset,
}: {
  open: boolean;
  priorities: JobCompassPriorities;
  customized: boolean;
  onClose: () => void;
  onChange: (next: JobCompassPriorities) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();

  const updateAxis = (axis: JobCompassAxis, value: number) => {
    triggerHaptic('light');
    onChange({
      ...priorities,
      [axis]: Math.max(0, Math.min(3, Math.round(value))),
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('careerMarket.priorityTitle')}
      subtitle={t('careerMarket.prioritySubtitle')}
      snap="full"
      zIndexClass="z-[59]"
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {JOB_COMPASS_AXES.map((axis) => {
            const val = priorities[axis.key];
            return (
              <div
                key={axis.key}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <EmojiSprite emoji={axis.icon} label={axis.labelFa} className="text-base" />
                    <span className="text-sm font-bold text-[var(--text)]">{axis.labelFa}</span>
                  </div>
                  <div className="flex items-center gap-1" aria-label={`${toPersianDigits(val)} از ۳ ستاره`}>
                    {[0, 1, 2, 3].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => updateAxis(axis.key, step)}
                        className={`min-h-[44px] min-w-[44px] rounded-xl border px-2 text-xs font-bold tabular-nums transition-colors ${
                          val === step
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {step === 0 ? '۰' : `${toPersianDigits(step)}★`}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  aria-label={axis.labelFa}
                  value={val}
                  onChange={(e) => updateAxis(axis.key, Number(e.target.value))}
                  className="h-2.5 w-full cursor-pointer accent-[var(--primary)]"
                />
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {AXIS_HINTS[axis.key]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={!customized}
            onClick={() => {
              triggerHaptic('medium');
              onReset();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconReset className="h-4 w-4" />
            <span>{t('careerMarket.priorityReset')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)]"
          >
            مشاهده رتبه‌بندی تازه
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
