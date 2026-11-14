import { useMemo, useState } from 'react';
import { gameDataset } from '../../../data/registry';
import { getCurrencyDef, quoteConversion } from '../../../engine/fx';
import { toPersianDigits } from '../../../engine/jalali';
import type { CurrencyCode, SaveGame, TransferChannelDef } from '../../../engine/types';
import { sellIranPropertyAndTransferAction, type ActionOutcome } from '../../../state/actions';
import { BottomSheet } from '../BottomSheet';
import { ExchangeRateStrip } from '../ExchangeRateStrip';
import { MoneyText } from '../MoneyText';
import { ActionRow, HubHeroCard, SectionGroup } from '../Primitives';
import { IconBank, IconHome, IconPlane, IconSparkles } from '../../icons';

interface SellIranPropertyWizardProps {
  open: boolean;
  saveGame: SaveGame;
  onClose: () => void;
  onUpdateSave: (outcome: ActionOutcome) => void;
}

const TARGET_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'CAD', 'GBP', 'AED'];

export function SellIranPropertyWizard({
  open,
  saveGame,
  onClose,
  onUpdateSave,
}: SellIranPropertyWizardProps) {
  const { state } = saveGame;
  const propertyToman =
    state.player.countryId === 'iran' &&
    (state.player.housing.type === 'owned' || state.player.housing.type === 'villa')
      ? state.player.housing.propertyValueToman
      : typeof state.flags['iran_owned_property_toman'] === 'number'
        ? (state.flags['iran_owned_property_toman'] as number)
        : 0;

  const residenceCurrency =
    state.player.countryId !== 'iran'
      ? gameDataset.countriesMacro.find((c) => c.id === state.player.countryId)?.currencyCode ?? 'EUR'
      : 'USD';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(residenceCurrency);
  const [channelId, setChannelId] = useState<TransferChannelDef['id']>('exchange_office');

  const netSaleToman = Math.round(propertyToman * 0.98);
  const quote = useMemo(
    () =>
      quoteConversion({
        amount: netSaleToman,
        from: 'IRT',
        to: targetCurrency,
        state,
        dataset: gameDataset,
        channelId,
      }),
    [netSaleToman, targetCurrency, state, channelId],
  );

  const channels = gameDataset.economy.fxParams.transferChannels;
  const chosenChannel = channels.find((c) => c.id === channelId) ?? channels[0];

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      snap="full"
      title="فروش ملک ایران و انتقال سرمایه"
      subtitle={`گام ${toPersianDigits(step)} از ۳ · محاسبه شفاف کارمزد و نرخ تبدیل`}
      zIndexClass="z-[58]"
    >
      <div className="space-y-4">
        <HubHeroCard
          icon={<IconHome className="h-5 w-5" />}
          title={
            <MoneyText
              amount={propertyToman}
              currency="IRT"
              mode="stacked"
              stateOverride={state}
              interactive={false}
            />
          }
          subtitle="ارزش روز ملک ثبت‌شده در ایران (با ۲٪ هزینه معاملاتی فروش)"
          metrics={[
            {
              label: 'خالص فروش تومانی',
              value: (
                <MoneyText
                  amount={netSaleToman}
                  currency="IRT"
                  mode="single"
                  compact
                  stateOverride={state}
                  interactive={false}
                />
              ),
            },
            {
              label: 'برآورد دریافتی مقصد',
              value: (
                <MoneyText
                  amount={quote.netToAmount}
                  currency={targetCurrency}
                  mode="inline"
                  stateOverride={state}
                  interactive={false}
                />
              ),
              tone: 'success',
            },
            {
              label: 'اصطکاک کل تبدیل',
              value: `${toPersianDigits(quote.totalFrictionPct)}٪`,
            },
          ]}
        />

        <ExchangeRateStrip state={state} highlightCurrency={targetCurrency} compact />

        {step === 1 && (
          <SectionGroup
            title="گام ۱: ارزیابی و آماده‌سازی فروش"
            subtitle="با فروش، مالکیت ملک در ایران تسویه و معادل نقدی آزاد می‌شود"
          >
            <ActionRow
              icon={<IconHome className="h-4 w-4" />}
              title="ملک ثبت‌شده در ایران"
              subtitle="پس از کسر ۲٪ کمیسیون معامله به حساب تومانی واریز می‌شود"
              value={
                <MoneyText
                  amount={netSaleToman}
                  currency="IRT"
                  mode="inline"
                  stateOverride={state}
                />
              }
            />
          </SectionGroup>
        )}

        {step === 2 && (
          <SectionGroup title="گام ۲: انتخاب ارز مقصد">
            {TARGET_CURRENCIES.map((code) => {
              const def = getCurrencyDef(code, gameDataset);
              const q = quoteConversion({
                amount: netSaleToman,
                from: 'IRT',
                to: code,
                state,
                dataset: gameDataset,
                channelId,
              });
              return (
                <ActionRow
                  key={code}
                  icon={<IconSparkles className="h-4 w-4" />}
                  title={def.nameFa}
                  subtitle={
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>معادل خالص پس از تبدیل:</span>
                      <MoneyText
                        amount={q.netToAmount}
                        currency={code}
                        mode="inline"
                        stateOverride={state}
                        interactive={false}
                      />
                    </span>
                  }
                  state={targetCurrency === code ? 'done' : 'enabled'}
                  ctaLabel={targetCurrency === code ? undefined : 'انتخاب'}
                  onClick={() => setTargetCurrency(code)}
                />
              );
            })}
          </SectionGroup>
        )}

        {step === 3 && (
          <SectionGroup
            title="گام ۳: انتخاب کانال انتقال و تأیید"
            subtitle="ضرایب انتقال به‌عنوان پارامترهای شبیه‌سازی بازی تعریف شده‌اند"
          >
            {channels.map((ch) => {
              const q = quoteConversion({
                amount: netSaleToman,
                from: 'IRT',
                to: targetCurrency,
                state,
                dataset: gameDataset,
                channelId: ch.id,
              });
              return (
                <ActionRow
                  key={ch.id}
                  icon={<IconBank className="h-4 w-4" />}
                  title={ch.titleFa}
                  subtitle={`${ch.subtitleFa} · ${ch.delayTurns.value > 0 ? 'واریز سال بعد' : 'واریز فوری'}`}
                  value={`${toPersianDigits(q.totalFrictionPct)}٪ کارمزد`}
                  state={channelId === ch.id ? 'done' : 'enabled'}
                  ctaLabel={channelId === ch.id ? undefined : 'انتخاب'}
                  onClick={() => setChannelId(ch.id)}
                />
              );
            })}
          </SectionGroup>
        )}

        <div className="flex gap-2 pt-1">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="min-h-[46px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold text-[var(--text)]"
            >
              گام قبل
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              disabled={propertyToman <= 0}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="min-h-[46px] flex-1 rounded-xl bg-[var(--primary)] text-xs font-bold text-[var(--on-primary)] disabled:opacity-50"
            >
              ادامه به گام بعد
            </button>
          ) : (
            <button
              type="button"
              disabled={propertyToman <= 0}
              onClick={() => {
                onUpdateSave(
                  sellIranPropertyAndTransferAction(
                    saveGame,
                    targetCurrency,
                    chosenChannel.id,
                    gameDataset,
                  ),
                );
                onClose();
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] text-xs font-bold text-[var(--on-primary)] disabled:opacity-50"
            >
              <IconPlane className="h-4 w-4" />
              <span>فروش و ارسال سرمایه</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
