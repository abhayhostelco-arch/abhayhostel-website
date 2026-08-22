import { describe, expect, it } from "vitest";
import { displayDate, isWithinEntryWindow, isWithinStudentEntryWindow, todayInIndia } from "@/lib/date";

describe("Asia/Kolkata date boundaries", () => {
  const now = new Date("2026-08-21T19:00:00Z");

  it("uses India time rather than UTC", () => {
    expect(todayInIndia(now)).toBe("2026-08-22");
  });

  it("allows today and the previous 89 dates only", () => {
    expect(isWithinEntryWindow("2026-08-22", now)).toBe(true);
    expect(isWithinEntryWindow("2026-05-25", now)).toBe(true);
    expect(isWithinEntryWindow("2026-05-24", now)).toBe(false);
    expect(isWithinEntryWindow("2026-08-23", now)).toBe(false);
  });

  it("formats stored dates without a timezone shift", () => {
    expect(displayDate("2026-08-22")).toContain("2026");
  });

  it("limits student editing to today and yesterday", () => {
    expect(isWithinStudentEntryWindow("2026-08-22", now)).toBe(true);
    expect(isWithinStudentEntryWindow("2026-08-21", now)).toBe(true);
    expect(isWithinStudentEntryWindow("2026-08-20", now)).toBe(false);
    expect(isWithinStudentEntryWindow("2026-08-23", now)).toBe(false);
  });
});
