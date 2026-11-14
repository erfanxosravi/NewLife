import { useMemo, useState } from 'react';
import { gameDataset } from '../../data/registry';
import { formatAgeLabel, formatToman, toPersianDigits } from '../../engine/jalali';
import type { Person, Relationship, SaveGame } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import {
  findNewRelationshipAction,
  interactWithPersonAction,
  type ActionOutcome,
} from '../../state/actions';
import {
  getActionCooldownRemaining,
  getGroupedRelationships,
  getNpcHistory,
  getRelationshipActionCosts,
} from '../../state/selectors';
import { BottomSheet } from '../components/BottomSheet';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  ListRow,
  SectionHeader,
  SegmentedControl,
  StatBar,
} from '../components/Primitives';
import { FamilyTreeView } from '../FamilyTreeView';
import { IconBaby, IconHeart, IconRelations, IconUser } from '../icons';

interface RelationshipsTabSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

type RelTab = 'all' | 'family' | 'friends' | 'romance' | 'children';
type SortMode = 'closeness' | 'age';

export function RelationshipsTabSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: RelationshipsTabSheetProps) {
  const { t } = useI18n();
  const { state, contentSettings } = saveGame;
  const { player } = state;

  const [subTab, setSubTab] = useState<RelTab>('all');
  const [sortBy, setSortBy] = useState<SortMode>('closeness');
  const [showMemorial, setShowMemorial] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showFamilyTree, setShowFamilyTree] = useState(false);
  const [confirmDivorce, setConfirmDivorce] = useState(false);

  const grouped = useMemo(() => getGroupedRelationships(state), [state]);

  const activeList = useMemo(() => {
    const base =
      subTab === 'family'
        ? grouped.family
        : subTab === 'friends'
          ? grouped.friends
          : subTab === 'romance'
            ? grouped.romance
            : subTab === 'children'
              ? grouped.children
              : grouped.allAlive;

    return [...base].sort((a, b) =>
      sortBy === 'closeness' ? b.rel.closeness - a.rel.closeness : b.person.age - a.person.age,
    );
  }, [grouped, subTab, sortBy]);

  const selectedEntry = useMemo(() => {
    if (!selectedPersonId) return null;
    const rel = state.relationships.find((r) => r.personId === selectedPersonId);
    const person = state.npcs[selectedPersonId];
    if (!rel || !person) return null;
    return { rel, person };
  }, [selectedPersonId, state.npcs, state.relationships]);

  const { giftCost, tripCost, weddingCost } = getRelationshipActionCosts(state, gameDataset);

  const renderPersonRow = ({ rel, person }: { rel: Relationship; person: Person }) => {
    const initial = person.firstName.trim().charAt(0) || '؟';
    return (
      <ListRow
        key={person.id}
        title={`${person.firstName} ${person.lastName}`}
        subtitle={`${t(`relations.roles.${rel.role}`)} · ${formatAgeLabel(person.age)} · ${person.jobTitle}`}
        leading={
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary-strong)]">
            {initial}
          </div>
        }
        trailing={
          <div className="text-left">
            <Badge tone={rel.closeness >= 70 ? 'success' : rel.closeness >= 40 ? 'primary' : 'danger'}>
              {toPersianDigits(rel.closeness)}٪
            </Badge>
          </div>
        }
        onClick={() => setSelectedPersonId(person.id)}
      />
    );
  };

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.relations')}
      subtitle={`وضعیت تأهل: ${t(`marital.${player.maritalStatus}`)}`}
      headerRight={
        <button
          type="button"
          onClick={() => setShowFamilyTree(true)}
          className="min-h-[38px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-xs font-bold text-[var(--primary-strong)]"
        >
          شجره‌نامه
        </button>
      }
    >
      <div className="space-y-3.5">
        <SegmentedControl
          value={subTab}
          onChange={setSubTab}
          items={[
            { value: 'all', label: t('tabs.all') },
            { value: 'family', label: t('tabs.family') },
            { value: 'friends', label: t('tabs.friends') },
            { value: 'romance', label: t('tabs.romance') },
            { value: 'children', label: t('tabs.children') },
          ]}
        />

        <div className="flex items-center justify-between gap-2">
          <FilterChips
            value={sortBy}
            onChange={setSortBy}
            items={[
              { value: 'closeness', label: 'مرتب: صمیمیت' },
              { value: 'age', label: 'مرتب: سن' },
            ]}
          />
        </div>

        {/* Quick Meet Actions */}
        {(subTab === 'friends' || subTab === 'all') && (
          <ActionButton
            label="پیدا کردن دوست جدید"
            costText="رایگان"
            effectHint="آشنایی با هم‌صحبت تازه در محیط کار یا محله"
            variant="secondary"
            disabled={getActionCooldownRemaining(state, 'find_friend') > 0}
            disabledReason={
              getActionCooldownRemaining(state, 'find_friend') > 0
                ? 'فقط یک بار در سال'
                : undefined
            }
            onClick={() => onUpdateSave(findNewRelationshipAction(saveGame, 'friend', gameDataset))}
          />
        )}

        {(subTab === 'romance' || subTab === 'all') &&
          contentSettings.allowRomance &&
          player.age >= 18 &&
          player.maritalStatus !== 'married' &&
          grouped.romance.length === 0 && (
            <ActionButton
              label="آشنایی عاطفی و مقدمات ازدواج"
              costText="رایگان"
              effectHint="آشنایی با شریک زندگی بالقوه"
              disabled={getActionCooldownRemaining(state, 'find_partner') > 0}
              disabledReason={
                getActionCooldownRemaining(state, 'find_partner') > 0
                  ? 'فقط یک بار در سال'
                  : undefined
              }
              onClick={() =>
                onUpdateSave(findNewRelationshipAction(saveGame, 'partner', gameDataset))
              }
            />
          )}

        {/* List */}
        {activeList.length > 0 ? (
          <div className="space-y-2">{activeList.map(renderPersonRow)}</div>
        ) : (
          <EmptyState
            icon={
              subTab === 'romance' ? (
                <IconHeart className="h-5 w-5" />
              ) : subTab === 'children' ? (
                <IconBaby className="h-5 w-5" />
              ) : (
                <IconRelations className="h-5 w-5" />
              )
            }
            title="هنوز فردی در این بخش نیست"
            description="با گذر سال‌ها و تعاملات اجتماعی، روابط تازه‌ای در این بخش شکل می‌گیرد."
          />
        )}

        {/* Collapsed Deceased Memorial */}
        {grouped.deceased.length > 0 && (
          <Card className="space-y-2">
            <button
              type="button"
              onClick={() => setShowMemorial((v) => !v)}
              className="flex min-h-[40px] w-full items-center justify-between text-xs font-bold text-[var(--text-muted)]"
            >
              <span>
                {t('relations.memorial')} ({toPersianDigits(grouped.deceased.length)})
              </span>
              <span>{showMemorial ? 'بستن' : 'نمایش'}</span>
            </button>
            {showMemorial && (
              <div className="space-y-1.5 pt-1">
                {grouped.deceased.map(({ rel, person }) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs opacity-80"
                  >
                    <span className="font-bold">
                      {person.firstName} {person.lastName}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {t(`relations.roles.${rel.role}`)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Person Detail BottomSheet */}
      <BottomSheet
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedPersonId(null)}
        title={
          selectedEntry
            ? `${selectedEntry.person.firstName} ${selectedEntry.person.lastName}`
            : ''
        }
        subtitle={
          selectedEntry
            ? `${t(`relations.roles.${selectedEntry.rel.role}`)} · ${formatAgeLabel(selectedEntry.person.age)} · ${selectedEntry.person.jobTitle}`
            : undefined
        }
        snap="full"
      >
        {selectedEntry && (
          <div className="space-y-4">
            <Card className="space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {selectedEntry.person.traits.map((tr) => (
                  <Badge key={tr} tone="primary">
                    {tr}
                  </Badge>
                ))}
              </div>
              <StatBar
                label={t('relations.closeness')}
                value={selectedEntry.rel.closeness}
                colorVar="--stat-happiness"
              />
              <StatBar
                label={t('relations.respect')}
                value={selectedEntry.rel.respect}
                colorVar="--stat-smarts"
              />
              {(selectedEntry.rel.role === 'partner' || selectedEntry.rel.role === 'spouse') && (
                <StatBar
                  label={t('relations.romance')}
                  value={selectedEntry.rel.romance}
                  colorVar="--stat-health"
                />
              )}
            </Card>

            <div className="space-y-2">
              <SectionHeader title="گفت‌وگو و اقدام" />
              <ActionButton
                label="گپ صمیمی و احوال‌پرسی"
                costText="رایگان"
                effectHint="صمیمیت +۸ · شادی +۳"
                disabled={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_talk`) > 0
                }
                disabledReason={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_talk`) > 0
                    ? 'فقط یک بار در سال'
                    : undefined
                }
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(
                      saveGame,
                      selectedEntry.person.id,
                      'talk',
                      gameDataset,
                    ),
                  )
                }
              />
              <ActionButton
                label="خرید هدیه"
                costText={formatToman(giftCost)}
                effectHint="صمیمیت +۱۴ · احترام +۸"
                variant="secondary"
                disabled={
                  player.moneyToman < giftCost ||
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_gift`) > 0
                }
                disabledReason={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_gift`) > 0
                    ? 'فقط یک بار در سال'
                    : player.moneyToman < giftCost
                      ? 'موجودی کافی نیست'
                      : undefined
                }
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(
                      saveGame,
                      selectedEntry.person.id,
                      'gift',
                      gameDataset,
                    ),
                  )
                }
              />
              <ActionButton
                label="تعریف و قدردانی"
                costText="رایگان"
                effectHint="احترام +۶ · صمیمیت +۶"
                variant="secondary"
                disabled={
                  getActionCooldownRemaining(
                    state,
                    `rel_${selectedEntry.person.id}_compliment`,
                  ) > 0
                }
                disabledReason={
                  getActionCooldownRemaining(
                    state,
                    `rel_${selectedEntry.person.id}_compliment`,
                  ) > 0
                    ? 'فقط یک بار در سال'
                    : undefined
                }
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(
                      saveGame,
                      selectedEntry.person.id,
                      'compliment',
                      gameDataset,
                    ),
                  )
                }
              />
              <ActionButton
                label="سفر و تفریح مشترک"
                costText={formatToman(tripCost)}
                effectHint="صمیمیت +۱۶ · سلامت روان +۶"
                variant="secondary"
                disabled={
                  player.moneyToman < tripCost ||
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_trip`) > 0
                }
                disabledReason={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_trip`) > 0
                    ? 'فقط یک بار در سال'
                    : player.moneyToman < tripCost
                      ? 'موجودی کافی نیست'
                      : undefined
                }
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(
                      saveGame,
                      selectedEntry.person.id,
                      'trip',
                      gameDataset,
                    ),
                  )
                }
              />
              <ActionButton
                label="بحث و دلخوری"
                costText="بدون هزینه"
                effectHint="کاهش صمیمیت و احترام"
                variant="secondary"
                disabled={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_argue`) > 0
                }
                disabledReason={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_argue`) > 0
                    ? 'فقط یک بار در سال'
                    : undefined
                }
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(
                      saveGame,
                      selectedEntry.person.id,
                      'argue',
                      gameDataset,
                    ),
                  )
                }
              />

              {/* Marriage & Family Flow */}
              {selectedEntry.rel.role === 'partner' &&
                contentSettings.allowRomance &&
                player.maritalStatus !== 'engaged' && (
                  <ActionButton
                    label="خواستگاری و بله‌برون"
                    costText="رایگان"
                    effectHint="آغاز نامزدی رسمی و آمادگی برای ازدواج"
                    onClick={() =>
                      onUpdateSave(
                        interactWithPersonAction(
                          saveGame,
                          selectedEntry.person.id,
                          'propose',
                          gameDataset,
                        ),
                      )
                    }
                  />
                )}

              {selectedEntry.rel.role === 'partner' && contentSettings.allowRomance && (
                <ActionButton
                  label="برگزاری مراسم ازدواج و تعیین مهریه"
                  costText={formatToman(weddingCost)}
                  effectHint="شادی +۱۲ · آغاز زندگی مشترک رسمی"
                  disabled={player.moneyToman < weddingCost}
                  disabledReason={
                    player.moneyToman < weddingCost ? 'موجودی کافی نیست' : undefined
                  }
                  onClick={() =>
                    onUpdateSave(
                      interactWithPersonAction(
                        saveGame,
                        selectedEntry.person.id,
                        'marry',
                        gameDataset,
                      ),
                    )
                  }
                />
              )}

              {selectedEntry.rel.role === 'spouse' && (
                <>
                  <ActionButton
                    label="فرزندآوری"
                    costText="رایگان"
                    effectHint="تولد فرزند جدید و ثبت در شجره‌نامه"
                    disabled={
                      player.age > 48 ||
                      getActionCooldownRemaining(
                        state,
                        `rel_${selectedEntry.person.id}_have_child`,
                      ) > 0
                    }
                    disabledReason={
                      getActionCooldownRemaining(
                        state,
                        `rel_${selectedEntry.person.id}_have_child`,
                      ) > 0
                        ? 'فقط یک بار در سال'
                        : player.age > 48
                          ? 'سن مناسب فرزندآوری گذشته است'
                          : undefined
                    }
                    onClick={() =>
                      onUpdateSave(
                        interactWithPersonAction(
                          saveGame,
                          selectedEntry.person.id,
                          'have_child',
                          gameDataset,
                        ),
                      )
                    }
                  />
                  <ActionButton
                    label="جدایی و طلاق"
                    variant="danger"
                    onClick={() => setConfirmDivorce(true)}
                  />
                </>
              )}
            </div>

            {/* Interaction History */}
            <Card className="space-y-2">
              <SectionHeader title="خاطرات مشترک" />
              {getNpcHistory(state, selectedEntry.person.id).length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  هنوز خاطره‌ای ثبت نشده است.
                </p>
              ) : (
                getNpcHistory(state, selectedEntry.person.id).map((h, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed"
                  >
                    <span className="font-bold text-[var(--primary-strong)]">
                      {formatAgeLabel(h.age)}:
                    </span>{' '}
                    {h.text}
                  </div>
                ))
              )}
            </Card>
          </div>
        )}
      </BottomSheet>

      {/* Family Tree FullScreenSheet */}
      <FullScreenSheet
        open={showFamilyTree}
        onClose={() => setShowFamilyTree(false)}
        title="شجره‌نامه خانواده"
        subtitle={`${player.firstName} ${player.lastName}`}
      >
        <FamilyTreeView state={state} />
      </FullScreenSheet>

      <ConfirmDialog
        open={confirmDivorce}
        title="تأیید جدایی"
        message="آیا مطمئنی می‌خواهی زندگی مشترک را به پایان برسانی؟ این تصمیم بر شادی و آرامش اثر می‌گذارد."
        destructive
        onCancel={() => setConfirmDivorce(false)}
        onConfirm={() => {
          if (selectedEntry) {
            onUpdateSave(
              interactWithPersonAction(
                saveGame,
                selectedEntry.person.id,
                'divorce',
                gameDataset,
              ),
            );
            setSelectedPersonId(null);
          }
          setConfirmDivorce(false);
        }}
      />
    </FullScreenSheet>
  );
}
