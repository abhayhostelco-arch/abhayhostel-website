"use client";

import { useState } from "react";
import type { StudentGrowthReport } from "@/lib/growth-score";
import { leaderboardPlacement, type LeaderboardCategory } from "@/lib/leaderboard";

const categories: Array<{ id: LeaderboardCategory; label: string }> = [
  { id: "overall", label: "Overall" }, { id: "sadhana", label: "Sadhana" },
  { id: "study", label: "Study" }, { id: "discipline", label: "Discipline" }, { id: "seva", label: "Seva" },
];

export function CategoryLeaderboard({ students, currentStudentId }: { students: StudentGrowthReport[]; currentStudentId?: string }) {
  const [category, setCategory] = useState<LeaderboardCategory>("overall");
  const { leaders, current } = leaderboardPlacement(students, category, currentStudentId);
  return <div>
    <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">
      {categories.map((item) => <button key={item.id} type="button" role="tab" aria-selected={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </div>
    <div className="leaderboard-chart" role="tabpanel" aria-label={`${categories.find((item) => item.id === category)?.label} top 10`}>
      {leaders.map((student) => <div className={`leaderboard-bar-row ${student.studentId === currentStudentId ? "is-current" : ""}`} key={student.studentId}>
        <strong className="leaderboard-rank">#{student.categoryRank}</strong>
        <span className="leaderboard-name" title={student.studentName}>{student.studentName}{student.studentId === currentStudentId ? " (You)" : ""}</span>
        <span className="leaderboard-bar-track" aria-hidden="true"><span style={{ width: `${student.categoryScore}%` }} /></span>
        <strong className="leaderboard-score">{student.categoryScore}</strong>
      </div>)}
      {!leaders.length ? <div className="empty-state"><strong>No eligible students</strong><p>The leaderboard will appear when scoring begins.</p></div> : null}
    </div>
    {current ? <div className="own-rank-card"><span>Your position</span><strong>#{current.categoryRank} · {current.studentName}</strong><span>{current.categoryScore}/100</span></div> : null}
  </div>;
}
