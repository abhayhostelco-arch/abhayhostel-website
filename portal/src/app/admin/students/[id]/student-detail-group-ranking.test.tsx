import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import type { Profile, ScoreSettings } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(), getAvatarSignedUrl: vi.fn(), getEntries: vi.fn(), getLeaveRequests: vi.fn(),
  getProfileEnhancements: vi.fn(), getPrivateUploadSignedUrl: vi.fn(), getProfiles: vi.fn(), getScoreSettings: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({
  getAvatarSignedUrl: mocks.getAvatarSignedUrl,
  getEntries: mocks.getEntries,
  getLeaveRequests: mocks.getLeaveRequests,
  getProfileEnhancements: mocks.getProfileEnhancements,
  getPrivateUploadSignedUrl: mocks.getPrivateUploadSignedUrl,
  getProfiles: mocks.getProfiles,
  getScoreSettings: mocks.getScoreSettings,
}));
vi.mock("@/components/daily-entry-form", () => ({ DailyEntryForm: () => null }));
vi.mock("@/components/leave-decision-controls", () => ({ LeaveDecisionControls: () => null }));
vi.mock("@/components/student-birthdate-form", () => ({ StudentBirthDateForm: () => null }));
vi.mock("@/components/student-group-form", () => ({ StudentGroupForm: () => null }));

import StudentDetailPage from "@/app/admin/students/[id]/page";

const profile = (id: string, name: string, group: "abhay_hostel" | "krishna_home"): Profile => ({
  id, role: "student", full_name: name, email: `${id}@example.com`, phone: null, academy_label: null,
  joined_on: "2026-01-01", is_active: true, must_change_password: false, created_by: null, mentor_id: null,
  student_group: group, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const target = profile("00000000-0000-4000-8000-000000000031", "Zulu Target", "abhay_hostel");
const peer = profile("00000000-0000-4000-8000-000000000032", "Alpha Peer", "abhay_hostel");
const otherGroup = profile("00000000-0000-4000-8000-000000000033", "AAA Other", "krishna_home");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue({ id: "owner", role: "super_admin", full_name: "Owner" });
  mocks.getProfiles.mockResolvedValue([target, peer, otherGroup]);
  mocks.getScoreSettings.mockResolvedValue({ score_start_date: "2026-01-01" } as ScoreSettings);
  mocks.getEntries.mockResolvedValue([]);
  mocks.getLeaveRequests.mockResolvedValue({ available: true, requests: [] });
  mocks.getProfileEnhancements.mockResolvedValue({ available: false, birthDate: null, avatarPath: null });
  mocks.getAvatarSignedUrl.mockResolvedValue(null);
  mocks.getPrivateUploadSignedUrl.mockResolvedValue(null);
});

describe("student detail group ranking", () => {
  it("builds the rank from the active same-group cohort and labels its count", async () => {
    const page = await StudentDetailPage({
      params: Promise.resolve({ id: target.id }),
      searchParams: Promise.resolve({ range: "7" }),
    });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(mocks.getEntries).toHaveBeenCalledWith(expect.objectContaining({ studentIds: [target.id, peer.id] }));
    expect(html).toContain("Rank #2 of 2 · Abhay Hostel");
    expect(html).not.toContain("Rank #2 of 3");
  });
});
