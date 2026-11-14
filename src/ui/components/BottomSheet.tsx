import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconClose } from '../icons';

interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  snap?: 'half' | 'full';
  allowSnapToggle?: boolean;
  dismissible?: boolean;
  headerExtra?: ReactNode;
  zIndexClass?: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  snap = 'half',
  allowSnapToggle = false,
  dismissible = true,
  headerExtra,
  zIndexClass = 'z-50',
  children,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<'half' | 'full'>(snap);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCurrentSnap(snap);
  }, [snap, open]);

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible && onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffset(Math.min(delta, 240));
    } else if (allowSnapToggle && delta < -36 && currentSnap === 'half') {
      setCurrentSnap('full');
      dragStartYRef.current = null;
      setDragOffset(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;

    if (delta > 90) {
      if (currentSnap === 'full' && allowSnapToggle) {
        setCurrentSnap('half');
      } else if (dismissible && onClose) {
        onClose();
      }
    }
    setDragOffset(0);
  };

  const heightClass = currentSnap === 'full' ? 'h-[92dvh] max-h-[92dvh]' : 'max-h-[78dvh]';

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-black/45 backdrop-blur-[2px]`}
      onClick={() => {
        if (dismissible && onClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'پنجره'}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          boxShadow: 'var(--shadow-sheet)',
        }}
        className={`flex w-full max-w-[480px] flex-col rounded-t-3xl border-t border-x border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-transform duration-150 outline-none ${heightClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div
          className="flex cursor-grab touch-none items-center justify-center pt-2.5 pb-1 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragStartYRef.current = null;
            setDragOffset(0);
          }}
        >
          <div className="h-1.5 w-11 rounded-full bg-[var(--border)]" />
        </div>

        {(title || (dismissible && onClose)) && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 pt-1 pb-3">
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-base font-bold text-[var(--text)]">{title}</h2>
              )}
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {headerExtra}
              {dismissible && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="بستن"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
