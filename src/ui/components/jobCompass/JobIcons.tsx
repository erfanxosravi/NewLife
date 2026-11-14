import type { JobCompassAxis, JobIconKey } from '../../../engine/types';

const EMOJI_ARIA_LABELS: Record<string, string> = {
  '💰': 'درآمد',
  '🧘': 'آرامش',
  '🛡️': 'امنیت',
  '🚀': 'رشد',
  '🕊️': 'آزادی',
  '⭐': 'همسو با استعداد',
  '🎯': 'هدف شغلی',
  '🚕': 'تاکسی',
  '⛽': 'هزینه سوخت',
  '✂️': 'آرایشگری',
  '🎨': 'مهارتی',
  '🧍': 'کار ایستاده',
  '🏪': 'بازار',
  '🤝': 'ارتباطی',
  '📊': 'متغیر',
  '💻': 'فناوری',
  '🏠': 'دورکاری',
  '🏛️': 'دولتی',
  '📚': 'آموزش',
  '🏥': 'درمانی',
  '🌙': 'شیفت شب',
  '🩺': 'پزشکی',
  '💎': 'سقف درآمدی',
  '⏳': 'زمان‌بر',
  '💊': 'داروخانه',
  '⚖️': 'حقوقی',
  '🧠': 'تحلیلی',
  '🔒': 'قفل',
  '🌅': 'صبح',
  '☕': 'ظهر',
  '🧴': 'صبح',
  '🧹': 'شب',
  '🔑': 'صبح',
  '🧾': 'ظهر',
  '🧮': 'شب',
  '⌨️': 'ظهر',
  '🎧': 'شب',
  '🔔': 'صبح',
  '📝': 'ظهر',
  '🏡': 'عصر',
  '🗂️': 'صبح',
  '🍲': 'ظهر',
  '🕔': 'عصر',
  '💉': 'عصر',
  '📋': 'ظهر',
  '📟': 'شب',
  '🔍': 'ظهر',
  '📦': 'عصر',
  '📜': 'ظهر',
};

