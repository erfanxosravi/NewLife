import type { GameDataset } from '../data/registry';
import { getPlayerSkillLevel, getTrackExperienceYears } from './careers';
import { getMacroRatesForState, getMinWageMonthlyForState } from './economy';
import { formatToman, toPersianDigits } from './jalali';
import type { SeededRNG } from './rng';
import { applyStatDelta } from './stats';
import type {
  BusinessAcquisitionMode,
  BusinessFinancingMode,
  BusinessSize,
  BusinessStaffMember,
  BusinessTypeDefinition,
  GameState,
  HousingRegionTier,
  OwnedBusinessState,
} from './types';

export interface EmployerOfferData {
  businessTypeId: string;
  businessNameFa: string;
  jobId: string;
  discountedPriceToman: number;
  fullPriceToman: number;
  offeredYear: number;
}

export interface FamilyTakeoverEligibility {
  eligible: boolean;
  parentRole?: 'father' | 'mother';
  parentName?: string;
  parentJobTitle?: string;
  hasSiblingDisputeRisk: boolean;
  reason?: string;
}

export interface BusinessAcquisitionQuote {
  businessDef: BusinessTypeDefinition;
  acquisitionMode: BusinessAcquisitionMode;
  financingMode: BusinessFinancingMode;
  cityId: string;
  regionTier: HousingRegionTier;
  size: BusinessSize;
  depositRahnToman: number;
  monthlyRentToman: number;
  equipmentCostToman: number;
  initialStockCostToman: number;
  licenseCostToman: number;
  goodwillOrFranchiseFeeToman: number;
  workingReserveToman: number;
  totalCapitalRequiredToman: number;
  playerCashRequiredToman: number;
  loanPrincipalToman: number;
  loanAnnualPaymentToman: number;
  ownershipShare: number;
  missingCapitalToman: number;
  missingLicenses: string[];
  missingSkillReason?: string;
  missingExperienceReason?: string;
  conflictOfInterestReason?: string;
  familyEligibility?: FamilyTakeoverEligibility;
  breakevenChancePct: number;
  runwayMonths: number;
  expectedAnnualNetMinToman: number;
  expectedAnnualNetMaxToman: number;
  eligible: boolean;
  blockedReasons: string[];
}

const SIZE_MULTIPLIERS: Record<BusinessSize, { capital: number; staff: number; revenue: number }> = {
  small: { capital: 0.78, staff: 0.65, revenue: 0.8 },
  medium: { capital: 1.0, staff: 1.0, revenue: 1.0 },
  large: { capital: 1.55, staff: 1.5, revenue: 1.62 },
};

export function checkFamilyTakeoverEligibility(
  state: GameState,
  businessDef: BusinessTypeDefinition,
): FamilyTakeoverEligibility {
  const parents: { role: 'father' | 'mother'; personId: string }[] = [
    { role: 'father', personId: 'npc_father' },
    { role: 'mother', personId: 'npc_mother' },
  ];

  const siblingCount = state.relationships.filter(
    (r) => r.role === 'sibling' && state.npcs[r.personId]?.isAlive,
  ).length;

  for (const p of parents) {
    const npc = state.npcs[p.personId];
    const rel = state.relationships.find((r) => r.personId === p.personId);
    if (!npc || !npc.isAlive || !rel) continue;

    const jobMatch = businessDef.familyTradeKeywords.some((kw) => npc.jobTitle.includes(kw));
    if (!jobMatch) continue;

    if (rel.closeness < 55 || rel.respect < 50) {
      return {
        eligible: false,
        parentRole: p.role,
        parentName: `${npc.firstName} ${npc.lastName}`,
        parentJobTitle: npc.jobTitle,
        hasSiblingDisputeRisk: siblingCount > 0,
        reason: `صمیمیت و اعتماد با ${p.role === 'father' ? 'پدر' : 'مادر'} (${npc.firstName}) برای واگذاری کسب‌وکار خانوادگی کافی نیست (نیاز به صمیمیت ۵۵ و احترام ۵۰).`,
      };
    }

    if (npc.age < 52 && state.player.age < 24) {
      return {
        eligible: false,
        parentRole: p.role,
        parentName: `${npc.firstName} ${npc.lastName}`,
        parentJobTitle: npc.jobTitle,
        hasSiblingDisputeRisk: siblingCount > 0,
        reason: `${p.role === 'father' ? 'پدر' : 'مادر'} فعلاً قصد واگذاری ندارد (زودتر از ۲۴ سالگی و پختگی شغلی ممکن نیست).`,
      };
    }

    return {
      eligible: true,
      parentRole: p.role,
      parentName: `${npc.firstName} ${npc.lastName}`,
      parentJobTitle: npc.jobTitle,
      hasSiblingDisputeRisk: siblingCount > 0,
    };
  }

  return {
    eligible: false,
    hasSiblingDisputeRisk: siblingCount > 0,
    reason: 'هیچ‌یک از والدین در این صنف کسب‌وکار فعالی برای واگذاری ندارند.',
  };
}

