import { useMemo, useState } from 'react';
import { gameDataset } from '../data/registry';
import { ADOPTION_STEP_ORDER, getAdoptionStepIndex } from '../engine/adoption';
import { getBaselineScaleFromMinWage } from '../engine/economy';
import { formatAgeLabel, toPersianDigits } from '../engine/jalali';
import type { AdoptionCareType, AdoptionStepId, SaveGame } from '../engine/types';
import { useI18n } from '../i18n/useI18n';
import {
  abandonAdoptionApplicationAction,
  advanceAdoptionFromReadinessAction,
  completeAdoptionDocumentAction,
  completeAdoptionSupervisionTaskAction,
  conductAdoptionBondingMeetingAction,
  finalizeAdoptionPlacementAction,
  obtainInfertilityCertificateAction,
  respondAdoptionCommitmentAction,
  runAdoptionEvaluationNowAction,
  selectAdoptionCandidateAction,
  startOrSelectAdoptionCareTypeAction,
  submitAdoptionApplicationAction,
  type ActionOutcome,
} from '../state/actions';
import { getAdoptionHubSummary } from '../state/selectors';
import { ChecklistCard, InspectorVisitCard } from './components/AdoptionCards';
import { MoneyText } from './components/MoneyText';
import { PersonAvatar } from './components/PersonAvatar';
import {
  ActionButton,
  ActionRow,
  Badge,
  Card,
  ConfirmDialog,
  DangerZoneGroup,
  DetailSheet,
  HubHeroCard,
  InfoSheet,
  ProgressStepper,
  RequirementsChecklist,
  SectionGroup,
  SectionHeader,
  SegmentedControl,
  Toggle,
} from './components/Primitives';
import {
  IconBaby,
  IconCheck,
  IconHeart,
  IconShield,
  IconSparkles,
  IconWarning,
} from './icons';

interface AdoptionSheetProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

