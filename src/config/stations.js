// Single source of truth for physical stations and their per-hour rates.
// One universal rate across all stations. A solo booking still occupies the
// whole station, so nobody else can book its remaining slots.
//
// The live rates are edited by the owner on /owner and stored in Firestore
// at settings/venueRates (see src/hooks/useRates.js). DEFAULT_RATES is only
// the fallback used before that doc loads or if a field is missing.
//
// The half-hour tier is a flat rate, not half of the hourly rate (it's a
// premium for short sessions) — there is no 15-minute option any more.
export const DEFAULT_RATES = {
  hourlySolo: 350,
  hourlyDouble: 500,
  halfHourSolo: 200,
  halfHourDouble: 300,
  // Flat, station-agnostic rates (not scaled by number of people).
  singleRace: 100,
  quickCash1: 100,
  quickCash2: 150,
  // Birthday / event estimate shown on the home page calculator.
  eventPerHour: 2000,
};

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

// Flat hourly rate, picked by party size (not multiplied further by number
// of people). Same for every station.
export const getStationRate = (partySize, rates = DEFAULT_RATES) =>
  partySize >= 2 ? rates.hourlyDouble : rates.hourlySolo;

// Total price for a given duration: the half-hour tier is a flat rate, every
// other duration scales linearly off the hourly rate.
export const getStationPrice = (partySize, hours, rates = DEFAULT_RATES) => {
  if (hours === 0.5) {
    return partySize >= 2 ? rates.halfHourDouble : rates.halfHourSolo;
  }
  return getStationRate(partySize, rates) * hours;
};
