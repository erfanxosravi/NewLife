import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import type { GameState } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import { getGroupedRelationships } from '../state/selectors';
import { Badge, Card, EmptyState, SectionHeader } from './components/Primitives';
import { IconBaby, IconHeart, IconUser } from './icons';

export function FamilyTreeView({ state }: { state: GameState }) {
  const { t } = useI18n();
  const { family, romance, children, deceased } = getGroupedRelationships(state);

  const parents = family.filter((f) => f.rel.role === 'father' || f.rel.role === 'mother');
  const siblings = family.filter((f) => f.rel.role === 'sibling');
  const spouse = romance.find((r) => r.rel.role === 'spouse' || r.rel.role === 'partner');
  const deceasedParents = deceased.filter(
    (d) => d.rel.role === 'father' || d.rel.role === 'mother',
  );

  const allParents = [...parents, ...deceasedParents];

  const NodeBox = ({
    name,
    role,
    age,
    alive = true,
    highlight = false,
  }: {
    name: string;
    role: string;
    age: number;
    alive?: boolean;
    highlight?: boolean;
  }) => (
    <div
      className={`rounded-2xl border px-3 py-2 text-center ${
        highlight
          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]'
      } ${!alive ? 'opacity-65' : ''}`}
    >
      <div className="text-xs font-bold text-[var(--text)]">{name}</div>
      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        {role} · {alive ? formatAgeLabel(age) : 'درگذشته'}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
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
                alive={person.isAlive}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={<IconUser className="h-5 w-5" />} title="اطلاعات والدین ثبت نشده" />
        )}

        <div className="mx-auto h-5 w-0.5 bg-[var(--border)]" />

        <SectionHeader title="نسل تو و همراهان" />
        <div className="grid grid-cols-2 gap-2">
          <NodeBox
            name={`${state.player.firstName} ${state.player.lastName}`}
            role="شخصیت اصلی"
            age={state.player.age}
            highlight
          />
          {spouse ? (
            <NodeBox
              name={`${spouse.person.firstName} ${spouse.person.lastName}`}
              role={t(`relations.roles.${spouse.rel.role}`)}
              age={spouse.person.age}
              alive={spouse.person.isAlive}
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
              {children.map(({ person }) => (
                <NodeBox
                  key={person.id}
                  name={`${person.firstName} ${person.lastName}`}
                  role={person.gender === 'male' ? 'پسر' : 'دختر'}
                  age={person.age}
                  alive={person.isAlive}
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
  );
}
