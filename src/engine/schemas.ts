import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 7;

export const GenderSchema = z.enum(['male', 'female']);

export const EthnicitySchema = z.enum([
  'persian',
  'azeri',
  'kurdish',
  'lur',
  'gilaki',
  'mazani',
  'baluch',
  'arab',
  'turkmen',
]);

export const SocialClassSchema = z.enum(['poor', 'middle', 'upper_middle', 'wealthy']);

export const EducationLevelSchema = z.enum([
  'none',
  'preschool',
  'elementary',
  'middle_school',
  'high_school',
  'diploma',
  'associate',
  'bachelor',
  'master',
  'phd',
  'medical_doctor',
]);

export const HighSchoolTrackSchema = z.enum(['math', 'science', 'humanities', 'vocational']);

export const UniversityTierSchema = z.enum([
  'state_top',
  'state',
  'azad',
  'payam_noor',
  'applied_science',
]);

export const MilitaryStatusSchema = z.enum([
  'not_applicable',
  'pending',
  'serving',
  'completed',
  'exempt_medical',
  'exempt_breadwinner',
  'exempt_educational',
  'bought_out',
]);

export const MaritalStatusSchema = z.enum(['single', 'engaged', 'married', 'divorced', 'widowed']);

export const HousingTypeSchema = z.enum(['with_family', 'dorm', 'rent', 'owned', 'villa']);

export const RelationshipRoleSchema = z.enum([
  'father',
  'mother',
  'sibling',
  'friend',
  'partner',
  'spouse',
  'child',
  'grandchild',
  'niece_nephew',
  'cousin',
  'ancestor',
]);

export const AssetTypeSchema = z.enum([
  'usd',
  'gold',
  'coin',
  'stock',
  'crypto',
  'real_estate',
  'car',
]);

export const ContentTagSchema = z.enum(['mild', 'crime', 'substance', 'romance', 'social']);

export const BoundedStatSchema = z.number().min(0).max(100);

export const PlayerStatsSchema = z.object({
  health: BoundedStatSchema,
  happiness: BoundedStatSchema,
  intelligence: BoundedStatSchema,
  looks: BoundedStatSchema,
  fame: BoundedStatSchema,
  mentalHealth: BoundedStatSchema,
});

export const HiddenStatsSchema = z.object({
  luck: BoundedStatSchema,
  talent: BoundedStatSchema,
  conscientiousness: BoundedStatSchema,
  riskAppetite: BoundedStatSchema,
});

export const EducationStateSchema = z.object({
  level: EducationLevelSchema,
  inSchool: z.boolean(),
  yearsInCurrentStage: z.number().int().min(0),
  schoolType: z.enum(['public', 'private', 'sampad']),
  highSchoolTrack: HighSchoolTrackSchema.optional(),
  universityTier: UniversityTierSchema.optional(),
  major: z.string().optional(),
  konkurRank: z.number().int().positive().optional(),
  gpa: z.number().min(0).max(20),
});

export const JobStateSchema = z.object({
  jobId: z.string().min(1),
  title: z.string().min(1),
  track: z.string().min(1),
  level: z.number().int().min(1),
  annualSalaryToman: z.number().min(0),
  stress: BoundedStatSchema,
  yearsInJob: z.number().int().min(0),
});

export const HousingStateSchema = z.object({
  type: HousingTypeSchema,
  cityId: z.string().min(1),
  monthlyRentToman: z.number().min(0),
  depositRahnToman: z.number().min(0),
  propertyValueToman: z.number().min(0),
});

export const TalentIdSchema = z.enum([
  'singing',
  'music_instrument',
  'acting',
  'athletics',
  'visual_art',
  'writing',
  'comedy',
  'math_science',
  'programming_tech',
  'business_sense',
  'leadership',
  'cooking',
  'mechanical',
]);

export const AthleticDisciplineSchema = z.enum([
  'football',
  'wrestling',
  'volleyball',
  'taekwondo',
  'weightlifting',
  'swimming',
  'running',
]);

export const TalentTierSchema = z.enum([
  'curiosity',
  'interest',
  'clear_talent',
  'brilliant_talent',
]);

export const HiddenTalentsSchema = z.object({
  singing: BoundedStatSchema,
  music_instrument: BoundedStatSchema,
  acting: BoundedStatSchema,
  athletics: BoundedStatSchema,
  visual_art: BoundedStatSchema,
  writing: BoundedStatSchema,
  comedy: BoundedStatSchema,
  math_science: BoundedStatSchema,
  programming_tech: BoundedStatSchema,
  business_sense: BoundedStatSchema,
  leadership: BoundedStatSchema,
  cooking: BoundedStatSchema,
  mechanical: BoundedStatSchema,
});

export const DiscoveredTalentSchema = z.object({
  talentId: TalentIdSchema,
  tier: TalentTierSchema,
  discoveredAge: z.number().int().min(0).max(130),
  hintTextFa: z.string().min(1),
  athleticDiscipline: AthleticDisciplineSchema.optional(),
});

export const TalentSkillStateSchema = z.object({
  skill: BoundedStatSchema,
  practiceCount: z.number().int().min(0),
  opportunityScore: BoundedStatSchema,
  auditionFailures: z.number().int().min(0),
  careerStage: z.number().int().min(0).max(4),
  activeRoute: z.enum(['mainstream', 'online', 'teaching_studio', 'abroad']).optional(),
});

export const PlayerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: GenderSchema,
  ethnicity: EthnicitySchema,
  birthCityId: z.string().min(1),
  currentCityId: z.string().min(1),
  countryId: z.string().min(1),
  socialClass: SocialClassSchema,
  age: z.number().int().min(0).max(130),
  stats: PlayerStatsSchema,
  hiddenStats: HiddenStatsSchema,
  hiddenTalents: HiddenTalentsSchema,
  athleticDiscipline: AthleticDisciplineSchema,
  discoveredTalents: z.array(DiscoveredTalentSchema),
  talentSkills: z.record(z.string(), TalentSkillStateSchema),
  moneyToman: z.number().finite(),
  debtToman: z.number().min(0).finite(),
  education: EducationStateSchema,
  job: JobStateSchema.nullable(),
  licenses: z.array(z.string().min(1)).default([]),
  militaryStatus: MilitaryStatusSchema,
  maritalStatus: MaritalStatusSchema,
  criminalRecord: z.number().int().min(0),
  housing: HousingStateSchema,
  avatarSeed: z.string().min(1).optional(),
  startingScenarioId: z.enum(['standard', 'welfare_center']).optional(),
  raisedInWelfareCenter: z.boolean().optional(),
});

export const PersonOriginKindSchema = z.enum([
  'biological',
  'adopted',
  'temporary_guardian',
  'host_family',
  'inspector',
  'mentor',
]);

export const AdoptionCareTypeSchema = z.enum([
  'permanent',
  'temporary_guardian',
  'host_family',
]);

export const PersonAdoptionMetaSchema = z.object({
  careType: AdoptionCareTypeSchema,
  placedYear: z.number().int().min(1200).max(1700),
  placedAtChildAge: z.number().int().min(0).max(25),
  biologicalOriginKnown: z.boolean(),
  backgroundFa: z.string().min(1),
  healthNeedsFa: z.string().min(1).optional(),
  supervisionClosedAt18: z.boolean().optional(),
});

export const PersonSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: GenderSchema,
  age: z.number().int().min(0).max(130),
  traits: z.array(z.string().min(1)),
  jobTitle: z.string().min(1),
  isAlive: z.boolean(),
  generation: z.number().int().min(1).optional(),
  parentIds: z.array(z.string().min(1)).optional(),
  spouseId: z.string().min(1).optional(),
  birthYear: z.number().int().min(1200).max(1700).optional(),
  deathYear: z.number().int().min(1200).max(1700).optional(),
  maritalStatus: MaritalStatusSchema.optional(),
  avatarSeed: z.string().min(1).optional(),
  originKind: PersonOriginKindSchema.optional(),
  adoptionMeta: PersonAdoptionMetaSchema.optional(),
});

export const RelationshipSchema = z.object({
  personId: z.string().min(1),
  role: RelationshipRoleSchema,
  closeness: BoundedStatSchema,
  respect: BoundedStatSchema,
  romance: BoundedStatSchema,
});

export const AssetSchema = z.object({
  id: z.string().min(1),
  type: AssetTypeSchema,
  name: z.string().min(1),
  quantity: z.number().min(0).finite(),
  purchasePriceToman: z.number().min(0).finite(),
  currentValueToman: z.number().min(0).finite(),
});

export const LoanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  principalRemainingToman: z.number().min(0).finite(),
  annualInterestRate: z.number().min(0).max(5).finite(),
  annualPaymentToman: z.number().min(0).finite(),
  yearsRemaining: z.number().int().min(0),
});

export const ScheduledEventSchema = z.object({
  eventId: z.string().min(1),
  triggerAtAge: z.number().int().min(0),
  sourceFlag: z.string().optional(),
});

export const TimelineEntrySchema = z.object({
  id: z.string().min(1),
  age: z.number().int().min(0),
  jalaliYear: z.number().int().min(1200).max(1700),
  title: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(['birth', 'life', 'event', 'milestone', 'death']),
  statChanges: z.record(z.string(), z.number().finite()).optional(),
});

export const ContentSettingsSchema = z.object({
  allowCrime: z.boolean(),
  allowSubstance: z.boolean(),
  allowRomance: z.boolean(),
  allowSocialPolitical: z.boolean(),
});

export const DeathSummarySchema = z.object({
  ageAtDeath: z.number().int().min(0),
  jalaliYearOfDeath: z.number().int().min(1200),
  causeOfDeath: z.string().min(1),
  finalNetWorthToman: z.number().finite(),
  lifeScore: z.number().int().min(0),
  legacyTitle: z.string().min(1),
  highlights: z.array(z.string()),
});

