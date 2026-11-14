import { useEffect, useState, type ReactNode } from 'react';
import { formatAgeLabel, formatToman, toPersianDigits } from '../../engine/jalali';
import { IconCheck, IconChevronRtl, IconLock } from '../icons';

export function Card({
  children,
  className = '',
  tinted = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  tinted?: boolean;
  onClick?: () => void;
}) {
  const base = `rounded-2xl border border-[var(--border)] p-3.5 ${
    tinted ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)]'
  } ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} w-full text-right transition-colors hover:border-[var(--primary)] active:scale-[0.99]`}
      >
        {children}
      </button>
    );
  }

  return <section className={base}>{children}</section>;
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
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1"
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
            className={`min-h-[40px] flex-1 rounded-xl px-2.5 py-1.5 text-xs whitespace-nowrap transition-all ${
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
  variant?: 'primary' | 'secondary' | 'danger' | 'disabled';
  disabled?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const effectiveVariant = disabled || disabledReason ? 'disabled' : variant;
  const styles: Record<'primary' | 'secondary' | 'danger' | 'disabled', string> = {
    primary:
      'bg-[var(--primary)] text-[var(--on-primary)] border-transparent hover:bg-[var(--primary-strong)] active:scale-[0.99]',
    secondary:
      'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)]',
    danger:
      'bg-[var(--danger)] text-[var(--on-primary)] border-transparent hover:opacity-90',
    disabled:
      'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] opacity-70 cursor-not-allowed',
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
