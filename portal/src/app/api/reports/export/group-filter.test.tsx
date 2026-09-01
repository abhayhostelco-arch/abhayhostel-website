import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile, ScoreSettings } from "@/lib/types";
import { ThemeProvider } from "@/components/theme-provider";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  requireProfile: vi.fn(),
  getProfiles: vi.fn(),
  getScoreSettings: vi.fn(),
  getEntries: vi.fn(),
  insertAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentProfile: mocks.getCurrentProfile, requireProfile: mocks.requireProfile }));
vi.mock("@/lib/data", () => ({
  getProfiles: mocks.getProfiles,
  getScoreSettings: mocks.getScoreSettings,
  getEntries: mocks.getEntries,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: mocks.insertAudit }) }),
}));

import { GET } from "@/app/api/reports/export/route";
import ReportsPage from "@/app/admin/reports/page";

const owner = { id: "00000000-0000-4000-8000-000000000010", role: "super_admin", full_name: "Owner" } as Profile;
const abhay = {
  id: "00000000-0000-4000-8000-000000000011", role: "student", full_name: "Abhay Student",
  email: "abhay@example.com", student_group: "abhay_hostel", joined_on: "2026-01-01", is_active: true,
} as Profile;
const krishna = {
  id: "00000000-0000-4000-8000-000000000012", role: "student", full_name: "Krishna Student",
  email: "krishna@example.com", student_group: "krishna_home", joined_on: "2026-01-01", is_active: true,
} as Profile;
const settings = {
  score_start_date: "2026-01-01", chanting_target_rounds: 16, evening_reading_target_minutes: 30,
  study_target_minutes: 240, wake_target_time: "06:00:00", bedtime_target_time: "22:30:00",
  seva_target_minutes: 60, discipline_grace_minutes: 120, sadhana_weight: 40, study_weight: 25,
  discipline_weight: 20, seva_weight: 15,
} as ScoreSettings;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentProfile.mockResolvedValue(owner);
  mocks.requireProfile.mockResolvedValue(owner);
  mocks.getProfiles.mockResolvedValue([abhay, krishna]);
  mocks.getScoreSettings.mockResolvedValue(settings);
  mocks.getEntries.mockResolvedValue([]);
  mocks.insertAudit.mockResolvedValue({ error: null });
});

describe("report group filtering", () => {
  it("exports only the canonical requested group cohort", async () => {
    const response = await GET(new Request("https://portal.example/api/reports/export?range=7&group=krishna_home"));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain("Krishna Student");
    expect(csv).not.toContain("Abhay Student");
    expect(mocks.getEntries).toHaveBeenCalledWith(expect.objectContaining({ studentIds: [krishna.id] }));
  });

  it("renders the selected group in the report controls and export URL", async () => {
    const page = await ReportsPage({ searchParams: Promise.resolve({ range: "7", group: "krishna_home" }) });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain('name="group"');
    expect(html).toContain('value="krishna_home" selected=""');
    expect(html).toContain('/api/reports/export?range=7&amp;group=krishna_home');
    expect(html).toContain("Krishna Student");
    expect(html).not.toContain("Abhay Student");
  });

  it("renders separate group report leaderboards with no combined position", async () => {
    const page = await ReportsPage({ searchParams: Promise.resolve({ range: "7" }) });
    const html = renderToStaticMarkup(<ThemeProvider>{page}</ThemeProvider>);

    expect(html).toContain("<h3>Abhay Hostel</h3>");
    expect(html).toContain("<h3>Krishna Home</h3>");
    expect(html.match(/<strong>#1<\/strong>/g)).toHaveLength(2);
  });
});
