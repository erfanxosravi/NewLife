import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import { toPersianDigits } from '../../../engine/jalali';
import {
  ensureJobCompassState,
  getJobMarketListings,
  type JobEmployerFilter,
  type JobMarketItem,
  type JobMarketSortMode,
} from '../../../engine/jobCompass';
import type { SaveGame } from '../../../engine/types';
import { useI18n } from '../../../i18n/useI18n';
import {
  pinJobGoalAction,
  resetJobPrioritiesAction,
  setJobPrioritiesAction,
  setJobSalaryUnitAction,
  submitJobInterviewAction,
  toggleJobShortlistAction,
  type ActionOutcome,
} from '../../../state/actions';
import { triggerHaptic } from '../../../utils/haptics';
import { IconChevronDown, IconClose } from '../../icons';
import { FullScreenSheet } from '../FullScreenSheet';
import { EmptyState } from '../Primitives';
import { CompareSheet } from './CompareSheet';
import { EmojiSprite } from './JobIcons';
import { JobDeck } from './JobDeck';
import { JobDetailSheet, type JobGapActionTarget } from './JobDetailSheet';
import { JobInterviewSheet } from './JobInterviewSheet';
import { JobRow } from './JobRow';
import { PrioritySheet, PriorityStrip } from './PriorityCompass';

interface JobMarketSheetProps {
  open: boolean;
  saveGame: SaveGame;
  initialJobId?: string | null;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
  onSilentSaveUpdate: (nextSave: SaveGame) => void;
  onNavigateGapTarget: (target: JobGapActionTarget) => void;
}

const EMPLOYER_FILTERS: { value: JobEmployerFilter; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'دولتی', label: 'دولتی' },
  { value: 'خصوصی', label: 'خصوصی' },
  { value: 'آزاد', label: 'آزاد' },
  { value: 'خانوادگی', label: 'خانوادگی' },
];

