import { CITIES } from './data';
import { generateCity } from './city-gen';
import { DEFAULT_FLOOR, applyRoom, layoutIsCurrent, starterLayout } from './furniture';
import { DEFAULT_RESTOCK_DAYS, emptyPopularity, emptyStats } from './simulation';
import { jobMarket, upgradeStaff } from './staff';
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
      cities: st.cities.map((c) => ({
        id: c.id,
        districts: c.districts,
        lotRestaurants: c.lots.map((l) => l.restaurantId),
      })),
    },
  };
  return JSON.stringify(file);
}

export function deserialize(text: string): GameState {
  const file = JSON.parse(text) as SaveFile;
  if (file?.format !== 'pizza-online-save' || !file.state || !Array.isArray(file.state.cities))
    throw new Error('Not a Pizza Online save file');
  const st = file.state;
  const cities = CITIES.map((def) => {
    const city = generateCity(def, st.seed);
    const saved = st.cities.find((c) => c.id === def.id);
    if (saved) {
      // Older saves lack the customer-group fields; take them from the regenerated city.
      city.districts = saved.districts.map((d, i) => ({
        ...city.districts[i],
        ...d,
        groupMix: d.groupMix ?? city.districts[i].groupMix,
        serviceMinutes: d.serviceMinutes ?? city.districts[i].serviceMinutes,
        desiredStandard: d.desiredStandard ?? city.districts[i].desiredStandard,
        desiredOwn: d.desiredOwn ?? city.districts[i].desiredOwn,
      }));
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
    r.staff = r.staff.map((x) => (typeof x.cooking === 'number' ? x : upgradeStaff(x)));
    r.stockQuality ??= {};
    r.popularity ??= emptyPopularity();
    r.preferredVendors ??= {};
    // Standing orders used to top up to a fixed number of units; they now keep days of expected use.
    r.restockDays ??= DEFAULT_RESTOCK_DAYS;
    delete (r as { restockTarget?: number }).restockTarget;
    const lot = cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
    r.storage ??= [];
    r.floorId ??= DEFAULT_FLOOR;
    // Layouts from older catalogues (or none at all) are replaced with a starter fit-out.
    if (lot && (!Array.isArray(r.layout) || !layoutIsCurrent(r.layout))) {
      r.layout = starterLayout(lot);
      applyRoom(r, lot);
    }
  }
  // Campaigns from before the advertising channels existed are dropped.
  for (const p of st.players)
    p.ads = (p.ads ?? []).filter(
      (a) => typeof a.channel === 'string' && typeof a.effectiveness === 'number',
    );
  // Older saves kept a single loan balance; turn it into a two-year loan.
  for (const p of st.players) {
    if (!p.loans && p.loan > 0)
      p.loans = [
        { id: st.nextId++, principal: p.loan, remaining: p.loan, termMonths: 24, monthsLeft: 24 },
      ];
  }
  const loaded: GameState = {
    ...st,
    cities,
    outcome: st.outcome ?? null,
    orders: st.orders ?? [],
    vendorSpend: st.vendorSpend ?? {},
    jobMarket: st.jobMarket ?? {},
    staffEvents: st.staffEvents ?? [],
    cityConditions: st.cityConditions ?? {},
    newspaper: st.newspaper ?? null,
    charts: st.charts ?? {},
    contest: st.contest ?? null,
    phoneQueue: st.phoneQueue ?? [],
    shipments: st.shipments ?? [],
  };
  for (const c of CITIES) jobMarket(loaded, c.id);
  return loaded;
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
