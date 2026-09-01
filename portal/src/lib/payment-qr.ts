type StorageResult = { error: unknown | null };

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export async function isPaymentQrImage(file: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (file.type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.type === "image/webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  return false;
}

export async function replacePaymentQr({
  oldPath,
  newPath,
  file,
  upload,
  remove,
  updateSettings,
}: {
  oldPath: string | null;
  newPath: string;
  file: Blob;
  upload: (path: string, file: Blob, options: { contentType: string; upsert: false }) => Promise<StorageResult>;
  remove: (paths: string[]) => Promise<StorageResult>;
  updateSettings: () => PromiseLike<StorageResult>;
}): Promise<{ ok: boolean }> {
  const uploaded = await upload(newPath, file, { contentType: file.type, upsert: false });
  if (uploaded.error) return { ok: false };

  const settings = await updateSettings();
  if (settings.error) {
    await remove([newPath]);
    return { ok: false };
  }

  if (oldPath && oldPath !== newPath) await remove([oldPath]);
  return { ok: true };
}
