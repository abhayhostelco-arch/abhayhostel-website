import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import type { Profile, ScoreSettings } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(), getEntries: vi.fn(), getProfiles: vi.fn(), getScoreSettings: vi.fn(), getStudentLeaderboardSource: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({
  getEntries: mocks.getEntries,
  getProfiles: mocks.getProfiles,
  getScoreSettings: mocks.getScoreSettings,
  getStudentLeaderboardSource: mocks.getStudentLeaderboardSource,
}));

import MentorDashboard from "@/app/mentor/page";

const profile = (id: string, name: string, group: "abhay_hostel" | "krishna_home", mentorId = "mentor-1"): Profile => ({
  id, role: "student", full_name: name, email: `${id}@example.com`, phone: null, academy_label: null,
  joined_on: "2026-01-01", is_active: true, must_change_password: false, created_by: null, mentor_id: mentorId,
  student_group: group, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const assignedAbhay = profile("assigned-a", "Assigned Abhay", "abhay_hostel");
const assignedKrishna = profile("assigned-k", "Assigned Krishna", "krishna_home");
const outsider = profile("outsider", "AAA Outsider", "abhay_hostel", "mentor-2");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue({ id: "mentor-1", role: "admin", full_name: "Mentor One" });
  mocks.getProfiles.mockResolvedValue([assignedAbhay, assignedKrishna]);
  mocks.getEntries.mockResolvedValue([]);
  mocks.getScoreSettings.mockResolvedValue({ score_start_date: "2026-01-01" } as ScoreSettings);
  mocks.getStudentLeaderboardSource.mockResolvedValue({ students: [outsider, assignedAbhay, assignedKrishna], entries: [] });
});

describe("mentor group scoreboards", () => {
  it("ranks only the authorized assigned cohort before partitioning by group", async () => {
    const html = renderToStaticMarkup(<ThemeProvider>{await MentorDashboard()}</ThemeProvider>);

    expect(html).not.toContain("AAA Outsider");
    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html.match(/<strong>#1<\/strong>/g)).toHaveLength(2);
  });
});
