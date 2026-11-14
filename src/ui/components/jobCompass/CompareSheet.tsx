import type { ReactNode } from 'react';
import { toPersianDigits } from '../../../engine/jalali';
import type { JobMarketItem } from '../../../engine/jobCompass';
import { useI18n } from '../../../i18n/useI18n';
import { MoneyText } from '../MoneyText';
import { Card, DetailSheet } from '../Primitives';
import { JobIconTile } from './JobIcons';
import { COMPARE_SERIES_COLORS, FingerprintRadar } from './FingerprintRadar';

export function CompareSheet({
  open,
  items,
  salaryUnit,
  onClose,
  onOpenJobDetail,
}: {
  open: boolean;
  items: JobMarketItem[];
  salaryUnit: 'monthly' | 'annual';
  onClose: () => void;
  onOpenJobDetail: (item: JobMarketItem) => void;
}) {
  const { t } = useI18n();
  const unitText = salaryUnit === 'annual' ? '/ سال' : '/ ماه';

  const metrics: {
    id: string;
    labelFa: string;
    getValue: (item: JobMarketItem) => ReactNode;
  }[] = [
    {
      id: 'pay',
      labelFa: `خالص ${salaryUnit === 'annual' ? 'سالانه' : 'ماهانه'}`,
      getValue: (item) => {
        const amt =
          salaryUnit === 'annual' ? item.salary.expectedAnnualNet : item.salary.expectedMonthlyNet;
        return (
          <span className="inline-flex flex-wrap items-baseline gap-1">
            <MoneyText amount={amt} currency="IRT" mode="single" compact />
            <span>{unitText}</span>
          </span>
        );
      },
    },
    {
      id: 'match',
      labelFa: 'تطابق با تو',
      getValue: (item) => `${toPersianDigits(item.match.score)}٪`,
    },
    {
      id: 'readiness',
      labelFa: 'آمادگی ورود',
      getValue: (item) =>
        item.readiness.eligible ? 'آماده' : `${toPersianDigits(item.readiness.score)}٪`,
    },
    {
      id: 'hours',
      labelFa: 'ساعت کار هفتگی',
      getValue: (item) => `${toPersianDigits(item.job.weeklyHours)} ساعت`,
    },
    {
      id: 'stress',
      labelFa: 'استرس',
      getValue: (item) => `${toPersianDigits(item.job.stress)}٪`,
    },
    {
      id: 'ladder',
      labelFa: 'پله‌های ارتقا',
      getValue: (item) =>
        item.job.noPromotions
          ? 'تک‌سطحی'
          : `${toPersianDigits(item.job.ladder.length)} پله (${toPersianDigits(item.job.ladder[item.job.ladder.length - 1].salaryMultiplier)}×)`,
    },
  ];

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title={t('careerMarket.compare')}
      subtitle={`${toPersianDigits(items.length)} شغل انتخاب‌شده`}
      zIndexClass="z-[57]"
    >
      {items.length >= 2 ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <h4 className="text-sm font-bold text-[var(--text)]">
              مقایسه پنج‌محوری مشاغل
            </h4>
            <FingerprintRadar
              series={items.map((item, idx) => ({
                id: item.job.id,
                labelFa: item.job.shortTitle,
                values: item.fingerprint,
                stroke: COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length].stroke,
                fill: COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length].fill,
              }))}
            />
          </Card>

          <Card className="space-y-3">
            <h4 className="text-sm font-bold text-[var(--text)]">جدول مقایسه کلیدی</h4>
            <div className="space-y-2.5">
              {metrics.map((metric) => (
                <div
                  key={metric.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-2.5 space-y-1.5"
                >
                  <div className="text-xs font-bold text-[var(--text-muted)]">
                    {metric.labelFa}
                  </div>
                  <div
                    className={`grid gap-2 ${
                      items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    {items.map((item, idx) => (
                      <div
                        key={`${metric.id}-${item.job.id}`}
                        className="min-w-0 rounded-lg bg-[var(--surface)] p-2 text-right"
                      >
                        <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length].stroke,
                            }}
                          />
                          <span className="leading-tight break-words">{item.job.shortTitle}</span>
                        </div>
                        <div className="mt-1 text-xs font-bold tabular-nums text-[var(--text)]">
                          {metric.getValue(item)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={`go-${item.job.id}`}
                type="button"
                onClick={() => onOpenJobDetail(item)}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-right hover:border-[var(--primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <JobIconTile iconKey={item.job.iconKey} talentMatched={item.match.talentMatched} />
                  <span className="text-sm font-bold text-[var(--text)]">{item.job.shortTitle}</span>
                </div>
                <span className="text-xs font-bold text-[var(--primary-strong)]">
                  باز کردن جزئیات
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-[var(--text-muted)]">{t('careerMarket.comparePickHint')}</p>
        </Card>
      )}
    </DetailSheet>
  );
}
