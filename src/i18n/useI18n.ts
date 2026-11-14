import { useMemo } from 'react';
import { gameDataset } from '../data/registry';
import { toPersianDigits } from '../engine/jalali';

type DictValue = string | Record<string, unknown>;

function resolvePath(root: Record<string, DictValue>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function translate(
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = resolvePath(gameDataset.faStrings as Record<string, DictValue>, key);
  if (!raw) return key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const val = vars[name];
    if (val === undefined) return '';
    return typeof val === 'number' ? toPersianDigits(val) : String(val);
  });
}

export function useI18n() {
  return useMemo(
    () => ({
      t: translate,
    }),
    [],
  );
}
