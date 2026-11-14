import citiesRaw from './cities.json';
import namesRaw from './names.json';
import jobsRaw from './jobs.json';
import countriesRaw from './countries.json';
import achievementsRaw from './achievements.json';
import activitiesRaw from './activities.json';
import shopRaw from './shop.json';
import skillsRaw from './skills.json';
import housingRaw from './housing.json';
import sampleEventsRaw from './events/sample.json';
import baseline1405Raw from './economy/baseline_1405.json';
import historicalSeriesRaw from './economy/historical_series.json';
import jobIncomeRaw from './economy/job_income.json';
import talentsRaw from './talents.json';
import careersSpecialRaw from './careers_special.json';
import businessesRaw from './businesses.json';
import inheritanceRaw from './inheritance.json';
import adoptionRaw from './adoption.json';
import interviewsRaw from './interviews.json';
import faStringsRaw from '../i18n/fa.json';
import {
  AchievementsFileSchema,
  ActivitiesFileSchema,
  AdoptionFileSchema,
  Baseline1405Schema,
  BusinessesCatalogFileSchema,
  CareersSpecialFileSchema,
  CitiesFileSchema,
  CountriesFileSchema,
  EventsFileSchema,
  HistoricalSeriesSchema,
  HousingFileSchema,
  I18nStringsSchema,
  InheritanceFileSchema,
  InterviewsFileSchema,
  JobIncomeFileSchema,
  JobsFileSchema,
  NamesFileSchema,
  ShopFileSchema,
  SkillsFileSchema,
  TalentsFileSchema,
} from '../engine/schemas';
import type {
  AchievementDefinition,
  ActivityDefinition,
  AdoptionDataset,
  BusinessesCatalog,
  City,
  CountryDefinition,
  EconomyDataset,
  EventDefinition,
  HousingCatalog,
  InheritanceDataset,
  InterviewsDataset,
  JobDefinition,
  NamesDataset,
  ShopItemDefinition,
  SkillDefinition,
  SpecialCareerDefinition,
  TalentsDataset,
} from '../engine/types';

export interface GameDataset {
  cities: City[];
  names: NamesDataset;
  jobs: JobDefinition[];
  countries: CountryDefinition[];
  achievements: AchievementDefinition[];
  events: EventDefinition[];
  activities: ActivityDefinition[];
  shop: ShopItemDefinition[];
  skills: SkillDefinition[];
  housing: HousingCatalog;
  talents: TalentsDataset;
  specialCareers: SpecialCareerDefinition[];
  businesses: BusinessesCatalog;
  inheritance: InheritanceDataset;
  adoption: AdoptionDataset;
  interviews: InterviewsDataset;
  economy: EconomyDataset;
  faStrings: Record<string, unknown>;
}

