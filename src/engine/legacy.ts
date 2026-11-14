import type { GameDataset } from '../data/registry';
import {
  calculateNetWorthToman,
  getMinWageMonthlyForState,
  getPurchasingPowerSummary,
} from './economy';
import { toPersianDigits } from './jalali';
import { SeededRNG } from './rng';
import { CURRENT_SCHEMA_VERSION } from './schemas';
import { clampStat } from './stats';
import type {
  DynastyHallOfFameEntry,
  DynastyState,
  DynastyWealthPoint,
  EstateSettlementResult,
  EstateShareLine,
  GameState,
  Gender,
  HeirCandidate,
  HiddenTalents,
  LifeChapterSummary,
  OwnedBusinessState,
  Person,
  Relationship,
  SaveGame,
  SharedAssetDecision,
  TalentId,
  WillBeneficiary,
  WillConfig,
} from './types';

export interface WillValidationResult {
  totalRequestedPercent: number;
  maxAllowedPercent: number;
  exceedsOneThird: boolean;
  effectiveCharityRatio: number;
  effectiveBeneficiaries: {
    beneficiary: WillBeneficiary;
    effectiveRatio: number;
  }[];
}

export function isWillUnlocked(state: GameState, dataset: GameDataset): boolean {
  if (!state.isAlive) return false;
  const { minWillAge, seriousIllnessHealthThreshold } = dataset.inheritance.rules;
  return (
    state.player.age >= minWillAge ||
    state.player.stats.health <= seriousIllnessHealthThreshold
  );
}

export function getWillUnlockReasonFa(state: GameState, dataset: GameDataset): string {
  const { minWillAge, seriousIllnessHealthThreshold } = dataset.inheritance.rules;
  if (isWillUnlocked(state, dataset)) {
    return state.player.age >= minWillAge
      ? `از ${toPersianDigits(minWillAge)} سالگی تنظیم وصیت‌نامه فعال است.`
      : 'به دلیل وضعیت جسمی، امکان ثبت وصیت‌نامه پیش از موعد فعال شده است.';
  }
  return `تنظیم وصیت‌نامه از ${toPersianDigits(minWillAge)} سالگی یا هنگام بیماری شدید (سلامت زیر ${toPersianDigits(seriousIllnessHealthThreshold)}٪) فعال می‌شود.`;
}

export function normalizeAndValidateWill(
  will: WillConfig | null | undefined,
  dataset: GameDataset,
): WillValidationResult {
  const maxRatio = dataset.inheritance.rules.maxWillShareRatio;
  const maxAllowedPercent = Number((maxRatio * 100).toFixed(1));

  if (!will) {
    return {
      totalRequestedPercent: 0,
      maxAllowedPercent,
      exceedsOneThird: false,
      effectiveCharityRatio: 0,
      effectiveBeneficiaries: [],
    };
  }

  const charityPct = Math.max(0, Math.min(100, will.charityPercent));
  const cleanedBeneficiaries = will.beneficiaries.map((b) => ({
    ...b,
    sharePercent: Math.max(0, Math.min(100, b.sharePercent)),
  }));
  const benSum = cleanedBeneficiaries.reduce((s, b) => s + b.sharePercent, 0);
  const totalRequestedPercent = charityPct + benSum;
  const exceedsOneThird = totalRequestedPercent > maxAllowedPercent + 0.05;

  if (totalRequestedPercent <= 0) {
    return {
      totalRequestedPercent: 0,
      maxAllowedPercent,
      exceedsOneThird: false,
      effectiveCharityRatio: 0,
      effectiveBeneficiaries: cleanedBeneficiaries.map((b) => ({
        beneficiary: b,
        effectiveRatio: 0,
      })),
    };
  }

  // Under Iranian Civil Code Art. 843, unilateral testamentary disposition cannot exceed 1/3 of net estate.
  const targetRatio = Math.min(maxRatio, totalRequestedPercent / 100);
  const scale = targetRatio / (totalRequestedPercent / 100);

  return {
    totalRequestedPercent,
    maxAllowedPercent,
    exceedsOneThird,
    effectiveCharityRatio: (charityPct / 100) * scale,
    effectiveBeneficiaries: cleanedBeneficiaries.map((b) => ({
      beneficiary: b,
      effectiveRatio: (b.sharePercent / 100) * scale,
    })),
  };
}

export function ensureDynastyState(state: GameState, fallbackSeed: string): DynastyState {
  if (state.dynasty) {
    return {
      ...state.dynasty,
      unlockedDynastyRibbons: [...state.dynasty.unlockedDynastyRibbons],
      chapters: state.dynasty.chapters.map((c) => ({ ...c })),
      wealthTimeline: state.dynasty.wealthTimeline.map((w) => ({ ...w })),
      hallOfFame: state.dynasty.hallOfFame.map((h) => ({ ...h })),
      ancestorMemoriesFa: [...state.dynasty.ancestorMemoriesFa],
    };
  }
  const worldSeed = state.worldSeed ?? fallbackSeed;
  return {
    dynastyNameFa: `خاندان ${state.player.lastName}`,
    founderNameFa: `${state.player.firstName} ${state.player.lastName}`,
    worldSeed,
    currentGeneration: 1,
    totalGenerationsLived: 0,
    familyReputation: 50,
    dynastyScore: 0,
    unlockedDynastyRibbons: [],
    chapters: [],
    wealthTimeline: [],
    hallOfFame: [],
    charityEndowmentTotalToman: 0,
    ancestorMemoriesFa: [],
  };
}

function getLivingRelativesByRole(
  state: GameState,
  roles: Relationship['role'][],
): { rel: Relationship; person: Person }[] {
  const result: { rel: Relationship; person: Person }[] = [];
  for (const rel of state.relationships) {
    if (!roles.includes(rel.role)) continue;
    const person = state.npcs[rel.personId];
    if (person && person.isAlive) {
      result.push({ rel, person });
    }
  }
  return result;
}

function getBusinessEquityValueToman(biz: OwnedBusinessState | null): number {
  if (!biz) return 0;
  return Math.max(
    0,
    Math.round(
      (biz.depositLockedToman + biz.equipmentValueToman + Math.max(0, biz.cashReserveToman)) *
        biz.ownershipShare,
    ),
  );
}

