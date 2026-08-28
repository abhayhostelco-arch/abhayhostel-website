type DatabaseError = { code?: string; message?: string; details?: string } | null | undefined;

export function isMissingSchemaError(error: DatabaseError): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42P01"
    || error.code === "42703"
    || error.code === "PGRST204"
    || error.code === "PGRST205"
    || text.includes("schema cache")
    || text.includes("does not exist");
}

export function isMissingAvatarBucketError(error: DatabaseError): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "404" || text.includes("bucket not found") || text.includes("not found");
}
