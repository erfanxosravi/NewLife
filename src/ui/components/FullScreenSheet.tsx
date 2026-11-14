import { useEffect, useRef, type ReactNode } from 'react';
import { IconBackRtl } from '../icons';

interface FullScreenSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  stickySubHeader?: ReactNode;
  scrollKey?: string;
  zIndexClass?: string;
  children: ReactNode;
}

export function FullScreenSheet({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  stickySubHeader,
  scrollKey = 'default',
  zIndexClass = 'z-50',
  children,
}: FullScreenSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    const saved = scrollPositionsRef.current.get(scrollKey) ?? 0;
    bodyRef.current.scrollTop = saved;
  }, [open, scrollKey]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 480;
    // Trigger edge swipe from RTL leading (right) edge or trailing (left) edge
    if (touch.clientX >= vw - 44 || touch.clientX <= 44) {
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    } else {
      swipeStartRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const touch = e.changedTouches[0];
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 72 && Math.abs(dy) < 36) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex justify-center bg-black/35`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
              <h2 className="text-base font-bold leading-snug text-[var(--text)]">{title}</h2>
              {subtitle && (
                <p className="text-xs leading-snug text-[var(--text-muted)]">{subtitle}</p>
              )}
            </div>
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </header>

        {stickySubHeader && (
          <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
            {stickySubHeader}
          </div>
        )}

        <div
          ref={bodyRef}
          onScroll={(e) => {
            scrollPositionsRef.current.set(scrollKey, e.currentTarget.scrollTop);
          }}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
