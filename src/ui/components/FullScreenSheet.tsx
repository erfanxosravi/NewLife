import { useEffect, useRef, type ReactNode } from 'react';
import { IconBackRtl } from '../icons';

interface FullScreenSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function FullScreenSheet({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
}: FullScreenSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => containerRef.current?.focus(), 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/35"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="flex h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg)] text-[var(--text)] outline-none sm:border-x sm:border-[var(--border)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="بازگشت"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <IconBackRtl className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[var(--text)]">{title}</h2>
              {subtitle && (
                <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
              )}
            </div>
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
