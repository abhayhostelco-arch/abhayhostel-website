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

describe("configurable Growth Score settings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireProfile.mockResolvedValue({ id: "admin-a", role: "super_admin", is_active: true });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("updates the rubric and operational launch date", async () => {
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

    expect(result).toEqual({ status: "success", message: "Growth Score settings updated." });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      sadhana_weight: 100, study_weight: 0, discipline_weight: 0, seva_weight: 0,
      chanting_target_rounds: 108, evening_reading_target_minutes: 360, study_target_minutes: 1080,
      wake_target_time: "12:00", bedtime_target_time: "12:00", seva_target_minutes: 720,
      discipline_grace_minutes: 360, score_start_date: "2026-09-01", updated_by: "admin-a",
    }));
  });
});
