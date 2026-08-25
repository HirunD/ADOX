// Single source of truth for physical stations and their per-hour rates.
// Each station has its own solo/double rate; a solo booking still occupies
// the whole station, so nobody else can book its remaining slots.
export const STATIONS = [
  { name: "Simulator", capacity: 1, soloRate: 450, doubleRate: 450 },
  { name: "PS5", capacity: 2, soloRate: 450, doubleRate: 600 },
  { name: "PS4 #1", capacity: 2, soloRate: 350, doubleRate: 500 },
  { name: "PS4 #2", capacity: 2, soloRate: 350, doubleRate: 500 },
];

export const MACHINE_NAMES = STATIONS.map((s) => s.name);
export const TOTAL_STATIONS = STATIONS.length;

export const getStationCapacity = (name) =>
  STATIONS.find((s) => s.name === name)?.capacity ?? 1;

// Flat per-machine hourly rate for the given station, picked by party size
// (not multiplied further by number of people).
export const getStationRate = (name, partySize) => {
  const station = STATIONS.find((s) => s.name === name);
  if (!station) return 0;
  return partySize >= 2 ? station.doubleRate : station.soloRate;
};

// Flat, station-agnostic rates (not scaled by number of people).
export const SINGLE_RACE_PRICE = 100;
export const QUICK_CASH_PRICES = [100, 150];
