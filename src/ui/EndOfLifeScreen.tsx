import { gameDataset } from '../data/registry';
import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import type { DeathSummary, GameState, Player } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getAmountPurchasingPower } from '../state/selectors';
import { formatMoneyTextForCanvas, MoneyText } from './components/MoneyText';
import { ActionButton, Badge, Card, ProgressRing } from './components/Primitives';
import { IconBrandMark, IconReset, IconShare } from './icons';

interface EndOfLifeScreenProps {
  player: Player;
  deathSummary: DeathSummary;
  state?: GameState;
  lifeCode?: string;
  onPlayAgain: () => void;
  onContinueDynasty?: () => void;
  onOpenDynasty?: () => void;
  onShareDone: (msg: string) => void;
}

export function EndOfLifeScreen({
  player,
  deathSummary,
  state,
  lifeCode,
  onPlayAgain,
  onContinueDynasty,
  onOpenDynasty,
  onShareDone,
}: EndOfLifeScreenProps) {
  const { t } = useI18n();
  const pp = state
    ? getAmountPurchasingPower(deathSummary.finalNetWorthToman, state, gameDataset)
    : null;

  const handleShareMemoryCard = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Warm off-white background
      ctx.fillStyle = '#FFFBF7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top orange banner
      const grad = ctx.createLinearGradient(0, 0, 720, 260);
      grad.addColorStop(0, '#F97316');
      grad.addColorStop(1, '#EA580C');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, 250);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px Vazirmatn, sans-serif';
      ctx.fillText('زندگینامه · یادگار یک عمر', 360, 88);

      ctx.font = 'bold 48px Vazirmatn, sans-serif';
      ctx.fillText(`${player.firstName} ${player.lastName}`, 360, 165);

      ctx.font = '500 26px Vazirmatn, sans-serif';
      ctx.fillText(
        `${formatAgeLabel(deathSummary.ageAtDeath)} · سال ${toPersianDigits(deathSummary.jalaliYearOfDeath)}`,
        360,
        215,
      );

      // Card body
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#F3E3D6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(48, 290, 624, 660, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 34px Vazirmatn, sans-serif';
      ctx.fillText(deathSummary.legacyTitle, 360, 365);

      ctx.fillStyle = '#2B1B12';
      ctx.font = 'bold 64px Vazirmatn, sans-serif';
      ctx.fillText(`${toPersianDigits(deathSummary.lifeScore)} امتیاز`, 360, 460);

      ctx.fillStyle = '#8A7568';
      ctx.font = '500 24px Vazirmatn, sans-serif';
      ctx.fillText(`علت پایان: ${deathSummary.causeOfDeath}`, 360, 525);
      const netWorthCardLine = `دارایی نهایی: ${formatMoneyTextForCanvas(deathSummary.finalNetWorthToman, 'IRT', state)}`;
      ctx.fillText(netWorthCardLine, 360, 575);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#2B1B12';
      ctx.font = 'bold 26px Vazirmatn, sans-serif';
      ctx.fillText('یادداشت‌های پایانی:', 630, 650);

      ctx.font = '500 22px Vazirmatn, sans-serif';
      deathSummary.highlights.slice(0, 4).forEach((line, idx) => {
        ctx.fillText(`• ${line}`, 630, 705 + idx * 48);
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = '#8A7568';
      ctx.font = '500 20px Vazirmatn, sans-serif';
      ctx.fillText('ساخته‌شده در بازی زندگینامه', 360, 1020);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) return;

      const file = new File([blob], `zendegi-${player.firstName}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `یادگار ${player.firstName} ${player.lastName}`,
          files: [file],
        });
        onShareDone('کارت یادگاری به اشتراک گذاشته شد');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zendegi-${player.firstName}-${deathSummary.jalaliYearOfDeath}.png`;
      a.click();
      URL.revokeObjectURL(url);
      onShareDone('تصویر کارت یادگاری دانلود شد');
    } catch {
      onShareDone('امکان ساخت تصویر در این مرورگر نبود');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <section className="rounded-3xl bg-gradient-to-bl from-[var(--primary)] to-[var(--primary-strong)] p-5 text-[var(--on-primary)] shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold opacity-90">
            <IconBrandMark className="h-6 w-6" />
            <span>{t('endOfLife.title')}</span>
          </div>
          <Badge tone="neutral">{toPersianDigits(deathSummary.jalaliYearOfDeath)}</Badge>
        </div>

        <h2 className="mt-3 text-xl font-bold">
          {player.firstName} {player.lastName}
        </h2>
        <p className="mt-1 text-xs opacity-90">{deathSummary.legacyTitle}</p>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/15 p-3">
          <div>
            <div className="text-xs opacity-85">{t('endOfLife.scoreLabel')}</div>
            <div className="text-2xl font-bold tabular-nums">
              {toPersianDigits(deathSummary.lifeScore)}
            </div>
          </div>
          <ProgressRing
            value={Math.min(1000, deathSummary.lifeScore)}
            max={1000}
            size={62}
            label={toPersianDigits(deathSummary.ageAtDeath)}
            colorVar="--on-primary"
          />
        </div>
      </section>

      <Card className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-muted)]">{t('endOfLife.causeLabel')}</span>
          <span className="font-bold">{deathSummary.causeOfDeath}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--text-muted)]">{t('endOfLife.netWorthLabel')}</span>
          <div className="flex flex-col items-end text-left">
            <MoneyText
              amount={deathSummary.finalNetWorthToman}
              currency="IRT"
              mode="stacked"
              stateOverride={state}
              className="items-end"
              primaryClassName="font-bold text-[var(--primary-strong)]"
            />
            {state && (
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                <MoneyText
                  amount={deathSummary.finalNetWorthToman}
                  currency="IRT"
                  mode="inline"
                  stateOverride={state}
                  primaryOverride="USD"
                />
                {pp ? ` · ${toPersianDigits(pp.tehran70SqmApts)} واحد ۷۰ متری تهران` : ''}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-2">
        <div className="text-xs font-bold">{t('endOfLife.highlightsLabel')}</div>
        <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
          {deathSummary.highlights.map((h, i) => (
            <li key={i} className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[var(--text)]">
              {h}
            </li>
          ))}
        </ul>
      </Card>

      {state?.horizonEnded && (
        <Card tinted className="space-y-1.5">
          <div className="text-xs font-bold text-[var(--primary-strong)]">
            پایان یک دوران تاریخی
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            تقویم شبیه‌سازی به افق مدل اقتصادی ({toPersianDigits(gameDataset.inheritance.rules.maxMacroJalaliYear)}) رسید. می‌توانی تمام فصل‌های خاندان را در تاریخچه دودمان مرور کنی یا زندگی تازه‌ای بسازی.
          </p>
        </Card>
      )}

      {state?.dynasty?.isClosed && (
        <Card tinted className="space-y-1.5">
          <div className="text-xs font-bold text-[var(--success)]">
            {state.dynasty.charityFoundationNameFa
              ? `بنیاد «${state.dynasty.charityFoundationNameFa}» ثبت شد`
              : 'دفتر دودمان با احترام بسته شد'}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            امتیاز دودمان: {toPersianDigits(state.dynasty.dynastyScore)} · نسل‌های ثبت‌شده:{' '}
            {toPersianDigits(Math.max(1, state.dynasty.chapters.length))}
          </p>
        </Card>
      )}

      <div className="space-y-2 pt-1">
        {onContinueDynasty && !state?.horizonEnded && !state?.dynasty?.isClosed && (
          <ActionButton
            label={t('legacy.continueDynasty')}
            onClick={onContinueDynasty}
          />
        )}
        {onOpenDynasty && (
          <ActionButton
            label={t('legacy.viewDynasty')}
            variant="secondary"
            onClick={onOpenDynasty}
          />
        )}
        <ActionButton
          label={t('endOfLife.playAgain')}
          icon={<IconReset className="h-4 w-4" />}
          variant={onContinueDynasty && !state?.horizonEnded && !state?.dynasty?.isClosed ? 'secondary' : 'primary'}
          onClick={onPlayAgain}
        />
        <ActionButton
          label={t('endOfLife.shareCard')}
          icon={<IconShare className="h-4 w-4" />}
          variant="secondary"
          onClick={handleShareMemoryCard}
        />
        {lifeCode && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(lifeCode);
                    onShareDone('کد زندگی در حافظه کپی شد');
                  }
                } catch {
                  onShareDone('امکان کپی کد زندگی در این مرورگر نبود');
                }
              }}
              className="min-h-[44px] rounded-xl px-4 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              {t('endOfLife.copyLifeCode')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
