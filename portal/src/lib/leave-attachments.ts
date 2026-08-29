export async function removeLeaveAttachment({
  path,
  removeObject,
  clearPath,
}: {
  path: string | null;
  removeObject: (path: string) => Promise<boolean>;
  clearPath: () => Promise<boolean>;
}): Promise<boolean> {
  if (!path) return true;
  if (!await removeObject(path)) return false;
  return clearPath();
}
