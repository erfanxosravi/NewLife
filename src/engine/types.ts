export type Gender = 'male' | 'female';

export type Ethnicity =
  | 'persian'
  | 'azeri'
  | 'kurdish'
  | 'lur'
  | 'gilaki'
  | 'mazani'
  | 'baluch'
  | 'arab'
  | 'turkmen';

export type SocialClass = 'poor' | 'middle' | 'upper_middle' | 'wealthy';

export type EducationLevel =
  | 'none'
  | 'preschool'
  | 'elementary'
  | 'middle_school'
  | 'high_school'
  | 'diploma'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'medical_doctor';

export type HighSchoolTrack = 'math' | 'science' | 'humanities' | 'vocational';

export type UniversityTier = 'state_top' | 'state' | 'azad' | 'payam_noor' | 'applied_science';

export type MilitaryStatus =
  | 'not_applicable'
  | 'pending'
  | 'serving'
  | 'completed'
  | 'exempt_medical'
  | 'exempt_breadwinner'
  | 'exempt_educational'
  | 'bought_out';

export type MaritalStatus = 'single' | 'engaged' | 'married' | 'divorced' | 'widowed';

export type HousingType = 'with_family' | 'dorm' | 'rent' | 'owned' | 'villa';

export type RelationshipRole =
  | 'father'
  | 'mother'
  | 'sibling'
  | 'friend'
  | 'partner'
  | 'spouse'
  | 'child'
  | 'grandchild'
  | 'niece_nephew'
  | 'cousin'
  | 'ancestor';

export type AssetType =
  | 'usd'
  | 'gold'
  | 'coin'
  | 'stock'
  | 'crypto'
  | 'real_estate'
  | 'car';

export type ContentTag = 'mild' | 'crime' | 'substance' | 'romance' | 'social';

export interface PlayerStats {
  health: number;
  happiness: number;
  intelligence: number;
  looks: number;
  fame: number;
  mentalHealth: number;
}

export interface HiddenStats {
  luck: number;
  talent: number;
  conscientiousness: number;
  riskAppetite: number;
}

export interface EducationState {
  level: EducationLevel;
  inSchool: boolean;
  yearsInCurrentStage: number;
  schoolType: 'public' | 'private' | 'sampad';
  highSchoolTrack?: HighSchoolTrack;
  universityTier?: UniversityTier;
  major?: string;
  konkurRank?: number;
  gpa: number;
}

export interface JobState {
  jobId: string;
  title: string;
  track: string;
  level: number;
  annualSalaryToman: number;
  stress: number;
  yearsInJob: number;
}

export interface HousingState {
  type: HousingType;
  cityId: string;
  monthlyRentToman: number;
  depositRahnToman: number;
  propertyValueToman: number;
}

export type TalentId =
  | 'singing'
  | 'music_instrument'
  | 'acting'
  | 'athletics'
  | 'visual_art'
  | 'writing'
  | 'comedy'
  | 'math_science'
  | 'programming_tech'
  | 'business_sense'
  | 'leadership'
  | 'cooking'
  | 'mechanical';

export type AthleticDiscipline =
  | 'football'
  | 'wrestling'
  | 'volleyball'
  | 'taekwondo'
  | 'weightlifting'
  | 'swimming'
  | 'running';

export type TalentTier = 'curiosity' | 'interest' | 'clear_talent' | 'brilliant_talent';

export type HiddenTalents = Record<TalentId, number>;

export interface DiscoveredTalent {
  talentId: TalentId;
  tier: TalentTier;
  discoveredAge: number;
  hintTextFa: string;
  athleticDiscipline?: AthleticDiscipline;
}

export interface TalentSkillState {
  skill: number;
  practiceCount: number;
  opportunityScore: number;
  auditionFailures: number;
  careerStage: number;
  activeRoute?: 'mainstream' | 'online' | 'teaching_studio' | 'abroad';
}

export interface Player {
  firstName: string;
  lastName: string;
  gender: Gender;
  ethnicity: Ethnicity;
  birthCityId: string;
  currentCityId: string;
  countryId: string;
  socialClass: SocialClass;
  age: number;
  stats: PlayerStats;
  hiddenStats: HiddenStats;
  hiddenTalents: HiddenTalents;
  athleticDiscipline: AthleticDiscipline;
  discoveredTalents: DiscoveredTalent[];
  talentSkills: Partial<Record<TalentId, TalentSkillState>>;
  moneyToman: number;
  debtToman: number;
  education: EducationState;
  job: JobState | null;
  licenses: string[];
  militaryStatus: MilitaryStatus;
  maritalStatus: MaritalStatus;
  criminalRecord: number;
  housing: HousingState;
  avatarSeed?: string;
  startingScenarioId?: 'standard' | 'welfare_center';
  raisedInWelfareCenter?: boolean;
}

export type PersonOriginKind =
  | 'biological'
  | 'adopted'
  | 'temporary_guardian'
  | 'host_family'
  | 'inspector'
  | 'mentor';

