import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyEntry, Profile } from "@/lib/types";

const mocks = vi.hoisted(() => ({ requireProfile: vi.fn(), getEntries: vi.fn(), getPrivateUploadSignedUrl: vi.fn() }));

vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({ getEntries: mocks.getEntries, getPrivateUploadSignedUrl: mocks.getPrivateUploadSignedUrl }));
vi.mock("@/components/daily-entry-form", () => ({ DailyEntryForm: () => null }));

import StudentEntryPage from "@/app/student/entry/page";

const studentId = "00000000-0000-4000-8000-000000000031";
const student = { id: studentId, role: "student", full_name: "Student", must_change_password: false } as Profile;
const evidenceEntry: DailyEntry = {
  id: "entry-with-evidence", student_id: studentId, entry_date: "2026-09-08", sleep_time: "21:00:00", wake_time: "04:00:00",
  study_minutes: 60, chanting_rounds: 16, gita_class_status: "present", morning_arati_attended: false,
  morning_arati_status: "late", maha_mantra_path: `${studentId}/2026-09-08/maha-mantra-1.jpg`,
  evening_reading_minutes: 30, library_attended: true, seva_minutes: 60, note: null,
  created_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue(student);
  mocks.getEntries.mockResolvedValue([evidenceEntry]);
  mocks.getPrivateUploadSignedUrl.mockImplementation(async (_bucket: string, path?: string | null) => path ? "https://portal.example/student-evidence.jpg" : null);
});

describe("Student Recent History evidence", () => {
  it("links the owning Student to available Morning Arati evidence", async () => {
    const page = await StudentEntryPage({ searchParams: Promise.resolve({ date: evidenceEntry.entry_date }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('href="https://portal.example/student-evidence.jpg"');
    expect(html).toContain("View image");
  });
});
