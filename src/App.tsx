import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { gameDataset } from './data/registry';
import type {
  ActivityDefinition,
  ContentSettings,
  EventChoice,
  EventDefinition,
  PlayerStats,
  SaveGame,
} from './engine/types';
import { useI18n } from './i18n/useI18n';
import {
  performActivityAction,
  runAdvanceYearWithTick,
  runApplyEventChoice,
  setDisplayCurrencyModeAction,
  undoLastActivityAction,
  type ActionOutcome,
} from './state/actions';
import {
  YearSequenceController,
  isBirthdayMilestoneAge,
  type YearSequenceSnapshot,
  type YearTransitionPayload,
} from './state/yearSequence';
import {
  getSavedActiveSlotId,
  getSavedAnimationSpeed,
  getSavedLongPressAutoAdvance,
  getSavedSoundEnabled,
  getSavedThemePreference,
  saveStore,
  setSavedActiveSlotId,
  setSavedAnimationSpeed,
  setSavedLongPressAutoAdvance,
  setSavedSoundEnabled,
  setSavedThemePreference,
  type AnimationSpeed,
  type SaveSlotSummary,
  type ThemePreference,
} from './storage/saveStore';
import { BottomNav, type BottomNavTab } from './ui/BottomNav';
import { CharacterCreation } from './ui/CharacterCreation';
import { Toast } from './ui/components/Primitives';
import { EventPopupSheet } from './ui/EventPopupSheet';
import { HeaderBar } from './ui/HeaderBar';
import { IconBrandMark, IconMoon, IconSun } from './ui/icons';
import { LifeFeed } from './ui/LifeFeed';
import { ExpandedStatsSheet, StatsStrip } from './ui/StatsStrip';
import { YearTransitionOverlay } from './ui/YearTransitionOverlay';
import { pickPendingEventForTurn } from './utils/eventSelector';
import { triggerHaptic } from './utils/haptics';
import {
  playNegativeEventSound,
  playPositiveMilestoneSound,
  playYearTickSound,
} from './utils/soundEffects';

