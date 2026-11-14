import { useMemo, useState, type ReactNode } from 'react';
import { gameDataset } from '../../data/registry';
import { getAbroadHousingOptions, getCountryMacroDef } from '../../engine/countries';
import { calculateNetWorthToman } from '../../engine/economy';
import { ALL_CURRENCY_CODES, getCurrencyDef, quoteConversion } from '../../engine/fx';
import { toPersianDigits } from '../../engine/jalali';
import { getWalletBalance } from '../../engine/ledger';
import type {
  Asset,
  CurrencyCode,
  DisplayCurrencyMode,
  HousingListing,
  SaveGame,
  ShopCategory,
  ShopItemDefinition,
  TransferChannelDef,
  VehicleCatalogItem,
} from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  applyHousingAction,
  buyShopItemAction,
  buyVehicleAction,
  convertCurrencyAction,
  payOffDebtAction,
  rentOrBuyAbroadHousingAction,
  repairVehicleAction,
  sellVehicleAction,
  setDisplayCurrencyModeAction,
  submitCrossBorderTransferAction,
  takeLoanAction,
  tradeInvestmentAction,
  type ActionOutcome,
} from '../../state/actions';
import {
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
  getHeaderMoneySummary,
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
import { CurrencyExposureCard } from '../components/CurrencyExposureCard';
import { SellIranPropertyWizard } from '../components/emigration/SellIranPropertyWizard';
import { ExchangeRateStrip } from '../components/ExchangeRateStrip';
import { ForeignPaymentSheet } from '../components/ForeignPaymentSheet';
import { FullScreenSheet } from '../components/FullScreenSheet';
import { MoneyText } from '../components/MoneyText';
import {
  ActionRow,
  Card,
  ConfirmDialog,
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
  const [showFxDrawer, setShowFxDrawer] = useState(false);
  const [fxMode, setFxMode] = useState<'convert' | 'transfer'>('convert');
  const [fxFrom, setFxFrom] = useState<CurrencyCode>('IRT');
  const [fxTo, setFxTo] = useState<CurrencyCode>('USD');
  const [fxAmountPct, setFxAmountPct] = useState<25 | 50 | 100>(25);
  const [fxChannelId, setFxChannelId] = useState<TransferChannelDef['id']>('exchange_office');
  const [showSellPropWizard, setShowSellPropWizard] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<InvestmentId | null>(null);
  const [housingDrill, setHousingDrill] = useState<'market' | 'showroom' | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [infoTopic, setInfoTopic] = useState<InfoTopic>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingAssetConfirm | null>(null);
  const [pendingAbroadHousing, setPendingAbroadHousing] = useState<
    ReturnType<typeof getAbroadHousingOptions>[number] | null
  >(null);

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
  const moneySummary = getHeaderMoneySummary(state, gameDataset);
  const residenceCountry = getCountryMacroDef(player.countryId, gameDataset);
  const iranPropToman =
    player.countryId === 'iran' &&
    (player.housing.type === 'owned' || player.housing.type === 'villa')
      ? player.housing.propertyValueToman
      : typeof state.flags['iran_owned_property_toman'] === 'number'
        ? (state.flags['iran_owned_property_toman'] as number)
        : 0;
  const abroadHousingOptions = useMemo(
    () =>
      player.countryId !== 'iran'
        ? getAbroadHousingOptions(
            player.countryId,
            state.emigration?.residency?.regionId,
            state,
            gameDataset,
          )
        : [],
    [player.countryId, state],
  );
  const fxSourceBalance = getWalletBalance(state, fxFrom);
  const fxInputAmount = useMemo(() => {
    const raw = (fxSourceBalance * fxAmountPct) / 100;
    return fxFrom === 'IRT' ? Math.round(raw) : Number(raw.toFixed(2));
  }, [fxSourceBalance, fxAmountPct, fxFrom]);
  const fxQuote = useMemo(
    () =>
      quoteConversion({
        amount: fxInputAmount,
        from: fxFrom,
        to: fxTo,
        state,
        dataset: gameDataset,
        channelId: fxMode === 'transfer' ? fxChannelId : undefined,
      }),
    [fxInputAmount, fxFrom, fxTo, state, fxMode, fxChannelId],
  );

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
        value={<MoneyText amount={price} currency="IRT" mode="inline" interactive={false} />}
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
        message: (
          <span>
            با فروش تمام موجودی این دارایی، مبلغ{' '}
            <MoneyText amount={pendingConfirm.amountToman} currency="IRT" mode="inline" /> به
            نقدینگی تو اضافه می‌شود.
          </span>
        ),
        destructive: false,
        confirmLabel: 'فروش کل',
      };
    }
    if (pendingConfirm.kind === 'housing') {
      return {
        title: `تأیید معامله: ${pendingConfirm.listing.titleFa}`,
        message:
          pendingConfirm.listing.mode === 'rent' ? (
            <span>
              مبلغ پیش‌پرداخت (ودیعه + اجاره ماه اول) برابر با{' '}
              <MoneyText amount={pendingConfirm.upfrontToman} currency="IRT" mode="inline" /> است و
              جایگزین مسکن فعلی می‌شود.
            </span>
          ) : (
            <span>
              قیمت قطعی معامله{' '}
              <MoneyText amount={pendingConfirm.upfrontToman} currency="IRT" mode="inline" /> است.
              با تسویه ملک قبلی انجام می‌شود.
            </span>
          ),
        destructive: false,
        confirmLabel: 'امضای قرارداد',
      };
    }
    if (pendingConfirm.kind === 'buy_vehicle') {
      return {
        title: `خرید ${pendingConfirm.vehicle.titleFa}`,
        message: (
          <span>
            مبلغ <MoneyText amount={pendingConfirm.priceToman} currency="IRT" mode="inline" /> از
            نقدینگی کسر می‌شود و هزینه نگهداری سالانه دارد.
          </span>
        ),
        destructive: false,
        confirmLabel: 'خرید خودرو',
      };
    }
    if (pendingConfirm.kind === 'sell_vehicle') {
      return {
        title: `فروش ${pendingConfirm.titleFa}`,
        message: (
          <span>
            خودرو به قیمت روز{' '}
            <MoneyText amount={pendingConfirm.priceToman} currency="IRT" mode="inline" /> فروخته
            می‌شود و قابل بازگشت نیست.
          </span>
        ),
        destructive: true,
        confirmLabel: 'فروش خودرو',
      };
    }
    if (pendingConfirm.kind === 'loan') {
      return {
        title: `دریافت ${pendingConfirm.labelFa}`,
        message: (
          <span>
            مبلغ{' '}
            <MoneyText amount={pendingConfirm.principalToman} currency="IRT" mode="inline" /> واریز
            می‌شود و اقساط آن به‌صورت خودکار سالانه کسر خواهد شد.
          </span>
        ),
        destructive: false,
        confirmLabel: 'دریافت وام',
      };
    }
    return {
      title: `تأیید خرید: ${pendingConfirm.item.titleFa}`,
      message: (
        <span>
          مبلغ <MoneyText amount={pendingConfirm.priceToman} currency="IRT" mode="inline" /> بابت
          این کالا پرداخت می‌شود. {pendingConfirm.item.effectHintFa}.
        </span>
      ),
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

  const infoContent: Record<Exclude<InfoTopic, null>, { title: string; bullets: ReactNode[] }> = {
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
        <span key="min-wage">
          حداقل مزد ماهانه فعلی در مدل اقتصاد:{' '}
          <MoneyText amount={minWageMonthly} currency="IRT" mode="inline" />.
        </span>,
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
      subtitle={
        <span className="inline-flex items-center gap-1">
          <span>نقدینگی:</span>
          <MoneyText amount={player.moneyToman} currency="IRT" mode="inline" interactive={false} />
        </span>
      }
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
              title={<MoneyText amount={netWorth} currency="IRT" mode="stacked" />}
              subtitle={`${netWorthPP.labelFa} · ${moneySummary.netWorth.purchasingPowerHintFa}`}
              onInfo={() => setInfoTopic('netWorth')}
              detailsLabel="تحلیل بازار"
              onDetails={() => setShowMarketDetail(true)}
              metrics={[
                {
                  label: t('cashLabel'),
                  value: (
                    <MoneyText
                      amount={player.moneyToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
                {
                  label: 'خالص درآمد سالانه',
                  value: (
                    <MoneyText
                      amount={annualIncome}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
                {
                  label: 'کل بدهی و وام',
                  value: (
                    <MoneyText
                      amount={totalDebtAll}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
              ]}
            />

            <CurrencyExposureCard
              displayMode={state.displayCurrencyMode ?? 'local'}
              onChangeDisplayMode={(mode: DisplayCurrencyMode) =>
                onUpdateSave({
                  save: setDisplayCurrencyModeAction(saveGame, mode),
                  success: true,
                  message: `نمایش مبالغ روی «${t(`currencySwitch.${mode}`)}» تنظیم شد`,
                })
              }
              slices={moneySummary.exposure}
              performance={moneySummary.performance}
              warnings={moneySummary.warnings}
              onOpenFxDrawer={() => setShowFxDrawer(true)}
            />

            <SectionGroup
              title="روند دارایی و شاخص بازار"
              subtitle={`تورم سال ${toPersianDigits(state.currentJalaliYear)}: ${toPersianDigits(inflationPct)}٪`}
            >
              <div className="p-3 space-y-2.5">
                <Sparkline values={netWorthSeries} colorVar="--primary" height={40} />
                <ExchangeRateStrip state={state} compact />
              </div>
              <ActionRow
                icon={<IconCoins className="h-4 w-4" />}
                title="کیف‌پول‌های ارزی، تبدیل و انتقال"
                subtitle={`${toPersianDigits(state.ledger?.wallets.length ?? 1)} حساب فعال در سبد ارزی`}
                showChevron
                onClick={() => setShowFxDrawer(true)}
              />
              <ActionRow
                icon={<IconTrendUp className="h-4 w-4" />}
                title={`نرخ‌های بازار (${toPersianDigits(state.currentJalaliYear)})`}
                subtitle={
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <span>دلار:</span>
                    <MoneyText
                      amount={usdRate}
                      currency="IRT"
                      mode="single"
                      compact
                      interactive={false}
                    />
                    <span>· طلای ۱۸:</span>
                    <MoneyText
                      amount={goldRate}
                      currency="IRT"
                      mode="single"
                      compact
                      interactive={false}
                    />
                  </span>
                }
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
                  totalPortfolioVal > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <span>ارزش سبد:</span>
                      <MoneyText
                        amount={totalPortfolioVal}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    </span>
                  ) : (
                    'ارز، طلا، بورس و سپرده بانکی'
                  )
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
                    {
                      label: 'ارزش کل سبد',
                      value: (
                        <MoneyText
                          amount={totalPortfolioVal}
                          currency="IRT"
                          mode="inline"
                          interactive={false}
                        />
                      ),
                    },
                    {
                      label: 'سود یا زیان',
                      value: (
                        <MoneyText
                          amount={totalPortfolioPnl}
                          currency="IRT"
                          mode="inline"
                          showSign
                          interactive={false}
                        />
                      ),
                      tone: totalPortfolioPnl >= 0 ? 'success' : 'danger',
                    },
                    {
                      label: 'نقدینگی آزاد',
                      value: (
                        <MoneyText
                          amount={player.moneyToman}
                          currency="IRT"
                          mode="inline"
                          interactive={false}
                        />
                      ),
                    },
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
                        value={
                          heldVal > 0 ? (
                            <MoneyText
                              amount={heldVal}
                              currency="IRT"
                              mode="inline"
                              interactive={false}
                            />
                          ) : (
                            'بدون موجودی'
                          )
                        }
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
                player.housing.propertyValueToman > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span>ارزش روز ملک:</span>
                    <MoneyText
                      amount={player.housing.propertyValueToman}
                      currency="IRT"
                      mode="inline"
                    />
                  </span>
                ) : player.housing.monthlyRentToman > 0 ? (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <span>ودیعه:</span>
                    <MoneyText
                      amount={player.housing.depositRahnToman}
                      currency="IRT"
                      mode="single"
                      compact
                    />
                    <span>· اجاره:</span>
                    <MoneyText
                      amount={player.housing.monthlyRentToman}
                      currency="IRT"
                      mode="single"
                      compact
                    />
                  </span>
                ) : (
                  'اقامت خانوادگی بدون هزینه اجاره'
                )
              }
              onInfo={() => setInfoTopic('housing')}
              metrics={[
                {
                  label: 'دارایی یا رهن ملک',
                  value: (
                    <MoneyText
                      amount={player.housing.propertyValueToman || player.housing.depositRahnToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
                { label: 'تعداد خودرو', value: `${toPersianDigits(ownedCars.length)} دستگاه` },
                {
                  label: 'نقدینگی',
                  value: (
                    <MoneyText
                      amount={player.moneyToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
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
                        value={
                          <MoneyText
                            amount={car.currentValueToman}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                        }
                        showChevron
                        onClick={() => setSelectedCarId(car.id)}
                      />
                    ))}
                  </SectionGroup>
                )}

                <SectionGroup title="معاملات مسکن و خودرو">
                  {player.countryId !== 'iran' && abroadHousingOptions.length > 0 ? (
                    abroadHousingOptions.slice(0, 4).map((opt) => (
                      <ActionRow
                        key={opt.id}
                        icon={<IconHome className="h-4 w-4" />}
                        title={opt.titleFa}
                        subtitle={
                          opt.mode === 'rent' ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>ودیعه</span>
                              <MoneyText
                                amount={opt.depositLocal}
                                currency={opt.currencyCode}
                                mode="inline"
                                interactive={false}
                              />
                              <span>· ماهانه</span>
                              <MoneyText
                                amount={opt.monthlyRentLocal}
                                currency={opt.currencyCode}
                                mode="inline"
                                interactive={false}
                              />
                            </span>
                          ) : (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <span>پیش‌پرداخت</span>
                              <MoneyText
                                amount={opt.downPaymentLocal}
                                currency={opt.currencyCode}
                                mode="inline"
                                interactive={false}
                              />
                              <span>· {toPersianDigits(opt.areaSqm)} متر</span>
                            </span>
                          )
                        }
                        value={
                          <MoneyText
                            amount={
                              opt.mode === 'rent' ? opt.depositLocal : opt.downPaymentLocal
                            }
                            currency={opt.currencyCode}
                            mode="stacked"
                            interactive={false}
                          />
                        }
                        ctaLabel={opt.mode === 'rent' ? 'اجاره' : 'خرید'}
                        onClick={() => setPendingAbroadHousing(opt)}
                      />
                    ))
                  ) : (
                    <ActionRow
                      icon={<IconHome className="h-4 w-4" />}
                      title="فهرست مسکن (خرید و اجاره)"
                      subtitle={
                        <span className="inline-flex items-center gap-1">
                          <span>متری تهران:</span>
                          <MoneyText
                            amount={tehranSqm}
                            currency="IRT"
                            mode="single"
                            compact
                            interactive={false}
                          />
                          <span>· {toPersianDigits(gameDataset.housing.housingListings.length)} فایل</span>
                        </span>
                      }
                      showChevron
                      onClick={() => setHousingDrill('market')}
                    />
                  )}
                  {iranPropToman > 0 && (
                    <ActionRow
                      icon={<IconBank className="h-4 w-4" />}
                      title="فروش ملک ایران و انتقال ارز"
                      subtitle={
                        <span className="inline-flex items-center gap-1">
                          <span>ارزش فعلی:</span>
                          <MoneyText
                            amount={iranPropToman}
                            currency="IRT"
                            mode="inline"
                            interactive={false}
                          />
                        </span>
                      }
                      ctaLabel="فروش و تبدیل"
                      onClick={() => setShowSellPropWizard(true)}
                    />
                  )}
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
                  value: (
                    <MoneyText
                      amount={player.debtToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                  tone: player.debtToman > 0 ? 'danger' : 'default',
                },
                {
                  label: 'مانده وام‌ها',
                  value: (
                    <MoneyText
                      amount={totalLoanDebt}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  ),
                },
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
                    value={
                      <MoneyText
                        amount={player.debtToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    }
                  />
                )}
                {state.loans.slice(0, 5).map((loan) => (
                  <ActionRow
                    key={loan.id}
                    icon={<IconBank className="h-4 w-4" />}
                    title={loan.name}
                    subtitle={
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span>قسط سالانه:</span>
                        <MoneyText
                          amount={loan.annualPaymentToman}
                          currency="IRT"
                          mode="single"
                          compact
                          interactive={false}
                        />
                        <span>· {toPersianDigits(loan.yearsRemaining)} سال باقی‌مانده</span>
                      </span>
                    }
                    value={
                      <MoneyText
                        amount={loan.principalRemainingToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    }
                  />
                ))}
                <ActionRow
                  icon={<IconCoins className="h-4 w-4" />}
                  title="پرداخت بخشی از بدهی یا وام"
                  subtitle="کاهش سریع بدهی و بهبود رتبه اعتباری"
                  value={
                    <MoneyText
                      amount={Math.min(player.moneyToman, debtPayoffChunk)}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
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
                  value={
                    <span className="inline-flex items-center gap-1">
                      <span>سقف</span>
                      <MoneyText
                        amount={loanPresets.personal.principalToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    </span>
                  }
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
                  value={
                    <span className="inline-flex items-center gap-1">
                      <span>سقف</span>
                      <MoneyText
                        amount={loanPresets.housing.principalToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    </span>
                  }
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
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1">
              <span>حداقل مزد ماهانه:</span>
              <MoneyText amount={minWageMonthly} currency="IRT" mode="inline" />
              <span>· معادل</span>
              <MoneyText
                amount={netWorth}
                currency="IRT"
                mode="single"
                primaryOverride="USD"
              />
            </span>
          }
          metrics={[
            {
              label: 'خالص درآمد سالانه',
              value: (
                <MoneyText amount={annualIncome} currency="IRT" mode="inline" interactive={false} />
              ),
              tone: 'success',
            },
            {
              label: 'هزینه سالانه',
              value: (
                <MoneyText
                  amount={annualExpenses}
                  currency="IRT"
                  mode="inline"
                  interactive={false}
                />
              ),
              tone: 'danger',
            },
            {
              label: 'آپارتمان ۷۰ متری',
              value: (
                <MoneyText
                  amount={tehran70SqmPrice}
                  currency="IRT"
                  mode="inline"
                  interactive={false}
                />
              ),
            },
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
            value={<MoneyText amount={usdRate} currency="IRT" mode="inline" interactive={false} />}
          />
          <ActionRow
            icon={<IconCoins className="h-4 w-4" />}
            title="طلای ۱۸ عیار (گرم)"
            subtitle="نوسان همگام با سکه و ارز"
            value={<MoneyText amount={goldRate} currency="IRT" mode="inline" interactive={false} />}
          />
          <ActionRow
            icon={<IconSparkles className="h-4 w-4" />}
            title="سکه امامی"
            subtitle="شاخص رایج پس‌انداز بلندمدت"
            value={<MoneyText amount={coinRate} currency="IRT" mode="inline" interactive={false} />}
          />
          <ActionRow
            icon={<IconHome className="h-4 w-4" />}
            title="متری آگهی مسکن تهران"
            subtitle={
              <span className="inline-flex items-center gap-1">
                <span>واحد ۷۰ متری معامله:</span>
                <MoneyText
                  amount={tehran70SqmPrice}
                  currency="IRT"
                  mode="single"
                  compact
                  interactive={false}
                />
              </span>
            }
            value={
              <MoneyText amount={tehranSqm} currency="IRT" mode="inline" interactive={false} />
            }
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
                title={<MoneyText amount={heldVal} currency="IRT" mode="stacked" />}
                subtitle={selectedInvestment.hint}
                status={heldVal > 0 ? 'in_progress' : 'waiting'}
                metrics={[
                  {
                    label: 'سود یا زیان',
                    value: (
                      <MoneyText
                        amount={pnl}
                        currency="IRT"
                        mode="inline"
                        showSign
                        interactive={false}
                      />
                    ),
                    tone: pnl > 0 ? 'success' : pnl < 0 ? 'danger' : 'default',
                  },
                  {
                    label: 'حجم خرید سریع',
                    value: (
                      <MoneyText
                        amount={quickTradeAmount}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                  {
                    label: 'نقدینگی آزاد',
                    value: (
                      <MoneyText
                        amount={player.moneyToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                ]}
              />

              <SectionGroup title="معامله سریع">
                <ActionRow
                  icon={<IconCoins className="h-4 w-4" />}
                  title="خرید سریع"
                  subtitle="افزودن به دارایی با نرخ روز"
                  value={
                    <MoneyText
                      amount={quickTradeAmount}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
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
                  value={
                    <MoneyText
                      amount={heldVal}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
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
                  listing.mode === 'rent' && rentalTerms ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>ودیعه</span>
                      <MoneyText
                        amount={rentalTerms.deposit}
                        currency="IRT"
                        mode="single"
                        compact
                        interactive={false}
                      />
                      <span>+ اجاره</span>
                      <MoneyText
                        amount={rentalTerms.monthlyRent}
                        currency="IRT"
                        mode="single"
                        compact
                        interactive={false}
                      />
                    </span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>متراژ {toPersianDigits(listing.areaSqm)} متر · قیمت آگهی:</span>
                      <MoneyText
                        amount={quote.listingPriceToman}
                        currency="IRT"
                        mode="single"
                        compact
                        interactive={false}
                      />
                    </span>
                  )
                }
                value={
                  <MoneyText amount={upfront} currency="IRT" mode="inline" interactive={false} />
                }
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
        subtitle={
          <span className="inline-flex items-center gap-1">
            <span>نقدینگی:</span>
            <MoneyText amount={player.moneyToman} currency="IRT" mode="inline" interactive={false} />
          </span>
        }
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
                value={<MoneyText amount={price} currency="IRT" mode="inline" interactive={false} />}
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
                subtitle={
                  <span className="inline-flex items-center gap-1">
                    <span>ارزش روز:</span>
                    <MoneyText
                      amount={selectedCar.currentValueToman}
                      currency="IRT"
                      mode="inline"
                    />
                  </span>
                }
                metrics={[
                  {
                    label: 'ارزش روز',
                    value: (
                      <MoneyText
                        amount={selectedCar.currentValueToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                  {
                    label: 'هزینه سرویس',
                    value: (
                      <MoneyText
                        amount={repairCost}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                  {
                    label: 'نقدینگی',
                    value: (
                      <MoneyText
                        amount={player.moneyToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    ),
                  },
                ]}
              />

              <SectionGroup title="نگهداری">
                <ActionRow
                  icon={<IconCar className="h-4 w-4" />}
                  title="سرویس دوره‌ای"
                  subtitle="حفظ سلامت فنی و ارزش فروش خودرو"
                  value={
                    <MoneyText
                      amount={repairCost}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
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
                  value={
                    <MoneyText
                      amount={selectedCar.currentValueToman}
                      currency="IRT"
                      mode="inline"
                      interactive={false}
                    />
                  }
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

      {/* DRILL-DOWN: Multi-Currency Wallets, FX Converter & Cross-Border Transfer */}
      <DetailSheet
        open={showFxDrawer}
        onClose={() => setShowFxDrawer(false)}
        title="کیف‌پول ارزی، تبدیل و حواله"
        subtitle={residenceCountry ? `اقامتگاه فعلی: ${residenceCountry.nameFa}` : 'مدیریت ارزهای سبد'}
      >
        <div className="space-y-4">
          <ExchangeRateStrip state={state} highlightCurrency={fxTo} compact />

          <SectionGroup title="موجودی کیف‌پول‌ها">
            {(state.ledger?.wallets ?? []).slice(0, 7).map((w) => {
              const def = getCurrencyDef(w.currencyCode, gameDataset);
              return (
                <ActionRow
                  key={w.id}
                  icon={<IconCoins className="h-4 w-4" />}
                  title={w.labelFa}
                  subtitle={def.nameFa}
                  value={
                    <MoneyText
                      amount={w.balance}
                      currency={w.currencyCode}
                      mode="stacked"
                      interactive={false}
                    />
                  }
                />
              );
            })}
          </SectionGroup>

          <Card className="space-y-3">
            <SegmentedControl<'convert' | 'transfer'>
              value={fxMode}
              onChange={setFxMode}
              items={[
                { value: 'convert', label: 'تبدیل در کیف‌پول' },
                { value: 'transfer', label: 'حواله برون‌مرزی' },
              ]}
            />

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[var(--text-muted)]">از ارز مبدأ</div>
              <FilterChips<CurrencyCode>
                value={fxFrom}
                onChange={(code) => {
                  setFxFrom(code);
                  if (code === fxTo) {
                    setFxTo(code === 'IRT' ? 'USD' : 'IRT');
                  }
                }}
                items={ALL_CURRENCY_CODES.map((code) => ({
                  value: code,
                  label: getCurrencyDef(code, gameDataset).shortNameFa,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[var(--text-muted)]">به ارز مقصد</div>
              <FilterChips<CurrencyCode>
                value={fxTo}
                onChange={setFxTo}
                items={ALL_CURRENCY_CODES.filter((c) => c !== fxFrom).map((code) => ({
                  value: code,
                  label: getCurrencyDef(code, gameDataset).shortNameFa,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
                <span>سهم انتخابی از موجودی (</span>
                <MoneyText amount={fxInputAmount} currency={fxFrom} mode="inline" />
                <span>)</span>
              </div>
              <SegmentedControl<'25' | '50' | '100'>
                value={String(fxAmountPct) as '25' | '50' | '100'}
                onChange={(v) => setFxAmountPct(Number(v) as 25 | 50 | 100)}
                items={[
                  { value: '25', label: '۲۵٪ موجودی' },
                  { value: '50', label: '۵۰٪ موجودی' },
                  { value: '100', label: 'کل موجودی' },
                ]}
              />
            </div>

            {fxMode === 'transfer' && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[var(--text-muted)]">کانال انتقال</div>
                <FilterChips<TransferChannelDef['id']>
                  value={fxChannelId}
                  onChange={setFxChannelId}
                  items={gameDataset.economy.fxParams.transferChannels.map((ch) => ({
                    value: ch.id,
                    label: ch.titleFa,
                  }))}
                />
              </div>
            )}

            <div className="rounded-xl bg-[var(--surface-2)] p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">خالص دریافتی مقصد:</span>
                <span className="font-bold tabular-nums text-[var(--success)]">
                  <MoneyText amount={fxQuote.netToAmount} currency={fxTo} mode="inline" />
                </span>
              </div>
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>کارمزد و شکاف نرخ تبدیل:</span>
                <span className="tabular-nums">{toPersianDigits(fxQuote.totalFrictionPct)}٪</span>
              </div>
            </div>

            <button
              type="button"
              disabled={fxInputAmount <= 0 || fxFrom === fxTo}
              onClick={() => {
                if (fxMode === 'convert') {
                  onUpdateSave(
                    convertCurrencyAction(
                      saveGame,
                      {
                        fromCurrency: fxFrom,
                        toCurrency: fxTo,
                        fromAmount: fxInputAmount,
                      },
                      gameDataset,
                    ),
                  );
                } else {
                  onUpdateSave(
                    submitCrossBorderTransferAction(
                      saveGame,
                      {
                        fromCurrency: fxFrom,
                        toCurrency: fxTo,
                        fromAmount: fxInputAmount,
                        channelId: fxChannelId,
                        purposeFa: 'انتقال موجودی بین حساب‌ها',
                      },
                      gameDataset,
                    ),
                  );
                }
              }}
              className="min-h-[46px] w-full rounded-xl bg-[var(--primary)] text-xs font-bold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-strong)] disabled:opacity-50"
            >
              {fxMode === 'convert' ? 'انجام تبدیل ارزی' : 'ارسال حواله ارزی'}
            </button>
          </Card>
        </div>
      </DetailSheet>

      <ForeignPaymentSheet
        open={pendingAbroadHousing !== null}
        onClose={() => setPendingAbroadHousing(null)}
        title={pendingAbroadHousing ? pendingAbroadHousing.titleFa : 'پرداخت مسکن'}
        subtitle={
          pendingAbroadHousing
            ? pendingAbroadHousing.mode === 'rent'
              ? 'پرداخت ودیعه قرارداد اجاره در خارج'
              : 'پرداخت پیش‌پرداخت خرید ملک در خارج'
            : undefined
        }
        amount={
          pendingAbroadHousing
            ? pendingAbroadHousing.mode === 'rent'
              ? pendingAbroadHousing.depositLocal
              : pendingAbroadHousing.downPaymentLocal
            : 0
        }
        currency={pendingAbroadHousing?.currencyCode ?? 'EUR'}
        state={state}
        confirmLabel={pendingAbroadHousing?.mode === 'rent' ? 'امضای اجاره‌نامه' : 'پرداخت و خرید'}
        onConfirm={(payload) => {
          if (!pendingAbroadHousing) return;
          const res = rentOrBuyAbroadHousingAction(
            saveGame,
            pendingAbroadHousing.id,
            state.emigration?.residency?.regionId,
            gameDataset,
            { payFromCurrency: payload.payFromCurrency },
          );
          onUpdateSave(res);
          if (res.success) setPendingAbroadHousing(null);
        }}
      />

      <SellIranPropertyWizard
        open={showSellPropWizard}
        saveGame={saveGame}
        onClose={() => setShowSellPropWizard(false)}
        onUpdateSave={onUpdateSave}
      />

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
