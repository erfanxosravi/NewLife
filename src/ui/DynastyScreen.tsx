import { useState } from 'react';
import { gameDataset } from '../data/registry';
import { calculateNetWorthToman } from '../engine/economy';
import { formatAgeLabel, formatToman, toPersianDigits } from '../engine/jalali';
import { ensureDynastyState, getDynastyHallOfFameLeaders } from '../engine/legacy';
import type { DynastyWealthPoint, SaveGame } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { FullScreenSheet } from './components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  CurrencyText,
  EmptyState,
  SectionHeader,
  SegmentedControl,
  StatBar,
} from './components/Primitives';
import { FamilyTreeView } from './FamilyTreeView';
import { IconBrandMark, IconShare, IconSparkles, IconTrophy } from './icons';

interface DynastyScreenProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onShareDone: (msg: string) => void;
}

type DynastyTab = 'tree' | 'stats' | 'hall';

function DynastyWealthChart({ points }: { points: DynastyWealthPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-muted)]">
        نمودار ثروت واقعی دودمان پس از ثبت دست‌کم دو نسل نمایش داده می‌شود.
      </div>
    );
  }

  const width = 300;
  const height = 110;
  const values = points.map((p) => Math.max(0, p.real1405Toman));
  const maxVal = Math.max(...values, 1);
  const coords = points.map((p, idx) => {
    const x = 16 + (idx / (points.length - 1)) * (width - 32);
    const y = height - 22 - (Math.max(0, p.real1405Toman) / maxVal) * (height - 36);
    return { x, y, point: p };
  });

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height - 20} ${linePoints} ${coords[coords.length - 1].x.toFixed(1)},${height - 20}`;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        aria-label="نمودار ثروت واقعی دودمان در گذر نسل‌ها"
      >
        <polygon points={areaPoints} fill="var(--primary-soft)" opacity="0.6" />
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
        {coords.map((c) => (
          <g key={`${c.point.generation}_${c.point.year}`}>
            <circle cx={c.x} cy={c.y} r="4" fill="var(--primary-strong)" />
            <text
              x={c.x}
              y={height - 5}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-muted)"
            >
              ن{toPersianDigits(c.point.generation)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>مبنا: ارزش واقعی ۱۴۰۵</span>
        <span>بیشینه: {formatToman(maxVal)}</span>
      </div>
    </div>
  );
}

export function DynastyScreen({
  open,
  saveGame,
  onClose,
  onShareDone,
}: DynastyScreenProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<DynastyTab>('tree');
  const { state } = saveGame;
  const dynasty = ensureDynastyState(state, saveGame.seed);
  const leaders = getDynastyHallOfFameLeaders(dynasty);

  const totalYearsLived =
    dynasty.chapters.reduce((sum, c) => sum + c.ageAtDeath, 0) + state.player.age;
  const liveNominal = calculateNetWorthToman(state);
  const chartPoints: DynastyWealthPoint[] =
    state.isAlive && !dynasty.wealthTimeline.some((p) => p.generation === dynasty.currentGeneration)
      ? [
          ...dynasty.wealthTimeline,
          {
            year: state.currentJalaliYear,
            generation: dynasty.currentGeneration,
            nominalToman: liveNominal,
            real1405Toman: Math.round(
              liveNominal / Math.max(0.000001, state.inflationMultiplier),
            ),
            labelFa: `${state.player.firstName} ${state.player.lastName}`,
          },
        ]
      : dynasty.wealthTimeline;

  const handleShareDynastyCard = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFBF7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad = ctx.createLinearGradient(0, 0, 720, 240);
      grad.addColorStop(0, '#F97316');
      grad.addColorStop(1, '#EA580C');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, 240);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px Vazirmatn, sans-serif';
      ctx.fillText('زندگینامه · تاریخچه دودمان', 360, 76);

      ctx.font = 'bold 46px Vazirmatn, sans-serif';
      ctx.fillText(dynasty.dynastyNameFa, 360, 145);

      ctx.font = '500 24px Vazirmatn, sans-serif';
      ctx.fillText(
        `بنیان‌گذار: ${dynasty.founderNameFa} · ${toPersianDigits(dynasty.currentGeneration)} نسل`,
        360,
        198,
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#F3E3D6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(48, 280, 624, 650, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 52px Vazirmatn, sans-serif';
      ctx.fillText(`${toPersianDigits(dynasty.dynastyScore)} امتیاز دودمان`, 360, 365);

      ctx.fillStyle = '#2B1B12';
      ctx.font = '500 24px Vazirmatn, sans-serif';
      ctx.fillText(
        `مجموع سال‌های زیسته: ${toPersianDigits(totalYearsLived)} سال · اعتبار خانواده: ${toPersianDigits(dynasty.familyReputation)}٪`,
        360,
        425,
      );

      ctx.textAlign = 'right';
      ctx.font = 'bold 26px Vazirmatn, sans-serif';
      ctx.fillText('فصل‌های ثبت‌شده:', 630, 500);

      ctx.font = '500 21px Vazirmatn, sans-serif';
      dynasty.chapters.slice(-5).forEach((ch, idx) => {
        ctx.fillText(
          `• نسل ${toPersianDigits(ch.generation)}: ${ch.firstName} ${ch.lastName} (${ch.highestJobTitleFa})`,
          630,
          550 + idx * 46,
        );
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = '#8A7568';
      ctx.font = '500 20px Vazirmatn, sans-serif';
      ctx.fillText('ساخته‌شده در بازی زندگینامه', 360, 990);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) return;

      const file = new File([blob], `dynasty-${dynasty.currentGeneration}.png`, {
        type: 'image/png',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: dynasty.dynastyNameFa,
          files: [file],
        });
        onShareDone('کارت دودمان به اشتراک گذاشته شد');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zendegi-dynasty-${dynasty.currentGeneration}.png`;
      a.click();
      URL.revokeObjectURL(url);
      onShareDone('تصویر کارت دودمان دانلود شد');
    } catch {
      onShareDone('امکان ساخت تصویر در این مرورگر نبود');
    }
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('legacy.dynastyScreenTitle')}
      subtitle={`${dynasty.dynastyNameFa} · نسل ${toPersianDigits(dynasty.currentGeneration)}`}
    >
      <div className="space-y-3.5 pb-6">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          items={[
            { value: 'tree', label: t('legacy.tabTree') },
            { value: 'stats', label: t('legacy.tabStats') },
            { value: 'hall', label: t('legacy.tabHall') },
          ]}
        />

        {tab === 'tree' && <FamilyTreeView state={state} />}

        {tab === 'stats' && (
          <div className="space-y-3">
            <Card tinted className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconBrandMark className="h-6 w-6" />
                  <div>
                    <div className="text-sm font-bold">{dynasty.dynastyNameFa}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      بنیان‌گذار: {dynasty.founderNameFa}
                    </div>
                  </div>
                </div>
                <Badge tone="primary">
                  {toPersianDigits(dynasty.dynastyScore)} امتیاز
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-[var(--surface)] p-2.5">
                  <div className="text-[10px] text-[var(--text-muted)]">نسل‌ها</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums">
                    {toPersianDigits(dynasty.currentGeneration)}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface)] p-2.5">
                  <div className="text-[10px] text-[var(--text-muted)]">سال‌های زیسته</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums">
                    {toPersianDigits(totalYearsLived)}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface)] p-2.5">
                  <div className="text-[10px] text-[var(--text-muted)]">نشان دودمان</div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums">
                    {toPersianDigits(dynasty.unlockedDynastyRibbons.length)} /{' '}
                    {toPersianDigits(gameDataset.inheritance.dynastyRibbons.length)}
                  </div>
                </div>
              </div>

              <StatBar
                label="اعتبار و خوش‌نامی خانواده"
                value={dynasty.familyReputation}
                colorVar="--primary"
              />

              {dynasty.charityFoundationNameFa && (
                <div className="rounded-xl bg-[var(--success)]/12 px-3 py-2 text-xs font-bold text-[var(--success)]">
                  بنیاد ثبت‌شده: {dynasty.charityFoundationNameFa}
                </div>
              )}
            </Card>

            <Card className="space-y-2.5">
              <SectionHeader
                title="ثروت تجمعی در گذر زمان (تعدیل‌شده با تورم)"
                subtitle="مقایسه قدرت خرید واقعی خاندان در پایان هر نسل"
              />
              <DynastyWealthChart points={chartPoints} />
            </Card>

            <Card className="space-y-2.5">
              <SectionHeader
                title="نشان‌های دودمان"
                subtitle="دستاوردهای مشترک در طول نسل‌ها"
              />
              <div className="space-y-2">
                {gameDataset.inheritance.dynastyRibbons.map((ribbon) => {
                  const unlocked = dynasty.unlockedDynastyRibbons.includes(ribbon.id);
                  return (
                    <div
                      key={ribbon.id}
                      className={`rounded-xl border border-[var(--border)] p-3 ${
                        unlocked ? 'bg-[var(--primary-soft)]/50' : 'bg-[var(--surface-2)] opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--text)]">
                          {ribbon.titleFa}
                        </span>
                        <Badge tone={unlocked ? 'success' : 'neutral'}>
                          {unlocked ? 'باز شده' : 'قفل'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {ribbon.descriptionFa}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <ActionButton
              label={t('legacy.shareDynastyCard')}
              icon={<IconShare className="h-4 w-4" />}
              variant="secondary"
              onClick={handleShareDynastyCard}
            />
          </div>
        )}

        {tab === 'hall' && (
          <div className="space-y-3">
            <Card className="space-y-2.5">
              <SectionHeader
                title="تالار افتخار نیاکان"
                subtitle="برترین عضو خاندان در هر شاخص"
              />
              {dynasty.chapters.length === 0 ? (
                <EmptyState
                  icon={<IconTrophy className="h-5 w-5" />}
                  title="هنوز فصلی به پایان نرسیده است"
                  description="با پایان هر زندگی و ادامه دودمان، برترین‌های هر نسل اینجا ثبت می‌شوند."
                />
              ) : (
                <div className="space-y-2 text-xs">
                  {leaders.wealthiest && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-2.5">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">ثروتمندترین (ارزش واقعی)</div>
                        <div className="font-bold">
                          {leaders.wealthiest.firstName} {leaders.wealthiest.lastName}
                        </div>
                      </div>
                      <CurrencyText
                        amountToman={leaders.wealthiest.real1405NetWorthToman}
                        className="font-bold text-[var(--primary-strong)]"
                      />
                    </div>
                  )}
                  {leaders.mostFamous && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-2.5">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">سرشناس‌ترین</div>
                        <div className="font-bold">
                          {leaders.mostFamous.firstName} {leaders.mostFamous.lastName}
                        </div>
                      </div>
                      <Badge tone="primary">
                        شهرت {toPersianDigits(leaders.mostFamous.fameAtDeath ?? 0)}٪
                      </Badge>
                    </div>
                  )}
                  {leaders.longestLived && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-2.5">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">طولانی‌ترین عمر</div>
                        <div className="font-bold">
                          {leaders.longestLived.firstName} {leaders.longestLived.lastName}
                        </div>
                      </div>
                      <Badge tone="neutral">{formatAgeLabel(leaders.longestLived.ageAtDeath)}</Badge>
                    </div>
                  )}
                  {leaders.mostEducated && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-2.5">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">تحصیل‌کرده‌ترین</div>
                        <div className="font-bold">
                          {leaders.mostEducated.firstName} {leaders.mostEducated.lastName}
                        </div>
                      </div>
                      <Badge tone="neutral">
                        {t(`education.stageLabels.${leaders.mostEducated.educationLevel ?? 'none'}`)}
                      </Badge>
                    </div>
                  )}
                  {leaders.mostGenerous && (
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-2.5">
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)]">بخشنده‌ترین (وقف و خیریه)</div>
                        <div className="font-bold">
                          {leaders.mostGenerous.firstName} {leaders.mostGenerous.lastName}
                        </div>
                      </div>
                      <CurrencyText
                        amountToman={leaders.mostGenerous.charityContributionToman ?? 0}
                        className="font-bold text-[var(--success)]"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            {dynasty.chapters.length > 0 && (
              <Card className="space-y-2.5">
                <SectionHeader title="دفتر فصل‌های خاندان" />
                <div className="space-y-2">
                  {[...dynasty.chapters].reverse().map((ch) => (
                    <div
                      key={`chap_${ch.generation}_${ch.deathYear}`}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--text)]">
                          نسل {toPersianDigits(ch.generation)}: {ch.firstName} {ch.lastName}
                        </span>
                        <Badge tone="primary">{toPersianDigits(ch.lifeScore)} امتیاز</Badge>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {toPersianDigits(ch.birthYear)} تا {toPersianDigits(ch.deathYear)} ·{' '}
                        {formatAgeLabel(ch.ageAtDeath)} · {ch.cityNameFa}
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--text)]">
                        {ch.summaryFa ??
                          `${ch.firstName} ${ch.lastName} با پیشه «${ch.highestJobTitleFa}» و عنوان «${ch.legacyTitle}» زندگی کرد.`}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {dynasty.ancestorMemoriesFa.length > 0 && (
              <Card className="space-y-2">
                <SectionHeader title="خاطرات ماندگار نسل‌ها" />
                <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                  {dynasty.ancestorMemoriesFa.map((mem, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] p-2.5 text-[var(--text)]"
                    >
                      <IconSparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                      <span>{mem}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <ActionButton
              label={t('legacy.shareDynastyCard')}
              icon={<IconShare className="h-4 w-4" />}
              variant="secondary"
              onClick={handleShareDynastyCard}
            />
          </div>
        )}
      </div>
    </FullScreenSheet>
  );
}
