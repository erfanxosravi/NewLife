import { toPersianDigits } from '../../engine/jalali';
import type { CurrencyExposureSlice } from '../../engine/ledger';
import type { DisplayCurrencyMode } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import { IconWarning } from '../icons';
import { useMoneyContext } from './MoneyContext';
import { MoneyText } from './MoneyText';
import { SegmentedControl } from './Primitives';

interface CurrencyExposureCardProps {
  displayMode: DisplayCurrencyMode;
  onChangeDisplayMode: (mode: DisplayCurrencyMode) => void;
  slices: CurrencyExposureSlice[];
  performance: {
    hasComparison: boolean;
    nominalReturnPct: number;
    realReturnPct: number;
    vsUsdBenchmarkPct: number;
    vsGoldBenchmarkPct: number;
    summaryFa: string;
  };
  warnings: {
    currencyCode: string;
    titleFa: string;
    bodyFa: string;
    annualRealLossPct: number;
  }[];
  onOpenFxDrawer: () => void;
}

export function CurrencyExposureCard({
  displayMode,
  onChangeDisplayMode,
  slices,
  performance,
  warnings,
  onOpenFxDrawer,
}: CurrencyExposureCardProps) {
  const { t } = useI18n();
  const moneyCtx = useMoneyContext();
  const radius = 32;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  let cumulativePct = 0;
  const segments = slices.slice(0, 5).map((s) => {
    const startPct = cumulativePct;
    cumulativePct += s.sharePct;
    const len = (s.sharePct / 100) * circumference;
    const offset = -(startPct / 100) * circumference;
    return {
      ...s,
      len,
      offset,
    };
  });

  const formatSignedPct = (val: number) => {
    const absStr = toPersianDigits(Math.abs(Math.round(val)).toString());
    return val > 0 ? `+${absStr}٪` : val < 0 ? `-${absStr}٪` : '۰٪';
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold leading-snug text-[var(--text)]">
            {t('currencySwitch.exposureTitle')}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            تنوع کیف‌پول‌ها، نرخ تبدیل و مقایسه با تورم
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {moneyCtx.onOpenCalculator && (
            <button
              type="button"
              onClick={() => moneyCtx.onOpenCalculator?.({ fromCurrency: 'EUR', toCurrency: 'IRT' })}
              className="min-h-[36px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--primary)]"
            >
              ماشین‌حساب ارز
            </button>
          )}
          <button
            type="button"
            onClick={onOpenFxDrawer}
            className="min-h-[36px] rounded-xl border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-2.5 text-xs font-bold text-[var(--primary-strong)] transition-colors hover:border-[var(--primary)]"
          >
            تبدیل و حواله
          </button>
        </div>
      </div>

      {/* Display currency switch */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-[var(--text-muted)]">
          {t('currencySwitch.label')}
        </div>
        <SegmentedControl<DisplayCurrencyMode>
          value={displayMode}
          onChange={onChangeDisplayMode}
          items={[
            { value: 'local', label: t('currencySwitch.local') },
            { value: 'IRT', label: t('currencySwitch.toman') },
            { value: 'USD', label: t('currencySwitch.usd') },
          ]}
        />
      </div>

      {/* SVG Donut + Legend */}
      {slices.length > 0 && (
        <div className="flex items-center gap-3.5 rounded-2xl bg-[var(--surface-2)] p-3">
          <div className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 84 84" width="84" height="84" className="-rotate-90" aria-hidden="true">
              <circle
                cx="42"
                cy="42"
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
                opacity="0.35"
              />
              {segments.map((seg) => (
                <circle
                  key={seg.currencyCode}
                  cx="42"
                  cy="42"
                  r={radius}
                  fill="none"
                  stroke={seg.colorHex}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${Math.max(1, seg.len)} ${circumference}`}
                  strokeDashoffset={seg.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold tabular-nums text-[var(--text)]">
                {toPersianDigits(slices[0].sharePct)}٪
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {slices[0].shortNameFa}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {slices.slice(0, 4).map((slice) => (
              <div key={slice.currencyCode} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.colorHex }}
                  />
                  <span className="font-bold text-[var(--text)]">{slice.shortNameFa}</span>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {toPersianDigits(slice.sharePct)}٪
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                  <MoneyText
                    amount={slice.nativeAmount}
                    currency={slice.currencyCode}
                    mode="inline"
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real return & counterfactual benchmark */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-center">
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-muted)]">بازده واقعی امسال</div>
          <div
            className={`mt-0.5 text-xs font-bold tabular-nums ${
              performance.realReturnPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}
          >
            <bdi dir="rtl">
              {performance.hasComparison ? formatSignedPct(performance.realReturnPct) : 'سال نخست'}
            </bdi>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-muted)]">نسبت به نگهداری دلار</div>
          <div
            className={`mt-0.5 text-xs font-bold tabular-nums ${
              performance.vsUsdBenchmarkPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}
          >
            <bdi dir="rtl">
              {performance.hasComparison ? formatSignedPct(performance.vsUsdBenchmarkPct) : '—'}
            </bdi>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-muted)]">نسبت به نگهداری طلا</div>
          <div
            className={`mt-0.5 text-xs font-bold tabular-nums ${
              performance.vsGoldBenchmarkPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}
          >
            <bdi dir="rtl">
              {performance.hasComparison ? formatSignedPct(performance.vsGoldBenchmarkPct) : '—'}
            </bdi>
          </div>
        </div>
      </div>

      {/* Savings Erosion Warnings */}
      {warnings.slice(0, 1).map((w) => (
        <div
          key={w.currencyCode}
          className="flex items-start gap-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-right"
        >
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          <div className="min-w-0 text-xs leading-relaxed text-[var(--text)]">
            <span className="font-bold">{w.titleFa}: </span>
            <span className="text-[var(--text-muted)]">{w.bodyFa}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
