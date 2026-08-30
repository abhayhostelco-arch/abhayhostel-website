// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryGrowthChart, WeeklyCategoryChart, OverallGrowthChart } from "@/components/growth-score-charts";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("recharts", async () => {
  const React = await import("react");
  const wrap = (name: string, tag = "g") => { function Mock(props: Record<string, unknown>) { return React.createElement(tag, { "data-component": name, className: name === "x" ? "recharts-cartesian-axis-line" : undefined, stroke: (props.axisLine as { stroke?: string } | undefined)?.stroke, ...props }, props.children as React.ReactNode); } Mock.displayName = `Mock${name}`; return Mock; };
  return { CartesianGrid: wrap("grid"), XAxis: wrap("x"), YAxis: wrap("y"), Tooltip: wrap("tooltip"), Legend: wrap("legend"), ResponsiveContainer: wrap("responsive", "div"), LineChart: wrap("chart"), BarChart: wrap("bar-chart"), Line: (props: Record<string, unknown>) => React.createElement("path", { className: "recharts-line-curve", ...props }), Bar: (props: Record<string, unknown>) => React.createElement("rect", { className: "recharts-rectangle", ...props }) };
});

describe("Growth charts theme presentation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses chart tokens for axes, plot grid, and category bars", async () => {
    render(<ThemeProvider><CategoryGrowthChart scores={{ overall: 65, sadhana: 80, study: 70, discipline: 60, seva: 50 }} /></ThemeProvider>);
    expect(await screen.findByRole("img", { name: "Growth Score category comparison" })).toBeInTheDocument();
    expect(document.querySelector(".recharts-cartesian-axis-line"))
      .toHaveAttribute("stroke", "var(--chart-axis)");
    expect(document.querySelector(".recharts-rectangle"))
      .toHaveAttribute("fill", "var(--chart-series-1)");
  });

  it("gives every weekly series a distinct dash cue", async () => {
    render(<ThemeProvider><WeeklyCategoryChart data={[{ date: "Mon", sadhana: 1, study: 2, discipline: 3, seva: 4 }]} /></ThemeProvider>);
    expect(await screen.findByRole("img", { name: "Seven-day Growth Score category progress" })).toBeInTheDocument();
    const dashes = [...document.querySelectorAll<SVGPathElement>(".recharts-line-curve")].map((line) => line.getAttribute("stroke-dasharray"));
    expect(dashes).toEqual(["7 4", "2 3", "10 4 2 4", "1 4"]);
  });

  it("uses semantic tokens for the overall line", async () => {
    render(<ThemeProvider><OverallGrowthChart data={[{ date: "Mon", overall: 80, sadhana: 1, study: 1, discipline: 1, seva: 1, submitted: true }]} /></ThemeProvider>);
    expect(await screen.findByRole("img", { name: "Overall Growth Score trend" })).toBeInTheDocument();
    expect(document.querySelector(".recharts-line-curve")).toHaveAttribute("stroke", "var(--chart-series-2)");
  });
});
