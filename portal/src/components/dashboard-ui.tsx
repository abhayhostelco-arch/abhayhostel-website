import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, HeartHandshake, MoonStar, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { GrowthBreakdown, StudentGrowthReport } from "@/lib/growth-score";
import { roundedScores } from "@/lib/growth-score";
import { groupGrowthStudents } from "@/lib/leaderboard";

export type AccentTone = "purple" | "green" | "orange" | "blue" | "rose" | "gold";

export function DashboardMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  tone?: AccentTone;
}) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone}`}>
      <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.9} /></span>
      <div className="dashboard-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

export function DashboardPanel({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`panel dashboard-panel ${className}`.trim()}>
      <header className="dashboard-panel-header">
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {action ? <div className="dashboard-panel-action">{action}</div> : null}
      </header>
      {children}
    </article>
  );
}

const scoreCategories = [
  { key: "sadhana", label: "Sadhana Score", icon: Sparkles, tone: "green" },
  { key: "study", label: "Study Score", icon: BookOpen, tone: "blue" },
  { key: "discipline", label: "Discipline Score", icon: MoonStar, tone: "orange" },
  { key: "seva", label: "Seva & Character", icon: HeartHandshake, tone: "purple" },
] as const;

export function ScoreOverview({ scores }: { scores: GrowthBreakdown }) {
  const values = roundedScores(scores);
  const quality = values.overall >= 85 ? "Excellent" : values.overall >= 70 ? "Good" : values.overall >= 50 ? "Developing" : "Needs Focus";
  return (
    <div className="score-overview">
      <div
        className="score-ring"
        style={{ "--score": `${values.overall * 3.6}deg` } as React.CSSProperties}
        role="img"
        aria-label={`Overall Growth Score ${values.overall} out of 100, ${quality}`}
      >
        <div><strong>{values.overall}</strong><span>/100</span><small>{quality}</small></div>
      </div>
      <div className="score-category-list">
        {scoreCategories.map(({ key, label, icon: Icon, tone }) => (
          <div className={`score-category score-category-${tone}`} key={key}>
            <div><span><Icon size={15} aria-hidden="true" /> {label}</span><strong>{values[key]}/100</strong></div>
            <span className="score-category-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={values[key]}><i style={{ width: `${values[key]}%` }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  meta?: string;
  icon: LucideIcon;
  tone?: AccentTone;
};

export function ActivityList({ items, emptyText = "No recent activity." }: { items: ActivityItem[]; emptyText?: string }) {
  if (!items.length) return <div className="empty-state compact-empty"><strong>No Recent Activity</strong><p>{emptyText}</p></div>;
  return (
    <ol className="activity-list">
      {items.map((item) => {
        const Icon = item.icon;
        return <li key={item.id}><span className={`activity-icon activity-icon-${item.tone ?? "blue"}`} aria-hidden="true"><Icon size={17} /></span><div><strong>{item.title}</strong><span>{item.description}</span></div>{item.meta ? <time>{item.meta}</time> : null}</li>;
      })}
    </ol>
  );
}

export type AttendanceHeatmapDay = {
  date: string;
  label: string;
  value: number | null;
  detail: string;
};

function attendanceLevel(value: number | null) {
  if (value === null) return "unrecorded";
  if (value >= 90) return "present";
  if (value >= 60) return "late";
  return "absent";
}

export function AttendanceHeatmap({ days }: { days: AttendanceHeatmapDay[] }) {
  return (
    <div className="attendance-heatmap-wrap">
      <ol className="attendance-heatmap" aria-label="Recent attendance percentages">
        {days.map((day) => {
          const level = attendanceLevel(day.value);
          return <li key={day.date}><span>{day.label}</span><i className={`attendance-cell attendance-cell-${level}`} aria-hidden="true" /><strong>{day.value === null ? "—" : `${day.value}%`}</strong><small className="visually-hidden">{day.detail}</small></li>;
        })}
      </ol>
      <div className="heatmap-legend" aria-label="Attendance legend"><span><i className="attendance-cell-present" />90%+</span><span><i className="attendance-cell-late" />60–89%</span><span><i className="attendance-cell-absent" />Below 60%</span><span><i className="attendance-cell-unrecorded" />Not Recorded</span></div>
    </div>
  );
}

export function StudentSummaryStrip({
  students,
  hrefBase,
  currentStudentId,
}: {
  students: StudentGrowthReport[];
  hrefBase?: string;
  currentStudentId?: string;
}) {
  return (
    <div className="group-scoreboards">{groupGrowthStudents(students).map((group) => <section className="group-scoreboard" key={group.value}><h3>{group.label}</h3><div className="student-summary-strip" role="region" aria-label={`${group.label} student summaries; scroll horizontally to view more`} tabIndex={0}>
        {group.students.length ? group.students.slice(0, 6).map((student) => {
          const body = <><div><strong title={student.studentName}>{student.studentName}{student.studentId === currentStudentId ? " (You)" : ""}</strong><span className="student-summary-meta">{student.submittedDays}/{student.eligibleDays} entries</span></div><b>{Math.round(student.overall)}<small>/100</small></b>{hrefBase ? <ArrowRight size={17} aria-hidden="true" /> : null}</>;
          return hrefBase ? <Link key={student.studentId} href={`${hrefBase}/${student.studentId}`}>{body}</Link> : <div key={student.studentId}>{body}</div>;
        }) : <div className="empty-state compact-empty"><strong>No Students</strong><p>No students in this group.</p></div>}
      </div></section>)}</div>
  );
}
