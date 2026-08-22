import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { daysAgoInIndia } from "@/lib/date";
import { getEntries, getProfiles, getScoreSettings } from "@/lib/data";
import { buildReportRows } from "@/lib/report-export";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const parsed = reportQuerySchema.safeParse({ range: url.searchParams.get("range") ?? "30", studentId: url.searchParams.get("studentId") || undefined });
  if (!parsed.success) return NextResponse.json({ error: "Invalid report request" }, { status: 400 });
  const range = Number(parsed.data.range);
  const [entries, allStudents, settings] = await Promise.all([getEntries({ startDate: daysAgoInIndia(range - 1), studentId: parsed.data.studentId }), getProfiles("student"), getScoreSettings()]);
  const students = allStudents.filter((student) => student.is_active && (!parsed.data.studentId || student.id === parsed.data.studentId));
  const rows = buildReportRows(entries, students, settings, range);
  await createAdminClient().from("audit_events").insert({ actor_id: profile.id, action: "report_exported", target_id: parsed.data.studentId ?? null, metadata: { range_days: String(range), row_count: String(entries.length) } });
  return new NextResponse(toCsv(rows), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="abhay-hostel-report-${range}d.csv"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
