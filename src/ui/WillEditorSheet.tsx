import { useMemo, useState } from 'react';
import { gameDataset } from '../data/registry';
import { toPersianDigits } from '../engine/jalali';
import {
  getWillUnlockReasonFa,
  isWillUnlocked,
  normalizeAndValidateWill,
} from '../engine/legacy';
import type { SaveGame, WillBeneficiary, WillConfig } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { saveWillAction, type ActionOutcome } from '../state/actions';
import { FullScreenSheet } from './components/FullScreenSheet';
import { MoneyText } from './components/MoneyText';
import {
  ActionButton,
  Badge,
  Card,
  LockedNotice,
  SectionHeader,
  SegmentedControl,
  Slider,
} from './components/Primitives';
import { IconCheck, IconInfo, IconTrash, IconWarning } from './icons';

interface WillEditorSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

export function WillEditorSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: WillEditorSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const unlocked = isWillUnlocked(state, gameDataset);
  const unlockReason = getWillUnlockReasonFa(state, gameDataset);

  const initialWill: WillConfig = state.will ?? {
    updatedAtAge: state.player.age,
    updatedAtYear: state.currentJalaliYear,
    divisionPreference: 'civil_code',
    charityPercent: 0,
    beneficiaries: [],
    specificItems: {},
    letterToHeirsFa: '',
  };

  const [charityPercent, setCharityPercent] = useState<number>(initialWill.charityPercent);
  const [divisionPreference, setDivisionPreference] = useState<'civil_code' | 'equal_if_consented'>(
    initialWill.divisionPreference,
  );
  const [beneficiaries, setBeneficiaries] = useState<WillBeneficiary[]>(initialWill.beneficiaries);
  const [homeRecipientId, setHomeRecipientId] = useState<string>(
    initialWill.specificItems.homeRecipientId ?? '',
  );
  const [businessRecipientId, setBusinessRecipientId] = useState<string>(
    initialWill.specificItems.businessRecipientId ?? '',
  );
  const [vehicleRecipientId, setVehicleRecipientId] = useState<string>(
    initialWill.specificItems.vehicleRecipientId ?? '',
  );
  const [letterToHeirsFa, setLetterToHeirsFa] = useState<string>(initialWill.letterToHeirsFa);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const livingPeople = useMemo(() => {
    return state.relationships
      .map((rel) => {
        const person = state.npcs[rel.personId];
        if (!person || !person.isAlive) return null;
        return { rel, person };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [state.relationships, state.npcs]);

  const draftWill: WillConfig = {
    updatedAtAge: state.player.age,
    updatedAtYear: state.currentJalaliYear,
    divisionPreference,
    charityPercent,
    beneficiaries,
    specificItems: {
      homeRecipientId: homeRecipientId || undefined,
      businessRecipientId: businessRecipientId || undefined,
      vehicleRecipientId: vehicleRecipientId || undefined,
    },
    letterToHeirsFa,
  };

  const validation = normalizeAndValidateWill(draftWill, gameDataset);
  const hasOwnedHome =
    (state.player.housing.type === 'owned' || state.player.housing.type === 'villa') &&
    state.player.housing.propertyValueToman > 0;
  const hasBusiness = Boolean(state.ownedBusiness);
  const hasVehicle = state.assets.some((a) => a.type === 'car');

  const addBeneficiary = (personId: string) => {
    if (!personId || beneficiaries.some((b) => b.personId === personId)) return;
    const found = livingPeople.find((p) => p.person.id === personId);
    if (!found) return;
    const targetType: WillBeneficiary['targetType'] =
      found.rel.role === 'spouse'
        ? 'spouse'
        : found.rel.role === 'child'
          ? 'child'
          : found.rel.role === 'sibling'
            ? 'sibling'
            : 'friend';
    setBeneficiaries((prev) => [
      ...prev,
      {
        id: `ben_${personId}`,
        targetType,
        personId,
        labelFa: `${found.person.firstName} ${found.person.lastName}`,
        sharePercent: 10,
      },
    ]);
  };

  const handleSave = () => {
    const outcome = saveWillAction(saveGame, draftWill, gameDataset);
    onUpdateSave(outcome);
    if (outcome.success) onClose();
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('legacy.willTitle')}
      subtitle={t('legacy.willSubtitle')}
      headerRight={
        <button
          type="button"
          onClick={() => setShowRulesModal((prev) => !prev)}
          className="min-h-[38px] rounded-xl bg-[var(--surface-2)] px-2.5 text-xs font-bold text-[var(--primary-strong)]"
        >
          {showRulesModal ? 'فرم وصیت' : 'قواعد ارث'}
        </button>
      }
    >
      <div className="space-y-3.5 pb-6">
        {showRulesModal ? (
          <div className="space-y-3">
            <Card tinted className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--text)]">
                  <IconInfo className="h-4 w-4 text-[var(--primary-strong)]" />
                  <span>{gameDataset.inheritance.meta.titleFa}</span>
                </div>
                {gameDataset.inheritance.meta.simplified && (
                  <Badge tone="neutral">نسخه ساده‌سازی‌شده</Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-[var(--text)]">
                {gameDataset.inheritance.meta.summaryFa}
              </p>
              <div className="text-xs text-[var(--text-muted)]">
                منبع شبیه‌ساز: {gameDataset.inheritance.meta.source}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                ترتیب تسویه ماترک: ۱) هزینه کفن‌ودفن ({toPersianDigits(gameDataset.inheritance.rules.funeralCostMinWageMultiple.value)} برابر حداقل دستمزد ماهانه، برآورد فعلی:{' '}
                <MoneyText
                  amount={Math.round(
                    gameDataset.economy.baseline1405.verifiedBenchmarks.minWageMonthly.value *
                      state.inflationMultiplier *
                      gameDataset.inheritance.rules.funeralCostMinWageMultiple.value,
                  )}
                  currency="IRT"
                  mode="inline"
                  stateOverride={state}
                />
                ) ← ۲) دیون و وام‌ها ← ۳) وصیت تا سقف ثلث ← ۴) تقسیم قانونی میان وراث.
              </div>
            </Card>

            {gameDataset.inheritance.legalExplanationsFa.map((item) => (
              <Card key={item.articleFa} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--primary-strong)]">
                    {item.titleFa}
                  </span>
                  <Badge tone="neutral">{item.articleFa}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{item.bodyFa}</p>
              </Card>
            ))}

            <ActionButton
              label="بازگشت به تنظیم وصیت‌نامه"
              variant="secondary"
              onClick={() => setShowRulesModal(false)}
            />
          </div>
        ) : (
          <>
            {!unlocked && <LockedNotice message={unlockReason} />}

            <Card tinted className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">سقف مجاز وصیت (ثلث)</span>
                <Badge tone={validation.exceedsOneThird ? 'warning' : 'success'}>
                  {toPersianDigits(validation.totalRequestedPercent)}٪ از{' '}
                  {toPersianDigits(validation.maxAllowedPercent)}٪
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                بر اساس ماده ۸۴۳ قانون مدنی، وصیت تا یک‌سوم ماترک خالص (پس از کسر دیون و کفن‌ودفن) به طور مستقیم نافذ است.
              </p>
              {validation.exceedsOneThird && (
                <div className="flex items-start gap-2 rounded-xl bg-[var(--warning)]/12 p-2.5 text-xs text-[var(--warning)]">
                  <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    جمع درخواست‌ها از ۳۳/۳٪ بیشتر است؛ هنگام تقسیم، سهم وصیتی به سقف ثلث تعدیل می‌شود و احتمال اعتراض وراث افزایش می‌یابد.
                  </span>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <SectionHeader
                title="وقف و امور خیریه"
                subtitle="بخشی از ماترک که پس از تسویه دیون به خیریه اختصاص می‌یابد"
              />
              <Slider
                label="درصد وقف و خیریه"
                value={charityPercent}
                min={0}
                max={50}
                step={5}
                valueLabel={`${toPersianDigits(charityPercent)}٪`}
                minLabel="۰٪"
                maxLabel="۵۰٪"
                onChange={setCharityPercent}
              />
            </Card>

            <Card className="space-y-2.5">
              <SectionHeader
                title="ذینفعان ویژه وصیت"
                subtitle="می‌توانی برای افراد نزدیک سهمی از ثلث وصیت تعیین کنی"
              />

              {livingPeople.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    aria-label="انتخاب ذینفع"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addBeneficiary(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
                  >
                    <option value="">افزودن فرد از خانواده یا دوستان...</option>
                    {livingPeople
                      .filter((p) => !beneficiaries.some((b) => b.personId === p.person.id))
                      .map(({ person, rel }) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName} ({t(`relations.roles.${rel.role}`)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {beneficiaries.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  هنوز ذینفع ویژه‌ای اضافه نکرده‌ای. بدون ذینفع، باقیمانده بر اساس ترتیب قانونی میان وراث تقسیم می‌شود.
                </p>
              ) : (
                <div className="space-y-2">
                  {beneficiaries.map((ben) => (
                    <div
                      key={ben.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{ben.labelFa}</span>
                        <button
                          type="button"
                          aria-label={`حذف ${ben.labelFa}`}
                          onClick={() =>
                            setBeneficiaries((prev) => prev.filter((x) => x.id !== ben.id))
                          }
                          className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[var(--danger)] hover:bg-[var(--surface)]"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <Slider
                        label="سهم وصیتی"
                        value={ben.sharePercent}
                        min={5}
                        max={35}
                        step={5}
                        valueLabel={`${toPersianDigits(ben.sharePercent)}٪`}
                        onChange={(val) =>
                          setBeneficiaries((prev) =>
                            prev.map((x) => (x.id === ben.id ? { ...x, sharePercent: val } : x)),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {(hasOwnedHome || hasBusiness || hasVehicle) && livingPeople.length > 0 && (
              <Card className="space-y-2.5">
                <SectionHeader
                  title="اموال مشخص"
                  subtitle="اولویت واگذاری اقلام اصلی در چارچوب وصیت"
                />
                {hasOwnedHome && (
                  <label className="block space-y-1 text-xs">
                    <span className="font-bold text-[var(--text-muted)]">تکلیف مسکن</span>
                    <select
                      value={homeRecipientId}
                      onChange={(e) => setHomeRecipientId(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
                    >
                      <option value="">تقسیم عمومی ماترک</option>
                      {livingPeople.map(({ person }) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {hasBusiness && (
                  <label className="block space-y-1 text-xs">
                    <span className="font-bold text-[var(--text-muted)]">کسب‌وکار خانوادگی</span>
                    <select
                      value={businessRecipientId}
                      onChange={(e) => setBusinessRecipientId(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
                    >
                      <option value="">تصمیم‌گیری هنگام حصر وراثت</option>
                      {livingPeople.map(({ person }) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {hasVehicle && (
                  <label className="block space-y-1 text-xs">
                    <span className="font-bold text-[var(--text-muted)]">خودرو</span>
                    <select
                      value={vehicleRecipientId}
                      onChange={(e) => setVehicleRecipientId(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
                    >
                      <option value="">تقسیم عمومی ماترک</option>
                      {livingPeople.map(({ person }) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </Card>
            )}

            <Card className="space-y-2.5">
              <SectionHeader title="شیوه تقسیم میان فرزندان" />
              <SegmentedControl
                value={divisionPreference}
                onChange={setDivisionPreference}
                items={[
                  { value: 'civil_code', label: 'مطابق قانون مدنی' },
                  { value: 'equal_if_consented', label: 'توافق برابر با رضایت وراث' },
                ]}
              />
            </Card>

            <Card className="space-y-2">
              <SectionHeader
                title="نامه به بازماندگان"
                subtitle="این یادداشت در آغاز فصل وارث نمایش داده می‌شود"
              />
              <textarea
                rows={3}
                maxLength={600}
                value={letterToHeirsFa}
                onChange={(e) => setLetterToHeirsFa(e.target.value)}
                placeholder="چند خط یادگار و توصیه برای خانواده بنویس..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
              />
            </Card>

            <ActionButton
              label={t('legacy.saveWill')}
              icon={<IconCheck className="h-4 w-4" />}
              disabled={!unlocked}
              disabledReason={!unlocked ? unlockReason : undefined}
              onClick={handleSave}
            />
          </>
        )}
      </div>
    </FullScreenSheet>
  );
}
