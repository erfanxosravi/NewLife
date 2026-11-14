import { describe, it, expect } from 'vitest';
import { validateAllJsonData } from '../../data/registry';

describe('JSON Schema Validation (Zod)', () => {
  it('validates all external JSON files and referential integrity', () => {
    const dataset = validateAllJsonData();
    expect(dataset.cities.length).toBeGreaterThanOrEqual(10);
    expect(dataset.jobs.length).toBeGreaterThanOrEqual(5);
    expect(dataset.countries.length).toBeGreaterThanOrEqual(4);
    expect(dataset.achievements.length).toBeGreaterThanOrEqual(3);
    expect(dataset.events.length).toBe(5);
  });
});