function reconcileIntegerShares(
  totalAmount: number,
  weights: { id: string; weight: number }[],
): Record<string, number> {
  const safeTotal = Math.max(0, Math.round(totalAmount));
  const out: Record<string, number> = {};
  if (weights.length === 0 || safeTotal === 0) {
    for (const w of weights) out[w.id] = 0;
    return out;
  }

  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w.weight), 0);
  if (totalWeight <= 0) {
    for (const w of weights) out[w.id] = 0;
    return out;
  }

  let allocated = 0;
  const remainders: { id: string; rem: number; weight: number }[] = [];
  for (const w of weights) {
    const exact = (safeTotal * Math.max(0, w.weight)) / totalWeight;
    const floorVal = Math.floor(exact);
    out[w.id] = floorVal;
    allocated += floorVal;
    remainders.push({ id: w.id, rem: exact - floorVal, weight: w.weight });
  }

  let leftover = safeTotal - allocated;
  remainders.sort((a, b) => b.rem - a.rem || b.weight - a.weight);
  let idx = 0;
  while (leftover > 0 && remainders.length > 0) {
    const target = remainders[idx % remainders.length];
    out[target.id] = (out[target.id] ?? 0) + 1;
    leftover -= 1;
    idx += 1;
  }

  return out;
}

export interface SettleEstateParams {
  state: GameState;
  chosenHeirId?: string;
  dataset: GameDataset;
  rng?: SeededRNG;
  homeDecision?: SharedAssetDecision;
  businessDecision?: SharedAssetDecision;
  extraCharityOverride?: boolean;
}

