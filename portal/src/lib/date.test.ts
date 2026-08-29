import { describe, expect, it } from "vitest";
import { displayDate, isWithinEntryWindow, isWithinStudentEntryWindow, todayInIndia } from "@/lib/date";
import * as dateHelpers from "@/lib/date";

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

describe("approved home leave days", () => {
  const helper = () => (dateHelpers as unknown as {
    approvedLeaveDaysInMonth: (requests: Array<{ start_date: string; end_date: string; status: string }>, month: string) => number;
  }).approvedLeaveDaysInMonth;

  it("counts inclusive approved dates within the selected month", () => {
    const request = [{ start_date: "2026-08-30", end_date: "2026-09-02", status: "approved" }];
    expect(helper()(request, "2026-08")).toBe(2);
    expect(helper()(request, "2026-09")).toBe(2);
  });

  it("ignores non-approved requests and never double-counts overlapping days", () => {
    expect(helper()([
      { start_date: "2026-08-10", end_date: "2026-08-12", status: "approved" },
      { start_date: "2026-08-12", end_date: "2026-08-13", status: "approved" },
      { start_date: "2026-08-20", end_date: "2026-08-22", status: "pending" },
    ], "2026-08")).toBe(4);
  });

  it("counts the same calendar date once for each different student", () => {
    expect((helper() as unknown as (requests: Array<{ student_id: string; start_date: string; end_date: string; status: string }>, month: string) => number)([
      { student_id: "a", start_date: "2026-08-10", end_date: "2026-08-10", status: "approved" },
      { student_id: "b", start_date: "2026-08-10", end_date: "2026-08-10", status: "approved" },
    ], "2026-08")).toBe(2);
  });
});

describe("leave request month overlap", () => {
  const helpers = () => dateHelpers as unknown as {
    leaveDaysInMonth?: (request: { start_date: string; end_date: string }, month: string) => number;
    canWithdrawLeaveRequest?: (request: { status: string; start_date: string }) => boolean;
  };

  it("shows requested days in the month before approval", () => {
    expect(typeof helpers().leaveDaysInMonth).toBe("function");
    expect(helpers().leaveDaysInMonth?.({ start_date: "2026-08-31", end_date: "2026-09-01" }, "2026-08")).toBe(1);
    expect(helpers().leaveDaysInMonth?.({ start_date: "2026-08-31", end_date: "2026-09-01" }, "2026-09")).toBe(1);
  });

  it("counts the complete inclusive leave duration", () => {
    expect((dateHelpers as typeof dateHelpers).leaveDays?.({ start_date: "2026-08-31", end_date: "2026-09-01" })).toBe(2);
  });

  it("allows pending and approved requests to be withdrawn without rewriting leave history", () => {
    expect(typeof helpers().canWithdrawLeaveRequest).toBe("function");
    expect(helpers().canWithdrawLeaveRequest?.({ status: "pending", start_date: "2026-08-20" })).toBe(true);
    expect(helpers().canWithdrawLeaveRequest?.({ status: "approved", start_date: "2026-08-30" })).toBe(true);
    expect(helpers().canWithdrawLeaveRequest?.({ status: "approved", start_date: "2026-08-29" })).toBe(true);
    expect(helpers().canWithdrawLeaveRequest?.({ status: "rejected", start_date: "2026-08-30" })).toBe(false);
  });
});
