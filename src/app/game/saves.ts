import { CITIES } from './data';
import { generateCity } from './city-gen';
import { applyRoom, starterLayout } from './furniture';
import { emptyStats } from './simulation';
import { District, GameState, formatDate } from './model';

/**
 * Saves store only the mutable parts of each city (district tastes and lot owners);
 * the map itself is regenerated from the seed, keeping saves small enough for localStorage.
 */
interface SavedCity {
  id: string;
  districts: District[];
  lotRestaurants: (number | null)[];
}

interface SaveFile {
  format: 'pizza-online-save';
  savedAt: string;
  state: Omit<GameState, 'cities'> & { cities: SavedCity[] };
}

export interface SaveSlotInfo {
  slot: string;
  label: string;
  savedAt: string;
  date: string;
  player: string;
}

const PREFIX = 'pizza-online:save:';
export const SLOTS = ['auto', '1', '2', '3'];

export function serialize(st: GameState): string {
  const file: SaveFile = {
    format: 'pizza-online-save',
    savedAt: new Date().toISOString(),
    state: {
      ...st,
      cities: st.cities.map((c) => ({ id: c.id, districts: c.districts, lotRestaurants: c.lots.map((l) => l.restaurantId) })),
    },
  };
  return JSON.stringify(file);
}

export function deserialize(text: string): GameState {
  const file = JSON.parse(text) as SaveFile;
  if (file?.format !== 'pizza-online-save' || !file.state || !Array.isArray(file.state.cities)) throw new Error('Not a Pizza Online save file');
  const st = file.state;
  const cities = CITIES.map((def) => {
    const city = generateCity(def, st.seed);
    const saved = st.cities.find((c) => c.id === def.id);
    if (saved) {
      city.districts = saved.districts;
      saved.lotRestaurants.forEach((rid, i) => {
        if (city.lots[i]) city.lots[i].restaurantId = rid;
      });
    }
    return city;
  });
  // Saves from before restaurant interiors existed get a starter fit-out,
  // and older daily stats are filled out with the newer fields.
  for (const r of st.restaurants) {
    r.today = { ...emptyStats(st.day), ...r.today };
    r.lastDay = { ...emptyStats(st.day - 1), ...r.lastDay };
    r.history ??= [];
    const lot = cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
    if (lot && !Array.isArray(r.layout)) {
      r.layout = starterLayout(lot);
      applyRoom(r, lot);
    }
  }
  // Campaigns from before the advertising channels existed are dropped.
  for (const p of st.players) p.ads = (p.ads ?? []).filter((a) => typeof a.channel === 'string' && typeof a.effectiveness === 'number');
  return { ...st, cities, outcome: st.outcome ?? null };
}

export function saveToSlot(slot: string, st: GameState): void {
  localStorage.setItem(PREFIX + slot, serialize(st));
}

export function loadFromSlot(slot: string): GameState | null {
  const text = safeGet(PREFIX + slot);
  return text ? deserialize(text) : null;
}

export function listSlots(): SaveSlotInfo[] {
  return SLOTS.map((slot) => {
    const text = safeGet(PREFIX + slot);
    if (!text) return { slot, label: slotLabel(slot), savedAt: '', date: '', player: '' };
    try {
      const file = JSON.parse(text) as SaveFile;
      return {
        slot,
        label: slotLabel(slot),
        savedAt: file.savedAt,
        date: formatDate(file.state.day),
        player: file.state.players.find((p) => p.isHuman)?.name ?? '',
      };
    } catch {
      return { slot, label: slotLabel(slot), savedAt: '', date: 'Unreadable', player: '' };
    }
  });
}

export function deleteSlot(slot: string): void {
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    // Storage unavailable; nothing to delete.
  }
}

function slotLabel(slot: string): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
