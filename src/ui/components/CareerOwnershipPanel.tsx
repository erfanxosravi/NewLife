import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { toPersianDigits } from '../../engine/jalali';
import type { LicenseStatus } from '../../engine/careers';
import type { EmployerOfferData } from '../../engine/businesses';
import type {
  BusinessAcquisitionMode,
  BusinessFinancingMode,
  BusinessSize,
  HousingRegionTier,
  OwnedBusinessState,
  SaveGame,
} from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  acquireBusinessAction,
  acquireLicenseAction,
  manageBusinessAction,
  respondEmployerOfferAction,
  respondFamilyInheritanceBizAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  getAllLicensesStatus,
  getBusinessQuotePreview,
  getFamilyBusinessCandidates,
} from '../../state/selectors';
import { MoneyText } from './MoneyText';
import {
  ActionButton,
  ActionRow,
  Card,
  ConfirmDialog,
  DangerZoneGroup,
  DetailSheet,
  HubHeroCard,
  InfoSheet,
  LockedNotice,
  ProgressStepper,
  RequirementsChecklist,
  SectionGroup,
  SegmentedControl,
} from './Primitives';
import { IconBuilding, IconCoins, IconShield, IconUser } from '../icons';

const ACQ_MODES: { id: BusinessAcquisitionMode; label: string; hint: string }[] = [
  { id: 'start_scratch', label: 'تأسیس از صفر', hint: 'ساخت برند و مکان تازه' },
  { id: 'buy_existing', label: 'خرید سرقفلی', hint: 'خرید واحد فعال با مشتری قبلی' },
  { id: 'partnership', label: 'شراکت ۵۰٪', hint: 'تقسیم سرمایه و سود با شریک' },
  { id: 'family_takeover', label: 'کسب‌وکار خانواده', hint: 'ادامه پیشه پدر یا مادر' },
  { id: 'franchise', label: 'نمایندگی / فرانچایز', hint: 'برند آماده با ریسک کمتر' },
];

const REGION_OPTIONS: { id: HousingRegionTier; label: string }[] = [
  { id: 'south', label: 'جنوب / کم‌هزینه' },
  { id: 'mid', label: 'مناطق میانی' },
  { id: 'north', label: 'بالاشهر / ممتاز' },
];

const SIZE_OPTIONS: { id: BusinessSize; label: string }[] = [
  { id: 'small', label: 'کوچک' },
  { id: 'medium', label: 'متوسط' },
  { id: 'large', label: 'بزرگ' },
];

const FINANCING_OPTIONS: { id: BusinessFinancingMode; label: string }[] = [
  { id: 'personal_cash', label: 'نقدی شخصی' },
  { id: 'bank_loan', label: 'وام بانکی + نقدی' },
  { id: 'partner_split', label: 'شریک سرمایه‌گذار' },
];

export const ACQ_MODE_LABELS: Record<BusinessAcquisitionMode, string> = {
  start_scratch: 'تأسیس از صفر',
  buy_existing: 'خرید سرقفلی',
  partnership: 'شراکت تجاری',
  family_takeover: 'واگذاری خانوادگی',
  franchise: 'نمایندگی برند',
  employer_offer: 'واگذاری کارفرما',
  inheritance: 'انحصار وراثت',
};