export interface PersonAdoptionMeta {
  careType: AdoptionCareType;
  placedYear: number;
  placedAtChildAge: number;
  biologicalOriginKnown: boolean;
  backgroundFa: string;
  healthNeedsFa?: string;
  supervisionClosedAt18?: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  traits: string[];
  jobTitle: string;
  isAlive: boolean;
  generation?: number;
  parentIds?: string[];
  spouseId?: string;
  birthYear?: number;
  deathYear?: number;
  maritalStatus?: MaritalStatus;
  avatarSeed?: string;
  originKind?: PersonOriginKind;
  adoptionMeta?: PersonAdoptionMeta;
}

export interface Relationship {
  personId: string;
  role: RelationshipRole;
  closeness: number;
  respect: number;
  romance: number;
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  quantity: number;
  purchasePriceToman: number;
  currentValueToman: number;
}

export interface Loan {
  id: string;
  name: string;
  principalRemainingToman: number;
  annualInterestRate: number;
  annualPaymentToman: number;
  yearsRemaining: number;
}

export interface ScheduledEvent {
  eventId: string;
  triggerAtAge: number;
  sourceFlag?: string;
}

export interface TimelineEntry {
  id: string;
  age: number;
  jalaliYear: number;
  title: string;
  text: string;
  type: 'birth' | 'life' | 'event' | 'milestone' | 'death';
  statChanges?: Partial<PlayerStats> & { moneyToman?: number };
}

export interface ContentSettings {
  allowCrime: boolean;
  allowSubstance: boolean;
  allowRomance: boolean;
  allowSocialPolitical: boolean;
}

export interface DeathSummary {
  ageAtDeath: number;
  jalaliYearOfDeath: number;
  causeOfDeath: string;
  finalNetWorthToman: number;
  lifeScore: number;
  legacyTitle: string;
  highlights: string[];
}

export type BusinessAcquisitionMode =
  | 'start_scratch'
  | 'buy_existing'
  | 'partnership'
  | 'family_takeover'
  | 'franchise'
  | 'employer_offer'
  | 'inheritance';

export type BusinessFinancingMode = 'personal_cash' | 'bank_loan' | 'partner_split';
export type BusinessSize = 'small' | 'medium' | 'large';
export type BusinessPriceStrategy = 'discount' | 'standard' | 'premium';

export interface BusinessStaffMember {
  id: string;
  fullName: string;
  roleTitleFa: string;
  level: number;
  yearsEmployed: number;
  skill: number;
  morale: number;
  annualWageToman: number;
}

export interface BusinessYearlyCosts {
  rent: number;
  staff: number;
  supplies: number;
  taxesAndFees: number;
  royalty: number;
}

export interface OwnedBusinessState {
  id: string;
  businessTypeId: string;
  nameFa: string;
  acquisitionMode: BusinessAcquisitionMode;
  cityId: string;
  regionTier: HousingRegionTier;
  size: BusinessSize;
  foundedYear: number;
  yearsOperating: number;
  ownershipShare: number;
  partnerName?: string;
  partnerCloseness?: number;
  isFranchise: boolean;
  depositLockedToman: number;
  monthlyRentToman: number;
  equipmentValueToman: number;
  cashReserveToman: number;
  branchCount: number;
  priceStrategy: BusinessPriceStrategy;
  reputation: number;
  customerBase: number;
  renovationYearsLeft: number;
  marketingYearsLeft: number;
  consecutiveLossYears: number;
  lastYearRevenueToman: number;
  lastYearCostsToman: BusinessYearlyCosts;
  lastYearProfitToman: number;
  cumulativeProfitToman: number;
  staff: BusinessStaffMember[];
}

export interface BusinessHistoryEntry {
  id: string;
  businessTypeId: string;
  nameFa: string;
  acquisitionMode: BusinessAcquisitionMode;
  startYear: number;
  endYear: number;
  outcome: 'sold' | 'closed' | 'bankrupt';
  netResultToman: number;
}

export interface GameState {
  turn: number;
  birthJalaliYear: number;
  currentJalaliYear: number;
  worldSeed?: string;
  inflationMultiplier: number;
  lastInflationRate: number;
  player: Player;
  npcs: Record<string, Person>;
  relationships: Relationship[];
  assets: Asset[];
  loans: Loan[];
  ownedBusiness: OwnedBusinessState | null;
  businessHistory: BusinessHistoryEntry[];
  flags: Record<string, boolean | number | string>;
  eventHistory: Record<string, number>;
  scheduledEvents: ScheduledEvent[];
  timeline: TimelineEntry[];
  unlockedAchievements: string[];
  isAlive: boolean;
  horizonEnded?: boolean;
  deathSummary: DeathSummary | null;
  will?: WillConfig | null;
  dynasty?: DynastyState;
  adoption?: AdoptionState;
  jobCompass?: JobCompassState;
}

export interface SaveGame {
  schemaVersion: number;
  slotId: string;
  seed: string;
  rngState: number;
  createdAt: string;
  updatedAt: string;
  contentSettings: ContentSettings;
  state: GameState;
}

export interface City {
  id: string;
  nameFa: string;
  provinceFa: string;
  isVillage: boolean;
  populationWeight: number;
  costOfLivingIndex: number;
  jobOpportunityIndex: number;
  climateFa: string;
  dialectFa: string;
  primaryEthnicities: Ethnicity[];
}

export interface NamesDataset {
  ethnicities: Record<
    Ethnicity,
    {
      labelFa: string;
      maleFirstNames: string[];
      femaleFirstNames: string[];
      lastNames: string[];
    }
  >;
}

