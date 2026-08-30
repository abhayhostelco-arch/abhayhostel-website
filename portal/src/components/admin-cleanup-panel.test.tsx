// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/cleanup", () => ({
  updateAutoCleanupAction: vi.fn(),
  previewHistoricalCleanupAction: vi.fn(),
  confirmCleanupPreviewAction: vi.fn(),
  resumeCleanupRunAction: vi.fn(),
}));

import { AdminCleanupPanel } from "./admin-cleanup-panel";

describe("AdminCleanupPanel", () => {
  afterEach(cleanup);

  it("shows the default-off toggle and irreversible deletion warning", () => {
    render(<AdminCleanupPanel available settings={{ automaticEnabled: false, lastRun: null }} runs={[]} />);
    expect(screen.getByRole("checkbox", { name: "Automatic cleanup" })).not.toBeChecked();
    expect(screen.getByText(/permanently deletes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save automatic cleanup/i })).toBeInTheDocument();
  });

  it("keeps profile maintenance usable when the migration is unavailable", () => {
    render(<AdminCleanupPanel available={false} settings={null} runs={[]} />);
    expect(screen.getByText(/maintenance migration has not been applied/i)).toBeInTheDocument();
  });

  it("shows high-level eligible counts for a ready preview", () => {
    render(<AdminCleanupPanel available settings={{ automaticEnabled: false, lastRun: null }} runs={[{
      id: "11111111-1111-4111-8111-111111111111", mode: "manual", status: "previewed",
      cutoffDate: "2026-06-01", categories: ["daily_entries", "orphan_files"],
      previewImpact: { rowCounts: { daily_entries: 2 }, objectCount: 1 }, summary: {}, errorSummary: null, createdAt: "2026-08-30T00:00:00.000Z",
    }]} />);
    expect(screen.getByText(/Eligible records:/)).toHaveTextContent("Eligible records: 2");
    expect(screen.getByText(/Eligible orphan files:/)).toHaveTextContent("Eligible orphan files: 1");
  });
});
