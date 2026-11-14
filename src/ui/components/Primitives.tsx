import { useEffect, useState, type ReactNode } from 'react';
import { formatAgeLabel, formatToman, toPersianDigits } from '../../engine/jalali';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRtl,
  IconClose,
  IconInfo,
  IconLock,
  IconStar,
  IconWarning,
} from '../icons';
export { DetailSheet, InfoSheet } from './DetailSheet';

export function Card({
  children,
  className = '',
  tinted = false,
  onClick,
  'data-testid': dataTestId,
}: {
  children: ReactNode;
  className?: string;
  tinted?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}) {
  const base = `rounded-2xl border border-[var(--border)] p-3.5 ${
    tinted ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)]'
  } ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        data-testid={dataTestId}
        onClick={onClick}
        className={`${base} w-full text-right transition-colors hover:border-[var(--primary)] active:scale-[0.99]`}
      >
        {children}
      </button>
    );
  }

  return (
    <section data-testid={dataTestId} className={base}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold text-[var(--text)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatBar({
  label,
  value,
  colorVar,
  icon,
  delta,
  compact = false,
}: {
  label: string;
  value: number;
  colorVar: string;
  icon?: ReactNode;
  delta?: number;
  compact?: boolean;
}) {
  const safeVal = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between gap-1 text-xs">
        <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--text)]">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-[10px] font-bold ${
                delta > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
              }`}
            >
              {delta > 0 ? `▲${toPersianDigits(delta)}` : `▼${toPersianDigits(Math.abs(delta))}`}
            </span>
          )}
          <span className="font-bold text-[var(--text)]">{toPersianDigits(safeVal)}٪</span>
        </span>
      </div>
      <div
        className={`w-full overflow-hidden rounded-full bg-[var(--surface-2)] ${
          compact ? 'h-1.5' : 'h-2'
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${safeVal}%`,
            backgroundColor: `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 6,
  label,
  colorVar = '--primary',
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  colorVar?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - ratio);

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
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
          stroke={`var(${colorVar})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums text-[var(--text)]">
        {label ?? toPersianDigits(Math.round(value))}
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning';
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]',
    primary: 'bg-[var(--primary-soft)] text-[var(--primary-strong)] border-transparent',
    success: 'bg-[var(--success)]/12 text-[var(--success)] border-transparent',
    danger: 'bg-[var(--danger)]/12 text-[var(--danger)] border-transparent',
    warning: 'bg-[var(--warning)]/12 text-[var(--warning)] border-transparent',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function Chip({
  label,
  selected = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[38px] shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        selected
          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)] font-bold'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
      }`}
    >
      {label}
    </button>
  );
}

export function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {items.map((item) => (
        <Chip
          key={item.value}
          label={item.label}
          selected={item.value === value}
          onClick={() => onChange(item.value)}
        />
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const dense = items.length >= 5;
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1 no-scrollbar"
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`min-h-[40px] flex-1 rounded-xl py-1.5 whitespace-nowrap transition-all ${
              dense ? 'px-1.5 text-[11px]' : 'px-2.5 text-xs'
            } ${
              active
                ? 'bg-[var(--surface)] font-bold text-[var(--primary-strong)] shadow-xs'
                : 'font-medium text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 text-right">
          <div className="truncate text-sm font-bold text-[var(--text)]">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {onClick && !disabled && (
          <IconChevronRtl className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex min-h-[56px] w-full items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-right transition-colors hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex min-h-[56px] w-full items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
      {content}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-right transition-colors hover:border-[var(--primary)]"
    >
      <div className="min-w-0">
        <div className="text-sm font-bold text-[var(--text)]">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</div>
        )}
      </div>
      <div
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--on-primary)] shadow-xs transition-all ${
            checked ? 'right-6' : 'right-1'
          }`}
        />
      </div>
    </button>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  valueLabel,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  valueLabel?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[var(--text)]">{label}</span>
        <span className="font-bold tabular-nums text-[var(--primary-strong)]">
          {valueLabel ?? toPersianDigits(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--primary)]"
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[360px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-xs font-bold text-[var(--on-primary)] ${
              destructive ? 'bg-[var(--danger)]' : 'bg-[var(--primary)] hover:bg-[var(--primary-strong)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({
  message,
  tone = 'primary',
  visible,
}: {
  message: string;
  tone?: 'primary' | 'success' | 'danger' | 'warning';
  visible: boolean;
}) {
  if (!visible || !message) return null;
  const bgMap: Record<NonNullable<typeof tone>, string> = {
    primary: 'bg-[var(--primary-strong)] text-[var(--on-primary)]',
    success: 'bg-[var(--success)] text-[var(--on-primary)]',
    danger: 'bg-[var(--danger)] text-[var(--on-primary)]',
    warning: 'bg-[var(--warning)] text-[var(--on-primary)]',
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[70] flex justify-center px-4">
      <div
        className={`flex max-w-[420px] items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold shadow-lg ${bgMap[tone]}`}
        role="status"
      >
        <IconCheck className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-strong)]">
          {icon}
        </div>
      )}
      <div className="text-sm font-bold text-[var(--text)]">{title}</div>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Sparkline({
  values,
  colorVar = '--primary',
  height = 36,
}: {
  values: number[];
  colorVar?: string;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-[var(--surface-2)] text-[10px] text-[var(--text-muted)]"
        style={{ height }}
      >
        داده کافی نیست
      </div>
    );
  }

  const width = 180;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((val, i) => {
      const x = (i / (values.length - 1)) * (width - 8) + 4;
      const y = height - 4 - ((val - min) / span) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height }}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={`var(${colorVar})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function CurrencyText({
  amountToman,
  className = '',
  showSign = false,
}: {
  amountToman: number;
  className?: string;
  showSign?: boolean;
}) {
  const prefix = showSign && amountToman > 0 ? '+' : '';
  return (
    <bdi dir="rtl" className={`tabular-nums ${className}`}>
      {prefix}
      {formatToman(amountToman)}
    </bdi>
  );
}