export interface JobLadderStep {
  level: number;
  titleFa: string;
  salaryMultiplier: number;
  minYearsInRole: number;
  minTotalExperience: number;
  minSkillLevel: number;
  minPerformance: number;
  requiredCredential?: string;
  promotionBaseChance: number;
  requiresConnections?: boolean;
  ceiling: boolean;
}

export interface JobOwnershipPath {
  allowed: boolean;
  businessTypeId?: string;
  titleFa?: string;
  minAge: number;
  minSkillLevel: number;
  minYearsExperience: number;
  requiredLicenses: string[];
  capitalMinWageMultiple: {
    min: number;
    max: number;
  };
  financingOptions: BusinessFinancingMode[];
  riskLevel: 'کم' | 'متوسط' | 'زیاد';
  franchiseAvailable?: boolean;
  employerOfferEligible?: boolean;
  notesFa: string;
}

export type JobCompassAxis = 'income' | 'calm' | 'security' | 'growth' | 'freedom';

export type JobIconKey =
  | 'taxi'
  | 'scissors'
  | 'bazaar'
  | 'code'
  | 'chalkboard'
  | 'desk'
  | 'heartPulse'
  | 'stethoscope'
  | 'mortar'
  | 'scales';

export interface JobTag {
  icon: string;
  labelFa: string;
}

export interface JobFingerprint {
  income: number;
  calm: number;
  security: number;
  growth: number;
  freedom: number;
  isEstimate: boolean;
  estimatedAxes: JobCompassAxis[];
  notesFa?: string;
}

export interface JobDayScene {
  timeFa: string;
  emoji: string;
  textFa: string;
}

export interface JobCompassPriorities {
  income: number;
  calm: number;
  security: number;
  growth: number;
  freedom: number;
}

export interface WaitlistedJobEntry {
  jobId: string;
  appliedTurn: number;
  appliedYear: number;
  interviewBonusPct: number;
}

export interface JobCompassState {
  priorities: JobCompassPriorities;
  prioritiesCustomized: boolean;
  shortlistedJobIds: string[];
  pinnedJobId: string | null;
  salaryUnit: 'monthly' | 'annual';
  waitlistedJobs: WaitlistedJobEntry[];
}

export type InterviewAnswerStyle = 'honest' | 'ambitious' | 'humble';

export interface InterviewAnswer {
  id: string;
  style: InterviewAnswerStyle;
  styleLabelFa: string;
  labelFa: string;
  chanceDeltaPct: number;
  reactionFa: string;
  axisAffinity?: JobCompassAxis;
}

export interface InterviewQuestion {
  id: string;
  promptFa: string;
  answers: InterviewAnswer[];
}

export interface InterviewsDataset {
  meta: {
    titleFa: string;
    asOf: string;
    source: string;
    confidence: DataConfidence;
  };
  generalQuestions: InterviewQuestion[];
  byJobId: Record<string, InterviewQuestion[]>;
}

export interface JobDefinition {
  id: string;
  titleFa: string;
  shortTitle: string;
  tagline?: string;
  iconKey: JobIconKey;
  tags: JobTag[];
  weeklyHours: number;
  fingerprint: JobFingerprint;
  longDescription: string;
  dayInLife: JobDayScene[];
  pros: string[];
  cons: string[];
  realityCheckFa: string;
  requirementIds: string[];
  track: string;
  employerType?: 'دولتی' | 'خصوصی' | 'آزاد' | 'خانوادگی';
  minEducation: EducationLevel;
  requiredLicenseId?: string;
  entryExamRequired?: boolean;
  noPromotions?: boolean;
  baseAnnualSalaryToman: number;
  stress: number;
  baseSuccessChance?: number;
  requiredSkillId?: string;
  ladder: JobLadderStep[];
  ownershipPath: JobOwnershipPath;
}

export interface LicenseDefinition {
  id: string;
  titleFa: string;
  issuerFa: string;
  minAge: number;
  minEducation: EducationLevel;
  requiredSkillId?: string;
  minSkillLevel?: number;
  feeMinWageMultiple: number;
  examRequired: boolean;
  examMinIntelligence?: number;
  descriptionFa: string;
}

export interface BusinessTypeDefinition {
  id: string;
  titleFa: string;
  categoryFa: string;
  relatedJobIds: string[];
  requiredLicenses: string[];
  minAge: number;
  requiredSkillId?: string;
  minSkillLevel: number;
  minYearsExperience: number;
  commercialDepositFactorOfResidential: number;
  commercialMonthlyRentFactorOfResidential: number;
  equipmentMinWageMultiple: number;
  initialStockMinWageMultiple: number;
  licenseCostMinWageMultiple: number;
  baseAnnualRevenueMultipleOfCapital: number;
  grossMarginMin: number;
  grossMarginMax: number;
  staffWageMinWageMultiple: number;
  defaultStaffCount: number;
  maxStaffCount: number;
  staffRolesFa: string[];
  annualFailureBaseRisk: number;
  recessionSensitivity: number;
  inflationPassThrough: number;
  franchiseAvailable: boolean;
  franchiseFeeMultiplier: number;
  franchiseRiskReduction: number;
  familyTradeKeywords: string[];
  notesFa: string;
}

