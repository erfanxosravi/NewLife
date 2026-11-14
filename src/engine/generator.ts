import type { GameDataset } from '../data/registry';
import {
  getInitialPocketMoney,
  initializeMacroFlagsForBirthYear,
  pickInflationScenario,
} from './economy';
import { toPersianDigits } from './jalali';
import { generateRandomSeedString, SeededRNG } from './rng';
import { CURRENT_SCHEMA_VERSION } from './schemas';
import { clampStat } from './stats';
import { generateHiddenTalentsAndDiscipline } from './talents';
import type {
  ContentSettings,
  Ethnicity,
  GameState,
  Gender,
  Person,
  Relationship,
  SaveGame,
  SocialClass,
} from './types';

export interface CharacterCreationOptions {
  seed?: string;
  slotId?: string;
  gender?: Gender;
  ethnicity?: Ethnicity;
  birthCityId?: string;
  birthJalaliYear?: number;
  firstName?: string;
  lastName?: string;
  socialClass?: SocialClass;
  contentSettings?: Partial<ContentSettings>;
}

const PARENT_TRAITS = [
  'مهربان',
  'سخت‌گیر',
  'شوخ‌طبع',
  'پرتلاش',
  'کم‌حرف',
  'ولخرج',
  'محتاط',
  'دلسوز',
  'اهل مطالعه',
  'مذهبی و سنتی',
];

const SIBLING_TRAITS = ['بازیگوش', 'درس‌خوان', 'خجالتی', 'جسور', 'مهربان', 'لجباز'];

function pickSocialClass(rng: SeededRNG): SocialClass {
  const classes: { value: SocialClass; weight: number }[] = [
    { value: 'poor', weight: 25 },
    { value: 'middle', weight: 48 },
    { value: 'upper_middle', weight: 20 },
    { value: 'wealthy', weight: 7 },
  ];
  return rng.weightedPick(classes, (c) => c.weight).value;
}

function pickInitialSchoolType(
  socialClass: SocialClass,
  intelligence: number,
  isVillage: boolean,
  rng: SeededRNG,
): 'public' | 'private' | 'sampad' {
  if (!isVillage && intelligence >= 78 && rng.chance(socialClass === 'poor' ? 0.14 : 0.28)) {
    return 'sampad';
  }
  if (!isVillage && (socialClass === 'wealthy' || socialClass === 'upper_middle') && rng.chance(0.52)) {
    return 'private';
  }
  return 'public';
}

