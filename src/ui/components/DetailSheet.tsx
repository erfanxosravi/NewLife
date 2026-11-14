import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { FullScreenSheet } from './FullScreenSheet';
import { IconInfo } from '../icons';

interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  children?: ReactNode;
}

export function InfoSheet({
  open,
  onClose,
  title,
  subtitle,
  body,
  bullets,
  children,
}: InfoSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      snap="half"
    >
      <div className="space-y-3 text-xs leading-relaxed text-[var(--text)]">
        {body && <p className="text-[var(--text-muted)]">{body}</p>}
        {bullets && bullets.length > 0 && (
          <ul className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            {bullets.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[var(--text)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </BottomSheet>
  );
}

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onInfo?: () => void;
  infoLabel?: string;
  headerRight?: ReactNode;
  stickySubHeader?: ReactNode;
  footer?: ReactNode;
  zIndexClass?: string;
  children: ReactNode;
}

export function DetailSheet({
  open,
  onClose,
  title,
  subtitle,
  onInfo,
  infoLabel = 'راهنما و توضیحات',
  headerRight,
  stickySubHeader,
  footer,
  zIndexClass = 'z-[55]',
  children,
}: DetailSheetProps) {
  const combinedRight =
    headerRight || onInfo ? (
      <div className="flex items-center gap-1.5">
        {headerRight}
        {onInfo && (
          <button
            type="button"
            onClick={onInfo}
            aria-label={infoLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--primary-strong)] hover:bg-[var(--surface-2)]"
          >
            <IconInfo className="h-5 w-5" />
          </button>
        )}
      </div>
    ) : undefined;

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      headerRight={combinedRight}
      stickySubHeader={stickySubHeader}
      zIndexClass={zIndexClass}
    >
      <div className="space-y-4">
        {children}
        {footer && (
          <div className="sticky bottom-0 -mx-4 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 pt-3 pb-1 backdrop-blur-xs">
            {footer}
          </div>
        )}
      </div>
    </FullScreenSheet>
  );
}
