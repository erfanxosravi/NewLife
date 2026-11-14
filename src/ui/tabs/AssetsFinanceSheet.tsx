import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { calculateNetWorthToman } from '../../engine/economy';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import type { Asset, SaveGame, ShopCategory } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  applyHousingAction,
  buyShopItemAction,
  buyVehicleAction,
  payOffDebtAction,
  repairVehicleAction,
  sellVehicleAction,
  takeLoanAction,
  tradeInvestmentAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  formatUsdEquivalentHint,
  getAdjustedPriceToman,
  getAmountPurchasingPower,
  getAnnualExpenseEstimate,
  getAnnualIncomeEstimate,
  getCarRepairCostToman,
  getConvertedRentalPair,
  getCreditScore,
  getDebtPayoffChunkToman,
  getEmamiCoinPriceToman,
  getGoldGramPriceToman,
  getHousingListingQuote,
  getLoanPresets,
  getMarketRatesHistory,
  getMinWageMonthly,
  getNetWorthSeries,
  getOwnedShopItemIds,
  getQuickTradeAmountToman,
  getShopItemPriceToman,
  getTehran70SqmRefPrice,
  getTehranSqmPriceToman,
  getUsdRateToman,
} from '../../state/selectors';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  CurrencyText,
  FilterChips,
  LockedNotice,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  Sparkline,
  Toggle,
} from '../components/Primitives';
import {
  IconCar,
  IconCard,
  IconCoins,
  IconHome,
  IconInfo,
  IconShop,
  IconTrendDown,
  IconTrendUp,
  IconWarning,
} from '../icons';

interface AssetsFinanceSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

type SubTab = 'overview' | 'investments' | 'housing' | 'loans' | 'shop';

