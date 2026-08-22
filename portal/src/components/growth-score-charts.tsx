"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GrowthBreakdown } from "@/lib/growth-score";

export type GrowthTrendPoint = GrowthBreakdown & { date: string };

export function OverallGrowthChart({ data }: { data: GrowthTrendPoint[] }) {
  if (data.length === 0) return <p className="empty-state">No scored days in this range.</p>;
  return <div className="chart-container" aria-label="Overall Growth Score trend"><ResponsiveContainer><LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(6,29,58,0.12)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="overall" name="Overall score" stroke="#c38a20" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>;
}

export function CategoryGrowthChart({ scores }: { scores: GrowthBreakdown }) {
  const data = [
    { category: "Sadhana", score: Math.round(scores.sadhana) },
    { category: "Study", score: Math.round(scores.study) },
    { category: "Discipline", score: Math.round(scores.discipline) },
    { category: "Seva", score: Math.round(scores.seva) },
  ];
  return <div className="chart-container" aria-label="Growth Score category comparison"><ResponsiveContainer><BarChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(6,29,58,0.12)" /><XAxis dataKey="category" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="score" name="Score" fill="#061d3a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
