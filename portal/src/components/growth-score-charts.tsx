"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GrowthBreakdown, WeeklyCategoryPoint } from "@/lib/growth-score";

export type GrowthTrendPoint = GrowthBreakdown & { date: string; submitted?: boolean };

export function OverallGrowthChart({ data }: { data: GrowthTrendPoint[] }) {
  if (data.length === 0 || !data.some((point) => point.submitted)) return <div className="empty-state"><strong>No Score Trend Available</strong><p>Submitted entries will appear here.</p></div>;
  return <div className="chart-container" role="img" aria-label="Overall Growth Score trend"><ResponsiveContainer><LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(10,34,57,0.10)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="overall" name="Overall Score" stroke="#7047c8" strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}

export function CategoryGrowthChart({ scores }: { scores: GrowthBreakdown }) {
  const data = [
    { category: "Sadhana", score: Math.round(scores.sadhana) },
    { category: "Study", score: Math.round(scores.study) },
    { category: "Discipline", score: Math.round(scores.discipline) },
    { category: "Seva", score: Math.round(scores.seva) },
  ];
  if (!data.some((item) => item.score > 0)) return <div className="empty-state"><strong>No Category Scores Available</strong><p>Category scores will appear after an eligible entry is submitted.</p></div>;
  return <div className="chart-container" role="img" aria-label="Growth Score category comparison"><ResponsiveContainer><BarChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(10,34,57,0.10)" /><XAxis dataKey="category" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="score" name="Score" fill="#123b74" radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>;
}

export function WeeklyCategoryChart({ data }: { data: WeeklyCategoryPoint[] }) {
  if (!data.length) return <div className="empty-state"><strong>No Weekly Progress Available</strong><p>Daily Entries will appear here.</p></div>;
  return <div className="chart-container" role="img" aria-label="Seven-day Growth Score category progress"><ResponsiveContainer><LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(10,34,57,0.10)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="sadhana" name="Sadhana" stroke="#7047c8" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="study" name="Study" stroke="#2876d2" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="discipline" name="Discipline" stroke="#f2a62b" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="seva" name="Seva" stroke="#e64378" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}
