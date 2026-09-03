// Single source of truth for physical stations and their per-hour rates.
// One universal rate across all stations — Rs. 350/hr solo, Rs. 500/hr
// double. A solo booking still occupies the whole station, so nobody else
// can book its remaining slots.
export const HOURLY_SOLO_RATE = 350;
export const HOURLY_DOUBLE_RATE = 500;

// The half-hour tier is a flat rate, not half of the hourly rate (it's a
// premium for short sessions) — there is no 15-minute option any more.
export const HALF_HOUR_SOLO_RATE = 200;
export const HALF_HOUR_DOUBLE_RATE = 300;

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
export const getStationRate = (partySize) =>
  partySize >= 2 ? HOURLY_DOUBLE_RATE : HOURLY_SOLO_RATE;

// Total price for a given duration: the half-hour tier is a flat rate, every
// other duration scales linearly off the hourly rate.
export const getStationPrice = (partySize, hours) => {
  if (hours === 0.5) {
    return partySize >= 2 ? HALF_HOUR_DOUBLE_RATE : HALF_HOUR_SOLO_RATE;
  }
  return getStationRate(partySize) * hours;
};

// Flat, station-agnostic rates (not scaled by number of people).
export const SINGLE_RACE_PRICE = 100;
export const QUICK_CASH_PRICES = [100, 150];
