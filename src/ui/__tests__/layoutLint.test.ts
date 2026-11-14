import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(__dirname, '..');

function walkTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsxFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      out.push(full);
    }
  }
  return out;
}

describe('Global UI layout-lint rules', () => {
  const files = walkTsxFiles(UI_DIR);

  it('has no sub-12px font size classes or SVG fontSize < 12 in src/ui', () => {
    const violations: string[] = [];
    const sub12ClassRe = /text-\[(\d+(?:\.\d+)?)px\]/g;
    const svgFontRe = /fontSize=["'](\d+(?:\.\d+)?)["']/g;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const match of line.matchAll(sub12ClassRe)) {
          const px = Number(match[1]);
          if (px < 12) {
            violations.push(`${path.relative(UI_DIR, file)}:${idx + 1}: ${match[0]}`);
          }
        }
        for (const match of line.matchAll(svgFontRe)) {
          const px = Number(match[1]);
          if (px < 12) {
            violations.push(`${path.relative(UI_DIR, file)}:${idx + 1}: fontSize="${match[1]}"`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('has no CSS truncate ellipsis clipping on UI titles or labels in src/ui', () => {
    const violations: string[] = [];
    const truncateRe = /\btruncate\b/;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (truncateRe.test(line)) {
          violations.push(`${path.relative(UI_DIR, file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('bans ad-hoc money formatters outside components/MoneyText.tsx in src/ui', () => {
    const violations: string[] = [];
    const bannedFormatterRe =
      /\b(formatToman|formatCurrencyAmount|CurrencyText|formatSingleCurrency|formatMoneyDual|formatDualMoneyText|formatUsdEquivalentHint)\b/g;

    for (const file of files) {
      const rel = path.relative(UI_DIR, file).replace(/\\/g, '/');
      if (rel === 'components/MoneyText.tsx') continue;

      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const match of line.matchAll(bannedFormatterRe)) {
          violations.push(`${rel}:${idx + 1}: ${match[0]}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});

