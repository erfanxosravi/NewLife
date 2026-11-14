import type { Gender, PersonOriginKind } from '../../engine/types';

export interface PersonAvatarProps {
  seed?: string;
  gender: Gender;
  age: number;
  size?: number;
  className?: string;
  originKind?: PersonOriginKind;
  deceased?: boolean;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BG_PALETTE = [
  '#FFF1E6',
  '#FFE8D6',
  '#FDEBD0',
  '#EAF4F4',
  '#E8EEF5',
  '#F3EDF7',
  '#EEF5EA',
  '#FDF2E9',
];

const SKIN_TONES = ['#F7D5BA', '#EFC29F', '#E2AF86', '#D49A6E', '#F3CCB0'];
const HAIR_COLORS_YOUNG = ['#2C221E', '#3D2B1F', '#4E3629', '#1E1B18', '#5B3E2B'];
const HAIR_COLORS_ELDER = ['#8A8D93', '#A6ABB2', '#6F7278', '#B7BCC2'];
const SHIRT_COLORS = [
  '#EA580C',
  '#D97706',
  '#0D9488',
  '#2563EB',
  '#7C3AED',
  '#BE185D',
  '#059669',
  '#475569',
];
const SCARF_COLORS = ['#F97316', '#0EA5E9', '#10B981', '#8B5CF6', '#EC4899', '#D97706'];

export function PersonAvatar({
  seed = 'default',
  gender,
  age,
  size = 40,
  className = '',
  originKind,
  deceased = false,
}: PersonAvatarProps) {
  const h = hashSeed(`${seed}_${gender}`);
  const h2 = hashSeed(`${seed}_v2_${gender}`);
  const h3 = hashSeed(`${seed}_v3`);

  const bg = deceased ? 'var(--surface-2)' : BG_PALETTE[h % BG_PALETTE.length];
  const skin = SKIN_TONES[(h >>> 3) % SKIN_TONES.length];
  const shirt =
    originKind === 'inspector'
      ? '#1E3A5F'
      : originKind === 'mentor'
        ? '#0F766E'
        : SHIRT_COLORS[(h2 >>> 2) % SHIRT_COLORS.length];

  const isInfant = age <= 2;
  const isChild = age >= 3 && age <= 11;
  const isElder = age >= 58;

  const hairColor = isElder
    ? HAIR_COLORS_ELDER[(h >>> 5) % HAIR_COLORS_ELDER.length]
    : HAIR_COLORS_YOUNG[(h >>> 5) % HAIR_COLORS_YOUNG.length];

  const hairVariant = h2 % 3;
  const wearsScarf = gender === 'female' && age >= 14 && (h3 % 5) < 2;
  const scarfColor = SCARF_COLORS[(h3 >>> 3) % SCARF_COLORS.length];
  const hasGlasses = age >= 16 && ((h2 >>> 6) % 4 === 0 || (originKind === 'inspector' && h2 % 2 === 0));
  const hasBeard = gender === 'male' && age >= 24 && (h3 % 3 === 0);
  const hasMustache = gender === 'male' && age >= 22 && !hasBeard && (h3 % 4 === 1);
  const rosyCheeks = isInfant || isChild || (h3 % 3 === 0);

  return (
    <div
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] ${
        deceased ? 'grayscale opacity-75' : ''
      } ${className}`}
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
        {/* Shoulders / outfit */}
        <path
          d={
            isInfant
              ? 'M16 64 C16 49, 48 49, 48 64 Z'
              : 'M11 64 C12 46, 52 46, 53 64 Z'
          }
          fill={shirt}
        />
        {/* Collar / bib */}
        {isInfant ? (
          <path d="M23 50 Q32 58 41 50 L38 56 Q32 60 26 56 Z" fill="#FFFFFF" opacity="0.92" />
        ) : (
          <path d="M26 48 L32 54 L38 48" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.55" fill="none" />
        )}

        {/* Back hair for female without scarf */}
        {gender === 'female' && !wearsScarf && !isInfant && (
          <path
            d={
              hairVariant === 0
                ? 'M14.5 29 C13.5 44, 15.5 52, 22 54.5 L42 54.5 C48.5 52, 50.5 44, 49.5 29 C49 14, 15 14, 14.5 29 Z'
                : hairVariant === 1
                  ? 'M15 29 C14 41, 16 49, 21.5 52 L42.5 52 C48 49, 50 41, 49 29 C48.5 14.5, 15.5 14.5, 15 29 Z'
                  : 'M14 30 C13 46, 16 54, 23 55.5 L41 55.5 C48 54, 51 46, 50 30 C49 14, 15 14, 14 30 Z'
            }
            fill={hairColor}
          />
        )}

        {/* Headscarf back */}
        {wearsScarf && (
          <path
            d="M15 30 C15 14, 49 14, 49 30 L51 54 C41 57, 23 57, 13 54 Z"
            fill={scarfColor}
          />
        )}

        {/* Neck */}
        {!isInfant && <rect x="28" y="40" width="8" height="9" rx="3" fill={skin} />}

        {/* Ears */}
        {!wearsScarf && (
          <>
            <circle cx="19.5" cy="31" r="3" fill={skin} />
            <circle cx="44.5" cy="31" r="3" fill={skin} />
          </>
        )}

        {/* Head */}
        <ellipse cx="32" cy={isInfant ? '32' : '29.5'} rx={isInfant ? '13.5' : '12.5'} ry={isInfant ? '13' : '13.5'} fill={skin} />

        {/* Rosy cheeks */}
        {rosyCheeks && (
          <>
            <circle cx="24" cy={isInfant ? '35' : '33'} r="2.2" fill="#F43F5E" opacity="0.22" />
            <circle cx="40" cy={isInfant ? '35' : '33'} r="2.2" fill="#F43F5E" opacity="0.22" />
          </>
        )}

        {/* Eyes */}
        <circle cx="27" cy={isInfant ? '31' : '28.5'} r="1.7" fill="#1F2937" />
        <circle cx="37" cy={isInfant ? '31' : '28.5'} r="1.7" fill="#1F2937" />
        <circle cx="27.5" cy={isInfant ? '30.5' : '28'} r="0.5" fill="#FFFFFF" />
        <circle cx="37.5" cy={isInfant ? '30.5' : '28'} r="0.5" fill="#FFFFFF" />

        {/* Brows */}
        {!isInfant && (
          <>
            <path d="M24.2 25.2 Q27 24 29.5 25" stroke={hairColor} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M34.5 25 Q37 24 39.8 25.2" stroke={hairColor} strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}

        {/* Smile */}
        <path
          d={isInfant ? 'M29 36.5 Q32 39 35 36.5' : 'M28.5 35.5 Q32 38.2 35.5 35.5'}
          stroke="#9A5B47"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Facial hair */}
        {hasBeard && (
          <path
            d="M21 32 C21 41, 26 44, 32 44 C38 44, 43 41, 43 32 C41 37, 37 40, 32 40 C27 40, 23 37, 21 32 Z"
            fill={hairColor}
            opacity="0.88"
          />
        )}
        {hasMustache && (
          <path
            d="M27.5 34 Q32 32.5 36.5 34"
            stroke={hairColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Glasses */}
        {hasGlasses && (
          <g stroke="#334155" strokeWidth="1.3" fill="none">
            <rect x="23" y="25.5" width="7.5" height="5.5" rx="2" />
            <rect x="33.5" y="25.5" width="7.5" height="5.5" rx="2" />
            <line x1="30.5" y1="28.2" x2="33.5" y2="28.2" />
          </g>
        )}

        {/* Top Hair */}
        {isInfant ? (
          <path
            d="M28 19 C30 15, 34 15, 36 19 C34 18, 31 18, 28 19 Z"
            fill={hairColor}
          />
        ) : wearsScarf ? (
          <path
            d="M20 24 C23 19, 41 19, 44 24 C41 16, 23 16, 20 24 Z"
            fill={hairColor}
            opacity="0.85"
          />
        ) : gender === 'female' ? (
          <path
            d={
              hairVariant === 2
                ? 'M19 28 C19 15, 45 15, 45 28 C41 21, 35 20, 32 23 C29 20, 23 21, 19 28 Z'
                : 'M19 27 C19 14, 45 14, 45 27 C40 20, 24 20, 19 27 Z'
            }
            fill={hairColor}
          />
        ) : (
          <path
            d={
              hairVariant === 0
                ? 'M19.5 27 C19 15, 45 15, 44.5 27 C41 20, 23 20, 19.5 27 Z'
                : hairVariant === 1
                  ? 'M19.5 27 C19 14, 44 13, 44.5 26 C39 18, 28 21, 19.5 27 Z'
                  : 'M20 26 C21 15, 43 15, 44 26 C40 21, 24 21, 20 26 Z'
            }
            fill={hairColor}
          />
        )}
      </svg>
    </div>
  );
}
