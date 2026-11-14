interface CountryFlagProps {
  countryId: string;
  labelFa?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: { w: 20, h: 14 },
  sm: { w: 28, h: 20 },
  md: { w: 36, h: 26 },
  lg: { w: 48, h: 34 },
} as const;

const COUNTRY_LABEL_FA: Record<string, string> = {
  iran: 'پرچم ایران',
  turkey: 'پرچم ترکیه',
  germany: 'پرچم آلمان',
  uae: 'پرچم امارات',
  uk: 'پرچم بریتانیا',
  canada: 'پرچم کانادا',
  generic_template: 'پرچم کشور مقصد',
};

export function CountryFlag({
  countryId,
  labelFa,
  size = 'md',
  className = '',
}: CountryFlagProps) {
  const dims = SIZE_MAP[size];
  const ariaLabel = labelFa ?? COUNTRY_LABEL_FA[countryId] ?? 'پرچم کشور';

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 overflow-hidden rounded-md border border-[var(--border)] shadow-2xs ${className}`}
      style={{ width: dims.w, height: dims.h }}
    >
      {countryId === 'iran' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="36" height="8" y="0" fill="#239F40" />
          <rect width="36" height="8" y="8" fill="#FFFFFF" />
          <rect width="36" height="8" y="16" fill="#DA0000" />
          <circle cx="18" cy="12" r="2.2" fill="#DA0000" opacity="0.88" />
        </svg>
      ) : countryId === 'turkey' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="36" height="24" fill="#E30A17" />
          <circle cx="14.5" cy="12" r="5.5" fill="#FFFFFF" />
          <circle cx="16" cy="12" r="4.3" fill="#E30A17" />
          <polygon
            points="22,9.2 22.8,11.3 25,11.3 23.2,12.6 23.9,14.8 22,13.5 20.1,14.8 20.8,12.6 19,11.3 21.2,11.3"
            fill="#FFFFFF"
          />
        </svg>
      ) : countryId === 'germany' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="36" height="8" y="0" fill="#18181B" />
          <rect width="36" height="8" y="8" fill="#DD0000" />
          <rect width="36" height="8" y="16" fill="#FFCE00" />
        </svg>
      ) : countryId === 'uae' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="27" height="8" x="9" y="0" fill="#00732F" />
          <rect width="27" height="8" x="9" y="8" fill="#FFFFFF" />
          <rect width="27" height="8" x="9" y="16" fill="#111827" />
          <rect width="9" height="24" x="0" y="0" fill="#FF0000" />
        </svg>
      ) : countryId === 'uk' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="36" height="24" fill="#012169" />
          <path d="M0,0 L36,24 M36,0 L0,24" stroke="#FFFFFF" strokeWidth="4.2" />
          <path d="M0,0 L36,24 M36,0 L0,24" stroke="#C8102E" strokeWidth="2.1" />
          <path d="M18,0 V24 M0,12 H36" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M18,0 V24 M0,12 H36" stroke="#C8102E" strokeWidth="3.6" />
        </svg>
      ) : countryId === 'canada' ? (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="9" height="24" x="0" fill="#D80621" />
          <rect width="18" height="24" x="9" fill="#FFFFFF" />
          <rect width="9" height="24" x="27" fill="#D80621" />
          <path
            d="M18 5.2 L19.4 9.1 L22.6 8.3 L20.9 11.4 L23 12.8 L19.2 14.3 L19.8 16.5 L18.5 16.2 L18.5 19 L17.5 19 L17.5 16.2 L16.2 16.5 L16.8 14.3 L13 12.8 L15.1 11.4 L13.4 8.3 L16.6 9.1 Z"
            fill="#D80621"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 36 24" width={dims.w} height={dims.h} aria-hidden="true">
          <rect width="36" height="24" fill="#F1F5F9" />
          <circle cx="18" cy="12" r="6.5" fill="none" stroke="#0F766E" strokeWidth="1.8" />
          <ellipse cx="18" cy="12" rx="3" ry="6.5" fill="none" stroke="#0F766E" strokeWidth="1.4" />
          <line x1="11.5" y1="12" x2="24.5" y2="12" stroke="#0F766E" strokeWidth="1.4" />
        </svg>
      )}
    </span>
  );
}
