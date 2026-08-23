// Single source of truth for physical stations and person-based pricing.
export const STATIONS = [
  { name: "Simulator", capacity: 1 },
  { name: "PS5", capacity: 2 },
  { name: "PS4 #1", capacity: 2 },
  { name: "PS4 #2", capacity: 2 },
];

export const MACHINE_NAMES = STATIONS.map((s) => s.name);
export const TOTAL_STATIONS = STATIONS.length;

export const getStationCapacity = (name) =>
  STATIONS.find((s) => s.name === name)?.capacity ?? 1;

// Flat per-machine hourly rate, picked by party size (not multiplied further
// by number of people). A solo booking still occupies the whole station, so
// nobody else can book its remaining slots.
export const PRICE_SOLO_PER_HOUR = 400;
export const PRICE_DOUBLE_PER_HOUR = 500;

export const getHourlyRate = (partySize) =>
  partySize >= 2 ? PRICE_DOUBLE_PER_HOUR : PRICE_SOLO_PER_HOUR;

// Flat, station-agnostic rates (not scaled by number of people).
export const SINGLE_RACE_PRICE = 100;
export const QUICK_CASH_PRICES = [100, 150];