export function settleEstate(params: SettleEstateParams): EstateSettlementResult {
  const {
    state,
    chosenHeirId,
    dataset,
    rng,
    homeDecision = 'sell_and_split',
    businessDecision = 'sell_and_split',
    extraCharityOverride = false,
  } = params;

  const rules = dataset.inheritance.rules;
  const minWage = getMinWageMonthlyForState(state, dataset);

  let cashToman = Math.max(0, Math.round(state.player.moneyToman));
  const financialAssetsToman = Math.max(
    0,
    Math.round(state.assets.reduce((sum, a) => sum + Math.max(0, a.currentValueToman), 0)),
  );
  let housingValueToman = Math.max(
    0,
    Math.round(state.player.housing.propertyValueToman + state.player.housing.depositRahnToman),
  );
  let businessValueToman = getBusinessEquityValueToman(state.ownedBusiness);
  let debtsAndLoansTotalToman = Math.max(
    0,
    Math.round(
      state.player.debtToman +
        state.loans.reduce((sum, l) => sum + Math.max(0, l.principalRemainingToman), 0),
    ),
  );

  const eventsTriggeredFa: string[] = [];

  // Optional inheritance events when settling live estate (adjust pre-division estate strictly so math conserves)
  if (rng && !extraCharityOverride) {
    const grossBeforeEvents = cashToman + financialAssetsToman + housingValueToman + businessValueToman;
    if (grossBeforeEvents > minWage * 6 && rng.chance(0.18)) {
      const bonus = Math.round(minWage * rng.float(1.5, 4.5));
      cashToman += bonus;
      eventsTriggeredFa.push(`یافتن پس‌انداز و یادگار قدیمی در صندوقچه خانه (+${toPersianDigits(bonus.toLocaleString('en-US'))} تومان)`);
    } else if (debtsAndLoansTotalToman > 0 && rng.chance(0.14)) {
      const claim = Math.round(minWage * rng.float(1.0, 3.0));
      debtsAndLoansTotalToman += claim;
      eventsTriggeredFa.push('ارائه یک سفته و طلب تاییدشده از سوی طلبکار قدیمی در زمان حصر وراثت');
    } else if (housingValueToman > 0 && rng.chance(0.16)) {
      const deltaPct = rng.float(-0.04, 0.06);
      housingValueToman = Math.max(0, Math.round(housingValueToman * (1 + deltaPct)));
      eventsTriggeredFa.push(
        deltaPct >= 0
          ? 'کارشناسی رسمی ملک کمی بالاتر از برآورد اولیه ثبت شد.'
          : 'کارشناسی رسمی ملک با لحاظ هزینه تعمیرات کمی تعدیل شد.',
      );
    }
  }

  const grossAssetsToman =
    cashToman + financialAssetsToman + housingValueToman + businessValueToman;

  // Step 1: Shrouding, funeral & burial (Art. 868-869)
  const rawFuneral = Math.round(minWage * rules.funeralCostMinWageMultiple.value);
  const funeralCostToman = Math.min(grossAssetsToman, Math.max(0, rawFuneral));
  const afterFuneral = grossAssetsToman - funeralCostToman;

  // Step 2: Deceased debts & loans (Art. 869 — heirs have no personal liability beyond estate)
  const debtsPaidToman = Math.min(afterFuneral, debtsAndLoansTotalToman);
  const forgivenDebtToman = Math.max(0, debtsAndLoansTotalToman - debtsPaidToman);
  const afterDebts = afterFuneral - debtsPaidToman;

  // Step 3: Probate & appraisal fees
  const settlementFeeToman =
    afterDebts > 0
      ? Math.min(afterDebts, Math.round(afterDebts * rules.probateAndAppraisalFeeRate.value))
      : 0;
  const netDistributableToman = Math.max(0, afterDebts - settlementFeeToman);

  // Step 4: Will & Contestation evaluation (Art. 837 & 843 — 1/3 limit)
  const livingSpouse = getLivingRelativesByRole(state, ['spouse'])[0] ?? null;
  const livingChildren = getLivingRelativesByRole(state, ['child']);
  const livingGrandchildren = getLivingRelativesByRole(state, ['grandchild']);
  const livingParents = getLivingRelativesByRole(state, ['father', 'mother']);
  const livingSiblings = getLivingRelativesByRole(state, ['sibling']);
  const livingNiecesNephews = getLivingRelativesByRole(state, ['niece_nephew']);

  const hasDescendants = livingChildren.length > 0 || livingGrandchildren.length > 0;

  const willValidation = normalizeAndValidateWill(state.will, dataset);
  const hasLowClosenessHeir = [...livingChildren, ...(livingSpouse ? [livingSpouse] : [])].some(
    (item) => item.rel.closeness < rules.contestation.lowClosenessThreshold,
  );

  let contested = false;
  let contestOutcomeFa: string | undefined;
  if (
    rng &&
    state.will &&
    netDistributableToman > 0 &&
    (willValidation.exceedsOneThird || hasLowClosenessHeir)
  ) {
    const chance =
      rules.contestation.baseChance +
      (willValidation.exceedsOneThird ? rules.contestation.excessWillBonus : 0) +
      (hasLowClosenessHeir ? rules.contestation.lowClosenessBonus : 0);
    if (rng.chance(Math.min(0.85, chance))) {
      contested = true;
      if (willValidation.exceedsOneThird) {
        contestOutcomeFa =
          'اعتراض به وصیت مازاد بر یک‌سوم مطرح و طبق ماده ۸۴۳ قانون مدنی، وصیت به سقف یک‌سوم محدود شد.';
      } else {
        contestOutcomeFa =
          'اختلاف جزئی میان بازماندگان بر سر ارزیابی ترکه با پادرمیانی و تقسیم قانونی حل‌وفصل شد.';
      }
      eventsTriggeredFa.push(contestOutcomeFa);
    }
  } else if (willValidation.exceedsOneThird && state.will) {
    contestOutcomeFa =
      'سهم وصیت از سقف قانونی یک‌سوم بیشتر بود و طبق ماده ۸۴۳ به یک‌سوم ماترک خالص تعدیل شد.';
  }

  // Charity / Endowment from whole estate if no-heir charity ending, else up to 1/3 from will
  if (extraCharityOverride) {
    const shareLine: EstateShareLine = {
      recipientId: 'charity_foundation',
      recipientNameFa: `بنیاد خیریه ${state.player.lastName}`,
      roleLabelFa: 'وقف و امور خیریه',
      shareRatio: netDistributableToman > 0 ? 1 : 0,
      cashToman: netDistributableToman,
      assetsToman: 0,
      totalToman: netDistributableToman,
      notesFa: 'تأسیس بنیاد نیکوکاری پس از تسویه دیون و هزینه‌ها',
    };
    return {
      grossAssetsToman,
      cashToman,
      financialAssetsToman,
      housingValueToman,
      businessValueToman,
      funeralCostToman,
      debtsAndLoansTotalToman,
      debtsPaidToman,
      forgivenDebtToman,
      settlementFeeToman,
      netDistributableToman,
      charityEndowmentToman: netDistributableToman,
      contested: false,
      eventsTriggeredFa,
      shares: netDistributableToman > 0 ? [shareLine] : [],
      chosenHeirCashToman: 0,
      chosenHeirReceivesHome: false,
      chosenHeirReceivesBusiness: false,
      chosenHeirBusinessShare: 0,
      buyoutCostToman: 0,
      sharedHomeAvailable: false,
      sharedBusinessAvailable: false,
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
    };
  }

  // Build exact ratio buckets that sum strictly to 1.0 of netDistributableToman
  const allocationWeights: {
    id: string;
    recipientNameFa: string;
    roleLabelFa: string;
    weight: number;
    isCharity?: boolean;
    notesFa?: string;
  }[] = [];

  const totalWillWeight = Math.min(
    rules.maxWillShareRatio,
    willValidation.effectiveCharityRatio +
      willValidation.effectiveBeneficiaries.reduce((s, b) => s + b.effectiveRatio, 0),
  );

  if (willValidation.effectiveCharityRatio > 0) {
    allocationWeights.push({
      id: 'will_charity',
      recipientNameFa: 'وقف و امور خیریه',
      roleLabelFa: 'وصیت خیریه',
      weight: willValidation.effectiveCharityRatio,
      isCharity: true,
    });
  }

  for (const item of willValidation.effectiveBeneficiaries) {
    if (item.effectiveRatio <= 0) continue;
    allocationWeights.push({
      id: item.beneficiary.personId ?? `will_${item.beneficiary.id}`,
      recipientNameFa: item.beneficiary.labelFa,
      roleLabelFa: 'وصیت (تا سقف ثلث)',
      weight: item.effectiveRatio,
      notesFa: 'سهم وصیتی',
    });
  }

  const legalResidualWeight = Math.max(0, 1 - totalWillWeight);

  // Compute legal heirs' weights on legalResidualWeight
  let spouseLegalWeight = 0;
  if (livingSpouse) {
    const spouseShareOfLegal =
      livingSpouse.person.gender === 'female'
        ? hasDescendants
          ? rules.spouseShares.wifeWithDescendants
          : rules.spouseShares.wifeNoDescendants
        : hasDescendants
          ? rules.spouseShares.husbandWithDescendants
          : rules.spouseShares.husbandNoDescendants;
    spouseLegalWeight = legalResidualWeight * spouseShareOfLegal;
    allocationWeights.push({
      id: livingSpouse.person.id,
      recipientNameFa: `${livingSpouse.person.firstName} ${livingSpouse.person.lastName}`,
      roleLabelFa: 'همسر',
      weight: spouseLegalWeight,
      notesFa: `سهم قانونی همسر (ماده ۹۱۳)`,
    });
  }

  const afterSpouseWeight = Math.max(0, legalResidualWeight - spouseLegalWeight);

  // Primary class heirs: children -> grandchildren -> parents/siblings/nieces -> chosen distant heir
  const primaryPool: {
    person: Person;
    roleLabelFa: string;
    weightUnits: number;
  }[] = [];

  const useEqualChildren =
    state.will?.divisionPreference === 'equal_if_consented' &&
    livingChildren.every((c) => c.rel.closeness >= 60);

  if (livingChildren.length > 0) {
    for (const c of livingChildren) {
      const units = useEqualChildren
        ? 1
        : c.person.gender === 'male'
          ? rules.sonToDaughterRatio
          : 1;
      primaryPool.push({
        person: c.person,
        roleLabelFa: c.person.gender === 'male' ? 'پسر' : 'دختر',
        weightUnits: units,
      });
    }
  } else if (livingGrandchildren.length > 0) {
    for (const g of livingGrandchildren) {
      const units = useEqualChildren
        ? 1
        : g.person.gender === 'male'
          ? rules.sonToDaughterRatio
          : 1;
      primaryPool.push({
        person: g.person,
        roleLabelFa: 'نوه',
        weightUnits: units,
      });
    }
  } else if (livingParents.length > 0 || livingSiblings.length > 0 || livingNiecesNephews.length > 0) {
    for (const p of livingParents) {
      primaryPool.push({
        person: p.person,
        roleLabelFa: p.rel.role === 'father' ? 'پدر' : 'مادر',
        weightUnits: p.person.gender === 'male' ? 2 : 1,
      });
    }
    for (const s of livingSiblings) {
      primaryPool.push({
        person: s.person,
        roleLabelFa: 'خواهر / برادر',
        weightUnits: s.person.gender === 'male' ? 2 : 1,
      });
    }
    if (livingParents.length === 0 && livingSiblings.length === 0) {
      for (const n of livingNiecesNephews) {
        primaryPool.push({
          person: n.person,
          roleLabelFa: 'خواهرزاده / برادرزاده',
          weightUnits: 1,
        });
      }
    }
  }

  if (primaryPool.length > 0) {
    const totalUnits = primaryPool.reduce((s, p) => s + p.weightUnits, 0);
    for (const entry of primaryPool) {
      allocationWeights.push({
        id: entry.person.id,
        recipientNameFa: `${entry.person.firstName} ${entry.person.lastName}`,
        roleLabelFa: entry.roleLabelFa,
        weight: afterSpouseWeight * (entry.weightUnits / totalUnits),
      });
    }
  } else if (chosenHeirId && state.npcs[chosenHeirId]) {
    const target = state.npcs[chosenHeirId];
    allocationWeights.push({
      id: target.id,
      recipientNameFa: `${target.firstName} ${target.lastName}`,
      roleLabelFa: 'وارث خویشاوند',
      weight: afterSpouseWeight,
    });
  } else if (afterSpouseWeight > 0) {
    // No living legal heirs other than possible spouse or public charity reserve
    if (livingSpouse) {
      const spEntry = allocationWeights.find((w) => w.id === livingSpouse.person.id);
      if (spEntry) spEntry.weight += afterSpouseWeight;
    } else {
      allocationWeights.push({
        id: 'will_charity',
        recipientNameFa: 'امور خیریه و وقف عمومی',
        roleLabelFa: 'بلاوارث (خیریه)',
        weight: afterSpouseWeight,
        isCharity: true,
      });
    }
  }

  // Merge duplicate IDs (e.g., an heir also named in the 1/3 will)
  const mergedBuckets = new Map<
    string,
    {
      id: string;
      recipientNameFa: string;
      roleLabelFa: string;
      weight: number;
      isCharity?: boolean;
      notesFa?: string;
    }
  >();
  for (const w of allocationWeights) {
    const existing = mergedBuckets.get(w.id);
    if (existing) {
      existing.weight += w.weight;
      if (w.notesFa && !existing.notesFa) existing.notesFa = w.notesFa;
    } else {
      mergedBuckets.set(w.id, { ...w });
    }
  }

  const bucketList = Array.from(mergedBuckets.values());
  const exactTomanMap = reconcileIntegerShares(
    netDistributableToman,
    bucketList.map((b) => ({ id: b.id, weight: b.weight })),
  );

  let charityEndowmentToman = 0;
  const shares: EstateShareLine[] = bucketList.map((b) => {
    const amount = exactTomanMap[b.id] ?? 0;
    if (b.isCharity) charityEndowmentToman += amount;
    return {
      recipientId: b.id,
      recipientNameFa: b.recipientNameFa,
      roleLabelFa: b.roleLabelFa,
      shareRatio: Number(b.weight.toFixed(4)),
      cashToman: amount,
      assetsToman: 0,
      totalToman: amount,
      notesFa: b.notesFa,
    };
  });

  // Resolve chosen heir's home & business decisions
  const heirShareLine = chosenHeirId ? shares.find((s) => s.recipientId === chosenHeirId) : undefined;
  const heirTotalEntitlement = heirShareLine?.totalToman ?? 0;
  const heirRatio = heirShareLine?.shareRatio ?? 0;

  const hasOwnedHome =
    (state.player.housing.type === 'owned' || state.player.housing.type === 'villa') &&
    state.player.housing.propertyValueToman > 0;
  const hasBusiness = Boolean(state.ownedBusiness && businessValueToman > 0);
  const coHeirCount = shares.filter((s) => !s.recipientId.startsWith('will_charity')).length;

  const sharedHomeAvailable = hasOwnedHome && coHeirCount > 1;
  const sharedBusinessAvailable = hasBusiness && coHeirCount > 1;

  let chosenHeirReceivesHome = false;
  let chosenHeirReceivesBusiness = false;
  let chosenHeirBusinessShare = 0;
  let buyoutCostToman = 0;

  // Net estate ratio scaling (housing/business might be reduced proportionally if debts consumed part of gross)
  const netToGrossRatio = grossAssetsToman > 0 ? netDistributableToman / grossAssetsToman : 0;
  const netHomeValue = hasOwnedHome
    ? Math.round(state.player.housing.propertyValueToman * netToGrossRatio)
    : 0;
  const netBusinessValue = hasBusiness ? Math.round(businessValueToman * netToGrossRatio) : 0;

  let heirCash = heirTotalEntitlement;

  if (hasOwnedHome && chosenHeirId) {
    if (!sharedHomeAvailable) {
      chosenHeirReceivesHome = true;
      heirCash = Math.max(0, heirCash - Math.min(heirCash, netHomeValue));
    } else if (homeDecision === 'keep_jointly') {
      chosenHeirReceivesHome = true;
      heirCash = Math.max(0, heirCash - Math.min(heirCash, Math.round(netHomeValue * heirRatio)));
    } else if (homeDecision === 'buy_out_siblings') {
      const siblingShareOfHome = Math.round(netHomeValue * (1 - heirRatio));
      chosenHeirReceivesHome = true;
      const heirOwnHomePart = Math.round(netHomeValue * heirRatio);
      const deductionFromCash = Math.min(heirCash, heirOwnHomePart + siblingShareOfHome);
      const remainingBuyout = Math.max(0, heirOwnHomePart + siblingShareOfHome - heirCash);
      heirCash = Math.max(0, heirCash - deductionFromCash);
      buyoutCostToman += remainingBuyout;
    }
  }

  if (hasBusiness && state.ownedBusiness && chosenHeirId) {
    if (!sharedBusinessAvailable) {
      chosenHeirReceivesBusiness = true;
      chosenHeirBusinessShare = state.ownedBusiness.ownershipShare;
      heirCash = Math.max(0, heirCash - Math.min(heirCash, netBusinessValue));
    } else if (businessDecision === 'keep_jointly') {
      chosenHeirReceivesBusiness = true;
      chosenHeirBusinessShare = Number(
        Math.max(0.15, state.ownedBusiness.ownershipShare * heirRatio).toFixed(2),
      );
      heirCash = Math.max(
        0,
        heirCash - Math.min(heirCash, Math.round(netBusinessValue * heirRatio)),
      );
    } else if (businessDecision === 'buy_out_siblings') {
      chosenHeirReceivesBusiness = true;
      chosenHeirBusinessShare = state.ownedBusiness.ownershipShare;
      const deductionFromCash = Math.min(heirCash, netBusinessValue);
      const remainingBuyout = Math.max(0, netBusinessValue - heirCash);
      heirCash = Math.max(0, heirCash - deductionFromCash);
      buyoutCostToman += remainingBuyout;
    }
  }

  if (heirShareLine) {
    heirShareLine.cashToman = heirCash;
    heirShareLine.assetsToman = Math.max(0, heirShareLine.totalToman - heirCash);
  }

  return {
    grossAssetsToman,
    cashToman,
    financialAssetsToman,
    housingValueToman,
    businessValueToman,
    funeralCostToman,
    debtsAndLoansTotalToman,
    debtsPaidToman,
    forgivenDebtToman,
    settlementFeeToman,
    netDistributableToman,
    charityEndowmentToman,
    contested,
    contestOutcomeFa,
    eventsTriggeredFa,
    shares,
    chosenHeirCashToman: Math.max(0, Math.round(heirCash)),
    chosenHeirReceivesHome,
    chosenHeirReceivesBusiness,
    chosenHeirBusinessShare,
    buyoutCostToman: Math.max(0, Math.round(buyoutCostToman)),
    sharedHomeAvailable,
    sharedBusinessAvailable,
    homeDecision,
    businessDecision,
  };
}

