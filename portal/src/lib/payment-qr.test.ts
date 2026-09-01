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
});
