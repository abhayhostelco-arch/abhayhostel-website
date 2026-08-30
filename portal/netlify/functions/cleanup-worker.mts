import { createClient } from "@supabase/supabase-js";
import { createCleanupRepository } from "../../src/lib/cleanup/repository";
import { processCleanupRun, verifyWorkerSecret } from "../../src/lib/cleanup/worker";

const handler = async (request: Request) => {
  const secret = process.env.CLEANUP_WORKER_SECRET ?? "";
  if (!verifyWorkerSecret(request.headers.get("x-cleanup-worker-secret"), secret)) return;
  let body: { runId?: string };
  try { body = await request.json() as { runId?: string }; } catch { return; }
  if (!body.runId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.runId)) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Cleanup worker Supabase configuration is missing.");
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  await processCleanupRun(body.runId, createCleanupRepository(admin));
};
export default handler;
export const config = { background: true } as const;
