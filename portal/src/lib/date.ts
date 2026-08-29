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

function monthBounds(month: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  return { start: `${month}-01`, end: new Date(nextMonth.getTime() - 86_400_000).toISOString().slice(0, 10) };
}

export function leaveDaysInMonth(request: { start_date: string; end_date: string }, month: string): number {
  const bounds = monthBounds(month);
  if (!bounds) return 0;
  const start = request.start_date < bounds.start ? bounds.start : request.start_date;
  const end = request.end_date > bounds.end ? bounds.end : request.end_date;
  if (start > end) return 0;
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export function leaveDays(request: { start_date: string; end_date: string }): number {
  if (request.start_date > request.end_date) return 0;
  return Math.floor((Date.parse(`${request.end_date}T00:00:00Z`) - Date.parse(`${request.start_date}T00:00:00Z`)) / 86_400_000) + 1;
}

export function canWithdrawLeaveRequest(request: { status: string; start_date: string }): boolean {
  return request.status === "pending" || request.status === "approved";
}

export function approvedLeaveDaysInMonth(
  requests: Array<{ student_id?: string; start_date: string; end_date: string; status: string }>,
  month: string,
): number {
  const bounds = monthBounds(month);
  if (!bounds) return 0;
  const days = new Set<string>();
  for (const request of requests) {
    if (request.status !== "approved") continue;
    const start = request.start_date < bounds.start ? bounds.start : request.start_date;
    const end = request.end_date > bounds.end ? bounds.end : request.end_date;
    if (start > end) continue;
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
      days.add(`${request.student_id ?? "single"}:${cursor.toISOString().slice(0, 10)}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return days.size;
}
