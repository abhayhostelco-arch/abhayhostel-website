// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveRequestForm } from "@/components/leave-request-form";

const mocks = vi.hoisted(() => ({
  createUploadGrant: vi.fn(),
  createLeaveRequest: vi.fn(),
  uploadToSignedUrl: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl: mocks.uploadToSignedUrl }),
    },
  }),
}));

vi.mock("@/app/actions/leave", () => ({
  createLeaveAttachmentUploadAction: mocks.createUploadGrant,
  createLeaveRequestAction: mocks.createLeaveRequest,
}));

describe("LeaveRequestForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.createUploadGrant.mockReset();
    mocks.createLeaveRequest.mockReset();
    mocks.uploadToSignedUrl.mockReset();
    mocks.refresh.mockReset();
    mocks.createUploadGrant.mockResolvedValue({
      status: "success",
      path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/application-1.jpg",
      token: "signed-upload-token",
    });
    mocks.uploadToSignedUrl.mockResolvedValue({ data: null, error: { message: "upload failed" } });
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
  });

  it("preserves entered fields when an attachment upload fails", async () => {
    render(<LeaveRequestForm studentId="11111111-1111-4111-8111-111111111111" minDate="2026-08-29" />);

    const from = screen.getByLabelText("From") as HTMLInputElement;
    const to = screen.getByLabelText("To") as HTMLInputElement;
    const reason = screen.getByLabelText("Reason") as HTMLTextAreaElement;
    const attachment = screen.getByLabelText("Choose JPG, PNG, or PDF") as HTMLInputElement;
    fireEvent.change(from, { target: { value: "2026-08-30" } });
    fireEvent.change(to, { target: { value: "2026-08-31" } });
    fireEvent.change(reason, { target: { value: "Visiting family for Janmashtami." } });
    fireEvent.change(attachment, {
      target: { files: [new File(["image"], "application.jpeg", { type: "image/jpeg" })] },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Submit for Approval" }).closest("form")!);

    await screen.findByRole("alert");
    await waitFor(() => expect(mocks.uploadToSignedUrl).toHaveBeenCalledOnce());
    expect(from).toHaveValue("2026-08-30");
    expect(to).toHaveValue("2026-08-31");
    expect(reason).toHaveValue("Visiting family for Janmashtami.");
    expect(attachment.files).toHaveLength(1);
  });

  it("preserves entered fields when the server rejects the leave request", async () => {
    mocks.createLeaveRequest.mockResolvedValue({ status: "error", message: "These dates overlap an existing request." });
    render(<LeaveRequestForm studentId="11111111-1111-4111-8111-111111111111" minDate="2026-08-29" />);

    const from = screen.getByLabelText("From") as HTMLInputElement;
    const to = screen.getByLabelText("To") as HTMLInputElement;
    const reason = screen.getByLabelText("Reason") as HTMLTextAreaElement;
    fireEvent.change(from, { target: { value: "2026-08-30" } });
    fireEvent.change(to, { target: { value: "2026-08-31" } });
    fireEvent.change(reason, { target: { value: "Visiting family for Janmashtami." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit for Approval" }).closest("form")!);

    await screen.findByRole("alert");
    await waitFor(() => expect(mocks.createLeaveRequest).toHaveBeenCalledOnce());
    expect(from).toHaveValue("2026-08-30");
    expect(to).toHaveValue("2026-08-31");
    expect(reason).toHaveValue("Visiting family for Janmashtami.");
  });

  it("shows inline errors and does not call the backend for invalid details", async () => {
    render(<LeaveRequestForm studentId="11111111-1111-4111-8111-111111111111" minDate="2026-08-29" />);

    fireEvent.submit(screen.getByRole("button", { name: "Submit for Approval" }).closest("form")!);

    expect(await screen.findByText("Choose a start date.")).toBeInTheDocument();
    expect(screen.getByText("Choose an end date.")).toBeInTheDocument();
    expect(screen.getByText("Explain why you need to go home.")).toBeInTheDocument();
    expect(mocks.createUploadGrant).not.toHaveBeenCalled();
    expect(mocks.createLeaveRequest).not.toHaveBeenCalled();
  });

  it("clears the form only after a successful submission", async () => {
    mocks.createLeaveRequest.mockResolvedValue({ status: "success", message: "Leave application submitted." });
    render(<LeaveRequestForm studentId="11111111-1111-4111-8111-111111111111" minDate="2026-08-29" />);

    const from = screen.getByLabelText("From") as HTMLInputElement;
    const to = screen.getByLabelText("To") as HTMLInputElement;
    const reason = screen.getByLabelText("Reason") as HTMLTextAreaElement;
    fireEvent.change(from, { target: { value: "2026-08-30" } });
    fireEvent.change(to, { target: { value: "2026-08-31" } });
    fireEvent.change(reason, { target: { value: "Visiting family for Janmashtami." } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit for Approval" }).closest("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent("Leave application submitted.");
    expect(from).toHaveValue("");
    expect(to).toHaveValue("");
    expect(reason).toHaveValue("");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
