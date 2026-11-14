import type { GameDataset } from '../data/registry';
import { SeededRNG } from '../engine/rng';
import type { EventDefinition, SaveGame } from '../engine/types';

function isContentAllowed(event: EventDefinition, save: SaveGame): boolean {
  const { contentSettings } = save;
  if (event.contentTag === 'crime' && !contentSettings.allowCrime) return false;
  if (event.contentTag === 'substance' && !contentSettings.allowSubstance) return false;
  if (event.contentTag === 'romance' && !contentSettings.allowRomance) return false;
  if (event.contentTag === 'social' && !contentSettings.allowSocialPolitical) return false;
  return true;
}

function matchesConditions(event: EventDefinition, save: SaveGame): boolean {
  const { state } = save;
  const { player } = state;
  const { conditions } = event;

  if (!state.isAlive) return false;
  if ((state.eventHistory[event.id] ?? 0) >= event.maxOccurrences) return false;
  if (!isContentAllowed(event, save)) return false;

  if (conditions.minAge !== undefined && player.age < conditions.minAge) return false;
  if (conditions.maxAge !== undefined && player.age > conditions.maxAge) return false;
  if (conditions.gender !== undefined && player.gender !== conditions.gender) return false;
  if (conditions.cities && !conditions.cities.includes(player.currentCityId)) return false;
  if (conditions.socialClasses && !conditions.socialClasses.includes(player.socialClass)) return false;

  if (conditions.minStats) {
    for (const [k, minVal] of Object.entries(conditions.minStats)) {
      if (minVal !== undefined && player.stats[k as keyof typeof player.stats] < minVal) {
        return false;
      }
    }
  }
  if (conditions.maxStats) {
    for (const [k, maxVal] of Object.entries(conditions.maxStats)) {
      if (maxVal !== undefined && player.stats[k as keyof typeof player.stats] > maxVal) {
        return false;
      }
    }
  }
  if (conditions.requiredFlags) {
    for (const flag of conditions.requiredFlags) {
      if (!state.flags[flag]) return false;
    }
  }
  if (conditions.forbiddenFlags) {
    for (const flag of conditions.forbiddenFlags) {
      if (state.flags[flag]) return false;
    }
  }

  return true;
}

export function pickPendingEventForTurn(
  save: SaveGame,
  dataset: GameDataset,
): EventDefinition | null {
  if (!save.state.isAlive) return null;

  const rng = new SeededRNG(`${save.seed}:turn:${save.state.turn}`);

  // Check scheduled follow-ups first
  const due = save.state.scheduledEvents.find(
    (item) => item.triggerAtAge === save.state.player.age,
  );
  if (due) {
    const found = dataset.events.find((e) => e.id === due.eventId);
    if (found && isContentAllowed(found, save)) {
      return found;
    }
  }

  const eligible = dataset.events.filter((ev) => matchesConditions(ev, save));
  if (eligible.length === 0) return null;

  // Trigger an event roughly ~65% of eligible turns so choices feel frequent and lively
  if (!rng.chance(0.68)) return null;

  return rng.weightedPick(eligible, (ev) => ev.weight);
}
