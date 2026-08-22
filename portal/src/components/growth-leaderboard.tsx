import type { StudentGrowthReport } from "@/lib/growth-score";

export function GrowthLeaderboard({ students, currentStudentId }: { students: StudentGrowthReport[]; currentStudentId?: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Submitted</th></tr></thead>
        <tbody>{students.map((student) => (
          <tr key={student.studentId} className={student.studentId === currentStudentId ? "current-student-row" : undefined}>
            <td><strong>#{student.rank}</strong></td><td>{student.studentName}{student.studentId === currentStudentId ? " (You)" : ""}</td><td>{Math.round(student.overall)}/100</td><td>{student.submittedDays}/{student.eligibleDays}</td>
          </tr>
        ))}</tbody>
      </table>
      {students.length === 0 ? <p className="empty-state">No active students are eligible for scoring.</p> : null}
    </div>
  );
}