export function EmojiSprite({
  emoji,
  label,
  className = 'text-sm leading-none',
}: {
  emoji: string;
  label?: string;
  className?: string;
}) {
  const ariaLabel = label ?? EMOJI_ARIA_LABELS[emoji] ?? emoji;
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center justify-center select-none ${className}`}
    >
      {emoji}
    </span>
  );
}

const JOB_TILE_STYLES: Record<
  JobIconKey,
  { bg: string; fg: string; accent: string; labelFa: string }
> = {
  taxi: {
    bg: 'bg-amber-500/15 dark:bg-amber-400/18',
    fg: 'text-amber-700 dark:text-amber-300',
    accent: '#D97706',
    labelFa: 'حمل‌ونقل',
  },
  scissors: {
    bg: 'bg-orange-500/15 dark:bg-orange-400/18',
    fg: 'text-orange-700 dark:text-orange-300',
    accent: '#EA580C',
    labelFa: 'آرایشگری',
  },
  bazaar: {
    bg: 'bg-rose-500/14 dark:bg-rose-400/18',
    fg: 'text-rose-700 dark:text-rose-300',
    accent: '#E11D48',
    labelFa: 'بازار و تجارت',
  },
  code: {
    bg: 'bg-blue-500/14 dark:bg-blue-400/18',
    fg: 'text-blue-700 dark:text-blue-300',
    accent: '#2563EB',
    labelFa: 'نرم‌افزار',
  },
  chalkboard: {
    bg: 'bg-emerald-500/14 dark:bg-emerald-400/18',
    fg: 'text-emerald-700 dark:text-emerald-300',
    accent: '#059669',
    labelFa: 'آموزش',
  },
  desk: {
    bg: 'bg-slate-500/14 dark:bg-slate-400/18',
    fg: 'text-slate-700 dark:text-slate-300',
    accent: '#475569',
    labelFa: 'اداری',
  },
  heartPulse: {
    bg: 'bg-teal-500/14 dark:bg-teal-400/18',
    fg: 'text-teal-700 dark:text-teal-300',
    accent: '#0D9488',
    labelFa: 'پرستاری',
  },
  stethoscope: {
    bg: 'bg-red-500/14 dark:bg-red-400/18',
    fg: 'text-red-700 dark:text-red-300',
    accent: '#DC2626',
    labelFa: 'پزشکی',
  },
  mortar: {
    bg: 'bg-cyan-500/14 dark:bg-cyan-400/18',
    fg: 'text-cyan-700 dark:text-cyan-300',
    accent: '#0891B2',
    labelFa: 'داروسازی',
  },
  scales: {
    bg: 'bg-indigo-500/14 dark:bg-indigo-400/18',
    fg: 'text-indigo-700 dark:text-indigo-300',
    accent: '#4F46E5',
    labelFa: 'حقوق و وکالت',
  },
};

function renderJobDuotoneSvg(iconKey: JobIconKey) {
  switch (iconKey) {
    case 'taxi':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="10" y="4" width="8" height="3.5" rx="1.2" fill="currentColor" opacity="0.3" />
          <path
            d="M6.5 11.5L8.2 7.8C8.6 7 9.4 6.5 10.3 6.5H17.7C18.6 6.5 19.4 7 19.8 7.8L21.5 11.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <rect
            x="4.5"
            y="11.5"
            width="19"
            height="8"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" />
          <circle cx="19.5" cy="15.5" r="1.4" fill="currentColor" />
          <path d="M7 19.5V21.5M21 19.5V21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'scissors':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="9" r="3.2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="8.5" cy="19" r="3.2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" />
          <path d="M11.2 10.6L22.5 19M11.2 17.4L22.5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'bazaar':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M4.5 11L6.5 5.5H21.5L23.5 11C23.5 12.8 22 14 20.3 14C18.8 14 17.5 13 17.2 11.7C16.8 13 15.5 14 14 14C12.5 14 11.2 13 10.8 11.7C10.5 13 9.2 14 7.7 14C6 14 4.5 12.8 4.5 11Z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M6.5 14V22.5H21.5V14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="11.5" y="16.5" width="5" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="20" height="15" rx="2.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10.5 10.5L7.5 13L10.5 15.5M17.5 10.5L20.5 13L17.5 15.5M15 9.8L13 16.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 23H18.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'chalkboard':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="4.5" y="6" width="19" height="13" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.9" />
          <path d="M8.5 11H16.5M8.5 14.5H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 19L7 23M19 19L21 23M14 19V22.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'desk':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="6" y="5" width="16" height="18" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 9.5H18M10 13.5H18M10 17.5H14.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'heartPulse':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M14 22.8C14 22.8 5 17 5 10.6C5 7.7 7.2 5.5 10 5.5C11.7 5.5 13.2 6.4 14 7.7C14.8 6.4 16.3 5.5 18 5.5C20.8 5.5 23 7.7 23 10.6C23 17 14 22.8 14 22.8Z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8.5 13H11.2L12.7 10.2L15 15.8L16.7 13H19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'stethoscope':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M7.5 5.5V11C7.5 14 9.8 16.2 12.8 16.2C15.8 16.2 18.1 14 18.1 11V5.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path d="M12.8 16.2V18.5C12.8 20.9 14.7 22.8 17.1 22.8C19.5 22.8 21.4 20.9 21.4 18.5V15.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="21.4" cy="13.5" r="2.3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'mortar':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="6" y="7" width="16" height="15" rx="3" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14 10.5V18.5M10 14.5H18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 4.5H18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'scales':
      return (
        <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M14 5V22.5M9.5 22.5H18.5M6.5 8.5H21.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M6.5 8.5L4.5 14.5H8.5L6.5 8.5ZM21.5 8.5L19.5 14.5H23.5L21.5 8.5Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function JobIconTile({
  iconKey,
  talentMatched = false,
  talentReasonFa,
  dimmed = false,
  size = 'md',
}: {
  iconKey: JobIconKey;
  talentMatched?: boolean;
  talentReasonFa?: string;
  dimmed?: boolean;
  size?: 'md' | 'lg';
}) {
  const style = JOB_TILE_STYLES[iconKey] ?? JOB_TILE_STYLES.desk;
  const dimClass = dimmed ? 'opacity-70 saturate-75' : '';
  const sizeClass = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-12 w-12 rounded-2xl';

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${sizeClass} ${style.bg} ${style.fg} ${dimClass}`}
      aria-label={style.labelFa}
    >
      {renderJobDuotoneSvg(iconKey)}
      {talentMatched && (
        <span
          title={talentReasonFa ?? 'همسو با استعداد کشف‌شده'}
          aria-label={talentReasonFa ?? 'همسو با استعداد کشف‌شده'}
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--primary)] text-xs leading-none shadow-xs"
        >
          <span role="img" aria-hidden="true" className="text-[12px]">
            ⭐
          </span>
        </span>
      )}
    </div>
  );
}

export function AxisEmoji({ axis }: { axis: JobCompassAxis }) {
  const map: Record<JobCompassAxis, { emoji: string; label: string }> = {
    income: { emoji: '💰', label: 'درآمد' },
    calm: { emoji: '🧘', label: 'آرامش' },
    security: { emoji: '🛡️', label: 'امنیت' },
    growth: { emoji: '🚀', label: 'رشد' },
    freedom: { emoji: '🕊️', label: 'آزادی' },
  };
  const item = map[axis];
  return <EmojiSprite emoji={item.emoji} label={item.label} />;
}
