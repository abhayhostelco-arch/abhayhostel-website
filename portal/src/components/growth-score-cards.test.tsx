// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GrowthScoreCards } from "@/components/growth-score-cards";
import { ScoreOverview } from "@/components/dashboard-ui";

const scores = { overall: 65, sadhana: 80, study: 70, discipline: 50, seva: 40 };

describe("Discipline score presentation", () => {
  afterEach(cleanup);

  it("labels the fixed 50-point Discipline rubric in growth score cards", () => {
    render(<GrowthScoreCards scores={scores} />);

    expect(screen.getByText("50/50")).toBeInTheDocument();
    expect(screen.getByText("Sleep & Wake · fixed 50-point rubric")).toBeInTheDocument();
  });

  it("uses the 50-point scale in detailed score summaries", () => {
    render(<ScoreOverview scores={scores} />);

    expect(screen.getByText("50/50")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Discipline Score (0–50)" })).toHaveAttribute("aria-valuemax", "50");
  });
});
