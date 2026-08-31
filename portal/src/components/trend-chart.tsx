"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";

export type TrendPoint = {
  date: string;
  studyHours?: number;
  sleepHours?: number;
  completion?: number;
  studentsPresent?: number | null;
};

export function TrendChart({ data, mode = "routine" }: { data: TrendPoint[]; mode?: "routine" | "completion" | "attendance" }) {
  const { resolvedTheme } = useTheme();
  const hasSignal = data.some((point) => mode === "attendance" ? point.studentsPresent !== null && point.studentsPresent !== undefined : mode === "completion" ? (point.completion ?? 0) > 0 : (point.sleepHours ?? 0) > 0 || (point.studyHours ?? 0) > 0);
  if (data.length === 0 || !hasSignal) return <div className="empty-state"><strong>No Trend Available</strong><p>A trend will appear after entries are submitted for this range.</p></div>;
  return (
    <div className="chart-container" role="img" aria-label={mode === "attendance" ? "Students present trend" : mode === "completion" ? "Daily submission completion trend" : "Study and sleep hours trend"}>
      <ResponsiveContainer>
        <LineChart key={resolvedTheme} data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={{ stroke: "var(--chart-axis)" }} tickLine={{ stroke: "var(--chart-axis)" }} allowDecimals={mode !== "attendance"} domain={mode === "completion" ? [0, 100] : [0, "auto"]} />
          <Tooltip cursor={{ stroke: "var(--chart-cursor)" }} contentStyle={{ backgroundColor: "var(--tooltip-bg)", borderColor: "var(--chart-cursor)", color: "var(--tooltip-text)" }} labelStyle={{ color: "var(--tooltip-text)" }} itemStyle={{ color: "var(--tooltip-text)" }} />
          <Legend wrapperStyle={{ color: "var(--chart-axis)" }} />
          {mode === "attendance" ? (
            <Line type="monotone" dataKey="studentsPresent" name="Students Present" stroke="var(--chart-series-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-series-1)" }} connectNulls={false} isAnimationActive={false} />
          ) : mode === "completion" ? (
            <Line type="monotone" dataKey="completion" name="Completion %" stroke="var(--chart-series-3)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-series-3)" }} isAnimationActive={false} />
          ) : (
            <>
              <Line type="monotone" dataKey="sleepHours" name="Sleep Hours" stroke="var(--chart-series-2)" strokeWidth={2.25} strokeDasharray="7 4" dot={{ r: 3, fill: "var(--chart-series-2)" }} isAnimationActive={false} />
              <Line type="monotone" dataKey="studyHours" name="Study Hours" stroke="var(--chart-series-1)" strokeWidth={2.25} strokeDasharray="2 3" dot={{ r: 3, fill: "var(--chart-series-1)" }} isAnimationActive={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
