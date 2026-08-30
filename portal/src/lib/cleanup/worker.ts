import { randomUUID, timingSafeEqual } from "node:crypto";
import type { CleanupWorkerDependencies, ManagedBucket, ObjectTask, RemoveResult } from "./types";

const DATABASE_BATCH_SIZE = 100;
const OBJECT_BATCH_SIZE = 500;
const STORAGE_TIMEOUT_MS = 8_000;
const MAX_BATCHES_PER_INVOCATION = 20;

export function verifyWorkerSecret(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (expectedBytes.byteLength < 32 || suppliedBytes.byteLength !== expectedBytes.byteLength) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

function groupTasks(tasks: ObjectTask[]): Map<ManagedBucket, ObjectTask[]> {
  const groups = new Map<ManagedBucket, ObjectTask[]>();
  for (const task of tasks) groups.set(task.bucket, [...(groups.get(task.bucket) ?? []), task]);
  return groups;
}

export async function processCleanupRun(
  runId: string,
  dependencies: CleanupWorkerDependencies,
): Promise<{ status: "completed" | "partial" | "deferred" | "busy" }> {
  const workerId = randomUUID();
  const claim = await dependencies.claimLease(runId, workerId);
  if (!claim) return { status: "busy" };

  let partial = false;
  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_INVOCATION; batch += 1) {
      const result = await dependencies.processDatabaseBatch(claim, DATABASE_BATCH_SIZE);
      if (!result.remaining) break;
      if (batch === MAX_BATCHES_PER_INVOCATION - 1) return { status: "deferred" };
    }

    for (let batch = 0; batch < MAX_BATCHES_PER_INVOCATION; batch += 1) {
      const tasks = await dependencies.claimObjectBatch(claim, OBJECT_BATCH_SIZE);
      if (!tasks.length) break;
      const results: RemoveResult[] = [];
      for (const [bucket, bucketTasks] of groupTasks(tasks)) {
        const bucketResults = await dependencies.removeObjects(bucket, bucketTasks, STORAGE_TIMEOUT_MS);
        results.push(...bucketResults.map((result) => result.outcome === "retryable" && (bucketTasks.find((task) => task.id === result.taskId)?.attemptCount ?? 0) >= 5
          ? { ...result, outcome: "permanent_failure" as const }
          : result));
      }
      if (results.some((result) => result.outcome === "permanent_failure")) partial = true;
      const completion = await dependencies.completeObjectTasks(claim, results);
      if (!completion.remaining) break;
      if (batch === MAX_BATCHES_PER_INVOCATION - 1) return { status: "deferred" };
    }

    const status = partial ? "partial" : "completed";
    await dependencies.finalizeRun(claim, status);
    return { status };
  } finally {
    await dependencies.releaseLease(claim);
  }
}
