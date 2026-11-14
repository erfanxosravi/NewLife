import { useRef, useState } from 'react';
import { gameDataset } from '../data/registry';
import { calculateNetWorthToman } from '../engine/economy';
import { createNewSaveGame } from '../engine/generator';
import { formatAgeLabel, formatToman, toPersianDigits } from '../engine/jalali';
import { migrateSaveGame } from '../engine/migrations';
import type { ContentSettings, SaveGame } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getDiscoveredTalentsDisplay } from '../state/selectors';
import type {
  AnimationSpeed,
  SaveSlotSummary,
  ThemePreference,
} from '../storage/saveStore';
import { FullScreenSheet } from './components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  CurrencyText,
  ListRow,
  SectionHeader,
  SegmentedControl,
  Toggle,
} from './components/Primitives';
import { CountryFlag } from './components/flags/CountryFlag';
import { FamilyTreeView } from './FamilyTreeView';
import {
  IconBrandMark,
  IconCheck,
  IconExport,
  IconImport,
  IconInfo,
  IconPalette,
  IconRelations,
  IconReset,
  IconShield,
  IconSparkles,
  IconTrash,
  IconTrophy,
  IconUser,
} from './icons';

type MenuSection =
  | 'root'
  | 'profile'
  | 'achievements'
  | 'saves'
  | 'content'
  | 'experience'
  | 'theme'
  | 'family_tree'
  | 'about';

interface MenuSheetProps {
  open: boolean;
  saveGame: SaveGame;
  activeSlotId: string;
  summaries: SaveSlotSummary[];
  themePreference: ThemePreference;
  animationSpeed: AnimationSpeed;
  soundEnabled: boolean;
  longPressAutoEnabled: boolean;
  onChangeTheme: (pref: ThemePreference) => void;
  onChangeAnimationSpeed: (speed: AnimationSpeed) => void;
  onToggleSound: (enabled: boolean) => void;
  onToggleLongPressAuto: (enabled: boolean) => void;
  onUpdateContentSettings: (next: ContentSettings) => void;
  onLoadSlot: (slotId: string) => void;
  onImportSave: (imported: SaveGame) => void;
  onStartNewInSlot: (slotId: string) => void;
  onStartDebugRun?: (createdSave: SaveGame) => void;
  onDeleteSlot: (slotId: string) => void;
  onOpenStyleGuide: () => void;
  onOpenDynasty?: () => void;
  onOpenWill?: () => void;
  onNotify: (message: string, tone?: 'primary' | 'success' | 'danger' | 'warning') => void;
  onClose: () => void;
}

const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3'] as const;

