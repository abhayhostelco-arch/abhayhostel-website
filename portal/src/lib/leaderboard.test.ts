import { describe, expect, it } from "vitest";
import { leaderboardPlacement, rankByCategory } from "@/lib/leaderboard";
import type { StudentGrowthReport } from "@/lib/growth-score";

const student = (id: string, name: string, score: number): StudentGrowthReport => ({
  studentId: id, studentName: name, studentGroup: "abhay_hostel", eligibleDays: 7, submittedDays: 7, rank: 1,
  overall: score, sadhana: score, study: score, discipline: score, seva: score, daily: [],
});

describe("category leaderboards", () => {
  it("orders category ranks by precise scores before presentation rounding", () => {
    const ranked = rankByCategory([
      { ...student("z", "Zulu", 50), study: 90.4 },
      { ...student("a", "Alpha", 80), study: 90.2 },
      { ...student("c", "Charlie", 70), study: 70 },
    ], "study");
    expect(ranked.map((item) => [item.studentId, item.categoryRank, item.categoryScore])).toEqual([
      ["z", 1, 90],
      ["a", 2, 90],
      ["c", 3, 70],
    ]);
  });

  it("uses case-insensitive names and student IDs to assign unique category positions", () => {
    const ranked = rankByCategory([
      student("b", "alpha", 80),
      student("a", "Alpha", 80),
      student("c", "Beta", 80),
    ], "overall");

    expect(ranked.map((item) => [item.studentId, item.categoryRank])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("partitions category positions by hostel group", () => {
    const ranked = rankByCategory([
      { ...student("abhay-low", "Abhay Low", 60), studentGroup: "abhay_hostel" },
      { ...student("krishna-high", "Krishna High", 90), studentGroup: "krishna_home" },
      { ...student("abhay-high", "Abhay High", 80), studentGroup: "abhay_hostel" },
    ], "overall");

    expect(ranked.map((item) => [item.studentId, item.studentGroup, item.categoryRank])).toEqual([
      ["abhay-high", "abhay_hostel", 1],
      ["abhay-low", "abhay_hostel", 2],
      ["krishna-high", "krishna_home", 1],
    ]);
  });

  it("leaves ungrouped students out of category ranking", () => {
    const ranked = rankByCategory([
      student("configured", "Configured", 80),
      { ...student("legacy", "Legacy", 90), studentGroup: null },
    ], "overall");

    expect(ranked.map((item) => [item.studentId, item.categoryRank])).toEqual([["configured", 1], ["legacy", null]]);
  });

  it("retains the current student's placement outside the top ten", () => {
    const students = Array.from({ length: 12 }, (_, index) => student(String(index), `Student ${index}`, 100 - index));
    const placement = leaderboardPlacement(students, "overall", "11");
    expect(placement.leaders).toHaveLength(10);
    expect(placement.current?.studentId).toBe("11");
    expect(placement.current?.categoryRank).toBe(12);
  });
});
