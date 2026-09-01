import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import type { Profile, ScoreSettings } from "@/lib/types";

const mocks = vi.hoisted(() => ({ requireProfile: vi.fn(), getScoreSettings: vi.fn(), getStudentLeaderboardSource: vi.fn() }));

vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({ getScoreSettings: mocks.getScoreSettings, getStudentLeaderboardSource: mocks.getStudentLeaderboardSource }));

import StudentProgressPage from "@/app/student/progress/page";

const profile = (id: string, name: string, group: "abhay_hostel" | "krishna_home" | null): Profile => ({
  id, role: "student", full_name: name, email: `${id}@example.com`, phone: null, academy_label: null,
  joined_on: "2026-01-01", is_active: true, must_change_password: false, created_by: null, mentor_id: null,
  student_group: group, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
});

const student = profile("student-z", "Zulu Student", "abhay_hostel");
const settings = { score_start_date: "2026-01-01" } as ScoreSettings;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue(student);
  mocks.getScoreSettings.mockResolvedValue(settings);
  mocks.getStudentLeaderboardSource.mockResolvedValue({
    students: [profile("student-a", "Alpha Student", "abhay_hostel"), student, profile("student-k", "Krishna Student", "krishna_home")],
    entries: [],
  });
});

describe("student progress group ranking", () => {
  it("shows the student's position and count only within their own group", async () => {
    const page = await StudentProgressPage({ searchParams: Promise.resolve({ range: "7" }) });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain("Rank #2 of 2 · Abhay Hostel");
    expect(html).not.toContain("Rank #2 of 3");
    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
  });

  it("shows migration-required state without a rank for an ungrouped student", async () => {
    const legacyStudent = profile("student-legacy", "Legacy Student", null);
    mocks.requireProfile.mockResolvedValue(legacyStudent);
    mocks.getStudentLeaderboardSource.mockResolvedValue({
      students: [legacyStudent, profile("student-a", "Alpha Student", "abhay_hostel")],
      entries: [],
    });

    const page = await StudentProgressPage({ searchParams: Promise.resolve({ range: "7" }) });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain("Group migration required");
    expect(html).not.toContain("Rank #");
  });
});
