// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import type { ScoreSettings } from "@/lib/types";

vi.mock("@/app/actions/settings", () => ({ updateScoreSettingsAction: vi.fn() }));

import { ScoreSettingsForm } from "@/components/score-settings-form";

const settings: ScoreSettings = {
  id: true, sadhana_weight: 40, study_weight: 25, discipline_weight: 20, seva_weight: 15,
  chanting_target_rounds: 16, evening_reading_target_minutes: 90, study_target_minutes: 240,
  wake_target_time: "06:00:00", bedtime_target_time: "22:30:00", seva_target_minutes: 60,
  discipline_grace_minutes: 120, score_start_date: "2026-08-20", updated_by: null, updated_at: "2026-08-20T00:00:00Z",
};

describe("configurable Growth Score settings", () => {
  it("exposes the rubric controls and scoring launch date", () => {
    render(<ScoreSettingsForm settings={settings} />);

    expect(screen.getByLabelText("Sadhana weight (%)")).toHaveValue(40);
    expect(screen.getByLabelText("Study target (minutes)")).toHaveValue(240);
    expect(screen.getByLabelText("Wake-up target")).toHaveValue("06:00");
    expect(screen.getByLabelText("Scoring launch date")).toHaveValue("2026-08-20");
  });
});
