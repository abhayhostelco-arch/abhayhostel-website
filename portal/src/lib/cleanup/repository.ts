import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimedWork, CleanupRunView, CleanupSettingsView, CleanupWorkerDependencies, ManagedBucket, ObjectTask, RemoveResult } from "./types";

type RpcClient = SupabaseClient;

function assertNoError(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export function createCleanupRepository(client: RpcClient = createAdminClient()): CleanupWorkerDependencies {
  return {
    async claimLease(runId, workerId) {
      const { data, error } = await client.rpc("cleanup_claim_lease", { p_run_uuid: runId, p_worker_uuid: workerId });
      assertNoError(error, "Unable to claim cleanup work.");
      if (!data) return null;
      const value = data as Record<string, unknown>;
      return { runId: String(value.run_id), workerId: String(value.worker_id), generation: Number(value.generation), leaseExpiresAt: String(value.lease_expires_at) };
    },
    async releaseLease(claim) {
      const { error } = await client.rpc("cleanup_release_lease", { p_run_uuid: claim.runId, p_worker_uuid: claim.workerId, p_generation: claim.generation });
      assertNoError(error, "Unable to release cleanup work.");
    },
    async processDatabaseBatch(claim, limit) {
      const { data, error } = await client.rpc("cleanup_process_database_batch", { p_run_uuid: claim.runId, p_worker_uuid: claim.workerId, p_generation: claim.generation, p_limit: limit });
      assertNoError(error, "Unable to process cleanup data.");
      return { remaining: Boolean((data as Record<string, unknown>)?.remaining) };
    },
    async claimObjectBatch(claim, limit) {
      const { data, error } = await client.rpc("cleanup_claim_object_batch", { p_run_uuid: claim.runId, p_worker_uuid: claim.workerId, p_generation: claim.generation, p_limit: limit });
      assertNoError(error, "Unable to claim cleanup files.");
      return ((data ?? []) as Array<Record<string, unknown>>).map((task) => ({
        id: String(task.id), bucket: String(task.bucket_id) as ManagedBucket, path: String(task.object_name),
        objectId: task.object_id ? String(task.object_id) : null, observedVersion: task.observed_version ? String(task.observed_version) : null,
        attemptCount: Number(task.attempt_count),
      }));
    },
    async completeObjectTasks(claim, results) {
      const { data, error } = await client.rpc("cleanup_complete_object_tasks", { p_run_uuid: claim.runId, p_worker_uuid: claim.workerId, p_generation: claim.generation, p_results: results.map((result) => ({ task_id: result.taskId, outcome: result.outcome, error_class: result.errorClass })) });
      assertNoError(error, "Unable to record cleanup file results.");
      return { remaining: Boolean((data as Record<string, unknown>)?.remaining) };
    },
    async removeObjects(bucket, tasks, timeoutMs) {
      // Never delete a path whose preview did not capture immutable storage
      // identity/version metadata. Such tasks are deliberately surfaced as
      // partial work for a fresh, safer preview instead of risking a replaced
      // or newly referenced object.
      const unsafe = tasks.filter((task) => !task.objectId || !task.observedVersion);
      const safe = tasks.filter((task) => task.objectId && task.observedVersion);
      if (!safe.length) return unsafe.map((task) => ({ taskId: task.id, outcome: "permanent_failure" as const, errorClass: "missing_object_identity" }));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { error } = await client.storage.from(bucket).remove(safe.map((task) => task.path));
        const safeResults = !error ? safe.map((task) => ({ taskId: task.id, outcome: "deleted" as const })) : safe.map((task) => ({ taskId: task.id, outcome: task.attemptCount >= 5 ? "permanent_failure" as const : "retryable" as const, errorClass: "storage_error" }));
        return [...unsafe.map((task) => ({ taskId: task.id, outcome: "permanent_failure" as const, errorClass: "missing_object_identity" })), ...safeResults];
      } catch {
        return [...unsafe.map((task) => ({ taskId: task.id, outcome: "permanent_failure" as const, errorClass: "missing_object_identity" })), ...safe.map((task) => ({ taskId: task.id, outcome: task.attemptCount >= 5 ? "permanent_failure" as const : "retryable" as const, errorClass: "storage_timeout" }))];
      } finally {
        clearTimeout(timer);
      }
    },
    async finalizeRun(claim, status) {
      const { error } = await client.rpc("cleanup_finalize_run", { p_run_uuid: claim.runId, p_worker_uuid: claim.workerId, p_generation: claim.generation, p_final_status: status, p_summary_jsonb: { status } });
      assertNoError(error, "Unable to finish cleanup run.");
      return status;
    },
  };
}

export async function loadCleanupAdminData(): Promise<{ available: boolean; settings: CleanupSettingsView | null; runs: CleanupRunView[] }> {
  const client = createAdminClient();
  const { data: rawSettings, error } = await client.rpc("cleanup_get_settings");
  if (error) throw error;
  const value = rawSettings as Record<string, unknown>;
  const { data: rawRuns, error: runsError } = await client.from("cleanup_runs").select("id,mode,status,cutoff_date,categories,preview_impact,summary,error_summary,created_at").order("created_at", { ascending: false }).limit(8);
  if (runsError) throw runsError;
  return {
    available: true,
    settings: {
      automaticEnabled: Boolean(value.automatic_enabled),
      lastRun: value.last_automatic_run_id ? {
        id: String(value.last_automatic_run_id), status: value.last_automatic_status as CleanupSettingsView["lastRun"] extends infer T ? T extends { status: infer S } ? S : never : never,
        startedAt: value.last_automatic_started_at ? String(value.last_automatic_started_at) : null,
        finishedAt: value.last_automatic_finished_at ? String(value.last_automatic_finished_at) : null,
        summary: (value.last_automatic_summary ?? {}) as Record<string, unknown>,
      } : null,
    },
    runs: ((rawRuns ?? []) as Array<Record<string, unknown>>).map((run) => ({
      id: String(run.id), mode: run.mode as CleanupRunView["mode"], status: run.status as CleanupRunView["status"],
      cutoffDate: run.cutoff_date ? String(run.cutoff_date) : null, categories: (run.categories ?? []) as string[],
      previewImpact: run.preview_impact as Record<string, unknown> | null, summary: (run.summary ?? {}) as Record<string, unknown>,
      errorSummary: run.error_summary ? String(run.error_summary) : null, createdAt: String(run.created_at),
    })),
  };
}

export type { ClaimedWork, ObjectTask, RemoveResult };
