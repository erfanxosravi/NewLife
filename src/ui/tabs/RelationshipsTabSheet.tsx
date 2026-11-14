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
  getAdoptionHubSummary,
  getGroupedRelationships,
  getNpcHistory,
  getRelationshipActionCosts,
} from '../../state/selectors';
import { AdoptionSheet } from '../AdoptionSheet';
import { PersonAvatar } from '../components/PersonAvatar';
import { FullScreenSheet } from '../components/FullScreenSheet';
import {
  ActionRow,
  Card,
  ConfirmDialog,
  DangerZoneGroup,
  DetailSheet,
  EmptyState,
  FilterChips,
  HubHeroCard,
  InfoSheet,
  SectionGroup,
  SegmentedControl,
  StatBar,
} from '../components/Primitives';
import { FamilyTreeView } from '../FamilyTreeView';
import {
  IconBaby,
  IconGift,
  IconHeart,
  IconPlane,
  IconRelations,
  IconSparkles,
  IconStar,
  IconUser,
  IconWarning,
} from '../icons';

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
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAllDirectory, setShowAllDirectory] = useState(false);
  const [showAllMemories, setShowAllMemories] = useState(false);
  const [showFamilyTree, setShowFamilyTree] = useState(false);
  const [showAdoptionSheet, setShowAdoptionSheet] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmDivorce, setConfirmDivorce] = useState(false);
  const [confirmMarry, setConfirmMarry] = useState(false);

  const grouped = useMemo(() => getGroupedRelationships(state), [state]);
  const adoptionSummary = useMemo(() => getAdoptionHubSummary(state, gameDataset), [state]);

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

  const avgCloseness = useMemo(() => {
    if (grouped.allAlive.length === 0) return 0;
    const sum = grouped.allAlive.reduce((acc, item) => acc + item.rel.closeness, 0);
    return Math.round(sum / grouped.allAlive.length);
  }, [grouped.allAlive]);

  const selectedEntry = useMemo(() => {
    if (!selectedPersonId) return null;
    const rel = state.relationships.find((r) => r.personId === selectedPersonId);
    const person = state.npcs[selectedPersonId];
    if (!rel || !person) return null;
    return { rel, person };
  }, [selectedPersonId, state.npcs, state.relationships]);

  const { giftCost, tripCost, weddingCost } = getRelationshipActionCosts(state, gameDataset);

  const openPersonSheet = (personId: string) => {
    setShowAllMemories(false);
    setSelectedPersonId(personId);
  };

  const renderPersonRow = ({ rel, person }: { rel: Relationship; person: Person }) => {
    const originBadgeFa =
      person.originKind === 'adopted' ||
      person.originKind === 'temporary_guardian' ||
      person.originKind === 'host_family'
        ? t(`adoption.originLabels.${person.originKind}`)
        : null;
    const roleText = originBadgeFa ?? t(`relations.roles.${rel.role}`);
    return (
      <ActionRow
        key={person.id}
        icon={
          <PersonAvatar
            seed={person.avatarSeed ?? person.id}
            gender={person.gender}
            age={person.age}
            size={40}
            originKind={person.originKind}
            deceased={!person.isAlive}
          />
        }
        iconTone={rel.closeness >= 70 ? 'success' : rel.closeness >= 40 ? 'primary' : 'neutral'}
        title={`${person.firstName} ${person.lastName}`}
        subtitle={`${roleText} · ${formatAgeLabel(person.age)} · ${person.jobTitle}`}
        value={`${toPersianDigits(rel.closeness)}٪`}
        showChevron
        onClick={() => openPersonSheet(person.id)}
      />
    );
  };

  const canFindFriend = subTab === 'friends' || subTab === 'all';
  const canFindPartner =
    (subTab === 'romance' || subTab === 'all') &&
    contentSettings.allowRomance &&
    player.age >= 18 &&
    player.maritalStatus !== 'married' &&
    grouped.romance.length === 0;

  const visibleRows = activeList.length > 7 ? activeList.slice(0, 6) : activeList;
  const hasOverflowRows = activeList.length > 7;

  const directoryChunks = useMemo(() => {
    const chunks: { rel: Relationship; person: Person }[][] = [];
    for (let i = 0; i < activeList.length; i += 7) {
      chunks.push(activeList.slice(i, i + 7));
    }
    return chunks;
  }, [activeList]);

  const npcMemories = selectedEntry ? getNpcHistory(state, selectedEntry.person.id) : [];
  const displayedMemories = showAllMemories ? npcMemories : npcMemories.slice(-5);

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      title={t('nav.relations')}
      subtitle={`وضعیت تأهل: ${t(`marital.${player.maritalStatus}`)}`}
      scrollKey={subTab}
      stickySubHeader={
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
      }
    >
      <div className="space-y-4">
        <HubHeroCard
          icon={<IconRelations className="h-5 w-5" />}
          title={t(`marital.${player.maritalStatus}`)}
          subtitle="برای گفت‌وگو، هدیه یا تصمیم‌های خانوادگی روی هر فرد بزن"
          detailsLabel="شجره‌نامه"
          onDetails={() => setShowFamilyTree(true)}
          onInfo={() => setInfoOpen(true)}
          metrics={[
            { label: 'حلقه نزدیکان', value: `${toPersianDigits(grouped.allAlive.length)} نفر` },
            { label: 'میانگین صمیمیت', value: `${toPersianDigits(avgCloseness)}٪` },
            { label: 'فرزندان', value: `${toPersianDigits(grouped.children.length)} فرزند` },
          ]}
        />

        {(subTab === 'children' || adoptionSummary.activeApplication || adoptionSummary.pendingTasksCount > 0) && (
          <SectionGroup title="سرپرستی و فرزندخواندگی">
            <ActionRow
              icon={<IconBaby className="h-4 w-4" />}
              title={t('adoption.entryTitle')}
              subtitle={
                adoptionSummary.pendingTasksCount > 0
                  ? `${toPersianDigits(adoptionSummary.pendingTasksCount)} تکلیف نظارتی در انتظار انجام`
                  : adoptionSummary.activeApplication
                    ? `پرونده فعال · مرحله ${t(`adoption.steps.${adoptionSummary.activeApplication.step}`)}`
                    : adoptionSummary.eligibilityPermanent.eligible
                      ? 'واجد شرایط ثبت درخواست قانونی'
                      : t('adoption.entrySubtitle')
              }
              state={
                adoptionSummary.pendingTasksCount > 0 ||
                adoptionSummary.activeApplication ||
                adoptionSummary.eligibilityPermanent.eligible
                  ? 'recommended'
                  : 'enabled'
              }
              ctaLabel={adoptionSummary.activeApplication ? 'ادامه' : 'مشاهده'}
              showChevron
              onClick={() => setShowAdoptionSheet(true)}
            />
          </SectionGroup>
        )}

        {(canFindFriend || canFindPartner) && (
          <SectionGroup title="آشنایی تازه">
            {canFindFriend && (
              <ActionRow
                icon={<IconUser className="h-4 w-4" />}
                title="پیدا کردن دوست جدید"
                subtitle="آشنایی با هم‌صحبت تازه در محیط کار یا محله"
                value="رایگان"
                state={getActionCooldownRemaining(state, 'find_friend') > 0 ? 'cooldown' : 'enabled'}
                ctaLabel="آشنایی"
                onClick={() =>
                  onUpdateSave(findNewRelationshipAction(saveGame, 'friend', gameDataset))
                }
              />
            )}
            {canFindPartner && (
              <ActionRow
                icon={<IconHeart className="h-4 w-4" />}
                title="آشنایی عاطفی و مقدمات ازدواج"
                subtitle="آشنایی با شریک زندگی بالقوه"
                value="رایگان"
                state={
                  getActionCooldownRemaining(state, 'find_partner') > 0
                    ? 'cooldown'
                    : 'recommended'
                }
                ctaLabel="شروع"
                onClick={() =>
                  onUpdateSave(findNewRelationshipAction(saveGame, 'partner', gameDataset))
                }
              />
            )}
          </SectionGroup>
        )}

        {activeList.length > 0 && (
          <FilterChips
            value={sortBy}
            onChange={setSortBy}
            items={[
              { value: 'closeness', label: 'مرتب: صمیمیت' },
              { value: 'age', label: 'مرتب: سن' },
            ]}
          />
        )}

        {activeList.length > 0 ? (
          <SectionGroup
            title={t(`tabs.${subTab}`)}
            subtitle={`${toPersianDigits(activeList.length)} نفر`}
          >
            {visibleRows.map(renderPersonRow)}
            {hasOverflowRows && (
              <ActionRow
                icon={<IconRelations className="h-4 w-4" />}
                title={`مشاهده همه افراد (${toPersianDigits(activeList.length)} نفر)`}
                subtitle="فهرست کامل این بخش"
                state="recommended"
                showChevron
                onClick={() => setShowAllDirectory(true)}
              />
            )}
          </SectionGroup>
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

        {grouped.deceased.length > 0 && (
          <SectionGroup
            title={`${t('relations.memorial')} (${toPersianDigits(grouped.deceased.length)})`}
            collapsible
            defaultCollapsed
          >
            {grouped.deceased.slice(0, 7).map(({ rel, person }) => (
              <ActionRow
                key={person.id}
                icon={
                  <PersonAvatar
                    seed={person.avatarSeed ?? person.id}
                    gender={person.gender}
                    age={person.age}
                    size={40}
                    originKind={person.originKind}
                    deceased
                  />
                }
                iconTone="neutral"
                title={`${person.firstName} ${person.lastName}`}
                subtitle={t(`relations.roles.${rel.role}`)}
                value={formatAgeLabel(person.age)}
              />
            ))}
          </SectionGroup>
        )}
      </div>

      {/* DRILL-DOWN: Full Relationships Directory when > 7 */}
      <DetailSheet
        open={showAllDirectory}
        onClose={() => setShowAllDirectory(false)}
        title={`فهرست کامل (${t(`tabs.${subTab}`)})`}
        subtitle={`${toPersianDigits(activeList.length)} نفر`}
        zIndexClass="z-[55]"
      >
        {directoryChunks.map((chunk, idx) => (
          <SectionGroup
            key={idx}
            title={
              directoryChunks.length === 1
                ? 'همه افراد'
                : `بخش ${toPersianDigits(idx + 1)} از ${toPersianDigits(directoryChunks.length)}`
            }
          >
            {chunk.map(renderPersonRow)}
          </SectionGroup>
        ))}
      </DetailSheet>

      {/* DRILL-DOWN: Person Detail Sheet */}
      <DetailSheet
        open={selectedEntry !== null}
        onClose={() => setSelectedPersonId(null)}
        title={
          selectedEntry
            ? `${selectedEntry.person.firstName} ${selectedEntry.person.lastName}`
            : ''
        }
        subtitle={
          selectedEntry
            ? `${t(`relations.roles.${selectedEntry.rel.role}`)} · ${formatAgeLabel(selectedEntry.person.age)}`
            : undefined
        }
        zIndexClass="z-[56]"
      >
        {selectedEntry && (
          <>
            <HubHeroCard
              icon={
                <PersonAvatar
                  seed={selectedEntry.person.avatarSeed ?? selectedEntry.person.id}
                  gender={selectedEntry.person.gender}
                  age={selectedEntry.person.age}
                  size={44}
                  originKind={selectedEntry.person.originKind}
                  deceased={!selectedEntry.person.isAlive}
                />
              }
              title={`${selectedEntry.person.firstName} ${selectedEntry.person.lastName}`}
              subtitle={`${
                selectedEntry.person.originKind === 'adopted' ||
                selectedEntry.person.originKind === 'temporary_guardian' ||
                selectedEntry.person.originKind === 'host_family'
                  ? t(`adoption.originLabels.${selectedEntry.person.originKind}`)
                  : t(`relations.roles.${selectedEntry.rel.role}`)
              } · ${selectedEntry.person.jobTitle}${
                selectedEntry.person.traits.length > 0
                  ? ` · ${selectedEntry.person.traits.join('، ')}`
                  : ''
              }`}
              metrics={[
                { label: t('relations.closeness'), value: `${toPersianDigits(selectedEntry.rel.closeness)}٪` },
                { label: t('relations.respect'), value: `${toPersianDigits(selectedEntry.rel.respect)}٪` },
                { label: 'سن', value: formatAgeLabel(selectedEntry.person.age) },
              ]}
            />

            {selectedEntry.person.adoptionMeta && (
              <SectionGroup title="پرونده سرپرستی و نظارت">
                <ActionRow
                  icon={<IconBaby className="h-4 w-4" />}
                  title={
                    selectedEntry.person.originKind === 'adopted' ||
                    selectedEntry.person.originKind === 'temporary_guardian' ||
                    selectedEntry.person.originKind === 'host_family'
                      ? t(`adoption.originLabels.${selectedEntry.person.originKind}`)
                      : 'پرونده سرپرستی'
                  }
                  subtitle={
                    selectedEntry.person.adoptionMeta.supervisionClosedAt18
                      ? `تحویل در سال ${toPersianDigits(selectedEntry.person.adoptionMeta.placedYear)} · نظارت با رسیدن به ۱۸ سالگی به پایان رسید`
                      : `تحویل در سال ${toPersianDigits(selectedEntry.person.adoptionMeta.placedYear)} · نظارت بهزیستی فعال`
                  }
                  showChevron
                  onClick={() => setShowAdoptionSheet(true)}
                />
              </SectionGroup>
            )}

            <Card className="space-y-2.5">
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

            <SectionGroup title="گفت‌وگو و تعامل">
              <ActionRow
                icon={<IconRelations className="h-4 w-4" />}
                title="گپ صمیمی و احوال‌پرسی"
                subtitle="صمیمیت +۸ · شادی +۳"
                value="رایگان"
                state={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_talk`) > 0
                    ? 'cooldown'
                    : 'recommended'
                }
                ctaLabel="گفت‌وگو"
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(saveGame, selectedEntry.person.id, 'talk', gameDataset),
                  )
                }
              />
              <ActionRow
                icon={<IconGift className="h-4 w-4" />}
                title="خرید هدیه"
                subtitle="صمیمیت +۱۴ · احترام +۸"
                value={formatToman(giftCost)}
                state={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_gift`) > 0
                    ? 'cooldown'
                    : player.moneyToman < giftCost
                      ? 'disabled'
                      : 'enabled'
                }
                reason={player.moneyToman < giftCost ? 'موجودی کافی نیست' : undefined}
                ctaLabel="هدیه"
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(saveGame, selectedEntry.person.id, 'gift', gameDataset),
                  )
                }
              />
              <ActionRow
                icon={<IconStar className="h-4 w-4" />}
                title="تعریف و قدردانی"
                subtitle="احترام +۶ · صمیمیت +۶"
                value="رایگان"
                state={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_compliment`) > 0
                    ? 'cooldown'
                    : 'enabled'
                }
                ctaLabel="قدردانی"
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
              <ActionRow
                icon={<IconPlane className="h-4 w-4" />}
                title="سفر و تفریح مشترک"
                subtitle="صمیمیت +۱۶ · سلامت روان +۶"
                value={formatToman(tripCost)}
                state={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_trip`) > 0
                    ? 'cooldown'
                    : player.moneyToman < tripCost
                      ? 'disabled'
                      : 'enabled'
                }
                reason={player.moneyToman < tripCost ? 'موجودی کافی نیست' : undefined}
                ctaLabel="سفر"
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(saveGame, selectedEntry.person.id, 'trip', gameDataset),
                  )
                }
              />

              {selectedEntry.rel.role === 'partner' &&
                contentSettings.allowRomance &&
                player.maritalStatus !== 'engaged' && (
                  <ActionRow
                    icon={<IconHeart className="h-4 w-4" />}
                    title="خواستگاری و بله‌برون"
                    subtitle="آغاز نامزدی رسمی و آمادگی برای ازدواج"
                    value="رایگان"
                    state="recommended"
                    ctaLabel="نامزدی"
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
                <ActionRow
                  icon={<IconSparkles className="h-4 w-4" />}
                  title="برگزاری مراسم ازدواج و تعیین مهریه"
                  subtitle="شادی +۱۲ · آغاز زندگی مشترک رسمی"
                  value={formatToman(weddingCost)}
                  state={player.moneyToman < weddingCost ? 'disabled' : 'recommended'}
                  reason={player.moneyToman < weddingCost ? 'موجودی کافی نیست' : undefined}
                  ctaLabel="ازدواج"
                  onClick={() => setConfirmMarry(true)}
                />
              )}

              {selectedEntry.rel.role === 'spouse' && (
                <ActionRow
                  icon={<IconBaby className="h-4 w-4" />}
                  title="فرزندآوری"
                  subtitle="تولد فرزند جدید و ثبت در شجره‌نامه"
                  value="رایگان"
                  state={
                    getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_have_child`) >
                    0
                      ? 'cooldown'
                      : player.age > 48
                        ? 'locked'
                        : 'enabled'
                  }
                  reason={player.age > 48 ? 'سن مناسب فرزندآوری گذشته است' : undefined}
                  ctaLabel="اقدام"
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
              )}
            </SectionGroup>

            <SectionGroup title="خاطرات مشترک">
              {npcMemories.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-[var(--text-muted)]">
                  هنوز خاطره‌ای ثبت نشده است.
                </div>
              ) : (
                <>
                  {displayedMemories.map((h, i) => (
                    <ActionRow
                      key={i}
                      title={formatAgeLabel(h.age)}
                      subtitle={h.text}
                    />
                  ))}
                  {npcMemories.length > 5 && !showAllMemories && (
                    <ActionRow
                      icon={<IconRelations className="h-4 w-4" />}
                      title={`نمایش همه خاطرات (${toPersianDigits(npcMemories.length)} مورد)`}
                      showChevron
                      onClick={() => setShowAllMemories(true)}
                    />
                  )}
                </>
              )}
            </SectionGroup>

            <DangerZoneGroup title="گزینه‌های حساس">
              <ActionRow
                variant="danger"
                icon={<IconWarning className="h-4 w-4" />}
                title="بحث و دلخوری"
                subtitle="کاهش صمیمیت و احترام"
                state={
                  getActionCooldownRemaining(state, `rel_${selectedEntry.person.id}_argue`) > 0
                    ? 'cooldown'
                    : 'enabled'
                }
                ctaLabel="اجرا"
                onClick={() =>
                  onUpdateSave(
                    interactWithPersonAction(saveGame, selectedEntry.person.id, 'argue', gameDataset),
                  )
                }
              />
              {selectedEntry.rel.role === 'spouse' && (
                <ActionRow
                  variant="danger"
                  icon={<IconWarning className="h-4 w-4" />}
                  title="جدایی و طلاق"
                  subtitle="پایان دادن به زندگی مشترک رسمی"
                  ctaLabel="جدایی"
                  onClick={() => setConfirmDivorce(true)}
                />
              )}
            </DangerZoneGroup>
          </>
        )}
      </DetailSheet>

      {/* Family Tree FullScreenSheet */}
      <FullScreenSheet
        open={showFamilyTree}
        onClose={() => setShowFamilyTree(false)}
        title="شجره‌نامه خانواده"
        subtitle={`${player.firstName} ${player.lastName}`}
        zIndexClass="z-[55]"
      >
        <FamilyTreeView state={state} />
      </FullScreenSheet>

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="مدیریت روابط"
        bullets={[
          'گفت‌وگو، هدیه و سفر صمیمیت و احترام را در طول سال‌ها زنده نگه می‌دارند.',
          'بیشتر تعاملات برای هر فرد یک بار در سال انجام می‌شوند.',
          'تصمیم‌های حساس مثل بحث یا جدایی در پایین صفحه جزئیات فرد قرار دارند.',
        ]}
      />

      <ConfirmDialog
        open={confirmMarry}
        title="برگزاری مراسم ازدواج"
        message={
          selectedEntry
            ? `آیا برای آغاز زندگی مشترک رسمی با ${selectedEntry.person.firstName} ${selectedEntry.person.lastName} به هزینه ${formatToman(weddingCost)} آماده‌ای؟`
            : ''
        }
        confirmLabel="برگزاری مراسم"
        onCancel={() => setConfirmMarry(false)}
        onConfirm={() => {
          if (selectedEntry) {
            onUpdateSave(
              interactWithPersonAction(
                saveGame,
                selectedEntry.person.id,
                'marry',
                gameDataset,
              ),
            );
          }
          setConfirmMarry(false);
        }}
      />

      <ConfirmDialog
        open={confirmDivorce}
        title="تأیید جدایی"
        message="آیا مطمئنی می‌خواهی زندگی مشترک را به پایان برسانی؟ این تصمیم بر شادی و آرامش اثر می‌گذارد."
        confirmLabel="تأیید جدایی"
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
      <AdoptionSheet
        open={showAdoptionSheet}
        saveGame={saveGame}
        onClose={() => setShowAdoptionSheet(false)}
        onUpdateSave={onUpdateSave}
      />
    </FullScreenSheet>
  );
}