export function AdoptionSheet({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: AdoptionSheetProps) {
  const { t } = useI18n();
  const { state } = saveGame;
  const { player } = state;

  const summary = useMemo(() => getAdoptionHubSummary(state, gameDataset), [state]);
  const activeApp = summary.activeApplication;
  const currentStep: AdoptionStepId = activeApp?.step ?? 'readiness';
  const currentCareType: AdoptionCareType = activeApp?.careType ?? 'permanent';

  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [customFirstName, setCustomFirstName] = useState('');
  const [enrollSchool, setEnrollSchool] = useState(true);

  const careDef =
    gameDataset.adoption.careTypes.find((c) => c.id === currentCareType) ??
    gameDataset.adoption.careTypes[0];

  const currentStepIndex = getAdoptionStepIndex(currentStep);

  const placedChild = activeApp?.placedChildPersonId
    ? state.npcs[activeApp.placedChildPersonId]
    : undefined;
  const inspectorNpc = activeApp?.inspectorPersonId
    ? state.npcs[activeApp.inspectorPersonId]
    : undefined;

  const selectedCandidate = activeApp?.selectedCandidateId
    ? activeApp.matchedCandidates.find((c) => c.tempId === activeApp.selectedCandidateId)
    : undefined;

  const requiredBondingMeetings = gameDataset.adoption.matching.requiredBondingMeetings;

  const documentItems = useMemo(() => {
    const completed = activeApp?.completedDocIds ?? [];
    return gameDataset.adoption.documents.map((doc) => {
      const fee = getBaselineScaleFromMinWage(doc.feeMinWageMultiple, state, gameDataset);
      const done = completed.includes(doc.id);
      const canAfford = player.moneyToman >= fee;
      return {
        id: doc.id,
        title: doc.titleFa,
        subtitle: doc.subtitleFa,
        done,
        valueText:
          fee > 0 ? (
            <MoneyText amount={fee} currency="IRT" mode="inline" interactive={false} />
          ) : (
            'رایگان'
          ),
        ctaLabel: 'ثبت مدرک',
        disabled: !canAfford,
        reason: !canAfford ? 'موجودی کافی نیست' : undefined,
        onAction: () =>
          onUpdateSave(completeAdoptionDocumentAction(saveGame, doc.id, gameDataset)),
      };
    });
  }, [activeApp?.completedDocIds, onUpdateSave, player.moneyToman, saveGame, state]);

  const allDocsDone = documentItems.every((d) => d.done);

  const stepperSteps = ADOPTION_STEP_ORDER.map((stepId, idx) => ({
    id: stepId,
    title: t(`adoption.steps.${stepId}`),
    status: (
      idx < currentStepIndex
        ? 'done'
        : idx === currentStepIndex
          ? 'current'
          : 'upcoming'
    ) as 'done' | 'current' | 'upcoming',
  }));

  const pastVisitsDescending = useMemo(
    () => [...summary.adoptionState.supervisionVisits].reverse(),
    [summary.adoptionState.supervisionVisits],
  );

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      title={t('adoption.hubTitle')}
      subtitle={t('adoption.hubSubtitle')}
      onInfo={() => setInfoOpen(true)}
      infoLabel="قوانین و راهنمای سرپرستی"
      zIndexClass="z-[56]"
    >
      {/* Top Hero */}
      <HubHeroCard
        icon={
          placedChild ? (
            <PersonAvatar
              seed={placedChild.avatarSeed}
              gender={placedChild.gender}
              age={placedChild.age}
              size={44}
              originKind={placedChild.originKind}
            />
          ) : (
            <IconBaby className="h-5 w-5" />
          )
        }
        title={placedChild ? `${placedChild.firstName} ${placedChild.lastName}` : careDef.titleFa}
        subtitle={
          placedChild
            ? `${careDef.titleFa} · ${formatAgeLabel(placedChild.age)} · شبیه‌سازی بازی است`
            : `${careDef.subtitleFa} · شبیه‌سازی بازی است`
        }
        status={
          placedChild
            ? 'done'
            : activeApp
              ? 'in_progress'
              : summary.activeEligibility.eligible
                ? 'waiting'
                : 'locked'
        }
        onInfo={() => setInfoOpen(true)}
        metrics={[
          {
            label: 'مرحله پرونده',
            value: placedChild
              ? 'نظارت تا ۱۸ سالگی'
              : `گام ${toPersianDigits(currentStepIndex + 1)} از ${toPersianDigits(ADOPTION_STEP_ORDER.length)}`,
            tone: 'primary',
          },
          {
            label: 'فرزندان تحت سرپرستی',
            value: `${toPersianDigits(summary.adoptedChildrenCount)} نفر`,
          },
          {
            label: 'تکالیف نظارتی باز',
            value:
              summary.pendingTasksCount > 0
                ? `${toPersianDigits(summary.pendingTasksCount)} مورد`
                : 'ندارد',
            tone: summary.pendingTasksCount > 0 ? 'danger' : 'success',
          },
        ]}
      />

      {/* Care type selector before submission */}
      {(!activeApp || (activeApp.step === 'readiness' && !activeApp.portalSubmitted)) && (
        <div className="space-y-2">
          <SectionHeader
            title="انتخاب نوع سرپرستی"
            subtitle="تفاوت در شرایط مسکن، تعهد قانونی و ارث"
          />
          <SegmentedControl
            value={currentCareType}
            onChange={(nextType) =>
              onUpdateSave(
                startOrSelectAdoptionCareTypeAction(saveGame, nextType, gameDataset),
              )
            }
            items={gameDataset.adoption.careTypes.map((ct) => ({
              value: ct.id,
              label:
                ct.id === 'permanent'
                  ? 'فرزندخواندگی دائم'
                  : ct.id === 'temporary_guardian'
                    ? 'امین موقت'
                    : 'خانواده میزبان',
            }))}
          />
          <Card tinted className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[var(--primary-strong)]">{careDef.titleFa}</span>
              <Badge tone="neutral">{careDef.commitmentYearsLabelFa}</Badge>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              {careDef.legalBasisFa}
            </p>
            <div className="flex flex-wrap gap-3 pt-1 text-xs text-[var(--text-muted)]">
              <span>
                حداقل پس‌انداز:{' '}
                <strong className="text-[var(--text)]">
                  <MoneyText
                    amount={summary.activeEligibility.requiredSavingsToman}
                    currency="IRT"
                    mode="inline"
                  />
                </strong>
              </span>
              <span>
                هزینه ثبت حکم:{' '}
                <strong className="text-[var(--text)]">
                  <MoneyText
                    amount={summary.activeEligibility.placementFeeToman}
                    currency="IRT"
                    mode="inline"
                  />
                </strong>
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Compact 7-Step Progress Bar */}
      <Card className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--text)]">
            گام {toPersianDigits(currentStepIndex + 1)} از {toPersianDigits(ADOPTION_STEP_ORDER.length)}: {t(`adoption.steps.${currentStep}`)}
          </span>
          <Badge tone={summary.activeEligibility.eligible ? 'primary' : 'neutral'}>
            {careDef.titleFa}
          </Badge>
        </div>
        <div className="grid grid-cols-7 gap-1" aria-label="پیشرفت مراحل سرپرستی">
          {ADOPTION_STEP_ORDER.map((stepId, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={stepId} className="space-y-1 text-center">
                <div
                  className={`flex h-7 items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition-colors ${
                    isDone
                      ? 'border-[var(--success)]/45 bg-[var(--success)]/15 text-[var(--success)]'
                      : isCurrent
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  {isDone ? '✓' : toPersianDigits(idx + 1)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* STEP 1: READINESS */}
      {currentStep === 'readiness' && (
        <div className="space-y-3">
          <RequirementsChecklist
            title="فهرست شرایط قانونی (ماده ۵ و ۶ قانون ۱۳۹۲)"
            items={summary.activeEligibility.checklist}
          />

          {summary.activeEligibility.hasAgePriority && (
            <Card tinted className="flex items-center gap-2 text-xs text-[var(--text)]">
              <IconSparkles className="h-4 w-4 shrink-0 text-[var(--primary-strong)]" />
              <span>به‌دلیل سن زیر ۵۰ سال، در اولویت بررسی پرونده بهزیستی قرار داری.</span>
            </Card>
          )}

          {summary.activeEligibility.singleWomanFemaleOnly && (
            <Card tinted className="text-xs leading-relaxed text-[var(--text-muted)]">
              مطابق بند ج ماده ۵ قانون ۱۳۹۲، بانوان مجرد بالای ۳۰ سال منحصراً برای سرپرستی کودک دختر اقدام می‌کنند.
            </Card>
          )}

          {summary.activeEligibility.canTakeInfertilityTest && (
            <SectionGroup title="مسیر زوجین زیر ۵ سال سابقه ازدواج">
              <ActionRow
                icon={<IconHeart className="h-4 w-4" />}
                title="دریافت گواهی پزشکی ناباروری"
                subtitle="معافیت از شرط انتظار ۵ ساله زندگی مشترک (تبصره ماده ۵)"
                value={
                  <MoneyText
                    amount={summary.activeEligibility.infertilityTestCostToman}
                    currency="IRT"
                    mode="inline"
                    interactive={false}
                  />
                }
                state={
                  player.moneyToman < summary.activeEligibility.infertilityTestCostToman
                    ? 'disabled'
                    : 'recommended'
                }
                reason={
                  player.moneyToman < summary.activeEligibility.infertilityTestCostToman
                    ? 'موجودی کافی نیست'
                    : undefined
                }
                ctaLabel="انجام آزمایش"
                onClick={() =>
                  onUpdateSave(obtainInfertilityCertificateAction(saveGame, gameDataset))
                }
              />
            </SectionGroup>
          )}

          <ActionButton
            label="تأیید آمادگی و ادامه به منشور تعهد"
            variant="primary"
            disabled={!summary.activeEligibility.eligible}
            disabledReason={summary.activeEligibility.blockedReasonFa}
            onClick={() => onUpdateSave(advanceAdoptionFromReadinessAction(saveGame, gameDataset))}
          />
        </div>
      )}

      {/* STEP 2: COMMITMENT */}
      {currentStep === 'commitment' && activeApp && (
        <div className="space-y-3">
          <Card className="space-y-2.5">
            <SectionHeader
              title="منشور تعهد اخلاقی، عاطفی و قانونی"
              subtitle={careDef.titleFa}
            />
            <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
              <li>• فراهم‌کردن محیط امن، باثبات، بدون خشونت و همراه با احترام به هویت کودک.</li>
              <li>• همراهی در تحصیل، سلامت روان و نگهداری صادقانه متناسب با سن کودک.</li>
              <li>• پذیرش بازدیدهای دوره‌ای مددکار اجتماعی بهزیستی تا رسیدن کودک به ۱۸ سالگی.</li>
              {currentCareType === 'permanent' && (
                <li>• تضمین آینده مالی و بیمه آتیه کودک طبق ماده ۱۴ قانون ۱۳۹۲.</li>
              )}
            </ul>
          </Card>

          {activeApp.pausedForReflection && (
            <Card tinted className="text-xs leading-relaxed text-[var(--primary-strong)]">
              پرونده با احترام و بدون هیچ جریمه‌ای برای تفکر و گفت‌وگوی خانوادگی متوقف مانده است؛ هر زمان آماده بودی ادامه بده.
            </Card>
          )}

          <div className="space-y-2">
            <ActionButton
              label="تعهدنامه را می‌پذیرم و ادامه می‌دهم"
              variant="primary"
              icon={<IconCheck className="h-4 w-4" />}
              onClick={() => onUpdateSave(respondAdoptionCommitmentAction(saveGame, true))}
            />
            <ActionButton
              label="می‌خواهم بیشتر فکر کنم"
              variant="secondary"
              onClick={() => onUpdateSave(respondAdoptionCommitmentAction(saveGame, false))}
            />
          </div>
        </div>
      )}

      {/* STEP 3: APPLICATION & DOCUMENTS */}
      {currentStep === 'application' && activeApp && (
        <div className="space-y-3">
          <ChecklistCard
            title="مدارک و استعلام‌های درگاه ملی"
            subtitle="تمام موارد پیش از ارسال پرونده برای بازدید منزل باید تکمیل شوند"
            items={documentItems}
          />
          <ActionButton
            label="ثبت نهایی پرونده در درگاه بهزیستی"
            costText={
              <MoneyText
                amount={summary.costEstimates.applicationBaseCostToman}
                currency="IRT"
                mode="inline"
                interactive={false}
              />
            }
            variant="primary"
            disabled={
              !allDocsDone ||
              player.moneyToman < summary.costEstimates.applicationBaseCostToman
            }
            disabledReason={
              !allDocsDone
                ? 'ابتدا تمام مدارک فهرست بالا را ثبت کن'
                : player.moneyToman < summary.costEstimates.applicationBaseCostToman
                  ? 'موجودی کافی نیست'
                  : undefined
            }
            onClick={() => onUpdateSave(submitAdoptionApplicationAction(saveGame, gameDataset))}
          />
        </div>
      )}

      {/* STEP 4: EVALUATION */}
      {currentStep === 'evaluation' && activeApp && (
        <div className="space-y-3">
          <Card className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <SectionHeader title="ارزیابی بازدید منزل و مصاحبه تخصصی" />
              <Badge
                tone={
                  activeApp.evaluationStatus === 'in_queue' ? 'primary' : 'warning'
                }
              >
                {activeApp.evaluationStatus === 'in_queue'
                  ? 'در نوبت بازدید'
                  : 'نیازمند تکمیل شرایط'}
              </Badge>
            </div>
            {activeApp.evaluationNotesFa.length > 0 && (
              <ul className="space-y-1.5 rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--text)]">
                {activeApp.evaluationNotesFa.map((note, idx) => (
                  <li key={idx}>• {note}</li>
                ))}
              </ul>
            )}
            {activeApp.evaluationStatus === 'in_queue' ? (
              <p className="text-xs text-[var(--text-muted)]">
                زمان باقی‌مانده تا اعلام نتیجه بازدید کارشناس: {toPersianDigits(Math.max(1, activeApp.queueYearsRemaining))} سال. با زدن «سال بعد» گزارش بازدید ثبت می‌شود.
              </p>
            ) : (
              <ActionButton
                label="ارزیابی مجدد پس از بهبود شرایط"
                variant="primary"
                onClick={() => onUpdateSave(runAdoptionEvaluationNowAction(saveGame, gameDataset))}
              />
            )}
          </Card>
        </div>
      )}

      {/* STEP 5: MATCHING & BONDING */}
      {currentStep === 'matching' && activeApp && (
        <div className="space-y-3">
          <SectionHeader
            title="همسان‌گزینی و نشست‌های آشنایی"
            subtitle={`پیش از انتخاب نهایی، حداقل ${toPersianDigits(requiredBondingMeetings)} نشست آشنایی لازم است`}
          />
          {activeApp.matchedCandidates.map((cand) => {
            const meetingsReady = cand.bondingMeetingsDone >= requiredBondingMeetings;
            const canAffordMeeting =
              player.moneyToman >= summary.costEstimates.bondingMeetingCostToman;

            return (
              <Card key={cand.tempId} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar
                      seed={cand.avatarSeed}
                      gender={cand.gender}
                      age={cand.age}
                      size={48}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-[var(--text)]">
                          {cand.firstName}
                        </h4>
                        <Badge tone="neutral">
                          {cand.gender === 'female' ? 'دختر' : 'پسر'} · {formatAgeLabel(cand.age)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        ویژگی‌ها: {cand.traits.join(' · ')}
                      </p>
                    </div>
                  </div>
                  <Badge tone={meetingsReady ? 'success' : 'primary'}>
                    {toPersianDigits(cand.bondingMeetingsDone)} از {toPersianDigits(requiredBondingMeetings)} نشست
                  </Badge>
                </div>

                <p className="text-xs leading-relaxed text-[var(--text)]">{cand.backgroundFa}</p>

                {cand.healthNeedsFa && (
                  <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    نکته مراقبتی: {cand.healthNeedsFa}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ActionButton
                    label="برگزاری نشست آشنایی"
                    costText={
                      <MoneyText
                        amount={summary.costEstimates.bondingMeetingCostToman}
                        currency="IRT"
                        mode="inline"
                        interactive={false}
                      />
                    }
                    variant={meetingsReady ? 'secondary' : 'primary'}
                    disabled={!canAffordMeeting}
                    disabledReason={!canAffordMeeting ? 'موجودی کافی نیست' : undefined}
                    onClick={() =>
                      onUpdateSave(
                        conductAdoptionBondingMeetingAction(saveGame, cand.tempId, gameDataset),
                      )
                    }
                  />
                  <ActionButton
                    label="انتخاب برای مرحله حکم"
                    variant={meetingsReady ? 'primary' : 'secondary'}
                    disabled={!meetingsReady}
                    disabledReason={
                      !meetingsReady
                        ? `نیازمند ${toPersianDigits(requiredBondingMeetings - cand.bondingMeetingsDone)} نشست دیگر`
                        : undefined
                    }
                    onClick={() =>
                      onUpdateSave(
                        selectAdoptionCandidateAction(saveGame, cand.tempId, gameDataset),
                      )
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* STEP 6: DECREE & PLACEMENT */}
      {currentStep === 'decree' && activeApp && selectedCandidate && (
        <div className="space-y-3">
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <PersonAvatar
                seed={selectedCandidate.avatarSeed}
                gender={selectedCandidate.gender}
                age={selectedCandidate.age}
                size={52}
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text)]">
                  آماده صدور حکم برای {selectedCandidate.firstName}
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {selectedCandidate.gender === 'female' ? 'دختر' : 'پسر'} · {formatAgeLabel(selectedCandidate.age)} · {careDef.titleFa}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--text-muted)]">
              دوره آزمایشی ۶ ماهه و استعلام‌های دادگاه خانواده با موفقیت جمع‌بندی شده و با ثبت حکم، بیمه آتیه کودک (ماده ۱۴) نیز فعال می‌شود.
            </div>

            {currentCareType === 'permanent' && (
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  انتخاب نام کوچک تازه در شناسنامه (اختیاری)
                </label>
                <input
                  type="text"
                  value={customFirstName}
                  onChange={(e) => setCustomFirstName(e.target.value)}
                  placeholder={`مثلاً ${selectedCandidate.firstName}`}
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--text)]"
                />
              </div>
            )}

            {selectedCandidate.age >= 4 && selectedCandidate.age < 7 && (
              <Toggle
                checked={enrollSchool}
                onChange={setEnrollSchool}
                label="ثبت‌نام در پیش‌دبستانی"
                description="آماده‌سازی تدریجی برای ورود به دبستان و دوست‌یابی"
              />
            )}
          </Card>

          <ActionButton
            label="صدور حکم دادگاه و تحویل کودک"
            costText={
              <MoneyText
                amount={summary.activeEligibility.placementFeeToman}
                currency="IRT"
                mode="inline"
                interactive={false}
              />
            }
            variant="primary"
            disabled={player.moneyToman < summary.activeEligibility.placementFeeToman}
            disabledReason={
              player.moneyToman < summary.activeEligibility.placementFeeToman
                ? 'موجودی برای هزینه حکم و بیمه آتیه کافی نیست'
                : undefined
            }
            onClick={() =>
              onUpdateSave(
                finalizeAdoptionPlacementAction(
                  saveGame,
                  {
                    customFirstName: customFirstName.trim() || undefined,
                    enrollSchool,
                  },
                  gameDataset,
                ),
              )
            }
          />
        </div>
      )}

      {/* STEP 7: SUPERVISION */}
      {currentStep === 'supervision' && activeApp && placedChild && (
        <div className="space-y-3">
          <Card tinted className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary-strong)]">
                <IconShield className="h-4 w-4" />
                <span>برنامه نظارت حمایتی بهزیستی تا ۱۸ سالگی</span>
              </div>
              {activeApp.nextVisitYear && (
                <Badge tone="primary">
                  بازدید بعدی: {toPersianDigits(activeApp.nextVisitYear)}
                </Badge>
              )}
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              {inspectorNpc
                ? `مددکار ناظر پرونده: ${inspectorNpc.firstName} ${inspectorNpc.lastName}. `
                : ''}
              نخستین بازدید در سال پس از تحویل انجام می‌شود و پس از رسیدن کودک به ۱۸ سالگی با آرامش و احترام خاتمه می‌یابد.
            </p>
          </Card>
        </div>
      )}

      {/* Supervision visits history (shown whenever any visits exist) */}
      {pastVisitsDescending.length > 0 && (
        <div className="space-y-2.5">
          <SectionHeader
            title="گزارش‌های بازدید مددکار بهزیستی"
            subtitle={`${toPersianDigits(pastVisitsDescending.length)} بازدید ثبت‌شده`}
          />
          {pastVisitsDescending.map((visit) => (
            <InspectorVisitCard
              key={visit.id}
              visit={visit}
              inspectorGender={state.npcs[visit.inspectorPersonId]?.gender}
              playerMoneyToman={player.moneyToman}
              onCompleteTask={(visitId, taskId) =>
                onUpdateSave(completeAdoptionSupervisionTaskAction(saveGame, visitId, taskId))
              }
            />
          ))}
        </div>
      )}

      {/* Collapsible Full 7-step Overview */}
      <SectionGroup
        title="نمای کامل ۷ مرحله قانونی"
        collapsible
        defaultCollapsed
      >
        <div className="p-3.5">
          <ProgressStepper orientation="vertical" steps={stepperSteps} />
        </div>
      </SectionGroup>

      {/* Danger zone for cancelling before placement */}
      {activeApp && !activeApp.placedChildPersonId && (
        <DangerZoneGroup title="گزینه‌های حساس">
          <ActionRow
            variant="danger"
            icon={<IconWarning className="h-4 w-4" />}
            title="انصراف از پرونده درخواستی"
            subtitle="بستن پرونده فعلی پیش از صدور حکم و تحویل کودک"
            ctaLabel="انصراف"
            onClick={() => setConfirmAbandon(true)}
          />
        </DangerZoneGroup>
      )}

      <InfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="چارچوب قانونی سرپرستی در بازی"
        subtitle={`${gameDataset.adoption.meta.lawTitleFa} (مصوب ${toPersianDigits(gameDataset.adoption.meta.lawYearJalali)})`}
        bullets={[
          ...gameDataset.adoption.meta.notesFa,
          `شامل سه مسیر: فرزندخواندگی دائم، امین موقت و خانواده میزبان.`,
          `نظارت مددکار بهزیستی از سال پس از تحویل آغاز می‌شود و تا ${toPersianDigits(gameDataset.adoption.supervision.endAtChildAge)} سالگی کودک ادامه دارد.`,
        ]}
      />

      <ConfirmDialog
        open={confirmAbandon}
        title="انصراف از پرونده سرپرستی"
        message="آیا مطمئنی می‌خواهی این پرونده درخواستی را ببندی؟ هر زمان آماده بودی می‌توانی درخواست تازه ثبت کنی."
        confirmLabel="بله، پرونده بسته شود"
        destructive
        onCancel={() => setConfirmAbandon(false)}
        onConfirm={() => {
          onUpdateSave(abandonAdoptionApplicationAction(saveGame));
          setConfirmAbandon(false);
        }}
      />
    </DetailSheet>
  );
}
