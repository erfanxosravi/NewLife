import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 4;

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

export const JobDefinitionSchema = z
  .object({
    id: z.string().min(1),
    titleFa: z.string().min(1),
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
  weight: z.number().positive(),
  resultTextFa: z.string().min(1),
  stats: StatDeltaSchema.optional(),
  moneyToman: z.number().finite().optional(),
  criminalRecordDelta: z.number().int().optional(),
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
      }),
    )
    .min(4),
});


