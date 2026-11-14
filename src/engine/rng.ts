export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

export class SeededRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 || 1 : hashSeed(seed);
  }

  public getState(): number {
    return this.state >>> 0;
  }

  public setState(state: number): void {
    this.state = state >>> 0 || 1;
  }

  /** Mulberry32 returning float in [0, 1) */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public int(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }

  public float(min: number, max: number): number {
    if (max <= min) return min;
    return min + this.next() * (max - min);
  }

  public chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return items[this.int(0, items.length - 1)];
  }

  public weightedPick<T>(items: readonly T[], weightFn: (item: T) => number): T {
    if (items.length === 0) {
      throw new Error('Cannot weightedPick from an empty array');
    }
    let total = 0;
    const weights = items.map((item) => {
      const w = Math.max(0, weightFn(item));
      total += w;
      return w;
    });
    if (total <= 0) {
      return this.pick(items);
    }
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }
}

export function generateRandomSeedString(): string {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = (Date.now() ^ 0x9e3779b9) >>> 0;
    bytes[1] = (Math.floor(performance.now() * 1000) ^ 0x85ebca6b) >>> 0;
  }
  return `life-${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}
