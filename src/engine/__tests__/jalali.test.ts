import { describe, it, expect } from 'vitest';
import {
  formatJalaliDate,
  formatToman,
  gregorianToJalali,
  isLeapJalaliYear,
  jalaliToGregorian,
  toPersianDigits,
} from '../jalali';

describe('Jalali Calendar & Persian Formatting', () => {
  it('converts Gregorian dates to Jalali accurately via jalaali-js', () => {
    // 2024-03-20 is 1403-01-01 (Nowruz 1403)
    const nowruz = gregorianToJalali(new Date(2024, 2, 20));
    expect(nowruz).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect(formatJalaliDate(nowruz.jy, nowruz.jm, nowruz.jd)).toBe('۱ فروردین ۱۴۰۳');

    const back = jalaliToGregorian(1403, 1, 1);
    expect(back).toEqual({ gy: 2024, gm: 3, gd: 20 });
    expect(isLeapJalaliYear(1403)).toBe(true);
  });

  it('converts Western digits to Persian digits', () => {
    expect(toPersianDigits('1403-09-25')).toBe('۱۴۰۳-۰۹-۲۵');
    expect(toPersianDigits(85)).toBe('۸۵');
    expect(toPersianDigits(3)).toBe('۳');
    expect(toPersianDigits(3)).not.toBe('۳۰');
  });

  it('formats age and Jalali year cleanly without stray zeros', async () => {
    const { formatAgeLabel, formatAgeYearDivider } = await import('../jalali');
    expect(formatAgeLabel(0)).toBe('۰ سال');
    expect(formatAgeLabel(3)).toBe('۳ سال');
    expect(formatAgeLabel(30)).toBe('۳۰ سال');
    expect(formatAgeYearDivider(3, 1380)).toBe('سن: ۳ سال · ۱۳۸۰');
    expect(formatAgeYearDivider(12, 1389)).toBe('سن: ۱۲ سال · ۱۳۸۹');
    expect(formatAgeYearDivider(3.8, 1380)).toBe('سن: ۳ سال · ۱۳۸۰');
  });

  it('formats Toman amounts readably with million and billion units', () => {
    expect(formatToman(0)).toBe('۰ تومان');
    expect(formatToman(850_000)).toBe('۸۵۰ هزار تومان');
    expect(formatToman(12_500_000)).toBe('۱۲.۵ میلیون تومان');
    expect(formatToman(3_400_000_000)).toBe('۳.۴ میلیارد تومان');
  });
});
