import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202608300003_student_groups_scoring_payments.sql", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim();

describe("student groups, payments, and notifications migration safety", () => {
  it("backfills every existing student without filtering inactive rows", () => {
    expect(normalized).toContain(
      "update public.profiles set student_group = 'abhay_hostel' where role = 'student';",
    );
    const backfill = normalized.match(
      /update public\.profiles set student_group = 'abhay_hostel' where ([^;]+);/,
    )?.[1];
    expect(backfill).toBe("role = 'student'");
  });

  it("versions historical decisions before notification storage exists", () => {
    const backfillIndex = normalized.indexOf(
      "update public.leave_requests set decision_version = 1 where status in ('approved', 'rejected');",
    );
    const deliveryTableIndex = normalized.indexOf(
      "create table public.leave_notification_deliveries",
    );

    expect(backfillIndex).toBeGreaterThan(-1);
    expect(deliveryTableIndex).toBeGreaterThan(backfillIndex);
    expect(normalized.slice(backfillIndex, deliveryTableIndex)).not.toContain(
      "insert into public.leave_notification_deliveries",
    );
  });

  it("retains notification history when a leave request deletion is attempted", () => {
    expect(normalized).toContain(
      "foreign key (leave_request_id) references public.leave_requests(id) on delete restrict",
    );
    expect(normalized).not.toContain(
      "foreign key (leave_request_id) references public.leave_requests(id) on delete cascade",
    );
  });

  it("records and enforces all required row-count preservation guards", () => {
    const snapshotIndex = normalized.indexOf(
      "create temporary table student_scoring_migration_counts on commit drop as",
    );
    const schemaChangeIndex = normalized.indexOf("create type public.student_group");
    const guardIndex = normalized.indexOf("select * into before_counts from student_scoring_migration_counts;");

    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeLessThan(schemaChangeIndex);
    expect(guardIndex).toBeGreaterThan(schemaChangeIndex);
    for (const message of [
      "student row count decreased during migration",
      "daily-entry row count decreased during migration",
      "leave row count decreased during migration",
      "attendance row count decreased during migration",
      "audit row count decreased during migration",
    ]) {
      expect(normalized).toContain(message);
    }
  });

  it("contains no row-deletion or destructive schema operation", () => {
    expect(normalized).not.toMatch(/\bdelete from\b/);
    expect(normalized).not.toMatch(/\btruncate\b/);
    expect(normalized).not.toMatch(/\bdrop table\b/);
    expect(normalized).not.toMatch(/\bdrop column\b/);
  });

  it("revokes direct service-role mutations on RPC-owned tables", () => {
    expect(normalized).toContain(
      "revoke insert, update, delete on table public.payment_settings, public.student_payments, public.leave_notification_deliveries from service_role;",
    );
    expect(normalized).toContain(
      "grant select on table public.payment_settings, public.student_payments, public.leave_notification_deliveries to service_role;",
    );
    expect(normalized).toContain(
      "revoke update on table public.profiles from service_role;",
    );
    expect(normalized).toContain(
      "grant update ( role, full_name, email, phone, academy_label, joined_on, is_active, must_change_password, created_by, mentor_id, birth_date, avatar_path, deletion_pending_at ) on table public.profiles to service_role;",
    );
  });
});
