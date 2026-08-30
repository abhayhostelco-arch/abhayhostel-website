import { getCleanupWorkerEnv, getServerEnv } from "@/lib/env";

export async function invokeCleanupWorker(runId: string): Promise<boolean> {
  const { NEXT_PUBLIC_APP_URL } = getServerEnv();
  const { CLEANUP_WORKER_SECRET } = getCleanupWorkerEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(new URL("/.netlify/functions/cleanup-worker", NEXT_PUBLIC_APP_URL), {
      method: "POST",
      headers: { "content-type": "application/json", "x-cleanup-worker-secret": CLEANUP_WORKER_SECRET },
      body: JSON.stringify({ runId }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
