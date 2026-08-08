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

/** The slot, `offset` days from now, as a real moment. */
function slotOn(now: Date, offset: number, slot: string): Date {
  const day = new Date(now);
  day.setDate(day.getDate() + offset);
  day.setHours(0, slotMinutes(slot), 0, 0);
  return day;
}

/**
 * When a listing described as "Today"/"Tomorrow"/a weekday actually starts.
 * Weekdays resolve to the next one still ahead; Flexible has no moment.
 *
 * `rollForward` is for seeded listings only. A fixture names a day in the
 * abstract, so a slot too close to give notice should mean the next day that
 * name can stand for. A date a requester picked is an instruction, not a
 * description: "Today" means today even a minute inside the notice window, or
 * the listing would start a day away from the one its own label promises.
 */
export function startMoment(now: Date, dateChoice: string, slot: string, rollForward = false): Date | undefined {
  if (dateChoice === "Tomorrow") return slotOn(now, 1, slot);
  const weekday = weekdayNames.indexOf(dateChoice);
  if (dateChoice !== "Today" && weekday < 0) return undefined;
  const offset = weekday < 0 ? 0 : (weekday - now.getDay() + 7) % 7;
  const start = slotOn(now, offset, slot);
  if (!rollForward || start.getTime() - now.getTime() >= sameDayLeadMinutes * 60000) return start;
  return slotOn(now, offset + (weekday < 0 ? 1 : 7), slot);
}

/**
 * A listing whose start has gone by can no longer be accepted, so it drops out
 * of Nearby rather than sitting there advertising a time in the past. Listings
 * without a resolvable start (Flexible, or a remote row carrying only a label)
 * never expire on their own.
 */
export function hasExpired(task: { startsAt?: Date }, now: Date): boolean {
  return Boolean(task.startsAt && task.startsAt.getTime() <= now.getTime());
}

/** How close a start has to be before a job you took on needs your attention. */
export const arrivalWindowMinutes = 60;

/** Whole minutes between now and a start; negative once it has begun. */
export function minutesUntil(now: Date, start: Date): number {
  return Math.round((start.getTime() - now.getTime()) / 60000);
}

/** "3 hr 10 min", the way a wait is spoken rather than counted. */
function spanLabel(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Whether a start falls on the day someone is looking at it. */
export function startsToday(now: Date, start: Date): boolean {
  return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth() && start.getDate() === now.getDate();
}

/** The countdown on an accepted job, from far out through already underway. */
export function countdownLabel(now: Date, start: Date): string {
  const minutes = minutesUntil(now, start);
  if (minutes > 0) return `Starts in ${spanLabel(minutes)}`;
  if (minutes === 0) return "Starting now";
  return `Started ${spanLabel(-minutes)} ago`;
}

/** How long ago something was recorded, for notices and thread rows. */
export function agoLabel(now: Date, moment: Date): string {
  const minutes = Math.floor((now.getTime() - moment.getTime()) / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : weekdayNames[moment.getDay()];
}

/** How that moment reads to whoever is browsing right now. */
export function startLabel(now: Date, start: Date, slot: string): string {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(start);
  to.setHours(0, 0, 0, 0);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  return `${days === 0 ? "Today" : days === 1 ? "Tomorrow" : weekdayNames[start.getDay()]} · ${slot}`;
}

