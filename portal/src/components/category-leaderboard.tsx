"use client";

import { useId, useRef, useState } from "react";
import type { StudentGrowthReport } from "@/lib/growth-score";
import { groupGrowthStudents, leaderboardPlacement, type LeaderboardCategory } from "@/lib/leaderboard";

const categories: Array<{ id: LeaderboardCategory; label: string }> = [
  { id: "overall", label: "Overall" }, { id: "sadhana", label: "Sadhana" },
  { id: "study", label: "Study" }, { id: "discipline", label: "Discipline (0–50)" }, { id: "seva", label: "Seva" },
];

export function CategoryLeaderboard({ students, currentStudentId }: { students: StudentGrowthReport[]; currentStudentId?: string }) {
  const [category, setCategory] = useState<LeaderboardCategory>("overall");
  const tabsetId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const groups = groupGrowthStudents(students);
  function selectTab(index: number) {
    const next = (index + categories.length) % categories.length;
    setCategory(categories[next].id);
    tabRefs.current[next]?.focus();
  }
  return <div>
    <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">
      {categories.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} id={`${tabsetId}-${item.id}-tab`} key={item.id} type="button" role="tab" aria-selected={category === item.id} aria-controls={`${tabsetId}-panel`} tabIndex={category === item.id ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); selectTab(index + 1); } else if (event.key === "ArrowLeft") { event.preventDefault(); selectTab(index - 1); } else if (event.key === "Home") { event.preventDefault(); selectTab(0); } else if (event.key === "End") { event.preventDefault(); selectTab(categories.length - 1); } }} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </div>
    <div id={`${tabsetId}-panel`} className="group-scoreboards" role="tabpanel" aria-labelledby={`${tabsetId}-${category}-tab`}>
      {groups.map((group) => {
        const { leaders, current } = leaderboardPlacement(group.students, category, currentStudentId);
        const maximum = category === "discipline" ? 50 : 100;
        return <section className="group-scoreboard" key={group.value}><h3>{group.label}</h3>{group.students.length ? <><div className="leaderboard-chart">
          {leaders.map((student) => <div className={`leaderboard-bar-row ${student.studentId === currentStudentId ? "is-current" : ""}`} key={student.studentId}>
            <strong className="leaderboard-rank">#{student.categoryRank}</strong>
            <span className="leaderboard-name" title={student.studentName}>{student.studentName}{student.studentId === currentStudentId ? " (You)" : ""}</span>
            <span className="leaderboard-bar-track" aria-hidden="true"><span style={{ width: `${Math.min(student.categoryScore / maximum * 100, 100)}%` }} /></span>
            <strong className="leaderboard-score">{student.categoryScore}</strong>
          </div>)}
        </div>{current ? <div className="own-rank-card"><span>Your position</span><strong>#{current.categoryRank} of {group.students.length} · {current.studentName}</strong><span>{current.categoryScore}/{maximum}</span></div> : null}</> : <div className="empty-state compact-empty"><strong>No Students</strong><p>No students in this group.</p></div>}</section>;
      })}
    </div>
  </div>;
}
