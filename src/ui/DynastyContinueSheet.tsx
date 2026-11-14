import { useMemo, useState } from 'react';
import { gameDataset } from '../data/registry';
import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import {
  createDistantRelativeCandidate,
  getEligibleHeirs,
  settleEstate,
} from '../engine/legacy';
import type { HeirCandidate, SaveGame, SharedAssetDecision } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import {
  closeDynastyAction,
  continueDynastyWithHeirAction,
  endDynastyWithCharityAction,
  type ActionOutcome,
} from '../state/actions';
import { FullScreenSheet } from './components/FullScreenSheet';
import { MoneyText } from './components/MoneyText';
import { PersonAvatar } from './components/PersonAvatar';
import {
  ActionButton,
  Badge,
  Card,
  SectionHeader,
  SegmentedControl,
  StatBar,
} from './components/Primitives';
import {
  IconCharity,
  IconCheck,
  IconInfo,
  IconRelations,
  IconSparkles,
  IconUser,
} from './icons';

interface DynastyContinueSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onOpenDynastyHall: () => void;
}

const SHARED_DECISION_ITEMS: { value: SharedAssetDecision; label: string }[] = [
  { value: 'keep_jointly', label: 'نگهداری اشتراکی' },
  { value: 'buy_out_siblings', label: 'خرید سهم بقیه' },
  { value: 'sell_and_split', label: 'فروش و تقسیم' },
];