export interface BusinessesCatalog {
  licenses: LicenseDefinition[];
  businesses: BusinessTypeDefinition[];
}

export interface CountryDefinition {
  id: string;
  nameFa: string;
  isIran: boolean;
  costOfLivingIndex: number;
  baseMigrationCostToman: number;
  difficulty: number;
  paths: ('study' | 'work' | 'investment')[];
}

export interface AchievementDefinition {
  id: string;
  titleFa: string;
  descriptionFa: string;
  category: string;
}

export interface EventCondition {
  minAge?: number;
  maxAge?: number;
  gender?: Gender;
  cities?: string[];
  socialClasses?: SocialClass[];
  minStats?: Partial<PlayerStats>;
  maxStats?: Partial<PlayerStats>;
  requiredFlags?: string[];
  forbiddenFlags?: string[];
  isAlive?: boolean;
}

export interface EventChoiceEffect {
  stats?: Partial<PlayerStats>;
  hiddenStats?: Partial<HiddenStats>;
  moneyToman?: number;
  setFlags?: Record<string, boolean | number | string>;
  scheduleEvents?: { eventId: string; delayYears: number }[];
  resultTextFa: string;
}

export interface EventChoice {
  id: string;
  labelFa: string;
  costToman?: number;
  effects: EventChoiceEffect;
}

export interface EventDefinition {
  id: string;
  category: 'childhood' | 'teen' | 'young_adult' | 'career' | 'family' | 'economy' | 'cultural' | 'old_age';
  calendarTheme?: 'nowruz' | 'yalda' | 'ramadan' | 'muharram' | 'sizdah';
  titleFa: string;
  textFa: string;
  contentTag: ContentTag;
  weight: number;
  maxOccurrences: number;
  conditions: EventCondition;
  choices: EventChoice[];
}

export type ActivityCategory =
  | 'health'
  | 'leisure'
  | 'travel'
  | 'sport'
  | 'learning'
  | 'charity'
  | 'crime'
  | 'gambling';

export interface ActivityOutcome {
  weight: number;
  resultTextFa: string;
  stats?: Partial<PlayerStats>;
  moneyToman?: number;
  criminalRecordDelta?: number;
}

export interface ActivityDefinition {
  id: string;
  titleFa: string;
  category: ActivityCategory;
  costToman: number;
  cooldownYears: number;
  minAge: number;
  maxAge?: number;
  effectHintFa: string;
  riskLabelFa: 'کم' | 'متوسط' | 'زیاد';
  contentTag: ContentTag;
  outcomes: ActivityOutcome[];
}

export type ShopCategory =
  | 'appliances'
  | 'clothing'
  | 'tech'
  | 'travel'
  | 'gift'
  | 'nutrition'
  | 'luxury';

export interface ShopItemDefinition {
  id: string;
  titleFa: string;
  category: ShopCategory;
  basePriceToman: number;
  effectHintFa: string;
  minAge: number;
  stats: Partial<PlayerStats>;
  repeatable: boolean;
}

export interface SkillDefinition {
  id: string;
  titleFa: string;
  descriptionFa: string;
  costToman: number;
  minAge: number;
  effectHintFa: string;
  relatedJobTracks: string[];
}

export type HousingRegionTier = 'north' | 'mid' | 'south';

export interface HousingListing {
  id: string;
  titleFa: string;
  mode: 'rent' | 'buy';
  areaSqm: number;
  regionTier?: HousingRegionTier;
  baseDepositRahnToman: number;
  baseMonthlyRentToman: number;
  baseBuyPriceToman: number;
}

export interface VehicleCatalogItem {
  id: string;
  titleFa: string;
  tier: 'iranian' | 'foreign' | 'luxury';
  basePriceToman: number;
  annualCostToman: number;
  fameBonus: number;
  happinessBonus: number;
  accidentRiskLabel: string;
}

export interface HousingCatalog {
  housingListings: HousingListing[];
  vehicleCatalog: VehicleCatalogItem[];
}

export type DataConfidence = 'verified' | 'estimate';

export interface SourcedNumber {
  value: number;
  unit: string;
  asOf: string;
  source: string;
  confidence: DataConfidence;
  min?: number;
  max?: number;
  note?: string;
}

export type InflationScenario = 'low' | 'medium' | 'high';

