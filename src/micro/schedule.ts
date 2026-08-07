/**
 * When a task may start. Every option here is derived from the clock rather
 * than hardcoded, so "Today" disappears once too little of the day is left and
 * a start time in the past can never be offered.
 */

/** Half-hour slots a task may start in. Bounded so no start time is free-typed. */
export const startTimeSlots = ["7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM"];

/** Shortest notice a neighbor is asked to accept, in minutes. */
export const sameDayLeadMinutes = 60;
export const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "10:30 AM" -> minutes since midnight. */
export function slotMinutes(slot: string): number {
  const parts = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!parts) return 0;
  return ((Number(parts[1]) % 12) + (/pm/i.test(parts[3]) ? 12 : 0)) * 60 + Number(parts[2]);
}

/** Slots still far enough out to be worth asking for today. */
export function slotsRemainingToday(now: Date): string[] {
  const cutoff = now.getHours() * 60 + now.getMinutes() + sameDayLeadMinutes;
  return startTimeSlots.filter((slot) => slotMinutes(slot) >= cutoff);
}

/**
 * The "when" options, derived from the clock rather than hardcoded. Today drops
 * out once it is too late in the day to give anyone reasonable notice, and the
 * third option is a real weekday two days out so it can never collide with
 * Today or Tomorrow the way a fixed "Saturday" did.
 */
export function dateChoicesFor(now: Date): string[] {
  const later = new Date(now);
  later.setDate(later.getDate() + 2);
  return [...(slotsRemainingToday(now).length ? ["Today"] : []), "Tomorrow", weekdayNames[later.getDay()], "Flexible"];
}

