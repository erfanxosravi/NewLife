import { gameDataset } from '../../../data/registry';
import { compareCountries } from '../../../engine/emigration';
import { toPersianDigits } from '../../../engine/jalali';
import type { GameState } from '../../../engine/types';
import { MoneyText } from '../MoneyText';
import { CountryFlag } from '../flags/CountryFlag';
import { Badge, DetailSheet, EmptyState, SectionGroup } from '../Primitives';
import { COMPARE_SERIES_COLORS } from '../jobCompass/FingerprintRadar';

interface CountryCompareModalProps {
  open: boolean;
  countryIds: string[];
  state: GameState;
  onClose: () => void;
  onSelectCountry?: (countryId: string) => void;
}

const AXES: { key: keyof ReturnType<typeof compareCountries>[number]['radarScores']; labelFa: string }[] = [
  { key: 'netIncome', labelFa: 'درآمد خالص' },
  { key: 'affordability', labelFa: 'قدرت پس‌انداز' },
  { key: 'easeOfEntry', labelFa: 'سهولت ورود' },
  { key: 'macroStability', labelFa: 'ثبات ارز' },
  { key: 'credentialFit', labelFa: 'تطبیق مدرک' },
];

function polarPoint(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function CountryCompareModal({
  open,
  countryIds,
  state,
  onClose,
  onSelectCountry,
}: CountryCompareModalProps) {
  const columns = compareCountries(countryIds, state, gameDataset);

  const size = 248;
  const cx = size / 2;
  const cy = size / 2 + 2;
  const maxR = size * 0.3;
  const levels = [25, 50, 75, 100];
  const startAngle = -Math.PI / 2;
  const axisAngles = AXES.map((_, i) => startAngle + (i * 2 * Math.PI) / AXES.length);

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title="مقایسه کشورهای مقصد"
      subtitle={`تحلیل هم‌زمان تا ${toPersianDigits(Math.max(1, columns.length))} مقصد از نظر درآمد، هزینه و سختی مسیر`}
      zIndexClass="z-[58]"
    >
      {columns.length === 0 ? (
        <EmptyState
          title="کشوری برای مقایسه انتخاب نشده"
          description="از فهرست مقاصد تا ۳ کشور را برای مقایسه علامت بزن."
        />
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <h3 className="mb-2 text-xs font-bold text-[var(--text)]">نمودار پنج‌محوری تناسب مقصد</h3>
            <div className="flex flex-col items-center gap-2.5">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full max-w-[260px] overflow-visible"
                role="img"
                aria-label="نمودار مقایسه کشورهای مقصد"
              >
                {levels.map((lvl) => {
                  const pts = axisAngles
                    .map((angle) => {
                      const p = polarPoint(cx, cy, (lvl / 100) * maxR, angle);
                      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polygon
                      key={lvl}
                      points={pts}
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth={lvl === 100 ? '1.2' : '0.85'}
                      strokeDasharray={lvl === 50 ? '3 3' : undefined}
                    />
                  );
                })}
                {axisAngles.map((angle, idx) => {
                  const outer = polarPoint(cx, cy, maxR, angle);
                  return (
                    <line
                      key={AXES[idx].key}
                      x1={cx}
                      y1={cy}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                  );
                })}
                {columns.map((col, idx) => {
                  const color = COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length];
                  const pts = AXES.map((axis, aIdx) => {
                    const val = Math.max(10, Math.min(100, col.radarScores[axis.key]));
                    const pt = polarPoint(cx, cy, (val / 100) * maxR, axisAngles[aIdx]);
                    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={col.countryId}
                      points={pts}
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth="2.1"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {AXES.map((axis, idx) => {
                  const pt = polarPoint(cx, cy, maxR + 24, axisAngles[idx]);
                  return (
                    <text
                      key={axis.key}
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--text)"
                      fontSize="12"
                      fontWeight="700"
                    >
                      {axis.labelFa}
                    </text>
                  );
                })}
              </svg>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {columns.map((col, idx) => {
                  const color = COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length];
                  return (
                    <div
                      key={col.countryId}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]"
                    >
                      <span
                        className="inline-block h-2.5 w-3.5 rounded-full"
                        style={{ backgroundColor: color.stroke }}
                      />
                      <CountryFlag countryId={col.countryId} size="xs" />
                      <span>{col.nameFa}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <SectionGroup title="جدول مقایسه شاخص‌های کلیدی">
            {columns.map((col) => {
              const surplusLocal = col.monthlyNetMedianLocal - col.monthlyBudgetLocal;
              return (
                <div
                  key={col.countryId}
                  className="space-y-2.5 p-3.5 text-right"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CountryFlag countryId={col.countryId} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--text)]">
                          {col.nameFa}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          سختی پذیرش: {toPersianDigits(col.totalDifficulty)}٪ · تورم: {toPersianDigits(col.inflationPct)}٪
                        </div>
                      </div>
                    </div>
                    <Badge tone={col.needsRelicensing ? 'warning' : 'success'}>
                      {col.needsRelicensing ? 'نیاز به تطبیق مدرک' : 'تطبیق مستقیم'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">میانه حقوق ماهانه</div>
                      <div className="mt-0.5">
                        <MoneyText
                          amount={col.monthlyNetMedianLocal}
                          currency={col.currencyCode}
                          mode="stacked"
                          stateOverride={state}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">هزینه ماهانه</div>
                      <div className="mt-0.5">
                        <MoneyText
                          amount={col.monthlyBudgetLocal}
                          currency={col.currencyCode}
                          mode="stacked"
                          stateOverride={state}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">تراز تقریبی</div>
                      <div className="mt-0.5">
                        <MoneyText
                          amount={surplusLocal}
                          currency={col.currencyCode}
                          mode="stacked"
                          showSign
                          stateOverride={state}
                          primaryClassName={
                            surplusLocal >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>زمان معمول تا اقامت دائم: {toPersianDigits(col.permanentYears)} سال</span>
                    {onSelectCountry && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectCountry(col.countryId);
                        }}
                        className="min-h-[36px] rounded-xl border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
                      >
                        مشاهده پرونده
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </SectionGroup>
        </div>
      )}
    </DetailSheet>
  );
}