export interface Baseline1405Data {
  meta: {
    anchorYear: number;
    anchorMonth: string;
    currency: string;
  };
  verifiedBenchmarks: {
    minWageMonthly: SourcedNumber;
    minWageRaise1405: SourcedNumber;
    minWageRaise1405Other: SourcedNumber;
    cpiYoyShahrivar1405: SourcedNumber;
    usdFree: SourcedNumber;
    gold18kPerGram: SourcedNumber;
    emamiCoin: SourcedNumber;
    tehranListingPricePerSqm: SourcedNumber;
    tehranRegion1PricePerSqm: SourcedNumber;
    tehranRentMidDeposit: SourcedNumber;
    tehranRentMidMonthly: SourcedNumber;
    tehranRentSouthDeposit: SourcedNumber;
    tehranRentSouthMonthly: SourcedNumber;
    snappDriverMonthlyBusy: SourcedNumber;
    snappDriverMonthlyLowActivity: SourcedNumber;
    snappTopDriverYearly1404: SourcedNumber;
    rideHailCommission: SourcedNumber;
    rideHailRunningCostMonthly: SourcedNumber;
    rideHailRunningCostSampleGrossMonthly: SourcedNumber;
  };
  policyAndModel: {
    listingToTransactionDiscount: SourcedNumber;
    depositToMonthlyRentRate: SourcedNumber;
    bankDepositAnnualRate: SourcedNumber;
    socialSecurityEmployeeRate: SourcedNumber;
    taxExemptionAnnualMinWageMultiple: SourcedNumber;
    taxBracket1Rate: SourcedNumber;
    taxBracket2MinWageMultiple: SourcedNumber;
    taxBracket2Rate: SourcedNumber;
    taxBracket3MinWageMultiple: SourcedNumber;
    taxBracket3Rate: SourcedNumber;
    referenceApartmentAreaSqm: SourcedNumber;
    wealthMilestoneUsdThreshold: SourcedNumber;
    wealthMilestoneAptCount: SourcedNumber;
    baseAnnualLivingExpenseMinWageMultiple: SourcedNumber;
    unemployedLivingSupportMinWageMultiple: SourcedNumber;
    pocketMoneyPoorMinWageMultiple: SourcedNumber;
    pocketMoneyMiddleMinWageMultiple: SourcedNumber;
    pocketMoneyUpperMiddleMinWageMultiple: SourcedNumber;
    pocketMoneyWealthyMinWageMultiple: SourcedNumber;
    tutorFeeMinWageMultiple: SourcedNumber;
    konkurFeeMinWageMultiple: SourcedNumber;
    uniTuitionStateTopEngMinWageMultiple: SourcedNumber;
    uniTuitionStateTopMedMinWageMultiple: SourcedNumber;
    uniTuitionStateMinWageMultiple: SourcedNumber;
    uniTuitionAzadMinWageMultiple: SourcedNumber;
    uniTuitionAppliedScienceMinWageMultiple: SourcedNumber;
    businessStartupCapitalMinWageMultiple: SourcedNumber;
    businessInitialYieldMin: SourcedNumber;
    businessInitialYieldMax: SourcedNumber;
    businessRealCatchup: SourcedNumber;
    militaryBuyoutMinWageMultiple: SourcedNumber;
    loanPersonalMinWageMultiple: SourcedNumber;
    loanPersonalRate: SourcedNumber;
    loanPersonalYears: SourcedNumber;
    loanHousingMinWageMultiple: SourcedNumber;
    loanHousingRate: SourcedNumber;
    loanHousingYears: SourcedNumber;
    debtPayoffChunkMinWageMultiple: SourcedNumber;
    investmentQuickTradeShare: SourcedNumber;
    investmentQuickTradeMinMinWageMultiple: SourcedNumber;
    investmentQuickTradeMaxMinWageMultiple: SourcedNumber;
    giftMinWageMultiple: SourcedNumber;
    domesticTripMinWageMultiple: SourcedNumber;
    weddingMinWageMultiple: SourcedNumber;
    carAnnualMaintenanceRate: SourcedNumber;
    carRepairRate: SourcedNumber;
    carInflationPassThrough: SourcedNumber;
    retirementPensionRatio: SourcedNumber;
    overtimeBonusRatio: SourcedNumber;
    raiseMultiplier: SourcedNumber;
    usdInflationPassThrough: SourcedNumber;
    usdVolatilityMin: SourcedNumber;
    usdVolatilityMax: SourcedNumber;
    goldInflationPassThrough: SourcedNumber;
    goldVolatilityMin: SourcedNumber;
    goldVolatilityMax: SourcedNumber;
    bourseInflationPassThrough: SourcedNumber;
    bourseVolatilityMin: SourcedNumber;
    bourseVolatilityMax: SourcedNumber;
    housingInflationPassThrough: SourcedNumber;
    rentInflationPassThrough: SourcedNumber;
    cryptoDriftMin: SourcedNumber;
    cryptoDriftMax: SourcedNumber;
    familyHelpProbability: SourcedNumber;
    familyHelpWealthyMinWageMultiple: SourcedNumber;
    familyHelpUpperMiddleMinWageMultiple: SourcedNumber;
    inheritanceWealthyMinWageMultiple: SourcedNumber;
    inheritanceUpperMiddleMinWageMultiple: SourcedNumber;
    inheritanceMiddleMinWageMultiple: SourcedNumber;
    inheritancePoorMinWageMultiple: SourcedNumber;
    scenarioLowInflationMin: SourcedNumber;
    scenarioLowInflationMax: SourcedNumber;
    scenarioLowWageCatchup: SourcedNumber;
    scenarioMediumInflationMin: SourcedNumber;
    scenarioMediumInflationMax: SourcedNumber;
    scenarioMediumWageCatchup: SourcedNumber;
    scenarioHighInflationMin: SourcedNumber;
    scenarioHighInflationMax: SourcedNumber;
    scenarioHighWageCatchup: SourcedNumber;
  };
  cityHousingMultipliers: Record<string, SourcedNumber>;
  housingRegionMultipliers: Record<HousingRegionTier, SourcedNumber>;
}

