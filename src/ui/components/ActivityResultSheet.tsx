import { gameDataset } from '../../data/registry';
import { formatCurrencyAmount, getFxRate } from '../../engine/fx';
import { toPersianDigits } from '../../engine/jalali';
import type { ActivityDefinition, ActivityOutcome, PlayerStats, SaveGame } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import { BottomSheet } from './BottomSheet';
import { IconBook, IconCheck, IconReset, IconSparkles, IconStar } from '../icons';

interface ActivityResultSheetProps {
  open: boolean;
  activity: ActivityDefinition | null;
  outcome: ActivityOutcome | null;
  saveGame: SaveGame;
  onClose: () => void;
  onToggleFavorite?: (activityId: string) => void;
  onUndo?: () => void;
}

const STAT_LABEL_MAP: Record<keyof PlayerStats, string> = {
  health: 'سلامت',
  happiness: 'شادی',
  mentalHealth: 'روان',
  intelligence: 'هوش',
  looks: 'ظاهر',
  fame: 'جایگاه اجتماعی',
};

export function ActivityResultSheet({
  open,
  activity,
  outcome,
  saveGame,
  onClose,
  onToggleFavorite,
  onUndo,
}: ActivityResultSheetProps) {
  const { t } = useI18n();
  if (!open || !activity || !outcome) return null;

  const isFavorite = saveGame.state.activityState?.favoriteIds.includes(activity.id) ?? false;
  const canUndo =
    saveGame.state.activityState?.annualUndoSnapshot?.activityId === activity.id &&
    saveGame.state.activityState?.annualUndoSnapshot?.turn === saveGame.state.turn;

  const statDeltas = (Object.entries(outcome.stats ?? {}) as [keyof PlayerStats, number][]).filter(
    ([, val]) => typeof val === 'number' && val !== 0,
  );

  const netMoneyToman = Math.round(
    ((outcome.moneyToman ?? 0) - activity.costToman) * saveGame.state.inflationMultiplier,
  );
  const localCountry = saveGame.state.player.countryId;
  const localCurrency =
    localCountry !== 'iran'
      ? gameDataset.countriesMacro.find((c) => c.id === localCountry)?.currencyCode ?? 'IRT'
      : 'IRT';
  const moneyLocal =
    localCurrency === 'IRT'
      ? netMoneyToman
      : Number((netMoneyToman * getFxRate(saveGame.state, 'IRT', localCurrency, gameDataset)).toFixed(2));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      snap="half"
      title={t('activitiesHub.resultTitle')}
      subtitle={activity.titleFa}
      zIndexClass="z-[58]"
    >
      <div className="space-y-3.5 text-right">
        {/* Crisp Vector Result Banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-soft)]/50 p-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--on-primary)]">
            <IconSparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--text)]">{activity.titleFa}</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">
              {outcome.resultTextFa}
            </p>
          </div>
        </div>

        {/* Stat & Financial Delta Pills */}
        {(statDeltas.length > 0 || netMoneyToman !== 0) && (
          <div className="flex flex-wrap gap-1.5">
            {statDeltas.map(([key, val]) => {
              const positive = val > 0;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold tabular-nums ${
                    positive
                      ? 'bg-[var(--success)]/12 text-[var(--success)]'
                      : 'bg-[var(--danger)]/12 text-[var(--danger)]'
                  }`}
                >
                  <bdi dir="rtl">
                    {STAT_LABEL_MAP[key]} {positive ? `+${toPersianDigits(val)}` : toPersianDigits(val)}
                  </bdi>
                </span>
              );
            })}
            {netMoneyToman !== 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold tabular-nums ${
                  netMoneyToman > 0
                    ? 'bg-[var(--success)]/12 text-[var(--success)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                <bdi dir="rtl">
                  {netMoneyToman > 0 ? '+' : ''}
                  {formatCurrencyAmount(moneyLocal, localCurrency, gameDataset, { compact: true })}
                </bdi>
              </span>
            )}
          </div>
        )}

        {/* Journal Entry Preview Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
            <IconBook className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
            <span>{t('activitiesHub.journalPreview')}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">
            {outcome.memoryTextFa ?? outcome.resultTextFa}
          </p>
        </div>

        {/* Action Footer */}
        <div className="flex items-center gap-2 pt-1">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(activity.id)}
              aria-label="نشان کردن فعالیت"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
                isFavorite
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
              }`}
            >
              <IconStar className="h-4 w-4" />
            </button>
          )}
          {canUndo && onUndo && (
            <button
              type="button"
              onClick={() => {
                onUndo();
                onClose();
              }}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)]"
            >
              <IconReset className="h-4 w-4" />
              <span>{t('activitiesHub.undoLabel')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)]"
          >
            <IconCheck className="h-4 w-4" />
            <span>بسیار خوب</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
