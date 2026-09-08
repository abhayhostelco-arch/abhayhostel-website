// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyEntryForm } from "@/components/daily-entry-form";

const mocks = vi.hoisted(() => ({ save: vi.fn(), createUploadGrant: vi.fn(), removeEvidence: vi.fn(), upload: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/daily-entry", () => ({
  saveDailyEntryAction: mocks.save,
  createDailyEntryEvidenceUploadAction: mocks.createUploadGrant,
  removeDailyEntryEvidenceAction: mocks.removeEvidence,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } }),
}));

function validJpegFile(name = "mantra.jpg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: "image/jpeg" });
}

describe("DailyEntryForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ data: null, error: { code: "NETWORK_ERROR", status: 0, message: "network details" } });
    mocks.createUploadGrant.mockResolvedValue({ status: "success", path: "11111111-1111-4111-8111-111111111111/2026-09-07/maha-mantra-1.jpg", token: "signed-token" });
    mocks.removeEvidence.mockResolvedValue(true);
    mocks.save.mockResolvedValue({ status: "success", message: "Daily entry saved." });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close: vi.fn() }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the disabled operation group on the full two-column form grid", () => {
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);

    const operationGroup = screen.getByLabelText("Wake-up date").closest("fieldset");
    expect(operationGroup).toHaveClass("split-form", "full-span");
  });

  it("preserves every entered value and the selected file after upload failure", async () => {
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });
    const rounds = screen.getByLabelText("Morning meditation (chanting rounds)") as HTMLInputElement;
    fireEvent.change(rounds, { target: { value: "12" } });
    const file = validJpegFile();
    const input = screen.getByLabelText("Choose Maha Mantra image") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByAltText("Maha Mantra evidence preview")).toBeInTheDocument());

    fireEvent.submit(screen.getByRole("button", { name: "Save Daily Entry" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("The image could not be uploaded because the network connection was lost. Your form data is preserved; reconnect and try again.");
    expect(rounds).toHaveValue(12);
    expect(input.files?.[0]).toBe(file);
    expect(screen.getByRole("alert").compareDocumentPosition(screen.getByLabelText("Wake-up date")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("requires evidence beside the evidence field and in the top alert summary", async () => {
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "absent" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save Daily Entry" }).closest("form")!);

    const matches = await screen.findAllByText("Select a Maha Mantra image before saving a late or absent entry.");
    expect(matches).toHaveLength(2);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("clears the actual selected file and preview when Morning Arati becomes present", async () => {
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });
    const input = screen.getByLabelText("Choose Maha Mantra image") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [validJpegFile()] } });
    await screen.findByAltText("Maha Mantra evidence preview");

    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "present" } });
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });

    expect((screen.getByLabelText("Choose Maha Mantra image") as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByAltText("Maha Mantra evidence preview")).not.toBeInTheDocument();
  });

  it("removes selected evidence with the preview cross and requires a replacement", async () => {
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });
    fireEvent.change(screen.getByLabelText("Choose Maha Mantra image"), { target: { files: [validJpegFile()] } });
    await screen.findByAltText("Maha Mantra evidence preview");

    fireEvent.click(screen.getByRole("button", { name: "Remove selected image" }));

    expect(screen.queryByAltText("Maha Mantra evidence preview")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Choose Maha Mantra image") as HTMLInputElement).files).toHaveLength(0);
    expect(await screen.findAllByText("Select a Maha Mantra image before saving a late or absent entry.")).toHaveLength(2);
  });

  it("removes a temporary upload and preserves the form when the entry save fails", async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.save.mockResolvedValue({ status: "error", message: "backend details" });
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });
    const input = screen.getByLabelText("Choose Maha Mantra image") as HTMLInputElement;
    const file = validJpegFile();
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByAltText("Maha Mantra evidence preview");

    fireEvent.submit(screen.getByRole("button", { name: "Save Daily Entry" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("The image uploaded, but the daily entry could not be saved. Your form data is preserved; try again.");
    expect(mocks.removeEvidence).toHaveBeenCalledOnce();
    expect(input.files?.[0]).toBe(file);
  });

  it("reports scheduled orphan cleanup when immediate temporary-image removal fails", async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.save.mockResolvedValue({ status: "error", message: "backend details" });
    mocks.removeEvidence.mockResolvedValue(false);
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.change(screen.getByLabelText("Morning Arati"), { target: { value: "late" } });
    fireEvent.change(screen.getByLabelText("Choose Maha Mantra image"), { target: { files: [validJpegFile()] } });
    await screen.findByAltText("Maha Mantra evidence preview");

    fireEvent.submit(screen.getByRole("button", { name: "Save Daily Entry" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("The entry was not saved. Your form data is preserved. The temporary image will be removed automatically.");
  });

  it("recovers from a thrown entry-save failure without locking the form", async () => {
    mocks.save.mockRejectedValue(new TypeError("connection lost"));
    render(<DailyEntryForm selectedDate="2026-09-07" minDate="2026-09-06" maxDate="2026-09-07" ownerStudentId="11111111-1111-4111-8111-111111111111" />);

    fireEvent.submit(screen.getByRole("button", { name: "Save Daily Entry" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("The entry was not saved. Your form data is preserved; try again.");
    expect(screen.getByRole("button", { name: "Save Daily Entry" })).toBeEnabled();
  });
});
