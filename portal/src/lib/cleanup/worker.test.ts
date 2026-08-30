import { describe, expect, it, vi } from "vitest";
import { processCleanupRun, verifyWorkerSecret } from "./worker";
import type { CleanupWorkerDependencies } from "./types";

const claim = {
  runId: "11111111-1111-4111-8111-111111111111",
  workerId: "22222222-2222-4222-8222-222222222222",
  generation: 1,
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function dependencies(overrides: Partial<CleanupWorkerDependencies> = {}): CleanupWorkerDependencies {
  return {
    claimLease: vi.fn().mockResolvedValue(claim),
    releaseLease: vi.fn().mockResolvedValue(undefined),
    processDatabaseBatch: vi.fn().mockResolvedValue({ remaining: false }),
    claimObjectBatch: vi.fn().mockResolvedValue([]),
    completeObjectTasks: vi.fn().mockResolvedValue({ remaining: false }),
    removeObjects: vi.fn().mockResolvedValue([]),
    finalizeRun: vi.fn().mockResolvedValue("completed"),
    ...overrides,
  };
}

describe("cleanup worker", () => {
  it("uses constant-time validation for sufficiently long secrets", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    expect(verifyWorkerSecret(secret, secret)).toBe(true);
    expect(verifyWorkerSecret(`${secret}x`, secret)).toBe(false);
    expect(verifyWorkerSecret("short", secret)).toBe(false);
    expect(verifyWorkerSecret(null, secret)).toBe(false);
  });

  it("returns busy without processing when another run owns the lease", async () => {
    const deps = dependencies({ claimLease: vi.fn().mockResolvedValue(null) });
    await expect(processCleanupRun(claim.runId, deps)).resolves.toEqual({ status: "busy" });
    expect(deps.processDatabaseBatch).not.toHaveBeenCalled();
  });

  it("processes database and storage work and always releases the lease", async () => {
    const tasks = [{
      id: "33333333-3333-4333-8333-333333333333",
      bucket: "maha-mantra-evidence" as const,
      path: "student/evidence.jpg",
      objectId: null,
      observedVersion: null,
      attemptCount: 1,
    }];
    const deps = dependencies({
      claimObjectBatch: vi.fn().mockResolvedValueOnce(tasks).mockResolvedValueOnce([]),
      removeObjects: vi.fn().mockResolvedValue([{ taskId: tasks[0].id, outcome: "deleted" }]),
    });

    await expect(processCleanupRun(claim.runId, deps)).resolves.toEqual({ status: "completed" });
    expect(deps.removeObjects).toHaveBeenCalledWith("maha-mantra-evidence", tasks, 8_000);
    expect(deps.completeObjectTasks).toHaveBeenCalled();
    expect(deps.releaseLease).toHaveBeenCalledWith(claim);
  });

  it("finalizes partial when an object reaches permanent failure", async () => {
    const task = {
      id: "33333333-3333-4333-8333-333333333333",
      bucket: "leave-applications" as const,
      path: "student/leave.pdf",
      objectId: null,
      observedVersion: null,
      attemptCount: 5,
    };
    const finalizeRun = vi.fn().mockResolvedValue("partial");
    const deps = dependencies({
      claimObjectBatch: vi.fn().mockResolvedValueOnce([task]).mockResolvedValueOnce([]),
      removeObjects: vi.fn().mockResolvedValue([{ taskId: task.id, outcome: "permanent_failure", errorClass: "storage_error" }]),
      finalizeRun,
    });

    await expect(processCleanupRun(claim.runId, deps)).resolves.toEqual({ status: "partial" });
    expect(finalizeRun).toHaveBeenCalledWith(claim, "partial");
  });
});
