import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toPersianDigits } from '../engine/jalali';
import type { GameState, PlayerStats } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getLastYearStatDeltas, getStatHistory } from '../state/selectors';
import type { AnimationSpeed } from '../storage/saveStore';
import { BottomSheet } from './components/BottomSheet';
import { Card, LockedNotice, Sparkline, StatBar } from './components/Primitives';
import {
  IconHappiness,
  IconHealth,
  IconLooks,
  IconMentalHealth,
  IconSmarts,
  IconStanding,
} from './icons';

interface StatsStripProps {
  stats: PlayerStats;
  statDeltas?: Partial<Record<keyof PlayerStats, number>>;
  deltaTriggerKey?: number;
  animSpeed?: AnimationSpeed;
  reducedMotion?: boolean;
  onExpand: () => void;
}

const COMPACT_STATS = [
  { key: 'happiness', label: 'شادی', colorVar: '--stat-happiness', Icon: IconHappiness },
  { key: 'health', label: 'سلامت', colorVar: '--stat-health', Icon: IconHealth },
  { key: 'intelligence', label: 'هوش', colorVar: '--stat-smarts', Icon: IconSmarts },
  { key: 'looks', label: 'ظاهر', colorVar: '--stat-looks', Icon: IconLooks },
] as const;

function useAnimatedInt(target: number, durationMs: number): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const startVal = currentRef.current;
    if (durationMs <= 0 || startVal === target) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(startVal + (target - startVal) * eased);
      currentRef.current = val;
      setDisplay(val);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return display;
}

