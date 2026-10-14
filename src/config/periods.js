// Single source of truth for report date filters, so "This Month" or
// "Last 7 Days" means the same thing on every screen.
//   today  - since midnight
//   week   - today plus the 6 days before it
//   month  - since the 1st of this calendar month
//   last30 - today plus the 29 days before it
//   all    - no limit
//   custom - startDate 00:00 to endDate 23:59 (no limit until both are set)
export const PERIOD_LABELS = {
  today: "Today",
  week: "Last 7 Days",
  month: "This Month",
  last30: "Last 30 Days",
  all: "All Time",
  custom: "Custom Range",
};

const daysAgoMidnight = (now, days) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
};

export const getPeriodRange = (period, { startDate, endDate } = {}, now = new Date()) => {
  let start = new Date(0);
  let end = new Date(8640000000000000);

  if (period === "today") start = daysAgoMidnight(now, 0);
  else if (period === "week") start = daysAgoMidnight(now, 6);
  else if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === "last30") start = daysAgoMidnight(now, 29);
  else if (period === "custom" && startDate && endDate) {
    start = new Date(`${startDate}T00:00:00`);
    end = new Date(`${endDate}T23:59:59.999`);
  }
  return { start, end };
};

export const isInRange = (value, { start, end }) => {
  const d = value instanceof Date ? value : new Date(value);
  return !isNaN(d) && d >= start && d <= end;
};
