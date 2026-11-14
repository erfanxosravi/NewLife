import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { calculateNetWorthToman } from '../../engine/economy';
import { formatToman, toPersianDigits } from '../../engine/jalali';
import type {
  Asset,
  HousingListing,
  SaveGame,
  ShopCategory,
  ShopItemDefinition,
  VehicleCatalogItem,
} from '../../engine/types';
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
  ActionRow,
  Card,
  ConfirmDialog,
  CurrencyText,
  DangerZoneGroup,
  DetailSheet,
  FilterChips,
  HubHeroCard,
  InfoSheet,
  LockedNotice,
  ProgressRing,
  SectionGroup,
  SegmentedControl,
  Sparkline,
  Toggle,
} from '../components/Primitives';
import {
  IconAssets,
  IconBank,
  IconCar,
  IconCard,
  IconCoins,
  IconHome,
  IconShop,
  IconSparkles,
  IconTrendDown,
  IconTrendUp,
  IconWarning,
} from '../icons';

interface AssetsFinanceSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onOpenWill?: () => void;
}

type SubTab = 'overview' | 'investments' | 'housing' | 'loans' | 'shop';
type InfoTopic = 'netWorth' | 'macro' | 'investments' | 'housing' | 'loans' | null;
type InvestmentId = 'inv_usd' | 'inv_gold' | 'inv_bourse' | 'inv_deposit' | 'inv_crypto';

type PendingAssetConfirm =
  | {
      kind: 'sell_investment';
      id: InvestmentId;
      titleFa: string;
      assetType: Asset['type'];
      amountToman: number;
    }
  | { kind: 'housing'; listing: HousingListing; extraDeposit: number; upfrontToman: number }
  | { kind: 'buy_vehicle'; vehicle: VehicleCatalogItem; priceToman: number }
  | { kind: 'sell_vehicle'; carId: string; titleFa: string; priceToman: number }
  | { kind: 'loan'; loanKind: 'personal' | 'housing'; labelFa: string; principalToman: number }
  | { kind: 'buy_shop'; item: ShopItemDefinition; priceToman: number };

