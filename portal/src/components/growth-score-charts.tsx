"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GrowthBreakdown, WeeklyCategoryPoint } from "@/lib/growth-score";
import { useTheme } from "@/components/theme-provider";

export type GrowthTrendPoint = GrowthBreakdown & { date: string; submitted?: boolean };

export function OverallGrowthChart({ data }: { data: GrowthTrendPoint[] }) {
  const { resolvedTheme } = useTheme();
  if (data.length === 0 || !data.some((point) => point.submitted)) return <div className="empty-state"><strong>No Score Trend Available</strong><p>Submitted entries will appear here.</p></div>;
  return <div className="chart-container" role="img" aria-label="Overall Growth Score trend"><ResponsiveContainer><LineChart key={resolvedTheme} data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><Tooltip cursor={{ stroke: "var(--chart-cursor)" }} contentStyle={{ backgroundColor: "var(--tooltip-bg)", borderColor: "var(--chart-cursor)" }} /><Legend wrapperStyle={{ color: "var(--chart-axis)" }} /><Line type="monotone" dataKey="overall" name="Overall Score" stroke="var(--chart-series-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-series-2)" }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}

export function CategoryGrowthChart({ scores }: { scores: GrowthBreakdown }) {
  const { resolvedTheme } = useTheme();
  const data = [
    { category: "Sadhana", score: Math.round(scores.sadhana) },
    { category: "Study", score: Math.round(scores.study) },
    { category: "Discipline (0–50)", score: Math.round(scores.discipline) },
    { category: "Seva", score: Math.round(scores.seva) },
  ];
  if (!data.some((item) => item.score > 0)) return <div className="empty-state"><strong>No Category Scores Available</strong><p>Category scores will appear after an eligible entry is submitted.</p></div>;
  return <div className="chart-container" role="img" aria-label="Growth Score category comparison"><ResponsiveContainer><BarChart key={resolvedTheme} data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><Tooltip cursor={{ stroke: "var(--chart-cursor)" }} contentStyle={{ backgroundColor: "var(--tooltip-bg)", borderColor: "var(--chart-cursor)" }} /><Bar dataKey="score" name="Score" fill="var(--chart-series-1)" radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>;
}

export function WeeklyCategoryChart({ data }: { data: WeeklyCategoryPoint[] }) {
  const { resolvedTheme } = useTheme();
  if (!data.length) return <div className="empty-state"><strong>No Weekly Progress Available</strong><p>Daily Entries will appear here.</p></div>;
  return <div className="chart-container" role="img" aria-label="Seven-day Growth Score category progress"><ResponsiveContainer><LineChart key={resolvedTheme} data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} /><Tooltip cursor={{ stroke: "var(--chart-cursor)" }} contentStyle={{ backgroundColor: "var(--tooltip-bg)", borderColor: "var(--chart-cursor)" }} /><Legend wrapperStyle={{ color: "var(--chart-axis)" }} /><Line type="monotone" dataKey="sadhana" name="Sadhana" stroke="var(--chart-series-2)" strokeWidth={2} strokeDasharray="7 4" dot={{ r: 3, fill: "var(--chart-series-2)" }} isAnimationActive={false} /><Line type="monotone" dataKey="study" name="Study" stroke="var(--chart-series-1)" strokeWidth={2} strokeDasharray="2 3" dot={{ r: 3, fill: "var(--chart-series-1)" }} isAnimationActive={false} /><Line type="monotone" dataKey="discipline" name="Discipline (0–50)" stroke="var(--chart-series-4)" strokeWidth={2} strokeDasharray="10 4 2 4" dot={{ r: 3, fill: "var(--chart-series-4)" }} isAnimationActive={false} /><Line type="monotone" dataKey="seva" name="Seva" stroke="var(--chart-series-5)" strokeWidth={2} strokeDasharray="1 4" dot={{ r: 3, fill: "var(--chart-series-5)" }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}
