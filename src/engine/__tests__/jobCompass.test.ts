import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import faJson from '../../i18n/fa.json';
import { gameDataset } from '../../data/registry';
import {
  pinJobGoalAction,
  resetJobPrioritiesAction,
  setJobPrioritiesAction,
  setJobSalaryUnitAction,
  submitJobInterviewAction,
  toggleJobShortlistAction,
} from '../../state/actions';
import { getMinWageMonthlyForState } from '../economy';
import { createNewSaveGame } from '../generator';
import {
  clampChancePct,
  deriveDefaultPriorities,
  ensureJobCompassState,
  getJobMarketListings,
  jobFingerprint,
  jobGapSteps,
  jobMatch,
  jobReadiness,
  jobSalaryRange,
  pickInterviewQuestionsForJob,
  resolveWaitlistedJobsOnYearAdvance,
} from '../jobCompass';
import { SeededRNG } from '../rng';
import { InterviewsFileSchema, JobDefinitionSchema, JobsFileSchema } from '../schemas';
import type { SaveGame } from '../types';

function makeTestSave(seed: string, age = 22): SaveGame {
  const save = createNewSaveGame(
    { seed, birthCityId: 'tehran', birthJalaliYear: 1405 - age, socialClass: 'middle' },
    gameDataset,
  );
  save.state.currentJalaliYear = 1405;
  save.state.inflationMultiplier = 1;
  save.state.player.age = age;
  save.state.player.education.level = 'diploma';
  save.state.player.education.inSchool = false;
  save.state.player.militaryStatus = 'completed';
  save.state.player.criminalRecord = 0;
  save.state.player.discoveredTalents = [];
  return save;
}