function deriveInheritedTalentHints(state: GameState, dataset: GameDataset): string[] {
  const hints: string[] = [];
  for (const dt of state.player.discoveredTalents) {
    const def = dataset.talents.talents.find((t) => t.id === dt.talentId);
    if (def && !hints.includes(def.categoryFa)) {
      hints.push(`گرایش خانوادگی به ${def.categoryFa}`);
    }
  }
  return hints.slice(0, 2);
}

export function getEligibleHeirs(state: GameState, dataset: GameDataset): HeirCandidate[] {
  const candidates: HeirCandidate[] = [];
  const parentTalentHints = deriveInheritedTalentHints(state, dataset);

  const addCandidate = (
    person: Person,
    rel: { closeness: number; respect: number },
    relationKind: HeirCandidate['relationKind'],
    relationLabelFa: string,
  ) => {
    const preview = settleEstate({
      state,
      chosenHeirId: person.id,
      dataset,
      homeDecision: 'sell_and_split',
      businessDecision: 'sell_and_split',
    });
    const share = preview.shares.find((s) => s.recipientId === person.id);
    candidates.push({
      personId: person.id,
      fullName: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender,
      age: person.age,
      relationKind,
      relationLabelFa,
      jobTitle: person.jobTitle,
      maritalStatus: person.maritalStatus ?? (person.spouseId ? 'married' : 'single'),
      traits: person.traits,
      closeness: rel.closeness,
      respect: rel.respect,
      estimatedInheritanceToman: share?.totalToman ?? 0,
      hasHome: person.age >= 26,
      isAlive: person.isAlive,
      inheritedTalentHints: parentTalentHints,
    });
  };

  for (const { person, rel } of getLivingRelativesByRole(state, ['child'])) {
    addCandidate(
      person,
      rel,
      'child',
      person.gender === 'male' ? 'پسر' : 'دختر',
    );
  }
  for (const { person, rel } of getLivingRelativesByRole(state, ['grandchild'])) {
    addCandidate(person, rel, 'grandchild', 'نوه');
  }
  for (const { person, rel } of getLivingRelativesByRole(state, ['niece_nephew'])) {
    addCandidate(person, rel, 'niece_nephew', 'خواهرزاده / برادرزاده');
  }

  return candidates;
}