export function DynastyContinueSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
  onOpenDynastyHall,
}: DynastyContinueSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;

  const eligibleHeirs = useMemo(
    () => getEligibleHeirs(state, gameDataset),
    [state],
  );

  const distantCandidate = useMemo(
    () =>
      eligibleHeirs.length === 0
        ? createDistantRelativeCandidate(state, saveGame.seed, gameDataset)
        : null,
    [eligibleHeirs.length, state, saveGame.seed],
  );

  const [selectedHeirId, setSelectedHeirId] = useState<string>(
    eligibleHeirs[0]?.personId ?? '',
  );
  const [homeDecision, setHomeDecision] = useState<SharedAssetDecision>('keep_jointly');
  const [businessDecision, setBusinessDecision] = useState<SharedAssetDecision>('keep_jointly');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const activeHeir: HeirCandidate | undefined =
    eligibleHeirs.find((h) => h.personId === selectedHeirId) ?? eligibleHeirs[0];

  const estatePreview = useMemo(() => {
    if (!activeHeir) return null;
    return settleEstate({
      state,
      chosenHeirId: activeHeir.personId,
      dataset: gameDataset,
      homeDecision,
      businessDecision,
    });
  }, [state, activeHeir, homeDecision, businessDecision]);

  const charityPreview = useMemo(() => {
    if (eligibleHeirs.length > 0) return null;
    return settleEstate({
      state,
      dataset: gameDataset,
      extraCharityOverride: true,
    });
  }, [eligibleHeirs.length, state]);

  const handleConfirmHeir = () => {
    if (!activeHeir) return;
    const outcome = continueDynastyWithHeirAction(
      saveGame,
      {
        heirId: activeHeir.personId,
        homeDecision,
        businessDecision,
      },
      gameDataset,
    );
    onUpdateSave(outcome);
    onClose();
  };

  const handleDistantRelative = () => {
    if (!distantCandidate) return;
    const outcome = continueDynastyWithHeirAction(
      saveGame,
      {
        heirId: distantCandidate.personId,
        distantCandidate,
        homeDecision: 'sell_and_split',
        businessDecision: 'sell_and_split',
      },
      gameDataset,
    );
    onUpdateSave(outcome);
    onClose();
  };

  const handleCharityEnding = () => {
    const outcome = endDynastyWithCharityAction(saveGame, gameDataset);
    onUpdateSave(outcome);
    onClose();
    onOpenDynastyHall();
  };

  const handleCloseDynasty = () => {
    const outcome = closeDynastyAction(saveGame, gameDataset);
    onUpdateSave(outcome);
    onClose();
    onOpenDynastyHall();
  };

  const getSituationFa = (heir: HeirCandidate) => {
    if (heir.age < 18) return 'دانش‌آموز · تحت سرپرستی خانواده';
    const parts = [heir.jobTitle, t(`marital.${heir.maritalStatus}`)];
    return parts.join(' · ');
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={
        eligibleHeirs.length > 0
          ? t('legacy.heirSelectionTitle')
          : t('legacy.noHeirTitle')
      }
      subtitle={
        eligibleHeirs.length > 0
          ? t('legacy.heirSelectionSubtitle')
          : t('legacy.noHeirSubtitle')
      }
    >
      <div className="space-y-3.5 pb-6">
        <Card tinted className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--primary-strong)]">
              ادامه در سال {toPersianDigits(state.currentJalaliYear)}
            </span>
            <Badge tone="primary">
              نسل {toPersianDigits((state.dynasty?.currentGeneration ?? 1) + 1)}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            جهان شبیه‌ساز، وضعیت اقتصاد و روابط خویشاوندی با همان تاریخ ادامه پیدا می‌کند و وارث انتخابی از سن کنونی خود مسیر را پیش می‌برد.
          </p>
        </Card>

        {eligibleHeirs.length > 0 && activeHeir ? (
          <>
            <SectionHeader
              title={`وارثان واجد شرایط (${toPersianDigits(eligibleHeirs.length)})`}
              subtitle="یکی را انتخاب کن؛ قبل از شروع می‌توانی جزئیات تقسیم ارث را ببینی"
            />
            <div className="space-y-2.5">
              {eligibleHeirs.map((heir) => {
                const isSelected = heir.personId === activeHeir.personId;
                return (
                  <button
                    key={heir.personId}
                    type="button"
                    onClick={() => setSelectedHeirId(heir.personId)}
                    className={`w-full rounded-2xl border p-3.5 text-right transition-all ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]/55 shadow-xs'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PersonAvatar
                          seed={state.npcs[heir.personId]?.avatarSeed ?? heir.personId}
                          gender={heir.gender}
                          age={heir.age}
                          size={44}
                          originKind={state.npcs[heir.personId]?.originKind}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-[var(--text)]">
                              {heir.fullName}
                            </span>
                            <Badge tone={isSelected ? 'primary' : 'neutral'}>
                              {heir.relationLabelFa}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {formatAgeLabel(heir.age)} · {getSituationFa(heir)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <div className="text-xs text-[var(--text-muted)]">سهم برآوردی</div>
                        <MoneyText
                          amount={heir.estimatedInheritanceToman}
                          currency="IRT"
                          mode="inline"
                          stateOverride={state}
                          interactive={false}
                          className="text-xs font-bold text-[var(--primary-strong)]"
                        />
                      </div>
                    </div>

                    {heir.traits.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {heir.traits.map((trait) => (
                          <Badge key={trait} tone="neutral">
                            {trait}
                          </Badge>
                        ))}
                        {heir.inheritedTalentHints.map((hint) => (
                          <Badge key={hint} tone="primary">
                            {hint}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5">
                      <StatBar
                        label="صمیمیت با متوفی"
                        value={heir.closeness}
                        colorVar="--primary"
                        compact
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {estatePreview && (
              <Card className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 text-xs font-bold text-[var(--primary-strong)]"
                >
                  <span className="flex items-center gap-1.5">
                    <IconInfo className="h-4 w-4" />
                    <span>
                      {showBreakdown
                        ? t('legacy.hideEstateBreakdown')
                        : t('legacy.whoGetsWhat')}
                    </span>
                  </span>
                  <span>
                    ماترک خالص:{' '}
                    <MoneyText
                      amount={estatePreview.netDistributableToman}
                      currency="IRT"
                      mode="inline"
                      stateOverride={state}
                      interactive={false}
                    />
                  </span>
                </button>

                {showBreakdown && (
                  <div className="space-y-2 border-t border-[var(--border)] pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">کل دارایی قبل از کسر</span>
                      <MoneyText
                        amount={estatePreview.grossAssetsToman}
                        currency="IRT"
                        mode="inline"
                        stateOverride={state}
                        className="font-bold"
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">هزینه کفن‌ودفن و مراسم</span>
                      <MoneyText
                        amount={estatePreview.funeralCostToman}
                        currency="IRT"
                        mode="inline"
                        stateOverride={state}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">بدهی‌های پرداخت‌شده</span>
                      <MoneyText
                        amount={estatePreview.debtsPaidToman}
                        currency="IRT"
                        mode="inline"
                        stateOverride={state}
                      />
                    </div>
                    {estatePreview.forgivenDebtToman > 0 && (
                      <div className="rounded-xl bg-[var(--surface-2)] p-2 text-xs text-[var(--text-muted)]">
                        مازاد بدهی (
                        <MoneyText
                          amount={estatePreview.forgivenDebtToman}
                          currency="IRT"
                          mode="inline"
                          stateOverride={state}
                        />
                        ) طبق ماده ۸۶۹ به وراث منتقل نمی‌شود.
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">هزینه حصر وراثت و کارشناسی</span>
                      <MoneyText
                        amount={estatePreview.settlementFeeToman}
                        currency="IRT"
                        mode="inline"
                        stateOverride={state}
                      />
                    </div>
                    {estatePreview.contestOutcomeFa && (
                      <div className="rounded-xl bg-[var(--warning)]/12 p-2 text-xs text-[var(--warning)]">
                        {estatePreview.contestOutcomeFa}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="font-bold text-[var(--text)]">جدول سهام:</div>
                      {estatePreview.shares.map((line) => (
                        <div
                          key={line.recipientId}
                          className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold">{line.recipientNameFa}</div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {line.roleLabelFa} · {toPersianDigits(Math.round(line.shareRatio * 100))}٪
                            </div>
                          </div>
                          <MoneyText
                            amount={line.totalToman}
                            currency="IRT"
                            mode="inline"
                            stateOverride={state}
                            className="font-bold text-[var(--primary-strong)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {estatePreview.sharedHomeAvailable && (
                  <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
                    <div className="text-xs font-bold">تکلیف خانه مشترک بین وراث</div>
                    <SegmentedControl
                      value={homeDecision}
                      onChange={setHomeDecision}
                      items={SHARED_DECISION_ITEMS}
                    />
                  </div>
                )}

                {estatePreview.sharedBusinessAvailable && (
                  <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
                    <div className="text-xs font-bold">تکلیف کسب‌وکار مشترک</div>
                    <SegmentedControl
                      value={businessDecision}
                      onChange={setBusinessDecision}
                      items={SHARED_DECISION_ITEMS}
                    />
                  </div>
                )}
              </Card>
            )}

            <ActionButton
              label={t('legacy.startHeirLife')}
              icon={<IconCheck className="h-4 w-4" />}
              onClick={handleConfirmHeir}
            />
          </>
        ) : (
          <div className="space-y-3">
            {distantCandidate && (
              <Card className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <IconUser className="h-5 w-5 text-[var(--primary-strong)]" />
                  <div>
                    <div className="text-sm font-bold">{t('legacy.distantRelativeOption')}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {distantCandidate.fullName} · {distantCandidate.relationLabelFa} ·{' '}
                      {formatAgeLabel(distantCandidate.age)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  شغل فعلی: {distantCandidate.jobTitle} · سهم‌الارث محدود:{' '}
                  <MoneyText
                    amount={distantCandidate.estimatedInheritanceToman}
                    currency="IRT"
                    mode="inline"
                    stateOverride={state}
                  />
                </p>
                <ActionButton
                  label={`ادامه به عنوان ${distantCandidate.fullName}`}
                  icon={<IconRelations className="h-4 w-4" />}
                  onClick={handleDistantRelative}
                />
              </Card>
            )}

            <Card className="space-y-2.5">
              <div className="flex items-center gap-2">
                <IconCharity className="h-5 w-5 text-[var(--success)]" />
                <div>
                  <div className="text-sm font-bold">{t('legacy.charityFoundationOption')}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    ماترک خالص پس از تسویه دیون (
                    <MoneyText
                      amount={charityPreview?.netDistributableToman ?? 0}
                      currency="IRT"
                      mode="inline"
                      stateOverride={state}
                    />
                    ) صرف تأسیس بنیاد خانوادگی می‌شود.
                  </div>
                </div>
              </div>
              <ActionButton
                label={t('legacy.charityFoundationOption')}
                variant="secondary"
                icon={<IconSparkles className="h-4 w-4" />}
                onClick={handleCharityEnding}
              />
            </Card>

            <Card className="space-y-2.5">
              <div className="text-sm font-bold">{t('legacy.closeDynastyOption')}</div>
              <p className="text-xs text-[var(--text-muted)]">
                دفتر دودمان با حفظ تمام فصل‌ها، آمار و تالار افتخار به پایان می‌رسد و می‌توانی تاریخچه کامل خانواده را ببینی یا به اشتراک بگذاری.
              </p>
              <ActionButton
                label={t('legacy.closeDynastyOption')}
                variant="secondary"
                onClick={handleCloseDynasty}
              />
            </Card>
          </div>
        )}
      </div>
    </FullScreenSheet>
  );
}
