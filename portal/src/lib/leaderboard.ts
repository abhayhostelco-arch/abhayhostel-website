import type { StudentGrowthReport } from "@/lib/growth-score";

export type LeaderboardCategory = "overall" | "sadhana" | "study" | "discipline" | "seva";
export type RankedGrowthStudent = StudentGrowthReport & { categoryRank: number; categoryScore: number };

export function rankByCategory(
  students: StudentGrowthReport[],
  category: LeaderboardCategory,
): RankedGrowthStudent[] {
  const sorted = [...students].sort((a, b) =>
    Math.round(b[category]) - Math.round(a[category]) || a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" }),
  );
  return sorted.map((student, index) => {
    const categoryScore = Math.round(student[category]);
    const categoryRank = index + 1;
    return { ...student, categoryRank, categoryScore };
  });
}

export function leaderboardPlacement(
  students: StudentGrowthReport[],
  category: LeaderboardCategory,
  currentStudentId?: string,
  limit = 10,
): { leaders: RankedGrowthStudent[]; current: RankedGrowthStudent | null } {
  const ranked = rankByCategory(students, category);
  const leaders = ranked.slice(0, limit);
  const current = currentStudentId && !leaders.some((student) => student.studentId === currentStudentId)
    ? ranked.find((student) => student.studentId === currentStudentId) ?? null
    : null;
  return { leaders, current };
}
