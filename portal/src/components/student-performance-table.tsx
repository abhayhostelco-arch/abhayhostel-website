import Link from "next/link";
import type { StudentGrowthReport } from "@/lib/growth-score";
import { groupGrowthStudents } from "@/lib/leaderboard";

export function StudentPerformanceTable({ students, homeDays = new Map(), hrefBase, limit }: { students: StudentGrowthReport[]; homeDays?: Map<string, number>; hrefBase: string; limit?: number }) {
  const groups = groupGrowthStudents(students);
  return <div className="group-scoreboards">{groups.map((group) => {
    const rows = typeof limit === "number" ? group.students.slice(0, limit) : group.students;
    return <section className="group-scoreboard" key={group.value}><h3>{group.label}</h3>{rows.length ? <div className="table-wrap performance-table"><table><thead><tr><th>#</th><th>Student</th><th>Entries</th><th>Sadhana</th><th>Study</th><th>Discipline</th><th>Seva</th><th>Overall</th><th>Home Days</th></tr></thead><tbody>{rows.map((student) => <tr key={student.studentId}><td>{student.rank}</td><td><Link href={`${hrefBase}/${student.studentId}`}>{student.studentName}</Link></td><td>{student.submittedDays}/{student.eligibleDays}</td><td>{Math.round(student.sadhana)}</td><td>{Math.round(student.study)}</td><td>{Math.round(student.discipline)}</td><td>{Math.round(student.seva)}</td><td><strong>{Math.round(student.overall)}</strong></td><td>{homeDays.get(student.studentId) ?? 0}</td></tr>)}</tbody></table></div> : <div className="empty-state compact-empty"><strong>No Students</strong><p>No students in this group.</p></div>}</section>;
  })}</div>;
}