export function createDistantRelativeCandidate(
  state: GameState,
  seed: string,
  dataset: GameDataset,
): HeirCandidate {
  const rng = new SeededRNG(`${seed}:distant_heir:${state.currentJalaliYear}`);
  const ethNames = dataset.names.ethnicities[state.player.ethnicity];
  const gender: Gender = rng.chance(0.5) ? 'male' : 'female';
  const firstName =
    gender === 'male' ? rng.pick(ethNames.maleFirstNames) : rng.pick(ethNames.femaleFirstNames);
  const age = rng.int(18, 34);
  const job = rng.pick(dataset.jobs).titleFa;
  const personId = `npc_distant_${state.currentJalaliYear}`;

  const preview = settleEstate({
    state,
    chosenHeirId: personId,
    dataset,
    homeDecision: 'sell_and_split',
    businessDecision: 'sell_and_split',
  });

  return {
    personId,
    fullName: `${firstName} ${state.player.lastName}`,
    firstName,
    lastName: state.player.lastName,
    gender,
    age,
    relationKind: 'distant_relative',
    relationLabelFa: gender === 'male' ? 'پسرعموی دور' : 'دخترعموی دور',
    jobTitle: job,
    maritalStatus: 'single',
    traits: ['سخت‌کوش', 'امیدوار'],
    closeness: 45,
    respect: 60,
    estimatedInheritanceToman: Math.round(preview.netDistributableToman * 0.25),
    hasHome: false,
    isAlive: true,
    inheritedTalentHints: deriveInheritedTalentHints(state, dataset),
  };
}

function evaluateDynastyRibbons(dynasty: DynastyState, dataset: GameDataset): string[] {
  const unlocked = new Set(dynasty.unlockedDynastyRibbons);
  const peakRealNetWorth = Math.max(
    0,
    ...dynasty.chapters.map((c) => c.real1405NetWorthToman),
  );

  for (const ribbon of dataset.inheritance.dynastyRibbons) {
    if (unlocked.has(ribbon.id)) continue;
    let met = true;
    if (ribbon.minGenerations !== undefined && dynasty.totalGenerationsLived < ribbon.minGenerations) {
      met = false;
    }
    if (
      ribbon.minCharityReal1405Toman !== undefined &&
      dynasty.charityEndowmentTotalToman < ribbon.minCharityReal1405Toman
    ) {
      met = false;
    }
    if (
      ribbon.minPeakReal1405Toman !== undefined &&
      peakRealNetWorth < ribbon.minPeakReal1405Toman
    ) {
      met = false;
    }
    if (ribbon.minReputation !== undefined && dynasty.familyReputation < ribbon.minReputation) {
      met = false;
    }
    if (ribbon.id === 'dyn_business_steward') {
      // Unlocked explicitly on business inheritance
      met = false;
    }
    if (met) {
      unlocked.add(ribbon.id);
    }
  }

  return Array.from(unlocked);
}

