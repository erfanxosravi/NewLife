import { createContext, useContext, type ReactNode } from 'react';
import { gameDataset } from '../../data/registry';
import { initializeFxState } from '../../engine/fx';
import { createNewSaveGame } from '../../engine/generator';
import type { AffordabilityFixKind } from '../../engine/money';
import type { CurrencyCode, GameState } from '../../engine/types';

export interface CalculatorRequest {
  fromCurrency?: CurrencyCode;
  toCurrency?: CurrencyCode;
  amount?: number;
}

export interface ForeignPopoverRequest {
  amount: number;
  currency: CurrencyCode;
}

export interface MoneyContextValue {
  state: GameState;
  onOpenCalculator?: (req?: CalculatorRequest) => void;
  onOpenForeignPopover?: (req: ForeignPopoverRequest) => void;
  onAffordabilityFix?: (fix: AffordabilityFixKind, contextCurrency?: CurrencyCode) => void;
}

const FALLBACK_REFERENCE_STATE: GameState = (() => {
  const sg = createNewSaveGame(
    { seed: 'ref_money_state', birthCityId: 'tehran', birthJalaliYear: 1387 },
    gameDataset,
  );
  sg.state.currentJalaliYear = 1405;
  sg.state.fxState = initializeFxState(1405, gameDataset);
  sg.state.player.age = 18;
  sg.state.player.moneyToman = 50_000_000;
  sg.state.displayCurrencyMode = 'local';
  return sg.state;
})();

const MoneyContext = createContext<MoneyContextValue>({
  state: FALLBACK_REFERENCE_STATE,
});

export function MoneyProvider({
  value,
  children,
}: {
  value: MoneyContextValue;
  children: ReactNode;
}) {
  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoneyContext(): MoneyContextValue {
  return useContext(MoneyContext);
}
