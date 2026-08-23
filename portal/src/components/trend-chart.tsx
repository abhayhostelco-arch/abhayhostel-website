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
};

export function TrendChart({ data, mode = "routine" }: { data: TrendPoint[]; mode?: "routine" | "completion" }) {
  const hasSignal = data.some((point) => mode === "completion" ? (point.completion ?? 0) > 0 : (point.sleepHours ?? 0) > 0 || (point.studyHours ?? 0) > 0);
  if (data.length === 0 || !hasSignal) return <div className="empty-state"><strong>No Trend Available</strong><p>A trend will appear after entries are submitted for this range.</p></div>;
  return (
    <div className="chart-container" aria-label="Trend chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,34,57,0.10)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={mode === "completion" ? [0, 100] : [0, "auto"]} />
          <Tooltip />
          <Legend />
          {mode === "completion" ? (
            <Line type="monotone" dataKey="completion" name="Completion %" stroke="#b9852b" strokeWidth={2} dot={false} />
          ) : (
            <>
              <Line type="monotone" dataKey="sleepHours" name="Sleep hours" stroke="#123554" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="studyHours" name="Study hours" stroke="#b9852b" strokeWidth={2} dot={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