export interface HistoricalYearPoint {
  year: number;
  inflationRate: SourcedNumber;
  cpiIndex: SourcedNumber;
  usdFree: SourcedNumber;
  emamiCoin: SourcedNumber;
  minWageMonthly: SourcedNumber;
  tehranPricePerSqm: SourcedNumber;
  gdpGrowth: SourcedNumber;
  unemployment: SourcedNumber;
  oilExportRevenueIndex: SourcedNumber;
  liquidityGrowth: SourcedNumber;
  depositRate: SourcedNumber;
  stockIndex: SourcedNumber;
  globalGoldUSD: SourcedNumber;
  globalInflation: SourcedNumber;
  globalGrowth: SourcedNumber;
  oilPriceUSD: SourcedNumber;
}

export interface JobIncomeEntry {
  jobId: string;
  confidence: DataConfidence;
  asOf: string;
  source: string;
  monthlyIncomeMultiplierOfMinWage: {
    p10: SourcedNumber;
    median: SourcedNumber;
    p90: SourcedNumber;
  };
  commissionRate: SourcedNumber;
  costRatioOfGross: SourcedNumber;
  taxExempt: boolean;
  tail?: {
    probability: SourcedNumber;
    yearlyCapMultiplierOfMinWage: SourcedNumber;
    titleFa: string;
    resultTextFa: string;
  };
}

export interface EconomyDataset {
  baseline1405: Baseline1405Data;
  historicalSeries: HistoricalYearPoint[];
  jobIncome: JobIncomeEntry[];
}

export interface TalentDefinition {
  id: TalentId;
  titleFa: string;
  categoryFa: string;
  lessonTitleFa: string;
  lessonCostMinWageMultiple: number;
  minPracticeAge: number;
  relatedSkillId?: string;
  relatedParentJobKeywords: string[];
  relatedParentTraits: string[];
  schoolTypeBonus: {
    public: number;
    private: number;
    sampad: number;
  };
  cityAccessBoostIds: string[];
  discoveryHintsFa: string[];
}

export interface TalentsDataset {
  distribution: {
    alpha: number;
    beta: number;
    familyBetaMultiplier: number;
    standoutThreshold: number;
    rareThreshold: number;
  };
  discovery: {
    minAge: number;
    peakMinAge: number;
    peakMaxAge: number;
    lateBloomerMaxAge: number;
    minNaturalDiscoveryScore: number;
    maxNaturalDiscoveriesPerYear: number;
    basePeakProbability: number;
    baseLateBloomerProbability: number;
    practiceDiscoveryBonus: number;
  };
  tiers: {
    id: TalentTier;
    minScore: number;
    maxScore: number;
    labelFa: string;
    descriptionFa: string;
  }[];
  athleticDisciplines: {
    id: AthleticDiscipline;
    titleFa: string;
    urbanBias: number;
  }[];
  talents: TalentDefinition[];
}

export type SpecialCareerRouteId = 'mainstream' | 'online' | 'teaching_studio' | 'abroad';

export interface SpecialCareerDefinition {
  id: string;
  titleFa: string;
  requiredTalentId: TalentId;
  optionalAltTalentIds?: TalentId[];
  minTier: TalentTier;
  minSkill: number;
  minAge: number;
  peakEndAge: number;
  maxEntryAge: number;
  baseStageSuccessRate: number;
  luckWeight: number;
  fameRequirementForStage3: number;
  stageTitlesFa: string[];
  monthlyIncomeMinWageMultiplier: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
  };
  tailPayout?: {
    probability: number;
    yearlyCapMultiplierOfMinWage: number;
    titleFa: string;
    resultTextFa: string;
  };
  alternativeRoutes: {
    id: SpecialCareerRouteId;
    titleFa: string;
    noteFa: string;
  }[];
  femaleMainstreamNoteFa?: string;
  fallbackCareerFa: string;
  fallbackMonthlyMinWageMultiplier: number;
  socialEventGate: boolean;
}

export type WillBeneficiaryTarget = 'spouse' | 'child' | 'sibling' | 'friend' | 'charity_endowment';

export interface WillBeneficiary {
  id: string;
  targetType: WillBeneficiaryTarget;
  personId?: string;
  labelFa: string;
  sharePercent: number;
}

export interface WillSpecificItems {
  homeRecipientId?: string;
  businessRecipientId?: string;
  vehicleRecipientId?: string;
}

export interface WillConfig {
  updatedAtAge: number;
  updatedAtYear: number;
  divisionPreference: 'civil_code' | 'equal_if_consented';
  charityPercent: number;
  beneficiaries: WillBeneficiary[];
  specificItems: WillSpecificItems;
  letterToHeirsFa: string;
}

export type HeirRelationKind = 'child' | 'grandchild' | 'niece_nephew' | 'distant_relative';

export interface HeirCandidate {
  personId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  relationKind: HeirRelationKind;
  relationLabelFa: string;
  jobTitle: string;
  maritalStatus: MaritalStatus;
  traits: string[];
  closeness: number;
  respect: number;
  estimatedInheritanceToman: number;
  hasHome: boolean;
  isAlive: boolean;
  inheritedTalentHints: string[];
}

export type SharedAssetDecision = 'keep_jointly' | 'buy_out_siblings' | 'sell_and_split';

export interface EstateShareLine {
  recipientId: string;
  recipientNameFa: string;
  roleLabelFa: string;
  shareRatio: number;
  cashToman: number;
  assetsToman: number;
  totalToman: number;
  notesFa?: string;
}