const WorkEducationSheet = lazy(() =>
  import('./ui/tabs/WorkEducationSheet').then((m) => ({ default: m.WorkEducationSheet })),
);
const AssetsFinanceSheet = lazy(() =>
  import('./ui/tabs/AssetsFinanceSheet').then((m) => ({ default: m.AssetsFinanceSheet })),
);
const RelationshipsTabSheet = lazy(() =>
  import('./ui/tabs/RelationshipsTabSheet').then((m) => ({ default: m.RelationshipsTabSheet })),
);
const ActivitiesTabSheet = lazy(() =>
  import('./ui/tabs/ActivitiesTabSheet').then((m) => ({ default: m.ActivitiesTabSheet })),
);
const MenuSheet = lazy(() =>
  import('./ui/MenuSheet').then((m) => ({ default: m.MenuSheet })),
);
const EndOfLifeScreen = lazy(() =>
  import('./ui/EndOfLifeScreen').then((m) => ({ default: m.EndOfLifeScreen })),
);
const StyleGuidePage = lazy(() =>
  import('./ui/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })),
);
const DynastyContinueSheet = lazy(() =>
  import('./ui/DynastyContinueSheet').then((m) => ({ default: m.DynastyContinueSheet })),
);
const DynastyScreen = lazy(() =>
  import('./ui/DynastyScreen').then((m) => ({ default: m.DynastyScreen })),
);
const WillEditorSheet = lazy(() =>
  import('./ui/WillEditorSheet').then((m) => ({ default: m.WillEditorSheet })),
);
const EmigrationTravelHub = lazy(() =>
  import('./ui/components/emigration/EmigrationTravelHub').then((m) => ({
    default: m.EmigrationTravelHub,
  })),
);

type ActiveSheet =
  | null
  | BottomNavTab
  | 'stats'
  | 'menu'
  | 'dynasty'
  | 'dynasty_continue'
  | 'will'
  | 'emigration';

const STAT_KEYS: (keyof PlayerStats)[] = [
  'happiness',
  'health',
  'intelligence',
  'looks',
  'mentalHealth',
  'fame',
];

function computeStatDeltas(
  prev: PlayerStats,
  next: PlayerStats,
): Partial<Record<keyof PlayerStats, number>> {
  const deltas: Partial<Record<keyof PlayerStats, number>> = {};
  for (const k of STAT_KEYS) {
    const diff = Math.round(next[k]) - Math.round(prev[k]);
    if (diff !== 0) deltas[k] = diff;
  }
  return deltas;
}

export default function App() {
  const { t } = useI18n();
  const [routeMode, setRouteMode] = useState<'app' | 'styleguide'>(() =>
    typeof window !== 'undefined' && window.location.pathname === '/styleguide'
      ? 'styleguide'
      : 'app',
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getSavedThemePreference(),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>(() =>
    getSavedAnimationSpeed(),
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => getSavedSoundEnabled());
  const [longPressAutoEnabled, setLongPressAutoEnabled] = useState<boolean>(() =>
    getSavedLongPressAutoAdvance(),
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [activeSlotId, setActiveSlotId] = useState<string>(() => getSavedActiveSlotId());
  const [saveGame, setSaveGame] = useState<SaveGame | null>(null);
  const [slotSummaries, setSlotSummaries] = useState<SaveSlotSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingSlotId, setCreatingSlotId] = useState<string>('slot_1');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [eventQueue, setEventQueue] = useState<EventDefinition[]>([]);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'primary' | 'success' | 'danger' | 'warning';
    actionLabel?: string;
    onAction?: () => void;
  }>({ visible: false, message: '', tone: 'primary' });
  const latestSaveRef = useRef<SaveGame | null>(null);
  latestSaveRef.current = saveGame;

  // Animation sequence state
  const sequenceControllerRef = useRef<YearSequenceController | null>(null);
  if (!sequenceControllerRef.current) {
    sequenceControllerRef.current = new YearSequenceController();
  }
  const [seqSnap, setSeqSnap] = useState<YearSequenceSnapshot>(() =>
    sequenceControllerRef.current!.getSnapshot(),
  );
  const preSequenceSnapshotRef = useRef<{
    stats: PlayerStats;
    moneyToman: number;
    age: number;
    jalaliYear: number;
  } | null>(null);
  const [statDeltaDisplay, setStatDeltaDisplay] = useState<{
    deltas: Partial<Record<keyof PlayerStats, number>>;
    key: number;
  }>({ deltas: {}, key: 0 });
  const [moneyDeltaDisplay, setMoneyDeltaDisplay] = useState<{
    amount: number;
    key: number;
  } | null>(null);
  const deltaCounterRef = useRef(0);
  const prevPhaseRef = useRef(seqSnap.phase);

  const resolvedTheme: 'light' | 'dark' =
    themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference;

  useEffect(() => {
    const ctrl = sequenceControllerRef.current!;
    const unsub = ctrl.subscribe((next) => setSeqSnap(next));
    return () => {
      unsub();
      ctrl.reset();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    const onDark = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mqDark.addEventListener('change', onDark);

    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onReduce = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mqReduce.addEventListener('change', onReduce);

    return () => {
      mqDark.removeEventListener('change', onDark);
      mqReduce.removeEventListener('change', onReduce);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    setSavedThemePreference(themePreference);
  }, [resolvedTheme, themePreference]);

  const handleChangeAnimationSpeed = (speed: AnimationSpeed) => {
    setAnimationSpeed(speed);
    setSavedAnimationSpeed(speed);
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    setSavedSoundEnabled(enabled);
  };

  const handleToggleLongPressAuto = (enabled: boolean) => {
    setLongPressAutoEnabled(enabled);
    setSavedLongPressAutoAdvance(enabled);
    if (!enabled) setIsAutoAdvancing(false);
  };

  const showToast = useCallback(
    (
      message: string,
      tone: 'primary' | 'success' | 'danger' | 'warning' = 'primary',
      action?: { label: string; onAction: () => void },
    ) => {
      setToast({
        visible: true,
        message,
        tone,
        actionLabel: action?.label,
        onAction: action?.onAction,
      });
    },
    [],
  );

  useEffect(() => {
    if (!toast.visible) return;
    const duration = toast.actionLabel ? 4200 : 2600;
    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false, actionLabel: undefined, onAction: undefined }));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [toast.visible, toast.message, toast.actionLabel]);

  // Trigger audio cues & stat/money delta displays cleanly at phase transitions
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = seqSnap.phase;
    const payload = seqSnap.payload;
    if (!payload) return;

    if (seqSnap.phase === 'overlay' && prevPhase !== 'overlay') {
      playYearTickSound();
    }

    if (seqSnap.statsApplied && prevPhase !== 'stats' && seqSnap.phase === 'stats') {
      const nextKey = ++deltaCounterRef.current;
      setStatDeltaDisplay({ deltas: payload.statDeltas, key: nextKey });
      if (payload.moneyDelta !== 0) {
        setMoneyDeltaDisplay({ amount: payload.moneyDelta, key: nextKey });
      }
      if (payload.isBirthdayMilestone || payload.hasPositiveOutcome) {
        playPositiveMilestoneSound();
      } else if (payload.isDeath || payload.hasNegativeOutcome) {
        playNegativeEventSound();
      }
    }

    // Handle instant / skipped completion when phase jumps directly to idle with statsApplied
    if (
      seqSnap.phase === 'idle' &&
      prevPhase !== 'idle' &&
      prevPhase !== 'stats' &&
      prevPhase !== 'event_ready' &&
      seqSnap.statsApplied
    ) {
      const nextKey = ++deltaCounterRef.current;
      setStatDeltaDisplay({ deltas: payload.statDeltas, key: nextKey });
      if (payload.moneyDelta !== 0) {
        setMoneyDeltaDisplay({ amount: payload.moneyDelta, key: nextKey });
      }
    }
  }, [seqSnap]);

  // Sync queued pending event once the sequence marks eventOpen = true
  useEffect(() => {
    if (seqSnap.eventOpen && seqSnap.payload?.pendingEvent) {
      setEventQueue((prev) =>
        prev.some((e) => e.id === seqSnap.payload!.pendingEvent!.id)
          ? prev
          : [seqSnap.payload!.pendingEvent!],
      );
    }
  }, [seqSnap.eventOpen, seqSnap.payload]);

  const refreshSummaries = useCallback(async () => {
    const list = await saveStore.listSummaries();
    setSlotSummaries(list);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const preferredSlot = getSavedActiveSlotId();
        const loaded = await saveStore.loadSlot(preferredSlot);
        const summaries = await saveStore.listSummaries();
        if (!mounted) return;
        setSlotSummaries(summaries);
        if (loaded) {
          setSaveGame(loaded);
          setActiveSlotId(loaded.slotId);
          setIsCreating(false);
        } else if (summaries.length > 0) {
          const fallback = await saveStore.loadSlot(summaries[0].slotId);
          if (!mounted) return;
          if (fallback) {
            setSaveGame(fallback);
            setActiveSlotId(fallback.slotId);
            setSavedActiveSlotId(fallback.slotId);
            setIsCreating(false);
          } else {
            setCreatingSlotId(preferredSlot);
            setIsCreating(true);
          }
        } else {
          setCreatingSlotId(preferredSlot);
          setIsCreating(true);
        }
      } finally {
        if (mounted) setIsHydrating(false);
      }
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persistSave = useCallback(
    async (nextSave: SaveGame, prevAchievements?: string[]) => {
      await saveStore.saveSlot(nextSave);
      await refreshSummaries();
      if (prevAchievements) {
        const newlyUnlocked = nextSave.state.unlockedAchievements.filter(
          (id) => !prevAchievements.includes(id),
        );
        if (newlyUnlocked.length > 0) {
          const ach = gameDataset.achievements.find((a) => a.id === newlyUnlocked[0]);
          if (ach) {
            triggerHaptic('success');
            showToast(`دستاورد تازه باز شد: ${ach.titleFa}`, 'success');
          }
        }
      }
    },
    [refreshSummaries, showToast],
  );

  const handleCreateCharacter = async (createdSave: SaveGame) => {
    sequenceControllerRef.current!.reset();
    preSequenceSnapshotRef.current = null;
    setIsAutoAdvancing(false);
    setSaveGame(createdSave);
    setActiveSlotId(createdSave.slotId);
    setSavedActiveSlotId(createdSave.slotId);
    setEventQueue([]);
    setActiveSheet(null);
    setIsCreating(false);
    await persistSave(createdSave);
  };

  const executeYearAdvance = useCallback(
    async (speedOverride?: AnimationSpeed) => {
      const ctrl = sequenceControllerRef.current!;
      if (
        !saveGame ||
        !saveGame.state.isAlive ||
        eventQueue.length > 0 ||
        activeSheet !== null ||
        ctrl.getSnapshot().phase !== 'idle'
      ) {
        return;
      }

      triggerHaptic('light');
      const prevAch = saveGame.state.unlockedAchievements;
      const prevStats = saveGame.state.player.stats;
      const prevMoney = saveGame.state.player.moneyToman;
      const prevAge = saveGame.state.player.age;
      const prevYear = saveGame.state.currentJalaliYear;
      const prevTimelineLen = saveGame.state.timeline.length;

      preSequenceSnapshotRef.current = {
        stats: prevStats,
        moneyToman: prevMoney,
        age: prevAge,
        jalaliYear: prevYear,
      };

      const nextSave = runAdvanceYearWithTick(saveGame, gameDataset);
      const triggered = nextSave.state.isAlive
        ? pickPendingEventForTurn(nextSave, gameDataset)
        : null;

      const newEntries = nextSave.state.timeline.slice(prevTimelineLen);
      const statDeltas = computeStatDeltas(prevStats, nextSave.state.player.stats);
      const moneyDelta = nextSave.state.player.moneyToman - prevMoney;
      const toAge = nextSave.state.player.age;
      const toYear = nextSave.state.currentJalaliYear;
      const isDeath = !nextSave.state.isAlive;
      const isBirthdayMilestone = !isDeath && isBirthdayMilestoneAge(toAge);
      const isNowruzYear = Boolean(
        triggered?.calendarTheme === 'nowruz' ||
          (!isBirthdayMilestone && !isDeath && toYear % 5 === 0),
      );

      let statNet = 0;
      for (const v of Object.values(statDeltas)) {
        if (typeof v === 'number') statNet += v;
      }
      const hasPositiveOutcome =
        isBirthdayMilestone ||
        newEntries.some((e) => e.type === 'milestone') ||
        statNet >= 3;
      const hasNegativeOutcome = isDeath || statNet <= -4;

      const payload: YearTransitionPayload = {
        fromAge: prevAge,
        toAge,
        fromYear: prevYear,
        toYear,
        isDeath,
        isBirthdayMilestone,
        isNowruzYear,
        newEntries,
        statDeltas,
        moneyDelta,
        pendingEvent: triggered,
        hasPositiveOutcome,
        hasNegativeOutcome,
      };

      setSaveGame(nextSave);
      ctrl.start(payload, speedOverride ?? animationSpeed, prefersReducedMotion);
      await persistSave(nextSave, prevAch);
    },
    [saveGame, eventQueue.length, activeSheet, animationSpeed, prefersReducedMotion, persistSave],
  );

  // Opt-in long-press auto-advance loop: advances rapidly until event, milestone, death, or stop
  useEffect(() => {
    if (!isAutoAdvancing) return;
    if (
      !saveGame ||
      !saveGame.state.isAlive ||
      eventQueue.length > 0 ||
      activeSheet !== null ||
      (seqSnap.payload?.isBirthdayMilestone && seqSnap.phase === 'idle')
    ) {
      setIsAutoAdvancing(false);
      return;
    }

    if (seqSnap.phase !== 'idle') return;

    const timer = window.setTimeout(() => {
      void executeYearAdvance(animationSpeed === 'off' ? 'off' : 'fast');
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    isAutoAdvancing,
    saveGame,
    eventQueue.length,
    activeSheet,
    seqSnap.phase,
    seqSnap.payload,
    animationSpeed,
    executeYearAdvance,
  ]);

  const handleSelectEventChoice = async (event: EventDefinition, choice: EventChoice) => {
    if (!saveGame) return;
    const prevAch = saveGame.state.unlockedAchievements;
    const prevStats = saveGame.state.player.stats;
    const prevMoney = saveGame.state.player.moneyToman;

    const nextSave = runApplyEventChoice(saveGame, event, choice);
    setSaveGame(nextSave);
    setEventQueue((prev) => prev.slice(1));
    sequenceControllerRef.current!.clearEvent();

    const statDeltas = computeStatDeltas(prevStats, nextSave.state.player.stats);
    const moneyDelta = nextSave.state.player.moneyToman - prevMoney;
    const nextKey = ++deltaCounterRef.current;
    setStatDeltaDisplay({ deltas: statDeltas, key: nextKey });
    if (moneyDelta !== 0) {
      setMoneyDeltaDisplay({ amount: moneyDelta, key: nextKey });
    }

    await persistSave(nextSave, prevAch);
  };

  const handleActionOutcome = async (outcome: ActionOutcome) => {
    const prevAch = saveGame?.state.unlockedAchievements;
    if (outcome.save !== saveGame && saveGame) {
      const statDeltas = computeStatDeltas(
        saveGame.state.player.stats,
        outcome.save.state.player.stats,
      );
      const moneyDelta = outcome.save.state.player.moneyToman - saveGame.state.player.moneyToman;
      const nextKey = ++deltaCounterRef.current;
      setStatDeltaDisplay({ deltas: statDeltas, key: nextKey });
      if (moneyDelta !== 0) {
        setMoneyDeltaDisplay({ amount: moneyDelta, key: nextKey });
      }
      setSaveGame(outcome.save);
      await persistSave(outcome.save, prevAch);
    }
    triggerHaptic(outcome.success ? 'success' : 'warning');
    showToast(outcome.message, outcome.success ? 'success' : 'warning');
  };

  const handleSilentSaveUpdate = async (nextSave: SaveGame) => {
    setSaveGame(nextSave);
    await persistSave(nextSave);
  };

  const handleQuickActivityWithUndo = (activity: ActivityDefinition): ActionOutcome => {
    const current = latestSaveRef.current ?? saveGame;
    if (!current) {
      return { save: saveGame!, success: false, message: 'بازی آماده نیست' };
    }
    const outcome = performActivityAction(current, activity);
    if (outcome.save !== current) {
      const statDeltas = computeStatDeltas(
        current.state.player.stats,
        outcome.save.state.player.stats,
      );
      const moneyDelta = outcome.save.state.player.moneyToman - current.state.player.moneyToman;
      const nextKey = ++deltaCounterRef.current;
      setStatDeltaDisplay({ deltas: statDeltas, key: nextKey });
      if (moneyDelta !== 0) {
        setMoneyDeltaDisplay({ amount: moneyDelta, key: nextKey });
      }
      setSaveGame(outcome.save);
      latestSaveRef.current = outcome.save;
      void persistSave(outcome.save, current.state.unlockedAchievements);
    }
    triggerHaptic(outcome.success ? 'success' : 'warning');
    if (outcome.success) {
      showToast(outcome.message, 'success', {
        label: t('activitiesHub.undoLabel'),
        onAction: () => {
          const fresh = latestSaveRef.current;
          if (!fresh) return;
          const undone = undoLastActivityAction(fresh);
          setToast((prev) => ({ ...prev, visible: false, actionLabel: undefined, onAction: undefined }));
          void handleActionOutcome(undone);
        },
      });
    } else {
      showToast(outcome.message, 'warning');
    }
    return outcome;
  };

  const handleUpdateContentSettings = async (nextSettings: ContentSettings) => {
    if (!saveGame) return;
    const updated: SaveGame = {
      ...saveGame,
      contentSettings: nextSettings,
      updatedAt: new Date().toISOString(),
    };
    setSaveGame(updated);
    await persistSave(updated);
  };

  const handleLoadSlot = async (slotId: string) => {
    const loaded = await saveStore.loadSlot(slotId);
    if (loaded) {
      sequenceControllerRef.current!.reset();
      preSequenceSnapshotRef.current = null;
      setIsAutoAdvancing(false);
      setSaveGame(loaded);
      setActiveSlotId(slotId);
      setSavedActiveSlotId(slotId);
      setEventQueue([]);
      setIsCreating(false);
    }
  };

  const handleImportSave = async (imported: SaveGame) => {
    sequenceControllerRef.current!.reset();
    preSequenceSnapshotRef.current = null;
    setIsAutoAdvancing(false);
    setSaveGame(imported);
    setActiveSlotId(imported.slotId);
    setSavedActiveSlotId(imported.slotId);
    setEventQueue([]);
    setIsCreating(false);
    await persistSave(imported);
  };

  const handleDeleteSlot = async (slotId: string) => {
    await saveStore.deleteSlot(slotId);
    const updatedList = await saveStore.listSummaries();
    setSlotSummaries(updatedList);
    if (slotId === activeSlotId) {
      sequenceControllerRef.current!.reset();
      preSequenceSnapshotRef.current = null;
      setIsAutoAdvancing(false);
      if (updatedList.length > 0) {
        const nextLoaded = await saveStore.loadSlot(updatedList[0].slotId);
        if (nextLoaded) {
          setSaveGame(nextLoaded);
          setActiveSlotId(nextLoaded.slotId);
          setSavedActiveSlotId(nextLoaded.slotId);
          setEventQueue([]);
          return;
        }
      }
      setSaveGame(null);
      setEventQueue([]);
      setCreatingSlotId('slot_1');
      setIsCreating(true);
    }
  };

  const openCreationForSlot = (slotId: string) => {
    triggerHaptic('light');
    sequenceControllerRef.current!.reset();
    preSequenceSnapshotRef.current = null;
    setIsAutoAdvancing(false);
    setCreatingSlotId(slotId);
    setEventQueue([]);
    setActiveSheet(null);
    setIsCreating(true);
  };

  const navigateStyleGuide = (openGuide: boolean) => {
    setRouteMode(openGuide ? 'styleguide' : 'app');
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', openGuide ? '/styleguide' : '/');
    }
  };

  if (routeMode === 'styleguide') {
    return (
      <Suspense fallback={null}>
        <StyleGuidePage
          themePreference={themePreference}
          resolvedTheme={resolvedTheme}
          onChangeTheme={setThemePreference}
          onExit={() => navigateStyleGuide(false)}
        />
      </Suspense>
    );
  }

  const isSequenceActive = seqSnap.phase !== 'idle';
  const showOverlay = seqSnap.phase === 'overlay';
  const pendingEvent =
    !isSequenceActive && !seqSnap.eventOpen ? eventQueue[0] ?? null : seqSnap.eventOpen ? eventQueue[0] ?? seqSnap.payload?.pendingEvent ?? null : null;

  const nextYearDisabled =
    !saveGame ||
    !saveGame.state.isAlive ||
    Boolean(pendingEvent) ||
    activeSheet !== null ||
    isSequenceActive;

  const activeNavTab: BottomNavTab | null =
    activeSheet === 'career' ||
    activeSheet === 'assets' ||
    activeSheet === 'relations' ||
    activeSheet === 'activities'
      ? activeSheet
      : null;

  const showPreStats =
    saveGame &&
    isSequenceActive &&
    !seqSnap.statsApplied &&
    preSequenceSnapshotRef.current !== null;

  const displayedStats =
    saveGame && showPreStats
      ? preSequenceSnapshotRef.current!.stats
      : saveGame?.state.player.stats;

  const displayedMoney =
    saveGame && showPreStats
      ? preSequenceSnapshotRef.current!.moneyToman
      : saveGame?.state.player.moneyToman ?? 0;

  const displayedAge =
    saveGame && (seqSnap.phase === 'button_feedback' || seqSnap.phase === 'overlay') && preSequenceSnapshotRef.current
      ? preSequenceSnapshotRef.current.age
      : saveGame?.state.player.age ?? 0;

  const displayedYear =
    saveGame && (seqSnap.phase === 'button_feedback' || seqSnap.phase === 'overlay') && preSequenceSnapshotRef.current
      ? preSequenceSnapshotRef.current.jalaliYear
      : saveGame?.state.currentJalaliYear ?? 1380;

  const animatingEntryIds =
    isSequenceActive && seqSnap.payload
      ? seqSnap.payload.newEntries.map((e) => e.id)
      : [];

  const activeYearKey =
    isSequenceActive && seqSnap.payload
      ? `${seqSnap.payload.toAge}_${seqSnap.payload.toYear}`
      : null;

  const showAnimatingYear =
    !isSequenceActive ||
    seqSnap.phase === 'feed' ||
    seqSnap.phase === 'stats' ||
    seqSnap.phase === 'event_ready';

  const showEndOfLifeScreen =
    Boolean(saveGame && !saveGame.state.isAlive && saveGame.state.deathSummary) &&
    !isSequenceActive;

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--surface-2)]">
      {/* Centered Phone-Width Column (360-480px) */}
      <div className="relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)] sm:border-x sm:border-[var(--border)] sm:shadow-2xl">
        <Toast
          visible={toast.visible}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />

        {!isCreating && saveGame ? (
          <HeaderBar
            fullName={`${saveGame.state.player.firstName} ${saveGame.state.player.lastName}`}
            age={displayedAge}
            jalaliYear={displayedYear}
            moneyToman={displayedMoney}
            state={saveGame.state}
            moneyDelta={moneyDeltaDisplay}
            reducedMotion={prefersReducedMotion || animationSpeed === 'off'}
            onChangeDisplayCurrency={(mode) => {
              triggerHaptic('light');
              void handleSilentSaveUpdate(setDisplayCurrencyModeAction(saveGame, mode));
            }}
            onOpenAssets={() => {
              triggerHaptic('light');
              setActiveSheet('assets');
            }}
            onOpenMenu={() => {
              triggerHaptic('light');
              setActiveSheet('menu');
            }}
          />
        ) : (
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <IconBrandMark className="h-7 w-7" />
              <span className="text-base font-bold text-[var(--primary-strong)]">
                {t('appTitle')}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
              aria-label="تغییر تم"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              {resolvedTheme === 'dark' ? (
                <IconSun className="h-5 w-5" />
              ) : (
                <IconMoon className="h-5 w-5" />
              )}
            </button>
          </header>
        )}

        {isHydrating ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--text-muted)]">
            {t('loading')}
          </div>
        ) : isCreating || !saveGame ? (
          <CharacterCreation
            targetSlotId={creatingSlotId}
            onCreate={handleCreateCharacter}
            onCancel={saveGame ? () => setIsCreating(false) : undefined}
          />
        ) : showEndOfLifeScreen && saveGame.state.deathSummary ? (
          <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Suspense fallback={null}>
              <EndOfLifeScreen
                player={saveGame.state.player}
                deathSummary={saveGame.state.deathSummary}
                state={saveGame.state}
                lifeCode={saveGame.seed}
                onPlayAgain={() => openCreationForSlot(activeSlotId)}
                onContinueDynasty={() => {
                  triggerHaptic('light');
                  setActiveSheet('dynasty_continue');
                }}
                onOpenDynasty={() => {
                  triggerHaptic('light');
                  setActiveSheet('dynasty');
                }}
                onShareDone={(msg) => showToast(msg, 'success')}
              />
            </Suspense>
          </div>
        ) : (
          <>
            <LifeFeed
              timeline={saveGame.state.timeline}
              isAlive={saveGame.state.isAlive}
              animatingEntryIds={animatingEntryIds}
              revealedCount={
                isSequenceActive ? seqSnap.revealedEntryCount : Number.MAX_SAFE_INTEGER
              }
              activeYearKey={activeYearKey}
              showAnimatingYear={showAnimatingYear}
              animSpeed={animationSpeed}
              reducedMotion={prefersReducedMotion}
              onSkipSequence={() => sequenceControllerRef.current!.skip()}
            />

            <div className="shrink-0">
              {displayedStats && (
                <StatsStrip
                  stats={displayedStats}
                  statDeltas={statDeltaDisplay.deltas}
                  deltaTriggerKey={statDeltaDisplay.key}
                  animSpeed={animationSpeed}
                  reducedMotion={prefersReducedMotion}
                  onExpand={() => {
                    triggerHaptic('light');
                    setActiveSheet('stats');
                  }}
                />
              )}
              <BottomNav
                activeTab={activeNavTab}
                nextYearDisabled={nextYearDisabled}
                isProcessingYear={seqSnap.phase === 'button_feedback'}
                isAutoAdvancing={isAutoAdvancing}
                longPressAutoEnabled={longPressAutoEnabled}
                reducedMotion={prefersReducedMotion || animationSpeed === 'off'}
                onSelectTab={(tab) => {
                  triggerHaptic('light');
                  setActiveSheet(tab);
                }}
                onNextYear={() => void executeYearAdvance()}
                onStartAutoAdvance={() => {
                  triggerHaptic('medium');
                  setIsAutoAdvancing(true);
                }}
                onStopAutoAdvance={() => {
                  triggerHaptic('light');
                  setIsAutoAdvancing(false);
                }}
              />
            </div>

            <YearTransitionOverlay
              visible={showOverlay}
              payload={seqSnap.payload}
              animSpeed={animationSpeed}
              reducedMotion={prefersReducedMotion}
              onSkip={() => sequenceControllerRef.current!.skip()}
            />

            <EventPopupSheet
              event={pendingEvent}
              playerMoneyToman={saveGame.state.player.moneyToman}
              animSpeed={animationSpeed}
              reducedMotion={prefersReducedMotion}
              onSelectChoice={handleSelectEventChoice}
            />

            <ExpandedStatsSheet
              open={activeSheet === 'stats'}
              state={saveGame.state}
              onClose={() => setActiveSheet(null)}
            />

            <Suspense fallback={null}>
              {activeSheet === 'career' && (
                <WorkEducationSheet
                  open
                  saveGame={saveGame}
                  onClose={() => setActiveSheet(null)}
                  onUpdateSave={handleActionOutcome}
                  onEffortChange={handleSilentSaveUpdate}
                />
              )}

              {activeSheet === 'assets' && (
                <AssetsFinanceSheet
                  open
                  saveGame={saveGame}
                  onClose={() => setActiveSheet(null)}
                  onUpdateSave={handleActionOutcome}
                  onOpenWill={() => setActiveSheet('will')}
                />
              )}

              {activeSheet === 'relations' && (
                <RelationshipsTabSheet
                  open
                  saveGame={saveGame}
                  onClose={() => setActiveSheet(null)}
                  onUpdateSave={handleActionOutcome}
                />
              )}

              {activeSheet === 'activities' && (
                <ActivitiesTabSheet
                  open
                  saveGame={saveGame}
                  onClose={() => setActiveSheet(null)}
                  onUpdateSave={handleActionOutcome}
                  onSilentSave={handleSilentSaveUpdate}
                  onQuickExecuteWithUndo={handleQuickActivityWithUndo}
                  onOpenEmigration={() => {
                    triggerHaptic('light');
                    setActiveSheet('emigration');
                  }}
                />
              )}

              {activeSheet === 'emigration' && (
                <EmigrationTravelHub
                  open
                  saveGame={saveGame}
                  onClose={() => setActiveSheet(null)}
                  onUpdateSave={handleActionOutcome}
                  onSilentSave={handleSilentSaveUpdate}
                  onDeepLink={(tab) => {
                    triggerHaptic('light');
                    setActiveSheet(tab === 'work' ? 'career' : tab === 'assets' ? 'assets' : 'activities');
                  }}
                />
              )}
            </Suspense>
          </>
        )}

        {!isHydrating && !isCreating && saveGame && (
          <Suspense fallback={null}>
            {activeSheet === 'menu' && (
              <MenuSheet
                open
                saveGame={saveGame}
                activeSlotId={activeSlotId}
                summaries={slotSummaries}
                themePreference={themePreference}
                animationSpeed={animationSpeed}
                soundEnabled={soundEnabled}
                longPressAutoEnabled={longPressAutoEnabled}
                onChangeTheme={setThemePreference}
                onChangeAnimationSpeed={handleChangeAnimationSpeed}
                onToggleSound={handleToggleSound}
                onToggleLongPressAuto={handleToggleLongPressAuto}
                onUpdateContentSettings={handleUpdateContentSettings}
                onLoadSlot={handleLoadSlot}
                onImportSave={handleImportSave}
                onStartNewInSlot={openCreationForSlot}
                onStartDebugRun={handleCreateCharacter}
                onDeleteSlot={handleDeleteSlot}
                onOpenStyleGuide={() => navigateStyleGuide(true)}
                onOpenDynasty={() => setActiveSheet('dynasty')}
                onOpenWill={() => setActiveSheet('will')}
                onNotify={showToast}
                onClose={() => setActiveSheet(null)}
              />
            )}

            {activeSheet === 'dynasty' && (
              <DynastyScreen
                open
                saveGame={saveGame}
                onClose={() => setActiveSheet(null)}
                onShareDone={(msg) => showToast(msg, 'success')}
              />
            )}

            {activeSheet === 'dynasty_continue' && (
              <DynastyContinueSheet
                open
                saveGame={saveGame}
                onClose={() => setActiveSheet(null)}
                onUpdateSave={(outcome) => {
                  sequenceControllerRef.current!.reset();
                  preSequenceSnapshotRef.current = null;
                  void handleActionOutcome(outcome);
                }}
                onOpenDynastyHall={() => setActiveSheet('dynasty')}
              />
            )}

            {activeSheet === 'will' && (
              <WillEditorSheet
                open
                saveGame={saveGame}
                onClose={() => setActiveSheet(null)}
                onUpdateSave={handleActionOutcome}
              />
            )}
          </Suspense>
        )}
      </div>
    </div>
  );
}