export function AgeBadge({ age, jalaliYear }: { age: number; jalaliYear?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
      <span>{formatAgeLabel(age)}</span>
      {jalaliYear !== undefined && (
        <>
          <span className="opacity-45">|</span>
          <span>{toPersianDigits(jalaliYear)}</span>
        </>
      )}
    </span>
  );
}

export function ActionButton({
  label,
  costText,
  effectHint,
  disabledReason,
  variant = 'primary',
  disabled = false,
  onClick,
  icon,
}: {
  label: string;
  costText?: string;
  effectHint?: string;
  disabledReason?: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'disabled';
  disabled?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const effectiveVariant = disabled || disabledReason ? 'disabled' : variant;
  const styles: Record<'primary' | 'secondary' | 'tertiary' | 'danger' | 'disabled', string> = {
    primary:
      'bg-[var(--primary)] text-[var(--on-primary)] border-transparent hover:bg-[var(--primary-strong)] active:scale-[0.99]',
    secondary:
      'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)]',
    tertiary:
      'bg-transparent text-[var(--primary-strong)] border-transparent hover:bg-[var(--primary-soft)]/55',
    danger:
      'bg-transparent text-[var(--danger)] border-[var(--danger)]/45 hover:bg-[var(--danger)]/10',
    disabled:
      'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] opacity-65 cursor-not-allowed',
  };

  return (
    <button
      type="button"
      disabled={effectiveVariant === 'disabled'}
      onClick={onClick}
      className={`flex min-h-[48px] w-full flex-col items-stretch justify-center rounded-2xl border px-3.5 py-2 text-right transition-all ${styles[effectiveVariant]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold">
          {icon}
          <span>{label}</span>
        </span>
        {costText && (
          <span className="shrink-0 text-[11px] font-bold tabular-nums opacity-95">
            {costText}
          </span>
        )}
      </div>
      {(disabledReason || effectHint) && (
        <div className="mt-0.5 text-[11px] opacity-85">
          {disabledReason ?? effectHint}
        </div>
      )}
    </button>
  );
}

export function LockedNotice({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-xs text-[var(--text-muted)]">
      <IconLock className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
      <span>{message}</span>
    </div>
  );
}

export function VirtualizedList<T>({
  items,
  initialWindow = 50,
  renderItem,
  loadMoreLabel = 'نمایش موارد قدیمی‌تر',
}: {
  items: T[];
  initialWindow?: number;
  renderItem: (item: T, index: number) => ReactNode;
  loadMoreLabel?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(initialWindow);

  useEffect(() => {
    setVisibleCount((prev) => Math.max(initialWindow, prev));
  }, [initialWindow, items.length]);

  const startIndex = Math.max(0, items.length - visibleCount);
  const sliced = items.slice(startIndex);

  return (
    <div className="space-y-2">
      {startIndex > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => prev + initialWindow)}
          className="min-h-[40px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--primary-strong)]"
        >
          {loadMoreLabel} ({toPersianDigits(startIndex)})
        </button>
      )}
      {sliced.map((item, idx) => renderItem(item, startIndex + idx))}
    </div>
  );
}

export type StatusChipStatus = 'waiting' | 'in_progress' | 'locked' | 'done';

const STATUS_CHIP_CONFIG: Record<
  StatusChipStatus,
  { label: string; className: string; icon: ReactNode }
> = {
  waiting: {
    label: 'در انتظار آمادگی',
    className: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]',
    icon: <IconInfo className="h-3 w-3 shrink-0" />,
  },
  in_progress: {
    label: 'در مسیر',
    className: 'bg-[var(--primary-soft)] text-[var(--primary-strong)] border-transparent',
    icon: <IconStar className="h-3 w-3 shrink-0" />,
  },
  locked: {
    label: 'قفل',
    className: 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] opacity-80',
    icon: <IconLock className="h-3 w-3 shrink-0" />,
  },
  done: {
    label: 'انجام‌شده',
    className: 'bg-[var(--success)]/14 text-[var(--success)] border-transparent',
    icon: <IconCheck className="h-3 w-3 shrink-0" />,
  },
};

export function StatusChip({ status }: { status: StatusChipStatus }) {
  const cfg = STATUS_CHIP_CONFIG[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${cfg.className}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

export interface MetricTripletItem {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'danger';
}

export function MetricTriplet({
  items,
  onPrimarySurface = false,
}: {
  items: MetricTripletItem[];
  onPrimarySurface?: boolean;
}) {
  const sliced = items.slice(0, 3);
  const valueToneClass: Record<NonNullable<MetricTripletItem['tone']>, string> = {
    default: onPrimarySurface ? 'text-[var(--on-primary)]' : 'text-[var(--text)]',
    primary: onPrimarySurface ? 'text-[var(--on-primary)]' : 'text-[var(--primary-strong)]',
    success: onPrimarySurface ? 'text-[var(--on-primary)]' : 'text-[var(--success)]',
    danger: onPrimarySurface ? 'text-[var(--on-primary)]' : 'text-[var(--danger)]',
  };

  return (
    <div
      className={`grid gap-2 rounded-2xl p-2.5 ${
        sliced.length === 2 ? 'grid-cols-2' : sliced.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
      } ${onPrimarySurface ? 'bg-black/15' : 'bg-[var(--surface-2)]'}`}
    >
      {sliced.map((item, idx) => (
        <div key={idx} className="min-w-0 text-right">
          <div
            className={`flex items-center gap-1 text-[10px] ${
              onPrimarySurface ? 'opacity-85' : 'text-[var(--text-muted)]'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </div>
          <div
            className={`mt-0.5 truncate text-xs font-bold tabular-nums ${
              valueToneClass[item.tone ?? 'default']
            }`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HubHeroCard({
  icon,
  title,
  subtitle,
  status,
  badge,
  metrics,
  detailsLabel = 'جزئیات',
  onDetails,
  onInfo,
  tone = 'surface',
  testId,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  status?: StatusChipStatus;
  badge?: ReactNode;
  metrics?: MetricTripletItem[];
  detailsLabel?: string;
  onDetails?: () => void;
  onInfo?: () => void;
  tone?: 'surface' | 'primary';
  testId?: string;
}) {
  const isPrimary = tone === 'primary';
  return (
    <section
      data-testid={testId}
      className={`rounded-3xl p-4 space-y-3 ${
        isPrimary
          ? 'bg-gradient-to-bl from-[var(--primary)] to-[var(--primary-strong)] text-[var(--on-primary)] shadow-md'
          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                isPrimary
                  ? 'bg-white/20 text-[var(--on-primary)]'
                  : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold">{title}</h3>
              {onInfo && (
                <button
                  type="button"
                  onClick={onInfo}
                  aria-label="راهنمای بخش"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isPrimary
                      ? 'bg-white/15 text-[var(--on-primary)] hover:bg-white/25'
                      : 'bg-[var(--surface-2)] text-[var(--primary-strong)] hover:bg-[var(--primary-soft)]'
                  }`}
                >
                  <IconInfo className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {subtitle && (
              <p
                className={`mt-0.5 line-clamp-2 text-xs leading-relaxed ${
                  isPrimary ? 'opacity-90' : 'text-[var(--text-muted)]'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status && <StatusChip status={status} />}
          {badge}
          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              className={`inline-flex min-h-[32px] items-center gap-1 rounded-xl px-2.5 text-xs font-bold transition-colors ${
                isPrimary
                  ? 'bg-white/18 text-[var(--on-primary)] hover:bg-white/28'
                  : 'bg-[var(--surface-2)] text-[var(--primary-strong)] hover:bg-[var(--primary-soft)]'
              }`}
            >
              <span>{detailsLabel}</span>
              <IconChevronRtl className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {metrics && metrics.length > 0 && (
        <MetricTriplet items={metrics} onPrimarySurface={isPrimary} />
      )}
    </section>
  );
}

export function SectionGroup({
  title,
  subtitle,
  action,
  onInfo,
  collapsible = false,
  defaultCollapsed = false,
  tone = 'default',
  testId,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onInfo?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  tone?: 'default' | 'danger';
  testId?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isDanger = tone === 'danger';

  return (
    <section className="space-y-1.5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2 px-1">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="flex min-h-[36px] flex-1 items-center justify-between gap-2 text-right"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {isDanger && <IconWarning className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />}
              <h3
                className={`truncate text-xs font-bold ${
                  isDanger ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {title}
              </h3>
            </div>
            <IconChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${
                collapsed ? 'rotate-90' : 'rotate-0'
              }`}
            />
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0">
              <h3 className="truncate text-xs font-bold text-[var(--text-muted)]">{title}</h3>
              {subtitle && (
                <p className="truncate text-[11px] text-[var(--text-muted)] opacity-85">
                  {subtitle}
                </p>
              )}
            </div>
            {onInfo && (
              <button
                type="button"
                onClick={onInfo}
                aria-label={`توضیح ${title}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--primary-strong)] hover:bg-[var(--surface-2)]"
              >
                <IconInfo className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {!collapsible && action && <div className="shrink-0">{action}</div>}
      </div>

      {(!collapsible || !collapsed) && (
        <div
          className={`overflow-hidden rounded-2xl border bg-[var(--surface)] divide-y divide-[var(--border)] ${
            isDanger ? 'border-[var(--danger)]/35' : 'border-[var(--border)]'
          }`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function DangerZoneGroup({
  title = 'گزینه‌های حساس',
  testId,
  children,
}: {
  title?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <SectionGroup
      title={title}
      collapsible
      defaultCollapsed
      tone="danger"
      testId={testId}
    >
      {children}
    </SectionGroup>
  );
}

export type ActionRowState =
  | 'enabled'
  | 'recommended'
  | 'disabled'
  | 'locked'
  | 'done'
  | 'cooldown';

export function ActionRow({
  title,
  subtitle,
  icon,
  emoji,
  iconTone = 'primary',
  state = 'enabled',
  reason,
  value,
  statusChip,
  isNew = false,
  cooldownLabel = 'یک بار در سال',
  ctaLabel,
  showChevron = false,
  variant = 'default',
  onClick,
  testId,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  emoji?: string;
  iconTone?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
  state?: ActionRowState;
  reason?: string;
  value?: ReactNode;
  statusChip?: StatusChipStatus;
  isNew?: boolean;
  cooldownLabel?: string;
  ctaLabel?: string;
  showChevron?: boolean;
  variant?: 'default' | 'danger';
  onClick?: () => void;
  testId?: string;
}) {
  const isBlocked = state === 'disabled' || state === 'locked' || state === 'cooldown';
  const isDone = state === 'done';
  const isRecommended = state === 'recommended';
  const isDanger = variant === 'danger';

  const iconBgMap: Record<NonNullable<typeof iconTone>, string> = {
    primary: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
    neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
    success: 'bg-[var(--success)]/14 text-[var(--success)]',
    warning: 'bg-[var(--warning)]/14 text-[var(--warning)]',
    danger: 'bg-[var(--danger)]/12 text-[var(--danger)]',
  };

  const rowBg = isDanger
    ? 'hover:bg-[var(--danger)]/8'
    : isRecommended
      ? 'bg-[var(--primary-soft)]/35 hover:bg-[var(--primary-soft)]/55'
      : isBlocked
        ? 'bg-[var(--surface-2)]/45 opacity-60 cursor-not-allowed'
        : onClick
          ? 'hover:bg-[var(--surface-2)]/70 active:bg-[var(--surface-2)]'
          : '';

  const effectiveSubtitle = isBlocked && reason ? reason : subtitle;

  const inner = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {(icon || emoji) && (
          <div
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDanger ? iconBgMap.danger : isBlocked ? iconBgMap.neutral : iconBgMap[iconTone]
            }`}
          >
            {icon}
            {emoji && (
              <span
                aria-hidden="true"
                className={
                  icon
                    ? 'absolute -bottom-1 -left-1 text-xs leading-none'
                    : 'text-lg leading-none'
                }
              >
                {emoji}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center gap-1.5">
            <span
              className={`truncate text-sm font-bold ${
                isDanger
                  ? 'text-[var(--danger)]'
                  : isBlocked
                    ? 'text-[var(--text-muted)]'
                    : 'text-[var(--text)]'
              }`}
            >
              {title}
            </span>
            {isRecommended && !isBlocked && (
              <IconStar className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
            )}
            {isNew && (
              <Badge tone="primary">جدید</Badge>
            )}
          </div>
          {effectiveSubtitle && (
            <div
              className={`mt-0.5 truncate text-xs ${
                isBlocked ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {effectiveSubtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {value && !isBlocked && !isDone && (
          <span className="text-xs font-bold tabular-nums text-[var(--text)]">{value}</span>
        )}
        {statusChip && <StatusChip status={statusChip} />}
        {isDone && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--success)]">
            <IconCheck className="h-4 w-4" />
            <span>انجام‌شده</span>
          </span>
        )}
        {state === 'cooldown' && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
            <ProgressRing value={1} max={1} size={22} strokeWidth={2.5} label="۱" colorVar="--text-muted" />
            <span className="hidden sm:inline">{cooldownLabel}</span>
          </div>
        )}
        {(state === 'disabled' || state === 'locked') && (
          <IconLock className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        )}
        {ctaLabel && !isBlocked && !isDone && (
          <span
            className={`rounded-xl border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
              isDanger
                ? 'border-[var(--danger)]/45 text-[var(--danger)]'
                : isRecommended
                  ? 'border-transparent bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
            }`}
          >
            {ctaLabel}
          </span>
        )}
        {showChevron && !isBlocked && (
          <IconChevronRtl className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={isBlocked}
        onClick={onClick}
        className={`flex min-h-[56px] w-full items-center px-3.5 py-2.5 text-right transition-colors ${rowBg}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      data-testid={testId}
      className={`flex min-h-[56px] w-full items-center px-3.5 py-2.5 text-right ${rowBg}`}
    >
      {inner}
    </div>
  );
}

export interface ProgressStepperStep {
  id: string;
  title: string;
  subtitle?: string;
  status: 'done' | 'current' | 'upcoming' | 'locked';
}

export function ProgressStepper({
  steps,
  orientation = 'vertical',
}: {
  steps: ProgressStepperStep[];
  orientation?: 'vertical' | 'horizontal';
}) {
  if (orientation === 'horizontal') {
    return (
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))` }}>
        {steps.map((step, idx) => {
          const isDone = step.status === 'done';
          const isCurrent = step.status === 'current';
          const isLocked = step.status === 'locked';
          return (
            <div
              key={step.id}
              className={`rounded-xl border px-1.5 py-2 text-center text-[11px] transition-colors ${
                isDone
                  ? 'border-[var(--success)]/45 bg-[var(--success)]/12 text-[var(--success)]'
                  : isCurrent
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)] font-bold'
                    : isLocked
                      ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] opacity-60'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
              }`}
            >
              <div className="font-bold tabular-nums">
                {isDone ? '✓' : toPersianDigits(idx + 1)}
              </div>
              <div className="mt-0.5 truncate font-bold">{step.title}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const isDone = step.status === 'done';
        const isCurrent = step.status === 'current';
        const isLast = idx === steps.length - 1;
        return (
          <div key={step.id} className="relative flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                  isDone
                    ? 'border-[var(--success)] bg-[var(--success)] text-[var(--on-primary)]'
                    : isCurrent
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
                }`}
              >
                {isDone ? '✓' : toPersianDigits(idx + 1)}
              </span>
              {!isLast && <span className="my-1 h-5 w-px bg-[var(--border)]" />}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-3'}`}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate text-xs font-bold ${
                    isCurrent
                      ? 'text-[var(--primary-strong)]'
                      : isDone
                        ? 'text-[var(--text)]'
                        : 'text-[var(--text-muted)]'
                  }`}
                >
                  {step.title}
                </span>
                {isCurrent && <StatusChip status="in_progress" />}
                {isDone && <StatusChip status="done" />}
              </div>
              {step.subtitle && (
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{step.subtitle}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface RequirementItem {
  id: string;
  label: string;
  met: boolean;
  currentText?: string;
  requiredText?: string;
  fixHint?: string;
}

export function RequirementsChecklist({
  title,
  items,
}: {
  title?: string;
  items: RequirementItem[];
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      {title && <div className="text-xs font-bold text-[var(--text)]">{title}</div>}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-xl bg-[var(--surface)] px-2.5 py-2 text-xs"
          >
            <div className="flex min-w-0 items-start gap-2">
              {item.met ? (
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
              ) : (
                <IconClose className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
              )}
              <div className="min-w-0">
                <div
                  className={`font-bold ${
                    item.met ? 'text-[var(--text)]' : 'text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </div>
                {!item.met && item.fixHint && (
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.fixHint}</div>
                )}
              </div>
            </div>
            {(item.currentText || item.requiredText) && (
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                {item.currentText && item.requiredText
                  ? `${item.currentText} / ${item.requiredText}`
                  : item.requiredText ?? item.currentText}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