export function validateAllJsonData(): GameDataset {
  const cities = CitiesFileSchema.parse(citiesRaw);
  const names = NamesFileSchema.parse(namesRaw);
  const jobs = JobsFileSchema.parse(jobsRaw);
  const countries = CountriesFileSchema.parse(countriesRaw);
  const achievements = AchievementsFileSchema.parse(achievementsRaw);
  const events = EventsFileSchema.parse(sampleEventsRaw);
  const activities = ActivitiesFileSchema.parse(activitiesRaw);
  const shop = ShopFileSchema.parse(shopRaw);
  const skills = SkillsFileSchema.parse(skillsRaw);
  const housing = HousingFileSchema.parse(housingRaw);
  const talents = TalentsFileSchema.parse(talentsRaw);
  const specialCareers = CareersSpecialFileSchema.parse(careersSpecialRaw);
  const businesses = BusinessesCatalogFileSchema.parse(businessesRaw);
  const inheritance = InheritanceFileSchema.parse(inheritanceRaw);
  const adoption = AdoptionFileSchema.parse(adoptionRaw);
  const interviews = InterviewsFileSchema.parse(interviewsRaw);
  const baseline1405 = Baseline1405Schema.parse(baseline1405Raw);
  const historicalSeries = HistoricalSeriesSchema.parse(historicalSeriesRaw);
  const jobIncome = JobIncomeFileSchema.parse(jobIncomeRaw);
  const faStrings = I18nStringsSchema.parse(faStringsRaw);

  // Referential integrity checks
  const cityIds = new Set(cities.map((c) => c.id));
  if (cityIds.size !== cities.length) {
    throw new Error('Duplicate city id detected in cities.json');
  }

  for (const cid of cityIds) {
    if (!baseline1405.cityHousingMultipliers[cid]) {
      throw new Error(`City "${cid}" missing housing multiplier in baseline_1405.json`);
    }
  }

  // Historical series 1340..1405 contiguous check
  const yearSet = new Set(historicalSeries.map((h) => h.year));
  for (let y = 1340; y <= 1405; y++) {
    if (!yearSet.has(y)) {
      throw new Error(`Historical series missing year ${y}`);
    }
  }

  const jobIncomeIds = new Set(jobIncome.map((j) => j.jobId));
  for (const job of jobs) {
    if (!jobIncomeIds.has(job.id)) {
      throw new Error(`Job "${job.id}" missing entry in job_income.json`);
    }
  }

  const eventIds = new Set(events.map((e) => e.id));
  if (eventIds.size !== events.length) {
    throw new Error('Duplicate event id detected in events JSON');
  }

  const activityIds = new Set(activities.map((a) => a.id));
  if (activityIds.size !== activities.length) {
    throw new Error('Duplicate activity id detected in activities.json');
  }

  const shopIds = new Set(shop.map((s) => s.id));
  if (shopIds.size !== shop.length) {
    throw new Error('Duplicate shop item id detected in shop.json');
  }

  const skillIds = new Set(skills.map((s) => s.id));
  if (skillIds.size !== skills.length) {
    throw new Error('Duplicate skill id detected in skills.json');
  }

  for (const talent of talents.talents) {
    if (talent.relatedSkillId && !skillIds.has(talent.relatedSkillId)) {
      throw new Error(`Talent "${talent.id}" references unknown skill "${talent.relatedSkillId}"`);
    }
    for (const cid of talent.cityAccessBoostIds) {
      if (!cityIds.has(cid)) {
        throw new Error(`Talent "${talent.id}" references unknown city "${cid}"`);
      }
    }
  }

  const talentIds = new Set(talents.talents.map((t) => t.id));
  for (const sc of specialCareers) {
    if (!talentIds.has(sc.requiredTalentId)) {
      throw new Error(`Special career "${sc.id}" references unknown talent "${sc.requiredTalentId}"`);
    }
    for (const altId of sc.optionalAltTalentIds ?? []) {
      if (!talentIds.has(altId)) {
        throw new Error(`Special career "${sc.id}" references unknown alt talent "${altId}"`);
      }
    }
  }

  const licenseIds = new Set(businesses.licenses.map((l) => l.id));
  if (licenseIds.size !== businesses.licenses.length) {
    throw new Error('Duplicate license id detected in businesses.json');
  }
  const businessTypeIds = new Set(businesses.businesses.map((b) => b.id));
  if (businessTypeIds.size !== businesses.businesses.length) {
    throw new Error('Duplicate business id detected in businesses.json');
  }

  for (const lic of businesses.licenses) {
    if (lic.requiredSkillId && !skillIds.has(lic.requiredSkillId)) {
      throw new Error(`License "${lic.id}" references unknown skill "${lic.requiredSkillId}"`);
    }
  }
  for (const biz of businesses.businesses) {
    for (const lid of biz.requiredLicenses) {
      if (!licenseIds.has(lid)) {
        throw new Error(`Business "${biz.id}" references unknown license "${lid}"`);
      }
    }
    if (biz.requiredSkillId && !skillIds.has(biz.requiredSkillId)) {
      throw new Error(`Business "${biz.id}" references unknown skill "${biz.requiredSkillId}"`);
    }
  }

  for (const job of jobs) {
    if (job.requiredSkillId && !skillIds.has(job.requiredSkillId)) {
      throw new Error(`Job "${job.id}" references unknown skill "${job.requiredSkillId}"`);
    }
    if (job.requiredLicenseId && !licenseIds.has(job.requiredLicenseId)) {
      throw new Error(`Job "${job.id}" references unknown license "${job.requiredLicenseId}"`);
    }
    if (job.ownershipPath.allowed && job.ownershipPath.businessTypeId) {
      if (!businessTypeIds.has(job.ownershipPath.businessTypeId)) {
        throw new Error(
          `Job "${job.id}" ownershipPath references unknown business "${job.ownershipPath.businessTypeId}"`,
        );
      }
    }
    for (const lid of job.ownershipPath.requiredLicenses) {
      if (!licenseIds.has(lid)) {
        throw new Error(`Job "${job.id}" ownershipPath references unknown license "${lid}"`);
      }
    }
  }

  for (const event of events) {
    if (event.conditions.cities) {
      for (const cid of event.conditions.cities) {
        if (!cityIds.has(cid)) {
          throw new Error(`Event "${event.id}" references unknown city "${cid}"`);
        }
      }
    }
  }

  const careTypeIds = new Set(adoption.careTypes.map((c) => c.id));
  if (careTypeIds.size !== adoption.careTypes.length) {
    throw new Error('Duplicate careType id detected in adoption.json');
  }

  for (const job of jobs) {
    if (!interviews.byJobId[job.id] || interviews.byJobId[job.id].length === 0) {
      throw new Error(`Job "${job.id}" missing interview questions in interviews.json`);
    }
    for (const reqId of job.requirementIds) {
      const valid =
        reqId === 'age_18' ||
        reqId === 'clean_record' ||
        reqId === 'military_free' ||
        reqId.startsWith('edu_') ||
        (reqId.startsWith('lic_') && licenseIds.has(reqId.slice(4)));
      if (!valid) {
        throw new Error(`Job "${job.id}" references invalid requirementId "${reqId}"`);
      }
    }
  }

  return {
    cities,
    names,
    jobs,
    countries,
    achievements,
    events,
    activities,
    shop,
    skills,
    housing,
    talents,
    specialCareers,
    businesses,
    inheritance,
    adoption,
    interviews,
    economy: {
      baseline1405,
      historicalSeries,
      jobIncome,
    },
    faStrings,
  };
}

export const gameDataset: GameDataset = validateAllJsonData();
