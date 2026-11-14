import { toPersianDigits } from '../../../engine/jalali';
import { JOB_COMPASS_AXES } from '../../../engine/jobCompass';
import type { JobCompassAxis, JobCompassPriorities } from '../../../engine/types';

export interface RadarSeries {
  id: string;
  labelFa: string;
  values: Record<JobCompassAxis, number>;
  stroke: string;
  fill: string;
  dashed?: boolean;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function prioritiesToRadarValues(
  priorities: JobCompassPriorities,
): Record<JobCompassAxis, number> {
  return {
    income: Math.round((priorities.income / 3) * 100),
    calm: Math.round((priorities.calm / 3) * 100),
    security: Math.round((priorities.security / 3) * 100),
    growth: Math.round((priorities.growth / 3) * 100),
    freedom: Math.round((priorities.freedom / 3) * 100),
  };
}

export const COMPARE_SERIES_COLORS = [
  { stroke: '#F97316', fill: 'rgba(249, 115, 22, 0.22)' },
  { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.18)' },
  { stroke: '#14B8A6', fill: 'rgba(20, 184, 166, 0.18)' },
];

export function FingerprintRadar({
  series,
  size = 248,
}: {
  series: RadarSeries[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2 + 2;
  const maxR = size * 0.31;
  const levels = [25, 50, 75, 100];
  const axes = JOB_COMPASS_AXES;
  const startAngle = -Math.PI / 2;

  const axisAngles = axes.map((_, i) => startAngle + (i * 2 * Math.PI) / axes.length);

  const buildPolygonPoints = (values: Record<JobCompassAxis, number>) =>
    axes
      .map((axis, i) => {
        const val = Math.max(8, Math.min(100, values[axis.key] ?? 0));
        const r = (val / 100) * maxR;
        const pt = polarToCartesian(cx, cy, r, axisAngles[i]);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[268px] overflow-visible"
        role="img"
        aria-label="نمودار پنج‌محوری تناسب شغلی"
      >
        {/* Concentric pentagon grid */}
        {levels.map((lvl) => {
          const pts = axisAngles
            .map((angle) => {
              const p = polarToCartesian(cx, cy, (lvl / 100) * maxR, angle);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke="var(--border)"
              strokeWidth={lvl === 100 ? '1.3' : '0.9'}
              strokeDasharray={lvl === 50 ? '3 3' : undefined}
            />
          );
        })}

        {/* Axis spokes */}
        {axisAngles.map((angle, i) => {
          const outer = polarToCartesian(cx, cy, maxR, angle);
          return (
            <line
              key={axes[i].key}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--border)"
              strokeWidth="1"
            />
          );
        })}

        {/* Polygons */}
        {series.map((s) => (
          <g key={s.id}>
            <polygon
              points={buildPolygonPoints(s.values)}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth={s.dashed ? '2' : '2.2'}
              strokeDasharray={s.dashed ? '5 3' : undefined}
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
            {!s.dashed &&
              axes.map((axis, i) => {
                const val = Math.max(8, Math.min(100, s.values[axis.key] ?? 0));
                const pt = polarToCartesian(cx, cy, (val / 100) * maxR, axisAngles[i]);
                return (
                  <circle
                    key={`${s.id}-${axis.key}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.2"
                    fill={s.stroke}
                    stroke="var(--surface)"
                    strokeWidth="1.2"
                  />
                );
              })}
          </g>
        ))}

        {/* Axis labels (12px font minimum) */}
        {axes.map((axis, i) => {
          const labelR = maxR + 24;
          const pt = polarToCartesian(cx, cy, labelR, axisAngles[i]);
          const primaryVal = series[0]?.values[axis.key];
          return (
            <text
              key={`lbl-${axis.key}`}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text)"
              fontSize="12"
              fontWeight="700"
            >
              {axis.shortFa}
              {series.length <= 2 && primaryVal !== undefined
                ? ` (${toPersianDigits(Math.round(primaryVal))})`
                : ''}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {series.map((s) => (
          <div key={`leg-${s.id}`} className="flex items-center gap-1.5 text-xs font-medium text-[var(--text)]">
            <span
              className="inline-block h-2.5 w-4 rounded-full"
              style={{
                backgroundColor: s.dashed ? 'transparent' : s.stroke,
                border: s.dashed ? `2px dashed ${s.stroke}` : undefined,
              }}
            />
            <span>{s.labelFa}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
