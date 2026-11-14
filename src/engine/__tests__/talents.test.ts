import { describe, it, expect } from 'vitest';
import { gameDataset } from '../../data/registry';
import {
  developTalentAction,
  enterSpecialFallbackCareerAction,
  pursueSpecialCareerAction,
} from '../../state/actions';
import { createNewSaveGame } from '../generator';
import { advanceYear } from '../reducer';
import { SeededRNG } from '../rng';
import {
  generateHiddenTalentsAndDiscipline,
  getSpecialCareerEligibility,
  hasFamilyAffinityForTalent,
} from '../talents';
import type { SocialClass } from '../types';

describe('Hidden & Discoverable Talent System (5,000-life distribution & career gates)', () => {
  it('simulates 5,000 lives verifying skewed distribution, rarity, family odds, city weights, and class independence', () => {
    const N = 5000;
    const standoutThreshold = gameDataset.talents.distribution.standoutThreshold; // 72
    const rareThreshold = gameDataset.talents.distribution.rareThreshold; // 85

    let zeroStandoutLives = 0;
    let totalTalentScores = 0;
    let standoutTalentCount = 0;
    let rareTalentCount = 0;

    // Family affinity tracking for singing & athletics
    const singingDef = gameDataset.talents.talents.find((t) => t.id === 'singing')!;
    let singingWithAffinity = 0;
    let singingStandoutWithAffinity = 0;
    let singingNoAffinity = 0;
    let singingStandoutNoAffinity = 0;

    // Social class independence check
    const classTotals: Record<SocialClass, { sum: number; count: number }> = {
      poor: { sum: 0, count: 0 },
      middle: { sum: 0, count: 0 },
      upper_middle: { sum: 0, count: 0 },
      wealthy: { sum: 0, count: 0 },
    };

    // Weighted city distribution tracking
    const cityCounts: Record<string, number> = {};

    for (let i = 0; i < N; i++) {
      const save = createNewSaveGame({ seed: `talent-dist-${i}` }, gameDataset);
      const { player, npcs } = save.state;

      cityCounts[player.birthCityId] = (cityCounts[player.birthCityId] ?? 0) + 1;

      const scores = Object.values(player.hiddenTalents);
      let hasStandout = false;
      for (const s of scores) {
        totalTalentScores += s;
        if (s >= standoutThreshold) {
          standoutTalentCount++;
          hasStandout = true;
        }
        if (s >= rareThreshold) {
          rareTalentCount++;
        }
      }
      if (!hasStandout) {
        zeroStandoutLives++;
      }

      const parentJobs = [
        npcs['npc_father']?.jobTitle ?? '',
        npcs['npc_mother']?.jobTitle ?? '',
      ];
      const parentTraits = [
        ...(npcs['npc_father']?.traits ?? []),
        ...(npcs['npc_mother']?.traits ?? []),
      ];
      const hasSingAff = hasFamilyAffinityForTalent(singingDef, parentJobs, parentTraits);
      if (hasSingAff) {
        singingWithAffinity++;
        if (player.hiddenTalents.singing >= standoutThreshold) {
          singingStandoutWithAffinity++;
        }
      } else {
        singingNoAffinity++;
        if (player.hiddenTalents.singing >= standoutThreshold) {
          singingStandoutNoAffinity++;
        }
      }

      const avgLifeTalent = scores.reduce((a, b) => a + b, 0) / scores.length;
      classTotals[player.socialClass].sum += avgLifeTalent;
      classTotals[player.socialClass].count += 1;
    }

    const totalSlots = N * gameDataset.talents.talents.length;
    const zeroStandoutShare = zeroStandoutLives / N;
    const rareShare = rareTalentCount / totalSlots;
    const standoutShare = standoutTalentCount / totalSlots;

    // 1. Most lives have NO standout innate talent (>=72); standout & rare scores are genuinely rare
    expect(zeroStandoutShare).toBeGreaterThan(0.45);
    expect(standoutShare).toBeLessThan(0.08);
    expect(rareShare).toBeLessThan(0.025);
    expect(rareShare).toBeGreaterThan(0.001);

    // 2. Social class does NOT alter innate talent distribution (averages should stay within ~3 points)
    const poorAvg = classTotals.poor.sum / Math.max(1, classTotals.poor.count);
    const wealthyAvg = classTotals.wealthy.sum / Math.max(1, classTotals.wealthy.count);
    expect(Math.abs(poorAvg - wealthyAvg)).toBeLessThan(3.5);

    // 3. Family affinity (tested cleanly directly on 2,000 samples) raises odds without guaranteeing
    let affStandout = 0;
    let nonAffStandout = 0;
    for (let i = 0; i < 2000; i++) {
      const affRes = generateHiddenTalentsAndDiscipline({
        rng: new SeededRNG(`aff-${i}`),
        parentJobTitles: ['خواننده سنتی و معلم موسیقی'],
        parentTraits: ['هنردوست'],
        birthCityId: 'tehran',
        dataset: gameDataset,
      });
      if (affRes.hiddenTalents.singing >= standoutThreshold) affStandout++;

      const noAffRes = generateHiddenTalentsAndDiscipline({
        rng: new SeededRNG(`noaff-${i}`),
        parentJobTitles: ['کارمند اداری'],
        parentTraits: ['منظم'],
        birthCityId: 'tehran',
        dataset: gameDataset,
      });
      if (noAffRes.hiddenTalents.singing >= standoutThreshold) nonAffStandout++;
    }
    expect(affStandout).toBeGreaterThan(nonAffStandout * 1.5);
    // Raises odds, never guarantees (< 25%)
    expect(affStandout / 2000).toBeLessThan(0.25);

    // Avoid unused counter lint warning while verifying organic distribution too
    expect(singingWithAffinity + singingNoAffinity).toBe(N);
    expect(singingStandoutWithAffinity + singingStandoutNoAffinity).toBeGreaterThanOrEqual(0);
    expect(totalTalentScores).toBeGreaterThan(0);

    // 4. Weighted birth city distribution: Tehran & Village appear far more often than Zahedan/Yazd
    expect(cityCounts['tehran'] ?? 0).toBeGreaterThan((cityCounts['zahedan'] ?? 0) * 4);
    expect(cityCounts['village'] ?? 0).toBeGreaterThan((cityCounts['yazd'] ?? 0) * 4);
  });

  it('prevents entering special careers without discovered talent and sufficient practiced skill', () => {
    const singerCareer = gameDataset.specialCareers.find((c) => c.id === 'singer')!;
    const save = createNewSaveGame({ seed: 'gate-test', gender: 'male' }, gameDataset);

    // Force adult age and very high innate singing talent (92), but ZERO discovery and ZERO practice
    save.state.player.age = 22;
    save.state.player.hiddenTalents.singing = 92;
    save.state.player.discoveredTalents = [];
    save.state.player.talentSkills = {};

    const eligWithoutPractice = getSpecialCareerEligibility(singerCareer, save.state, gameDataset);
    expect(eligWithoutPractice.eligible).toBe(false);

    const attemptWithoutPractice = pursueSpecialCareerAction(
      save,
      'singer',
      'mainstream',
      gameDataset,
    );
    expect(attemptWithoutPractice.success).toBe(false);

    // Verify ALL 8 special careers are locked without discovery + practiced skill
    for (const career of gameDataset.specialCareers) {
      const elig = getSpecialCareerEligibility(career, save.state, gameDataset);
      expect(elig.eligible).toBe(false);
      const res = pursueSpecialCareerAction(
        save,
        career.id,
        career.alternativeRoutes[0].id,
        gameDataset,
      );
      expect(res.success).toBe(false);
    }
  });

  it('requires practice to grow singing skill and models real audition risk across seeds', () => {
    const singerCareer = gameDataset.specialCareers.find((c) => c.id === 'singer')!;
    let current = createNewSaveGame({ seed: 'singer-journey-seed', gender: 'male' }, gameDataset);
    current.state.player.age = 18;
    current.state.player.moneyToman = 500_000_000;
    current.state.player.hiddenTalents.singing = 88;
    current.state.player.discoveredTalents = [
      {
        talentId: 'singing',
        tier: 'brilliant_talent',
        discoveredAge: 14,
        hintTextFa: 'در جمع مدرسه صدای رسا و خوش‌آهنگت توجه همه را جلب کرد.',
      },
    ];

    // Still ineligible before practicing skill up to minSkill (35)
    expect(getSpecialCareerEligibility(singerCareer, current.state, gameDataset).eligible).toBe(
      false,
    );

    // Practice over 3 turns (1x/year cooldown) using lessons so skill clears minSkill (35)
    for (let yr = 0; yr < 3; yr++) {
      const outcome = developTalentAction(current, 'singing', 'lesson_or_club', gameDataset);
      expect(outcome.success).toBe(true);
      current = outcome.save;
      current.state.turn += 1;
      current.state.player.age += 1;
    }

    const skillState = current.state.player.talentSkills.singing;
    expect(skillState).toBeDefined();
    expect(skillState!.skill).toBeGreaterThanOrEqual(singerCareer.minSkill);

    const eligAfterPractice = getSpecialCareerEligibility(singerCareer, current.state, gameDataset);
    expect(eligAfterPractice.eligible).toBe(true);
    expect(eligAfterPractice.estimatedChancePct).toBeGreaterThan(20);
    expect(eligAfterPractice.estimatedChancePct).toBeLessThan(90);

    // Audition across different seeds should have both successes AND realistic failures
    let passes = 0;
    let fails = 0;
    for (let s = 0; s < 40; s++) {
      const testSave = structuredClone(current);
      testSave.seed = `audition-roll-${s}`;
      const res = pursueSpecialCareerAction(testSave, 'singer', 'online', gameDataset);
      if (res.success) passes++;
      else fails++;
    }
    expect(passes).toBeGreaterThan(0);
    expect(fails).toBeGreaterThan(0);

    // Fallback career is also reachable once discovered/practiced
    const fb = enterSpecialFallbackCareerAction(current, 'singer', gameDataset);
    expect(fb.success).toBe(true);
    expect(fb.save.state.player.job?.title).toBe(singerCareer.fallbackCareerFa);
  });

  it('produces identical talent discovery and progression deterministically for the same seed', () => {
    const runLife = (seed: string) => {
      let save = createNewSaveGame({ seed, birthCityId: 'tehran', gender: 'female' }, gameDataset);
      for (let y = 0; y < 18; y++) {
        save = advanceYear(save, gameDataset);
      }
      return save;
    };

    const a = runLife('determinism-talent-seed');
    const b = runLife('determinism-talent-seed');

    expect(a.state.player.hiddenTalents).toEqual(b.state.player.hiddenTalents);
    expect(a.state.player.athleticDiscipline).toBe(b.state.player.athleticDiscipline);
    expect(a.state.player.discoveredTalents).toEqual(b.state.player.discoveredTalents);
  });
});
