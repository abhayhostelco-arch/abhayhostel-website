// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrendChart } from "@/components/trend-chart";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("recharts", async () => {
  const React = await import("react");
  const wrap = (name: string, tag = "g") => { function Mock(props: Record<string, unknown>) { return React.createElement(tag, { "data-component": name, className: name === "grid" ? "recharts-cartesian-grid-horizontal" : undefined, ...props }, props.children as React.ReactNode); } Mock.displayName = `Mock${name}`; return Mock; };
  return { CartesianGrid: wrap("grid"), XAxis: wrap("x"), YAxis: wrap("y"), Tooltip: wrap("tooltip"), Legend: wrap("legend"), ResponsiveContainer: wrap("responsive", "div"), LineChart: wrap("chart"), Line: (props: Record<string, unknown>) => React.createElement("path", { className: "recharts-line-curve", ...props }) };
});

describe("TrendChart theme presentation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses semantic chart tokens and non-color cues for the multi-series trend", async () => {
    render(<ThemeProvider><TrendChart data={[{ date: "Mon", sleepHours: 7, studyHours: 4 }]} /></ThemeProvider>);

    expect(await screen.findByRole("img", { name: "Study and sleep hours trend" })).toBeInTheDocument();
    const lines = document.querySelectorAll(".recharts-line-curve");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("stroke", "var(--chart-series-2)");
    expect(lines[1]).toHaveAttribute("stroke", "var(--chart-series-1)");
    expect(lines[0]).toHaveAttribute("stroke-dasharray", "7 4");
    expect(lines[1]).toHaveAttribute("stroke-dasharray", "2 3");
    expect(document.querySelector(".recharts-cartesian-grid-horizontal"))
      .toHaveAttribute("stroke", "var(--chart-grid)");
  });
});