export function OwnedBusinessDetailSheet({
  open,
  saveGame,
  ownedBiz,
  onClose,
  onUpdateSave,
}: {
  open: boolean;
  saveGame: SaveGame;
  ownedBiz: OwnedBusinessState;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}) {
  const [confirmExitBiz, setConfirmExitBiz] = useState<'sell' | 'close' | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <DetailSheet
        open={open}
        onClose={onClose}
        title={ownedBiz.nameFa}
        subtitle={`${ACQ_MODE_LABELS[ownedBiz.acquisitionMode]} · ${toPersianDigits(ownedBiz.branchCount)} شعبه`}
        onInfo={() => setInfoOpen(true)}
      >
        <div data-testid="owned-business-dashboard" className="space-y-4">
          <HubHeroCard
            icon={<IconBuilding className="h-5 w-5" />}
            title={ownedBiz.nameFa}
            subtitle={`سهم مالکیت: ${toPersianDigits(Math.round(ownedBiz.ownershipShare * 100))}٪ · خوش‌نامی ${toPersianDigits(ownedBiz.reputation)}٪ · ${toPersianDigits(ownedBiz.yearsOperating)} سال سابقه`}
            status={ownedBiz.consecutiveLossYears > 0 ? 'waiting' : 'in_progress'}
            onInfo={() => setInfoOpen(true)}
            metrics={[
              {
                label: 'سود/زیان پارسال',
                value:
                  ownedBiz.yearsOperating === 0 ? (
                    'سال نخست'
                  ) : (
                    <MoneyText
                      amount={ownedBiz.lastYearProfitToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                tone: ownedBiz.lastYearProfitToman >= 0 ? 'success' : 'danger',
              },
              {
                label: 'ذخیره نقدی',
                value: (
                  <MoneyText
                    amount={ownedBiz.cashReserveToman}
                    currency="IRT"
                    mode="inline"
                    interactive={false}
                  />
                ),
              },
              {
                label: 'پایگاه مشتری',
                value: toPersianDigits(ownedBiz.customerBase),
              },
            ]}
          />

          {ownedBiz.consecutiveLossYears > 0 && (
            <LockedNotice
              message={`هشدار زیان‌دهی: ${toPersianDigits(ownedBiz.consecutiveLossYears)} سال پیاپی زیان؛ ادامه زیان می‌تواند به تعطیلی یا ورشکستگی منجر شود.`}
            />
          )}

          <SectionGroup title="سیاست قیمت‌گذاری">
            <div className="p-2.5">
              <SegmentedControl
                value={ownedBiz.priceStrategy}
                onChange={(strategy) => {
                  const action =
                    strategy === 'discount'
                      ? 'price_discount'
                      : strategy === 'premium'
                        ? 'price_premium'
                        : 'price_standard';
                  onUpdateSave(manageBusinessAction(saveGame, action, undefined, gameDataset));
                }}
                items={[
                  { value: 'discount', label: 'رقابتی' },
                  { value: 'standard', label: 'متعارف' },
                  { value: 'premium', label: 'ممتاز' },
                ]}
              />
            </div>
          </SectionGroup>

          <SectionGroup title="عملیات و توسعه">
            <ActionRow
              title="بازسازی و نوسازی"
              subtitle="خوش‌نامی +۸ · رشد فروش ۲ ساله"
              ctaLabel="اجرا"
              onClick={() =>
                onUpdateSave(manageBusinessAction(saveGame, 'renovate', undefined, gameDataset))
              }
            />
            <ActionRow
              title="کمپین تبلیغات"
              subtitle="جذب مشتری تازه ۲ ساله"
              ctaLabel="اجرا"
              onClick={() =>
                onUpdateSave(manageBusinessAction(saveGame, 'advertise', undefined, gameDataset))
              }
            />
            <ActionRow
              title="افتتاح شعبه جدید"
              subtitle="دو برابر شدن ظرفیت درآمد"
              ctaLabel="توسعه"
              onClick={() =>
                onUpdateSave(manageBusinessAction(saveGame, 'add_branch', undefined, gameDataset))
              }
            />
            <ActionRow
              title="استخدام نیروی جدید"
              subtitle={`پرسنل فعلی: ${toPersianDigits(ownedBiz.staff.length)} نفر`}
              ctaLabel="استخدام"
              onClick={() =>
                onUpdateSave(manageBusinessAction(saveGame, 'hire_staff', undefined, gameDataset))
              }
            />
          </SectionGroup>

          {ownedBiz.staff.length > 0 && (
            <SectionGroup title={`کارکنان (${toPersianDigits(ownedBiz.staff.length)} نفر)`}>
              {ownedBiz.staff.map((st) => (
                <ActionRow
                  key={st.id}
                  icon={<IconUser className="h-4 w-4" />}
                  iconTone="neutral"
                  title={st.fullName}
                  subtitle={`${st.roleTitleFa} · رده ${toPersianDigits(st.level)}`}
                  value={
                    <span className="inline-flex items-center gap-1">
                      <MoneyText
                        amount={st.annualWageToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                      <span>/ سال</span>
                    </span>
                  }
                />
              ))}
              <ActionRow
                title="تعدیل یک نیرو"
                subtitle="کاهش هزینه سالانه حقوق و دستمزد"
                variant="danger"
                ctaLabel="تعدیل"
                onClick={() =>
                  onUpdateSave(manageBusinessAction(saveGame, 'fire_staff', undefined, gameDataset))
                }
              />
            </SectionGroup>
          )}

          <DangerZoneGroup>
            <ActionRow
              variant="danger"
              title="فروش یا واگذاری کسب‌وکار"
              subtitle="نقد کردن سرقفلی، ودیعه و تجهیزات"
              ctaLabel="بررسی"
              onClick={() => setConfirmExitBiz('sell')}
            />
            <ActionRow
              variant="danger"
              title="تعطیلی داوطلبانه کسب‌وکار"
              subtitle="توقف فعالیت و آزادسازی ودیعه"
              ctaLabel="تعطیلی"
              onClick={() => setConfirmExitBiz('close')}
            />
          </DangerZoneGroup>
        </div>
      </DetailSheet>

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="جزئیات مالی کسب‌وکار"
        bullets={[
          <span key="rev">
            درآمد ناخالص پارسال:{' '}
            <MoneyText amount={ownedBiz.lastYearRevenueToman} currency="IRT" mode="inline" />
          </span>,
          <span key="costs">
            اجاره و حقوق پرسنل پارسال:{' '}
            <MoneyText
              amount={ownedBiz.lastYearCostsToman.rent + ownedBiz.lastYearCostsToman.staff}
              currency="IRT"
              mode="inline"
            />
          </span>,
          <span key="dep">
            ودیعه قفل‌شده مکان:{' '}
            <MoneyText amount={ownedBiz.depositLockedToman} currency="IRT" mode="inline" />
          </span>,
          ...(ownedBiz.partnerName
            ? [`شریک تجاری: ${ownedBiz.partnerName} (توافق ${toPersianDigits(ownedBiz.partnerCloseness ?? 70)}٪)`]
            : []),
        ]}
      />

      <ConfirmDialog
        open={confirmExitBiz !== null}
        title={confirmExitBiz === 'sell' ? 'تأیید فروش کسب‌وکار' : 'تأیید تعطیلی کسب‌وکار'}
        message={
          confirmExitBiz === 'sell'
            ? 'کسب‌وکار به ارزش روز تجهیزات، ودیعه و سود سالانه فروخته می‌شود. مطمئنی؟'
            : 'با تعطیلی داوطلبانه، ودیعه و بخشی از تجهیزات نقد می‌شود و فعالیت متوقف می‌گردد.'
        }
        destructive={confirmExitBiz === 'close'}
        onCancel={() => setConfirmExitBiz(null)}
        onConfirm={() => {
          if (confirmExitBiz) {
            onUpdateSave(manageBusinessAction(saveGame, confirmExitBiz, undefined, gameDataset));
            onClose();
          }
          setConfirmExitBiz(null);
        }}
      />
    </>
  );
}

export function OwnershipFlowDetailSheet({
  open,
  saveGame,
  preferredBusinessTypeId,
  onClose,
  onUpdateSave,
}: {
  open: boolean;
  saveGame: SaveGame;
  preferredBusinessTypeId?: string;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;

  const defaultBizId = preferredBusinessTypeId ?? gameDataset.businesses.businesses[0].id;
  const [selectedBizId, setSelectedBizId] = useState<string>(defaultBizId);
  const [acqMode, setAcqMode] = useState<BusinessAcquisitionMode>('start_scratch');
  const [regionTier, setRegionTier] = useState<HousingRegionTier>('mid');
  const [size, setSize] = useState<BusinessSize>('small');
  const [financingMode, setFinancingMode] = useState<BusinessFinancingMode>('personal_cash');
  const [customName, setCustomName] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState(false);

  const effectiveBizId = preferredBusinessTypeId || selectedBizId;
  const selectedBizDef = useMemo(
    () =>
      gameDataset.businesses.businesses.find((b) => b.id === effectiveBizId) ??
      gameDataset.businesses.businesses[0],
    [effectiveBizId],
  );

  const quote = useMemo(
    () =>
      getBusinessQuotePreview({
        businessDef: selectedBizDef,
        acquisitionMode: acqMode,
        financingMode,
        cityId: player.currentCityId,
        regionTier,
        size,
        state,
        dataset: gameDataset,
      }),
    [selectedBizDef, acqMode, financingMode, player.currentCityId, regionTier, size, state],
  );

  const familyCandidates = useMemo(
    () => getFamilyBusinessCandidates(state, gameDataset).filter((c) => c.family.parentName),
    [state],
  );

  return (
    <>
      <DetailSheet
        open={open}
        onClose={onClose}
        title={t('career.ownershipFlowTitle')}
        subtitle="انتخاب روش، نوع پیشه، مقیاس و برآورد سرمایه"
        onInfo={() => setInfoOpen(true)}
        footer={
          <ActionButton
            label={`ثبت و شروع: ${customName.trim() || selectedBizDef.titleFa}`}
            costText={
              <MoneyText
                amount={quote.playerCashRequiredToman}
                currency="IRT"
                mode="inline"
                interactive={false}
              />
            }
            disabled={!quote.eligible}
            disabledReason={quote.blockedReasons[0]}
            onClick={() => {
              const res = acquireBusinessAction(
                saveGame,
                {
                  businessTypeId: selectedBizDef.id,
                  acquisitionMode: acqMode,
                  financingMode,
                  cityId: player.currentCityId,
                  regionTier,
                  size,
                  customNameFa: customName.trim() || undefined,
                },
                gameDataset,
              );
              onUpdateSave(res);
              if (res.success) onClose();
            }}
          />
        }
      >
        <ProgressStepper
          orientation="horizontal"
          steps={[
            { id: 'mode', title: 'روش ورود', status: 'done' },
            { id: 'type', title: 'نوع پیشه', status: 'done' },
            { id: 'finance', title: 'مکان و مالی', status: 'current' },
            { id: 'risk', title: 'ریسک و ثبت', status: quote.eligible ? 'upcoming' : 'locked' },
          ]}
        />

        {/* Step 1: Acquisition Mode */}
        <SectionGroup title="۱. روش ورود به مالکیت">
          <div className="grid grid-cols-2 gap-1.5 p-2.5 sm:grid-cols-3">
            {ACQ_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAcqMode(m.id)}
                className={`min-h-[48px] rounded-xl border p-2 text-right transition-colors ${
                  acqMode === m.id
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)]'
                }`}
              >
                <div className="text-xs font-bold">{m.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{m.hint}</div>
              </button>
            ))}
          </div>
          {acqMode === 'family_takeover' && familyCandidates.length > 0 && (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
              پیشه خانوادگی شناسایی‌شده:{' '}
              {familyCandidates
                .map((c) => `${c.family.parentName} (${c.family.parentJobTitle}) ← ${c.businessDef.titleFa}`)
                .join(' · ')}
            </div>
          )}
        </SectionGroup>

        {/* Step 2: Business Type */}
        <SectionGroup title="۲. نوع کسب‌وکار">
          <div className="grid grid-cols-2 gap-1.5 p-2.5">
            {gameDataset.businesses.businesses.map((b) => {
              const active = b.id === selectedBizDef.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBizId(b.id)}
                  className={`min-h-[48px] rounded-xl border px-2.5 py-2 text-right text-xs transition-colors ${
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] font-bold'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  <div>{b.titleFa}</div>
                  <div className="text-xs text-[var(--text-muted)]">{b.categoryFa}</div>
                </button>
              );
            })}
          </div>
        </SectionGroup>

        {/* Step 3: Region, Size, Financing */}
        <SectionGroup title="۳. منطقه، مقیاس و تأمین مالی">
          <div className="space-y-2 p-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {REGION_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegionTier(r.id)}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold ${
                    regionTier === r.id
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold ${
                    size === s.id
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  مقیاس {s.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {FINANCING_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFinancingMode(f.id)}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold ${
                    financingMode === f.id
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`نام دلخواه (پیش‌فرض: ${selectedBizDef.titleFa})`}
              className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
          </div>
        </SectionGroup>

        {/* Step 4: Risk & Cost Preview */}
        <Card className="space-y-2.5 text-xs" tinted>
          <div data-testid="ownership-risk-preview" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('career.riskPreviewTitle')}</span>
              <span className="font-bold text-[var(--primary-strong)] tabular-nums">
                شانس پایداری: {toPersianDigits(quote.breakevenChancePct)}٪
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs tabular-nums">
              <div className="inline-flex flex-wrap items-center gap-1">
                <span>ودیعه مکان:</span>
                <MoneyText amount={quote.depositRahnToman} currency="IRT" mode="single" compact />
              </div>
              <div className="inline-flex flex-wrap items-center gap-1">
                <span>اجاره ماهانه:</span>
                <MoneyText amount={quote.monthlyRentToman} currency="IRT" mode="single" compact />
              </div>
              <div className="inline-flex flex-wrap items-center gap-1">
                <span>تجهیزات و دکور:</span>
                <MoneyText amount={quote.equipmentCostToman} currency="IRT" mode="single" compact />
              </div>
              <div className="inline-flex flex-wrap items-center gap-1">
                <span>موجودی و ذخیره:</span>
                <MoneyText
                  amount={quote.initialStockCostToman + quote.workingReserveToman}
                  currency="IRT"
                  mode="single"
                  compact
                />
              </div>
              {quote.goodwillOrFranchiseFeeToman > 0 && (
                <div className="col-span-2 inline-flex flex-wrap items-center gap-1">
                  <span>سرقفلی / حق برند:</span>
                  <MoneyText
                    amount={quote.goodwillOrFranchiseFeeToman}
                    currency="IRT"
                    mode="single"
                    compact
                  />
                </div>
              )}
              {quote.loanPrincipalToman > 0 && (
                <div className="col-span-2 inline-flex flex-wrap items-center gap-1 text-[var(--primary-strong)]">
                  <span>وام بانکی ۵ ساله:</span>
                  <MoneyText amount={quote.loanPrincipalToman} currency="IRT" mode="single" compact />
                  <span>(قسط سالانه</span>
                  <MoneyText
                    amount={quote.loanAnnualPaymentToman}
                    currency="IRT"
                    mode="single"
                    compact
                  />
                  <span>)</span>
                </div>
              )}
            </div>

            <div className="border-t border-[var(--border)] pt-2 text-xs leading-5 tabular-nums">
              <div className="flex justify-between font-bold">
                <span>نقدینگی مورد نیاز الان:</span>
                <MoneyText amount={quote.playerCashRequiredToman} currency="IRT" mode="inline" />
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>تاب‌آوری نقدینگی:</span>
                <span>{toPersianDigits(quote.runwayMonths)} ماه</span>
              </div>
              <div className="flex justify-between gap-2 text-[var(--text-muted)]">
                <span>بازه سود/زیان سالانه:</span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  <MoneyText
                    amount={quote.expectedAnnualNetMinToman}
                    currency="IRT"
                    mode="single"
                    compact
                  />
                  <span>تا</span>
                  <MoneyText
                    amount={quote.expectedAnnualNetMaxToman}
                    currency="IRT"
                    mode="single"
                    compact
                  />
                </span>
              </div>
            </div>

            {quote.blockedReasons.length > 0 && (
              <RequirementsChecklist
                title="موانع فعلی"
                items={quote.blockedReasons.map((reason, idx) => ({
                  id: `blk_${idx}`,
                  label: reason,
                  met: false,
                }))}
              />
            )}
          </div>
        </Card>
      </DetailSheet>

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="راهنمای مالکیت کسب‌وکار"
        bullets={[
          'مالکیت تنها با تأمین نقدینگی، مجوز لازم و پذیرش ریسک عملیاتی انجام می‌شود.',
          'وام بانکی فشار نقدی اولیه را کم می‌کند اما قسط ثابت سالانه ایجاد می‌نماید.',
          'فروش یا تعطیلی در هر زمان از صفحه مدیریت کسب‌وکار در دسترس است.',
        ]}
      />
    </>
  );
}

export function LicensesDetailSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}) {
  const { state } = saveGame;
  const licensesStatus = useMemo(() => getAllLicensesStatus(state, gameDataset), [state]);
  const [selectedLicense, setSelectedLicense] = useState<LicenseStatus | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const activeLicense = selectedLicense
    ? licensesStatus.find((l) => l.license.id === selectedLicense.license.id) ?? selectedLicense
    : null;

  return (
    <>
      <DetailSheet
        open={open}
        onClose={onClose}
        title="مجوزهای رسمی و حرفه‌ای"
        subtitle={`صادر شده: ${toPersianDigits((state.player.licenses ?? []).length)} از ${toPersianDigits(licensesStatus.length)}`}
        onInfo={() => setInfoOpen(true)}
      >
        <SectionGroup title="فهرست مجوزها">
          {licensesStatus.map((item) => (
            <ActionRow
              key={item.license.id}
              icon={<IconShield className="h-5 w-5" />}
              iconTone={item.owned ? 'success' : item.eligible ? 'primary' : 'neutral'}
              title={item.license.titleFa}
              subtitle={
                <span className="inline-flex items-center gap-1">
                  <span>{item.license.issuerFa} ·</span>
                  <MoneyText
                    amount={item.feeToman}
                    currency="IRT"
                    mode="inline"
                    interactive={false}
                  />
                </span>
              }
              statusChip={item.owned ? 'done' : item.eligible ? 'in_progress' : 'locked'}
              showChevron
              onClick={() => setSelectedLicense(item)}
            />
          ))}
        </SectionGroup>
      </DetailSheet>

      <DetailSheet
        open={Boolean(activeLicense)}
        onClose={() => setSelectedLicense(null)}
        title={activeLicense?.license.titleFa ?? ''}
        subtitle={activeLicense?.license.issuerFa}
        zIndexClass="z-[56]"
        footer={
          activeLicense && !activeLicense.owned ? (
            <ActionButton
              label={
                activeLicense.license.examRequired
                  ? 'ثبت‌نام آزمون و صدور مجوز'
                  : 'درخواست صدور مجوز'
              }
              costText={
                <MoneyText
                  amount={activeLicense.feeToman}
                  currency="IRT"
                  mode="inline"
                  interactive={false}
                />
              }
              disabled={!activeLicense.eligible}
              disabledReason={activeLicense.missingReasons[0]}
              onClick={() => {
                const res = acquireLicenseAction(
                  saveGame,
                  activeLicense.license.id,
                  gameDataset,
                );
                onUpdateSave(res);
                if (res.success) setSelectedLicense(null);
              }}
            />
          ) : undefined
        }
      >
        {activeLicense && (
          <>
            <HubHeroCard
              icon={<IconShield className="h-5 w-5" />}
              title={activeLicense.license.titleFa}
              subtitle={activeLicense.license.descriptionFa}
              status={
                activeLicense.owned
                  ? 'done'
                  : activeLicense.eligible
                    ? 'in_progress'
                    : 'locked'
              }
              metrics={[
                { label: 'مرجع صادرکننده', value: activeLicense.license.issuerFa },
                {
                  label: 'هزینه صدور',
                  value: (
                    <MoneyText
                      amount={activeLicense.feeToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
                {
                  label: 'فرآیند',
                  value: activeLicense.license.examRequired ? 'آزمونی' : 'ثبتی',
                },
              ]}
            />
            {!activeLicense.owned && (
              <RequirementsChecklist
                title="شرایط و پیش‌نیازها"
                items={
                  activeLicense.missingReasons.length > 0
                    ? activeLicense.missingReasons.map((r, i) => ({
                        id: `lic_req_${i}`,
                        label: r,
                        met: false,
                      }))
                    : [
                        {
                          id: 'lic_ready',
                          label: 'تمام شرایط قانونی و بودجه برقرار است',
                          met: true,
                        },
                      ]
                }
              />
            )}
          </>
        )}
      </DetailSheet>

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="درباره مجوزهای رسمی"
        bullets={[
          'برخی مشاغل تخصصی یا کسب‌وکارها نیازمند گواهینامه یا پروانه صنفی هستند.',
          'مجوزهای آزمونی نیاز به آمادگی علمی و هزینه ثبت‌نام دارند.',
        ]}
      />
    </>
  );
}

export function EmployerOfferDetailSheet({
  open,
  saveGame,
  offer,
  onClose,
  onUpdateSave,
}: {
  open: boolean;
  saveGame: SaveGame;
  offer: EmployerOfferData;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}) {
  const { player } = saveGame.state;
  const loanUpfront = Math.round(offer.discountedPriceToman * 0.55);

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title="پیشنهاد واگذاری کارفرما"
      subtitle={offer.businessNameFa}
    >
      <HubHeroCard
        tone="primary"
        icon={<IconCoins className="h-5 w-5" />}
        title={offer.businessNameFa}
        subtitle="کارفرمای قدیمی‌ات به پشتوانه اعتماد سال‌ها، واگذاری با تخفیف را پیشنهاد داده است."
        metrics={[
          {
            label: 'ارزش بازار',
            value: (
              <MoneyText
                amount={offer.fullPriceToman}
                currency="IRT"
                mode="inline"
                interactive={false}
              />
            ),
          },
          {
            label: 'قیمت پیشنهادی',
            value: (
              <MoneyText
                amount={offer.discountedPriceToman}
                currency="IRT"
                mode="inline"
                interactive={false}
              />
            ),
          },
          {
            label: 'حداقل نقد با وام',
            value: (
              <MoneyText amount={loanUpfront} currency="IRT" mode="inline" interactive={false} />
            ),
          },
        ]}
      />

      <SectionGroup title="تصمیم‌گیری">
        <ActionRow
          title="خرید نقدی کامل"
          subtitle="بدون بدهی و قسط بانکی"
          value={
            <MoneyText
              amount={offer.discountedPriceToman}
              currency="IRT"
              mode="inline"
              interactive={false}
            />
          }
          state={player.moneyToman < offer.discountedPriceToman ? 'disabled' : 'recommended'}
          reason={player.moneyToman < offer.discountedPriceToman ? 'نقدینگی کافی نیست' : undefined}
          ctaLabel="خرید نقدی"
          onClick={() => {
            onUpdateSave(respondEmployerOfferAction(saveGame, true, 'personal_cash', gameDataset));
            onClose();
          }}
        />
        <ActionRow
          title="خرید با وام بانکی"
          subtitle="پرداخت ۵۵٪ نقدی و الباقی قسط"
          value={<MoneyText amount={loanUpfront} currency="IRT" mode="inline" interactive={false} />}
          state={player.moneyToman < loanUpfront ? 'disabled' : 'enabled'}
          reason={player.moneyToman < loanUpfront ? 'نقدینگی کافی نیست' : undefined}
          ctaLabel="خرید با وام"
          onClick={() => {
            onUpdateSave(respondEmployerOfferAction(saveGame, true, 'bank_loan', gameDataset));
            onClose();
          }}
        />
      </SectionGroup>

      <DangerZoneGroup>
        <ActionRow
          variant="danger"
          title="رد کردن پیشنهاد"
          subtitle="این فرصت از بین می‌رود"
          ctaLabel="رد"
          onClick={() => {
            onUpdateSave(respondEmployerOfferAction(saveGame, false, 'personal_cash', gameDataset));
            onClose();
          }}
        />
      </DangerZoneGroup>
    </DetailSheet>
  );
}

export function FamilyInheritanceDetailSheet({
  open,
  saveGame,
  pending,
  onClose,
  onUpdateSave,
}: {
  open: boolean;
  saveGame: SaveGame;
  pending: { businessTypeId: string; businessNameFa: string; offeredYear: number };
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}) {
  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title="ماترک کسب‌وکار خانوادگی"
      subtitle={pending.businessNameFa}
    >
      <HubHeroCard
        icon={<IconBuilding className="h-5 w-5" />}
        title={pending.businessNameFa}
        subtitle="می‌توانی این کسب‌وکار خانوادگی را تحویل بگیری و اداره کنی، یا امتیاز آن را نقد کنی."
        status="in_progress"
      />
      <SectionGroup title="انتخاب مسیر">
        <ActionRow
          title="تحویل و اداره کسب‌وکار"
          subtitle="شروع مدیریت مستقیم پیشه خانوادگی"
          state="recommended"
          ctaLabel="تحویل"
          onClick={() => {
            onUpdateSave(respondFamilyInheritanceBizAction(saveGame, true, gameDataset));
            onClose();
          }}
        />
        <ActionRow
          title="فروش و دریافت سهم نقدی"
          subtitle="نقد کردن فوری ارزش ماترک"
          ctaLabel="فروش سهم"
          onClick={() => {
            onUpdateSave(respondFamilyInheritanceBizAction(saveGame, false, gameDataset));
            onClose();
          }}
        />
      </SectionGroup>
    </DetailSheet>
  );
}

