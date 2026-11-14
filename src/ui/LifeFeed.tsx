import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { formatAgeYearDivider, toPersianDigits } from '../engine/jalali';
import type { TimelineEntry } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import type { AnimationSpeed } from '../storage/saveStore';
import { IconBrandMark, IconSparkles, IconStar } from './icons';
import { VirtualizedList } from './components/Primitives';

interface LifeFeedProps {
  timeline: TimelineEntry[];
  isAlive: boolean;
  animatingEntryIds?: string[];
  revealedCount?: number;
  activeYearKey?: string | null;
  showAnimatingYear?: boolean;
  animSpeed?: AnimationSpeed;
  reducedMotion?: boolean;
  onSkipSequence?: () => void;
}

interface YearGroup {
  key: string;
  age: number;
  jalaliYear: number;
  entries: TimelineEntry[];
}

function getEntryTone(entry: TimelineEntry): 'positive' | 'negative' | 'milestone' | 'neutral' {
  if (entry.type === 'milestone' || entry.type === 'birth') return 'milestone';
  if (entry.type === 'death') return 'negative';

  if (entry.statChanges) {
    let score = 0;
    for (const [k, v] of Object.entries(entry.statChanges)) {
      if (typeof v !== 'number') continue;
      if (k === 'moneyToman') score += v > 0 ? 2 : v < 0 ? -2 : 0;
      else score += v;
    }
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
  }
  return 'neutral';
}

const STAT_SHORT_LABELS: Record<string, string> = {
  health: 'سلامت',
  happiness: 'شادی',
  intelligence: 'هوش',
  looks: 'ظاهر',
  mentalHealth: 'روان',
  fame: 'جایگاه',
};

