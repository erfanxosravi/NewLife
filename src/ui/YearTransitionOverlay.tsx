import { lazy, Suspense, useEffect, useState } from 'react';
import { Leaf, Snowflake, Sprout, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toPersianDigits } from '../engine/jalali';
import { useI18n } from '../i18n/useI18n';
import type { YearTransitionPayload } from '../state/yearSequence';
import type { AnimationSpeed } from '../storage/saveStore';

const OrangeConfetti = lazy(() =>
  import('./components/OrangeConfetti').then((m) => ({ default: m.OrangeConfetti })),
);

interface YearTransitionOverlayProps {
  visible: boolean;
  payload: YearTransitionPayload | null;
  animSpeed: AnimationSpeed;
  reducedMotion: boolean;
  onSkip: () => void;
}

export function YearTransitionOverlay({
  visible,
  payload,
  animSpeed,
  reducedMotion,
  onSkip,
}: YearTransitionOverlayProps) {
  const { t } = useI18n();
  const [litSeasonCount, setLitSeasonCount] = useState(0);

  useEffect(() => {
    if (!visible || !payload || reducedMotion || payload.isDeath) {
      setLitSeasonCount(0);
      return;
    }

    const stepMs = animSpeed === 'fast' ? 110 : 210;
    setLitSeasonCount(1);
    const t2 = window.setTimeout(() => setLitSeasonCount(2), stepMs);
    const t3 = window.setTimeout(() => setLitSeasonCount(3), stepMs * 2);
    const t4 = window.setTimeout(() => setLitSeasonCount(4), stepMs * 3);

    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [visible, payload, animSpeed, reducedMotion]);

  const seasons = [
    { key: 'spring', label: t('yearTransition.seasons.spring'), Icon: Sprout },
    { key: 'summer', label: t('yearTransition.seasons.summer'), Icon: Sun },
    { key: 'autumn', label: t('yearTransition.seasons.autumn'), Icon: Leaf },
    { key: 'winter', label: t('yearTransition.seasons.winter'), Icon: Snowflake },
  ] as const;

  const isFast = animSpeed === 'fast';

  return (
    <AnimatePresence>
      {visible && payload && (
        <motion.div
          key={`overlay_${payload.toAge}_${payload.toYear}`}
          role="dialog"
          aria-modal="true"
          aria-label="تغییر سال"
          data-testid="year-transition-overlay"
          data-milestone={payload.isBirthdayMilestone ? 'true' : 'false'}
          data-nowruz={payload.isNowruzYear ? 'true' : 'false'}
          data-death={payload.isDeath ? 'true' : 'false'}
          onClick={onSkip}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0.18 : payload.isDeath ? 0.35 : isFast ? 0.16 : 0.22,
          }}
          style={{ backgroundColor: 'var(--overlay-bg)' }}
          className="absolute inset-0 z-40 flex cursor-pointer select-none flex-col items-center justify-center p-6 text-center backdrop-blur-md"
        >
          {/* Lazy Orange Confetti ONLY for birthday milestones when motion is enabled */}
          {!reducedMotion && !payload.isDeath && payload.isBirthdayMilestone && (
            <Suspense fallback={null}>
              <OrangeConfetti />
            </Suspense>
          )}

          {/* Nowruz / Haft-Sin Sprout Accent */}
          {!payload.isDeath && payload.isNowruzYear && (
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: reducedMotion ? 0.18 : 0.32 }}
              className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[var(--primary)]/35 bg-[var(--primary-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--primary-strong)]"
            >
              <Sprout className="h-4 w-4 text-[var(--primary-strong)]" strokeWidth={2} />
              <span>
                {t('yearTransition.nowruzMessage', {
                  year: toPersianDigits(payload.toYear),
                })}
              </span>
            </motion.div>
          )}

          {/* Milestone Badge */}
          {!payload.isDeath && payload.isBirthdayMilestone && (
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={
                reducedMotion
                  ? { duration: 0.18 }
                  : { type: 'spring', stiffness: 320, damping: 20 }
              }
              className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-1.5 text-xs font-bold text-[var(--on-primary)] shadow-md"
            >
              <span>
                {t('yearTransition.milestoneMessage', {
                  age: toPersianDigits(payload.toAge),
                })}
              </span>
            </motion.div>
          )}

          {/* Center Age & Jalali Year Display */}
          <div className="relative flex flex-col items-center">
            {!payload.isDeath && payload.isBirthdayMilestone && !reducedMotion && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 rounded-full bg-[var(--primary)]/12 blur-xl"
              />
            )}

            {/* Age Odometer / Fade */}
            <div className="relative flex items-baseline justify-center gap-2">
              <div
                className={`relative overflow-hidden tabular-nums font-black tracking-tight ${
                  payload.isDeath
                    ? 'text-4xl text-[var(--text-muted)]'
                    : payload.isBirthdayMilestone
                      ? 'text-5xl text-[var(--primary-strong)]'
                      : 'text-4xl text-[var(--text)]'
                }`}
                style={{ minHeight: payload.isBirthdayMilestone ? '3.4rem' : '2.75rem' }}
              >
                {reducedMotion || payload.isDeath ? (
                  <span>{toPersianDigits(payload.toAge)}</span>
                ) : (
                  <div className="relative flex h-full items-center justify-center">
                    <motion.span
                      key={`from_${payload.fromAge}`}
                      initial={{ y: 0, opacity: 1 }}
                      animate={{ y: -36, opacity: 0 }}
                      transition={{
                        duration: isFast ? 0.25 : 0.42,
                        delay: isFast ? 0.06 : 0.12,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="block"
                    >
                      {toPersianDigits(payload.fromAge)}
                    </motion.span>
                    <motion.span
                      key={`to_${payload.toAge}`}
                      initial={{ y: 36, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: isFast ? 0.28 : 0.46,
                        delay: isFast ? 0.08 : 0.16,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {toPersianDigits(payload.toAge)}
                    </motion.span>
                  </div>
                )}
              </div>
              <span className="text-base font-bold text-[var(--text-muted)]">سالگی</span>
            </div>

            {/* Jalali Year Roll */}
            <div className="relative mt-2 h-6 w-32 overflow-hidden text-sm font-bold tabular-nums text-[var(--text-muted)]">
              {reducedMotion || payload.isDeath ? (
                <span>سال {toPersianDigits(payload.toYear)}</span>
              ) : (
                <>
                  <motion.div
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: -22, opacity: 0 }}
                    transition={{
                      duration: isFast ? 0.24 : 0.38,
                      delay: isFast ? 0.1 : 0.18,
                      ease: 'easeOut',
                    }}
                    className="flex items-center justify-center"
                  >
                    سال {toPersianDigits(payload.fromYear)}
                  </motion.div>
                  <motion.div
                    initial={{ y: 22, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: isFast ? 0.26 : 0.42,
                      delay: isFast ? 0.12 : 0.22,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 flex items-center justify-center text-[var(--primary-strong)]"
                  >
                    سال {toPersianDigits(payload.toYear)}
                  </motion.div>
                </>
              )}
            </div>
          </div>

          {/* Iranian Seasons Cycle OR Quiet Death Message */}
          {payload.isDeath ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.5, delay: 0.15 }}
              className="mt-6 text-sm font-medium text-[var(--text-muted)]"
            >
              {t('yearTransition.deathMessage')}
            </motion.p>
          ) : (
            <div className="mt-7 w-full max-w-[260px] space-y-2.5">
              <div className="grid grid-cols-4 gap-2">
                {seasons.map(({ key, label, Icon }, idx) => {
                  const active = reducedMotion ? true : litSeasonCount > idx;
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 transition-all duration-200 ${
                        active
                          ? 'border-[var(--primary)]/40 bg-[var(--primary-soft)]/80 text-[var(--primary-strong)] scale-100 opacity-100'
                          : 'border-[var(--border)] bg-[var(--surface)]/70 text-[var(--text-muted)] scale-95 opacity-55'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                      <span className="text-[10px] font-bold">{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Thin RTL Season Progress Arc/Bar */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <motion.div
                  initial={{ scaleX: reducedMotion ? 1 : 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: reducedMotion ? 0.01 : isFast ? 0.48 : 0.92,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: 'right', backgroundColor: 'var(--primary)' }}
                  className="h-full w-full rounded-full"
                />
              </div>
            </div>
          )}

          {/* Subtle tap-to-skip hint */}
          <span className="mt-8 text-[11px] font-medium text-[var(--text-muted)]/80">
            {t('yearTransition.tapToSkip')}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