function appendCompletedChapterToDynasty(
  state: GameState,
  fallbackSeed: string,
  dataset: GameDataset,
  charityAddedToman: number,
  inheritedFromNameFa?: string,
  relationshipToPrevFa?: string,
): DynastyState {
  const dynasty = ensureDynastyState(state, fallbackSeed);
  const deathSummary = state.deathSummary;
  const finalNetWorth = deathSummary?.finalNetWorthToman ?? calculateNetWorthToman(state);
  const real1405NetWorth = Math.round(
    finalNetWorth / Math.max(0.000001, state.inflationMultiplier),
  );
  const city = dataset.cities.find((c) => c.id === state.player.currentCityId);
  const chapter: LifeChapterSummary = {
    generation: dynasty.currentGeneration,
    firstName: state.player.firstName,
    lastName: state.player.lastName,
    gender: state.player.gender,
    birthYear: state.birthJalaliYear,
    deathYear: state.currentJalaliYear,
    ageAtDeath: state.player.age,
    cityNameFa: city?.nameFa ?? 'ایران',
    causeOfDeath: deathSummary?.causeOfDeath ?? 'پایان زندگی',
    highestJobTitleFa:
      state.ownedBusiness?.nameFa ?? state.player.job?.title ?? 'زندگی آزاد',
    finalNetWorthToman: finalNetWorth,
    real1405NetWorthToman: real1405NetWorth,
    lifeScore: deathSummary?.lifeScore ?? 100,
    legacyTitle: deathSummary?.legacyTitle ?? 'رهگذر آرام زندگی',
    inheritedFromNameFa,
    relationshipToPrevFa,
  };

  dynasty.chapters.push(chapter);
  dynasty.totalGenerationsLived = dynasty.chapters.length;

  const wealthPoint: DynastyWealthPoint = {
    year: state.currentJalaliYear,
    generation: dynasty.currentGeneration,
    nominalToman: finalNetWorth,
    real1405Toman: real1405NetWorth,
    labelFa: `${state.player.firstName} ${state.player.lastName}`,
  };
  dynasty.wealthTimeline.push(wealthPoint);

  const hallEntry: DynastyHallOfFameEntry = {
    id: `hof_gen_${dynasty.currentGeneration}_${state.currentJalaliYear}`,
    fullName: `${state.player.firstName} ${state.player.lastName}`,
    generation: dynasty.currentGeneration,
    lifeScore: chapter.lifeScore,
    real1405NetWorthToman: real1405NetWorth,
    ageAtDeath: chapter.ageAtDeath,
    legacyTitle: chapter.legacyTitle,
    jalaliSpanFa: `${toPersianDigits(chapter.birthYear)} تا ${toPersianDigits(chapter.deathYear)}`,
  };
  dynasty.hallOfFame = [...dynasty.hallOfFame, hallEntry]
    .sort((a, b) => b.lifeScore - a.lifeScore)
    .slice(0, 12);

  const charityReal1405 = Math.round(
    charityAddedToman / Math.max(0.000001, state.inflationMultiplier),
  );
  dynasty.charityEndowmentTotalToman += Math.max(0, charityReal1405);

  const pp = getPurchasingPowerSummary(finalNetWorth, state, dataset);
  const repGain =
    (chapter.lifeScore >= 550 ? 6 : 2) +
    (charityReal1405 > 0 ? 8 : 0) -
    (state.player.criminalRecord > 0 ? 5 : 0);
  dynasty.familyReputation = clampStat(dynasty.familyReputation + repGain);

  const scoreDelta =
    chapter.lifeScore +
    Math.min(350, Math.round(pp.tehran70SqmApts * 80)) +
    (charityReal1405 > 0 ? 120 : 0);
  dynasty.dynastyScore += Math.max(50, scoreDelta);

  const memoryLine = `${state.player.firstName} ${state.player.lastName} (نسل ${toPersianDigits(dynasty.currentGeneration)}) در ${toPersianDigits(state.player.age)} سالگی پس از عمری به عنوان «${chapter.highestJobTitleFa}» چشم از جهان فروبست.`;
  dynasty.ancestorMemoriesFa = [...dynasty.ancestorMemoriesFa, memoryLine].slice(-12);

  dynasty.unlockedDynastyRibbons = evaluateDynastyRibbons(dynasty, dataset);
  return dynasty;
}

function blendGeneticsLiteTalents(
  deceasedTalents: HiddenTalents,
  rng: SeededRNG,
  dataset: GameDataset,
): HiddenTalents {
  const g = dataset.inheritance.rules.geneticsLite;
  const out: Partial<HiddenTalents> = {};
  for (const key of Object.keys(deceasedTalents) as TalentId[]) {
    const ancestorVal = deceasedTalents[key];
    const freshVal = rng.int(15, 88);
    let blended = ancestorVal * g.ancestorTalentWeight + freshVal * g.freshTalentWeight;
    if (rng.chance(g.mutationChance)) {
      blended += rng.int(-g.mutationBoostRange, g.mutationBoostRange);
    }
    out[key] = clampStat(blended);
  }
  return out as HiddenTalents;
}

export interface InheritToHeirParams {
  save: SaveGame;
  heirId: string;
  distantCandidate?: HeirCandidate;
  homeDecision: SharedAssetDecision;
  businessDecision: SharedAssetDecision;
  dataset: GameDataset;
}

export interface InheritToHeirOutcome {
  save: SaveGame;
  settlement: EstateSettlementResult;
}

