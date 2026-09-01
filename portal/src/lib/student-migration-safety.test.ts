import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationDirectory = new URL("../../supabase/migrations/", import.meta.url);
const featureMigrations = readdirSync(migrationDirectory)
  .filter((filename) => filename >= "202608300003_student_groups_scoring_payments.sql" && filename.endsWith(".sql"))
  .map((filename) => ({
    filename,
    normalized: readFileSync(new URL(filename, migrationDirectory), "utf8").replace(/\s+/g, " ").trim(),
  }));
const normalized = featureMigrations.find(({ filename }) => filename === "202608300003_student_groups_scoring_payments.sql")!.normalized;
const leaveNotificationFixMigration = featureMigrations.find(({ filename }) => filename === "202609010001_leave_notification_delivery_fixes.sql")!.normalized;

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

  it("permits only the required audit constraint replacement among feature-migration drops", () => {
    const destructiveStatements = featureMigrations.flatMap(({ filename, normalized: sql }) =>
      [...sql.matchAll(/\b(?:delete from|truncate|drop table|drop column|drop constraint|drop policy|drop type|drop function)\b[^;]*;/g)]
        .map(([statement]) => ({ filename, statement })),
    );

    expect(destructiveStatements).toEqual([{
      filename: "202608300003_student_groups_scoring_payments.sql",
      statement: "drop constraint audit_events_action_check;",
    }]);
    expect(normalized).toContain(
      "alter table public.audit_events add constraint audit_events_action_check check",
    );
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

  it("enables forced SELECT-only RLS for all new application tables", () => {
    for (const table of ["payment_settings", "student_payments", "leave_notification_deliveries"]) {
      expect(normalized).toContain(`alter table public.${table} enable row level security;`);
      expect(normalized).toContain(`alter table public.${table} force row level security;`);
    }
    expect(normalized).toContain(
      "create policy payment_settings_select_active on public.payment_settings for select to authenticated using (private.current_user_is_active());",
    );
    expect(normalized).toContain(
      "create policy student_payments_select_authorized on public.student_payments for select to authenticated",
    );
    expect(normalized).toContain(
      "create policy leave_notifications_select_authorized on public.leave_notification_deliveries for select to authenticated",
    );
    expect(normalized).toContain(
      "revoke all on table public.payment_settings, public.student_payments, public.leave_notification_deliveries from public, anon, authenticated;",
    );
    expect(normalized).toContain(
      "grant select on table public.payment_settings, public.student_payments, public.leave_notification_deliveries to authenticated;",
    );
  });

  it("reactivates Student group, active state, and audit through one locked service RPC", () => {
    expect(normalized).toContain("create function public.reactivate_student_profile(");
    const body = normalized.match(/create function public\.reactivate_student_profile\([\s\S]+?\$\$;/)?.[0] ?? "";
    expect(body).toContain("for update");
    expect(body).toContain("set student_group = p_student_group, is_active = true");
    expect(body).toContain("'account_reactivated'");
    expect(body).toContain("'old_group', previous_group");
    expect(body).toContain("'new_group', p_student_group");
    expect(body).toContain("assigned_mentor is distinct from p_actor_uuid");
    expect(body).toContain("previous_group is distinct from p_student_group");
    expect(body).toContain("if was_active then");
    expect(body).toContain("student profile is already active in a different group");
    expect(body).toContain("select * into result from public.profiles where id = p_student_uuid;");
    expect(body).toContain("return result;");
    expect(body.indexOf("assigned_mentor is distinct from p_actor_uuid")).toBeLessThan(body.indexOf("if was_active then"));
    expect(normalized).toContain("grant execute on function public.reactivate_student_profile(uuid, uuid, public.student_group, boolean) to service_role;");
  });

  it("reloads the PostgREST schema cache after public RPC grants", () => {
    const primaryRpcIndex = normalized.indexOf("create function public.claim_leave_notification_batch(");
    const primaryGrantIndex = normalized.lastIndexOf("to service_role;");
    const primaryNotifyIndex = normalized.lastIndexOf("notify pgrst, 'reload schema';");
    const targetedRpcIndex = leaveNotificationFixMigration.indexOf("create function public.claim_leave_notification(");
    const targetedGrantIndex = leaveNotificationFixMigration.indexOf(
      "grant execute on function public.claim_leave_notification(uuid, uuid, integer) to service_role;",
    );
    const targetedNotifyIndex = leaveNotificationFixMigration.indexOf("notify pgrst, 'reload schema';");

    expect(primaryRpcIndex).toBeGreaterThan(-1);
    expect(primaryGrantIndex).toBeGreaterThan(primaryRpcIndex);
    expect(primaryNotifyIndex).toBeGreaterThan(primaryGrantIndex);
    expect(targetedRpcIndex).toBeGreaterThan(-1);
    expect(targetedGrantIndex).toBeGreaterThan(targetedRpcIndex);
    expect(targetedNotifyIndex).toBeGreaterThan(targetedGrantIndex);
  });
});
