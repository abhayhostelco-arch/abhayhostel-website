import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userEntryGte: vi.fn(), leaderboardEntryGte: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({
      gte: (column: string, value: string) => {
        mocks.userEntryGte(column, value);
        const query = {
          order: () => query,
          limit: () => query,
          eq: () => query,
          in: () => query,
          then: (resolve: (value: { data: never[]; error: null }) => void) => resolve({ data: [], error: null }),
        };
        return query;
      },
    }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => table === "profiles"
      ? { select: () => { const query = { eq: () => query, order: () => query, limit: async () => ({ data: [{ id: "student-a" }], error: null }) }; return query; } }
      : { select: () => { const query = { in: () => query, gte: (column: string, value: string) => { mocks.leaderboardEntryGte(column, value); return query; }, order: () => query, limit: async () => ({ data: [], error: null }) }; return query; } },
  }),
}));

import { getEntries, getStudentLeaderboardSource } from "@/lib/data";

describe("Growth Score entry queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the Monday start of an intersecting week for scoped reports", async () => {
    await getEntries({ startDate: "2026-08-19", studentIds: ["student-a"], completeScoringWeeks: true });

    expect(mocks.userEntryGte).toHaveBeenCalledWith("entry_date", "2026-08-17");
  });

  it("fetches the Monday start of an intersecting week for leaderboard reports", async () => {
    await getStudentLeaderboardSource("2026-08-19");

    expect(mocks.leaderboardEntryGte).toHaveBeenCalledWith("entry_date", "2026-08-17");
  });
});