export const BusinessAcquisitionModeSchema = z.enum([
  'start_scratch',
  'buy_existing',
  'partnership',
  'family_takeover',
  'franchise',
  'employer_offer',
  'inheritance',
]);

export const BusinessFinancingModeSchema = z.enum(['personal_cash', 'bank_loan', 'partner_split']);
export const BusinessSizeSchema = z.enum(['small', 'medium', 'large']);
export const BusinessPriceStrategySchema = z.enum(['discount', 'standard', 'premium']);

export const BusinessStaffMemberSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  roleTitleFa: z.string().min(1),
  level: z.number().int().min(1).max(3),
  yearsEmployed: z.number().int().min(0),
  skill: BoundedStatSchema,
  morale: BoundedStatSchema,
  annualWageToman: z.number().min(0).finite(),
});

export const OwnedBusinessStateSchema = z.object({
  id: z.string().min(1),
  businessTypeId: z.string().min(1),
  nameFa: z.string().min(1),
  acquisitionMode: BusinessAcquisitionModeSchema,
  cityId: z.string().min(1),
  regionTier: z.enum(['north', 'mid', 'south']),
  size: BusinessSizeSchema,
  foundedYear: z.number().int().min(1250).max(1700),
  yearsOperating: z.number().int().min(0),
  ownershipShare: z.number().gt(0).max(1),
  partnerName: z.string().min(1).optional(),
  partnerCloseness: BoundedStatSchema.optional(),
  isFranchise: z.boolean(),
  depositLockedToman: z.number().min(0).finite(),
  monthlyRentToman: z.number().min(0).finite(),
  equipmentValueToman: z.number().min(0).finite(),
  cashReserveToman: z.number().finite(),
  branchCount: z.number().int().min(1),
  priceStrategy: BusinessPriceStrategySchema,
  reputation: BoundedStatSchema,
  customerBase: z.number().min(0).max(500).finite(),
  renovationYearsLeft: z.number().int().min(0),
  marketingYearsLeft: z.number().int().min(0),
  consecutiveLossYears: z.number().int().min(0),
  lastYearRevenueToman: z.number().min(0).finite(),
  lastYearCostsToman: z.object({
    rent: z.number().min(0).finite(),
    staff: z.number().min(0).finite(),
    supplies: z.number().min(0).finite(),
    taxesAndFees: z.number().min(0).finite(),
    royalty: z.number().min(0).finite(),
  }),
  lastYearProfitToman: z.number().finite(),
  cumulativeProfitToman: z.number().finite(),
  staff: z.array(BusinessStaffMemberSchema),
});

export const BusinessHistoryEntrySchema = z.object({
  id: z.string().min(1),
  businessTypeId: z.string().min(1),
  nameFa: z.string().min(1),
  acquisitionMode: BusinessAcquisitionModeSchema,
  startYear: z.number().int().min(1250).max(1700),
  endYear: z.number().int().min(1250).max(1700),
  outcome: z.enum(['sold', 'closed', 'bankrupt']),
  netResultToman: z.number().finite(),
});

export const WillBeneficiarySchema = z.object({
  id: z.string().min(1),
  targetType: z.enum(['spouse', 'child', 'sibling', 'friend', 'charity_endowment']),
  personId: z.string().min(1).optional(),
  labelFa: z.string().min(1),
  sharePercent: z.number().min(0).max(100),
});

export const WillConfigSchema = z.object({
  updatedAtAge: z.number().int().min(0).max(130),
  updatedAtYear: z.number().int().min(1250).max(1700),
  divisionPreference: z.enum(['civil_code', 'equal_if_consented']),
  charityPercent: z.number().min(0).max(100),
  beneficiaries: z.array(WillBeneficiarySchema),
  specificItems: z.object({
    homeRecipientId: z.string().min(1).optional(),
    businessRecipientId: z.string().min(1).optional(),
    vehicleRecipientId: z.string().min(1).optional(),
  }),
  letterToHeirsFa: z.string().max(800),
});

export const LifeChapterSummarySchema = z.object({
  generation: z.number().int().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: GenderSchema,
  birthYear: z.number().int().min(1200).max(1700),
  deathYear: z.number().int().min(1200).max(1700),
  ageAtDeath: z.number().int().min(0).max(130),
  cityNameFa: z.string().min(1),
  causeOfDeath: z.string().min(1),
  highestJobTitleFa: z.string().min(1),
  finalNetWorthToman: z.number().finite(),
  real1405NetWorthToman: z.number().finite(),
  lifeScore: z.number().int().min(0),
  legacyTitle: z.string().min(1),
  inheritedFromNameFa: z.string().min(1).optional(),
  relationshipToPrevFa: z.string().min(1).optional(),
  educationLevel: EducationLevelSchema.optional(),
  didEmigrate: z.boolean().optional(),
  charityContributionToman: z.number().min(0).finite().optional(),
  fameAtDeath: BoundedStatSchema.optional(),
  summaryFa: z.string().min(1).optional(),
});

export const DynastyWealthPointSchema = z.object({
  year: z.number().int().min(1200).max(1700),
  generation: z.number().int().min(1),
  nominalToman: z.number().finite(),
  real1405Toman: z.number().finite(),
  labelFa: z.string().min(1),
});

export const DynastyHallOfFameEntrySchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  generation: z.number().int().min(1),
  lifeScore: z.number().int().min(0),
  real1405NetWorthToman: z.number().finite(),
  ageAtDeath: z.number().int().min(0).max(130),
  legacyTitle: z.string().min(1),
  jalaliSpanFa: z.string().min(1),
});

export const DynastyStateSchema = z.object({
  dynastyNameFa: z.string().min(1),
  founderNameFa: z.string().min(1),
  worldSeed: z.string().min(1),
  currentGeneration: z.number().int().min(1),
  totalGenerationsLived: z.number().int().min(0),
  familyReputation: BoundedStatSchema,
  dynastyScore: z.number().int().min(0),
  unlockedDynastyRibbons: z.array(z.string().min(1)),
  chapters: z.array(LifeChapterSummarySchema),
  wealthTimeline: z.array(DynastyWealthPointSchema),
  hallOfFame: z.array(DynastyHallOfFameEntrySchema),
  charityEndowmentTotalToman: z.number().min(0).finite(),
  charityFoundationNameFa: z.string().min(1).optional(),
  ancestorMemoriesFa: z.array(z.string().min(1)),
  isClosed: z.boolean().optional(),
});

export const AdoptionStepIdSchema = z.enum([
  'readiness',
  'commitment',
  'application',
  'evaluation',
  'matching',
  'decree',
  'supervision',
]);

export const AdoptionEvaluationStatusSchema = z.enum([
  'not_started',
  'in_queue',
  'approved',
  'needs_improvements',
  'rejected',
]);

export const InspectorOutcomeSchema = z.enum([
  'great',
  'satisfactory',
  'needs_improvement',
  'serious_concern',
]);

export const AdoptionCandidateChildSchema = z.object({
  tempId: z.string().min(1),
  firstName: z.string().min(1),
  gender: GenderSchema,
  age: z.number().int().min(0).max(17),
  ageBracketId: z.string().min(1),
  avatarSeed: z.string().min(1),
  traits: z.array(z.string().min(1)),
  backgroundFa: z.string().min(1),
  healthNeedsFa: z.string().min(1).optional(),
  bondingMeetingsDone: z.number().int().min(0),
});

export const AdoptionSupervisionTaskSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  descriptionFa: z.string().min(1),
  costToman: z.number().min(0).finite(),
  completed: z.boolean(),
});

export const AdoptionInspectorVisitSchema = z.object({
  id: z.string().min(1),
  childPersonId: z.string().min(1),
  childNameFa: z.string().min(1),
  jalaliYear: z.number().int().min(1200).max(1700),
  playerAge: z.number().int().min(18).max(130),
  childAge: z.number().int().min(0).max(25),
  inspectorPersonId: z.string().min(1),
  inspectorNameFa: z.string().min(1),
  inspectorAvatarSeed: z.string().min(1),
  outcome: InspectorOutcomeSchema,
  summaryFa: z.string().min(1),
  followUpRequired: z.boolean(),
  tasks: z.array(AdoptionSupervisionTaskSchema),
});

export const AdoptionApplicationStateSchema = z.object({
  id: z.string().min(1),
  careType: AdoptionCareTypeSchema,
  step: AdoptionStepIdSchema,
  startedYear: z.number().int().min(1200).max(1700),
  commitmentAccepted: z.boolean(),
  pausedForReflection: z.boolean(),
  hasInfertilityCert: z.boolean(),
  completedDocIds: z.array(z.string().min(1)),
  portalSubmitted: z.boolean(),
  queueYearsRemaining: z.number().int().min(0),
  evaluationStatus: AdoptionEvaluationStatusSchema,
  evaluationNotesFa: z.array(z.string().min(1)),
  reapplyAllowedAfterYear: z.number().int().min(1200).max(1700).optional(),
  matchedCandidates: z.array(AdoptionCandidateChildSchema),
  selectedCandidateId: z.string().min(1).optional(),
  probationaryApproved: z.boolean(),
  courtDecreeIssued: z.boolean(),
  placedChildPersonId: z.string().min(1).optional(),
  placedYear: z.number().int().min(1200).max(1700).optional(),
  inspectorPersonId: z.string().min(1).optional(),
  nextVisitYear: z.number().int().min(1200).max(1700).optional(),
});

export const AdoptionStateSchema = z.object({
  activeApplication: AdoptionApplicationStateSchema.nullable(),
  pastApplicationsCount: z.number().int().min(0),
  reapplyCooldownUntilYear: z.number().int().min(1200).max(1700).optional(),
  hasInfertilityCert: z.boolean(),
  supervisionVisits: z.array(AdoptionInspectorVisitSchema),
  completedAdoptedCount: z.number().int().min(0),
});

