import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryLeaderboard } from "@/components/category-leaderboard";
import { StudentSummaryStrip } from "@/components/dashboard-ui";
import { GrowthLeaderboard } from "@/components/growth-leaderboard";
import { StudentPerformanceTable } from "@/components/student-performance-table";
import type { StudentGrowthReport } from "@/lib/growth-score";

const student = (
  id: string,
  name: string,
  group: "abhay_hostel" | "krishna_home",
  rank: number,
  score: number,
): StudentGrowthReport => ({
  studentId: id,
  studentName: name,
  studentGroup: group,
  eligibleDays: 7,
  submittedDays: 7,
  rank,
  overall: score,
  sadhana: score,
  study: score,
  discipline: score,
  seva: score,
  daily: [],
});

const mixedStudents = [
  ...Array.from({ length: 11 }, (_, index) => student(`a-${index + 1}`, `Abhay ${index + 1}`, "abhay_hostel", index + 1, 100 - index)),
  student("k-1", "Krishna 1", "krishna_home", 1, 80),
  student("k-2", "Krishna 2", "krishna_home", 2, 70),
];

describe("group scoreboard outputs", () => {
  it("renders a separate Top 10 overall table for each hostel group", () => {
    const html = renderToStaticMarkup(<GrowthLeaderboard students={mixedStudents} />);

    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html.match(/<strong>#1<\/strong>/g)).toHaveLength(2);
    expect(html).toContain("Abhay 10");
    expect(html).not.toContain("Abhay 11");
    expect(html).not.toContain('class="avatar"');
  });

  it("renders category positions independently by group and shows own-group count", () => {
    const html = renderToStaticMarkup(<CategoryLeaderboard students={mixedStudents} currentStudentId="a-11" />);

    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html.match(/leaderboard-rank\">#1<\/strong>/g)).toHaveLength(2);
    expect(html).toContain("#11 of 11 · Abhay 11");
  });

  it("partitions performance tables without changing each group rank", () => {
    const html = renderToStaticMarkup(<StudentPerformanceTable students={mixedStudents} homeDays={new Map()} hrefBase="/admin/students" limit={10} />);

    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html.match(/<td>1<\/td>/g)).toHaveLength(2);
    expect(html).not.toContain("Abhay 11");
  });

  it("partitions quick summaries and does not render student avatars", () => {
    const html = renderToStaticMarkup(<StudentSummaryStrip students={mixedStudents} />);

    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html).not.toContain('class="avatar"');
  });
});
