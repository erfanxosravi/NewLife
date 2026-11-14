import {
  isLeapJalaaliYear,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from 'jalaali-js';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

const JALALI_MONTHS_FA = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatAgeLabel(age: number): string {
  const safeAge = Number.isFinite(age) ? Math.max(0, Math.trunc(age)) : 0;
  return `${toPersianDigits(safeAge)} سال`;
}

export function formatAgeYearDivider(age: number, jalaliYear: number): string {
  const safeAge = Number.isFinite(age) ? Math.max(0, Math.trunc(age)) : 0;
  const safeYear = Number.isFinite(jalaliYear) ? Math.trunc(jalaliYear) : 1400;
  return `سن: ${toPersianDigits(safeAge)} سال · ${toPersianDigits(safeYear)}`;
}

export function gregorianToJalali(date: Date): { jy: number; jm: number; jd: number } {
  return toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return toGregorian(jy, jm, jd);
}

export function isLeapJalaliYear(jy: number): boolean {
  return isLeapJalaaliYear(jy);
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

export function getCurrentJalaliYear(date: Date = new Date()): number {
  return gregorianToJalali(date).jy;
}

export function formatJalaliDate(jy: number, jm: number, jd: number): string {
  const monthName = JALALI_MONTHS_FA[jm - 1] ?? '';
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

export function formatToman(amountToman: number): string {
  if (!Number.isFinite(amountToman)) {
    return '۰ تومان';
  }
  const sign = amountToman < 0 ? '−' : '';
  const abs = Math.round(Math.abs(amountToman));

  if (abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    const formatted = billions >= 100 ? Math.round(billions).toString() : billions.toFixed(billions >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
    return `${sign}${toPersianDigits(formatted)} میلیارد تومان`;
  }

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const formatted = millions >= 100 ? Math.round(millions).toString() : millions.toFixed(millions >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
    return `${sign}${toPersianDigits(formatted)} میلیون تومان`;
  }

  if (abs >= 10_000) {
    const thousands = Math.round(abs / 1_000);
    return `${sign}${toPersianDigits(thousands.toLocaleString('en-US'))} هزار تومان`;
  }

  return `${sign}${toPersianDigits(abs.toLocaleString('en-US'))} تومان`;
}

export function getCulturalCalendarContext(jalaliYear: number): {
  nowruz: string;
  yalda: string;
  ramadanSeasonFa: string;
} {
  // Approximate solar drift of lunar calendar (~11 days earlier every solar year, full cycle ~33 years)
  const lunarOffset = ((jalaliYear - 1403) * 11) % 365;
  const normalizedDay = ((80 - lunarOffset) % 365 + 365) % 365;
  let ramadanSeasonFa = 'بهار';
  if (normalizedDay >= 93 && normalizedDay < 186) ramadanSeasonFa = 'تابستان';
  else if (normalizedDay >= 186 && normalizedDay < 276) ramadanSeasonFa = 'پاییز';
  else if (normalizedDay >= 276) ramadanSeasonFa = 'زمستان';

  return {
    nowruz: `نوروز ${toPersianDigits(jalaliYear)}`,
    yalda: `یلدای ${toPersianDigits(jalaliYear)}`,
    ramadanSeasonFa,
  };
}
