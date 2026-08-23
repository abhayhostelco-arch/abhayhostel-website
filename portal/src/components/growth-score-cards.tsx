import type { GrowthBreakdown } from "@/lib/growth-score";
import { roundedScores } from "@/lib/growth-score";
import { BookOpen, HeartHandshake, Medal, MoonStar, Sparkles } from "lucide-react";

export function GrowthScoreCards({ scores }: { scores: GrowthBreakdown }) {
  const value = roundedScores(scores);
  return (
    <div className="growth-score-grid">
      <article className="metric-card growth-score-overall"><span><Medal size={18} aria-hidden="true" /> Overall Growth Score</span><strong>{value.overall}/100</strong><div className="score-track"><i style={{ width: `${value.overall}%` }} /></div></article>
      <article className="metric-card score-sadhana"><span><Sparkles size={18} aria-hidden="true" /> Sadhana</span><strong>{value.sadhana}/100</strong><div className="score-track"><i style={{ width: `${value.sadhana}%` }} /></div></article>
      <article className="metric-card score-study"><span><BookOpen size={18} aria-hidden="true" /> Study</span><strong>{value.study}/100</strong><div className="score-track"><i style={{ width: `${value.study}%` }} /></div></article>
      <article className="metric-card score-discipline"><span><MoonStar size={18} aria-hidden="true" /> Discipline</span><strong>{value.discipline}/100</strong><div className="score-track"><i style={{ width: `${value.discipline}%` }} /></div></article>
      <article className="metric-card score-seva"><span><HeartHandshake size={18} aria-hidden="true" /> Seva &amp; Character</span><strong>{value.seva}/100</strong><div className="score-track"><i style={{ width: `${value.seva}%` }} /></div></article>
    </div>
  );
}
