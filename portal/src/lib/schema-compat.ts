type DatabaseError = { code?: string; message?: string; details?: string } | null | undefined;
const cleanupRpcNames = [
  "cleanup_update_auto", "cleanup_preview_history", "cleanup_confirm_preview", "cleanup_resume_run",
  "cleanup_enqueue_auto", "cleanup_dispatch_due_runs", "cleanup_claim_lease", "cleanup_release_lease",
  "cleanup_process_database_batch", "cleanup_claim_object_batch", "cleanup_complete_object_tasks",
  "cleanup_finalize_run", "cleanup_get_settings",
];

function isKnownMissingRpc(error: Exclude<DatabaseError, null | undefined>, names: readonly string[]): boolean {
  if (error.code !== "PGRST202") return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return names.some((name) => text.includes(name.toLowerCase()));
}

export function isMissingSchemaError(error: DatabaseError, rpcNames: readonly string[] = []): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return isKnownMissingRpc(error, rpcNames);
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42P01"
    || error.code === "42703"
    || error.code === "PGRST204"
    || error.code === "PGRST205"
    || text.includes("schema cache")
    || text.includes("does not exist");
}

export function isMissingCleanupSchemaError(error: DatabaseError): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return isKnownMissingRpc(error, cleanupRpcNames);
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42P01"
    || error.code === "42703"
    || text.includes("cleanup_") && text.includes("does not exist")
    || text.includes("deletion_pending_at") && text.includes("does not exist");
}

export function isMissingAvatarBucketError(error: DatabaseError): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "404" || text.includes("bucket not found") || text.includes("not found");
}