export function calculateBusinessAcquisitionQuote(params: {
  businessDef: BusinessTypeDefinition;
  acquisitionMode: BusinessAcquisitionMode;
  financingMode: BusinessFinancingMode;
  cityId: string;
  regionTier: HousingRegionTier;
  size: BusinessSize;
  state: GameState;
  dataset: GameDataset;
  employerOfferPriceToman?: number;
}): BusinessAcquisitionQuote {
  const {
    businessDef,
    acquisitionMode,
    financingMode,
    cityId,
    regionTier,
    size,
    state,
    dataset,
    employerOfferPriceToman,
  } = params;

  const baseline = dataset.economy.baseline1405;
  const macro = getMacroRatesForState(state, dataset);
  const minWageMonthly = macro.minWageMonthly;
  const tehranFactor = macro.tehranListingSqm / baseline.verifiedBenchmarks.tehranListingPricePerSqm.value;
  const cityMult = baseline.cityHousingMultipliers[cityId]?.value ?? 0.35;
  const regionMult = baseline.housingRegionMultipliers[regionTier].value;
  const sizeMult = SIZE_MULTIPLIERS[size];

  const baseResidentialDeposit =
    regionTier === 'south'
      ? baseline.verifiedBenchmarks.tehranRentSouthDeposit.value * tehranFactor * cityMult
      : baseline.verifiedBenchmarks.tehranRentMidDeposit.value * tehranFactor * cityMult * regionMult;
  const baseResidentialMonthlyRent =
    regionTier === 'south'
      ? baseline.verifiedBenchmarks.tehranRentSouthMonthly.value * tehranFactor * cityMult
      : baseline.verifiedBenchmarks.tehranRentMidMonthly.value * tehranFactor * cityMult * regionMult;

  const depositRahnToman = Math.max(
    minWageMonthly * 2,
    Math.round(
      baseResidentialDeposit * businessDef.commercialDepositFactorOfResidential * sizeMult.capital * 0.45,
    ),
  );
  const monthlyRentToman = Math.max(
    Math.round(minWageMonthly * 0.3),
    Math.round(
      baseResidentialMonthlyRent *
        businessDef.commercialMonthlyRentFactorOfResidential *
        sizeMult.capital *
        0.85,
    ),
  );

  const equipmentCostToman = Math.round(
    minWageMonthly * businessDef.equipmentMinWageMultiple * sizeMult.capital,
  );
  const initialStockCostToman = Math.round(
    minWageMonthly * businessDef.initialStockMinWageMultiple * sizeMult.capital,
  );
  const licenseCostToman = Math.round(minWageMonthly * businessDef.licenseCostMinWageMultiple);
  const workingReserveToman = Math.round(monthlyRentToman * 3 + minWageMonthly * 2.5 * sizeMult.staff);

  let goodwillOrFranchiseFeeToman = 0;
  if (acquisitionMode === 'buy_existing') {
    goodwillOrFranchiseFeeToman = Math.round(
      (equipmentCostToman + depositRahnToman * 0.4) * 0.45,
    );
  } else if (acquisitionMode === 'franchise') {
    goodwillOrFranchiseFeeToman = Math.round(
      (equipmentCostToman + initialStockCostToman) * businessDef.franchiseFeeMultiplier,
    );
  }

  let totalCapitalRequiredToman = Math.round(
    depositRahnToman +
      equipmentCostToman +
      initialStockCostToman +
      licenseCostToman +
      goodwillOrFranchiseFeeToman +
      workingReserveToman,
  );

  let ownershipShare = 1.0;
  let effectiveWorkingStartupCost = totalCapitalRequiredToman;

  if (acquisitionMode === 'partnership' || financingMode === 'partner_split') {
    ownershipShare = 0.5;
    effectiveWorkingStartupCost = Math.round(totalCapitalRequiredToman * 0.52);
  } else if (acquisitionMode === 'family_takeover') {
    ownershipShare = 0.85;
    effectiveWorkingStartupCost = Math.round(workingReserveToman + licenseCostToman * 0.5);
  } else if (acquisitionMode === 'employer_offer' && employerOfferPriceToman) {
    effectiveWorkingStartupCost = employerOfferPriceToman;
    totalCapitalRequiredToman = Math.max(employerOfferPriceToman, Math.round(totalCapitalRequiredToman * 0.72));
  } else if (acquisitionMode === 'inheritance') {
    effectiveWorkingStartupCost = 0;
  }

  let loanPrincipalToman = 0;
  let loanAnnualPaymentToman = 0;
  let playerCashRequiredToman = effectiveWorkingStartupCost;

  if (
    financingMode === 'bank_loan' &&
    acquisitionMode !== 'inheritance' &&
    effectiveWorkingStartupCost > 0
  ) {
    loanPrincipalToman = Math.round(effectiveWorkingStartupCost * 0.45);
    const rate = baseline.policyAndModel.loanHousingRate.value;
    const years = 5;
    loanAnnualPaymentToman = Math.round((loanPrincipalToman * (1 + rate * years)) / years);
    playerCashRequiredToman = Math.max(0, effectiveWorkingStartupCost - loanPrincipalToman);
  }

  const missingCapitalToman = Math.max(0, playerCashRequiredToman - state.player.moneyToman);

  // Check license, skill, experience, and conflict of interest gates
  const ownedLicenses = state.player.licenses ?? [];
  const missingLicenses = businessDef.requiredLicenses.filter((lid) => !ownedLicenses.includes(lid));

  const skillLevel = businessDef.requiredSkillId
    ? getPlayerSkillLevel(state, businessDef.requiredSkillId)
    : 0;
  let missingSkillReason: string | undefined;
  if (businessDef.requiredSkillId && skillLevel < businessDef.minSkillLevel) {
    const skillTitle =
      dataset.skills.find((s) => s.id === businessDef.requiredSkillId)?.titleFa ?? 'مهارت تخصصی';
    missingSkillReason = `نیاز به سطح ${toPersianDigits(businessDef.minSkillLevel)} در مهارت «${skillTitle}»`;
  }

  let missingExperienceReason: string | undefined;
  const currentJobExp =
    state.player.job && businessDef.relatedJobIds.includes(state.player.job.jobId)
      ? state.player.job.yearsInJob
      : 0;
  const relatedTrack = dataset.jobs.find((j) => businessDef.relatedJobIds.includes(j.id))?.track;
  const trackExp = relatedTrack ? getTrackExperienceYears(state, relatedTrack) : 0;
  const bestExp = Math.max(currentJobExp, trackExp);
  if (
    acquisitionMode !== 'family_takeover' &&
    acquisitionMode !== 'inheritance' &&
    businessDef.minYearsExperience > 0 &&
    bestExp < businessDef.minYearsExperience
  ) {
    missingExperienceReason = `نیاز به حداقل ${toPersianDigits(businessDef.minYearsExperience)} سال سابقه مرتبط (فعلی: ${toPersianDigits(bestExp)} سال)`;
  }

  let conflictOfInterestReason: string | undefined;
  if (state.player.job) {
    const currentJobDef = dataset.jobs.find((j) => j.id === state.player.job!.jobId);
    if (currentJobDef && currentJobDef.employerType === 'دولتی' && !currentJobDef.ownershipPath.allowed) {
      conflictOfInterestReason =
        'در زمان اشتغال رسمی دولتی مجاز به تأسیس کسب‌وکار تجاری نیستی؛ ابتدا استعفا بده.';
    }
  }

  let familyEligibility: FamilyTakeoverEligibility | undefined;
  if (acquisitionMode === 'family_takeover') {
    familyEligibility = checkFamilyTakeoverEligibility(state, businessDef);
  }

  // Risk & return preview
  const city = dataset.cities.find((c) => c.id === cityId);
  const cityDemand = city ? (city.jobOpportunityIndex - 1) * 0.18 : 0;
  const modeBonus =
    acquisitionMode === 'buy_existing'
      ? 0.08
      : acquisitionMode === 'franchise'
        ? businessDef.franchiseRiskReduction * 0.45
        : acquisitionMode === 'family_takeover'
          ? 0.14
          : acquisitionMode === 'employer_offer'
            ? 0.12
            : 0;
  const skillEdge = Math.max(0, skillLevel - businessDef.minSkillLevel) * 0.04;
  const conscientiousEdge = (state.player.hiddenStats.conscientiousness - 50) * 0.002;
  const baseSurvival = 1 - businessDef.annualFailureBaseRisk * 2.2;
  const breakevenChancePct = Math.round(
    Math.max(
      28,
      Math.min(
        92,
        (baseSurvival + cityDemand + modeBonus + skillEdge + conscientiousEdge) * 100,
      ),
    ),
  );

  const staffCount = Math.max(
    0,
    Math.round(businessDef.defaultStaffCount * sizeMult.staff),
  );
  const monthlyBurn =
    monthlyRentToman +
    Math.round((staffCount * minWageMonthly * businessDef.staffWageMinWageMultiple) / 1.0) +
    Math.round(loanAnnualPaymentToman / 12);
  const runwayMonths = Math.max(1, Math.round(workingReserveToman / Math.max(1, monthlyBurn)));

  const estRevenue = Math.round(
    totalCapitalRequiredToman * businessDef.baseAnnualRevenueMultipleOfCapital * sizeMult.revenue,
  );
  const expectedAnnualNetMinToman = Math.round(
    estRevenue * businessDef.grossMarginMin * ownershipShare - loanAnnualPaymentToman,
  );
  const expectedAnnualNetMaxToman = Math.round(
    estRevenue * businessDef.grossMarginMax * ownershipShare - loanAnnualPaymentToman,
  );

  const blockedReasons: string[] = [];
  if (state.ownedBusiness) {
    blockedReasons.push('در حال حاضر مالک یک کسب‌وکار فعال هستی.');
  }
  if (state.player.age < businessDef.minAge) {
    blockedReasons.push(`حداقل سن ${toPersianDigits(businessDef.minAge)} سال لازم است.`);
  }
  if (acquisitionMode === 'franchise' && !businessDef.franchiseAvailable) {
    blockedReasons.push('مدل نمایندگی و فرانچایز برای این کسب‌وکار فعال نیست.');
  }
  if (conflictOfInterestReason) blockedReasons.push(conflictOfInterestReason);
  if (familyEligibility && !familyEligibility.eligible && familyEligibility.reason) {
    blockedReasons.push(familyEligibility.reason);
  }
  if (missingLicenses.length > 0) {
    const licTitles = missingLicenses
      .map((lid) => dataset.businesses.licenses.find((l) => l.id === lid)?.titleFa ?? lid)
      .join('، ');
    blockedReasons.push(`مجوز لازم است: ${licTitles}`);
  }
  if (missingSkillReason) blockedReasons.push(missingSkillReason);
  if (missingExperienceReason) blockedReasons.push(missingExperienceReason);
  if (missingCapitalToman > 0) {
    blockedReasons.push(`سرمایه کافی نداری: حدود ${formatToman(missingCapitalToman)} کم داری`);
  }

  return {
    businessDef,
    acquisitionMode,
    financingMode,
    cityId,
    regionTier,
    size,
    depositRahnToman,
    monthlyRentToman,
    equipmentCostToman,
    initialStockCostToman,
    licenseCostToman,
    goodwillOrFranchiseFeeToman,
    workingReserveToman,
    totalCapitalRequiredToman,
    playerCashRequiredToman,
    loanPrincipalToman,
    loanAnnualPaymentToman,
    ownershipShare,
    missingCapitalToman,
    missingLicenses,
    missingSkillReason,
    missingExperienceReason,
    conflictOfInterestReason,
    familyEligibility,
    breakevenChancePct,
    runwayMonths,
    expectedAnnualNetMinToman,
    expectedAnnualNetMaxToman,
    eligible: blockedReasons.length === 0,
    blockedReasons,
  };
}

