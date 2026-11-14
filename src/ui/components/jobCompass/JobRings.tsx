import { toPersianDigits } from '../../../engine/jalali';
import { IconLock } from '../../icons';

export function MatchRing({
  score,
  size = 36,
  muted = false,
}: {
  score: number;
  size?: number;
  muted?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const strokeColor = muted
    ? 'var(--text-muted)'
    : clamped >= 75
      ? 'var(--success)'
      : clamped >= 55
        ? 'var(--primary)'
        : 'var(--warning)';

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`تطابق ${toPersianDigits(clamped)} درصد`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-xs font-bold leading-none tabular-nums text-[var(--text)]">
        {toPersianDigits(clamped)}
      </span>
    </div>
  );
}

export function ReadinessRing({
  score,
  size = 36,
}: {
  score: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center opacity-80"
      style={{ width: size, height: size }}
      aria-label={`آمادگی ${toPersianDigits(clamped)} درصد — نیازمند تکمیل پیش‌نیاز`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <IconLock className="absolute h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
    </div>
  );
}