function CompactStatCell({
  label,
  value,
  colorVar,
  delta,
  showDelta,
  deltaKey,
  durationMs,
  reducedMotion,
  Icon,
}: {
  label: string;
  value: number;
  colorVar: string;
  delta: number;
  showDelta: boolean;
  deltaKey: number;
  durationMs: number;
  reducedMotion: boolean;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const animatedVal = useAnimatedInt(clamped, durationMs);
  const isDanger = clamped < 20;

  return (
    <div
      className={`relative min-w-0 space-y-1 rounded-xl p-1 transition-colors ${
        isDanger
          ? `ring-1 ring-[var(--danger)] ${reducedMotion ? '' : 'animate-danger-pulse'}`
          : ''
      }`}
    >
      <AnimatePresence>
        {showDelta && delta !== 0 && (
          <motion.span
            key={`${label}_${deltaKey}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: -14, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -22 }}
            transition={{ duration: reducedMotion ? 0.16 : 0.28 }}
            className={`pointer-events-none absolute -top-2 right-0 z-20 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-xs font-bold tabular-nums shadow-xs ${
              delta > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}
          >
            {label}{' '}
            {delta > 0
              ? `▲${toPersianDigits(Math.round(delta))}`
              : `▼${toPersianDigits(Math.abs(Math.round(delta)))}`}
          </motion.span>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-0.5 text-xs">
        <span className="flex min-w-0 items-center gap-0.5 font-bold text-[var(--text)]">
          <Icon className="h-3 w-3 shrink-0" style={{ color: `var(${colorVar})` }} />
          <span>{label}</span>
        </span>
        <span className="shrink-0 font-bold tabular-nums text-[var(--text)]">
          {toPersianDigits(animatedVal)}٪
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full w-full origin-right rounded-full transition-transform ease-out"
          style={{
            transform: `scaleX(${clamped / 100})`,
            transitionDuration: `${durationMs}ms`,
            backgroundColor: `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

export function StatsStrip({
  stats,
  statDeltas,
  deltaTriggerKey = 0,
  animSpeed = 'normal',
  reducedMotion = false,
  onExpand,
}: StatsStripProps) {
  const [visibleKey, setVisibleKey] = useState<number>(0);

  useEffect(() => {
    if (!deltaTriggerKey || !statDeltas) return;
    const hasAny = COMPACT_STATS.some(({ key }) => {
      const d = statDeltas[key];
      return typeof d === 'number' && Math.round(d) !== 0;
    });
    if (!hasAny) return;
    setVisibleKey(deltaTriggerKey);
    const timer = window.setTimeout(() => {
      setVisibleKey((cur) => (cur === deltaTriggerKey ? 0 : cur));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [deltaTriggerKey, statDeltas]);

  const durationMs =
    reducedMotion || animSpeed === 'off' ? 0 : animSpeed === 'fast' ? 320 : 500;

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="نمایش همه شاخص‌های شخصیت"
      className="relative grid w-full grid-cols-4 gap-1.5 border-t border-[var(--border)] bg-[var(--surface)] px-2.5 pt-1.5 pb-4 text-right transition-colors hover:bg-[var(--surface-2)]/60"
    >
      {COMPACT_STATS.map(({ key, label, colorVar, Icon }) => {
        const delta = Math.round(statDeltas?.[key] ?? 0);
        return (
          <CompactStatCell
            key={key}
            label={label}
            value={stats[key]}
            colorVar={colorVar}
            delta={delta}
            showDelta={visibleKey === deltaTriggerKey && deltaTriggerKey > 0}
            deltaKey={deltaTriggerKey}
            durationMs={durationMs}
            reducedMotion={reducedMotion}
            Icon={Icon}
          />
        );
      })}
    </button>
  );
}

export function ExpandedStatsSheet({
  open,
  state,
  onClose,
}: {
  open: boolean;
  state: GameState;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const deltas = getLastYearStatDeltas(state);
  const history = getStatHistory(state);
  const showSocialStanding = state.player.age >= 10;

  const items: {
    key: keyof PlayerStats;
    label: string;
    hint: string;
    colorVar: string;
    icon: React.ReactNode;
    series: number[];
  }[] = [
    {
      key: 'happiness',
      label: t('stats.happiness'),
      hint: t('statHints.happiness'),
      colorVar: '--stat-happiness',
      icon: <IconHappiness className="h-4 w-4 text-[var(--stat-happiness)]" />,
      series: history.map((h) => h.happiness),
    },
    {
      key: 'health',
      label: t('stats.health'),
      hint: t('statHints.health'),
      colorVar: '--stat-health',
      icon: <IconHealth className="h-4 w-4 text-[var(--stat-health)]" />,
      series: history.map((h) => h.health),
    },
    {
      key: 'intelligence',
      label: t('stats.intelligence'),
      hint: t('statHints.intelligence'),
      colorVar: '--stat-smarts',
      icon: <IconSmarts className="h-4 w-4 text-[var(--stat-smarts)]" />,
      series: history.map((h) => h.intelligence),
    },
    {
      key: 'looks',
      label: t('stats.looks'),
      hint: t('statHints.looks'),
      colorVar: '--stat-looks',
      icon: <IconLooks className="h-4 w-4 text-[var(--stat-looks)]" />,
      series: history.map((h) => h.looks),
    },
    {
      key: 'mentalHealth',
      label: t('stats.mentalHealth'),
      hint: t('statHints.mentalHealth'),
      colorVar: '--stat-mental',
      icon: <IconMentalHealth className="h-4 w-4 text-[var(--stat-mental)]" />,
      series: history.map((h) => h.mentalHealth),
    },
  ];

  if (showSocialStanding) {
    items.push({
      key: 'fame',
      label: t('stats.fame'),
      hint: t('statHints.fame'),
      colorVar: '--stat-standing',
      icon: <IconStanding className="h-4 w-4 text-[var(--stat-standing)]" />,
      series: history.map((h) => h.fame),
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('stats.moreStats')}
      subtitle="روند تغییرات و وضعیت فعلی شاخص‌های قابل مشاهده"
      snap="full"
    >
      <div className="space-y-2.5">
        {items.map((item) => (
          <Card key={item.key} className="space-y-2">
            <StatBar
              label={item.label}
              value={state.player.stats[item.key]}
              delta={deltas[item.key]}
              colorVar={item.colorVar}
              icon={item.icon}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-snug text-[var(--text-muted)]">{item.hint}</p>
              <div className="w-24 shrink-0">
                <Sparkline values={item.series} colorVar={item.colorVar} height={26} />
              </div>
            </div>
          </Card>
        ))}

        {!showSocialStanding && (
          <LockedNotice message={`${t('stats.fame')}: ${t('stats.socialStandingLocked')}`} />
        )}
      </div>
    </BottomSheet>
  );
}