export function inheritFromDeceasedToHeir(params: InheritToHeirParams): InheritToHeirOutcome {
  const {
    save,
    heirId,
    distantCandidate,
    homeDecision,
    businessDecision,
    dataset,
  } = params;

  const prevState = save.state;
  const worldSeed = prevState.worldSeed ?? prevState.dynasty?.worldSeed ?? save.seed;
  const rng = new SeededRNG(`${worldSeed}:inherit:${prevState.currentJalaliYear}:${heirId}`);

  // Clone or materialize distant relative NPC if needed
  const sourceState: GameState = distantCandidate
    ? {
        ...prevState,
        npcs: {
          ...prevState.npcs,
          [distantCandidate.personId]: {
            id: distantCandidate.personId,
            firstName: distantCandidate.firstName,
            lastName: distantCandidate.lastName,
            gender: distantCandidate.gender,
            age: distantCandidate.age,
            traits: distantCandidate.traits,
            jobTitle: distantCandidate.jobTitle,
            isAlive: true,
          },
        },
        relationships: [
          ...prevState.relationships,
          {
            personId: distantCandidate.personId,
            role: 'cousin',
            closeness: distantCandidate.closeness,
            respect: distantCandidate.respect,
            romance: 0,
          },
        ],
      }
    : prevState;

  const heirNpc = sourceState.npcs[heirId];
  const heirRel = sourceState.relationships.find((r) => r.personId === heirId);
  if (!heirNpc || !heirNpc.isAlive) {
    throw new Error(`Heir "${heirId}" not found or not alive`);
  }

  const settlement = settleEstate({
    state: sourceState,
    chosenHeirId: heirId,
    dataset,
    rng,
    homeDecision,
    businessDecision,
  });

  const prevInheritedFrom =
    typeof prevState.flags['inherited_from_name'] === 'string'
      ? (prevState.flags['inherited_from_name'] as string)
      : undefined;
  const prevRelTitle =
    typeof prevState.flags['inherited_relation_fa'] === 'string'
      ? (prevState.flags['inherited_relation_fa'] as string)
      : undefined;

  const updatedDynasty = appendCompletedChapterToDynasty(
    sourceState,
    worldSeed,
    dataset,
    settlement.charityEndowmentToman,
    prevInheritedFrom,
    prevRelTitle,
  );
  updatedDynasty.currentGeneration += 1;

  if (settlement.chosenHeirReceivesBusiness && !updatedDynasty.unlockedDynastyRibbons.includes('dyn_business_steward')) {
    updatedDynasty.unlockedDynastyRibbons.push('dyn_business_steward');
  }
  updatedDynasty.unlockedDynastyRibbons = evaluateDynastyRibbons(updatedDynasty, dataset);

  const nextGeneration = updatedDynasty.currentGeneration;
  const heirBirthYear = Math.max(1250, prevState.currentJalaliYear - heirNpc.age);

  // Build re-indexed NPCs & Relationships preserving extended family for the Family Tree
  const newNpcs: Record<string, Person> = {};
  const newRelationships: Relationship[] = [];
  const deceasedNpcId = `npc_ancestor_gen_${nextGeneration - 1}_${prevState.currentJalaliYear}`;
  const deceasedName = `${prevState.player.firstName} ${prevState.player.lastName}`;

  // Record deceased previous player as ancestor / parent
  newNpcs[deceasedNpcId] = {
    id: deceasedNpcId,
    firstName: prevState.player.firstName,
    lastName: prevState.player.lastName,
    gender: prevState.player.gender,
    age: prevState.player.age,
    traits: [],
    jobTitle: prevState.ownedBusiness?.nameFa ?? prevState.player.job?.title ?? 'درگذشته',
    isAlive: false,
    generation: nextGeneration - 1,
    birthYear: prevState.birthJalaliYear,
    deathYear: prevState.currentJalaliYear,
  };
  newRelationships.push({
    personId: deceasedNpcId,
    role:
      heirRel?.role === 'child'
        ? prevState.player.gender === 'male'
          ? 'father'
          : 'mother'
        : 'ancestor',
    closeness: heirRel?.closeness ?? 70,
    respect: heirRel?.respect ?? 75,
    romance: 0,
  });

  for (const rel of sourceState.relationships) {
    if (rel.personId === heirId) continue;
    const npc = sourceState.npcs[rel.personId];
    if (!npc) continue;

    let mappedRole: Relationship['role'] | null = null;
    if (heirRel?.role === 'child') {
      if (rel.role === 'spouse') {
        mappedRole = npc.gender === 'male' ? 'father' : 'mother';
      } else if (rel.role === 'child') {
        mappedRole = 'sibling';
      } else if (rel.role === 'grandchild' && npc.parentIds?.includes(heirId)) {
        mappedRole = 'child';
      } else if (rel.role === 'ancestor' || rel.role === 'father' || rel.role === 'mother') {
        mappedRole = 'ancestor';
      }
    } else if (heirRel?.role === 'grandchild') {
      if (rel.role === 'grandchild') mappedRole = 'sibling';
      else if (rel.role === 'child' && heirNpc.parentIds?.includes(npc.id)) {
        mappedRole = npc.gender === 'male' ? 'father' : 'mother';
      } else if (rel.role === 'ancestor') {
        mappedRole = 'ancestor';
      }
    } else if (rel.role === 'ancestor') {
      mappedRole = 'ancestor';
    }

    if (mappedRole) {
      newNpcs[npc.id] = { ...npc };
      newRelationships.push({
        ...rel,
        role: mappedRole,
        romance: 0,
      });
    }
  }

  // Inherit housing or start independent / family housing
  const nextHousing = settlement.chosenHeirReceivesHome
    ? {
        ...prevState.player.housing,
        propertyValueToman:
          settlement.homeDecision === 'keep_jointly' && settlement.sharedHomeAvailable
            ? Math.round(prevState.player.housing.propertyValueToman * 0.5)
            : prevState.player.housing.propertyValueToman,
      }
    : heirNpc.age < 18
      ? {
          type: 'with_family' as const,
          cityId: prevState.player.currentCityId,
          monthlyRentToman: 0,
          depositRahnToman: 0,
          propertyValueToman: 0,
        }
      : {
          type: 'with_family' as const,
          cityId: prevState.player.currentCityId,
          monthlyRentToman: 0,
          depositRahnToman: 0,
          propertyValueToman: 0,
        };

  // Inherit business if chosen
  const nextOwnedBusiness =
    settlement.chosenHeirReceivesBusiness && prevState.ownedBusiness
      ? {
          ...prevState.ownedBusiness,
          acquisitionMode: 'inheritance' as const,
          ownershipShare: settlement.chosenHeirBusinessShare || prevState.ownedBusiness.ownershipShare,
          lastYearCostsToman: { ...prevState.ownedBusiness.lastYearCostsToman },
          staff: prevState.ownedBusiness.staff.map((s) => ({ ...s })),
        }
      : null;

  // Inheritance buyout loan if cash couldn't cover sibling buyout in full
  const nextLoans =
    settlement.buyoutCostToman > 0
      ? [
          {
            id: `loan_buyout_${prevState.currentJalaliYear}`,
            name: 'تسویه سهم سایر وراث',
            principalRemainingToman: settlement.buyoutCostToman,
            annualInterestRate: 0.12,
            annualPaymentToman: Math.round((settlement.buyoutCostToman * 1.36) / 4),
            yearsRemaining: 4,
          },
        ]
      : [];

  // Preserve macro flags & world state cleanly
  const preservedFlags: GameState['flags'] = {
    inherited_from_name: deceasedName,
    inherited_relation_fa: heirRel?.role === 'child' ? 'فرزند' : 'وارث',
    legacy_generation: nextGeneration,
  };
  for (const [k, v] of Object.entries(prevState.flags)) {
    if (k === 'econ_scenario' || k.startsWith('macro_')) {
      preservedFlags[k] = v;
    }
  }

  // Derive age-appropriate initial education & military for heir
  const heirEduLevel =
    heirNpc.age >= 22
      ? 'bachelor'
      : heirNpc.age >= 18
        ? 'diploma'
        : heirNpc.age >= 16
          ? 'high_school'
          : heirNpc.age >= 13
            ? 'middle_school'
            : heirNpc.age >= 7
              ? 'elementary'
              : 'none';

  const g = dataset.inheritance.rules.geneticsLite;
  const baseHealth = clampStat(
    prevState.player.stats.health * g.healthPredispositionWeight + rng.int(65, 92) * (1 - g.healthPredispositionWeight),
  );

  const relationLabel =
    heirRel?.role === 'child'
      ? prevState.player.gender === 'male'
        ? 'پدرت'
        : 'مادرت'
      : 'خویشاوندت';

  const chapterStartLines = [
    `فصل نسل ${toPersianDigits(nextGeneration)} با نام «${heirNpc.firstName} ${heirNpc.lastName}» در ${toPersianDigits(heirNpc.age)} سالگی آغاز شد.`,
    settlement.chosenHeirCashToman > 0
      ? `پس از تسویه دیون و انحصار وراثت، مبلغ ${toPersianDigits(settlement.chosenHeirCashToman.toLocaleString('en-US'))} تومان به عنوان سهم‌الارث در اختیارت قرار گرفت.`
      : `پس از ادای دیون و هزینه‌های حصر وراثت ${relationLabel} «${deceasedName}»، مسیر تازه‌ای را با اتکا به تلاش خودت ادامه می‌دهی.`,
  ];
  if (prevState.will?.letterToHeirsFa.trim()) {
    chapterStartLines.push(`یادداشت وصیت‌نامه: «${prevState.will.letterToHeirsFa.trim()}»`);
  }

  const nextState: GameState = {
    turn: 0,
    birthJalaliYear: heirBirthYear,
    currentJalaliYear: prevState.currentJalaliYear,
    worldSeed,
    inflationMultiplier: prevState.inflationMultiplier,
    lastInflationRate: prevState.lastInflationRate,
    player: {
      firstName: heirNpc.firstName,
      lastName: heirNpc.lastName,
      gender: heirNpc.gender,
      ethnicity: prevState.player.ethnicity,
      birthCityId: prevState.player.currentCityId,
      currentCityId: prevState.player.currentCityId,
      countryId: prevState.player.countryId,
      socialClass:
        settlement.chosenHeirCashToman + (settlement.chosenHeirReceivesHome ? nextHousing.propertyValueToman : 0) >
        getMinWageMonthlyForState(prevState, dataset) * 60
          ? 'upper_middle'
          : 'middle',
      age: heirNpc.age,
      stats: {
        health: heirNpc.age > 55 ? Math.min(baseHealth, 75) : Math.max(60, baseHealth),
        happiness: clampStat(rng.int(55, 78)),
        intelligence: clampStat(Math.round(prevState.player.stats.intelligence * 0.3 + rng.int(48, 86) * 0.7)),
        looks: clampStat(rng.int(45, 90)),
        fame: clampStat(Math.round(updatedDynasty.familyReputation * 0.25)),
        mentalHealth: clampStat(rng.int(58, 82)),
      },
      hiddenStats: {
        luck: clampStat(rng.int(20, 90)),
        talent: clampStat(Math.round(prevState.player.hiddenStats.talent * 0.4 + rng.int(25, 92) * 0.6)),
        conscientiousness: clampStat(rng.int(25, 90)),
        riskAppetite: clampStat(rng.int(15, 85)),
      },
      hiddenTalents: blendGeneticsLiteTalents(prevState.player.hiddenTalents, rng, dataset),
      athleticDiscipline: prevState.player.athleticDiscipline,
      discoveredTalents: [],
      talentSkills: {},
      moneyToman: settlement.chosenHeirCashToman,
      debtToman: 0,
      education: {
        level: heirEduLevel,
        inSchool: heirNpc.age >= 7 && heirNpc.age < 18,
        yearsInCurrentStage: 0,
        schoolType: prevState.player.education.schoolType,
        gpa: Number(rng.float(14.5, 19.2).toFixed(1)),
      },
      job: null,
      licenses: [],
      militaryStatus:
        heirNpc.gender === 'female'
          ? 'not_applicable'
          : heirNpc.age >= 25
            ? 'completed'
            : 'pending',
      maritalStatus: heirNpc.maritalStatus ?? 'single',
      criminalRecord: 0,
      housing: nextHousing,
    },
    npcs: newNpcs,
    relationships: newRelationships,
    assets: [],
    loans: nextLoans,
    ownedBusiness: nextOwnedBusiness,
    businessHistory: [],
    flags: preservedFlags,
    eventHistory: {},
    scheduledEvents: [],
    timeline: [
      {
        id: `turn_0_inherit_gen_${nextGeneration}`,
        age: heirNpc.age,
        jalaliYear: prevState.currentJalaliYear,
        title: `آغاز نسل ${toPersianDigits(nextGeneration)} · ${heirNpc.firstName} ${heirNpc.lastName}`,
        text: chapterStartLines.join(' '),
        type: 'milestone',
      },
    ],
    unlockedAchievements: [],
    isAlive: true,
    horizonEnded: false,
    deathSummary: null,
    will: null,
    dynasty: updatedDynasty,
  };

  return {
    save: {
      ...save,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      seed: `${worldSeed}:gen${nextGeneration}:${prevState.currentJalaliYear}`,
      rngState: rng.getState(),
      updatedAt: new Date().toISOString(),
      state: nextState,
    },
    settlement,
  };
}

