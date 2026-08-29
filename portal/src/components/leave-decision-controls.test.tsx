// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/leave", () => ({ decideLeaveRequestAction: vi.fn() }));

async function loadControls() {
  try {
    const componentPath = "@/components/leave-decision-controls";
    return await import(/* @vite-ignore */ componentPath) as typeof import("@/components/leave-decision-controls");
  } catch {
    return null;
  }
}

describe("LeaveDecisionControls", () => {
  afterEach(cleanup);

  it("shows approval controls for a pending request when decisions are allowed", async () => {
    const controlsModule = await loadControls();
    expect(controlsModule).not.toBeNull();
    if (!controlsModule) return;

    render(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="pending" decisionNote={null} canDecide />);

    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for rejecting Mithlesh Kumar")).toBeRequired();
  });

  it("shows rejection controls for an approved request when Admin decisions are allowed", async () => {
    const controlsModule = await loadControls();
    expect(controlsModule).not.toBeNull();
    if (!controlsModule) return;

    render(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="approved" decisionNote={null} canDecide />);

    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("keeps pending requests read-only when decisions are not allowed", async () => {
    const controlsModule = await loadControls();
    expect(controlsModule).not.toBeNull();
    if (!controlsModule) return;

    render(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="pending" decisionNote={null} canDecide={false} />);

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