export function createInitialStaffMember(params: {
  businessDef: BusinessTypeDefinition;
  index: number;
  minWageMonthly: number;
  rng: SeededRNG;
  dataset: GameDataset;
}): BusinessStaffMember {
  const { businessDef, index, minWageMonthly, rng, dataset } = params;
  const eth = dataset.names.ethnicities.persian;
  const firstName = rng.chance(0.5)
    ? rng.pick(eth.maleFirstNames)
    : rng.pick(eth.femaleFirstNames);
  const lastName = rng.pick(eth.lastNames);
  const roleTitleFa = businessDef.staffRolesFa[index % businessDef.staffRolesFa.length];
  const level = index === 0 ? 1 : rng.int(1, 2);
  const annualWageToman = Math.round(
    minWageMonthly * 12 * businessDef.staffWageMinWageMultiple * (1 + (level - 1) * 0.2),
  );
  return {
    id: `staff_${index}_${rng.int(1000, 9999)}`,
    fullName: `${firstName} ${lastName}`,
    roleTitleFa,
    level,
    yearsEmployed: 0,
    skill: rng.int(35, 70),
    morale: rng.int(55, 85),
    annualWageToman,
  };
}

export function buildOwnedBusinessFromQuote(params: {
  quote: BusinessAcquisitionQuote;
  customNameFa?: string;
  state: GameState;
  rng: SeededRNG;
  dataset: GameDataset;
}): OwnedBusinessState {
  const { quote, customNameFa, state, rng, dataset } = params;
  const minWageMonthly = getMinWageMonthlyForState(state, dataset);
  const sizeMult = SIZE_MULTIPLIERS[quote.size];
  const staffCount = Math.min(
    quote.businessDef.maxStaffCount,
    Math.max(0, Math.round(quote.businessDef.defaultStaffCount * sizeMult.staff)),
  );
  const staff: BusinessStaffMember[] = [];
  for (let i = 0; i < staffCount; i++) {
    staff.push(
      createInitialStaffMember({
        businessDef: quote.businessDef,
        index: i,
        minWageMonthly,
        rng,
        dataset,
      }),
    );
  }

  const isPartner = quote.ownershipShare < 0.99 && quote.acquisitionMode !== 'family_takeover';
  const eth = dataset.names.ethnicities.persian;
  const partnerName = isPartner
    ? `${rng.pick(eth.maleFirstNames)} ${rng.pick(eth.lastNames)}`
    : undefined;

  const initialRep =
    quote.acquisitionMode === 'buy_existing'
      ? 60
      : quote.acquisitionMode === 'franchise'
        ? 66
        : quote.acquisitionMode === 'family_takeover'
          ? 64
          : 44;

  return {
    id: `biz_${state.turn}_${rng.int(100, 999)}`,
    businessTypeId: quote.businessDef.id,
    nameFa: customNameFa?.trim() || quote.businessDef.titleFa,
    acquisitionMode: quote.acquisitionMode,
    cityId: quote.cityId,
    regionTier: quote.regionTier,
    size: quote.size,
    foundedYear: state.currentJalaliYear,
    yearsOperating: 0,
    ownershipShare: quote.ownershipShare,
    partnerName,
    partnerCloseness: isPartner ? rng.int(55, 82) : undefined,
    isFranchise: quote.acquisitionMode === 'franchise',
    depositLockedToman: quote.depositRahnToman,
    monthlyRentToman: quote.monthlyRentToman,
    equipmentValueToman: quote.equipmentCostToman,
    cashReserveToman: quote.workingReserveToman,
    branchCount: 1,
    priceStrategy: 'standard',
    reputation: initialRep,
    customerBase: initialRep,
    renovationYearsLeft: 0,
    marketingYearsLeft: 0,
    consecutiveLossYears: 0,
    lastYearRevenueToman: 0,
    lastYearCostsToman: {
      rent: 0,
      staff: 0,
      supplies: 0,
      taxesAndFees: 0,
      royalty: 0,
    },
    lastYearProfitToman: 0,
    cumulativeProfitToman: 0,
    staff,
  };
}