export const JobCompassPrioritiesSchema = z.object({
  income: z.number().int().min(0).max(3),
  calm: z.number().int().min(0).max(3),
  security: z.number().int().min(0).max(3),
  growth: z.number().int().min(0).max(3),
  freedom: z.number().int().min(0).max(3),
});

export const WaitlistedJobSchema = z.object({
  jobId: z.string().min(1),
  appliedTurn: z.number().int().min(0),
  appliedYear: z.number().int().min(1250).max(1700),
  interviewBonusPct: z.number().min(-25).max(25),
});

export const JobCompassStateSchema = z.object({
  priorities: JobCompassPrioritiesSchema,
  prioritiesCustomized: z.boolean(),
  shortlistedJobIds: z.array(z.string().min(1)),
  pinnedJobId: z.string().min(1).nullable(),
  salaryUnit: z.enum(['monthly', 'annual']),
  waitlistedJobs: z.array(WaitlistedJobSchema),
});

export const GameStateSchema = z.object({
  turn: z.number().int().min(0),
  birthJalaliYear: z.number().int().min(1250).max(1700),
  currentJalaliYear: z.number().int().min(1250).max(1700),
  worldSeed: z.string().min(1).optional(),
  inflationMultiplier: z.number().positive().finite(),
  lastInflationRate: z.number().min(-0.5).max(5).finite(),
  player: PlayerSchema,
  npcs: z.record(z.string(), PersonSchema),
  relationships: z.array(RelationshipSchema),
  assets: z.array(AssetSchema),
  loans: z.array(LoanSchema),
  ownedBusiness: OwnedBusinessStateSchema.nullable().default(null),
  businessHistory: z.array(BusinessHistoryEntrySchema).default([]),
  flags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  eventHistory: z.record(z.string(), z.number().int().min(0)),
  scheduledEvents: z.array(ScheduledEventSchema),
  timeline: z.array(TimelineEntrySchema),
  unlockedAchievements: z.array(z.string()),
  isAlive: z.boolean(),
  horizonEnded: z.boolean().optional(),
  deathSummary: DeathSummarySchema.nullable(),
  will: WillConfigSchema.nullable().optional(),
  dynasty: DynastyStateSchema.optional(),
  adoption: AdoptionStateSchema.optional(),
  jobCompass: JobCompassStateSchema.optional(),
  displayCurrencyMode: z.enum(['local', 'IRT', 'USD']).optional(),
  fxState: z.lazy(() => FxStateSchema).optional(),
  ledger: z.lazy(() => LedgerStateSchema).optional(),
  emigration: z.lazy(() => EmigrationStateSchema).optional(),
  countryMacros: z.record(z.string(), z.lazy(() => CountryRuntimeMacroStateSchema)).optional(),
  activityState: z.lazy(() => PlayerActivityRuntimeStateSchema).optional(),
});

export const SaveGameSchema = z.object({
  schemaVersion: z.number().int().min(1),
  slotId: z.string().min(1),
  seed: z.string().min(1),
  rngState: z.number().int(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  contentSettings: ContentSettingsSchema,
  state: GameStateSchema,
});

// Content JSON Schemas
export const CitySchema = z.object({
  id: z.string().min(1),
  nameFa: z.string().min(1),
  provinceFa: z.string().min(1),
  isVillage: z.boolean(),
  populationWeight: z.number().positive(),
  costOfLivingIndex: z.number().min(0.3).max(3),
  jobOpportunityIndex: z.number().min(0.2).max(2),
  climateFa: z.string().min(1),
  dialectFa: z.string().min(1),
  primaryEthnicities: z.array(EthnicitySchema).min(1),
});

export const CitiesFileSchema = z.array(CitySchema).min(5);

export const EthnicityNamesSchema = z.object({
  labelFa: z.string().min(1),
  maleFirstNames: z.array(z.string().min(1)).min(3),
  femaleFirstNames: z.array(z.string().min(1)).min(3),
  lastNames: z.array(z.string().min(1)).min(3),
});

export const NamesFileSchema = z.object({
  ethnicities: z.record(EthnicitySchema, EthnicityNamesSchema),
});

export const JobLadderStepSchema = z
  .object({
    level: z.number().int().min(1),
    titleFa: z.string().min(1),
    salaryMultiplier: z.number().positive(),
    minYearsInRole: z.number().int().min(0),
    minTotalExperience: z.number().int().min(0),
    minSkillLevel: z.number().int().min(0).max(5),
    minPerformance: z.number().int().min(0).max(100),
    requiredCredential: z.string().min(1).optional(),
    promotionBaseChance: z.number().min(0).max(1),
    requiresConnections: z.boolean().optional(),
    ceiling: z.boolean(),
  })
  .strict();

export const JobOwnershipPathSchema = z
  .object({
    allowed: z.boolean(),
    businessTypeId: z.string().min(1).optional(),
    titleFa: z.string().min(1).optional(),
    minAge: z.number().int().min(18).max(90),
    minSkillLevel: z.number().int().min(0).max(5),
    minYearsExperience: z.number().int().min(0),
    requiredLicenses: z.array(z.string().min(1)),
    capitalMinWageMultiple: z
      .object({
        min: z.number().min(0),
        max: z.number().min(0),
      })
      .refine((c) => c.max >= c.min, {
        message: 'capitalMinWageMultiple max must be >= min',
      }),
    financingOptions: z.array(BusinessFinancingModeSchema),
    riskLevel: z.enum(['کم', 'متوسط', 'زیاد']),
    franchiseAvailable: z.boolean().optional(),
    employerOfferEligible: z.boolean().optional(),
    notesFa: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (val.allowed && !val.businessTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Allowed ownershipPath must define businessTypeId',
      });
    }
  });

export const JobCompassAxisSchema = z.enum(['income', 'calm', 'security', 'growth', 'freedom']);

export const JobIconKeySchema = z.enum([
  'taxi',
  'scissors',
  'bazaar',
  'code',
  'chalkboard',
  'desk',
  'heartPulse',
  'stethoscope',
  'mortar',
  'scales',
]);

export const JobTagSchema = z.object({
  icon: z.string().min(1),
  labelFa: z.string().min(1).max(20),
});

export const JobFingerprintSchema = z.object({
  income: BoundedStatSchema,
  calm: BoundedStatSchema,
  security: BoundedStatSchema,
  growth: BoundedStatSchema,
  freedom: BoundedStatSchema,
  isEstimate: z.boolean(),
  estimatedAxes: z.array(JobCompassAxisSchema),
  notesFa: z.string().min(1).optional(),
});

export const JobDaySceneSchema = z.object({
  timeFa: z.string().min(1).max(16),
  emoji: z.string().min(1),
  textFa: z.string().min(1).max(200),
});

