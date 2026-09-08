import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../supabase/migrations/202609070001_daily_entry_reliability.sql", import.meta.url);

function migration() {
  return readFileSync(migrationUrl, "utf8").replace(/\s+/g, " ").trim();
}

describe("daily-entry reliability migration", () => {
  it("retains daily entries while purging only evidence older than seven India-date days", () => {
    const sql = migration();
    expect(sql).toContain("add column if not exists maha_mantra_purged_at timestamptz");
    expect(sql).toContain("d.entry_date < india_date - 7");
    expect(sql).toContain("set maha_mantra_path = null, maha_mantra_purged_at = now()");
    expect(sql).not.toContain("delete from public.daily_entries");
  });

  it("clears a retained path only for confirmed deleted or missing objects and preserves retryable paths", () => {
    const sql = migration();
    expect(sql).toContain("outcome in ('deleted', 'missing')");
    expect(sql).toContain("and d.maha_mantra_path = task_row.object_name");
    expect(sql).toContain("outcome in ('retryable', 'permanent_failure')");
  });

  it("enqueues evidence retention from the hourly cleanup dispatcher", () => {
    const sql = migration();
    expect(sql).toContain("perform public.cleanup_enqueue_maha_mantra_retention();");
    expect(sql).toContain("grant execute on function public.cleanup_enqueue_maha_mantra_retention() to service_role;");
  });

  it("moves non-conflicting student-owned rows and preserves conflicting rows", () => {
    const sql = migration();
    expect(sql).toContain("array['subhash kumar saw', 'subhash mahto']");
    expect(sql).toContain("create table if not exists private.migration_202609070001_conflicts");
    expect(sql).not.toContain("duplicate profile consolidation would collide");
    expect(sql).toContain("update public.gita_class_attendance old_row set student_id = canonical_id");
    expect(sql).toContain("update public.weekly_program_entries old_row set student_id = canonical_id");
    expect(sql).toContain("update public.student_payments old_row set student_id = canonical_id");
    expect(sql).toContain("update public.attendance_people old_row set profile_id = canonical_id");
    expect(sql).toContain("update public.leave_requests old_row set student_id = canonical_id");
    expect(sql).toContain("insert into private.migration_202609070001_conflicts");
    expect(sql).not.toContain("update public.cleanup_runs set target_student_id = canonical_id");
    expect(sql).toContain("set status = 'cancelled', finished_at = coalesce(finished_at, now())");
    expect(sql).toContain("update public.profiles set is_active = false where id = duplicate_id;");
    expect(sql).toContain("alter table public.gita_class_attendance disable trigger gita_attendance_validate;");
    expect(sql).toContain("alter table public.gita_class_attendance enable trigger gita_attendance_validate;");
  });

  it("aborts instead of allowing any affected database table to lose rows", () => {
    const sql = migration();
    expect(sql).toContain("row_counts_before jsonb := jsonb_build_object(");
    expect(sql).toContain("if row_counts_before is distinct from jsonb_build_object(");
    expect(sql).toContain("raise exception 'daily-entry reliability migration changed protected row counts'");
    expect(sql).not.toMatch(/\b(?:delete\s+from|truncate|drop\s+table|drop\s+column)\b/i);
  });

  it("keeps a protected pre-migration snapshot of every table whose ownership is rewritten", () => {
    const sql = migration();
    for (const table of [
      "profiles", "daily_entries", "gita_class_attendance", "weekly_program_entries",
      "leave_requests", "student_payments", "leave_notification_deliveries",
      "attendance_people", "cleanup_runs", "audit_events",
    ]) {
      expect(sql).toContain(`create table if not exists private.migration_202609070001_${table}_backup as table public.${table};`);
      expect(sql).toContain(`alter table private.migration_202609070001_${table}_backup enable row level security;`);
      expect(sql).toContain(`alter table private.migration_202609070001_${table}_backup force row level security;`);
      expect(sql).toContain(`revoke all on table private.migration_202609070001_${table}_backup from public, anon, authenticated;`);
    }
  });

  it("prevents concurrent writes while snapshots and ownership updates are performed", () => {
    const sql = migration();
    expect(sql).toContain("lock table public.profiles, public.daily_entries, public.gita_class_attendance, public.weekly_program_entries, public.leave_requests, public.student_payments, public.leave_notification_deliveries, public.attendance_people, public.cleanup_runs, public.audit_events in share row exclusive mode;");
  });

  it("allows retention metadata to be updated on entries older than the normal editing window", () => {
    const sql = migration();
    expect(sql).toContain("create or replace function private.validate_daily_entry()");
    expect(sql).toContain("current_setting('app.daily_entry_maintenance', true) is distinct from 'purge'");
    expect(sql).toContain("set_config('app.daily_entry_maintenance', 'purge', true)");
  });
});
