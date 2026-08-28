import { describe, expect, it } from "vitest";
import { isMissingAvatarBucketError, isMissingSchemaError } from "@/lib/schema-compat";

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
});
