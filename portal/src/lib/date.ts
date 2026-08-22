import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const APP_TIME_ZONE = "Asia/Kolkata";

export function todayInIndia(now = new Date()): string {
  return formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
}

export function daysAgoInIndia(days: number, now = new Date()): string {
  return formatInTimeZone(subDays(now, days), APP_TIME_ZONE, "yyyy-MM-dd");
}

export function isWithinEntryWindow(date: string, now = new Date()): boolean {
  return date >= daysAgoInIndia(89, now) && date <= todayInIndia(now);
}

export function isWithinStudentEntryWindow(date: string, now = new Date()): boolean {
  return date >= daysAgoInIndia(1, now) && date <= todayInIndia(now);
}

export function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(`${date}T12:00:00+05:30`));
}
