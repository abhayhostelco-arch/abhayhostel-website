import { describe, expect, it, vi } from "vitest";

async function loadCleanup() {
  try {
    const helperPath = "@/lib/leave-attachments";
    return await import(/* @vite-ignore */ helperPath) as typeof import("@/lib/leave-attachments");
  } catch {
    return null;
  }
}

describe("leave attachment cleanup", () => {
  it("clears the database path only after Storage deletes the object", async () => {
    const cleanupModule = await loadCleanup();
    expect(cleanupModule).not.toBeNull();
    if (!cleanupModule) return;
    const removeObject = vi.fn().mockResolvedValue(true);
    const clearPath = vi.fn().mockResolvedValue(true);

    const cleaned = await cleanupModule.removeLeaveAttachment({ path: "student/request/application.jpg", removeObject, clearPath });

    expect(cleaned).toBe(true);
    expect(removeObject).toHaveBeenCalledWith("student/request/application.jpg");
    expect(clearPath).toHaveBeenCalledOnce();
  });

  it("retains the database path when Storage deletion fails", async () => {
    const cleanupModule = await loadCleanup();
    expect(cleanupModule).not.toBeNull();
    if (!cleanupModule) return;
    const clearPath = vi.fn().mockResolvedValue(true);

    const cleaned = await cleanupModule.removeLeaveAttachment({ path: "student/request/application.jpg", removeObject: async () => false, clearPath });

    expect(cleaned).toBe(false);
    expect(clearPath).not.toHaveBeenCalled();
  });
});