describe('Job Compass & Redesigned Job Market', () => {
  it('1. enforces two-layer content model limits (shortTitle, tagline, tags, dayInLife, pros/cons, i18n)', () => {
    expect(() => JobsFileSchema.parse(gameDataset.jobs)).not.toThrow();
    expect(() => InterviewsFileSchema.parse(gameDataset.interviews)).not.toThrow();

    for (const job of gameDataset.jobs) {
      expect(() => JobDefinitionSchema.parse(job)).not.toThrow();
      expect(job.shortTitle.length).toBeLessThanOrEqual(18);
      if (job.tagline) {
        expect(job.tagline.length).toBeLessThanOrEqual(36);
      }
      expect(job.tags.length).toBeGreaterThanOrEqual(1);
      expect(job.tags.length).toBeLessThanOrEqual(3);
      expect(job.longDescription.length).toBeLessThanOrEqual(400);
      expect(job.dayInLife).toHaveLength(3);
      expect(job.pros.length).toBeLessThanOrEqual(3);
      expect(job.cons.length).toBeLessThanOrEqual(3);
      expect(job.requirementIds.length).toBeGreaterThanOrEqual(1);
      expect(gameDataset.interviews.byJobId[job.id]?.length).toBeGreaterThanOrEqual(1);
    }

    const cm = faJson.careerMarket as Record<string, string>;
    const requiredKeys = [
      'title',
      'subtitle',
      'monthly',
      'annual',
      'perMonth',
      'perYear',
      'whatsImportant',
      'priorityTitle',
      'priorityReset',
      'readyGroup',
      'nearReadyGroup',
      'futureGroup',
      'sortMatch',
      'sortSalary',
      'sortReadiness',
      'eligibleOnly',
      'deckMode',
      'listMode',
      'compare',
      'pinGoal',
      'unpinGoal',
      'dayInLife',
      'realityCheck',
      'startInterview',
      'interviewTitle',
      'interviewHired',
      'interviewWaitlist',
      'interviewRejected',
    ];
    for (const key of requiredKeys) {
      expect(cm[key]).toBeTruthy();
    }
  });

  it('2. passes salary realism sanity checks (median >= minWage, p10 <= median <= p90, aligned baseAnnualSalaryToman)', () => {
    const sampleYears = [1375, 1385, 1395, 1400, 1405];

    for (const year of sampleYears) {
      const save = makeTestSave(`salary-audit-${year}`, 26);
      save.state.currentJalaliYear = year;
      save.state.player.education.level = 'medical_doctor';
      const minWage = getMinWageMonthlyForState(save.state, gameDataset);

      for (const job of gameDataset.jobs) {
        const range = jobSalaryRange(job, save.state, gameDataset);
        expect(range.p10MonthlyNet).toBeLessThanOrEqual(range.medianMonthlyNet);
        expect(range.medianMonthlyNet).toBeLessThanOrEqual(range.p90MonthlyNet);
        expect(range.medianMonthlyNet).toBeGreaterThanOrEqual(minWage);
        // Plausibility band ceiling: entry-level job median monthly net <= 10x statutory minimum wage
        expect(range.medianMonthlyNet).toBeLessThanOrEqual(minWage * 10);
        expect(range.expectedMonthlyUsd).toBeGreaterThan(0);

        if (year === 1405) {
          const diffPct = Math.abs(job.baseAnnualSalaryToman - range.medianAnnualNet) / range.medianAnnualNet;
          expect(diffPct).toBeLessThan(0.02);
        }
      }
    }
  });

  it('3. derives situation-aware priority defaults and computes fingerprint & match scores cleanly', () => {
    const youngRisky = makeTestSave('young-risky', 22);
    youngRisky.state.player.maritalStatus = 'single';
    youngRisky.state.player.hiddenStats.riskAppetite = 80;
    youngRisky.state.player.hiddenStats.conscientiousness = 35;
    const youngDefaults = deriveDefaultPriorities(youngRisky.state);
    expect(youngDefaults.growth).toBe(3);

    const marriedParent = makeTestSave('married-parent', 36);
    marriedParent.state.player.maritalStatus = 'married';
    marriedParent.state.player.hiddenStats.riskAppetite = 30;
    marriedParent.state.player.hiddenStats.conscientiousness = 75;
    marriedParent.state.npcs['child_1'] = {
      id: 'child_1',
      firstName: 'سارا',
      lastName: 'رضایی',
      gender: 'female',
      age: 4,
      traits: [],
      jobTitle: 'کودک',
      isAlive: true,
    };
    marriedParent.state.relationships.push({
      personId: 'child_1',
      role: 'child',
      closeness: 90,
      respect: 80,
      romance: 0,
    });
    const parentDefaults = deriveDefaultPriorities(marriedParent.state);
    expect(parentDefaults.security).toBe(3);
    expect(parentDefaults.calm).toBeGreaterThanOrEqual(2);

    // Talent match badge only fires when the talent is DISCOVERED (never hidden)
    const barber = gameDataset.jobs.find((j) => j.id === 'barber')!;
    const undiscoveredSave = makeTestSave('talent-hidden', 22);
    undiscoveredSave.state.player.hiddenTalents.visual_art = 95;
    undiscoveredSave.state.player.discoveredTalents = [];
    const mHidden = jobMatch(youngDefaults, barber, undiscoveredSave.state, gameDataset);
    expect(mHidden.talentMatched).toBe(false);

    undiscoveredSave.state.player.discoveredTalents = [
      {
        talentId: 'visual_art',
        tier: 'clear_talent',
        discoveredAge: 16,
        hintTextFa: 'استعداد هنری',
      },
    ];
    const mShown = jobMatch(youngDefaults, barber, undiscoveredSave.state, gameDataset);
    expect(mShown.talentMatched).toBe(true);
    expect(mShown.talentMatchReasonFa).toBeTruthy();
    expect(mShown.score).toBeGreaterThan(mHidden.score);

    // Fingerprint provenance checks
    for (const job of gameDataset.jobs) {
      const fp = jobFingerprint(job, youngRisky.state, gameDataset);
      expect(fp.income).toBeGreaterThanOrEqual(0);
      expect(fp.income).toBeLessThanOrEqual(100);
      expect(fp.calm).toBeGreaterThanOrEqual(0);
      expect(fp.calm).toBeLessThanOrEqual(100);
      expect(fp.security).toBeGreaterThanOrEqual(0);
      expect(fp.security).toBeLessThanOrEqual(100);
      expect(fp.growth).toBeGreaterThanOrEqual(0);
      expect(fp.growth).toBeLessThanOrEqual(100);
      expect(fp.freedom).toBeGreaterThanOrEqual(0);
      expect(fp.freedom).toBeLessThanOrEqual(100);
      expect(fp.isEstimate).toBe(true);
      expect(fp.estimatedAxes.length).toBeGreaterThan(0);
    }
  });

  it('4. classifies readiness groups, lock reasons, and actionable gap steps accurately', () => {
    const dipSave = makeTestSave('readiness-dip', 21);
    const barber = gameDataset.jobs.find((j) => j.id === 'barber')!;
    const doctor = gameDataset.jobs.find((j) => j.id === 'doctor')!;
    const nurse = gameDataset.jobs.find((j) => j.id === 'nurse')!;

    const barberReady = jobReadiness(dipSave.state, barber, gameDataset);
    expect(barberReady.eligible).toBe(true);
    expect(barberReady.group).toBe('ready');

    const nurseReady = jobReadiness(dipSave.state, nurse, gameDataset);
    expect(nurseReady.eligible).toBe(false);
    expect(nurseReady.lockTagFa).toContain('نیاز');
    expect(nurseReady.group).toBe('near_ready');

    // Doctor requires medical_doctor degree + medical_license + clean_record
    dipSave.state.player.age = 17;
    dipSave.state.player.militaryStatus = 'serving';
    const doctorFuture = jobReadiness(dipSave.state, doctor, gameDataset);
    expect(doctorFuture.eligible).toBe(false);
    expect(doctorFuture.group).toBe('future');
    expect(doctorFuture.missingCount).toBeGreaterThanOrEqual(3);

    const gapSteps = jobGapSteps(dipSave.state, doctor, gameDataset);
    expect(gapSteps.some((s) => !s.done && s.actionTarget?.type === 'konkur')).toBe(true);
    expect(gapSteps.some((s) => !s.done && s.actionTarget?.type === 'license')).toBe(true);
    expect(gapSteps.some((s) => !s.done && s.actionTarget?.type === 'military')).toBe(true);
  });

  it('5. filters and sorts job market listings cleanly across priorities', () => {
    let save = makeTestSave('listing-sort', 25);
    save.state.player.education.level = 'medical_doctor';
    save.state.player.licenses = ['medical_license', 'pharmacy_license', 'bar_license'];

    const freedomFirst = getJobMarketListings(save.state, gameDataset, {
      priorities: { income: 0, calm: 1, security: 0, growth: 0, freedom: 3 },
      sortBy: 'match',
    });
    const securityFirst = getJobMarketListings(save.state, gameDataset, {
      priorities: { income: 0, calm: 2, security: 3, growth: 0, freedom: 0 },
      sortBy: 'match',
    });

    // Top-ranked job order changes when priorities swing from freedom to security
    expect(freedomFirst.ready[0].job.id).not.toBe(securityFirst.ready[0].job.id);

    const salarySorted = getJobMarketListings(save.state, gameDataset, {
      sortBy: 'salary',
      eligibleOnly: true,
    });
    expect(salarySorted.nearReady).toHaveLength(0);
    expect(salarySorted.future).toHaveLength(0);
    for (let i = 1; i < salarySorted.ready.length; i++) {
      expect(salarySorted.ready[i - 1].salary.expectedMonthlyNet).toBeGreaterThanOrEqual(
        salarySorted.ready[i].salary.expectedMonthlyNet,
      );
    }

    const govOnly = getJobMarketListings(save.state, gameDataset, {
      employerFilter: 'دولتی',
    });
    expect(govOnly.allItems.length).toBeGreaterThan(0);
    for (const item of govOnly.allItems) {
      expect(item.job.employerType).toBe('دولتی');
    }
  });

  it('6. handles priorities, salary unit, shortlist cap, goal pin, mini-interview, and waitlist resolution', () => {
    let save = makeTestSave('actions-flow', 23);

    // Priority mutations + reset
    save = setJobPrioritiesAction(save, { income: 3, calm: 0, security: 0, growth: 3, freedom: 3 }, true);
    expect(ensureJobCompassState(save.state).prioritiesCustomized).toBe(true);
    save = resetJobPrioritiesAction(save);
    expect(ensureJobCompassState(save.state).prioritiesCustomized).toBe(false);

    // Salary unit toggle
    save = setJobSalaryUnitAction(save, 'annual');
    expect(ensureJobCompassState(save.state).salaryUnit).toBe('annual');

    // Shortlist capped at 5
    for (const j of gameDataset.jobs.slice(0, 7)) {
      save = toggleJobShortlistAction(save, j.id).save;
    }
    expect(ensureJobCompassState(save.state).shortlistedJobIds.length).toBe(5);

    // Pin and unpin goal
    save = pinJobGoalAction(save, 'doctor').save;
    expect(ensureJobCompassState(save.state).pinnedJobId).toBe('doctor');
    save = pinJobGoalAction(save, 'doctor').save;
    expect(ensureJobCompassState(save.state).pinnedJobId).toBeNull();

    // Locked job cannot pass interview
    const doctor = gameDataset.jobs.find((j) => j.id === 'doctor')!;
    const blockedRes = submitJobInterviewAction(save, doctor, [], gameDataset);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.outcome).toBe('rejected');

    // Eligible job interview bounds and outcome
    const barber = gameDataset.jobs.find((j) => j.id === 'barber')!;
    const qs = pickInterviewQuestionsForJob('barber', save.state, gameDataset);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.length).toBeLessThanOrEqual(3);

    const picked = qs.map((q) => ({ questionId: q.id, answerId: q.answers[0].id }));
    const interviewRes = submitJobInterviewAction(save, barber, picked, gameDataset);
    expect(interviewRes.finalChancePct).toBeGreaterThanOrEqual(8);
    expect(interviewRes.finalChancePct).toBeLessThanOrEqual(97);
    expect(['hired', 'waitlist', 'rejected']).toContain(interviewRes.outcome);
    expect(clampChancePct(150)).toBe(97);
    expect(clampChancePct(-10)).toBe(8);

    // Waitlist resolves cleanly on year advance
    const waitSave = makeTestSave('waitlist-resolve', 23);
    waitSave.state.jobCompass = {
      ...ensureJobCompassState(waitSave.state),
      waitlistedJobs: [
        {
          jobId: 'barber',
          appliedTurn: waitSave.state.turn,
          appliedYear: waitSave.state.currentJalaliYear,
          interviewBonusPct: 10,
        },
      ],
    };
    const notes = resolveWaitlistedJobsOnYearAdvance(
      waitSave.state,
      new SeededRNG('waitlist-seed-1'),
      gameDataset,
    );
    expect(Array.isArray(notes)).toBe(true);
  });

  it('7. enforces UI guardrails: zero title truncation and >= 12px typography across Job Compass components', () => {
    const dir = path.resolve(process.cwd(), 'src/ui/components/jobCompass');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(5);

    const rowSrc = fs.readFileSync(path.join(dir, 'JobRow.tsx'), 'utf8');
    expect(rowSrc).not.toContain('truncate');
    expect(rowSrc).not.toContain('text-ellipsis');
    expect(rowSrc).not.toContain('text-overflow: ellipsis');
    expect(rowSrc).not.toContain('text-overflow:ellipsis');

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(content, `${file} contains sub-12px font class`).not.toMatch(
        /text-\[(?:[1-9]|10|11)px\]/,
      );
      expect(content, `${file} uses truncate on text`).not.toContain('truncate');
    }
  });
});
