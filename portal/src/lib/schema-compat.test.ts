import { describe, expect, it } from "vitest";
import {
  isMissingAvatarBucketError,
  isMissingCleanupSchemaError,
  isMissingSchemaError,
} from "@/lib/schema-compat";

describe("optional schema compatibility", () => {
  it("recognizes missing relation and column errors only", () => {
    expect(isMissingSchemaError({ code: "42P01", message: "relation missing" })).toBe(true);
    expect(isMissingSchemaError({ code: "PGRST204", message: "column absent from schema cache" })).toBe(true);
    expect(isMissingSchemaError({ code: "42501", message: "permission denied" })).toBe(false);
  });

  it("recognizes an unavailable avatar bucket", () => {
    expect(isMissingAvatarBucketError({ message: "Bucket not found" })).toBe(true);
    expect(isMissingAvatarBucketError({ message: "File too large" })).toBe(false);
  });

  it("recognizes PGRST202 only when it names a known feature RPC", () => {
    expect(isMissingSchemaError({ code: "PGRST202", message: "Could not find function public.unrelated_rpc" })).toBe(false);
    expect(isMissingSchemaError({ code: "PGRST202", message: "Could not find function public.unrelated_rpc in the schema cache" })).toBe(false);
    expect(isMissingSchemaError({ code: "PGRST202", message: "Could not find function public.update_student_group" }, ["update_student_group"])).toBe(true);
    expect(isMissingCleanupSchemaError({ code: "PGRST202", message: "Could not find function public.unrelated_rpc" })).toBe(false);
    expect(isMissingCleanupSchemaError({ code: "PGRST202", message: "Could not find function public.cleanup_update_auto" })).toBe(true);
    expect(isMissingCleanupSchemaError({ code: "42P01", message: "cleanup_runs does not exist" })).toBe(true);
    expect(isMissingCleanupSchemaError({ code: "42703", message: "deletion_pending_at does not exist" })).toBe(true);
    expect(isMissingCleanupSchemaError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingCleanupSchemaError({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
