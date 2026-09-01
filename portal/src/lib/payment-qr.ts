type StorageResult = { error: unknown | null };

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
