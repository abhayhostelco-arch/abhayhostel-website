"use client";

import { useId, useRef, useState } from "react";
import type { StudentGrowthReport } from "@/lib/growth-score";
import { leaderboardPlacement, type LeaderboardCategory } from "@/lib/leaderboard";

const categories: Array<{ id: LeaderboardCategory; label: string }> = [
  { id: "overall", label: "Overall" }, { id: "sadhana", label: "Sadhana" },
  { id: "study", label: "Study" }, { id: "discipline", label: "Discipline" }, { id: "seva", label: "Seva" },
];

export function CategoryLeaderboard({ students, currentStudentId }: { students: StudentGrowthReport[]; currentStudentId?: string }) {
  const [category, setCategory] = useState<LeaderboardCategory>("overall");
  const tabsetId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { leaders, current } = leaderboardPlacement(students, category, currentStudentId);
  function selectTab(index: number) {
    const next = (index + categories.length) % categories.length;
    setCategory(categories[next].id);
    tabRefs.current[next]?.focus();
  }
  return <div>
    <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">
      {categories.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} id={`${tabsetId}-${item.id}-tab`} key={item.id} type="button" role="tab" aria-selected={category === item.id} aria-controls={`${tabsetId}-panel`} tabIndex={category === item.id ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); selectTab(index + 1); } else if (event.key === "ArrowLeft") { event.preventDefault(); selectTab(index - 1); } else if (event.key === "Home") { event.preventDefault(); selectTab(0); } else if (event.key === "End") { event.preventDefault(); selectTab(categories.length - 1); } }} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </div>
    <div id={`${tabsetId}-panel`} className="leaderboard-chart" role="tabpanel" aria-labelledby={`${tabsetId}-${category}-tab`}>
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
