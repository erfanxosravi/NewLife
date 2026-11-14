import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import type {
  BusinessAcquisitionMode,
  BusinessFinancingMode,
  BusinessSize,
  HousingRegionTier,
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
  getPendingEmployerOffer,
  getPendingFamilyBizInheritance,
} from '../../state/selectors';
import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  CurrencyText,
  LockedNotice,
  SectionHeader,
} from './Primitives';

interface CareerOwnershipPanelProps {
  saveGame: SaveGame;
  preferredBusinessTypeId?: string;
  flowExpanded: boolean;
  onToggleFlow: (open: boolean) => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

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

const ACQ_MODE_LABELS: Record<BusinessAcquisitionMode, string> = {
  start_scratch: 'تأسیس از صفر',
  buy_existing: 'خرید سرقفلی',
  partnership: 'شراکت تجاری',
  family_takeover: 'واگذاری خانوادگی',
  franchise: 'نمایندگی برند',
  employer_offer: 'واگذاری کارفرما',
  inheritance: 'انحصار وراثت',
};

export function CareerOwnershipPanel({
  saveGame,
  preferredBusinessTypeId,
  flowExpanded,
  onToggleFlow,
  onUpdateSave,
}: CareerOwnershipPanelProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;

  const defaultBizId =
    preferredBusinessTypeId ??
    gameDataset.businesses.businesses[0].id;

  const [selectedBizId, setSelectedBizId] = useState<string>(defaultBizId);
  const [acqMode, setAcqMode] = useState<BusinessAcquisitionMode>('start_scratch');
  const [regionTier, setRegionTier] = useState<HousingRegionTier>('mid');
  const [size, setSize] = useState<BusinessSize>('small');
  const [financingMode, setFinancingMode] = useState<BusinessFinancingMode>('personal_cash');
  const [customName, setCustomName] = useState<string>('');
  const [showLicenses, setShowLicenses] = useState<boolean>(false);
  const [confirmExitBiz, setConfirmExitBiz] = useState<'sell' | 'close' | null>(null);

  const effectiveBizId =
    preferredBusinessTypeId && flowExpanded ? preferredBusinessTypeId : selectedBizId;

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

  const licensesStatus = useMemo(() => getAllLicensesStatus(state, gameDataset), [state]);
  const pendingEmployerOffer = getPendingEmployerOffer(state);
  const pendingFamilyInheritance = getPendingFamilyBizInheritance(state);
  const familyCandidates = useMemo(
    () => getFamilyBusinessCandidates(state, gameDataset).filter((c) => c.family.parentName),
    [state],
  );

  const ownedBiz = state.ownedBusiness;

  return (
    <div className="space-y-3.5">
      {/* 1. Rare Employer Buyout Offer */}
      {pendingEmployerOffer && !ownedBiz && (
        <Card className="space-y-2.5 border-[var(--primary)] bg-[var(--primary-soft)]">
          <SectionHeader
            title="پیشنهاد واگذاری از کارفرمای بازنشسته"
            subtitle={pendingEmployerOffer.businessNameFa}
            action={<Badge tone="primary">فرصت ویژه</Badge>}
          />
          <p className="text-xs leading-6 text-[var(--text)]">
            کارفرمای قدیمی‌ات به‌خاطر سال‌ها سابقه و اعتماد، پیشنهاد خرید با تخفیف را داده است (ارزش بازار:{' '}
            {formatToman(pendingEmployerOffer.fullPriceToman)} · قیمت پیشنهادی:{' '}
            {formatToman(pendingEmployerOffer.discountedPriceToman)}).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label="خرید نقدی"
              costText={formatToman(pendingEmployerOffer.discountedPriceToman)}
              disabled={player.moneyToman < pendingEmployerOffer.discountedPriceToman}
              disabledReason={
                player.moneyToman < pendingEmployerOffer.discountedPriceToman
                  ? 'نقدینگی کافی نیست'
                  : undefined
              }
              onClick={() =>
                onUpdateSave(respondEmployerOfferAction(saveGame, true, 'personal_cash', gameDataset))
              }
            />
            <ActionButton
              label="خرید با وام"
              costText={formatToman(Math.round(pendingEmployerOffer.discountedPriceToman * 0.55))}
              variant="secondary"
              disabled={player.moneyToman < Math.round(pendingEmployerOffer.discountedPriceToman * 0.55)}
              onClick={() =>
                onUpdateSave(respondEmployerOfferAction(saveGame, true, 'bank_loan', gameDataset))
              }
            />
          </div>
          <ActionButton
            label="رد کردن پیشنهاد"
            variant="danger"
            onClick={() =>
              onUpdateSave(respondEmployerOfferAction(saveGame, false, 'personal_cash', gameDataset))
            }
          />
        </Card>
      )}

      {/* 2. Family Trade Inheritance Offer */}
      {pendingFamilyInheritance && !ownedBiz && (
        <Card className="space-y-2.5 border-[var(--primary)] bg-[var(--primary-soft)]">
          <SectionHeader
            title="ماترک کسب‌وکار خانوادگی"
            subtitle={pendingFamilyInheritance.businessNameFa}
            action={<Badge tone="primary">انحصار وراثت</Badge>}
          />
          <p className="text-xs leading-6 text-[var(--text)]">
            می‌توانی این کسب‌وکار خانوادگی را تحویل بگیری و اداره کنی، یا امتیاز آن را نقد کنی.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label="تحویل و اداره"
              onClick={() =>
                onUpdateSave(respondFamilyInheritanceBizAction(saveGame, true, gameDataset))
              }
            />
            <ActionButton
              label="فروش و دریافت سهم نقدی"
              variant="secondary"
              onClick={() =>
                onUpdateSave(respondFamilyInheritanceBizAction(saveGame, false, gameDataset))
              }
            />
          </div>
        </Card>
      )}

      {/* 3. Active Owned Business Dashboard */}
      {ownedBiz && (
        <Card className="space-y-3" data-testid="owned-business-dashboard">
          <SectionHeader
            title={ownedBiz.nameFa}
            subtitle={`${ACQ_MODE_LABELS[ownedBiz.acquisitionMode]} · ${toPersianDigits(ownedBiz.branchCount)} شعبه · ${toPersianDigits(ownedBiz.yearsOperating)} سال فعالیت`}
            action={
              <Badge tone={ownedBiz.lastYearProfitToman >= 0 ? 'success' : 'danger'}>
                سهم مالکیت: {toPersianDigits(Math.round(ownedBiz.ownershipShare * 100))}٪
              </Badge>
            }
          />

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs tabular-nums">
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">سود/زیان سال اخیر</div>
              <div
                className={`mt-0.5 font-bold ${
                  ownedBiz.lastYearProfitToman >= 0
                    ? 'text-[var(--success)]'
                    : 'text-[var(--danger)]'
                }`}
              >
                {ownedBiz.yearsOperating === 0
                  ? 'سال نخست (در جریان)'
                  : formatToman(ownedBiz.lastYearProfitToman)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">ذخیره نقدی کسب‌وکار</div>
              <div className="mt-0.5 font-bold">
                <CurrencyText amountToman={ownedBiz.cashReserveToman} />
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">درآمد ناخالص پارسال</div>
              <div className="mt-0.5 font-semibold">
                {formatToman(ownedBiz.lastYearRevenueToman)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">اجاره و حقوق پرسنل</div>
              <div className="mt-0.5 font-semibold">
                {formatToman(ownedBiz.lastYearCostsToman.rent + ownedBiz.lastYearCostsToman.staff)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span>خوش‌نامی: {toPersianDigits(ownedBiz.reputation)}٪</span>
            <span>·</span>
            <span>پایگاه مشتری: {toPersianDigits(ownedBiz.customerBase)}</span>
            <span>·</span>
            <span>ودیعه قفل‌شده: {formatToman(ownedBiz.depositLockedToman)}</span>
            {ownedBiz.partnerName && (
              <>
                <span>·</span>
                <span>
                  شریک: {ownedBiz.partnerName} (توافق {toPersianDigits(ownedBiz.partnerCloseness ?? 70)}٪)
                </span>
              </>
            )}
          </div>

          {ownedBiz.consecutiveLossYears > 0 && (
            <LockedNotice
              message={`هشدار زیان‌دهی: ${toPersianDigits(ownedBiz.consecutiveLossYears)} سال پیاپی زیان؛ ادامه زیان می‌تواند به تعطیلی یا ورشکستگی منجر شود.`}
            />
          )}

          {/* Pricing Strategy */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[var(--text-muted)]">سیاست قیمت‌گذاری</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'discount', action: 'price_discount', label: 'رقابتی' },
                  { id: 'standard', action: 'price_standard', label: 'متعارف' },
                  { id: 'premium', action: 'price_premium', label: 'ممتاز' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSave(manageBusinessAction(saveGame, opt.action, undefined, gameDataset))}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition-colors ${
                    ownedBiz.priceStrategy === opt.id
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Roster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-muted)]">
                کارکنان ({toPersianDigits(ownedBiz.staff.length)} نفر)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateSave(manageBusinessAction(saveGame, 'hire_staff', undefined, gameDataset))}
                  className="min-h-[38px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] font-bold hover:border-[var(--primary)]"
                >
                  + استخدام نیرو
                </button>
                {ownedBiz.staff.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdateSave(manageBusinessAction(saveGame, 'fire_staff', undefined, gameDataset))}
                    className="min-h-[38px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] font-bold text-[var(--danger)]"
                  >
                    تعدیل
                  </button>
                )}
              </div>
            </div>
            {ownedBiz.staff.length > 0 && (
              <div className="space-y-1.5">
                {ownedBiz.staff.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-[var(--text)]">{st.fullName}</span>
                      <span className="text-[var(--text-muted)]">
                        {' '}
                        · {st.roleTitleFa} · رده {toPersianDigits(st.level)}
                      </span>
                    </div>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {formatToman(st.annualWageToman)} / سال
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Owner Operations */}
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label="بازسازی و نوسازی"
              effectHint="خوش‌نامی +۸ · رشد فروش ۲ ساله"
              variant="secondary"
              onClick={() => onUpdateSave(manageBusinessAction(saveGame, 'renovate', undefined, gameDataset))}
            />
            <ActionButton
              label="کمپین تبلیغات"
              effectHint="جذب مشتری تازه ۲ ساله"
              variant="secondary"
              onClick={() => onUpdateSave(manageBusinessAction(saveGame, 'advertise', undefined, gameDataset))}
            />
            <ActionButton
              label="افتتاح شعبه جدید"
              effectHint="دو برابر شدن ظرفیت درآمد"
              variant="secondary"
              onClick={() => onUpdateSave(manageBusinessAction(saveGame, 'add_branch', undefined, gameDataset))}
            />
            <ActionButton
              label="فروش یا واگذاری"
              effectHint="نقد کردن سرقفلی و تجهیزات"
              variant="secondary"
              onClick={() => setConfirmExitBiz('sell')}
            />
          </div>
          <ActionButton
            label="تعطیلی داوطلبانه کسب‌وکار"
            variant="danger"
            onClick={() => setConfirmExitBiz('close')}
          />
        </Card>
      )}

      {/* 4. Explicit Ownership Acquisition Flow (when not owning a business) */}
      {!ownedBiz && (
        <Card className="space-y-3" data-testid="ownership-flow-card">
          <SectionHeader
            title={t('career.ownershipFlowTitle')}
            subtitle="مالکیت فقط از مسیر انتخاب آگاهانه، سرمایه، مجوز و پذیرش ریسک ممکن است"
            action={
              <button
                type="button"
                onClick={() => onToggleFlow(!flowExpanded)}
                className="min-h-[40px] rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary-strong)]"
              >
                {flowExpanded ? 'بستن' : 'شروع فرآیند'}
              </button>
            }
          />

          {flowExpanded && (
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              {/* Step 1: Acquisition Mode */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[var(--text-muted)]">۱. روش ورود به مالکیت</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {ACQ_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAcqMode(m.id)}
                      className={`min-h-[44px] rounded-xl border p-2 text-right transition-colors ${
                        acqMode === m.id
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="text-xs font-bold">{m.label}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{m.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {acqMode === 'family_takeover' && familyCandidates.length > 0 && (
                <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  پیشه خانوادگی شناسایی‌شده:{' '}
                  {familyCandidates
                    .map((c) => `${c.family.parentName} (${c.family.parentJobTitle}) ← ${c.businessDef.titleFa}`)
                    .join(' · ')}
                </div>
              )}

              {/* Step 2: Business Type */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[var(--text-muted)]">۲. نوع کسب‌وکار</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {gameDataset.businesses.businesses.map((b) => {
                    const active = b.id === selectedBizDef.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBizId(b.id)}
                        className={`min-h-[44px] rounded-xl border px-2.5 py-2 text-right text-xs transition-colors ${
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)] font-bold'
                            : 'border-[var(--border)] bg-[var(--surface-2)]'
                        }`}
                      >
                        <div>{b.titleFa}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{b.categoryFa}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Location Tier, Size & Financing */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--text-muted)]">۳. منطقه، مقیاس و تأمین مالی</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {REGION_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegionTier(r.id)}
                      className={`min-h-[44px] rounded-xl border px-2 text-[11px] font-bold ${
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
                      className={`min-h-[44px] rounded-xl border px-2 text-[11px] font-bold ${
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
                      className={`min-h-[44px] rounded-xl border px-2 text-[11px] font-bold ${
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

              {/* Step 4: Capital & Risk Preview */}
              <div
                className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs"
                data-testid="ownership-risk-preview"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{t('career.riskPreviewTitle')}</span>
                  <span className="font-bold text-[var(--primary-strong)] tabular-nums">
                    شانس پایداری: {toPersianDigits(quote.breakevenChancePct)}٪
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
                  <div>ودیعه مکان: {formatToman(quote.depositRahnToman)}</div>
                  <div>اجاره ماهانه: {formatToman(quote.monthlyRentToman)}</div>
                  <div>تجهیزات و دکور: {formatToman(quote.equipmentCostToman)}</div>
                  <div>موجودی و ذخیره: {formatToman(quote.initialStockCostToman + quote.workingReserveToman)}</div>
                  {quote.goodwillOrFranchiseFeeToman > 0 && (
                    <div className="col-span-2">
                      سرقفلی / حق برند: {formatToman(quote.goodwillOrFranchiseFeeToman)}
                    </div>
                  )}
                  {quote.loanPrincipalToman > 0 && (
                    <div className="col-span-2 text-[var(--primary-strong)]">
                      وام بانکی ۵ ساله: {formatToman(quote.loanPrincipalToman)} (قسط سالانه {formatToman(quote.loanAnnualPaymentToman)})
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] pt-2 text-[11px] leading-5 tabular-nums">
                  <div className="flex justify-between font-bold">
                    <span>نقدینگی مورد نیاز الان:</span>
                    <span>{formatToman(quote.playerCashRequiredToman)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>تاب‌آوری نقدینگی:</span>
                    <span>{toPersianDigits(quote.runwayMonths)} ماه</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>بازه سود/زیان سالانه:</span>
                    <span>
                      {formatToman(quote.expectedAnnualNetMinToman)} تا {formatToman(quote.expectedAnnualNetMaxToman)}
                    </span>
                  </div>
                </div>

                {quote.blockedReasons.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {quote.blockedReasons.map((reason, idx) => (
                      <LockedNotice key={idx} message={reason} />
                    ))}
                  </div>
                )}
              </div>

              <ActionButton
                label={`ثبت و شروع: ${customName.trim() || selectedBizDef.titleFa}`}
                costText={formatToman(quote.playerCashRequiredToman)}
                disabled={!quote.eligible}
                disabledReason={quote.blockedReasons[0]}
                onClick={() =>
                  onUpdateSave(
                    acquireBusinessAction(
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
                    ),
                  )
                }
              />
            </div>
          )}
        </Card>
      )}

      {/* 5. Licenses & Credentials Section */}
      <Card className="space-y-2.5" data-testid="licenses-card">
        <SectionHeader
          title={t('career.licensesTitle')}
          subtitle={`مجوزهای گرفته‌شده: ${toPersianDigits((player.licenses ?? []).length)} از ${toPersianDigits(licensesStatus.length)}`}
          action={
            <button
              type="button"
              onClick={() => setShowLicenses((v) => !v)}
              className="min-h-[40px] rounded-xl bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)]"
            >
              {showLicenses ? 'بستن فهرست' : 'مشاهده و اخذ مجوز'}
            </button>
          }
        />

        {showLicenses && (
          <div className="space-y-2 border-t border-[var(--border)] pt-2.5">
            {licensesStatus.map((item) => (
              <div
                key={item.license.id}
                className="space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[var(--text)]">
                      {item.license.titleFa}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {item.license.issuerFa} · هزینه: {formatToman(item.feeToman)}
                    </div>
                  </div>
                  <Badge tone={item.owned ? 'success' : item.eligible ? 'primary' : 'neutral'}>
                    {item.owned ? 'صادر شده' : item.license.examRequired ? 'آزمونی' : 'ثبتی'}
                  </Badge>
                </div>
                <p className="text-[11px] leading-5 text-[var(--text-muted)]">
                  {item.license.descriptionFa}
                </p>
                {!item.owned && (
                  <ActionButton
                    label={item.license.examRequired ? 'ثبت‌نام آزمون و صدور مجوز' : 'درخواست صدور مجوز'}
                    costText={formatToman(item.feeToman)}
                    variant="secondary"
                    disabled={!item.eligible}
                    disabledReason={item.missingReasons[0]}
                    onClick={() =>
                      onUpdateSave(acquireLicenseAction(saveGame, item.license.id, gameDataset))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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
          }
          setConfirmExitBiz(null);
        }}
      />
    </div>
  );
}
