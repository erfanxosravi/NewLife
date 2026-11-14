import { useState } from 'react';
import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import type { GameState, Gender, PersonOriginKind } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getGroupedRelationships } from '../state/selectors';
import { PersonAvatar } from './components/PersonAvatar';
import { Badge, Card, EmptyState, SectionHeader } from './components/Primitives';
import { IconBaby, IconHeart, IconUser } from './icons';

export function FamilyTreeView({ state }: { state: GameState }) {
  const { t } = useI18n();
  const { family, romance, children, deceased } = getGroupedRelationships(state);
  const [zoom, setZoom] = useState<number>(1);

  const parents = family.filter((f) => f.rel.role === 'father' || f.rel.role === 'mother');
  const siblings = family.filter((f) => f.rel.role === 'sibling');
  const grandchildren = family.filter((f) => f.rel.role === 'grandchild');
  const spouse = romance.find((r) => r.rel.role === 'spouse' || r.rel.role === 'partner');
  const deceasedParents = deceased.filter(
    (d) => d.rel.role === 'father' || d.rel.role === 'mother',
  );

  const allParents = [...parents, ...deceasedParents];
  const chapters = state.dynasty?.chapters ?? [];

  const NodeBox = ({
    name,
    role,
    age,
    spanFa,
    jobFa,
    alive = true,
    highlight = false,
    avatarSeed,
    gender,
    originKind,
  }: {
    name: string;
    role: string;
    age?: number;
    spanFa?: string;
    jobFa?: string;
    alive?: boolean;
    highlight?: boolean;
    avatarSeed?: string;
    gender?: Gender;
    originKind?: PersonOriginKind;
  }) => (
    <div
      className={`rounded-2xl border px-3 py-2 text-center ${
        highlight
          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]'
      } ${!alive ? 'opacity-75' : ''}`}
    >
      {gender && age !== undefined && (
        <div className="mb-1.5 flex justify-center">
          <PersonAvatar
            seed={avatarSeed ?? name}
            gender={gender}
            age={age}
            size={36}
            originKind={originKind}
            deceased={!alive}
          />
        </div>
      )}
      <div className="truncate text-xs font-bold text-[var(--text)]">{name}</div>
      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        {role}
        {spanFa
          ? ` · ${spanFa}`
          : age !== undefined
            ? ` · ${alive ? formatAgeLabel(age) : 'درگذشته'}`
            : ''}
      </div>
      {jobFa && (
        <div className="mt-0.5 truncate text-[10px] font-medium text-[var(--primary-strong)]">
          {jobFa}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs font-bold text-[var(--text)]">
          نمای شجره‌نامه ({toPersianDigits(Math.round(zoom * 100))}٪)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="کوچک‌نمایی شجره‌نامه"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            className="min-h-[36px] min-w-[36px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--text)]"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-h-[36px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] font-bold text-[var(--text-muted)]"
          >
            ۱۰۰٪
          </button>
          <button
            type="button"
            aria-label="بزرگ‌نمایی شجره‌نامه"
            onClick={() => setZoom((z) => Math.min(1.3, Number((z + 0.15).toFixed(2))))}
            className="min-h-[36px] min-w-[36px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--text)]"
          >
            +
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div
          className="space-y-4 origin-top-right transition-transform"
          style={{
            transform: `scale(${zoom})`,
            width: zoom > 1 ? `${Math.round(100 / zoom)}%` : '100%',
          }}
        >
          {chapters.length > 0 && (
            <div className="space-y-2.5">
              <SectionHeader
                title="نیاکان و نسل‌های پیشین"
                subtitle={`${toPersianDigits(chapters.length)} نسل ثبت‌شده در دودمان`}
              />
              <div className="space-y-2">
                {chapters.map((ch) => (
                  <div key={`${ch.generation}_${ch.deathYear}`} className="space-y-2">
                    <NodeBox
                      name={`${ch.firstName} ${ch.lastName}`}
                      role={`نسل ${toPersianDigits(ch.generation)} · ${formatAgeLabel(ch.ageAtDeath)}`}
                      spanFa={`${toPersianDigits(ch.birthYear)} تا ${toPersianDigits(ch.deathYear)}`}
                      jobFa={ch.highestJobTitleFa}
                      alive={false}
                    />
                    <div className="mx-auto h-4 w-0.5 bg-[var(--border)]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card className="space-y-4">
            <SectionHeader title="نسل والدین" />
            {allParents.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {allParents.map(({ rel, person }) => (
                  <NodeBox
                    key={person.id}
                    name={`${person.firstName} ${person.lastName}`}
                    role={t(`relations.roles.${rel.role}`)}
                    age={person.age}
                    jobFa={person.jobTitle}
                    alive={person.isAlive}
                    avatarSeed={person.avatarSeed ?? person.id}
                    gender={person.gender}
                    originKind={person.originKind}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={<IconUser className="h-5 w-5" />} title="اطلاعات والدین ثبت نشده" />
            )}

            <div className="mx-auto h-5 w-0.5 bg-[var(--border)]" />

            <SectionHeader
              title={`نسل ${toPersianDigits(state.dynasty?.currentGeneration ?? 1)} · شخصیت فعلی`}
            />
            <div className="grid grid-cols-2 gap-2">
              <NodeBox
                name={`${state.player.firstName} ${state.player.lastName}`}
                role="شخصیت اصلی"
                age={state.player.age}
                jobFa={state.ownedBusiness?.nameFa ?? state.player.job?.title}
                alive={state.isAlive}
                avatarSeed={state.player.avatarSeed ?? 'player'}
                gender={state.player.gender}
                highlight
              />
              {spouse ? (
                <NodeBox
                  name={`${spouse.person.firstName} ${spouse.person.lastName}`}
                  role={t(`relations.roles.${spouse.rel.role}`)}
                  age={spouse.person.age}
                  jobFa={spouse.person.jobTitle}
                  alive={spouse.person.isAlive}
                  avatarSeed={spouse.person.avatarSeed ?? spouse.person.id}
                  gender={spouse.person.gender}
                />
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-2 text-[11px] text-[var(--text-muted)]">
                  <IconHeart className="ml-1 h-3.5 w-3.5" />
                  {t(`marital.${state.player.maritalStatus}`)}
                </div>
              )}
            </div>

            {siblings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-[var(--text-muted)]">
                  خواهر و برادرها ({toPersianDigits(siblings.length)})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {siblings.map(({ person }) => (
                    <Badge key={person.id} tone="neutral">
                      {person.firstName} ({formatAgeLabel(person.age)})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {children.length > 0 && (
              <>
                <div className="mx-auto h-5 w-0.5 bg-[var(--border)]" />
                <SectionHeader title="فرزندان" />
                <div className="grid grid-cols-2 gap-2">
                  {children.map(({ person }) => {
                    const originSuffix =
                      person.originKind === 'adopted'
                        ? ' · فرزندخوانده'
                        : person.originKind === 'temporary_guardian'
                          ? ' · امین موقت'
                          : person.originKind === 'host_family'
                            ? ' · میهمان'
                            : '';
                    return (
                      <NodeBox
                        key={person.id}
                        name={`${person.firstName} ${person.lastName}`}
                        role={`${person.gender === 'male' ? 'پسر' : 'دختر'}${originSuffix}`}
                        age={person.age}
                        jobFa={person.jobTitle}
                        alive={person.isAlive}
                        avatarSeed={person.avatarSeed ?? person.id}
                        gender={person.gender}
                        originKind={person.originKind}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {grandchildren.length > 0 && (
              <>
                <div className="mx-auto h-5 w-0.5 bg-[var(--border)]" />
                <SectionHeader title="نوه‌ها" />
                <div className="grid grid-cols-2 gap-2">
                  {grandchildren.map(({ person }) => (
                    <NodeBox
                      key={person.id}
                      name={`${person.firstName} ${person.lastName}`}
                      role="نوه"
                      age={person.age}
                      alive={person.isAlive}
                      avatarSeed={person.avatarSeed ?? person.id}
                      gender={person.gender}
                    />
                  ))}
                </div>
              </>
            )}
          </Card>

          {children.length === 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
              <IconBaby className="h-4 w-4 text-[var(--primary)]" />
              <span>پس از ازدواج و تولد فرزند، شاخه فرزندان اینجا نمایش داده می‌شود.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
