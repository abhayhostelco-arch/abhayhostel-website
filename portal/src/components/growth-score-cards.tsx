import type { GrowthBreakdown } from "@/lib/growth-score";
import { roundedScores } from "@/lib/growth-score";
import { BookOpen, HeartHandshake, Medal, MoonStar, Sparkles } from "lucide-react";
import { DashboardMetric } from "@/components/dashboard-ui";

export function GrowthScoreCards({ scores }: { scores: GrowthBreakdown }) {
  const value = roundedScores(scores);
  return (
    <div className="growth-score-grid">
      <DashboardMetric label="Overall Growth" value={`${value.overall}/100`} detail="Combined Score" icon={Medal} tone="purple" />
      <DashboardMetric label="Sadhana" value={`${value.sadhana}/100`} detail="Morning Routine" icon={Sparkles} tone="green" />
      <DashboardMetric label="Study" value={`${value.study}/100`} detail="Study & Class" icon={BookOpen} tone="blue" />
      <DashboardMetric label="Discipline" value={`${value.discipline}/100`} detail="Sleep & Wake" icon={MoonStar} tone="orange" />
      <DashboardMetric label="Seva & Character" value={`${value.seva}/100`} detail="Service Minutes" icon={HeartHandshake} tone="rose" />
    </div>
  );
}
