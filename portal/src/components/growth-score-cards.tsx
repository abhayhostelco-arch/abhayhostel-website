import type { GrowthBreakdown } from "@/lib/growth-score";
import { roundedScores } from "@/lib/growth-score";

export function GrowthScoreCards({ scores }: { scores: GrowthBreakdown }) {
  const value = roundedScores(scores);
  return (
    <div className="growth-score-grid">
      <article className="metric-card growth-score-overall"><span>Overall Growth Score</span><strong>{value.overall}/100</strong></article>
      <article className="metric-card"><span>🕉️ Sadhana</span><strong>{value.sadhana}</strong></article>
      <article className="metric-card"><span>📚 Study</span><strong>{value.study}</strong></article>
      <article className="metric-card"><span>🛏️ Discipline</span><strong>{value.discipline}</strong></article>
      <article className="metric-card"><span>🤝 Seva &amp; Character</span><strong>{value.seva}</strong></article>
    </div>
  );
}
