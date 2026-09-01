import { compareGrowthStudents, type StudentGrowthReport } from "@/lib/growth-score";
import { studentGroupOptions } from "@/lib/student-groups";

export type LeaderboardCategory = "overall" | "sadhana" | "study" | "discipline" | "seva";
export type RankedGrowthStudent = StudentGrowthReport & { categoryRank: number; categoryScore: number };

export function groupGrowthStudents(students: StudentGrowthReport[]) {
  return studentGroupOptions.map((group) => ({
    ...group,
    students: students.filter((student) => student.studentGroup === group.value),
  })).filter((group) => group.students.length > 0);
}

export function rankByCategory(
  students: StudentGrowthReport[],
  category: LeaderboardCategory,
): RankedGrowthStudent[] {
  const sorted = [...students].sort((a, b) =>
    (a.studentGroup === "abhay_hostel" ? 0 : a.studentGroup === "krishna_home" ? 1 : 2)
      - (b.studentGroup === "abhay_hostel" ? 0 : b.studentGroup === "krishna_home" ? 1 : 2)
      || compareGrowthStudents(a, b, a[category], b[category]),
  );
  let rankedGroup = sorted[0]?.studentGroup;
  let groupRank = 0;
  return sorted.map((student) => {
    if (student.studentGroup !== rankedGroup) {
      rankedGroup = student.studentGroup;
      groupRank = 0;
    }
    const categoryScore = Math.round(student[category]);
    const categoryRank = ++groupRank;
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
