import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireProfile: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ update: mocks.update }) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));

import { updateScoreSettingsAction } from "@/app/actions/settings";

describe("fixed Growth Score settings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue({ id: "admin-a", role: "super_admin", is_active: true });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("updates only the operational launch date even when legacy formula fields are submitted", async () => {
    const formData = new FormData();
    formData.set("scoreStartDate", "2026-09-01");
    formData.set("sadhanaWeight", "100");
    formData.set("studyWeight", "0");
    formData.set("disciplineWeight", "0");
    formData.set("sevaWeight", "0");
    formData.set("chantingTargetRounds", "108");
    formData.set("eveningReadingTargetMinutes", "360");
    formData.set("studyTargetMinutes", "1080");
    formData.set("wakeTargetTime", "12:00");
    formData.set("bedtimeTargetTime", "12:00");
    formData.set("sevaTargetMinutes", "720");
    formData.set("disciplineGraceMinutes", "360");

    const result = await updateScoreSettingsAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Scoring launch date updated." });
    expect(mocks.update).toHaveBeenCalledWith({ score_start_date: "2026-09-01", updated_by: "admin-a" });
  });
});
