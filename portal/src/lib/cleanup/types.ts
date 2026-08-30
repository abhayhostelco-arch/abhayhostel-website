export type CleanupStatus = "previewed" | "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type ManagedBucket = "student-avatars" | "maha-mantra-evidence" | "leave-applications";

export interface CleanupSettingsView {
  automaticEnabled: boolean;
  lastRun: {
    id: string | null;
    status: CleanupStatus | null;
    startedAt: string | null;
    finishedAt: string | null;
    summary: Record<string, unknown>;
  } | null;
}

export interface CleanupRunView {
  id: string;
  mode: "auto" | "manual" | "student_delete";
  status: CleanupStatus;
  cutoffDate: string | null;
  categories: string[];
  previewImpact: Record<string, unknown> | null;
  summary: Record<string, unknown>;
  errorSummary: string | null;
  createdAt: string;
}

export interface ClaimedWork {
  runId: string;
  workerId: string;
  generation: number;
  leaseExpiresAt: string;
}

export interface ObjectTask {
  id: string;
  bucket: ManagedBucket;
  path: string;
  objectId: string | null;
  observedVersion: string | null;
  attemptCount: number;
}

export interface RemoveResult {
  taskId: string;
  outcome: "deleted" | "missing" | "stale" | "retryable" | "permanent_failure";
  errorClass?: string;
}

export interface CleanupWorkerDependencies {
  claimLease(runId: string, workerId: string): Promise<ClaimedWork | null>;
  releaseLease(claim: ClaimedWork): Promise<void>;
  processDatabaseBatch(claim: ClaimedWork, limit: number): Promise<{ remaining: boolean }>;
  claimObjectBatch(claim: ClaimedWork, limit: number): Promise<ObjectTask[]>;
  completeObjectTasks(claim: ClaimedWork, results: RemoveResult[]): Promise<{ remaining: boolean }>;
  removeObjects(bucket: ManagedBucket, tasks: ObjectTask[], timeoutMs: number): Promise<RemoveResult[]>;
  finalizeRun(claim: ClaimedWork, status: "completed" | "partial"): Promise<"completed" | "partial">;
}
