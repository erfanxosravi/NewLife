import { useMemo, useState } from 'react';
import { gameDataset } from '../data/registry';
import { createNewSaveGame } from '../engine/generator';
import { toPersianDigits } from '../engine/jalali';
import { generateRandomSeedString, SeededRNG } from '../engine/rng';
import type { Ethnicity, Gender, SaveGame } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { triggerHaptic } from '../utils/haptics';
import { ActionButton, Card, SegmentedControl } from './components/Primitives';
import { IconBrandMark, IconChevronDown, IconDice, IconSparkles } from './icons';

interface CharacterCreationProps {
  targetSlotId: string;
  debugSeed?: string;
  onCreate: (save: SaveGame) => void;
  onCancel?: () => void;
}

const ETHNICITY_KEYS = Object.keys(gameDataset.names.ethnicities) as Ethnicity[];

export function CharacterCreation({
  targetSlotId,
  debugSeed,
  onCreate,
  onCancel,
}: CharacterCreationProps) {
  const { t } = useI18n();
  const [genderMode, setGenderMode] = useState<'random' | Gender>('random');
  const [ethnicityMode, setEthnicityMode] = useState<'random' | Ethnicity>('random');
  const [cityMode, setCityMode] = useState<'random' | string>('random');
  const [birthYearMode, setBirthYearMode] = useState<'random' | number>('random');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [startingScenarioId, setStartingScenarioId] = useState<'standard' | 'welfare_center'>('standard');
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  const selectedCity = useMemo(
    () =>
      cityMode === 'random'
        ? null
        : gameDataset.cities.find((c) => c.id === cityMode) ?? null,
    [cityMode],
  );

  const handleSuggestName = () => {
    triggerHaptic('light');
    const rng = new SeededRNG(generateRandomSeedString());
    const activeEth: Ethnicity =
      ethnicityMode !== 'random'
        ? ethnicityMode
        : selectedCity
          ? rng.pick(selectedCity.primaryEthnicities)
          : rng.pick(ETHNICITY_KEYS);
    const activeGender: Gender =
      genderMode !== 'random' ? genderMode : rng.chance(0.5) ? 'male' : 'female';
    const pool = gameDataset.names.ethnicities[activeEth];
    setFirstName(
      activeGender === 'male'
        ? rng.pick(pool.maleFirstNames)
        : rng.pick(pool.femaleFirstNames),
    );
    setLastName(rng.pick(pool.lastNames));
  };

  const handleRandomizeVisibleIdentity = () => {
    triggerHaptic('light');
    const rng = new SeededRNG(generateRandomSeedString());
    const nextGender: Gender = rng.chance(0.5) ? 'male' : 'female';
    const nextCity = rng.weightedPick(gameDataset.cities, (c) => c.populationWeight);
    const nextEth: Ethnicity = rng.pick(nextCity.primaryEthnicities);
    const nextBirthYear = rng.int(1372, 1403);
    const pool = gameDataset.names.ethnicities[nextEth];

    setGenderMode(nextGender);
    setCityMode(nextCity.id);
    setEthnicityMode(nextEth);
    setBirthYearMode(nextBirthYear);
    setFirstName(
      nextGender === 'male'
        ? rng.pick(pool.maleFirstNames)
        : rng.pick(pool.femaleFirstNames),
    );
    setLastName(rng.pick(pool.lastNames));
  };

  const handleStart = () => {
    triggerHaptic('medium');
    const created = createNewSaveGame(
      {
        slotId: targetSlotId,
        seed: debugSeed?.trim() || undefined,
        gender: genderMode === 'random' ? undefined : genderMode,
        ethnicity: ethnicityMode === 'random' ? undefined : ethnicityMode,
        birthCityId: cityMode === 'random' ? undefined : cityMode,
        birthJalaliYear: birthYearMode === 'random' ? undefined : birthYearMode,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        startingScenarioId,
      },
      gameDataset,
    );
    onCreate(created);
  };

  const slotNumber = targetSlotId.replace('slot_', '');
  const slotLabel = `اسلات ${toPersianDigits(slotNumber || '1')}`;

  const identityNameDisplay =
    firstName.trim() || lastName.trim()
      ? `${firstName.trim() || 'نام تصادفی'} ${lastName.trim() || ''}`.trim()
      : 'نام بر عهده سرنوشت';

  const identityGenderText =
    genderMode === 'male'
      ? t('gender.boy')
      : genderMode === 'female'
        ? t('gender.girl')
        : 'جنسیت تصادفی';
  const identityCityText = selectedCity ? selectedCity.nameFa : 'شهر تصادفی';
  const identityYearText =
    birthYearMode === 'random'
      ? 'سال تصادفی'
      : `متولد ${toPersianDigits(birthYearMode)}`;
  const identityOriginText =
    startingScenarioId === 'welfare_center' ? 'خانه کودکان بهزیستی' : 'خانواده‌ای تصادفی';
  const identityOneLine = `${identityGenderText} · ${identityCityText} · ${identityYearText} · ${identityOriginText}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <IconBrandMark className="h-9 w-9 shrink-0" />
            <div>
              <h1 className="text-base font-bold text-[var(--text)]">{t('creation.title')}</h1>
              <p className="text-xs text-[var(--text-muted)]">
                {slotLabel} · {t('creation.subtitle')}
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text)]"
            >
              {t('back')}
            </button>
          )}
        </div>

        <Card className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
              {t('adoption.welfarePackTitle')}
            </label>
            <SegmentedControl
              value={startingScenarioId}
              onChange={(val) => {
                triggerHaptic('light');
                setStartingScenarioId(val);
              }}
              items={[
                { value: 'standard', label: t('adoption.welfarePackStandard') },
                { value: 'welfare_center', label: t('adoption.welfarePackLabel') },
              ]}
            />
            {startingScenarioId === 'welfare_center' && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--primary-strong)]">
                {gameDataset.adoption.challengePack.subtitleFa}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
              {t('creation.gender')}
            </label>
            <SegmentedControl
              value={genderMode}
              onChange={(val) => {
                triggerHaptic('light');
                setGenderMode(val);
              }}
              items={[
                { value: 'random', label: t('gender.random') },
                { value: 'male', label: t('gender.male') },
                { value: 'female', label: t('gender.female') },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                {t('creation.ethnicity')}
              </label>
              <select
                value={ethnicityMode}
                onChange={(e) => setEthnicityMode(e.target.value as 'random' | Ethnicity)}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text)]"
              >
                <option value="random">{t('gender.random')}</option>
                {ETHNICITY_KEYS.map((eth) => (
                  <option key={eth} value={eth}>
                    {gameDataset.names.ethnicities[eth].labelFa}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                {t('creation.birthCity')}
              </label>
              <select
                value={cityMode}
                onChange={(e) => setCityMode(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text)]"
              >
                <option value="random">{t('gender.random')}</option>
                {gameDataset.cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.nameFa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-muted)]">
                {t('creation.nameLabel')}
              </label>
              <button
                type="button"
                onClick={handleSuggestName}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--primary-strong)]"
              >
                <IconDice className="h-3.5 w-3.5" />
                {t('creation.suggestName')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="نام (اختیاری)"
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="نام خانوادگی (اختیاری)"
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
              />
            </div>
          </div>

          {/* Collapsed Advanced Settings (Birth Year) */}
          <div className="border-t border-[var(--border)] pt-2">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <span>{t('creation.advancedSettings')}</span>
              <IconChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {advancedOpen && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  {t('creation.birthYear')}
                </label>
                <select
                  value={birthYearMode}
                  onChange={(e) =>
                    setBirthYearMode(
                      e.target.value === 'random' ? 'random' : Number(e.target.value),
                    )
                  }
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs tabular-nums text-[var(--text)]"
                >
                  <option value="random">{t('gender.random')}</option>
                  {Array.from({ length: 40 }, (_, i) => 1365 + i).map((yr) => (
                    <option key={yr} value={yr}>
                      {toPersianDigits(yr)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* Simple Identity Card — no numbers, no bars, no quality/talent badges */}
        <Card className="space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary-strong)]">
              <IconSparkles className="h-3.5 w-3.5" />
              <span>{t('creation.identityTitle')}</span>
            </div>
            <div className="mt-1 text-base font-bold text-[var(--text)]">{identityNameDisplay}</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{identityOneLine}</p>
          </div>

          <div className="space-y-2 pt-1">
            <ActionButton label={t('creation.startLife')} onClick={handleStart} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRandomizeVisibleIdentity}
                className="min-h-[44px] rounded-xl px-4 text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                {t('creation.randomStart')}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
