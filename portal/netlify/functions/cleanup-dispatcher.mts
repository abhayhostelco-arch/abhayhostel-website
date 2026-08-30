import { createClient } from "@supabase/supabase-js";

const handler = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CLEANUP_WORKER_SECRET;
  if (!url || !key || !appUrl || !secret) throw new Error("Cleanup dispatcher configuration is missing.");
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("cleanup_dispatch_due_runs");
  if (error) throw new Error("Unable to read due cleanup runs.");
  await Promise.allSettled(((data ?? []) as string[]).map((runId) => fetch(new URL("/.netlify/functions/cleanup-worker", appUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-cleanup-worker-secret": secret },
    body: JSON.stringify({ runId }),
  })));
};
export default handler;
export const config = { schedule: "@hourly" };
