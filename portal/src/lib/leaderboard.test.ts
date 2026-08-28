import { describe, expect, it } from "vitest";
import { leaderboardPlacement, rankByCategory } from "@/lib/leaderboard";
import type { StudentGrowthReport } from "@/lib/growth-score";

const student = (id: string, name: string, score: number): StudentGrowthReport => ({
  studentId: id, studentName: name, eligibleDays: 7, submittedDays: 7, rank: 1,
  overall: score, sadhana: score, study: score, discipline: score, seva: score, daily: [],
});

describe("category leaderboards", () => {
  it("ranks each category independently with unique alphabetical tie positions", () => {
    const ranked = rankByCategory([
      { ...student("a", "Alpha", 50), study: 90.4 },
      { ...student("b", "Beta", 80), study: 90.2 },
      { ...student("c", "Charlie", 70), study: 70 },
    ], "study");
    expect(ranked.map((item) => [item.studentId, item.categoryRank])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("retains the current student's placement outside the top ten", () => {
    const students = Array.from({ length: 12 }, (_, index) => student(String(index), `Student ${index}`, 100 - index));
    const placement = leaderboardPlacement(students, "overall", "11");
    expect(placement.leaders).toHaveLength(10);
    expect(placement.current?.studentId).toBe("11");
    expect(placement.current?.categoryRank).toBe(12);
  });
});
