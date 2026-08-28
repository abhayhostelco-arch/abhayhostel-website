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

export type TrendPoint = {
  date: string;
  studyHours?: number;
  sleepHours?: number;
  completion?: number;
  studentsPresent?: number | null;
};

export function TrendChart({ data, mode = "routine" }: { data: TrendPoint[]; mode?: "routine" | "completion" | "attendance" }) {
  const hasSignal = data.some((point) => mode === "attendance" ? point.studentsPresent !== null && point.studentsPresent !== undefined : mode === "completion" ? (point.completion ?? 0) > 0 : (point.sleepHours ?? 0) > 0 || (point.studyHours ?? 0) > 0);
  if (data.length === 0 || !hasSignal) return <div className="empty-state"><strong>No Trend Available</strong><p>A trend will appear after entries are submitted for this range.</p></div>;
  return (
    <div className="chart-container" role="img" aria-label={mode === "attendance" ? "Students present trend" : mode === "completion" ? "Daily submission completion trend" : "Study and sleep hours trend"}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,34,57,0.10)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={mode !== "attendance"} domain={mode === "completion" ? [0, 100] : [0, "auto"]} />
          <Tooltip />
          <Legend />
          {mode === "attendance" ? (
            <Line type="monotone" dataKey="studentsPresent" name="Students Present" stroke="#347fd0" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          ) : mode === "completion" ? (
            <Line type="monotone" dataKey="completion" name="Completion %" stroke="#2d954f" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          ) : (
            <>
              <Line type="monotone" dataKey="sleepHours" name="Sleep Hours" stroke="#7047c8" strokeWidth={2.25} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="studyHours" name="Study Hours" stroke="#347fd0" strokeWidth={2.25} dot={false} isAnimationActive={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