export interface EstateSettlementResult {
  grossAssetsToman: number;
  cashToman: number;
  financialAssetsToman: number;
  housingValueToman: number;
  businessValueToman: number;
  funeralCostToman: number;
  debtsAndLoansTotalToman: number;
  debtsPaidToman: number;
  forgivenDebtToman: number;
  settlementFeeToman: number;
  netDistributableToman: number;
  charityEndowmentToman: number;
  contested: boolean;
  contestOutcomeFa?: string;
  eventsTriggeredFa: string[];
  shares: EstateShareLine[];
  chosenHeirCashToman: number;
  chosenHeirReceivesHome: boolean;
  chosenHeirReceivesBusiness: boolean;
  chosenHeirBusinessShare: number;
  buyoutCostToman: number;
  sharedHomeAvailable: boolean;
  sharedBusinessAvailable: boolean;
  homeDecision: SharedAssetDecision;
  businessDecision: SharedAssetDecision;
}

export interface LifeChapterSummary {
  generation: number;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthYear: number;
  deathYear: number;
  ageAtDeath: number;
  cityNameFa: string;
  causeOfDeath: string;
  highestJobTitleFa: string;
  finalNetWorthToman: number;
  real1405NetWorthToman: number;
  lifeScore: number;
  legacyTitle: string;
  inheritedFromNameFa?: string;
  relationshipToPrevFa?: string;
  educationLevel?: EducationLevel;
  didEmigrate?: boolean;
  charityContributionToman?: number;
  fameAtDeath?: number;
  summaryFa?: string;
}

export interface DynastyWealthPoint {
  year: number;
  generation: number;
  nominalToman: number;
  real1405Toman: number;
  labelFa: string;
}

export interface DynastyHallOfFameEntry {
  id: string;
  fullName: string;
  generation: number;
  lifeScore: number;
  real1405NetWorthToman: number;
  ageAtDeath: number;
  legacyTitle: string;
  jalaliSpanFa: string;
}

export interface DynastyState {
  dynastyNameFa: string;
  founderNameFa: string;
  worldSeed: string;
  currentGeneration: number;
  totalGenerationsLived: number;
  familyReputation: number;
  dynastyScore: number;
  unlockedDynastyRibbons: string[];
  chapters: LifeChapterSummary[];
  wealthTimeline: DynastyWealthPoint[];
  hallOfFame: DynastyHallOfFameEntry[];
  charityEndowmentTotalToman: number;
  charityFoundationNameFa?: string;
  ancestorMemoriesFa: string[];
  isClosed?: boolean;
}

export interface InheritanceDataset {
  meta: {
    titleFa: string;
    simplified: boolean;
    civilCodeArticles: number[];
    summaryFa: string;
    asOf: string;
    source: string;
  };
  rules: {
    minWillAge: number;
    seriousIllnessHealthThreshold: number;
    maxWillShareRatio: number;
    noPersonalDebtLiabilityBeyondEstate: boolean;
    settlementOrder: string[];
    funeralCostMinWageMultiple: SourcedNumber;
    probateAndAppraisalFeeRate: SourcedNumber;
    spouseShares: {
      wifeWithDescendants: number;
      wifeNoDescendants: number;
      husbandWithDescendants: number;
      husbandNoDescendants: number;
    };
    sonToDaughterRatio: number;
    parentFallbackShareWhenNoChildren: number;
    maxMacroJalaliYear: number;
    contestation: {
      baseChance: number;
      excessWillBonus: number;
      lowClosenessThreshold: number;
      lowClosenessBonus: number;
      upholdChanceOnExcess: number;
      upholdChanceOnCloseness: number;
    };
    geneticsLite: {
      ancestorTalentWeight: number;
      freshTalentWeight: number;
      mutationChance: number;
      mutationBoostRange: number;
      healthPredispositionWeight: number;
    };
  };
  legalExplanationsFa: {
    articleFa: string;
    titleFa: string;
    bodyFa: string;
  }[];
  dynastyRibbons: {
    id: string;
    titleFa: string;
    descriptionFa: string;
    minGenerations?: number;
    minCharityReal1405Toman?: number;
    minPeakReal1405Toman?: number;
    minReputation?: number;
    minEducatedChapters?: number;
    requiresEmigration?: boolean;
  }[];
}

export type AdoptionCareType = 'permanent' | 'temporary_guardian' | 'host_family';

export type AdoptionStepId =
  | 'readiness'
  | 'commitment'
  | 'application'
  | 'evaluation'
  | 'matching'
  | 'decree'
  | 'supervision';

export type AdoptionEvaluationStatus =
  | 'not_started'
  | 'in_queue'
  | 'approved'
  | 'needs_improvements'
  | 'rejected';

export type InspectorOutcome =
  | 'great'
  | 'satisfactory'
  | 'needs_improvement'
  | 'serious_concern';

export interface AdoptionCandidateChild {
  tempId: string;
  firstName: string;
  gender: Gender;
  age: number;
  ageBracketId: string;
  avatarSeed: string;
  traits: string[];
  backgroundFa: string;
  healthNeedsFa?: string;
  bondingMeetingsDone: number;
}

