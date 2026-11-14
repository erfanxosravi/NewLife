import { useEffect, useRef, useState } from 'react';
import { Loader2, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '../i18n/useI18n';
import {
  IconActivities,
  IconAssets,
  IconCareerEdu,
  IconNextYear,
  IconRelations,
} from './icons';

export type BottomNavTab = 'career' | 'assets' | 'relations' | 'activities';

interface BottomNavProps {
  activeTab: BottomNavTab | null;
  nextYearDisabled: boolean;
  isProcessingYear?: boolean;
  isAutoAdvancing?: boolean;
  longPressAutoEnabled?: boolean;
  reducedMotion?: boolean;
  onSelectTab: (tab: BottomNavTab) => void;
  onNextYear: () => void;
  onStartAutoAdvance?: () => void;
  onStopAutoAdvance?: () => void;
}

interface RippleItem {
  id: number;
  x: number;
  y: number;
}

export function BottomNav({
  activeTab,
  nextYearDisabled,
  isProcessingYear = false,
  isAutoAdvancing = false,
  longPressAutoEnabled = false,
  reducedMotion = false,
  onSelectTab,
  onNextYear,
  onStartAutoAdvance,
  onStopAutoAdvance,
}: BottomNavProps) {
  const { t } = useI18n();
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const rippleCounterRef = useRef(0);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressed(false);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (nextYearDisabled || isProcessingYear || isAutoAdvancing) return;
    setIsPressed(true);
    suppressNextClickRef.current = false;

    if (!reducedMotion) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
      const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
      const id = ++rippleCounterRef.current;
      setRipples((prev) => [...prev.slice(-2), { id, x, y }]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 420);
    }

    if (longPressAutoEnabled && onStartAutoAdvance) {
      longPressTimerRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = true;
        setIsPressed(false);
        onStartAutoAdvance();
      }, 450);
    }
  };

  const handleClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isAutoAdvancing) {
      onStopAutoAdvance?.();
      return;
    }
    if (!nextYearDisabled && !isProcessingYear) {
      onNextYear();
    }
  };

  const NavItem = ({
    id,
    label,
    icon,
  }: {
    id: BottomNavTab;
    label: string;
    icon: React.ReactNode;
  }) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => onSelectTab(id)}
        className={`flex min-h-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs transition-colors ${
          active
            ? 'bg-[var(--primary-soft)] font-bold text-[var(--primary-strong)]'
            : 'font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
        }`}
      >
        {icon}
        <span className="leading-tight">{label}</span>
      </button>
    );
  };

  const effectivelyDisabled = (nextYearDisabled || isProcessingYear) && !isAutoAdvancing;

  return (
    <nav
      aria-label="منوی اصلی پایین"
      className="relative grid grid-cols-5 items-end border-t border-[var(--border)] bg-[var(--surface)] px-1.5 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))]"
    >
      {/* Floating Stop Pill during long-press auto-advance */}
      <AnimatePresence>
        {isAutoAdvancing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute -top-11 inset-x-0 z-20 flex justify-center"
          >
            <button
              type="button"
              onClick={onStopAutoAdvance}
              className="pointer-events-auto inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--surface)] px-3.5 py-1 text-xs font-bold text-[var(--danger)] shadow-md transition-transform active:scale-95"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{t('yearTransition.stopAutoAdvance')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <NavItem
        id="career"
        label={t('nav.workEducation')}
        icon={<IconCareerEdu className="h-5 w-5" />}
      />
      <NavItem
        id="assets"
        label={t('nav.assets')}
        icon={<IconAssets className="h-5 w-5" />}
      />

      {/* Center Raised 64px Rounded-Square "سال بعد" CTA */}
      <div className="flex flex-col items-center justify-end">
        <button
          type="button"
          disabled={effectivelyDisabled}
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          onClick={handleClick}
          aria-label={isAutoAdvancing ? t('yearTransition.stopAutoAdvance') : t('nextYear')}
          data-processing={isProcessingYear ? 'true' : 'false'}
          style={{
            transform: isPressed && !reducedMotion ? 'scale(0.95)' : 'scale(1)',
          }}
          className={`relative -mt-4 flex h-[64px] w-[64px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border-2 border-[var(--surface)] text-[var(--on-primary)] shadow-lg transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
            isAutoAdvancing
              ? 'bg-[var(--danger)] hover:opacity-90'
              : 'bg-[var(--primary)] hover:bg-[var(--primary-strong)]'
          } ${effectivelyDisabled || isAutoAdvancing ? '' : 'animate-soft-pulse'}`}
        >
          {/* Soft Orange Ripple Layer */}
          {ripples.map((r) => (
            <motion.span
              key={r.id}
              aria-hidden="true"
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                left: r.x - 16,
                top: r.y - 16,
                backgroundColor: 'var(--primary-soft)',
              }}
              className="pointer-events-none absolute h-8 w-8 rounded-full"
            />
          ))}

          {isAutoAdvancing ? (
            <>
              <Square className="h-4 w-4 fill-current" />
              <span className="text-xs font-bold leading-none">
                {t('yearTransition.stopAutoAdvance')}
              </span>
            </>
          ) : isProcessingYear ? (
            <>
              <Loader2 className={`h-5 w-5 ${reducedMotion ? '' : 'animate-spin'}`} />
              <span className="text-xs font-bold leading-none">…</span>
            </>
          ) : (
            <>
              <IconNextYear className="h-5 w-5" />
              <span className="text-xs font-bold leading-none">{t('nextYear')}</span>
            </>
          )}
        </button>
      </div>

      <NavItem
        id="relations"
        label={t('nav.relations')}
        icon={<IconRelations className="h-5 w-5" />}
      />
      <NavItem
        id="activities"
        label={t('nav.activities')}
        icon={<IconActivities className="h-5 w-5" />}
      />
    </nav>
  );
}