export function AssetsFinanceSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: AssetsFinanceSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [shopFilter, setShopFilter] = useState<'all' | ShopCategory>('all');
  const [showInflationTip, setShowInflationTip] = useState(false);
  const [preferHigherRahn, setPreferHigherRahn] = useState(false);

  const bankRatePct = Math.round(
    gameDataset.economy.baseline1405.policyAndModel.bankDepositAnnualRate.value * 100,
  );
  const depositRentRate =
    gameDataset.economy.baseline1405.policyAndModel.depositToMonthlyRentRate.value;

  const investmentOptions = useMemo<
    {
      id: 'inv_usd' | 'inv_gold' | 'inv_bourse' | 'inv_deposit' | 'inv_crypto';
      titleFa: string;
      assetType: Asset['type'];
      riskLabel: string;
      hint: string;
    }[]
  >(
    () => [
      {
        id: 'inv_usd',
        titleFa: 'دلار و ارز معتبر',
        assetType: 'usd',
        riskLabel: 'متوسط',
        hint: 'پوشش نسبی همگام با نرخ ارز آزاد',
      },
      {
        id: 'inv_gold',
        titleFa: 'طلا و سکه امامی',
        assetType: 'gold',
        riskLabel: 'کم تا متوسط',
        hint: 'پناهگاه کلاسیک حفظ ارزش پول همگام با بازار سکه',
      },
      {
        id: 'inv_bourse',
        titleFa: 'سهام بورس تهران',
        assetType: 'stock',
        riskLabel: 'متوسط تا بالا',
        hint: 'نوسان بیشتر با پتانسیل رشد بالاتر',
      },
      {
        id: 'inv_deposit',
        titleFa: `سپرده بانکی ${toPersianDigits(bankRatePct)}٪`,
        assetType: 'stock',
        riskLabel: 'کم',
        hint: `سود سالانه اسمی ${toPersianDigits(bankRatePct)} درصد بدون ریسک بازار`,
      },
      {
        id: 'inv_crypto',
        titleFa: 'رمزارز',
        assetType: 'crypto',
        riskLabel: 'بسیار بالا',
        hint: 'سود یا زیان سنگین در یک سال',
      },
    ],
    [bankRatePct],
  );

  const netWorth = calculateNetWorthToman(state);
  const netWorthPP = getAmountPurchasingPower(netWorth, state, gameDataset);
  const netWorthSeries = getNetWorthSeries(state);
  const annualIncome = getAnnualIncomeEstimate(state);
  const annualExpenses = getAnnualExpenseEstimate(state, gameDataset);
  const creditScore = getCreditScore(state);
  const usdRate = getUsdRateToman(state, gameDataset);
  const goldRate = getGoldGramPriceToman(state, gameDataset);
  const coinRate = getEmamiCoinPriceToman(state, gameDataset);
  const tehranSqm = getTehranSqmPriceToman(state, gameDataset);
  const tehran70SqmPrice = getTehran70SqmRefPrice(state, gameDataset);
  const minWageMonthly = getMinWageMonthly(state, gameDataset);
  const ratesHist = getMarketRatesHistory(state, gameDataset);
  const inflationPct = Math.round(state.lastInflationRate * 100);
  const ownedShopIds = getOwnedShopItemIds(state);

  const usdUp = ratesHist.usd.length < 2 || usdRate >= ratesHist.usd[ratesHist.usd.length - 2];
  const goldUp = ratesHist.gold.length < 2 || goldRate >= ratesHist.gold[ratesHist.gold.length - 2];

  const ownedCars = state.assets.filter((a) => a.type === 'car');
  const filteredShop = useMemo(() => {
    if (shopFilter === 'all') return gameDataset.shop;
    return gameDataset.shop.filter((item) => item.category === shopFilter);
  }, [shopFilter]);

  const quickTradeAmount = getQuickTradeAmountToman(state, gameDataset);
  const debtPayoffChunk = getDebtPayoffChunkToman(state, gameDataset);
  const loanPresets = getLoanPresets(state, gameDataset);

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.assets')}
      subtitle={`نقدینگی: ${formatToman(player.moneyToman)} · ${formatUsdEquivalentHint(player.moneyToman, state, gameDataset)}`}
    >
      <div className="space-y-4">
        <SegmentedControl
          value={subTab}
          onChange={setSubTab}
          items={[
            { value: 'overview', label: t('tabs.overview') },
            { value: 'investments', label: t('tabs.investments') },
            { value: 'housing', label: t('tabs.housing') },
            { value: 'loans', label: t('tabs.loans') },
            { value: 'shop', label: t('tabs.shop') },
          ]}
        />

        {/* 1. OVERVIEW TAB */}
        {subTab === 'overview' && (
          <div className="space-y-3.5">
            {/* Hero Net Worth Card */}
            <section className="rounded-3xl bg-gradient-to-bl from-[var(--primary)] to-[var(--primary-strong)] p-4 text-[var(--on-primary)] shadow-md">
              <div className="flex items-center justify-between text-xs opacity-90">
                <span>{t('netWorthLabel')}</span>
                <span>{netWorthPP.labelFa}</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                <CurrencyText amountToman={netWorth} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                <span>{formatUsdEquivalentHint(netWorth, state, gameDataset)}</span>
                <span>·</span>
                <span>
                  معادل {toPersianDigits(netWorthPP.tehran70SqmApts)} واحد ۷۰ متری تهران
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/15 p-2.5 text-xs">
                <div>
                  <div className="opacity-80">{t('cashLabel')}</div>
                  <div className="font-bold tabular-nums">
                    <CurrencyText amountToman={player.moneyToman} />
                  </div>
                </div>
                <div>
                  <div className="opacity-80">کل بدهی و وام</div>
                  <div className="font-bold tabular-nums">
                    <CurrencyText
                      amountToman={
                        player.debtToman +
                        state.loans.reduce((s, l) => s + l.principalRemainingToman, 0)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Net Worth Sparkline */}
            <Card>
              <SectionHeader title="روند تغییر دارایی خالص" />
              <Sparkline values={netWorthSeries} colorVar="--primary" height={44} />
            </Card>

            {/* Income vs Expense */}
            <Card className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">خالص درآمد سالانه</div>
                <div className="mt-0.5 text-sm font-bold text-[var(--success)]">
                  <CurrencyText amountToman={annualIncome} />
                </div>
                {annualIncome > 0 && (
                  <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {formatUsdEquivalentHint(annualIncome, state, gameDataset)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">هزینه برآوردی سالانه</div>
                <div className="mt-0.5 text-sm font-bold text-[var(--danger)]">
                  <CurrencyText amountToman={annualExpenses} />
                </div>
                {annualExpenses > 0 && (
                  <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {formatUsdEquivalentHint(annualExpenses, state, gameDataset)}
                  </div>
                )}
              </div>
            </Card>

            {/* Economy & Inflation Panel */}
            <Card className="space-y-2.5">
              <SectionHeader
                title={`شاخص‌های بازار (${toPersianDigits(state.currentJalaliYear)})`}
                action={
                  <button
                    type="button"
                    onClick={() => setShowInflationTip((v) => !v)}
                    aria-label="توضیح تورم"
                    className="flex min-h-[32px] items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 text-[11px] font-bold text-[var(--primary-strong)]"
                  >
                    <IconInfo className="h-3.5 w-3.5" />
                    <span>تورم: {toPersianDigits(inflationPct)}٪</span>
                  </button>
                }
              />
              {showInflationTip && (
                <p className="rounded-xl bg-[var(--surface-2)] p-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  شاخص‌ها از سال ۱۳۴۰ تا ۱۴۰۵ بر پایه داده‌های واقعی اقتصاد ایران و پس از آن بر اساس
                  سناریوی تورمی شبیه‌سازی تنظیم شده‌اند. حداقل مزد ماهانه فعلی:{' '}
                  {formatToman(minWageMonthly)}.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>نرخ دلار آزاد</span>
                    {usdUp ? (
                      <IconTrendUp className="h-3.5 w-3.5 text-[var(--danger)]" />
                    ) : (
                      <IconTrendDown className="h-3.5 w-3.5 text-[var(--success)]" />
                    )}
                  </div>
                  <div className="mt-1 text-xs font-bold tabular-nums">
                    <CurrencyText amountToman={usdRate} />
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>طلای ۱۸ عیار (گرم)</span>
                    {goldUp ? (
                      <IconTrendUp className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                    ) : (
                      <IconTrendDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="mt-1 text-xs font-bold tabular-nums">
                    <CurrencyText amountToman={goldRate} />
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                  <div className="text-[11px] text-[var(--text-muted)]">سکه امامی</div>
                  <div className="mt-1 text-xs font-bold tabular-nums">
                    <CurrencyText amountToman={coinRate} />
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
                  <div className="text-[11px] text-[var(--text-muted)]">متری آگهی مسکن تهران</div>
                  <div className="mt-1 text-xs font-bold tabular-nums">
                    <CurrencyText amountToman={tehranSqm} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                آپارتمان ۷۰ متری معامله تهران ≈{' '}
                <span className="font-bold text-[var(--text)]">{formatToman(tehran70SqmPrice)}</span>{' '}
                ({formatUsdEquivalentHint(tehran70SqmPrice, state, gameDataset)})
              </div>
            </Card>
          </div>
        )}

        {/* 2. INVESTMENTS TAB */}
        {subTab === 'investments' && (
          <div className="space-y-2.5">
            {player.age < 18 ? (
              <LockedNotice message="سرمایه‌گذاری مستقیم در بازارها از ۱۸ سالگی فعال می‌شود." />
            ) : (
              investmentOptions.map((opt) => {
                const held = state.assets.find((a) => a.id === opt.id);
                const heldVal = held?.currentValueToman ?? 0;
                const pnl = held ? held.currentValueToman - held.purchasePriceToman : 0;
                return (
                  <Card key={opt.id} className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <IconCoins className="h-4 w-4 text-[var(--primary)]" />
                          <span className="text-sm font-bold">{opt.titleFa}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{opt.hint}</p>
                      </div>
                      <Badge tone="neutral">ریسک: {opt.riskLabel}</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs">
                      <span>ارزش فعلی دارایی:</span>
                      <div className="text-left">
                        <div className="flex items-center gap-2 font-bold">
                          <CurrencyText amountToman={heldVal} />
                          {held && pnl !== 0 && (
                            <span
                              className={
                                pnl > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                              }
                            >
                              ({pnl > 0 ? '+' : ''}
                              <CurrencyText amountToman={pnl} />)
                            </span>
                          )}
                        </div>
                        {heldVal > 0 && (
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {formatUsdEquivalentHint(heldVal, state, gameDataset)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton
                        label="خرید"
                        costText={formatToman(quickTradeAmount)}
                        disabled={player.moneyToman < quickTradeAmount}
                        disabledReason={
                          player.moneyToman < quickTradeAmount ? 'موجودی کافی نیست' : undefined
                        }
                        onClick={() =>
                          onUpdateSave(
                            tradeInvestmentAction(
                              saveGame,
                              opt.id,
                              opt.titleFa,
                              opt.assetType,
                              quickTradeAmount,
                              'buy',
                            ),
                          )
                        }
                      />
                      <ActionButton
                        label="فروش کل"
                        costText={heldVal > 0 ? formatToman(heldVal) : undefined}
                        variant="secondary"
                        disabled={heldVal <= 0}
                        disabledReason={heldVal <= 0 ? 'موجودی نداری' : undefined}
                        onClick={() =>
                          onUpdateSave(
                            tradeInvestmentAction(
                              saveGame,
                              opt.id,
                              opt.titleFa,
                              opt.assetType,
                              heldVal,
                              'sell',
                            ),
                          )
                        }
                      />
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* 3. HOUSING & VEHICLES TAB */}
        {subTab === 'housing' && (
          <div className="space-y-4">
            <Card className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconHome className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-bold">مسکن فعلی</span>
                </div>
                <Badge tone="primary">{t(`housingLabels.${player.housing.type}`)}</Badge>
              </div>
              {player.housing.monthlyRentToman > 0 && (
                <div className="text-xs text-[var(--text-muted)]">
                  اجاره ماهانه: <CurrencyText amountToman={player.housing.monthlyRentToman} /> ·
                  ودیعه رهن: <CurrencyText amountToman={player.housing.depositRahnToman} />
                </div>
              )}
              {player.housing.propertyValueToman > 0 && (
                <div className="text-xs text-[var(--text-muted)]">
                  ارزش روز ملک: <CurrencyText amountToman={player.housing.propertyValueToman} /> ·{' '}
                  {formatUsdEquivalentHint(player.housing.propertyValueToman, state, gameDataset)}
                </div>
              )}
            </Card>

            {player.age < 18 ? (
              <LockedNotice message="تغییر مسکن و خرید خودرو از ۱۸ سالگی فعال می‌شود." />
            ) : (
              <>
                <div className="space-y-2.5">
                  <SectionHeader
                    title="فهرست مسکن"
                    subtitle="قیمت قطعی معامله ۱۰٪ پایین‌تر از قیمت آگهی محاسبه می‌شود"
                  />
                  <Card className="py-2.5">
                    <Toggle
                      checked={preferHigherRahn}
                      onChange={setPreferHigherRahn}
                      label="تبدیل ۵۰٪ اجاره به ودیعه رهن"
                      description="هر ۳ میلیون اجاره معادل ۱۰۰ میلیون ودیعه بیشتر محاسبه می‌شود"
                    />
                  </Card>
                  {gameDataset.housing.housingListings.map((listing) => {
                    const quote = getHousingListingQuote(listing, state, gameDataset);
                    const extraDeposit =
                      listing.mode === 'rent' && preferHigherRahn
                        ? Math.round((quote.monthlyRentToman * 0.5) / depositRentRate)
                        : 0;
                    const rentalTerms =
                      listing.mode === 'rent'
                        ? getConvertedRentalPair(
                            quote.depositRahnToman,
                            quote.monthlyRentToman,
                            extraDeposit,
                            gameDataset,
                          )
                        : null;
                    const upfront =
                      listing.mode === 'rent' && rentalTerms
                        ? rentalTerms.deposit + rentalTerms.monthlyRent
                        : quote.transactionPriceToman;
                    const available =
                      listing.mode === 'rent'
                        ? player.moneyToman + player.housing.depositRahnToman
                        : player.moneyToman +
                          player.housing.propertyValueToman +
                          player.housing.depositRahnToman;
                    const cantAfford = available < upfront;
                    return (
                      <ActionButton
                        key={listing.id}
                        label={listing.titleFa}
                        costText={formatToman(upfront)}
                        effectHint={
                          listing.mode === 'rent' && rentalTerms
                            ? `ودیعه ${formatToman(rentalTerms.deposit)} + اجاره ماهانه ${formatToman(rentalTerms.monthlyRent)}`
                            : `متراژ ${toPersianDigits(listing.areaSqm)} متر · آگهی: ${formatToman(quote.listingPriceToman)} · ${formatUsdEquivalentHint(quote.transactionPriceToman, state, gameDataset)}`
                        }
                        variant="secondary"
                        disabled={cantAfford}
                        disabledReason={cantAfford ? 'موجودی کافی نیست' : undefined}
                        onClick={() =>
                          onUpdateSave(
                            applyHousingAction(saveGame, listing, gameDataset, extraDeposit),
                          )
                        }
                      />
                    );
                  })}
                </div>

                {ownedCars.length > 0 && (
                  <div className="space-y-2">
                    <SectionHeader title="خودروهای تو" />
                    {ownedCars.map((car) => {
                      const repairCost = getCarRepairCostToman(car.currentValueToman, gameDataset);
                      return (
                        <Card key={car.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-sm font-bold">
                              <IconCar className="h-4 w-4 text-[var(--primary)]" />
                              {car.name}
                            </span>
                            <CurrencyText
                              amountToman={car.currentValueToman}
                              className="text-xs font-bold text-[var(--primary-strong)]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <ActionButton
                              label="سرویس دوره‌ای"
                              costText={formatToman(repairCost)}
                              variant="secondary"
                              onClick={() =>
                                onUpdateSave(repairVehicleAction(saveGame, car.id, gameDataset))
                              }
                            />
                            <ActionButton
                              label="فروش خودرو"
                              costText={formatToman(car.currentValueToman)}
                              variant="secondary"
                              onClick={() => onUpdateSave(sellVehicleAction(saveGame, car.id))}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <SectionHeader title="نمایشگاه خودرو" />
                  {gameDataset.housing.vehicleCatalog.map((veh) => {
                    const price = getAdjustedPriceToman(veh.basePriceToman, state);
                    const poor = player.moneyToman < price;
                    return (
                      <ActionButton
                        key={veh.id}
                        label={veh.titleFa}
                        costText={formatToman(price)}
                        effectHint={`شادی +${toPersianDigits(veh.happinessBonus)} · ریسک تصادف: ${veh.accidentRiskLabel} · ${formatUsdEquivalentHint(price, state, gameDataset)}`}
                        variant="secondary"
                        disabled={poor}
                        disabledReason={poor ? 'موجودی کافی نیست' : undefined}
                        onClick={() => onUpdateSave(buyVehicleAction(saveGame, veh))}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. LOANS & DEBT TAB */}
        {subTab === 'loans' && (
          <div className="space-y-3.5">
            <Card className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <IconCard className="h-4 w-4 text-[var(--primary)]" />
                  <span>رتبه اعتباری بانکی</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  پرداخت به‌موقع اقساط، امتیاز اعتباری را تقویت می‌کند.
                </p>
              </div>
              <ProgressRing
                value={creditScore}
                max={850}
                label={toPersianDigits(creditScore)}
                colorVar={creditScore >= 600 ? '--success' : '--warning'}
              />
            </Card>

            {(player.debtToman > 0 || state.loans.length > 0) && (
              <Card className="space-y-2.5 border-[var(--warning)]/40 bg-[var(--surface-2)]">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--warning)]">
                  <IconWarning className="h-4 w-4" />
                  <span>بدهی و اقساط فعال</span>
                </div>
                {player.debtToman > 0 && (
                  <div className="text-xs">
                    بدهی معوق: <CurrencyText amountToman={player.debtToman} className="font-bold" />
                  </div>
                )}
                {state.loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-bold">{loan.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        قسط سالانه: <CurrencyText amountToman={loan.annualPaymentToman} /> ·{' '}
                        {toPersianDigits(loan.yearsRemaining)} سال باقی‌مانده
                      </div>
                    </div>
                    <CurrencyText amountToman={loan.principalRemainingToman} className="font-bold" />
                  </div>
                ))}
                <ActionButton
                  label="پرداخت بخشی از بدهی یا وام"
                  costText={formatToman(Math.min(player.moneyToman, debtPayoffChunk))}
                  disabled={player.moneyToman <= 0}
                  disabledReason={player.moneyToman <= 0 ? 'موجودی نقد نداری' : undefined}
                  onClick={() =>
                    onUpdateSave(
                      payOffDebtAction(saveGame, Math.min(player.moneyToman, debtPayoffChunk)),
                    )
                  }
                />
              </Card>
            )}

            {player.age < 18 ? (
              <LockedNotice message="دریافت وام بانکی از ۱۸ سالگی فعال می‌شود." />
            ) : (
              <div className="space-y-2">
                <SectionHeader title="وام‌های قابل درخواست" />
                <ActionButton
                  label={loanPresets.personal.labelFa}
                  costText={`سقف ${formatToman(loanPresets.personal.principalToman)}`}
                  effectHint="واریز فوری به نقدینگی · قسط خودکار سالانه"
                  variant="secondary"
                  onClick={() => onUpdateSave(takeLoanAction(saveGame, 'personal', gameDataset))}
                />
                <ActionButton
                  label={loanPresets.housing.labelFa}
                  costText={`سقف ${formatToman(loanPresets.housing.principalToman)}`}
                  effectHint="مناسب خرید یا رهن مسکن"
                  variant="secondary"
                  onClick={() => onUpdateSave(takeLoanAction(saveGame, 'housing', gameDataset))}
                />
              </div>
            )}
          </div>
        )}

        {/* 5. SHOP TAB */}
        {subTab === 'shop' && (
          <div className="space-y-3">
            <SectionHeader
              title="بازار و خرید کالا"
              subtitle="قیمت‌ها بر اساس نرخ تورم سال جاری تنظیم شده‌اند"
            />
            <FilterChips
              value={shopFilter}
              onChange={setShopFilter}
              items={[
                { value: 'all', label: t('shop.categories.all') },
                { value: 'appliances', label: t('shop.categories.appliances') },
                { value: 'clothing', label: t('shop.categories.clothing') },
                { value: 'tech', label: t('shop.categories.tech') },
                { value: 'travel', label: t('shop.categories.travel') },
                { value: 'gift', label: t('shop.categories.gift') },
                { value: 'nutrition', label: t('shop.categories.nutrition') },
                { value: 'luxury', label: t('shop.categories.luxury') },
              ]}
            />
            <div className="space-y-2">
              {filteredShop.map((item) => {
                const price = getShopItemPriceToman(item, state);
                const alreadyOwned = !item.repeatable && ownedShopIds.includes(item.id);
                const ageLocked = player.age < item.minAge;
                const cantAfford = player.moneyToman < price;
                const reason = alreadyOwned
                  ? 'قبلاً خریداری شده'
                  : ageLocked
                    ? `از ${toPersianDigits(item.minAge)} سالگی فعال می‌شود`
                    : cantAfford
                      ? 'موجودی کافی نیست'
                      : undefined;
                return (
                  <Card key={item.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <IconShop className="h-4 w-4 text-[var(--primary)]" />
                        <span className="text-sm font-bold">{item.titleFa}</span>
                      </div>
                      <Badge tone={alreadyOwned ? 'success' : 'neutral'}>
                        {t(`shop.categories.${item.category}`)}
                      </Badge>
                    </div>
                    <ActionButton
                      label={alreadyOwned ? 'در اختیار تو' : t('buy')}
                      costText={formatToman(price)}
                      effectHint={item.effectHintFa}
                      variant="secondary"
                      disabled={Boolean(reason)}
                      disabledReason={reason}
                      onClick={() => onUpdateSave(buyShopItemAction(saveGame, item))}
                    />
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </FullScreenSheet>
  );
}
