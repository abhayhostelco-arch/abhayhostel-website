import type { StudentGrowthReport } from "@/lib/growth-score";
import { groupGrowthStudents } from "@/lib/leaderboard";

export function GrowthLeaderboard({ students, currentStudentId, limit = 10 }: { students: StudentGrowthReport[]; currentStudentId?: string; limit?: number }) {
  const groups = groupGrowthStudents(students);
  if (!groups.length) return <p className="empty-state">No active students are eligible for scoring.</p>;
  return (
    <div className="group-scoreboards">{groups.map((group) => (
      <section className="group-scoreboard" key={group.value}>
        <h3>{group.label}</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Submitted</th></tr></thead>
          <tbody>{group.students.slice(0, limit).map((student) => (
            <tr key={student.studentId} className={student.studentId === currentStudentId ? "current-student-row" : undefined}>
              <td><strong>#{student.rank}</strong></td><td>{student.studentName}{student.studentId === currentStudentId ? " (You)" : ""}</td><td>{Math.round(student.overall)}/100</td><td>{student.submittedDays}/{student.eligibleDays}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    ))}</div>
  );
}
