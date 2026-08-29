// Single source of truth for opening hours.
export const OPEN_HOUR = 12; // 12:00 PM
export const CLOSE_HOUR = 21; // 9:00 PM
export const HOURS_LABEL = "12:00 PM – 9:00 PM";

export const isOpenNow = (date = new Date()) => {
  const h = date.getHours() + date.getMinutes() / 60;
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
};