export function JobMarketSheet({
  open,
  saveGame,
  initialJobId,
  onClose,
  onUpdateSave,
  onSilentSaveUpdate,
  onNavigateGapTarget,
}: JobMarketSheetProps) {
  const { t } = useI18n();
  const compass = ensureJobCompassState(saveGame.state);

  const [searchQuery, setSearchQuery] = useState('');
  const [employerFilter, setEmployerFilter] = useState<JobEmployerFilter>('all');
  const [sortBy, setSortBy] = useState<JobMarketSortMode>('match');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'deck'>('list');
  const [futureExpanded, setFutureExpanded] = useState(false);

  const [prioritySheetOpen, setPrioritySheetOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null);
  const [interviewJobId, setInterviewJobId] = useState<string | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);

  // Sync optional initialJobId if passed when opening from pinned goal card
  const prevInitialRef = useRef<string | null | undefined>(undefined);
  if (open && initialJobId && prevInitialRef.current !== initialJobId) {
    prevInitialRef.current = initialJobId;
    if (selectedJobId !== initialJobId) {
      setSelectedJobId(initialJobId);
    }
  }
  if (!open && prevInitialRef.current !== undefined) {
    prevInitialRef.current = undefined;
  }

  const listings = useMemo(
    () =>
      getJobMarketListings(saveGame.state, gameDataset, {
        priorities: compass.priorities,
        searchQuery,
        employerFilter,
        sortBy,
        eligibleOnly,
      }),
    [saveGame.state, compass.priorities, searchQuery, employerFilter, sortBy, eligibleOnly],
  );

  // FLIP reorder animation across priority/sort updates
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevTopsRef = useRef<Map<string, number>>(new Map());
  const orderSignature = listings.allItems.map((i) => i.job.id).join(',');

  useLayoutEffect(() => {
    if (!open || viewMode !== 'list') return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const nextTops = new Map<string, number>();
    rowRefs.current.forEach((el, id) => {
      if (el) nextTops.set(id, el.getBoundingClientRect().top);
    });

    if (!reduced && prevTopsRef.current.size > 0) {
      rowRefs.current.forEach((el, id) => {
        if (!el) return;
        const oldTop = prevTopsRef.current.get(id);
        const newTop = nextTops.get(id);
        if (oldTop !== undefined && newTop !== undefined) {
          const dy = oldTop - newTop;
          if (Math.abs(dy) > 2 && Math.abs(dy) < 600) {
            el.style.transition = 'none';
            el.style.transform = `translateY(${dy}px)`;
            requestAnimationFrame(() => {
              el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
              el.style.transform = '';
            });
          }
        }
      });
    }
    prevTopsRef.current = nextTops;
  }, [orderSignature, open, viewMode]);

  const selectedItem = useMemo(
    () => listings.allItems.find((i) => i.job.id === selectedJobId) ?? null,
    [listings.allItems, selectedJobId],
  );
  const interviewItem = useMemo(
    () => listings.allItems.find((i) => i.job.id === interviewJobId) ?? null,
    [listings.allItems, interviewJobId],
  );
  const compareItems = useMemo(
    () =>
      compareIds
        .map((id) =>
          getJobMarketListings(saveGame.state, gameDataset, {
            priorities: compass.priorities,
          }).allItems.find((x) => x.job.id === id),
        )
        .filter((x): x is JobMarketItem => Boolean(x)),
    [compareIds, saveGame.state, compass.priorities],
  );

  const hasAnyTalentMatch = listings.allItems.some((i) => i.match.talentMatched);

  const toggleCompareSelection = (jobId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(jobId)) return prev.filter((x) => x !== jobId);
      if (prev.length >= 3) return [...prev.slice(1), jobId];
      return [...prev, jobId];
    });
  };

  const handleRowSelect = (item: JobMarketItem) => {
    if (compareMode) {
      toggleCompareSelection(item.job.id);
    } else {
      setSelectedJobId(item.job.id);
    }
  };

  const renderGroupRows = (items: JobMarketItem[]) => (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
      {items.map((item) => (
        <JobRow
          key={item.job.id}
          item={item}
          salaryUnit={compass.salaryUnit}
          isPinnedGoal={compass.pinnedJobId === item.job.id}
          isShortlisted={compass.shortlistedJobIds.includes(item.job.id)}
          compareMode={compareMode}
          isSelectedForCompare={compareIds.includes(item.job.id)}
          onSelect={() => handleRowSelect(item)}
          rowRef={(el) => {
            if (el) rowRefs.current.set(item.job.id, el);
            else rowRefs.current.delete(item.job.id);
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      <FullScreenSheet
        open={open}
        onClose={onClose}
        title={t('careerMarket.title')}
        subtitle={t('careerMarket.subtitle')}
        zIndexClass="z-[55]"
        headerRight={
          <div className="flex items-center gap-1.5">
            {/* Monthly | Annual unit toggle */}
            <div
              role="group"
              aria-label="واحد نمایش حقوق"
              className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
            >
              {(['monthly', 'annual'] as const).map((unit) => {
                const active = compass.salaryUnit === unit;
                return (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      triggerHaptic('light');
                      onSilentSaveUpdate(setJobSalaryUnitAction(saveGame, unit));
                    }}
                    className={`min-h-[40px] rounded-lg px-2.5 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-[var(--surface)] text-[var(--primary-strong)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {unit === 'monthly' ? t('careerMarket.monthly') : t('careerMarket.annual')}
                  </button>
                );
              })}
            </div>

            {/* Deck vs List toggle */}
            <button
              type="button"
              data-testid="toggle-deck-mode-btn"
              onClick={() => {
                triggerHaptic('light');
                setViewMode((v) => (v === 'list' ? 'deck' : 'list'));
              }}
              className={`min-h-[44px] rounded-xl border px-3 text-xs font-bold transition-colors ${
                viewMode === 'deck'
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              {viewMode === 'deck' ? t('careerMarket.listMode') : t('careerMarket.deckMode')}
            </button>
          </div>
        }
        stickySubHeader={
          <div className="space-y-2">
            {/* Search + Compare toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('careerMarket.searchPlaceholder')}
                  aria-label="جست‌وجوی شغل"
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] placeholder:text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="پاک کردن جست‌وجو"
                    className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)]"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="toggle-compare-mode-btn"
                onClick={() => {
                  triggerHaptic('light');
                  setCompareMode((prev) => {
                    if (prev) setCompareIds([]);
                    return !prev;
                  });
                }}
                className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-xs font-bold transition-colors ${
                  compareMode
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]'
                }`}
              >
                {compareMode
                  ? `${t('careerMarket.compare')} (${toPersianDigits(compareIds.length)})`
                  : t('careerMarket.compare')}
              </button>
            </div>

            {/* Horizontally scrollable filter & sort chips (44px tap targets) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {EMPLOYER_FILTERS.map((f) => {
                const selected = employerFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEmployerFilter(f.value);
                    }}
                    className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}

              <span className="mx-1 h-5 w-px shrink-0 bg-[var(--border)]" aria-hidden="true" />

              {(
                [
                  { value: 'match', label: t('careerMarket.sortMatch') },
                  { value: 'salary', label: t('careerMarket.sortSalary') },
                  { value: 'readiness', label: t('careerMarket.sortReadiness') },
                ] as const
              ).map((s) => {
                const selected = sortBy === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSortBy(s.value);
                    }}
                    className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}

              <button
                type="button"
                aria-pressed={eligibleOnly}
                onClick={() => {
                  triggerHaptic('light');
                  setEligibleOnly((v) => !v);
                }}
                className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                  eligibleOnly
                    ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t('careerMarket.eligibleOnly')}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Job Compass Priority Strip */}
          <PriorityStrip
            priorities={compass.priorities}
            customized={compass.prioritiesCustomized}
            onOpenEditor={() => setPrioritySheetOpen(true)}
          />

          {/* Talent legend when any job has talent match */}
          {hasAnyTalentMatch && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
              <EmojiSprite emoji="⭐" label="ستاره استعداد" className="text-xs" />
              <span>{t('careerMarket.talentLegend')}</span>
            </div>
          )}

          {/* Compare banner */}
          {compareMode && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--primary)] bg-[var(--primary-soft)]/50 px-3.5 py-2.5">
              <span className="text-xs font-bold text-[var(--text)]">
                {t('careerMarket.comparePickHint')} ({toPersianDigits(compareIds.length)} از ۳)
              </span>
              <button
                type="button"
                data-testid="open-compare-sheet-btn"
                disabled={compareIds.length < 2}
                onClick={() => setCompareSheetOpen(true)}
                className="min-h-[44px] shrink-0 rounded-xl bg-[var(--primary)] px-3.5 text-xs font-bold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('careerMarket.compareShow')}
              </button>
            </div>
          )}

          {/* Deck Mode OR Grouped List */}
          {listings.totalCount === 0 ? (
            <EmptyState
              title={t('careerMarket.noMatches')}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setEmployerFilter('all');
                    setEligibleOnly(false);
                  }}
                  className="min-h-[44px] rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-[var(--on-primary)]"
                >
                  {t('careerMarket.resetFilters')}
                </button>
              }
            />
          ) : viewMode === 'deck' ? (
            <JobDeck
              items={listings.allItems}
              salaryUnit={compass.salaryUnit}
              shortlistedIds={compass.shortlistedJobIds}
              onShortlistAndNext={(jobId) => {
                const res = toggleJobShortlistAction(saveGame, jobId);
                onSilentSaveUpdate(res.save);
              }}
              onOpenDetail={(item) => setSelectedJobId(item.job.id)}
            />
          ) : (
            <div className="space-y-4">
              {listings.ready.length > 0 && (
                <section className="space-y-2" data-testid="job-group-ready">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      {t('careerMarket.readyGroup')}
                    </h3>
                    <span className="rounded-lg bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--success)]">
                      {toPersianDigits(listings.ready.length)} شغل
                    </span>
                  </div>
                  {renderGroupRows(listings.ready)}
                </section>
              )}

              {listings.nearReady.length > 0 && (
                <section className="space-y-2" data-testid="job-group-near-ready">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      {t('careerMarket.nearReadyGroup')}
                    </h3>
                    <span className="rounded-lg bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--primary-strong)]">
                      {toPersianDigits(listings.nearReady.length)} شغل
                    </span>
                  </div>
                  {renderGroupRows(listings.nearReady)}
                </section>
              )}

              {listings.future.length > 0 && (
                <section className="space-y-2" data-testid="job-group-future">
                  <button
                    type="button"
                    data-testid="toggle-future-group-btn"
                    aria-expanded={futureExpanded}
                    onClick={() => {
                      triggerHaptic('light');
                      setFutureExpanded((v) => !v);
                    }}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-right transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--text-muted)]">
                        {t('careerMarket.futureGroup')}
                      </h3>
                      <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--text-muted)]">
                        {toPersianDigits(listings.future.length)} شغل
                      </span>
                    </div>
                    <IconChevronDown
                      className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${
                        futureExpanded ? 'rotate-0' : 'rotate-90'
                      }`}
                    />
                  </button>
                  {futureExpanded && renderGroupRows(listings.future)}
                </section>
              )}
            </div>
          )}
        </div>
      </FullScreenSheet>

      <PrioritySheet
        open={prioritySheetOpen}
        priorities={compass.priorities}
        customized={compass.prioritiesCustomized}
        onClose={() => setPrioritySheetOpen(false)}
        onChange={(next) => onSilentSaveUpdate(setJobPrioritiesAction(saveGame, next, true))}
        onReset={() => onSilentSaveUpdate(resetJobPrioritiesAction(saveGame))}
      />

      <JobDetailSheet
        open={Boolean(selectedItem)}
        item={selectedItem}
        saveGame={saveGame}
        priorities={compass.priorities}
        salaryUnit={compass.salaryUnit}
        isShortlisted={
          selectedItem ? compass.shortlistedJobIds.includes(selectedItem.job.id) : false
        }
        isPinnedGoal={selectedItem ? compass.pinnedJobId === selectedItem.job.id : false}
        isInCompare={selectedItem ? compareIds.includes(selectedItem.job.id) : false}
        onClose={() => setSelectedJobId(null)}
        onToggleShortlist={(jobId) => {
          const res = toggleJobShortlistAction(saveGame, jobId);
          onSilentSaveUpdate(res.save);
        }}
        onTogglePinGoal={(jobId) => onUpdateSave(pinJobGoalAction(saveGame, jobId))}
        onToggleCompare={(jobId) => {
          toggleCompareSelection(jobId);
          if (!compareMode) setCompareMode(true);
        }}
        onStartInterview={(item) => setInterviewJobId(item.job.id)}
        onNavigateGapTarget={(target) => {
          setSelectedJobId(null);
          onNavigateGapTarget(target);
        }}
      />

      <JobInterviewSheet
        open={Boolean(interviewItem)}
        item={interviewItem}
        saveGame={saveGame}
        onClose={() => setInterviewJobId(null)}
        onSubmitInterview={(item, answers) => {
          const outcome = submitJobInterviewAction(saveGame, item.job, answers, gameDataset);
          onUpdateSave(outcome);
          return outcome;
        }}
      />

      <CompareSheet
        open={compareSheetOpen}
        items={compareItems}
        salaryUnit={compass.salaryUnit}
        onClose={() => setCompareSheetOpen(false)}
        onOpenJobDetail={(item) => {
          setCompareSheetOpen(false);
          setSelectedJobId(item.job.id);
        }}
      />
    </>
  );
}
