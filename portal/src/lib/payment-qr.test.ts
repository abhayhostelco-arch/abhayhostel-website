import { describe, expect, it, vi } from "vitest";

async function loadQr() {
  try {
    const modulePath = "@/lib/payment-qr";
    return await import(/* @vite-ignore */ modulePath) as typeof import("@/lib/payment-qr");
  } catch {
    return null;
  }
}

describe("payment QR replacement", () => {
  it("rejects a payload that claims to be an image but has no matching signature", async () => {
    const qr = await loadQr();
    expect(qr).not.toBeNull();
    if (!qr) return;
    expect(typeof qr.isPaymentQrImage).toBe("function");
    if (typeof qr.isPaymentQrImage !== "function") return;

    await expect(qr.isPaymentQrImage(new Blob(["not an image"], { type: "image/png" }))).resolves.toBe(false);
  });

  it("accepts JPEG, PNG, and WebP payloads with matching image signatures", async () => {
    const qr = await loadQr();
    expect(qr).not.toBeNull();
    if (!qr) return;
    expect(typeof qr.isPaymentQrImage).toBe("function");
    if (typeof qr.isPaymentQrImage !== "function") return;

    await expect(Promise.all([
      qr.isPaymentQrImage(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" })),
      qr.isPaymentQrImage(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" })),
      qr.isPaymentQrImage(new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], { type: "image/webp" })),
    ])).resolves.toEqual([true, true, true]);
  });

  it("removes the new object when the audited settings update fails", async () => {
    const qr = await loadQr();
    expect(qr).not.toBeNull();
    if (!qr) return;

    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const updateSettings = vi.fn().mockResolvedValue({ error: { message: "RPC failed" } });
    const result = await qr.replacePaymentQr({
      oldPath: "settings/old.png", newPath: "settings/new.png", file: new Blob(["qr"], { type: "image/png" }),
      upload, remove, updateSettings,
    });

    expect(result).toEqual({ ok: false });
    expect(upload).toHaveBeenCalledWith("settings/new.png", expect.any(Blob), { contentType: "image/png", upsert: false });
    expect(remove).toHaveBeenCalledWith(["settings/new.png"]);
  });

  it("updates settings before removing the prior QR object", async () => {
    const qr = await loadQr();
    expect(qr).not.toBeNull();
    if (!qr) return;

    const calls: string[] = [];
    const result = await qr.replacePaymentQr({
      oldPath: "settings/old.png", newPath: "settings/new.webp", file: new Blob(["qr"], { type: "image/webp" }),
      upload: async () => { calls.push("upload"); return { error: null }; },
      updateSettings: async () => { calls.push("settings"); return { error: null }; },
      remove: async () => { calls.push("remove"); return { error: null }; },
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["upload", "settings", "remove"]);
  });

  it("retries a failed previous-QR deletion a bounded number of times and logs the unresolved object", async () => {
    const qr = await loadQr();
    expect(qr).not.toBeNull();
    if (!qr) return;

    const remove = vi.fn().mockResolvedValue({ error: { message: "storage unavailable" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await qr.replacePaymentQr({
      oldPath: "settings/old.png", newPath: "settings/new.png", file: new Blob(["qr"], { type: "image/png" }),
      upload: vi.fn().mockResolvedValue({ error: null }), remove, updateSettings: vi.fn().mockResolvedValue({ error: null }),
    });

    expect(result).toEqual({ ok: true, previousQrCleanupFailed: true });
    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenNthCalledWith(1, ["settings/old.png"]);
    expect(error).toHaveBeenCalledWith("Previous payment QR cleanup failed after 3 attempts.", expect.objectContaining({ path: "settings/old.png" }));
  });
});
