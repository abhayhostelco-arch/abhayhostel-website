import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import type { Profile, ScoreSettings } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(), getAvatarSignedUrl: vi.fn(), getEntries: vi.fn(), getGitaAttendance: vi.fn(),
  getLeaveRequests: vi.fn(), getProfiles: vi.fn(), getScoreSettings: vi.fn(), getStudentLeaderboardSource: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({
  getAvatarSignedUrl: mocks.getAvatarSignedUrl,
  getEntries: mocks.getEntries,
  getGitaAttendance: mocks.getGitaAttendance,
  getLeaveRequests: mocks.getLeaveRequests,
  getProfiles: mocks.getProfiles,
  getScoreSettings: mocks.getScoreSettings,
  getStudentLeaderboardSource: mocks.getStudentLeaderboardSource,
}));

import AdminDashboard from "@/app/admin/page";

const profile = (id: string, name: string, mentorId: string): Profile => ({
  id, role: "student", full_name: name, email: `${id}@example.com`, phone: null, academy_label: null,
  joined_on: "2026-01-01", is_active: true, must_change_password: false, created_by: null, mentor_id: mentorId,
  student_group: "abhay_hostel", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const selected = profile("selected-student", "Zulu Selected", "mentor-1");
const excluded = profile("excluded-student", "Alpha Excluded", "mentor-2");
const mentors = [
  { id: "mentor-1", role: "admin", full_name: "Mentor One", is_active: true, avatar_path: null },
  { id: "mentor-2", role: "admin", full_name: "Mentor Two", is_active: true, avatar_path: null },
] as Profile[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue({ id: "owner", role: "super_admin", full_name: "Owner" });
  mocks.getProfiles.mockImplementation((role: string) => Promise.resolve(role === "student" ? [selected, excluded] : mentors));
  mocks.getScoreSettings.mockResolvedValue({ score_start_date: "2026-01-01" } as ScoreSettings);
  mocks.getStudentLeaderboardSource.mockResolvedValue({ students: [selected, excluded], entries: [] });
  mocks.getEntries.mockResolvedValue([]);
  mocks.getAvatarSignedUrl.mockResolvedValue(null);
  mocks.getGitaAttendance.mockResolvedValue({ available: true, records: [] });
  mocks.getLeaveRequests.mockResolvedValue({ available: true, requests: [] });
});

describe("super admin filtered scoreboards", () => {
  it("removes the featured Student Overview and ranks after the selected Mentor filter", async () => {
    const page = await AdminDashboard({ searchParams: Promise.resolve({ mentorId: "mentor-1", range: "7" }) });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).not.toContain("Student Overview");
    expect(html).not.toContain("Alpha Excluded");
    expect(html).toMatch(/<tr><td>1<\/td><td><a href="\/admin\/students\/selected-student">Zulu Selected<\/a>/);
  });
});