export const JobDefinitionSchema = z
  .object({
    id: z.string().min(1),
    titleFa: z.string().min(1),
    shortTitle: z.string().min(1).max(18),
    tagline: z.string().min(1).max(36).optional(),
    iconKey: JobIconKeySchema,
    tags: z.array(JobTagSchema).min(1).max(3),
    weeklyHours: z.number().int().min(10).max(84),
    fingerprint: JobFingerprintSchema,
    longDescription: z.string().min(1).max(400),
    dayInLife: z.array(JobDaySceneSchema).length(3),
    pros: z.array(z.string().min(1)).min(1).max(3),
    cons: z.array(z.string().min(1)).min(1).max(3),
    realityCheckFa: z.string().min(1).max(300),
    requirementIds: z.array(z.string().min(1)).min(1),
    track: z.string().min(1),
    employerType: z.enum(['دولتی', 'خصوصی', 'آزاد', 'خانوادگی']).optional(),
    minEducation: EducationLevelSchema,
    requiredLicenseId: z.string().min(1).optional(),
    entryExamRequired: z.boolean().optional(),
    noPromotions: z.boolean().optional(),
    baseAnnualSalaryToman: z.number().positive(),
    stress: BoundedStatSchema,
    baseSuccessChance: z.number().min(0.05).max(1).optional(),
    requiredSkillId: z.string().min(1).optional(),
    ladder: z.array(JobLadderStepSchema).min(1),
    ownershipPath: JobOwnershipPathSchema,
  })
  .superRefine((job, ctx) => {
    job.ladder.forEach((step, idx) => {
      if (step.level !== idx + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Job "${job.id}" ladder step at index ${idx} must have level ${idx + 1}`,
        });
      }
      if ('grantsOwnership' in (step as Record<string, unknown>)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Job "${job.id}" ladder step "${step.titleFa}" must NOT contain grantsOwnership`,
        });
      }
      const isLast = idx === job.ladder.length - 1;
      if (isLast && !step.ceiling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Job "${job.id}" final ladder step "${step.titleFa}" must have ceiling: true`,
        });
      }
      if (!isLast && step.ceiling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Job "${job.id}" non-final ladder step "${step.titleFa}" cannot have ceiling: true`,
        });
      }
    });
    if (job.noPromotions && job.ladder.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Job "${job.id}" with noPromotions: true must have exactly 1 ladder step`,
      });
    }
  });

export const JobsFileSchema = z.array(JobDefinitionSchema).min(5);

export const InterviewAnswerSchema = z.object({
  id: z.string().min(1),
  style: z.enum(['honest', 'ambitious', 'humble']),
  styleLabelFa: z.string().min(1),
  labelFa: z.string().min(1),
  chanceDeltaPct: z.number().min(-15).max(15),
  reactionFa: z.string().min(1),
  axisAffinity: JobCompassAxisSchema.optional(),
});

export const InterviewQuestionSchema = z.object({
  id: z.string().min(1),
  promptFa: z.string().min(1),
  answers: z.array(InterviewAnswerSchema).length(3),
});

export const InterviewsFileSchema = z.object({
  meta: z.object({
    titleFa: z.string().min(1),
    asOf: z.string().min(1),
    source: z.string().min(1),
    confidence: z.enum(['verified', 'estimate']),
  }),
  generalQuestions: z.array(InterviewQuestionSchema).min(2),
  byJobId: z.record(z.string(), z.array(InterviewQuestionSchema).min(1)),
});

export const LicenseDefinitionSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  issuerFa: z.string().min(1),
  minAge: z.number().int().min(18).max(80),
  minEducation: EducationLevelSchema,
  requiredSkillId: z.string().min(1).optional(),
  minSkillLevel: z.number().int().min(0).max(5).optional(),
  feeMinWageMultiple: z.number().min(0),
  examRequired: z.boolean(),
  examMinIntelligence: z.number().int().min(0).max(100).optional(),
  descriptionFa: z.string().min(1),
});

export const BusinessTypeDefinitionSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  categoryFa: z.string().min(1),
  relatedJobIds: z.array(z.string().min(1)),
  requiredLicenses: z.array(z.string().min(1)),
  minAge: z.number().int().min(18).max(80),
  requiredSkillId: z.string().min(1).optional(),
  minSkillLevel: z.number().int().min(0).max(5),
  minYearsExperience: z.number().int().min(0),
  commercialDepositFactorOfResidential: z.number().positive(),
  commercialMonthlyRentFactorOfResidential: z.number().positive(),
  equipmentMinWageMultiple: z.number().min(0),
  initialStockMinWageMultiple: z.number().min(0),
  licenseCostMinWageMultiple: z.number().min(0),
  baseAnnualRevenueMultipleOfCapital: z.number().positive(),
  grossMarginMin: z.number().min(-0.3).max(0.9),
  grossMarginMax: z.number().min(0.05).max(0.95),
  staffWageMinWageMultiple: z.number().positive(),
  defaultStaffCount: z.number().int().min(0).max(20),
  maxStaffCount: z.number().int().min(0).max(50),
  staffRolesFa: z.array(z.string().min(1)).min(1),
  annualFailureBaseRisk: z.number().min(0.01).max(0.5),
  recessionSensitivity: z.number().min(0.1).max(2.5),
  inflationPassThrough: z.number().min(0.2).max(1.3),
  franchiseAvailable: z.boolean(),
  franchiseFeeMultiplier: z.number().min(0),
  franchiseRiskReduction: z.number().min(0).max(0.6),
  familyTradeKeywords: z.array(z.string().min(1)),
  notesFa: z.string().min(1),
});

export const BusinessesCatalogFileSchema = z.object({
  licenses: z.array(LicenseDefinitionSchema).min(4),
  businesses: z.array(BusinessTypeDefinitionSchema).min(5),
});

export const CountryDefinitionSchema = z.object({
  id: z.string().min(1),
  nameFa: z.string().min(1),
  isIran: z.boolean(),
  costOfLivingIndex: z.number().positive(),
  baseMigrationCostToman: z.number().min(0),
  difficulty: z.number().min(0).max(1),
  paths: z.array(z.enum(['study', 'work', 'investment'])),
});

export const CountriesFileSchema = z.array(CountryDefinitionSchema).min(2);

export const AchievementDefinitionSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  descriptionFa: z.string().min(1),
  category: z.string().min(1),
});

export const AchievementsFileSchema = z.array(AchievementDefinitionSchema).min(3);

export const EventConditionSchema = z.object({
  minAge: z.number().int().min(0).optional(),
  maxAge: z.number().int().max(130).optional(),
  gender: GenderSchema.optional(),
  cities: z.array(z.string().min(1)).optional(),
  socialClasses: z.array(SocialClassSchema).optional(),
  minStats: PlayerStatsSchema.partial().optional(),
  maxStats: PlayerStatsSchema.partial().optional(),
  requiredFlags: z.array(z.string().min(1)).optional(),
  forbiddenFlags: z.array(z.string().min(1)).optional(),
  isAlive: z.boolean().optional(),
});

const StatDeltaSchema = z.object({
  health: z.number().min(-100).max(100).optional(),
  happiness: z.number().min(-100).max(100).optional(),
  intelligence: z.number().min(-100).max(100).optional(),
  looks: z.number().min(-100).max(100).optional(),
  fame: z.number().min(-100).max(100).optional(),
  mentalHealth: z.number().min(-100).max(100).optional(),
});

export const EventChoiceEffectSchema = z.object({
  stats: StatDeltaSchema.optional(),
  hiddenStats: z
    .object({
      luck: z.number().min(-100).max(100).optional(),
      talent: z.number().min(-100).max(100).optional(),
      conscientiousness: z.number().min(-100).max(100).optional(),
      riskAppetite: z.number().min(-100).max(100).optional(),
    })
    .optional(),
  moneyToman: z.number().finite().optional(),
  setFlags: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])).optional(),
  scheduleEvents: z
    .array(
      z.object({
        eventId: z.string().min(1),
        delayYears: z.number().int().min(1).max(80),
      }),
    )
    .optional(),
  resultTextFa: z.string().min(1),
});

export const EventChoiceSchema = z.object({
  id: z.string().min(1),
  labelFa: z.string().min(1),
  costToman: z.number().min(0).optional(),
  effects: EventChoiceEffectSchema,
});

export const EventDefinitionSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    'childhood',
    'teen',
    'young_adult',
    'career',
    'family',
    'economy',
    'cultural',
    'old_age',
  ]),
  calendarTheme: z.enum(['nowruz', 'yalda', 'ramadan', 'muharram', 'sizdah']).optional(),
  titleFa: z.string().min(1),
  textFa: z.string().min(1),
  contentTag: ContentTagSchema,
  weight: z.number().positive(),
  maxOccurrences: z.number().int().min(1),
  conditions: EventConditionSchema,
  choices: z.array(EventChoiceSchema).min(1).max(4),
});

export const EventsFileSchema = z.array(EventDefinitionSchema).min(1);

export const ActivityOutcomeSchema = z.object({
  id: z.string().min(1).optional(),
  weight: z.number().positive(),
  resultTextFa: z.string().min(1),
  stats: StatDeltaSchema.optional(),
  moneyToman: z.number().finite().optional(),
  criminalRecordDelta: z.number().int().optional(),
  memoryTextFa: z.string().min(1).optional(),
});

export const ActivityDefinitionSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  category: z.enum([
    'health',
    'leisure',
    'travel',
    'sport',
    'learning',
    'charity',
    'arts_talent',
    'pets',
    'social_digital',
    'business_trade',
    'legal_civic',
    'lifestyle_shop',
    'crime',
    'gambling',
  ]),
  costToman: z.number().min(0),
  cooldownYears: z.number().int().min(1),
  minAge: z.number().int().min(0),
  maxAge: z.number().int().max(130).optional(),
  effectHintFa: z.string().min(1),
  riskLabelFa: z.enum(['کم', 'متوسط', 'زیاد']),
  contentTag: ContentTagSchema,
  tags: z.array(z.string().min(1)).optional(),
  seasonTags: z.array(z.enum(['nowruz', 'yalda', 'ramadan', 'summer', 'winter'])).optional(),
  quotaCost: z.number().int().min(1).max(3).optional(),
  minIntelligence: z.number().int().min(0).max(100).optional(),
  requiredSkillId: z.string().min(1).optional(),
  outcomes: z.array(ActivityOutcomeSchema).min(1),
});

export const ActivitiesFileSchema = z.array(ActivityDefinitionSchema).min(5);

export const ShopItemSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  category: z.enum(['appliances', 'clothing', 'tech', 'travel', 'gift', 'nutrition', 'luxury']),
  basePriceToman: z.number().positive(),
  effectHintFa: z.string().min(1),
  minAge: z.number().int().min(0),
  stats: StatDeltaSchema,
  repeatable: z.boolean(),
});

export const ShopFileSchema = z.array(ShopItemSchema).min(5);

export const SkillDefinitionSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  descriptionFa: z.string().min(1),
  costToman: z.number().min(0),
  minAge: z.number().int().min(0),
  effectHintFa: z.string().min(1),
  relatedJobTracks: z.array(z.string().min(1)),
});

export const SkillsFileSchema = z.array(SkillDefinitionSchema).min(5);

export const HousingListingSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  mode: z.enum(['rent', 'buy']),
  areaSqm: z.number().positive(),
  regionTier: z.enum(['north', 'mid', 'south']).optional(),
  baseDepositRahnToman: z.number().min(0),
  baseMonthlyRentToman: z.number().min(0),
  baseBuyPriceToman: z.number().min(0),
});

export const VehicleCatalogItemSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  tier: z.enum(['iranian', 'foreign', 'luxury']),
  basePriceToman: z.number().positive(),
  annualCostToman: z.number().min(0),
  fameBonus: z.number().int().min(0),
  happinessBonus: z.number().int().min(0),
  accidentRiskLabel: z.string().min(1),
});

export const HousingFileSchema = z.object({
  housingListings: z.array(HousingListingSchema).min(2),
  vehicleCatalog: z.array(VehicleCatalogItemSchema).min(2),
});

export const I18nStringsSchema = z.record(z.string(), z.any());

export const SourcedNumberSchema = z.object({
  value: z.number().finite(),
  unit: z.string().min(1),
  asOf: z.string().min(1),
  source: z.string().min(1),
  confidence: z.enum(['verified', 'estimate']),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  note: z.string().optional(),
});

export const PositiveSourcedNumberSchema = SourcedNumberSchema.refine((d) => d.value > 0, {
  message: 'Sourced number value must be > 0',
});

export const Baseline1405Schema = z.object({
  meta: z.object({
    anchorYear: z.number().int().min(1340).max(1500),
    anchorMonth: z.string().min(1),
    currency: z.string().min(1),
  }),
  verifiedBenchmarks: z.object({
    minWageMonthly: PositiveSourcedNumberSchema,
    minWageRaise1405: SourcedNumberSchema,
    minWageRaise1405Other: SourcedNumberSchema,
    cpiYoyShahrivar1405: SourcedNumberSchema,
    usdFree: PositiveSourcedNumberSchema,
    gold18kPerGram: PositiveSourcedNumberSchema,
    emamiCoin: PositiveSourcedNumberSchema,
    tehranListingPricePerSqm: PositiveSourcedNumberSchema,
    tehranRegion1PricePerSqm: PositiveSourcedNumberSchema,
    tehranRentMidDeposit: PositiveSourcedNumberSchema,
    tehranRentMidMonthly: PositiveSourcedNumberSchema,
    tehranRentSouthDeposit: PositiveSourcedNumberSchema,
    tehranRentSouthMonthly: PositiveSourcedNumberSchema,
    snappDriverMonthlyBusy: PositiveSourcedNumberSchema,
    snappDriverMonthlyLowActivity: PositiveSourcedNumberSchema,
    snappTopDriverYearly1404: PositiveSourcedNumberSchema,
    rideHailCommission: SourcedNumberSchema,
    rideHailRunningCostMonthly: PositiveSourcedNumberSchema,
    rideHailRunningCostSampleGrossMonthly: PositiveSourcedNumberSchema,
  }),
  policyAndModel: z.object({
    listingToTransactionDiscount: SourcedNumberSchema,
    depositToMonthlyRentRate: PositiveSourcedNumberSchema,
    bankDepositAnnualRate: SourcedNumberSchema,
    socialSecurityEmployeeRate: SourcedNumberSchema,
    taxExemptionAnnualMinWageMultiple: PositiveSourcedNumberSchema,
    taxBracket1Rate: SourcedNumberSchema,
    taxBracket2MinWageMultiple: PositiveSourcedNumberSchema,
    taxBracket2Rate: SourcedNumberSchema,
    taxBracket3MinWageMultiple: PositiveSourcedNumberSchema,
    taxBracket3Rate: SourcedNumberSchema,
    referenceApartmentAreaSqm: PositiveSourcedNumberSchema,
    wealthMilestoneUsdThreshold: PositiveSourcedNumberSchema,
    wealthMilestoneAptCount: PositiveSourcedNumberSchema,
    baseAnnualLivingExpenseMinWageMultiple: PositiveSourcedNumberSchema,
    unemployedLivingSupportMinWageMultiple: PositiveSourcedNumberSchema,
    pocketMoneyPoorMinWageMultiple: SourcedNumberSchema,
    pocketMoneyMiddleMinWageMultiple: SourcedNumberSchema,
    pocketMoneyUpperMiddleMinWageMultiple: SourcedNumberSchema,
    pocketMoneyWealthyMinWageMultiple: SourcedNumberSchema,
    tutorFeeMinWageMultiple: PositiveSourcedNumberSchema,
    konkurFeeMinWageMultiple: PositiveSourcedNumberSchema,
    uniTuitionStateTopEngMinWageMultiple: PositiveSourcedNumberSchema,
    uniTuitionStateTopMedMinWageMultiple: PositiveSourcedNumberSchema,
    uniTuitionStateMinWageMultiple: PositiveSourcedNumberSchema,
    uniTuitionAzadMinWageMultiple: PositiveSourcedNumberSchema,
    uniTuitionAppliedScienceMinWageMultiple: PositiveSourcedNumberSchema,
    businessStartupCapitalMinWageMultiple: PositiveSourcedNumberSchema,
    businessInitialYieldMin: SourcedNumberSchema,
    businessInitialYieldMax: SourcedNumberSchema,
    businessRealCatchup: SourcedNumberSchema,
    militaryBuyoutMinWageMultiple: PositiveSourcedNumberSchema,
    loanPersonalMinWageMultiple: PositiveSourcedNumberSchema,
    loanPersonalRate: SourcedNumberSchema,
    loanPersonalYears: PositiveSourcedNumberSchema,
    loanHousingMinWageMultiple: PositiveSourcedNumberSchema,
    loanHousingRate: SourcedNumberSchema,
    loanHousingYears: PositiveSourcedNumberSchema,
    debtPayoffChunkMinWageMultiple: PositiveSourcedNumberSchema,
    investmentQuickTradeShare: PositiveSourcedNumberSchema,
    investmentQuickTradeMinMinWageMultiple: PositiveSourcedNumberSchema,
    investmentQuickTradeMaxMinWageMultiple: PositiveSourcedNumberSchema,
    giftMinWageMultiple: PositiveSourcedNumberSchema,
    domesticTripMinWageMultiple: PositiveSourcedNumberSchema,
    weddingMinWageMultiple: PositiveSourcedNumberSchema,
    carAnnualMaintenanceRate: SourcedNumberSchema,
    carRepairRate: SourcedNumberSchema,
    carInflationPassThrough: SourcedNumberSchema,
    retirementPensionRatio: SourcedNumberSchema,
    overtimeBonusRatio: SourcedNumberSchema,
    raiseMultiplier: SourcedNumberSchema,
    usdInflationPassThrough: SourcedNumberSchema,
    usdVolatilityMin: SourcedNumberSchema,
    usdVolatilityMax: SourcedNumberSchema,
    goldInflationPassThrough: SourcedNumberSchema,
    goldVolatilityMin: SourcedNumberSchema,
    goldVolatilityMax: SourcedNumberSchema,
    bourseInflationPassThrough: SourcedNumberSchema,
    bourseVolatilityMin: SourcedNumberSchema,
    bourseVolatilityMax: SourcedNumberSchema,
    housingInflationPassThrough: SourcedNumberSchema,
    rentInflationPassThrough: SourcedNumberSchema,
    cryptoDriftMin: SourcedNumberSchema,
    cryptoDriftMax: SourcedNumberSchema,
    familyHelpProbability: SourcedNumberSchema,
    familyHelpWealthyMinWageMultiple: PositiveSourcedNumberSchema,
    familyHelpUpperMiddleMinWageMultiple: PositiveSourcedNumberSchema,
    inheritanceWealthyMinWageMultiple: PositiveSourcedNumberSchema,
    inheritanceUpperMiddleMinWageMultiple: PositiveSourcedNumberSchema,
    inheritanceMiddleMinWageMultiple: PositiveSourcedNumberSchema,
    inheritancePoorMinWageMultiple: PositiveSourcedNumberSchema,
    scenarioLowInflationMin: SourcedNumberSchema,
    scenarioLowInflationMax: SourcedNumberSchema,
    scenarioLowWageCatchup: SourcedNumberSchema,
    scenarioMediumInflationMin: SourcedNumberSchema,
    scenarioMediumInflationMax: SourcedNumberSchema,
    scenarioMediumWageCatchup: SourcedNumberSchema,
    scenarioHighInflationMin: SourcedNumberSchema,
    scenarioHighInflationMax: SourcedNumberSchema,
    scenarioHighWageCatchup: SourcedNumberSchema,
  }),
  cityHousingMultipliers: z.record(z.string().min(1), PositiveSourcedNumberSchema),
  housingRegionMultipliers: z.object({
    north: PositiveSourcedNumberSchema,
    mid: PositiveSourcedNumberSchema,
    south: PositiveSourcedNumberSchema,
  }),
});

export const HistoricalYearPointSchema = z.object({
  year: z.number().int().min(1300).max(1500),
  inflationRate: SourcedNumberSchema,
  cpiIndex: PositiveSourcedNumberSchema,
  usdFree: PositiveSourcedNumberSchema,
  emamiCoin: PositiveSourcedNumberSchema,
  minWageMonthly: PositiveSourcedNumberSchema,
  tehranPricePerSqm: PositiveSourcedNumberSchema,
  gdpGrowth: SourcedNumberSchema.refine((d) => d.value > -0.6 && d.value < 0.6, {
    message: 'gdpGrowth ratio out of plausible range',
  }),
  unemployment: SourcedNumberSchema.refine((d) => d.value >= 0.01 && d.value <= 0.6, {
    message: 'unemployment ratio out of plausible range',
  }),
  oilExportRevenueIndex: PositiveSourcedNumberSchema,
  liquidityGrowth: SourcedNumberSchema.refine((d) => d.value > -0.3 && d.value < 2, {
    message: 'liquidityGrowth ratio out of plausible range',
  }),
  depositRate: SourcedNumberSchema.refine((d) => d.value >= 0 && d.value <= 1, {
    message: 'depositRate ratio out of plausible range',
  }),
  stockIndex: PositiveSourcedNumberSchema,
  globalGoldUSD: PositiveSourcedNumberSchema,
  globalInflation: SourcedNumberSchema.refine((d) => d.value > -0.2 && d.value < 0.5),
  globalGrowth: SourcedNumberSchema.refine((d) => d.value > -0.3 && d.value < 0.3),
  oilPriceUSD: PositiveSourcedNumberSchema,
});

export const HistoricalSeriesSchema = z.array(HistoricalYearPointSchema).min(66);

export const JobIncomeEntrySchema = z.object({
  jobId: z.string().min(1),
  confidence: z.enum(['verified', 'estimate']),
  asOf: z.string().min(1),
  source: z.string().min(1),
  monthlyIncomeMultiplierOfMinWage: z
    .object({
      p10: PositiveSourcedNumberSchema,
      median: PositiveSourcedNumberSchema,
      p90: PositiveSourcedNumberSchema,
    })
    .refine((m) => m.p10.value <= m.median.value && m.median.value <= m.p90.value, {
      message: 'Job multiplier percentiles must satisfy p10 <= median <= p90',
    }),
  commissionRate: SourcedNumberSchema.refine((c) => c.value >= 0 && c.value < 1),
  costRatioOfGross: SourcedNumberSchema.refine((c) => c.value >= 0 && c.value < 1),
  taxExempt: z.boolean(),
  tail: z
    .object({
      probability: SourcedNumberSchema.refine((p) => p.value >= 0 && p.value <= 0.1),
      yearlyCapMultiplierOfMinWage: PositiveSourcedNumberSchema,
      titleFa: z.string().min(1),
      resultTextFa: z.string().min(1),
    })
    .optional(),
});

export const JobIncomeFileSchema = z.array(JobIncomeEntrySchema).min(5);

export const TalentDefinitionSchema = z.object({
  id: TalentIdSchema,
  titleFa: z.string().min(1),
  categoryFa: z.string().min(1),
  lessonTitleFa: z.string().min(1),
  lessonCostMinWageMultiple: z.number().positive(),
  minPracticeAge: z.number().int().min(3).max(25),
  relatedSkillId: z.string().min(1).optional(),
  relatedParentJobKeywords: z.array(z.string().min(1)),
  relatedParentTraits: z.array(z.string().min(1)),
  schoolTypeBonus: z.object({
    public: z.number(),
    private: z.number(),
    sampad: z.number(),
  }),
  cityAccessBoostIds: z.array(z.string().min(1)),
  discoveryHintsFa: z.array(z.string().min(1)).min(1),
});

export const TalentsFileSchema = z.object({
  distribution: z.object({
    alpha: z.number().positive(),
    beta: z.number().positive(),
    familyBetaMultiplier: z.number().positive().max(1),
    standoutThreshold: BoundedStatSchema,
    rareThreshold: BoundedStatSchema,
  }),
  discovery: z.object({
    minAge: z.number().int().min(3),
    peakMinAge: z.number().int().min(3),
    peakMaxAge: z.number().int().min(10),
    lateBloomerMaxAge: z.number().int().min(20),
    minNaturalDiscoveryScore: BoundedStatSchema,
    maxNaturalDiscoveriesPerYear: z.number().int().min(1),
    basePeakProbability: z.number().min(0).max(1),
    baseLateBloomerProbability: z.number().min(0).max(1),
    practiceDiscoveryBonus: z.number().min(0).max(1),
  }),
  tiers: z
    .array(
      z.object({
        id: TalentTierSchema,
        minScore: BoundedStatSchema,
        maxScore: BoundedStatSchema,
        labelFa: z.string().min(1),
        descriptionFa: z.string().min(1),
      }),
    )
    .length(4),
  athleticDisciplines: z
    .array(
      z.object({
        id: AthleticDisciplineSchema,
        titleFa: z.string().min(1),
        urbanBias: z.number().positive(),
      }),
    )
    .min(5),
  talents: z.array(TalentDefinitionSchema).length(13),
});

export const SpecialCareerSchema = z.object({
  id: z.string().min(1),
  titleFa: z.string().min(1),
  requiredTalentId: TalentIdSchema,
  optionalAltTalentIds: z.array(TalentIdSchema).optional(),
  minTier: TalentTierSchema,
  minSkill: BoundedStatSchema,
  minAge: z.number().int().min(14).max(30),
  peakEndAge: z.number().int().min(20).max(80),
  maxEntryAge: z.number().int().min(20).max(90),
  baseStageSuccessRate: z.number().min(0.05).max(0.95),
  luckWeight: z.number().min(0).max(1),
  fameRequirementForStage3: BoundedStatSchema,
  stageTitlesFa: z.array(z.string().min(1)).length(4),
  monthlyIncomeMinWageMultiplier: z.object({
    stage1: z.number().positive(),
    stage2: z.number().positive(),
    stage3: z.number().positive(),
    stage4: z.number().positive(),
  }),
  tailPayout: z
    .object({
      probability: z.number().min(0).max(0.2),
      yearlyCapMultiplierOfMinWage: z.number().positive(),
      titleFa: z.string().min(1),
      resultTextFa: z.string().min(1),
    })
    .optional(),
  alternativeRoutes: z
    .array(
      z.object({
        id: z.enum(['mainstream', 'online', 'teaching_studio', 'abroad']),
        titleFa: z.string().min(1),
        noteFa: z.string().min(1),
      }),
    )
    .min(2),
  femaleMainstreamNoteFa: z.string().min(1).optional(),
  fallbackCareerFa: z.string().min(1),
  fallbackMonthlyMinWageMultiplier: z.number().positive(),
  socialEventGate: z.boolean(),
});

export const CareersSpecialFileSchema = z.array(SpecialCareerSchema).min(6);

export const InheritanceFileSchema = z.object({
  meta: z.object({
    titleFa: z.string().min(1),
    simplified: z.boolean(),
    civilCodeArticles: z.array(z.number().int().positive()).min(1),
    summaryFa: z.string().min(1),
    asOf: z.string().min(1),
    source: z.string().min(1),
  }),
  rules: z.object({
    minWillAge: z.number().int().min(18).max(90),
    seriousIllnessHealthThreshold: z.number().int().min(5).max(80),
    maxWillShareRatio: z.number().gt(0).max(0.35),
    noPersonalDebtLiabilityBeyondEstate: z.boolean(),
    settlementOrder: z.array(z.string().min(1)).length(4),
    funeralCostMinWageMultiple: PositiveSourcedNumberSchema,
    probateAndAppraisalFeeRate: SourcedNumberSchema.refine((d) => d.value >= 0 && d.value <= 0.1),
    spouseShares: z.object({
      wifeWithDescendants: z.number().gt(0).lt(1),
      wifeNoDescendants: z.number().gt(0).lt(1),
      husbandWithDescendants: z.number().gt(0).lt(1),
      husbandNoDescendants: z.number().gt(0).lt(1),
    }),
    sonToDaughterRatio: z.number().positive(),
    parentFallbackShareWhenNoChildren: z.number().gt(0).lte(1),
    maxMacroJalaliYear: z.number().int().min(1450).max(1700),
    contestation: z.object({
      baseChance: z.number().min(0).max(1),
      excessWillBonus: z.number().min(0).max(1),
      lowClosenessThreshold: z.number().int().min(0).max(100),
      lowClosenessBonus: z.number().min(0).max(1),
      upholdChanceOnExcess: z.number().min(0).max(1),
      upholdChanceOnCloseness: z.number().min(0).max(1),
    }),
    geneticsLite: z.object({
      ancestorTalentWeight: z.number().min(0).max(1),
      freshTalentWeight: z.number().min(0).max(1),
      mutationChance: z.number().min(0).max(1),
      mutationBoostRange: z.number().int().min(0).max(50),
      healthPredispositionWeight: z.number().min(0).max(1),
    }),
  }),
  legalExplanationsFa: z
    .array(
      z.object({
        articleFa: z.string().min(1),
        titleFa: z.string().min(1),
        bodyFa: z.string().min(1),
      }),
    )
    .min(2),
  dynastyRibbons: z
    .array(
      z.object({
        id: z.string().min(1),
        titleFa: z.string().min(1),
        descriptionFa: z.string().min(1),
        minGenerations: z.number().int().min(1).optional(),
        minCharityReal1405Toman: z.number().min(0).optional(),
        minPeakReal1405Toman: z.number().min(0).optional(),
        minReputation: z.number().min(0).max(100).optional(),
        minEducatedChapters: z.number().int().min(1).optional(),
        requiresEmigration: z.boolean().optional(),
      }),
    )
    .min(4),
});

export const AdoptionFileSchema = z.object({
  meta: z.object({
    titleFa: z.string().min(1),
    lawTitleFa: z.string().min(1),
    lawYearJalali: z.number().int().min(1300).max(1500),
    regulationsYearJalali: z.number().int().min(1300).max(1500),
    asOf: z.string().min(1),
    source: z.string().min(1),
    confidence: z.enum(['verified', 'estimate']),
    simplified: z.boolean(),
    religionConditionFlag: z.object({
      enabled: z.boolean(),
      hiddenByDefault: z.boolean(),
      labelFa: z.string().min(1),
    }),
    notesFa: z.array(z.string().min(1)).min(2),
  }),
  careTypes: z
    .array(
      z.object({
        id: AdoptionCareTypeSchema,
        titleFa: z.string().min(1),
        subtitleFa: z.string().min(1),
        legalBasisFa: z.string().min(1),
        commitmentYearsLabelFa: z.string().min(1),
        minSavingsMinWageMultiple: z.number().min(0),
        feeMinWageMultiple: z.number().min(0),
        requiresIndependentHousing: z.boolean(),
        allowsSingleWomanOnlyFemale: z.boolean(),
        confersPermanentInheritance: z.boolean(),
        supervisionUntilAge: z.number().int().min(1).max(25),
      }),
    )
    .length(3),
  eligibility: z.object({
    minApplicantAge: z.number().int().min(18).max(60),
    priorityMaxAge: z.number().int().min(30).max(80),
    minMarriageYearsNoChild: z.number().int().min(1).max(20),
    infertilityExceptionAllowed: z.boolean(),
    singleWomanMinAge: z.number().int().min(18).max(60),
    singleWomanAllowed: z.boolean(),
    singleWomanOnlyFemaleChild: z.boolean(),
    maxCriminalRecord: z.number().int().min(0),
    minHealth: BoundedStatSchema,
    minMentalHealth: BoundedStatSchema,
    minSpouseCloseness: BoundedStatSchema,
    minGapYearsBelowYoungestBioChild: z.number().int().min(0).max(15),
    infertilityCheckCostMinWageMultiple: PositiveSourcedNumberSchema,
    lifeInsuranceCommitmentMinWageMultiple: PositiveSourcedNumberSchema,
    applicationBaseCostMinWageMultiple: SourcedNumberSchema.refine((d) => d.value >= 0),
  }),
  documents: z
    .array(
      z.object({
        id: z.string().min(1),
        titleFa: z.string().min(1),
        subtitleFa: z.string().min(1),
        feeMinWageMultiple: z.number().min(0),
      }),
    )
    .min(4),
  evaluation: z.object({
    approvalBaseThreshold: z.number().min(20).max(95),
    reapplyCooldownYears: z.number().int().min(1).max(10),
    queueDelayProbability: z.number().min(0).max(1),
    weights: z.object({
      housingStability: z.number().min(0).max(1),
      incomeStability: z.number().min(0).max(1),
      relationshipHealth: z.number().min(0).max(1),
      mentalHealth: z.number().min(0).max(1),
      noCriminalRecord: z.number().min(0).max(1),
      references: z.number().min(0).max(1),
    }),
  }),
  matching: z.object({
    candidatesPerMatch: z.number().int().min(2).max(5),
    requiredBondingMeetings: z.number().int().min(1).max(5),
    bondingMeetingCostMinWageMultiple: z.number().min(0),
    ageBrackets: z
      .array(
        z.object({
          id: z.enum(['infant', 'toddler', 'school', 'teen']),
          labelFa: z.string().min(1),
          minAge: z.number().int().min(0).max(17),
          maxAge: z.number().int().min(0).max(17),
        }),
      )
      .length(4),
    childProfiles: z
      .array(
        z.object({
          id: z.string().min(1),
          ageBracketId: z.enum(['infant', 'toddler', 'school', 'teen']),
          minAge: z.number().int().min(0).max(17),
          maxAge: z.number().int().min(0).max(17),
          backgroundsFa: z.array(z.string().min(1)).min(2),
          optionalHealthNeedsFa: z.array(z.string().min(1)).min(1),
          healthNeedProbability: z.number().min(0).max(1),
        }),
      )
      .min(4),
  }),
  supervision: z.object({
    firstVisitNextYear: z.boolean(),
    periodicIntervalYears: z.number().int().min(1).max(5),
    endAtChildAge: z.number().int().min(18).max(21),
    outcomeWeights: z.object({
      great: z.number().min(0),
      satisfactory: z.number().min(0),
      needs_improvement: z.number().min(0),
      serious_concern: z.number().min(0),
    }),
    improvementTaskTemplates: z
      .array(
        z.object({
          id: z.string().min(1),
          titleFa: z.string().min(1),
          descriptionFa: z.string().min(1),
          costMinWageMultiple: z.number().min(0),
        }),
      )
      .min(3),
  }),
  longTermEvents: z.array(EventDefinitionSchema).min(5),
  challengePack: z.object({
    id: z.string().min(1),
    titleFa: z.string().min(1),
    subtitleFa: z.string().min(1),
    descriptionFa: z.string().min(1),
    ageOutGrantMinWageMultiple: PositiveSourcedNumberSchema,
    mentorTitlesFa: z.array(z.string().min(1)).min(2),
    earlyLifeMilestones: z
      .array(
        z.object({
          age: z.number().int().min(1).max(18),
          titleFa: z.string().min(1),
          textFa: z.string().min(1),
        }),
      )
      .min(3),
  }),
});

export const CurrencyCodeSchema = z.enum(['IRT', 'USD', 'TRY', 'EUR', 'GBP', 'CAD', 'AED']);

export const CurrencyDefinitionSchema = z.object({
  code: CurrencyCodeSchema,
  nameFa: z.string().min(1),
  shortNameFa: z.string().min(1),
  symbolFa: z.string().min(1),
  minorUnit: z.number().int().min(0).max(4),
  highInflationRisk: z.boolean(),
  annualCarryRate: SourcedNumberSchema,
  oilBeta: SourcedNumberSchema,
  globalGrowthBeta: SourcedNumberSchema,
});

export const CurrenciesFileSchema = z.array(CurrencyDefinitionSchema).min(6);

export const FxPairModelParamsSchema = z.object({
  anchor1405UnitsPerUsd: PositiveSourcedNumberSchema,
  kappa: SourcedNumberSchema,
  riskPremiumAnnual: SourcedNumberSchema,
  jumpProb: SourcedNumberSchema,
  jumpMeanLog: SourcedNumberSchema,
  jumpStdLog: SourcedNumberSchema,
  noiseStd: SourcedNumberSchema,
  spreadBps: SourcedNumberSchema,
  conversionFeePct: SourcedNumberSchema,
});

export const TransferChannelSchema = z.object({
  id: z.enum(['bank_wire', 'exchange_office', 'remittance_network']),
  titleFa: z.string().min(1),
  subtitleFa: z.string().min(1),
  feePct: SourcedNumberSchema,
  spreadBps: SourcedNumberSchema,
  minAmountUsd: SourcedNumberSchema,
  maxAmountUsd: SourcedNumberSchema,
  delayTurns: SourcedNumberSchema,
  failureRisk: SourcedNumberSchema,
  requiresBankAccount: z.boolean(),
  notesFa: z.string().min(1),
});

export const FxParamsFileSchema = z.object({
  meta: z.object({
    baseCurrency: z.literal('USD'),
    anchorYear: z.number().int().min(1340).max(1500),
    descriptionFa: z.string().min(1),
  }),
  usdPairModels: z.record(CurrencyCodeSchema, FxPairModelParamsSchema),
  transferChannels: z.array(TransferChannelSchema).min(2),
  historicalUsdRates: z
    .array(
      z.object({
        year: z.number().int().min(1340).max(1500),
        rates: z.record(CurrencyCodeSchema, PositiveSourcedNumberSchema),
      }),
    )
    .min(66),
});

export const FxYearSnapshotSchema = z.object({
  year: z.number().int().min(1250).max(1700),
  usdRates: z.record(CurrencyCodeSchema, z.number().positive().finite()),
  fairUsdRates: z.record(CurrencyCodeSchema, z.number().positive().finite()),
  goldUsdPerOz: z.number().positive().finite(),
});

export const FxStateSchema = z.object({
  usdRates: z.record(CurrencyCodeSchema, z.number().positive().finite()),
  fairUsdRates: z.record(CurrencyCodeSchema, z.number().positive().finite()),
  cumulativePriceIndices: z.record(CurrencyCodeSchema, z.number().positive().finite()),
  history: z.array(FxYearSnapshotSchema),
});

export const WalletEntrySchema = z.object({
  id: z.string().min(1),
  currencyCode: CurrencyCodeSchema,
  accountType: z.enum(['cash', 'bank', 'savings', 'foreign']),
  labelFa: z.string().min(1),
  balance: z.number().min(0).finite(),
  countryId: z.string().min(1).optional(),
});

export const ConversionRecordSchema = z.object({
  id: z.string().min(1),
  turn: z.number().int().min(0),
  jalaliYear: z.number().int().min(1250).max(1700),
  fromCurrency: CurrencyCodeSchema,
  toCurrency: CurrencyCodeSchema,
  fromAmount: z.number().min(0).finite(),
  toAmount: z.number().min(0).finite(),
  effectiveRate: z.number().positive().finite(),
  feeInFromCurrency: z.number().min(0).finite(),
  channelId: z.string().min(1).optional(),
  noteFa: z.string().min(1),
});

export const PendingTransferOrderSchema = z.object({
  id: z.string().min(1),
  createdTurn: z.number().int().min(0),
  executeAtTurn: z.number().int().min(0),
  channelId: z.enum(['bank_wire', 'exchange_office', 'remittance_network']),
  fromCurrency: CurrencyCodeSchema,
  toCurrency: CurrencyCodeSchema,
  fromAmount: z.number().positive().finite(),
  expectedToAmount: z.number().positive().finite(),
  feeInFromCurrency: z.number().min(0).finite(),
  failureRisk: z.number().min(0).max(1),
  purposeFa: z.string().min(1),
});

export const LedgerYearSnapshotSchema = z.object({
  year: z.number().int().min(1250).max(1700),
  netWorthUsd: z.number().finite(),
  netWorthToman: z.number().finite(),
  usdRateIrt: z.number().positive().finite(),
  goldUsdPerOz: z.number().positive().finite(),
  cpiIranRatio: z.number().positive().finite(),
  primaryCurrency: CurrencyCodeSchema,
  localCpiRatio: z.number().positive().finite(),
});

export const LedgerStateSchema = z.object({
  wallets: z.array(WalletEntrySchema),
  conversions: z.array(ConversionRecordSchema),
  pendingTransfers: z.array(PendingTransferOrderSchema),
  yearSnapshots: z.array(LedgerYearSnapshotSchema),
  lastErosionWarningYear: z.number().int().optional(),
});

export const CountryRegionDefSchema = z.object({
  id: z.string().min(1),
  nameFa: z.string().min(1),
  tier: z.enum(['tier1', 'tier2', 'tier3']),
  colMultiplier: z.number().positive(),
  rentMultiplier: z.number().positive(),
  jobOpportunityIndex: z.number().positive(),
});

export const CountryCredentialSpecSchema = z.object({
  recognitionFactor: z.number().gt(0).lte(1),
  needsRelicensing: z.boolean(),
  costLocal: z.number().min(0),
  durationYears: z.number().int().min(0).max(10),
  minLanguageLevel: z.number().int().min(1).max(6),
});

export const CountryMacroDefinitionSchema = z.object({
  id: z.string().min(1),
  nameFa: z.string().min(1),
  currencyCode: CurrencyCodeSchema,
  isTemplate: z.boolean(),
  opennessScore: SourcedNumberSchema,
  baseVisaDifficulty: SourcedNumberSchema,
  regions: z.array(CountryRegionDefSchema).min(2),
  macro: z.object({
    inflationRate: SourcedNumberSchema,
    policyRate: SourcedNumberSchema,
    wageGrowthRate: SourcedNumberSchema,
    unemploymentRate: SourcedNumberSchema,
    hasStatutoryMinWage: z.boolean().optional(),
    minWageMonthlyLocal: PositiveSourcedNumberSchema,
    minWageHourlyLocal: PositiveSourcedNumberSchema,
    minWageHourlyNextYearLocal: PositiveSourcedNumberSchema.optional(),
    standardMonthlyHours: z.number().int().positive(),
    housingPricePerSqmLocal: PositiveSourcedNumberSchema,
    monthlyRentSingleBaseLocal: PositiveSourcedNumberSchema,
    costOfLivingMonthlySingleLocal: PositiveSourcedNumberSchema,
    oilShockBeta: SourcedNumberSchema,
    globalGrowthBeta: SourcedNumberSchema,
    verifiedAnchorNoteFa: z.string().min(1),
  }),
  taxAndBenefits: z.object({
    socialSecurityEmployeeRate: SourcedNumberSchema,
    healthInsuranceMonthlyLocal: SourcedNumberSchema,
    taxBrackets: z
      .array(z.object({ upToMultipleOfMinWage: z.number().positive(), rate: z.number().min(0).max(0.75) }))
      .min(1),
    unemploymentBenefitRatio: z.number().min(0).max(1),
    unemploymentEligibleMonthsWorked: z.number().int().min(0),
    pensionContributionRatio: z.number().min(0).max(0.5),
  }),
  visaRules: z.object({
    studentWorkHoursPerWeek: z.number().int().min(0).max(45),
    employerTiedWorkPermit: z.boolean(),
    jobLossGraceMonths: z.number().int().min(1).max(12),
    investorMinLocalAmount: z.number().positive(),
    proofOfFundsMonths: z.number().int().min(1).max(24),
  }),
  credentials: z.object({
    medicine: CountryCredentialSpecSchema,
    law: CountryCredentialSpecSchema,
    pharmacy: CountryCredentialSpecSchema,
    education: CountryCredentialSpecSchema,
    engineering: CountryCredentialSpecSchema,
    general: CountryCredentialSpecSchema,
  }),
  integrationCurve: z.object({
    initialPenaltyRatio: z.number().min(0).max(0.6),
    yearsToConverge: z.number().int().min(1).max(10),
    languageWeight: z.number().min(0).max(1),
  }),
  events: z.array(
    z.object({
      id: z.string().min(1),
      titleFa: z.string().min(1),
      textFa: z.string().min(1),
      contentTag: ContentTagSchema,
      costLocal: z.number().finite(),
      statsDelta: StatDeltaSchema,
    }),
  ),
  prosFa: z.array(z.string().min(1)).min(1),
  consFa: z.array(z.string().min(1)).min(1),
  realityNotesFa: z.array(z.string().min(1)).min(1),
});

export const CountriesMacroFileSchema = z.array(CountryMacroDefinitionSchema).min(5);

export const CountryCostsFileSchema = z
  .array(
    z.object({
      countryId: z.string().min(1),
      currencyCode: CurrencyCodeSchema,
      monthlyBasketLocal: z.object({
        rentSingle: PositiveSourcedNumberSchema,
        foodSingle: PositiveSourcedNumberSchema,
        utilitiesTransport: PositiveSourcedNumberSchema,
        healthcareMisc: PositiveSourcedNumberSchema,
      }),
      housingNorms: z.object({
        depositMonths: z.number().int().min(0).max(12),
        mortgageAllowed: z.boolean(),
        mortgageDownPaymentRatio: z.number().gt(0).lt(1),
        mortgageAnnualRate: z.number().min(0).max(1),
        mortgageMaxYears: z.number().int().min(1).max(40),
        defaultBuySqm: z.number().positive(),
      }),
      shortTrip: z.object({
        visaType: z.enum(['visa_free', 'e_visa', 'embassy_visa']),
        visaLabelFa: z.string().min(1),
        visaFeeUsd: z.number().min(0),
        visaApprovalBase: z.number().gt(0).lte(1),
        durationDays: z.number().int().positive(),
        flightRoundTripUsd: z.number().positive(),
        tiers: z.object({
          budget: z.object({
            labelFa: z.string().min(1),
            dailyCostLocal: z.number().positive(),
            happinessBoost: z.number().int(),
            mentalBoost: z.number().int(),
          }),
          standard: z.object({
            labelFa: z.string().min(1),
            dailyCostLocal: z.number().positive(),
            happinessBoost: z.number().int(),
            mentalBoost: z.number().int(),
          }),
          comfort: z.object({
            labelFa: z.string().min(1),
            dailyCostLocal: z.number().positive(),
            happinessBoost: z.number().int(),
            mentalBoost: z.number().int(),
          }),
        }),
        highlightsFa: z.array(z.string().min(1)).min(1),
      }),
    }),
  )
  .min(5);

export const CountryPathsFileSchema = z
  .array(
    z.object({
      countryId: z.string().min(1),
      currencyCode: CurrencyCodeSchema,
      statusLadder: z.object({
        renewableAfterYears: z.number().int().min(1),
        permanentAfterYears: z.number().int().min(1),
        citizenshipAfterYears: z.number().int().min(1),
        minLanguageForPermanent: z.number().int().min(1).max(6),
        minLanguageForCitizenship: z.number().int().min(1).max(6),
      }),
      pathways: z
        .array(
          z.object({
            id: z.enum(['study', 'work', 'skilled', 'investment', 'family']),
            titleFa: z.string().min(1),
            summaryFa: z.string().min(1),
            minAge: z.number().int().min(16).max(80),
            minEducation: EducationLevelSchema,
            requiredLanguageLevel: z.number().int().min(1).max(6),
            proofOfFundsLocal: z.number().min(0),
            applicationFeeLocal: z.number().min(0),
            baseSuccessRate: z.number().gt(0).lte(1),
            expectedProcessingTurns: z.number().int().min(1).max(10),
            notesFa: z.string().min(1),
          }),
        )
        .min(1),
    }),
  )
  .min(5);

export const CountryRuntimeMacroStateSchema = z.object({
  countryId: z.string().min(1),
  cpiIndex: z.number().positive().finite(),
  lastInflationRate: z.number().min(-0.3).max(5).finite(),
  minWageMonthlyLocal: z.number().positive().finite(),
  housingIndex: z.number().positive().finite(),
  rentIndex: z.number().positive().finite(),
  unemploymentRate: z.number().min(0).max(0.8).finite(),
  history: z.array(
    z.object({
      year: z.number().int(),
      inflationRate: z.number().finite(),
      minWageMonthlyLocal: z.number().positive().finite(),
      housingIndex: z.number().positive().finite(),
    }),
  ),
});

export const EmigrationStateSchema = z.object({
  shortlistedCountryIds: z.array(z.string().min(1)),
  activeApplications: z.record(
    z.string(),
    z.object({
      countryId: z.string().min(1),
      status: z.enum(['unexplored', 'researching', 'in_progress', 'approved', 'rejected_retryable']),
      selectedPathId: z.enum(['study', 'work', 'skilled', 'investment', 'family']),
      currentStepIndex: z.number().int().min(0).max(5),
      stepsCompleted: z.array(z.boolean()),
      proofOfFundsVerified: z.boolean(),
      lastAttemptYear: z.number().int().optional(),
      cooldownUntilYear: z.number().int().optional(),
      notesFa: z.string().optional(),
    }),
  ),
  languageLevels: z.record(z.string(), z.number().int().min(1).max(6)),
  residency: z.object({
    isAbroad: z.boolean(),
    countryId: z.string().min(1),
    regionId: z.string().min(1).optional(),
    arrivedYear: z.number().int().optional(),
    yearsAbroad: z.number().int().min(0),
    statusStage: z.enum(['none', 'temporary', 'renewable', 'permanent', 'citizenship']),
    permitType: z.enum(['study', 'work', 'skilled', 'investment', 'family']).optional(),
    jobLossGraceMonthsRemaining: z.number().int().min(0).optional(),
    abroadWorkMonthsAccumulated: z.number().int().min(0),
    checklistDoneIds: z.array(z.string().min(1)),
    credentialRelicensedTracks: z.array(z.string().min(1)),
    annualRemittanceCount: z.number().int().min(0),
    lastArrivalWelcomeSeenYear: z.number().int().optional(),
    forcedReturnNoticeFa: z.string().optional(),
  }),
  travelHistory: z.array(
    z.object({
      id: z.string().min(1),
      countryId: z.string().min(1),
      countryNameFa: z.string().min(1),
      jalaliYear: z.number().int(),
      tier: z.enum(['budget', 'standard', 'comfort']),
      totalCostDisplayFa: z.string().min(1),
      memoryFa: z.string().min(1),
    }),
  ),
  lastReportCard: z
    .object({
      year: z.number().int(),
      netIncomeLocal: z.number().finite(),
      livingCostsLocal: z.number().finite(),
      taxesPaidLocal: z.number().finite(),
      remittanceLocal: z.number().finite(),
      savingsDeltaLocal: z.number().finite(),
      currencyCode: CurrencyCodeSchema,
    })
    .optional(),
});

export const PlayerActivityRuntimeStateSchema = z.object({
  turn: z.number().int().min(0),
  quotaUsedThisTurn: z.number().int().min(0),
  maxQuotaPerTurn: z.number().int().min(1),
  favoriteIds: z.array(z.string().min(1)),
  recentIds: z.array(z.string().min(1)),
  seenOutcomeMap: z.record(z.string(), z.array(z.number().int().min(0))),
  annualUndoSnapshot: z
    .object({
      activityId: z.string().min(1),
      turn: z.number().int().min(0),
      statsBefore: PlayerStatsSchema,
      moneyTomanBefore: z.number().finite(),
      flagsBefore: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
      timelineLengthBefore: z.number().int().min(0),
      quotaUsedBefore: z.number().int().min(0),
      recentIdsBefore: z.array(z.string().min(1)),
      seenOutcomeIndicesBefore: z.array(z.number().int().min(0)).optional(),
    })
    .optional(),
});