export function createNewSaveGame(
  options: CharacterCreationOptions,
  dataset: GameDataset,
): SaveGame {
  const seed = options.seed?.trim() || generateRandomSeedString();
  const rng = new SeededRNG(seed);

  const gender: Gender = options.gender ?? (rng.chance(0.5) ? 'male' : 'female');
  const birthCity =
    dataset.cities.find((c) => c.id === options.birthCityId) ??
    rng.weightedPick(dataset.cities, (c) => c.populationWeight);

  const ethnicity: Ethnicity =
    options.ethnicity ?? rng.pick(birthCity.primaryEthnicities);

  const ethNames = dataset.names.ethnicities[ethnicity];
  const firstName =
    options.firstName?.trim() ||
    (gender === 'male' ? rng.pick(ethNames.maleFirstNames) : rng.pick(ethNames.femaleFirstNames));
  const lastName = options.lastName?.trim() || rng.pick(ethNames.lastNames);

  const socialClass = options.socialClass ?? pickSocialClass(rng);
  const birthJalaliYear = options.birthJalaliYear ?? rng.int(1372, 1403);
  const econScenario = pickInflationScenario(rng);
  const macroInit = initializeMacroFlagsForBirthYear(birthJalaliYear, econScenario, dataset);

  // Innate stats (0-100) with gentle class modifier
  const healthBoost = socialClass === 'wealthy' ? 8 : socialClass === 'poor' ? -5 : 2;
  const intelBoost = socialClass === 'upper_middle' || socialClass === 'wealthy' ? 5 : 0;

  const stats = {
    health: clampStat(rng.int(65, 96) + healthBoost),
    happiness: clampStat(rng.int(60, 92)),
    intelligence: clampStat(rng.int(35, 92) + intelBoost),
    looks: clampStat(rng.int(35, 95)),
    fame: clampStat(socialClass === 'wealthy' ? rng.int(8, 22) : rng.int(0, 8)),
    mentalHealth: clampStat(rng.int(65, 95)),
  };

  const hiddenStats = {
    luck: clampStat(rng.int(15, 90)),
    talent: clampStat(rng.int(20, 95)),
    conscientiousness: clampStat(rng.int(20, 90)),
    riskAppetite: clampStat(rng.int(15, 85)),
  };

  // Generate family
  const npcs: Record<string, Person> = {};
  const relationships: Relationship[] = [];
  const familyJobs = dataset.jobs;

  const hasFather = rng.chance(0.92);
  const hasMother = rng.chance(0.96);

  if (hasFather) {
    const fatherId = 'npc_father';
    const fatherJob = rng.pick(familyJobs);
    npcs[fatherId] = {
      id: fatherId,
      firstName: rng.pick(ethNames.maleFirstNames),
      lastName,
      gender: 'male',
      age: rng.int(24, 42),
      traits: [rng.pick(PARENT_TRAITS), rng.pick(PARENT_TRAITS)].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ),
      jobTitle: fatherJob.titleFa,
      isAlive: true,
    };
    relationships.push({
      personId: fatherId,
      role: 'father',
      closeness: rng.int(65, 95),
      respect: rng.int(60, 95),
      romance: 0,
    });
  }

  if (hasMother) {
    const motherId = 'npc_mother';
    const motherJobTitle = rng.chance(0.45) ? rng.pick(familyJobs).titleFa : 'خانه‌دار';
    npcs[motherId] = {
      id: motherId,
      firstName: rng.pick(ethNames.femaleFirstNames),
      lastName: rng.pick(ethNames.lastNames),
      gender: 'female',
      age: rng.int(21, 38),
      traits: [rng.pick(PARENT_TRAITS), rng.pick(PARENT_TRAITS)].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ),
      jobTitle: motherJobTitle,
      isAlive: true,
    };
    relationships.push({
      personId: motherId,
      role: 'mother',
      closeness: rng.int(72, 98),
      respect: rng.int(70, 98),
      romance: 0,
    });
  }

  const parentJobTitles: string[] = [];
  const parentTraits: string[] = [];
  if (npcs['npc_father']) {
    parentJobTitles.push(npcs['npc_father'].jobTitle);
    parentTraits.push(...npcs['npc_father'].traits);
  }
  if (npcs['npc_mother']) {
    parentJobTitles.push(npcs['npc_mother'].jobTitle);
    parentTraits.push(...npcs['npc_mother'].traits);
  }

  const { hiddenTalents, athleticDiscipline } = generateHiddenTalentsAndDiscipline({
    rng,
    parentJobTitles,
    parentTraits,
    birthCityId: birthCity.id,
    dataset,
  });

  const siblingCount = rng.weightedPick(
    [
      { n: 0, w: 30 },
      { n: 1, w: 40 },
      { n: 2, w: 22 },
      { n: 3, w: 8 },
    ],
    (item) => item.w,
  ).n;

  for (let i = 0; i < siblingCount; i++) {
    const sibGender: Gender = rng.chance(0.5) ? 'male' : 'female';
    const sibId = `npc_sibling_${i + 1}`;
    const sibAge = rng.int(1, 12);
    npcs[sibId] = {
      id: sibId,
      firstName:
        sibGender === 'male'
          ? rng.pick(ethNames.maleFirstNames)
          : rng.pick(ethNames.femaleFirstNames),
      lastName,
      gender: sibGender,
      age: sibAge,
      traits: [rng.pick(SIBLING_TRAITS)],
      jobTitle: sibAge >= 7 ? 'دانش‌آموز' : 'کودک',
      isAlive: true,
    };
    relationships.push({
      personId: sibId,
      role: 'sibling',
      closeness: rng.int(55, 90),
      respect: rng.int(45, 85),
      romance: 0,
    });
  }

  const classLabelMap: Record<SocialClass, string> = {
    poor: 'تنگدست و پرتلاش',
    middle: 'متوسط',
    upper_middle: 'مرفه',
    wealthy: 'ثروتمند',
  };

  const fatherText = npcs['npc_father']
    ? `پدرت «${npcs['npc_father'].firstName}» (${npcs['npc_father'].jobTitle})`
    : 'بدون حضور پدر';
  const motherText = npcs['npc_mother']
    ? `مادرت «${npcs['npc_mother'].firstName}» (${npcs['npc_mother'].jobTitle})`
    : 'بدون حضور مادر';

  const birthText = `در سال ${toPersianDigits(birthJalaliYear)} خورشیدی در شهر ${birthCity.nameFa} و در خانواده‌ای ${classLabelMap[socialClass]} چشم به جهان گشودی. ${fatherText} و ${motherText} نخستین تکیه‌گاه‌های زندگی تو هستند.`;

  const schoolType = pickInitialSchoolType(
    socialClass,
    stats.intelligence,
    birthCity.isVillage,
    rng,
  );

  const initialState: GameState = {
    turn: 0,
    birthJalaliYear,
    currentJalaliYear: birthJalaliYear,
    inflationMultiplier: macroInit.inflationMultiplier,
    lastInflationRate: macroInit.lastInflationRate,
    player: {
      firstName,
      lastName,
      gender,
      ethnicity,
      birthCityId: birthCity.id,
      currentCityId: birthCity.id,
      countryId: 'iran',
      socialClass,
      age: 0,
      stats,
      hiddenStats,
      hiddenTalents,
      athleticDiscipline,
      discoveredTalents: [],
      talentSkills: {},
      moneyToman: getInitialPocketMoney(socialClass, birthJalaliYear, dataset),
      debtToman: 0,
      education: {
        level: 'none',
        inSchool: false,
        yearsInCurrentStage: 0,
        schoolType,
        gpa: 18,
      },
      job: null,
      licenses: [],
      militaryStatus: gender === 'male' ? 'pending' : 'not_applicable',
      maritalStatus: 'single',
      criminalRecord: 0,
      housing: {
        type: 'with_family',
        cityId: birthCity.id,
        monthlyRentToman: 0,
        depositRahnToman: 0,
        propertyValueToman: 0,
      },
    },
    npcs,
    relationships,
    assets: [],
    loans: [],
    ownedBusiness: null,
    businessHistory: [],
    flags: {
      ...macroInit.flags,
    },
    eventHistory: {},
    scheduledEvents: [],
    timeline: [
      {
        id: 'turn_0_birth',
        age: 0,
        jalaliYear: birthJalaliYear,
        title: `تولد ${firstName} ${lastName}`,
        text: birthText,
        type: 'birth',
      },
    ],
    unlockedAchievements: [],
    isAlive: true,
    horizonEnded: false,
    deathSummary: null,
    worldSeed: seed,
    will: null,
    dynasty: {
      dynastyNameFa: `خاندان ${lastName}`,
      founderNameFa: `${firstName} ${lastName}`,
      worldSeed: seed,
      currentGeneration: 1,
      totalGenerationsLived: 0,
      familyReputation: socialClass === 'wealthy' ? 60 : socialClass === 'upper_middle' ? 55 : 50,
      dynastyScore: 0,
      unlockedDynastyRibbons: [],
      chapters: [],
      wealthTimeline: [],
      hallOfFame: [],
      charityEndowmentTotalToman: 0,
      ancestorMemoriesFa: [],
    },
  };

  const nowIso = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    slotId: options.slotId ?? 'slot_1',
    seed,
    rngState: rng.getState(),
    createdAt: nowIso,
    updatedAt: nowIso,
    contentSettings: {
      allowCrime: options.contentSettings?.allowCrime ?? false,
      allowSubstance: options.contentSettings?.allowSubstance ?? false,
      allowRomance: options.contentSettings?.allowRomance ?? true,
      allowSocialPolitical: options.contentSettings?.allowSocialPolitical ?? false,
    },
    state: initialState,
  };
}
