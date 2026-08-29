import Link from "next/link";
import type { StudentGrowthReport } from "@/lib/growth-score";

export function StudentPerformanceTable({ students, homeDays = new Map(), hrefBase, limit }: { students: StudentGrowthReport[]; homeDays?: Map<string, number>; hrefBase: string; limit?: number }) {
  const rows = typeof limit === "number" ? students.slice(0, limit) : students;
  return <div className="table-wrap performance-table"><table><thead><tr><th>#</th><th>Student</th><th>Entries</th><th>Sadhana</th><th>Study</th><th>Discipline</th><th>Seva</th><th>Overall</th><th>Home Days</th></tr></thead><tbody>{rows.map((student) => <tr key={student.studentId}><td>{student.rank}</td><td><Link href={`${hrefBase}/${student.studentId}`}>{student.studentName}</Link></td><td>{student.submittedDays}/{student.eligibleDays}</td><td>{Math.round(student.sadhana)}</td><td>{Math.round(student.study)}</td><td>{Math.round(student.discipline)}</td><td>{Math.round(student.seva)}</td><td><strong>{Math.round(student.overall)}</strong></td><td>{homeDays.get(student.studentId) ?? 0}</td></tr>)}</tbody></table>{!rows.length ? <div className="empty-state"><strong>No Student Reports</strong><p>Reports appear when active Students submit Daily Entries.</p></div> : null}</div>;
}