export function applyCharityFoundationEnding(
  save: SaveGame,
  dataset: GameDataset,
): { save: SaveGame; settlement: EstateSettlementResult } {
  const prevState = save.state;
  const worldSeed = prevState.worldSeed ?? prevState.dynasty?.worldSeed ?? save.seed;
  const rng = new SeededRNG(`${worldSeed}:charity_end:${prevState.currentJalaliYear}`);
  const settlement = settleEstate({
    state: prevState,
    dataset,
    rng,
    extraCharityOverride: true,
  });

  const updatedDynasty = appendCompletedChapterToDynasty(
    prevState,
    worldSeed,
    dataset,
    settlement.charityEndowmentToman,
  );
  updatedDynasty.charityFoundationNameFa = `بنیاد خیریه خاندان ${prevState.player.lastName}`;
  updatedDynasty.familyReputation = clampStat(updatedDynasty.familyReputation + 15);
  updatedDynasty.dynastyScore += 300;
  if (!updatedDynasty.unlockedDynastyRibbons.includes('dyn_charity_founder')) {
    updatedDynasty.unlockedDynastyRibbons.push('dyn_charity_founder');
  }
  updatedDynasty.unlockedDynastyRibbons = evaluateDynastyRibbons(updatedDynasty, dataset);
  updatedDynasty.isClosed = true;

  return {
    save: {
      ...save,
      updatedAt: new Date().toISOString(),
      state: {
        ...prevState,
        dynasty: updatedDynasty,
      },
    },
    settlement,
  };
}

export function closeDynastyCleanly(save: SaveGame, dataset: GameDataset): SaveGame {
  const prevState = save.state;
  const worldSeed = prevState.worldSeed ?? prevState.dynasty?.worldSeed ?? save.seed;
  const updatedDynasty = appendCompletedChapterToDynasty(prevState, worldSeed, dataset, 0);
  updatedDynasty.isClosed = true;

  return {
    ...save,
    updatedAt: new Date().toISOString(),
    state: {
      ...prevState,
      dynasty: updatedDynasty,
    },
  };
}
