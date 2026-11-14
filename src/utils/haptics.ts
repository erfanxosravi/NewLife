export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

interface CapacitorHapticsPlugin {
  impact?: (options: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
  notification?: (options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
}

/**
 * Triggers haptic feedback via Capacitor Haptics when available, falling back
 * to Web Vibration API on mobile browsers and safe no-op on desktop.
 */
export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined') return;

  const capPlugins = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapacitorHapticsPlugin } } })
    .Capacitor?.Plugins;
  const haptics = capPlugins?.Haptics;

  if (haptics) {
    try {
      if (style === 'success' || style === 'warning') {
        void haptics.notification?.({
          type: style === 'success' ? 'SUCCESS' : 'WARNING',
        });
      } else {
        const capStyle = style === 'heavy' ? 'HEAVY' : style === 'medium' ? 'MEDIUM' : 'LIGHT';
        void haptics.impact?.({ style: capStyle });
      }
      return;
    } catch {
      // Fallback to navigator.vibrate
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    const duration =
      style === 'heavy' ? 28 : style === 'warning' ? 24 : style === 'medium' ? 16 : 9;
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore blocked vibration
    }
  }
}