export function MenuSheet({
  open,
  saveGame,
  activeSlotId,
  summaries,
  themePreference,
  animationSpeed,
  soundEnabled,
  longPressAutoEnabled,
  onChangeTheme,
  onChangeAnimationSpeed,
  onToggleSound,
  onToggleLongPressAuto,
  onUpdateContentSettings,
  onLoadSlot,
  onImportSave,
  onStartNewInSlot,
  onStartDebugRun,
  onDeleteSlot,
  onOpenStyleGuide,
  onOpenDynasty,
  onOpenWill,
  onNotify,
  onClose,
}: MenuSheetProps) {
  const { t } = useI18n();
  const [section, setSection] = useState<MenuSection>('root');
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<string | null>(null);
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [debugSeedInput, setDebugSeedInput] = useState(saveGame.seed);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debugUnlocked = versionTapCount >= 7;

  const { state, contentSettings } = saveGame;
  const { player } = state;
  const city = gameDataset.cities.find((c) => c.id === player.currentCityId);
  const country = gameDataset.countries.find((c) => c.id === player.countryId);
  const countryMacro = gameDataset.countriesMacro.find((c) => c.id === player.countryId);
  const regionFa = countryMacro?.regions.find((r) => r.id === player.currentCityId)?.nameFa;
  const locationLabel =
    player.countryId === 'iran'
      ? (city?.nameFa ?? country?.nameFa ?? 'ایران')
      : `${countryMacro?.nameFa ?? country?.nameFa ?? 'خارج از کشور'}${regionFa ? ` · ${regionFa}` : ''}`;

  const handleCloseOrBack = () => {
    if (section !== 'root') setSection('root');
    else onClose();
  };

  const handleExportJson = () => {
    const json = JSON.stringify(saveGame, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zendegi-${saveGame.slotId}-${saveGame.state.currentJalaliYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('فایل ذخیره با موفقیت دریافت شد', 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const migrated = migrateSaveGame(parsed);
      onImportSave({
        ...migrated,
        slotId: activeSlotId,
        updatedAt: new Date().toISOString(),
      });
      onNotify('فایل ذخیره وارد و بارگذاری شد', 'success');
    } catch {
      onNotify('فایل ذخیره نامعتبر است یا ساختار آن همخوانی ندارد', 'danger');
    }
  };

  const speedLabel =
    animationSpeed === 'fast'
      ? t('motionSettings.speedFast')
      : animationSpeed === 'off'
        ? t('motionSettings.speedOff')
        : t('motionSettings.speedNormal');

  const sectionTitle =
    section === 'root'
      ? t('menu.title')
      : section === 'profile'
        ? t('menu.profile')
        : section === 'achievements'
          ? t('menu.achievements')
          : section === 'saves'
            ? t('menu.saves')
            : section === 'content'
              ? t('menu.contentSettings')
              : section === 'experience'
                ? t('motionSettings.title')
                : section === 'theme'
                  ? t('menu.theme')
                  : section === 'family_tree'
                    ? t('menu.familyTree')
                    : t('menu.about');

  return (
    <FullScreenSheet
      open={open}
      onClose={handleCloseOrBack}
      title={sectionTitle}
      subtitle={section === 'root' ? `${player.firstName} ${player.lastName}` : undefined}
    >
      {section === 'root' && (
        <div className="space-y-2.5">
          <ListRow
            title={t('menu.profile')}
            subtitle="مشخصات شناسنامه‌ای و خلاصه وضعیت"
            leading={<IconUser className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('profile')}
          />
          <ListRow
            title={t('menu.achievements')}
            subtitle={`${toPersianDigits(state.unlockedAchievements.length)} از ${toPersianDigits(gameDataset.achievements.length)} دستاورد`}
            leading={<IconTrophy className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('achievements')}
          />
          <ListRow
            title={t('legacy.dynastyScreenTitle')}
            subtitle={`نسل ${toPersianDigits(state.dynasty?.currentGeneration ?? 1)} · شجره‌نامه، آمار و تالار افتخار`}
            leading={<IconRelations className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => {
              if (onOpenDynasty) {
                onClose();
                onOpenDynasty();
              } else {
                setSection('family_tree');
              }
            }}
          />
          {onOpenWill && (
            <ListRow
              title={t('legacy.willTitle')}
              subtitle={t('legacy.willSubtitle')}
              leading={<IconShield className="h-5 w-5 text-[var(--primary)]" />}
              onClick={() => {
                onClose();
                onOpenWill();
              }}
            />
          )}
          <ListRow
            title={t('menu.saves')}
            subtitle="مدیریت اسلات‌ها، خروجی و بازیابی JSON"
            leading={<IconExport className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('saves')}
          />
          <ListRow
            title={t('menu.contentSettings')}
            subtitle="فیلتر رویدادهای جرم، مواد، روابط و مسائل اجتماعی"
            leading={<IconShield className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('content')}
          />
          <ListRow
            title={t('motionSettings.title')}
            subtitle={`${t('motionSettings.animationSpeed')}: ${speedLabel}`}
            leading={<IconSparkles className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('experience')}
          />
          <ListRow
            title={t('menu.theme')}
            subtitle={
              themePreference === 'light'
                ? t('menu.themeLight')
                : themePreference === 'dark'
                  ? t('menu.themeDark')
                  : t('menu.themeSystem')
            }
            leading={<IconPalette className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('theme')}
          />
          <ListRow
            title={t('menu.about')}
            subtitle="نسخه، مجوزهای متن‌باز و حفظ حریم خصوصی"
            leading={<IconInfo className="h-5 w-5 text-[var(--primary)]" />}
            onClick={() => setSection('about')}
          />

          <div className="pt-2 space-y-2">
            <ActionButton
              label={t('menu.newLife')}
              icon={<IconReset className="h-4 w-4" />}
              onClick={() => {
                onClose();
                onStartNewInSlot(activeSlotId);
              }}
            />
            <ActionButton
              label={t('menu.styleguide')}
              variant="secondary"
              onClick={() => {
                onClose();
                onOpenStyleGuide();
              }}
            />
          </div>
        </div>
      )}

      {section === 'profile' && (
        <div className="space-y-3">
          <Card className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">
                {player.firstName} {player.lastName}
              </div>
              <Badge tone="primary">{t(`gender.${player.gender}`)}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">سن و سال</div>
                <div className="mt-0.5 font-bold">
                  {formatAgeLabel(player.age)} ({toPersianDigits(state.currentJalaliYear)})
                </div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">محل سکونت</div>
                <div className="mt-0.5 flex items-center gap-1.5 font-bold">
                  <CountryFlag countryId={player.countryId} size="xs" />
                  <span className="truncate">{locationLabel}</span>
                </div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">طبقه خانواده</div>
                <div className="mt-0.5 font-bold">{t(`socialClass.${player.socialClass}`)}</div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">وضعیت تأهل</div>
                <div className="mt-0.5 font-bold">{t(`marital.${player.maritalStatus}`)}</div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">تحصیلات</div>
                <div className="mt-0.5 font-bold">
                  {t(`education.stageLabels.${player.education.level}`)}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                <div className="text-[var(--text-muted)]">نظام وظیفه</div>
                <div className="mt-0.5 font-bold">{t(`military.${player.militaryStatus}`)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
              <span className="text-[var(--text-muted)]">دارایی خالص</span>
              <CurrencyText
                amountToman={calculateNetWorthToman(state)}
                className="font-bold text-[var(--primary-strong)]"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
              <span className="text-[var(--text-muted)]">سابقه کیفری</span>
              <span className="font-bold">{toPersianDigits(player.criminalRecord)} مورد</span>
            </div>
          </Card>

          <Card className="space-y-2.5">
            <SectionHeader
              title="استعدادها و گرایش‌های کشف‌شده"
              subtitle="ویژگی‌هایی که تا اینجای زندگی در تو نمایان شده‌اند"
            />
            {(() => {
              const discovered = getDiscoveredTalentsDisplay(state, gameDataset);
              if (discovered.length === 0) {
                return (
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    هنوز گرایش یا استعداد مشخصی در زندگی تو آشکار نشده است. تجربه کردن فعالیت‌ها، کلاس‌ها و گذر سال‌ها ممکن است آن‌ها را بیدار کند.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {discovered.map((item) => (
                    <div
                      key={item.talentId}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--text)]">
                          {item.titleFa}
                          {item.athleticDisciplineTitleFa
                            ? ` (${item.athleticDisciplineTitleFa})`
                            : ''}
                        </span>
                        <Badge
                          tone={
                            item.tier === 'brilliant_talent' || item.tier === 'clear_talent'
                              ? 'primary'
                              : 'neutral'
                          }
                        >
                          {item.tierLabelFa}
                        </Badge>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                        {item.hintTextFa}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                        <span>کشف در {toPersianDigits(item.discoveredAge)} سالگی</span>
                        <span>آمادگی فعلی: {item.skillLevelLabelFa}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {section === 'achievements' && (
        <div className="space-y-3">
          <Card tinted className="flex items-center justify-between">
            <span className="text-xs font-bold">پیشرفت دستاوردها</span>
            <Badge tone="primary">
              {toPersianDigits(state.unlockedAchievements.length)} /{' '}
              {toPersianDigits(gameDataset.achievements.length)}
            </Badge>
          </Card>
          <div className="space-y-2">
            {gameDataset.achievements.map((ach) => {
              const unlocked = state.unlockedAchievements.includes(ach.id);
              return (
                <Card
                  key={ach.id}
                  className={`flex items-start gap-3 ${unlocked ? '' : 'opacity-65'}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      unlocked
                        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    <IconTrophy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{ach.titleFa}</span>
                      <Badge tone={unlocked ? 'success' : 'neutral'}>
                        {unlocked ? 'باز شده' : 'قفل'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{ach.descriptionFa}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {section === 'saves' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label={t('menu.exportJson')}
              icon={<IconExport className="h-4 w-4" />}
              variant="secondary"
              onClick={handleExportJson}
            />
            <ActionButton
              label={t('menu.importJson')}
              icon={<IconImport className="h-4 w-4" />}
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <SectionHeader title="اسلات‌های ذخیره محلی" />
          <div className="space-y-2.5">
            {SLOT_IDS.map((slotId, index) => {
              const summary = summaries.find((s) => s.slotId === slotId);
              const isActive = slotId === activeSlotId;
              const slotTitle = `اسلات ${toPersianDigits(index + 1)}`;

              return (
                <Card key={slotId} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{slotTitle}</span>
                      {isActive && <Badge tone="primary">فعال</Badge>}
                    </div>
                    {summary && (
                      <Badge tone={summary.isAlive ? 'success' : 'neutral'}>
                        {summary.isAlive ? 'در قید حیات' : 'پایان یافته'}
                      </Badge>
                    )}
                  </div>

                  {summary ? (
                    <>
                      <div className="text-xs font-bold">{summary.fullName}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {formatAgeLabel(summary.age)} · سال {toPersianDigits(summary.jalaliYear)} ·{' '}
                        {formatToman(summary.moneyToman)}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              onLoadSlot(slotId);
                              onClose();
                            }}
                            className="min-h-[40px] flex-1 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--on-primary)]"
                          >
                            {t('load')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartNewInSlot(slotId);
                          }}
                          className="min-h-[40px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold"
                        >
                          زندگی تازه
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlot(slotId)}
                          aria-label={`حذف ${slotTitle}`}
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[var(--danger)]/30 text-[var(--danger)]"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">خالی</span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onStartNewInSlot(slotId);
                        }}
                        className="min-h-[40px] rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--on-primary)]"
                      >
                        ساخت شخصیت در این اسلات
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {section === 'content' && (
        <div className="space-y-2.5">
          <Toggle
            checked={contentSettings.allowCrime}
            onChange={(val) => onUpdateContentSettings({ ...contentSettings, allowCrime: val })}
            label="فعالیت‌ها و رویدادهای جرم و قمار"
            description="نمایش گزینه‌های خلاف قانون و شرط‌بندی با عواقب حقوقی"
          />
          <Toggle
            checked={contentSettings.allowSubstance}
            onChange={(val) =>
              onUpdateContentSettings({ ...contentSettings, allowSubstance: val })
            }
            label="رویدادهای مرتبط با دخانیات و مواد"
            description="رویدادهای تصمیم‌گیری درباره عادت‌های پرخطر"
          />
          <Toggle
            checked={contentSettings.allowRomance}
            onChange={(val) => onUpdateContentSettings({ ...contentSettings, allowRomance: val })}
            label="رویدادها و تعاملات عاشقانه"
            description="آشنایی عاطفی، خواستگاری و روابط همسرانه"
          />
          <Toggle
            checked={contentSettings.allowSocialPolitical}
            onChange={(val) =>
              onUpdateContentSettings({ ...contentSettings, allowSocialPolitical: val })
            }
            label="رویدادهای اجتماعی و مدنی"
            description="موقعیت‌های مرتبط با مشارکت اجتماعی و چالش‌های مدنی"
          />
        </div>
      )}

      {section === 'experience' && (
        <div className="space-y-3">
          <Card className="space-y-2.5">
            <div className="text-sm font-bold text-[var(--text)]">
              {t('motionSettings.animationSpeed')}
            </div>
            <SegmentedControl<AnimationSpeed>
              value={animationSpeed}
              onChange={onChangeAnimationSpeed}
              items={[
                { value: 'normal', label: t('motionSettings.speedNormal') },
                { value: 'fast', label: t('motionSettings.speedFast') },
                { value: 'off', label: t('motionSettings.speedOff') },
              ]}
            />
          </Card>

          <Toggle
            checked={soundEnabled}
            onChange={onToggleSound}
            label={t('motionSettings.soundEffects')}
            description={t('motionSettings.soundEffectsDesc')}
          />

          <Toggle
            checked={longPressAutoEnabled}
            onChange={onToggleLongPressAuto}
            label={t('motionSettings.longPressAuto')}
            description={t('motionSettings.longPressAutoDesc')}
          />
        </div>
      )}

      {section === 'theme' && (
        <div className="space-y-2.5">
          {(
            [
              { id: 'light', title: t('menu.themeLight'), desc: 'پس‌زمینه گرم شیری و نارنجی روشن' },
              { id: 'dark', title: t('menu.themeDark'), desc: 'زغالی گرم و چشم‌نواز در نور کم' },
              { id: 'system', title: t('menu.themeSystem'), desc: 'تغییر خودکار بر اساس تنظیم دستگاه' },
            ] as const
          ).map((opt) => {
            const active = themePreference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeTheme(opt.id)}
                className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-right ${
                  active
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div>
                  <div className="text-sm font-bold">{opt.title}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">{opt.desc}</div>
                </div>
                {active && <IconCheck className="h-5 w-5 text-[var(--primary-strong)]" />}
              </button>
            );
          })}
        </div>
      )}

      {section === 'family_tree' && <FamilyTreeView state={state} />}

      {section === 'about' && (
        <div className="space-y-3">
          <Card className="flex flex-col items-center py-5 text-center">
            <IconBrandMark className="h-14 w-14" />
            <h3 className="mt-3 text-lg font-bold">{t('appTitle')}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('appTagline')}</p>
            <button
              type="button"
              onClick={() => {
                const next = versionTapCount + 1;
                setVersionTapCount(next);
                if (next === 7) {
                  setDebugSeedInput(saveGame.seed);
                  onNotify('بخش آزمایشی کد زندگی فعال شد', 'primary');
                }
              }}
              className="mt-2 min-h-[44px] rounded-xl px-2"
            >
              <Badge tone="primary">نسخه ۱.۰.۰ · کاملاً آفلاین</Badge>
            </button>
          </Card>

          {debugUnlocked && (
            <Card className="space-y-2.5 border border-[var(--primary)]">
              <SectionHeader
                title="ابزار آزمایشی کد زندگی"
                subtitle="فقط برای بررسی و بازپخش یک زندگی مشخص"
              />
              <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px]">
                <span className="text-[var(--text-muted)]">کد زندگی فعلی: </span>
                <span className="font-mono font-bold text-[var(--text)]">{saveGame.seed}</span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={debugSeedInput}
                  onChange={(e) => setDebugSeedInput(e.target.value)}
                  placeholder="کد زندگی دلخواه..."
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 font-mono text-xs text-[var(--text)]"
                />
                {onStartDebugRun && (
                  <ActionButton
                    label="شروع زندگی آزمایشی با این کد"
                    variant="secondary"
                    onClick={() => {
                      const cleanSeed = debugSeedInput.trim();
                      if (!cleanSeed) {
                        onNotify('لطفاً یک کد زندگی معتبر وارد کن', 'warning');
                        return;
                      }
                      const created = createNewSaveGame(
                        { slotId: activeSlotId, seed: cleanSeed },
                        gameDataset,
                      );
                      onStartDebugRun(created);
                      onClose();
                      onNotify('زندگی آزمایشی با کد مشخص‌شده آغاز شد', 'success');
                    }}
                  />
                )}
              </div>
            </Card>
          )}

          <Card className="space-y-2 text-xs leading-relaxed text-[var(--text-muted)]">
            <div className="font-bold text-[var(--text)]">حریم خصوصی و داده‌ها</div>
            <p>
              تمامی مراحل شبیه‌سازی، داده‌های شخصیت و ذخیره‌سازی فقط روی دستگاه خودت (IndexedDB)
              انجام می‌شود و هیچ اطلاعاتی به سرور ارسال نمی‌شود.
            </p>
            <div className="pt-1 font-bold text-[var(--text)]">منابع و مجوزها</div>
            <ul className="list-disc pr-4 space-y-1">
              <li>فونت وزیرمتن (Vazirmatn) — SIL OFL 1.1</li>
              <li>آیکون‌های Lucide — ISC License</li>
              <li>محاسبه تقویم خورشیدی (jalaali-js) — MIT License</li>
            </ul>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteSlot !== null}
        title="حذف فایل ذخیره"
        message="این اسلات ذخیره برای همیشه پاک می‌شود و قابل بازگشت نیست. مطمئنی؟"
        destructive
        onCancel={() => setConfirmDeleteSlot(null)}
        onConfirm={() => {
          if (confirmDeleteSlot) onDeleteSlot(confirmDeleteSlot);
          setConfirmDeleteSlot(null);
        }}
      />
    </FullScreenSheet>
  );
}
