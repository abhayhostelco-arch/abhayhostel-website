import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { invokeCleanupWorker } from "@/lib/cleanup/netlify";
import { isMissingCleanupSchemaError } from "@/lib/schema-compat";
import { createAdminClient } from "@/lib/supabase/admin";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (!origin || origin === new URL(request.url).origin) && (!fetchSite || fetchSite === "same-origin");
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getCurrentProfile();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: autoRunId, error: enqueueError }, { data: dueRunIds, error: dueError }] = await Promise.all([
    admin.rpc("cleanup_enqueue_auto", { p_actor_uuid: actor.id }),
    admin.rpc("cleanup_dispatch_due_runs"),
  ]);
  if (enqueueError || dueError) {
    if (isMissingCleanupSchemaError(enqueueError) || isMissingCleanupSchemaError(dueError)) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ error: "Cleanup dispatch is temporarily unavailable." }, { status: 503 });
  }
  const runIds = new Set<string>((dueRunIds ?? []) as string[]);
  if (typeof autoRunId === "string") runIds.add(autoRunId);
  if (!runIds.size) return new NextResponse(null, { status: 204 });
  await Promise.allSettled([...runIds].map((runId) => invokeCleanupWorker(runId)));
  return NextResponse.json({ accepted: runIds.size }, { status: 202 });
}
