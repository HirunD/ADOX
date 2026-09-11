// Config for the /navigator event-stall page — a separate, simplified
// booking flow for the Navigator event stand. Not connected to the main
// venue's stations/pricing (src/config/stations.js).
// `slots` = independent seats on that station — the 3-Player Station has 3
// controllers, so it gets 3 independently start/stoppable buttons, each
// billed per person.
export const NAVIGATOR_STATIONS = [
  { id: "sim", name: "Simulator", slots: 1 },
  { id: "trio", name: "3-Player Station", slots: 3 },
  { id: "a", name: "Station A", slots: 2 },
  { id: "b", name: "Station B", slots: 2 },
];

export const NAVIGATOR_SESSION_PRICE = 200; // per person
export const NAVIGATOR_SESSION_HOURS = 0.25; // 15 minutes