export function stepOwnedBusinessYear(
  draft: GameState,
  rng: SeededRNG,
  dataset: GameDataset,
): void {
  const biz = draft.ownedBusiness;
  if (!biz) return;

  const bizDef = dataset.businesses.businesses.find((b) => b.id === biz.businessTypeId);
  if (!bizDef) return;

  const minWageMonthly = getMinWageMonthlyForState(draft, dataset);
  const rentGrowth =
    1 +
    Math.max(0, draft.lastInflationRate) *
      dataset.economy.baseline1405.policyAndModel.rentInflationPassThrough.value;
  biz.monthlyRentToman = Math.max(1, Math.round(biz.monthlyRentToman * rentGrowth));
  biz.depositLockedToman = Math.max(
    0,
    Math.round(biz.depositLockedToman * (1 + Math.max(0, draft.lastInflationRate) * 0.35)),
  );
  biz.equipmentValueToman = Math.max(
    0,
    Math.round(biz.equipmentValueToman * (1 + Math.max(0, draft.lastInflationRate) * 0.45 - 0.06)),
  );
  biz.yearsOperating += 1;

  // Step staff wages & experience
  let totalStaffWages = 0;
  for (const s of biz.staff) {
    s.yearsEmployed += 1;
    s.annualWageToman = Math.max(
      minWageMonthly * 12,
      Math.round(s.annualWageToman * (1 + Math.max(0, draft.lastInflationRate) * 0.9)),
    );
    s.skill = Math.min(100, s.skill + rng.int(1, 3));
    if (s.yearsEmployed % 3 === 0 && s.level < 3) {
      s.level += 1;
    }
    totalStaffWages += s.annualWageToman;
  }

  // Macro & operational demand shock
  const inflation = draft.lastInflationRate;
  const recessionShock =
    inflation > 0.36 ? -0.14 * bizDef.recessionSensitivity : inflation < 0.2 ? 0.06 : 0;
  const city = dataset.cities.find((c) => c.id === biz.cityId);
  const cityFactor = city ? city.jobOpportunityIndex : 1;
  const priceVolumeMult =
    biz.priceStrategy === 'discount' ? 1.14 : biz.priceStrategy === 'premium' ? 0.88 : 1.0;
  const priceMarginMult =
    biz.priceStrategy === 'discount' ? 0.88 : biz.priceStrategy === 'premium' ? 1.18 : 1.0;

  const renovationBoost = biz.renovationYearsLeft > 0 ? 0.12 : 0;
  const marketingBoost = biz.marketingYearsLeft > 0 ? 0.14 : 0;
  if (biz.renovationYearsLeft > 0) biz.renovationYearsLeft -= 1;
  if (biz.marketingYearsLeft > 0) biz.marketingYearsLeft -= 1;

  const staffSkillAvg =
    biz.staff.length > 0
      ? biz.staff.reduce((sum, s) => sum + s.skill, 0) / biz.staff.length
      : 55;
  const bizSkill = getPlayerSkillLevel(draft, bizDef.requiredSkillId || 'business');
  const opsEdge = (biz.reputation - 50) * 0.004 + (staffSkillAvg - 50) * 0.002 + bizSkill * 0.03;

  // Base nominal revenue grows with capital, branches, inflation pass-through, and demand
  const sizeMult = SIZE_MULTIPLIERS[biz.size];
  const nominalAnchor =
    (biz.depositLockedToman + biz.equipmentValueToman + minWageMonthly * 18) *
    bizDef.baseAnnualRevenueMultipleOfCapital *
    sizeMult.revenue *
    biz.branchCount;

  const marketSwing = rng.float(-0.24, 0.28);
  const demandMultiplier = Math.max(
    0.45,
    (cityFactor * priceVolumeMult + recessionShock + renovationBoost + marketingBoost + opsEdge + marketSwing),
  );
  const grossRevenue = Math.max(1000, Math.round(nominalAnchor * demandMultiplier * priceMarginMult));

  const annualRent = biz.monthlyRentToman * 12 * biz.branchCount;
  const suppliesRatio = rng.float(0.32, 0.48);
  const suppliesCost = Math.round(grossRevenue * suppliesRatio);
  const royaltyCost = biz.isFranchise ? Math.round(grossRevenue * 0.06) : 0;
  const preTax = grossRevenue - annualRent - totalStaffWages - suppliesCost - royaltyCost;
  const taxesAndFees = preTax > 0 ? Math.round(preTax * 0.18 + minWageMonthly * 1.2) : Math.round(minWageMonthly * 0.8);

  const totalProfit = grossRevenue - annualRent - totalStaffWages - suppliesCost - royaltyCost - taxesAndFees;
  const playerShareProfit = Math.round(totalProfit * biz.ownershipShare);

  biz.lastYearRevenueToman = grossRevenue;
  biz.lastYearCostsToman = {
    rent: annualRent,
    staff: totalStaffWages,
    supplies: suppliesCost,
    taxesAndFees,
    royalty: royaltyCost,
  };
  biz.lastYearProfitToman = playerShareProfit;
  biz.cumulativeProfitToman += playerShareProfit;

  // Reputation & customer base drift
  if (playerShareProfit > 0) {
    biz.reputation = Math.min(100, biz.reputation + rng.int(1, 4));
    biz.customerBase = Math.min(200, biz.customerBase + rng.int(2, 7));
    biz.consecutiveLossYears = 0;
  } else {
    biz.reputation = Math.max(10, biz.reputation - rng.int(2, 6));
    biz.customerBase = Math.max(10, biz.customerBase - rng.int(4, 10));
    biz.consecutiveLossYears += 1;
  }

  // Partner conflict risk on partnerships
  if (biz.partnerName && typeof biz.partnerCloseness === 'number' && rng.chance(0.12)) {
    const conflictSeverity = rng.int(-12, 6);
    biz.partnerCloseness = Math.max(0, Math.min(100, biz.partnerCloseness + conflictSeverity));
    if (conflictSeverity < -6) {
      draft.player.stats = applyStatDelta(draft.player.stats, { mentalHealth: -4, happiness: -3 });
      draft.timeline.push({
        id: `turn_${draft.turn}_partner_conflict`,
        age: draft.player.age,
        jalaliYear: draft.currentJalaliYear,
        title: 'اختلاف با شریک تجاری',
        text: `بر سر هزینه‌ها و تقسیم سود با شریکت «${biz.partnerName}» اختلاف نظر جدی پیش آمد.`,
        type: 'life',
        statChanges: { mentalHealth: -4 },
      });
    }
  }

  // Cash flow: positive profit pays into reserve (30%) and player cash (70%); negative profit drains reserve then player cash/debt
  if (playerShareProfit >= 0) {
    const reserveCut = Math.round(playerShareProfit * 0.25);
    const ownerDraw = playerShareProfit - reserveCut;
    biz.cashReserveToman += reserveCut;
    draft.player.moneyToman = Math.round(draft.player.moneyToman + ownerDraw);
    draft.flags['business_income'] = ownerDraw;
    draft.flags['business_name'] = biz.nameFa;
  } else {
    const lossAbs = Math.abs(playerShareProfit);
    const fromReserve = Math.min(Math.max(0, biz.cashReserveToman), lossAbs);
    biz.cashReserveToman -= fromReserve;
    const remainder = lossAbs - fromReserve;
    if (remainder > 0) {
      draft.player.moneyToman = Math.round(draft.player.moneyToman - remainder);
    }
    draft.flags['business_income'] = playerShareProfit;
    draft.flags['business_name'] = biz.nameFa;
    draft.player.stats = applyStatDelta(draft.player.stats, { mentalHealth: -5, happiness: -4 });
    draft.timeline.push({
      id: `turn_${draft.turn}_biz_loss`,
      age: draft.player.age,
      jalaliYear: draft.currentJalaliYear,
      title: `زیان مالی در ${biz.nameFa}`,
      text: `امسال رکود و افزایش هزینه‌ها باعث زیان ${formatToman(lossAbs)} در کسب‌وکارت شد.`,
      type: 'life',
      statChanges: { mentalHealth: -5 },
    });
  }

  // Ensure moneyToman never goes negative (move deficit to debtToman)
  if (draft.player.moneyToman < 0) {
    draft.player.debtToman = Math.round(draft.player.debtToman + Math.abs(draft.player.moneyToman));
    draft.player.moneyToman = 0;
  }

  // Failure / Bankruptcy trigger
  const insolvencyFailure =
    (biz.consecutiveLossYears >= 2 && biz.cashReserveToman <= 0 && rng.chance(0.55)) ||
    (biz.consecutiveLossYears >= 3 && rng.chance(0.8));

  if (insolvencyFailure) {
    const liquidationProceeds = Math.round(
      (biz.depositLockedToman + biz.equipmentValueToman * 0.35) * biz.ownershipShare,
    );
    const prevCredit = typeof draft.flags['credit_score'] === 'number' ? draft.flags['credit_score'] : 640;
    draft.flags['credit_score'] = Math.max(300, prevCredit - 95);
    draft.player.moneyToman = Math.round(draft.player.moneyToman + liquidationProceeds);
    draft.player.stats = applyStatDelta(draft.player.stats, {
      mentalHealth: -14,
      happiness: -15,
      fame: -4,
    });
    draft.businessHistory.push({
      id: biz.id,
      businessTypeId: biz.businessTypeId,
      nameFa: biz.nameFa,
      acquisitionMode: biz.acquisitionMode,
      startYear: biz.foundedYear,
      endYear: draft.currentJalaliYear,
      outcome: draft.player.debtToman > liquidationProceeds ? 'bankrupt' : 'closed',
      netResultToman: biz.cumulativeProfitToman + liquidationProceeds,
    });
    draft.ownedBusiness = null;
    delete draft.flags['business_name'];
    draft.flags['business_income'] = 0;

    draft.timeline.push({
      id: `turn_${draft.turn}_biz_bankrupt`,
      age: draft.player.age,
      jalaliYear: draft.currentJalaliYear,
      title: `تعطیلی و ورشکستگی ${biz.nameFa}`,
      text: `به‌دلیل زیان انباشته و بدهی، مجبور به جمع‌کردن «${biz.nameFa}» شدی؛ امتیاز اعتباری و روحیه‌ات آسیب دید.`,
      type: 'milestone',
      statChanges: { mentalHealth: -14, happiness: -15 },
    });
  }
}