function useTypewriterText(text: string, enabled: boolean): string {
  const [shownLen, setShownLen] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) {
      setShownLen(text.length);
      return;
    }
    setShownLen(1);
    const total = text.length;
    if (total <= 1) return;
    const stepMs = Math.max(10, Math.min(24, Math.floor(240 / total)));
    const timer = window.setInterval(() => {
      setShownLen((prev) => {
        if (prev >= total) {
          window.clearInterval(timer);
          return total;
        }
        return prev + 1;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [text, enabled]);

  return enabled ? text.slice(0, shownLen) : text;
}

function EntryCard({
  entry,
  isNew,
  shouldAnimate,
  allowTypewriter,
}: {
  entry: TimelineEntry;
  isNew: boolean;
  shouldAnimate: boolean;
  allowTypewriter: boolean;
}) {
  const tone = getEntryTone(entry);
  const isMilestone = entry.type === 'milestone' || entry.type === 'birth';

  const markerColor: Record<typeof tone, string> = {
    positive: 'var(--success)',
    negative: 'var(--danger)',
    milestone: 'var(--stat-smarts)',
    neutral: 'var(--primary)',
  };

  const statBadges = entry.statChanges
    ? Object.entries(entry.statChanges).filter(
        ([k, v]) => k !== 'moneyToman' && typeof v === 'number' && v !== 0,
      )
    : [];

  const formattedTitle = entry.title.replace(' · ', ' — ');
  const displayTitle = useTypewriterText(
    formattedTitle,
    Boolean(isNew && shouldAnimate && allowTypewriter && isMilestone),
  );

  const cardInner = (
    <>
      {/* 3px right side-marker drawing top-to-bottom */}
      <motion.span
        aria-hidden="true"
        initial={isNew && shouldAnimate ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ duration: isNew && shouldAnimate ? 0.28 : 0, ease: 'easeOut' }}
        style={{
          backgroundColor: markerColor[tone],
          transformOrigin: 'top',
        }}
        className="pointer-events-none absolute inset-y-0 right-0 w-[3px]"
      />

      {/* Subtle GPU-only glow flash on newly revealed milestone cards */}
      {isNew && shouldAnimate && isMilestone && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.68, ease: 'easeOut' }}
          style={{ borderColor: markerColor[tone] }}
          className="pointer-events-none absolute inset-0 rounded-2xl border-2"
        />
      )}

      <div className="flex items-start gap-2.5">
        {isMilestone && (
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-strong)]">
            {entry.type === 'birth' ? (
              <IconSparkles className="h-4 w-4" />
            ) : (
              <IconStar className="h-4 w-4" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[var(--text)]">{displayTitle}</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text)]/90">
            {entry.text}
          </p>
          {statBadges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {statBadges.map(([key, delta]) => {
                const positive = Number(delta) > 0;
                return (
                  <span
                    key={key}
                    className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      positive
                        ? 'bg-[var(--success)]/12 text-[var(--success)]'
                        : 'bg-[var(--danger)]/12 text-[var(--danger)]'
                    }`}
                  >
                    {STAT_SHORT_LABELS[key] ?? key}{' '}
                    {positive ? `+${toPersianDigits(Number(delta))}` : toPersianDigits(Number(delta))}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (!isNew) {
    return (
      <article
        className={`relative overflow-hidden rounded-2xl border border-[var(--border)] ${
          isMilestone ? 'bg-[var(--surface-2)] p-3.5 pr-4' : 'bg-[var(--surface)] px-3.5 py-2.5 pr-4'
        }`}
      >
        {cardInner}
      </article>
    );
  }

  return (
    <motion.article
      initial={
        shouldAnimate
          ? isMilestone
            ? { opacity: 0, y: 12, scale: 0.96 }
            : { opacity: 0, y: 10 }
          : { opacity: 0 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        !shouldAnimate
          ? { duration: 0.14 }
          : isMilestone
            ? { type: 'spring', stiffness: 360, damping: 24 }
            : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className={`relative overflow-hidden rounded-2xl border border-[var(--border)] ${
        isMilestone ? 'bg-[var(--surface-2)] p-3.5 pr-4' : 'bg-[var(--surface)] px-3.5 py-2.5 pr-4'
      }`}
    >
      {cardInner}
    </motion.article>
  );
}

export function LifeFeed({
  timeline,
  animatingEntryIds = [],
  revealedCount = Number.MAX_SAFE_INTEGER,
  activeYearKey = null,
  showAnimatingYear = true,
  animSpeed = 'normal',
  reducedMotion = false,
  onSkipSequence,
}: LifeFeedProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const animatingIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    animatingEntryIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [animatingEntryIds]);

  const isStaggering =
    animatingEntryIds.length > 0 && revealedCount < animatingEntryIds.length;

  const shouldAnimateCards = !reducedMotion && animSpeed !== 'off';
  const allowTypewriter = !reducedMotion && animSpeed === 'normal';

  const groups = useMemo<YearGroup[]>(() => {
    const map = new Map<string, YearGroup>();
    for (const entry of timeline) {
      const idx = animatingIndexMap.get(entry.id);
      if (idx !== undefined && idx >= revealedCount) {
        continue;
      }
      const key = `${entry.age}_${entry.jalaliYear}`;
      if (!showAnimatingYear && activeYearKey === key) {
        continue;
      }
      let group = map.get(key);
      if (!group) {
        group = { key, age: entry.age, jalaliYear: entry.jalaliYear, entries: [] };
        map.set(key, group);
      }
      group.entries.push(entry);
    }
    return Array.from(map.values());
  }, [timeline, animatingIndexMap, revealedCount, showAnimatingYear, activeYearKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledUp) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion || animSpeed === 'off' ? 'auto' : 'smooth',
      });
    }
  }, [timeline.length, revealedCount, showAnimatingYear, userScrolledUp, reducedMotion, animSpeed]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 120);
  };

  const renderYearGroup = (group: YearGroup) => {
    const isCurrentAnimatingYear = activeYearKey === group.key;
    return (
      <div key={group.key} className="space-y-2">
        <motion.div
          initial={
            isCurrentAnimatingYear && shouldAnimateCards
              ? { opacity: 0, y: 8, scale: 0.96 }
              : false
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex justify-center py-1"
        >
          <span className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-bold tabular-nums text-[var(--text-muted)]">
            <bdi dir="rtl">{formatAgeYearDivider(group.age, group.jalaliYear)}</bdi>
          </span>
        </motion.div>
        <div className="space-y-2">
          {group.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isNew={animatingIndexMap.has(entry.id)}
              shouldAnimate={shouldAnimateCards}
              allowTypewriter={allowTypewriter}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <main
      ref={scrollRef}
      onScroll={handleScroll}
      onClick={() => {
        if (isStaggering) {
          onSkipSequence?.();
        }
      }}
      className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-2 pb-6"
    >
      <div className="space-y-3">
        {groups.length > 50 ? (
          <VirtualizedList
            items={groups}
            initialWindow={40}
            loadMoreLabel="نمایش سال‌های قدیمی‌تر"
            renderItem={(group) => renderYearGroup(group)}
          />
        ) : (
          groups.map((group) => renderYearGroup(group))
        )}

        {timeline.length <= 1 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary-soft)]">
              <IconBrandMark className="h-6 w-6" />
            </div>
            <div className="text-sm font-bold text-[var(--text)]">{t('welcomeTitle')}</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {t('welcomeHint')}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
