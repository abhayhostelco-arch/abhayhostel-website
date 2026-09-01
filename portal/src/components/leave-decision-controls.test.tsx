// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  decideLeaveRequestAction: vi.fn().mockResolvedValue({ status: "success", message: "Decision saved; email sent" }),
  retryLeaveNotificationAction: vi.fn().mockResolvedValue({ status: "success", message: "Email retry queued." }),
}));
vi.mock("@/app/actions/leave", () => actions);

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

  it("reports the decision email result returned by the server action", async () => {
    const controlsModule = await loadControls();
    expect(controlsModule).not.toBeNull();
    if (!controlsModule) return;

    render(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="pending" decisionNote={null} canDecide />);
    fireEvent.submit(screen.getByRole("button", { name: "Approve" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Decision saved; email sent"));
  });

  it("shows Retry only for a Super Admin with a failed email notification", async () => {
    const controlsModule = await loadControls();
    expect(controlsModule).not.toBeNull();
    if (!controlsModule) return;

    const { rerender } = render(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="rejected" decisionNote="Dates conflict" canDecide notificationId="22222222-2222-4222-8222-222222222222" notificationStatus="failed" canRetry />);
    expect(screen.getByRole("button", { name: "Retry email" })).toBeInTheDocument();

    rerender(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="approved" decisionNote={null} canDecide notificationId="22222222-2222-4222-8222-222222222222" notificationStatus="failed" canRetry />);
    expect(screen.getByRole("button", { name: "Retry email" })).toBeInTheDocument();

    rerender(<controlsModule.LeaveDecisionControls requestId="11111111-1111-4111-8111-111111111111" studentName="Mithlesh Kumar" status="rejected" decisionNote="Dates conflict" canDecide={false} notificationId="22222222-2222-4222-8222-222222222222" notificationStatus="failed" canRetry={false} />);
    expect(screen.queryByRole("button", { name: "Retry email" })).not.toBeInTheDocument();
  });
});
