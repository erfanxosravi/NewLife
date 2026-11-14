import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { motion } from 'motion/react';
import { formatToman, toPersianDigits } from '../engine/jalali';
import type { EventChoice, EventDefinition, PlayerStats } from '../engine/types';
import type { AnimationSpeed } from '../storage/saveStore';
import { triggerHaptic } from '../utils/haptics';
import { BottomSheet } from './components/BottomSheet';
import { ActionButton, Badge } from './components/Primitives';
import {
  IconCalendar,
  IconCareerEdu,
  IconCoins,
  IconEducation,
  IconHome,
  IconRelations,
  IconSparkles,
} from './icons';

interface EventPopupSheetProps {
  event: EventDefinition | null;
  playerMoneyToman: number;
  animSpeed?: AnimationSpeed;
  reducedMotion?: boolean;
  onSelectChoice: (event: EventDefinition, choice: EventChoice) => void;
}

const CATEGORY_META: Record<
  EventDefinition['category'],
  { label: string; icon: React.ReactNode }
> = {
  childhood: { label: 'کودکی', icon: <IconSparkles className="h-4 w-4" /> },
  teen: { label: 'نوجوانی', icon: <IconEducation className="h-4 w-4" /> },
  young_adult: { label: 'جوانی', icon: <IconSparkles className="h-4 w-4" /> },
  career: { label: 'مسیر شغلی', icon: <IconCareerEdu className="h-4 w-4" /> },
  family: { label: 'خانواده', icon: <IconRelations className="h-4 w-4" /> },
  economy: { label: 'اقتصاد و معیشت', icon: <IconCoins className="h-4 w-4" /> },
  cultural: { label: 'فرهنگ و آیین', icon: <IconCalendar className="h-4 w-4" /> },
  old_age: { label: 'سالمندی', icon: <IconHome className="h-4 w-4" /> },
};

const CALENDAR_ACCENT: Record<
  NonNullable<EventDefinition['calendarTheme']>,
  { label: string; badge: string }
> = {
  nowruz: { label: 'نوروز و بهار', badge: 'هفت‌سین و سال نو' },
  yalda: { label: 'شب یلدا', badge: 'طولانی‌ترین شب سال' },
  ramadan: { label: 'ماه رمضان', badge: 'افطار و همبستگی' },
  muharram: { label: 'محرم', badge: 'آیین و نذری' },
  sizdah: { label: 'سیزده‌بدر', badge: 'روز طبیعت' },
};

const STAT_LABELS: Record<keyof PlayerStats, string> = {
  happiness: 'شادی',
  health: 'سلامت',
  intelligence: 'هوش',
  looks: 'ظاهر',
  mentalHealth: 'سلامت روان',
  fame: 'جایگاه',
};

export function EventPopupSheet({
  event,
  playerMoneyToman,
  animSpeed = 'normal',
  reducedMotion = false,
  onSelectChoice,
}: EventPopupSheetProps) {
  const [resolvedChoice, setResolvedChoice] = useState<EventChoice | null>(null);

  useEffect(() => {
    setResolvedChoice(null);
  }, [event?.id]);

  if (!event) return null;

  const catMeta = CATEGORY_META[event.category];
  const calAccent = event.calendarTheme ? CALENDAR_ACCENT[event.calendarTheme] : null;
  const allowMotion = !reducedMotion && animSpeed !== 'off';

  const handlePick = (choice: EventChoice) => {
    triggerHaptic('medium');
    setResolvedChoice(choice);
  };

  const handleContinue = () => {
    if (!resolvedChoice) return;
    triggerHaptic('light');
    onSelectChoice(event, resolvedChoice);
    setResolvedChoice(null);
  };

  const statEntries = resolvedChoice?.effects.stats
    ? (Object.entries(resolvedChoice.effects.stats) as [keyof PlayerStats, number][]).filter(
        ([, val]) => typeof val === 'number' && val !== 0,
      )
    : [];

  return (
    <BottomSheet
      open={Boolean(event)}
      dismissible={false}
      snap="half"
      title={event.titleFa}
      subtitle={catMeta.label}
      headerExtra={
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary-strong)] ${
              allowMotion ? 'animate-bell-wobble' : ''
            }`}
            aria-hidden="true"
          >
            <BellRing className="h-4 w-4" strokeWidth={2} />
          </span>
          <Badge tone="primary">{catMeta.icon}</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {calAccent && (
          <div className="flex items-center justify-between rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-[var(--primary-strong)]">
              <IconCalendar className="h-4 w-4" />
              <span>{calAccent.label}</span>
            </div>
            <span className="text-[11px] font-medium text-[var(--primary-strong)]">
              {calAccent.badge}
            </span>
          </div>
        )}

        {!resolvedChoice ? (
          <>
            <p className="text-sm leading-relaxed text-[var(--text)]">{event.textFa}</p>
            <div className="space-y-2 pt-1">
              {event.choices.map((choice, index) => {
                const cost = choice.costToman ?? 0;
                const cantAfford = cost > 0 && playerMoneyToman < cost;
                return (
                  <motion.div
                    key={choice.id}
                    initial={allowMotion ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      allowMotion
                        ? {
                            duration: animSpeed === 'fast' ? 0.14 : 0.22,
                            delay: animSpeed === 'fast' ? index * 0.03 : index * 0.055,
                            ease: 'easeOut',
                          }
                        : { duration: 0 }
                    }
                  >
                    <ActionButton
                      label={choice.labelFa}
                      costText={cost > 0 ? formatToman(cost) : undefined}
                      disabled={cantAfford}
                      disabledReason={cantAfford ? 'موجودی کافی نیست' : undefined}
                      variant="secondary"
                      onClick={() => handlePick(choice)}
                    />
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          <motion.div
            initial={allowMotion ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: allowMotion ? 0.22 : 0 }}
            className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <div className="text-xs font-bold text-[var(--primary-strong)]">
              انتخاب تو: {resolvedChoice.labelFa}
            </div>
            <p className="text-sm leading-relaxed text-[var(--text)]">
              {resolvedChoice.effects.resultTextFa}
            </p>
            {(statEntries.length > 0 || resolvedChoice.effects.moneyToman) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {statEntries.map(([key, val], idx) => {
                  const pos = val > 0;
                  return (
                    <motion.div
                      key={key}
                      initial={allowMotion ? { opacity: 0, scale: 0.85 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={
                        allowMotion
                          ? { type: 'spring', stiffness: 360, damping: 22, delay: idx * 0.04 }
                          : { duration: 0 }
                      }
                    >
                      <Badge tone={pos ? 'success' : 'danger'}>
                        {STAT_LABELS[key]} {pos ? `+${toPersianDigits(val)}` : toPersianDigits(val)}
                      </Badge>
                    </motion.div>
                  );
                })}
                {resolvedChoice.effects.moneyToman ? (
                  <motion.div
                    initial={allowMotion ? { opacity: 0, scale: 0.85 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      allowMotion
                        ? { type: 'spring', stiffness: 360, damping: 22, delay: statEntries.length * 0.04 }
                        : { duration: 0 }
                    }
                  >
                    <Badge tone={resolvedChoice.effects.moneyToman > 0 ? 'success' : 'danger'}>
                      {resolvedChoice.effects.moneyToman > 0 ? '+' : ''}
                      {formatToman(resolvedChoice.effects.moneyToman)}
                    </Badge>
                  </motion.div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={handleContinue}
              className="mt-2 min-h-[48px] w-full rounded-2xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)]"
            >
              ادامه
            </button>
          </motion.div>
        )}
      </div>
    </BottomSheet>
  );
}