export function AssetsFinanceSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
  onOpenWill,
}: AssetsFinanceSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [shopFilter, setShopFilter] = useState<'all' | ShopCategory>('all');
  const [preferHigherRahn, setPreferHigherRahn] = useState(false);

  const [showMarketDetail, setShowMarketDetail] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<InvestmentId | null>(null);
  const [housingDrill, setHousingDrill] = useState<'market' | 'showroom' | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [infoTopic, setInfoTopic] = useState<InfoTopic>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingAssetConfirm | null>(null);

  const bankRatePct = Math.round(
    gameDataset.economy.baseline1405.policyAndModel.bankDepositAnnualRate.value * 100,
  );
  const depositRentRate =
    gameDataset.economy.baseline1405.policyAndModel.depositToMonthlyRentRate.value;

  const investmentOptions = useMemo<
    {
      id: InvestmentId;
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

  const totalLoanDebt = state.loans.reduce((s, l) => s + l.principalRemainingToman, 0);
  const totalDebtAll = player.debtToman + totalLoanDebt;

  const ownedCars = state.assets.filter((a) => a.type === 'car');
  const selectedCar = ownedCars.find((c) => c.id === selectedCarId) ?? null;

  const totalPortfolioVal = useMemo(
    () =>
      investmentOptions.reduce((sum, opt) => {
        const held = state.assets.find((a) => a.id === opt.id);
        return sum + (held?.currentValueToman ?? 0);
      }, 0),
    [investmentOptions, state.assets],
  );

  const totalPortfolioPnl = useMemo(
    () =>
      investmentOptions.reduce((sum, opt) => {
        const held = state.assets.find((a) => a.id === opt.id);
        return sum + (held ? held.currentValueToman - held.purchasePriceToman : 0);
      }, 0),
    [investmentOptions, state.assets],
  );

  const selectedInvestment = investmentOptions.find((o) => o.id === selectedInvId) ?? null;
  const selectedInvHeld = selectedInvestment
    ? state.assets.find((a) => a.id === selectedInvestment.id)
    : undefined;

  const filteredShop = useMemo(() => {
    if (shopFilter === 'all') return gameDataset.shop;
    return gameDataset.shop.filter((item) => item.category === shopFilter);
  }, [shopFilter]);

  const shopSections = useMemo(() => {
    if (shopFilter !== 'all' || filteredShop.length <= 7) {
      return [{ title: 'فهرست کالاها', items: filteredShop }];
    }
    const lifestyleIds = new Set<ShopCategory>(['clothing', 'nutrition', 'gift', 'appliances']);
    const first = filteredShop.filter((item) => lifestyleIds.has(item.category));
    const second = filteredShop.filter((item) => !lifestyleIds.has(item.category));
    return [
      { title: 'روزمره، سلامت و خانه', items: first },
      { title: 'فناوری، سفر و لوکس', items: second },
    ].filter((group) => group.items.length > 0);
  }, [filteredShop, shopFilter]);

  const quickTradeAmount = getQuickTradeAmountToman(state, gameDataset);
  const debtPayoffChunk = getDebtPayoffChunkToman(state, gameDataset);
  const loanPresets = getLoanPresets(state, gameDataset);

  const renderShopRow = (item: ShopItemDefinition) => {
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
    const isMajorPurchase = item.category === 'luxury' || price >= 50_000_000;

    return (
      <ActionRow
        key={item.id}
        icon={<IconShop className="h-4 w-4" />}
        title={item.titleFa}
        subtitle={`${t(`shop.categories.${item.category}`)} · ${item.effectHintFa}`}
        value={formatToman(price)}
        state={alreadyOwned ? 'done' : ageLocked ? 'locked' : cantAfford ? 'disabled' : 'enabled'}
        reason={reason}
        ctaLabel={alreadyOwned ? undefined : t('buy')}
        onClick={() => {
          if (isMajorPurchase) {
            setPendingConfirm({ kind: 'buy_shop', item, priceToman: price });
          } else {
            onUpdateSave(buyShopItemAction(saveGame, item));
          }
        }}
      />
    );
  };

  const confirmDialogSpec = (() => {
    if (!pendingConfirm) return null;
    if (pendingConfirm.kind === 'sell_investment') {
      return {
        title: `فروش کل ${pendingConfirm.titleFa}`,
        message: `با فروش تمام موجودی این دارایی، مبلغ ${formatToman(pendingConfirm.amountToman)} به نقدینگی تو اضافه می‌شود.`,
        destructive: false,
        confirmLabel: 'فروش کل',
      };
    }
    if (pendingConfirm.kind === 'housing') {
      return {
        title: `تأیید معامله: ${pendingConfirm.listing.titleFa}`,
        message:
          pendingConfirm.listing.mode === 'rent'
            ? `مبلغ پیش‌پرداخت (ودیعه + اجاره ماه اول) برابر با ${formatToman(pendingConfirm.upfrontToman)} است و جایگزین مسکن فعلی می‌شود.`
            : `قیمت قطعی معامله ${formatToman(pendingConfirm.upfrontToman)} است. با تسویه ملک قبلی انجام می‌شود.`,
        destructive: false,
        confirmLabel: 'امضای قرارداد',
      };
    }
    if (pendingConfirm.kind === 'buy_vehicle') {
      return {
        title: `خرید ${pendingConfirm.vehicle.titleFa}`,
        message: `مبلغ ${formatToman(pendingConfirm.priceToman)} از نقدینگی کسر می‌شود و هزینه نگهداری سالانه دارد.`,
        destructive: false,
        confirmLabel: 'خرید خودرو',
      };
    }
    if (pendingConfirm.kind === 'sell_vehicle') {
      return {
        title: `فروش ${pendingConfirm.titleFa}`,
        message: `خودرو به قیمت روز ${formatToman(pendingConfirm.priceToman)} فروخته می‌شود و قابل بازگشت نیست.`,
        destructive: true,
        confirmLabel: 'فروش خودرو',
      };
    }
    if (pendingConfirm.kind === 'loan') {
      return {
        title: `دریافت ${pendingConfirm.labelFa}`,
        message: `مبلغ ${formatToman(pendingConfirm.principalToman)} واریز می‌شود و اقساط آن به‌صورت خودکار سالانه کسر خواهد شد.`,
        destructive: false,
        confirmLabel: 'دریافت وام',
      };
    }
    return {
      title: `تأیید خرید: ${pendingConfirm.item.titleFa}`,
      message: `مبلغ ${formatToman(pendingConfirm.priceToman)} بابت این کالا پرداخت می‌شود. ${pendingConfirm.item.effectHintFa}.`,
      destructive: false,
      confirmLabel: 'تأیید خرید',
    };
  })();

  const handleConfirmExecute = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === 'sell_investment') {
      onUpdateSave(
        tradeInvestmentAction(
          saveGame,
          pendingConfirm.id,
          pendingConfirm.titleFa,
          pendingConfirm.assetType,
          pendingConfirm.amountToman,
          'sell',
        ),
      );
    } else if (pendingConfirm.kind === 'housing') {
      onUpdateSave(
        applyHousingAction(
          saveGame,
          pendingConfirm.listing,
          gameDataset,
          pendingConfirm.extraDeposit,
        ),
      );
      setHousingDrill(null);
    } else if (pendingConfirm.kind === 'buy_vehicle') {
      onUpdateSave(buyVehicleAction(saveGame, pendingConfirm.vehicle));
      setHousingDrill(null);
    } else if (pendingConfirm.kind === 'sell_vehicle') {
      onUpdateSave(sellVehicleAction(saveGame, pendingConfirm.carId));
      setSelectedCarId(null);
    } else if (pendingConfirm.kind === 'loan') {
      onUpdateSave(takeLoanAction(saveGame, pendingConfirm.loanKind, gameDataset));
    } else if (pendingConfirm.kind === 'buy_shop') {
      onUpdateSave(buyShopItemAction(saveGame, pendingConfirm.item));
    }
    setPendingConfirm(null);
  };

  const infoContent: Record<Exclude<InfoTopic, null>, { title: string; bullets: string[] }> = {
    netWorth: {
      title: 'دارایی خالص و قدرت خرید',
      bullets: [
        'دارایی خالص برابر مجموع نقدینگی، ملک، خودرو و سبد سرمایه‌گذاری منهای بدهی و مانده وام‌هاست.',
        'معادل واحد ۷۰ متری تهران بر اساس میانگین قیمت روز مسکن محاسبه می‌شود تا اثر تورم ملموس بماند.',
      ],
    },
    macro: {
      title: 'شاخص‌های بازار و تورم',
      bullets: [
        'شاخص‌ها از سال ۱۳۴۰ تا ۱۴۰۵ بر پایه داده‌های واقعی اقتصاد ایران و پس از آن بر اساس سناریوی تورمی شبیه‌سازی تنظیم شده‌اند.',
        `حداقل مزد ماهانه فعلی در مدل اقتصاد: ${formatToman(minWageMonthly)}.`,
      ],
    },
    investments: {
      title: 'بازارهای سرمایه‌گذاری',
      bullets: [
        'دلار و طلا بیشتر برای حفظ ارزش در برابر تورم کاربرد دارند.',
        'بورس و رمزارز نوسان سالانه بالاتری دارند و در سپرده بانکی سود اسمی ثابت دریافت می‌کنی.',
      ],
    },
    housing: {
      title: 'مسکن و خودرو',
      bullets: [
        'قیمت قطعی معامله مسکن ۱۰ درصد پایین‌تر از قیمت آگهی لحاظ می‌شود.',
        'در معاملات اجاره می‌توانی نیمی از اجاره ماهانه را به ودیعه رهن تبدیل کنی.',
      ],
    },
    loans: {
      title: 'رتبه اعتباری و وام',
      bullets: [
        'پرداخت به‌موقع اقساط سالانه، رتبه اعتباری بانکی تو را تقویت می‌کند.',
        'در صورت کمبود نقدینگی هنگام پرداخت قسط، مبلغ معوق به بدهی افزوده می‌شود.',
      ],
    },
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.assets')}
      subtitle={`نقدینگی: ${formatToman(player.moneyToman)}`}
      scrollKey={subTab}
      stickySubHeader={
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
      }
    >
      <div className="space-y-4">
        {/* 1. OVERVIEW HUB */}
        {subTab === 'overview' && (
          <>
            <HubHeroCard
              tone="primary"
              icon={<IconAssets className="h-5 w-5" />}
              title={formatToman(netWorth)}
              subtitle={`${t('netWorthLabel')} · ${netWorthPP.labelFa} · معادل ${toPersianDigits(netWorthPP.tehran70SqmApts)} واحد ۷۰ متری`}
              onInfo={() => setInfoTopic('netWorth')}
              detailsLabel="تحلیل بازار"
              onDetails={() => setShowMarketDetail(true)}
              metrics={[
                { label: t('cashLabel'), value: <CurrencyText amountToman={player.moneyToman} /> },
                {
                  label: 'خالص درآمد سالانه',
                  value: <CurrencyText amountToman={annualIncome} />,
                },
                { label: 'کل بدهی و وام', value: <CurrencyText amountToman={totalDebtAll} /> },
              ]}
            />

            <SectionGroup
              title="روند دارایی و شاخص بازار"
              subtitle={`تورم سال ${toPersianDigits(state.currentJalaliYear)}: ${toPersianDigits(inflationPct)}٪`}
            >
              <div className="p-3">
                <Sparkline values={netWorthSeries} colorVar="--primary" height={40} />
              </div>
              <ActionRow
                icon={<IconTrendUp className="h-4 w-4" />}
                title={`نرخ‌های بازار (${toPersianDigits(state.currentJalaliYear)})`}
                subtitle={`دلار: ${formatToman(usdRate)} · طلای ۱۸: ${formatToman(goldRate)}`}
                value={`${toPersianDigits(inflationPct)}٪ تورم`}
                showChevron
                onClick={() => setShowMarketDetail(true)}
              />
            </SectionGroup>

            <SectionGroup title="بخش‌های مالی">
              <ActionRow
                icon={<IconCoins className="h-4 w-4" />}
                title={t('tabs.investments')}
                subtitle={
                  totalPortfolioVal > 0
                    ? `ارزش سبد: ${formatToman(totalPortfolioVal)}`
                    : 'ارز، طلا، بورس و سپرده بانکی'
                }
                showChevron
                onClick={() => setSubTab('investments')}
              />
              <ActionRow
                icon={<IconHome className="h-4 w-4" />}
                title={t('tabs.housing')}
                subtitle={`مسکن: ${t(`housingLabels.${player.housing.type}`)} · ${toPersianDigits(ownedCars.length)} خودرو`}
                showChevron
                onClick={() => setSubTab('housing')}
              />
              <ActionRow
                icon={<IconCard className="h-4 w-4" />}
                title={t('tabs.loans')}
                subtitle={`رتبه اعتباری ${toPersianDigits(creditScore)} · ${toPersianDigits(state.loans.length)} وام فعال`}
                showChevron
                onClick={() => setSubTab('loans')}
              />
              {onOpenWill && (
                <ActionRow
                  icon={<IconBank className="h-4 w-4" />}
                  title={t('legacy.willTitle')}
                  subtitle={
                    state.will
                      ? `ثبت‌شده در ${toPersianDigits(state.will.updatedAtAge)} سالگی`
                      : 'تنظیم وصیت‌نامه و قواعد ارث'
                  }
                  state={state.will ? 'done' : 'enabled'}
                  showChevron
                  onClick={onOpenWill}
                />
              )}
            </SectionGroup>
          </>
        )}

        {/* 2. INVESTMENTS HUB */}
        {subTab === 'investments' && (
          <>
            {player.age < 18 ? (
              <LockedNotice message="سرمایه‌گذاری مستقیم در بازارها از ۱۸ سالگی فعال می‌شود." />
            ) : (
              <>
                <HubHeroCard
                  icon={<IconCoins className="h-5 w-5" />}
                  title="سبد سرمایه‌گذاری"
                  subtitle="برای خرید سریع یا فروش، هر بازار را باز کن"
                  onInfo={() => setInfoTopic('investments')}
                  metrics={[
                    { label: 'ارزش کل سبد', value: formatToman(totalPortfolioVal) },
                    {
                      label: 'سود یا زیان',
                      value: <CurrencyText amountToman={totalPortfolioPnl} showSign />,
                      tone: totalPortfolioPnl >= 0 ? 'success' : 'danger',
                    },
                    { label: 'نقدینگی آزاد', value: formatToman(player.moneyToman) },
                  ]}
                />

                <SectionGroup title="بازارهای سرمایه‌گذاری">
                  {investmentOptions.map((opt) => {
                    const held = state.assets.find((a) => a.id === opt.id);
                    const heldVal = held?.currentValueToman ?? 0;
                    return (
                      <ActionRow
                        key={opt.id}
                        icon={<IconCoins className="h-4 w-4" />}
                        title={opt.titleFa}
                        subtitle={`ریسک: ${opt.riskLabel} · ${opt.hint}`}
                        value={heldVal > 0 ? formatToman(heldVal) : 'بدون موجودی'}
                        state={heldVal > 0 ? 'recommended' : 'enabled'}
                        showChevron
                        onClick={() => setSelectedInvId(opt.id)}
                      />
                    );
                  })}
                </SectionGroup>
              </>
            )}
          </>
        )}

        {/* 3. HOUSING & VEHICLES HUB */}
        {subTab === 'housing' && (
          <>
            <HubHeroCard
              icon={<IconHome className="h-5 w-5" />}
              title={`مسکن: ${t(`housingLabels.${player.housing.type}`)}`}
              subtitle={
                player.housing.propertyValueToman > 0
                  ? `ارزش روز ملک: ${formatToman(player.housing.propertyValueToman)}`
                  : player.housing.monthlyRentToman > 0
                    ? `ودیعه: ${formatToman(player.housing.depositRahnToman)} · اجاره: ${formatToman(player.housing.monthlyRentToman)}`
                    : 'اقامت خانوادگی بدون هزینه اجاره'
              }
              onInfo={() => setInfoTopic('housing')}
              metrics={[
                {
                  label: 'دارایی یا رهن ملک',
                  value: formatToman(
                    player.housing.propertyValueToman || player.housing.depositRahnToman,
                  ),
                },
                { label: 'تعداد خودرو', value: `${toPersianDigits(ownedCars.length)} دستگاه` },
                { label: 'نقدینگی', value: formatToman(player.moneyToman) },
              ]}
            />

            {player.age < 18 ? (
              <LockedNotice message="تغییر مسکن و خرید خودرو از ۱۸ سالگی فعال می‌شود." />
            ) : (
              <>
                {ownedCars.length > 0 && (
                  <SectionGroup title="خودروهای من">
                    {ownedCars.slice(0, 7).map((car) => (
                      <ActionRow
                        key={car.id}
                        icon={<IconCar className="h-4 w-4" />}
                        title={car.name}
                        subtitle="نگهداری، سرویس دوره‌ای و فروش"
                        value={formatToman(car.currentValueToman)}
                        showChevron
                        onClick={() => setSelectedCarId(car.id)}
                      />
                    ))}
                  </SectionGroup>
                )}

                <SectionGroup title="معاملات مسکن و خودرو">
                  <ActionRow
                    icon={<IconHome className="h-4 w-4" />}
                    title="فهرست مسکن (خرید و اجاره)"
                    subtitle={`متری تهران: ${formatToman(tehranSqm)} · ${toPersianDigits(gameDataset.housing.housingListings.length)} فایل`}
                    showChevron
                    onClick={() => setHousingDrill('market')}
                  />
                  <ActionRow
                    icon={<IconCar className="h-4 w-4" />}
                    title="نمایشگاه خودرو"
                    subtitle={`${toPersianDigits(gameDataset.housing.vehicleCatalog.length)} مدل خودرو قابل خرید`}
                    showChevron
                    onClick={() => setHousingDrill('showroom')}
                  />
                </SectionGroup>
              </>
            )}
          </>
        )}

        {/* 4. LOANS & DEBT HUB */}
        {subTab === 'loans' && (
          <>
            <HubHeroCard
              icon={<IconCard className="h-5 w-5" />}
              title="رتبه اعتباری بانکی"
              subtitle="پرداخت به‌موقع اقساط، اعتبار بانکی را تقویت می‌کند"
              onInfo={() => setInfoTopic('loans')}
              badge={
                <ProgressRing
                  value={creditScore}
                  max={850}
                  size={54}
                  strokeWidth={5}
                  label={toPersianDigits(creditScore)}
                  colorVar={creditScore >= 600 ? '--success' : '--warning'}
                />
              }
              metrics={[
                {
                  label: 'بدهی معوق',
                  value: formatToman(player.debtToman),
                  tone: player.debtToman > 0 ? 'danger' : 'default',
                },
                { label: 'مانده وام‌ها', value: formatToman(totalLoanDebt) },
                { label: 'تعداد وام فعال', value: `${toPersianDigits(state.loans.length)} فقره` },
              ]}
            />

            {(player.debtToman > 0 || state.loans.length > 0) && (
              <SectionGroup title="بدهی و اقساط فعال">
                {player.debtToman > 0 && (
                  <ActionRow
                    icon={<IconWarning className="h-4 w-4" />}
                    iconTone="warning"
                    title="بدهی معوق"
                    subtitle="در اولویت بازپرداخت قرار دارد"
                    value={formatToman(player.debtToman)}
                  />
                )}
                {state.loans.slice(0, 5).map((loan) => (
                  <ActionRow
                    key={loan.id}
                    icon={<IconBank className="h-4 w-4" />}
                    title={loan.name}
                    subtitle={`قسط سالانه: ${formatToman(loan.annualPaymentToman)} · ${toPersianDigits(loan.yearsRemaining)} سال باقی‌مانده`}
                    value={formatToman(loan.principalRemainingToman)}
                  />
                ))}
                <ActionRow
                  icon={<IconCoins className="h-4 w-4" />}
                  title="پرداخت بخشی از بدهی یا وام"
                  subtitle="کاهش سریع بدهی و بهبود رتبه اعتباری"
                  value={formatToman(Math.min(player.moneyToman, debtPayoffChunk))}
                  state={player.moneyToman <= 0 ? 'disabled' : 'recommended'}
                  reason={player.moneyToman <= 0 ? 'موجودی نقد نداری' : undefined}
                  ctaLabel="پرداخت"
                  onClick={() =>
                    onUpdateSave(
                      payOffDebtAction(saveGame, Math.min(player.moneyToman, debtPayoffChunk)),
                    )
                  }
                />
              </SectionGroup>
            )}

            {player.age < 18 ? (
              <LockedNotice message="دریافت وام بانکی از ۱۸ سالگی فعال می‌شود." />
            ) : (
              <SectionGroup title="وام‌های قابل درخواست">
                <ActionRow
                  icon={<IconCard className="h-4 w-4" />}
                  title={loanPresets.personal.labelFa}
                  subtitle="واریز فوری به نقدینگی · قسط خودکار سالانه"
                  value={`سقف ${formatToman(loanPresets.personal.principalToman)}`}
                  ctaLabel="درخواست"
                  onClick={() =>
                    setPendingConfirm({
                      kind: 'loan',
                      loanKind: 'personal',
                      labelFa: loanPresets.personal.labelFa,
                      principalToman: loanPresets.personal.principalToman,
                    })
                  }
                />
                <ActionRow
                  icon={<IconHome className="h-4 w-4" />}
                  title={loanPresets.housing.labelFa}
                  subtitle="مناسب خرید یا رهن مسکن"
                  value={`سقف ${formatToman(loanPresets.housing.principalToman)}`}
                  ctaLabel="درخواست"
                  onClick={() =>
                    setPendingConfirm({
                      kind: 'loan',
                      loanKind: 'housing',
                      labelFa: loanPresets.housing.labelFa,
                      principalToman: loanPresets.housing.principalToman,
                    })
                  }
                />
              </SectionGroup>
            )}
          </>
        )}

        {/* 5. SHOP HUB */}
        {subTab === 'shop' && (
          <>
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

            {shopSections.map((group) => (
              <SectionGroup
                key={group.title}
                title={group.title}
                subtitle="قیمت‌ها بر اساس تورم سال جاری تنظیم شده‌اند"
              >
                {group.items.map(renderShopRow)}
              </SectionGroup>
            ))}
          </>
        )}
      </div>

      {/* DRILL-DOWN: Market & Macro Analysis */}
      <DetailSheet
        open={showMarketDetail}
        onClose={() => setShowMarketDetail(false)}
        title={`تحلیل بازار (${toPersianDigits(state.currentJalaliYear)})`}
        subtitle="شاخص‌های کلان، درآمد و روند دارایی"
        onInfo={() => setInfoTopic('macro')}
      >
        <HubHeroCard
          icon={usdUp ? <IconTrendUp className="h-5 w-5" /> : <IconTrendDown className="h-5 w-5" />}
          title={`تورم سال جاری: ${toPersianDigits(inflationPct)}٪`}
          subtitle={`حداقل مزد ماهانه: ${formatToman(minWageMonthly)} · ${formatUsdEquivalentHint(netWorth, state, gameDataset)}`}
          metrics={[
            { label: 'خالص درآمد سالانه', value: formatToman(annualIncome), tone: 'success' },
            { label: 'هزینه سالانه', value: formatToman(annualExpenses), tone: 'danger' },
            { label: 'آپارتمان ۷۰ متری', value: formatToman(tehran70SqmPrice) },
          ]}
        />

        <SectionGroup title="روند تغییر دارایی خالص">
          <div className="p-3">
            <Sparkline values={netWorthSeries} colorVar="--primary" height={48} />
          </div>
        </SectionGroup>

        <SectionGroup title="نرخ‌های روز بازار">
          <ActionRow
            icon={
              usdUp ? (
                <IconTrendUp className="h-4 w-4 text-[var(--danger)]" />
              ) : (
                <IconTrendDown className="h-4 w-4 text-[var(--success)]" />
              )
            }
            title="نرخ دلار آزاد"
            subtitle="تأثیرگذار بر کالاهای وارداتی و سفر"
            value={formatToman(usdRate)}
          />
          <ActionRow
            icon={<IconCoins className="h-4 w-4" />}
            title="طلای ۱۸ عیار (گرم)"
            subtitle="نوسان همگام با سکه و ارز"
            value={formatToman(goldRate)}
          />
          <ActionRow
            icon={<IconSparkles className="h-4 w-4" />}
            title="سکه امامی"
            subtitle="شاخص رایج پس‌انداز بلندمدت"
            value={formatToman(coinRate)}
          />
          <ActionRow
            icon={<IconHome className="h-4 w-4" />}
            title="متری آگهی مسکن تهران"
            subtitle={`واحد ۷۰ متری معامله: ${formatToman(tehran70SqmPrice)}`}
            value={formatToman(tehranSqm)}
          />
        </SectionGroup>
      </DetailSheet>

      {/* DRILL-DOWN: Investment Trade Sheet */}
      <DetailSheet
        open={selectedInvestment !== null}
        onClose={() => setSelectedInvId(null)}
        title={selectedInvestment?.titleFa ?? ''}
        subtitle={selectedInvestment ? `ریسک: ${selectedInvestment.riskLabel}` : undefined}
        onInfo={() => setInfoTopic('investments')}
      >
        {selectedInvestment && (() => {
          const heldVal = selectedInvHeld?.currentValueToman ?? 0;
          const pnl = selectedInvHeld
            ? selectedInvHeld.currentValueToman - selectedInvHeld.purchasePriceToman
            : 0;
          return (
            <>
              <HubHeroCard
                icon={<IconCoins className="h-5 w-5" />}
                title={formatToman(heldVal)}
                subtitle={selectedInvestment.hint}
                status={heldVal > 0 ? 'in_progress' : 'waiting'}
                metrics={[
                  {
                    label: 'سود یا زیان',
                    value: <CurrencyText amountToman={pnl} showSign />,
                    tone: pnl > 0 ? 'success' : pnl < 0 ? 'danger' : 'default',
                  },
                  { label: 'حجم خرید سریع', value: formatToman(quickTradeAmount) },
                  { label: 'نقدینگی آزاد', value: formatToman(player.moneyToman) },
                ]}
              />

              <SectionGroup title="معامله سریع">
                <ActionRow
                  icon={<IconCoins className="h-4 w-4" />}
                  title="خرید سریع"
                  subtitle="افزودن به دارایی با نرخ روز"
                  value={formatToman(quickTradeAmount)}
                  state={player.moneyToman < quickTradeAmount ? 'disabled' : 'recommended'}
                  reason={player.moneyToman < quickTradeAmount ? 'موجودی کافی نیست' : undefined}
                  ctaLabel="خرید"
                  onClick={() =>
                    onUpdateSave(
                      tradeInvestmentAction(
                        saveGame,
                        selectedInvestment.id,
                        selectedInvestment.titleFa,
                        selectedInvestment.assetType,
                        quickTradeAmount,
                        'buy',
                      ),
                    )
                  }
                />
                <ActionRow
                  icon={<IconAssets className="h-4 w-4" />}
                  title="فروش کل دارایی"
                  subtitle="تبدیل کامل این دارایی به نقدینگی"
                  value={heldVal > 0 ? formatToman(heldVal) : '۰ تومان'}
                  state={heldVal <= 0 ? 'disabled' : 'enabled'}
                  reason={heldVal <= 0 ? 'موجودی نداری' : undefined}
                  ctaLabel="فروش کل"
                  onClick={() =>
                    setPendingConfirm({
                      kind: 'sell_investment',
                      id: selectedInvestment.id,
                      titleFa: selectedInvestment.titleFa,
                      assetType: selectedInvestment.assetType,
                      amountToman: heldVal,
                    })
                  }
                />
              </SectionGroup>
            </>
          );
        })()}
      </DetailSheet>

      {/* DRILL-DOWN: Housing Market */}
      <DetailSheet
        open={housingDrill === 'market'}
        onClose={() => setHousingDrill(null)}
        title="بازار مسکن"
        subtitle="قیمت قطعی معامله ۱۰٪ پایین‌تر از آگهی محاسبه می‌شود"
        onInfo={() => setInfoTopic('housing')}
      >
        <Card className="py-2.5">
          <Toggle
            checked={preferHigherRahn}
            onChange={setPreferHigherRahn}
            label="تبدیل ۵۰٪ اجاره به ودیعه رهن"
            description="هر ۳ میلیون اجاره معادل ۱۰۰ میلیون ودیعه بیشتر محاسبه می‌شود"
          />
        </Card>

        <SectionGroup title="فایل‌های موجود">
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
              <ActionRow
                key={listing.id}
                icon={<IconHome className="h-4 w-4" />}
                title={listing.titleFa}
                subtitle={
                  listing.mode === 'rent' && rentalTerms
                    ? `ودیعه ${formatToman(rentalTerms.deposit)} + اجاره ${formatToman(rentalTerms.monthlyRent)}`
                    : `متراژ ${toPersianDigits(listing.areaSqm)} متر · قیمت آگهی: ${formatToman(quote.listingPriceToman)}`
                }
                value={formatToman(upfront)}
                state={cantAfford ? 'disabled' : 'enabled'}
                reason={cantAfford ? 'موجودی کافی نیست' : undefined}
                ctaLabel={listing.mode === 'rent' ? 'اجاره' : 'خرید'}
                onClick={() =>
                  setPendingConfirm({
                    kind: 'housing',
                    listing,
                    extraDeposit,
                    upfrontToman: upfront,
                  })
                }
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      {/* DRILL-DOWN: Vehicle Showroom */}
      <DetailSheet
        open={housingDrill === 'showroom'}
        onClose={() => setHousingDrill(null)}
        title="نمایشگاه خودرو"
        subtitle={`نقدینگی: ${formatToman(player.moneyToman)}`}
      >
        <SectionGroup title="مدل‌های قابل خرید">
          {gameDataset.housing.vehicleCatalog.map((veh) => {
            const price = getAdjustedPriceToman(veh.basePriceToman, state);
            const poor = player.moneyToman < price;
            return (
              <ActionRow
                key={veh.id}
                icon={<IconCar className="h-4 w-4" />}
                title={veh.titleFa}
                subtitle={`شادی +${toPersianDigits(veh.happinessBonus)} · ریسک تصادف: ${veh.accidentRiskLabel}`}
                value={formatToman(price)}
                state={poor ? 'disabled' : 'enabled'}
                reason={poor ? 'موجودی کافی نیست' : undefined}
                ctaLabel="خرید"
                onClick={() =>
                  setPendingConfirm({
                    kind: 'buy_vehicle',
                    vehicle: veh,
                    priceToman: price,
                  })
                }
              />
            );
          })}
        </SectionGroup>
      </DetailSheet>

      {/* DRILL-DOWN: Owned Car Maintenance & Sale */}
      <DetailSheet
        open={selectedCar !== null}
        onClose={() => setSelectedCarId(null)}
        title={selectedCar?.name ?? ''}
        subtitle="مدیریت نگهداری و فروش خودرو"
      >
        {selectedCar && (() => {
          const repairCost = getCarRepairCostToman(selectedCar.currentValueToman, gameDataset);
          return (
            <>
              <HubHeroCard
                icon={<IconCar className="h-5 w-5" />}
                title={selectedCar.name}
                subtitle={`ارزش روز: ${formatToman(selectedCar.currentValueToman)}`}
                metrics={[
                  { label: 'ارزش روز', value: formatToman(selectedCar.currentValueToman) },
                  { label: 'هزینه سرویس', value: formatToman(repairCost) },
                  { label: 'نقدینگی', value: formatToman(player.moneyToman) },
                ]}
              />

              <SectionGroup title="نگهداری">
                <ActionRow
                  icon={<IconCar className="h-4 w-4" />}
                  title="سرویس دوره‌ای"
                  subtitle="حفظ سلامت فنی و ارزش فروش خودرو"
                  value={formatToman(repairCost)}
                  state={player.moneyToman < repairCost ? 'disabled' : 'enabled'}
                  reason={player.moneyToman < repairCost ? 'موجودی کافی نیست' : undefined}
                  ctaLabel="سرویس"
                  onClick={() =>
                    onUpdateSave(repairVehicleAction(saveGame, selectedCar.id, gameDataset))
                  }
                />
              </SectionGroup>

              <DangerZoneGroup title="گزینه‌های حساس">
                <ActionRow
                  variant="danger"
                  icon={<IconWarning className="h-4 w-4" />}
                  title="فروش خودرو"
                  subtitle="فروش فوری به قیمت روز بازار"
                  value={formatToman(selectedCar.currentValueToman)}
                  ctaLabel="فروش"
                  onClick={() =>
                    setPendingConfirm({
                      kind: 'sell_vehicle',
                      carId: selectedCar.id,
                      titleFa: selectedCar.name,
                      priceToman: selectedCar.currentValueToman,
                    })
                  }
                />
              </DangerZoneGroup>
            </>
          );
        })()}
      </DetailSheet>

      <InfoSheet
        open={infoTopic !== null}
        onClose={() => setInfoTopic(null)}
        title={infoTopic ? infoContent[infoTopic].title : ''}
        bullets={infoTopic ? infoContent[infoTopic].bullets : undefined}
      />

      <ConfirmDialog
        open={confirmDialogSpec !== null}
        title={confirmDialogSpec?.title ?? ''}
        message={confirmDialogSpec?.message ?? ''}
        confirmLabel={confirmDialogSpec?.confirmLabel ?? 'تأیید'}
        destructive={confirmDialogSpec?.destructive ?? false}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={handleConfirmExecute}
      />
    </FullScreenSheet>
  );
}