export interface AdoptionSupervisionTask {
  id: string;
  titleFa: string;
  descriptionFa: string;
  costToman: number;
  completed: boolean;
}

export interface AdoptionInspectorVisit {
  id: string;
  childPersonId: string;
  childNameFa: string;
  jalaliYear: number;
  playerAge: number;
  childAge: number;
  inspectorPersonId: string;
  inspectorNameFa: string;
  inspectorAvatarSeed: string;
  outcome: InspectorOutcome;
  summaryFa: string;
  followUpRequired: boolean;
  tasks: AdoptionSupervisionTask[];
}

export interface AdoptionApplicationState {
  id: string;
  careType: AdoptionCareType;
  step: AdoptionStepId;
  startedYear: number;
  commitmentAccepted: boolean;
  pausedForReflection: boolean;
  hasInfertilityCert: boolean;
  completedDocIds: string[];
  portalSubmitted: boolean;
  queueYearsRemaining: number;
  evaluationStatus: AdoptionEvaluationStatus;
  evaluationNotesFa: string[];
  reapplyAllowedAfterYear?: number;
  matchedCandidates: AdoptionCandidateChild[];
  selectedCandidateId?: string;
  probationaryApproved: boolean;
  courtDecreeIssued: boolean;
  placedChildPersonId?: string;
  placedYear?: number;
  inspectorPersonId?: string;
  nextVisitYear?: number;
}

export interface AdoptionState {
  activeApplication: AdoptionApplicationState | null;
  pastApplicationsCount: number;
  reapplyCooldownUntilYear?: number;
  hasInfertilityCert: boolean;
  supervisionVisits: AdoptionInspectorVisit[];
  completedAdoptedCount: number;
}

export interface AdoptionCareTypeDef {
  id: AdoptionCareType;
  titleFa: string;
  subtitleFa: string;
  legalBasisFa: string;
  commitmentYearsLabelFa: string;
  minSavingsMinWageMultiple: number;
  feeMinWageMultiple: number;
  requiresIndependentHousing: boolean;
  allowsSingleWomanOnlyFemale: boolean;
  confersPermanentInheritance: boolean;
  supervisionUntilAge: number;
}

export interface AdoptionDocumentDef {
  id: string;
  titleFa: string;
  subtitleFa: string;
  feeMinWageMultiple: number;
}

export interface AdoptionChildProfileTemplate {
  id: string;
  ageBracketId: 'infant' | 'toddler' | 'school' | 'teen';
  minAge: number;
  maxAge: number;
  backgroundsFa: string[];
  optionalHealthNeedsFa: string[];
  healthNeedProbability: number;
}

export interface AdoptionDataset {
  meta: {
    titleFa: string;
    lawTitleFa: string;
    lawYearJalali: number;
    regulationsYearJalali: number;
    asOf: string;
    source: string;
    confidence: DataConfidence;
    simplified: boolean;
    religionConditionFlag: {
      enabled: boolean;
      hiddenByDefault: boolean;
      labelFa: string;
    };
    notesFa: string[];
  };
  careTypes: AdoptionCareTypeDef[];
  eligibility: {
    minApplicantAge: number;
    priorityMaxAge: number;
    minMarriageYearsNoChild: number;
    infertilityExceptionAllowed: boolean;
    singleWomanMinAge: number;
    singleWomanAllowed: boolean;
    singleWomanOnlyFemaleChild: boolean;
    maxCriminalRecord: number;
    minHealth: number;
    minMentalHealth: number;
    minSpouseCloseness: number;
    minGapYearsBelowYoungestBioChild: number;
    infertilityCheckCostMinWageMultiple: SourcedNumber;
    lifeInsuranceCommitmentMinWageMultiple: SourcedNumber;
    applicationBaseCostMinWageMultiple: SourcedNumber;
  };
  documents: AdoptionDocumentDef[];
  evaluation: {
    approvalBaseThreshold: number;
    reapplyCooldownYears: number;
    queueDelayProbability: number;
    weights: {
      housingStability: number;
      incomeStability: number;
      relationshipHealth: number;
      mentalHealth: number;
      noCriminalRecord: number;
      references: number;
    };
  };
  matching: {
    candidatesPerMatch: number;
    requiredBondingMeetings: number;
    bondingMeetingCostMinWageMultiple: number;
    ageBrackets: {
      id: 'infant' | 'toddler' | 'school' | 'teen';
      labelFa: string;
      minAge: number;
      maxAge: number;
    }[];
    childProfiles: AdoptionChildProfileTemplate[];
  };
  supervision: {
    firstVisitNextYear: boolean;
    periodicIntervalYears: number;
    endAtChildAge: number;
    outcomeWeights: {
      great: number;
      satisfactory: number;
      needs_improvement: number;
      serious_concern: number;
    };
    improvementTaskTemplates: {
      id: string;
      titleFa: string;
      descriptionFa: string;
      costMinWageMultiple: number;
    }[];
  };
  longTermEvents: EventDefinition[];
  challengePack: {
    id: string;
    titleFa: string;
    subtitleFa: string;
    descriptionFa: string;
    ageOutGrantMinWageMultiple: SourcedNumber;
    mentorTitlesFa: string[];
    earlyLifeMilestones: {
      age: number;
      titleFa: string;
      textFa: string;
    }[];
  };
}



