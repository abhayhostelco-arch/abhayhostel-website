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
  if (data.length === 0) return <p className="empty-state">No data in this range.</p>;
  return (
    <div className="chart-container" aria-label="Trend chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,29,58,0.12)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={mode === "completion" ? [0, 100] : [0, "auto"]} />
          <Tooltip />
          <Legend />
          {mode === "completion" ? (
            <Line type="monotone" dataKey="completion" name="Completion %" stroke="#c38a20" strokeWidth={3} dot={false} />
          ) : (
            <>
              <Line type="monotone" dataKey="sleepHours" name="Sleep hours" stroke="#061d3a" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="studyHours" name="Study hours" stroke="#c38a20" strokeWidth={3} dot={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
