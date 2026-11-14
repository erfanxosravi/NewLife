import { describe, expect, it } from 'vitest';
import { gameDataset } from '../../data/registry';
import { createNewSaveGame } from '../generator';
import { formatAgeLabel, formatAgeYearDivider, formatToman, toPersianDigits } from '../jalali';
import {
  buyShopItemAction,
  performActivityAction,
  runAdvanceYearWithTick,
} from '../../state/actions';
import {
  canPerformActivity,
  getShopItemPriceToman,
  isActivityVisibleByContentSettings,
} from '../../state/selectors';

describe('UI Selectors, Formatting & Economy Actions', () => {
  it('formats Persian digits, ages, year dividers, and Toman currencies accurately', () => {
    expect(toPersianDigits(1403)).toBe('۱۴۰۳');
    expect(formatAgeLabel(0)).toBe('۰ سال');
    expect(formatAgeLabel(3)).toBe('۳ سال');
    expect(formatAgeYearDivider(12, 1389)).toBe('سن: ۱۲ سال · ۱۳۸۹');
    expect(formatToman(0)).toBe('۰ تومان');
    expect(formatToman(25_000_000)).toBe('۲۵ میلیون تومان');
    expect(formatToman(2_500_000_000)).toBe('۲.۵ میلیارد تومان');
    expect(formatToman(-500_000)).toBe('−۵۰۰ هزار تومان');
  });

  it('validates all newly added JSON datasets (activities, shop, skills, housing)', () => {
    expect(gameDataset.activities.length).toBeGreaterThanOrEqual(15);
    expect(gameDataset.shop.length).toBeGreaterThanOrEqual(7);
    expect(gameDataset.skills.length).toBeGreaterThanOrEqual(7);
    expect(gameDataset.housing.housingListings.length).toBeGreaterThanOrEqual(3);
    expect(gameDataset.housing.vehicleCatalog.length).toBeGreaterThanOrEqual(3);
  });

  it('filters activities by content settings (crime/gambling/substance)', () => {
    const save = createNewSaveGame(
      {
        seed: 'filter-test',
        contentSettings: {
          allowCrime: false,
          allowSubstance: false,
          allowRomance: true,
          allowSocialPolitical: false,
        },
      },
      gameDataset,
    );

    const crimeActivity = gameDataset.activities.find((a) => a.category === 'crime');
    const gamblingActivity = gameDataset.activities.find((a) => a.category === 'gambling');
    const healthActivity = gameDataset.activities.find((a) => a.category === 'health');

    expect(crimeActivity).toBeDefined();
    expect(gamblingActivity).toBeDefined();
    expect(healthActivity).toBeDefined();

    expect(isActivityVisibleByContentSettings(crimeActivity!, save)).toBe(false);
    expect(isActivityVisibleByContentSettings(gamblingActivity!, save)).toBe(false);
    expect(isActivityVisibleByContentSettings(healthActivity!, save)).toBe(true);

    const enabledSave = {
      ...save,
      contentSettings: { ...save.contentSettings, allowCrime: true },
    };
    expect(isActivityVisibleByContentSettings(crimeActivity!, enabledSave)).toBe(true);
  });

  it('enforces activity age requirements, funds, and once-per-year cooldowns', () => {
    let save = createNewSaveGame({ seed: 'cooldown-test', socialClass: 'wealthy' }, gameDataset);
    const freeHealthAct = gameDataset.activities.find(
      (a) => a.category === 'health' && a.minAge <= 10 && a.costToman <= 5_000_000,
    );
    const adultAct = gameDataset.activities.find((a) => a.minAge >= 18);

    expect(freeHealthAct).toBeDefined();
    expect(adultAct).toBeDefined();

    // At age 0, adult activity is blocked
    const youngCheck = canPerformActivity(adultAct!, save);
    expect(youngCheck.allowed).toBe(false);

    // Advance until age >= freeHealthAct.minAge
    while (save.state.player.age < freeHealthAct!.minAge) {
      save = runAdvanceYearWithTick(save, gameDataset);
    }

    const firstAttempt = performActivityAction(save, freeHealthAct!);
    expect(firstAttempt.success).toBe(true);

    // Same year second attempt blocked by cooldown
    const secondAttempt = performActivityAction(firstAttempt.save, freeHealthAct!);
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.message).toBe('فقط یک بار در سال');

    // Advancing a year resets 1-year cooldown
    const nextYear = runAdvanceYearWithTick(firstAttempt.save, gameDataset);
    const thirdAttempt = canPerformActivity(freeHealthAct!, nextYear);
    expect(thirdAttempt.allowed).toBe(true);
  });

  it('scales shop item prices with inflation and blocks duplicate non-repeatable buys', () => {
    let save = createNewSaveGame({ seed: 'shop-test', socialClass: 'wealthy' }, gameDataset);
    while (save.state.player.age < 18) {
      save = runAdvanceYearWithTick(save, gameDataset);
    }

    const nonRepeatable = gameDataset.shop.find((s) => !s.repeatable && s.minAge <= 18)!;
    expect(nonRepeatable).toBeDefined();

    const basePrice = getShopItemPriceToman(nonRepeatable, {
      ...save.state,
      inflationMultiplier: 1,
    });
    const inflatedPrice = getShopItemPriceToman(nonRepeatable, {
      ...save.state,
      inflationMultiplier: 2.5,
    });
    expect(inflatedPrice).toBe(Math.round(basePrice * 2.5));

    const actualCurrentPrice = getShopItemPriceToman(nonRepeatable, save.state);
    // Give enough cash to test purchase + non-repeatable lock
    save = {
      ...save,
      state: {
        ...save.state,
        player: { ...save.state.player, moneyToman: actualCurrentPrice * 3 },
      },
    };

    const buy1 = buyShopItemAction(save, nonRepeatable);
    expect(buy1.success).toBe(true);

    const buy2 = buyShopItemAction(buy1.save, nonRepeatable);
    expect(buy2.success).toBe(false);
    expect(buy2.message).toBe('قبلاً این کالا را خریده‌ای');
  });
});
