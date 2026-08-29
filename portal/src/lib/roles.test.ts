import { describe, expect, it } from "vitest";
import * as roles from "@/lib/roles";

describe("student profile paths", () => {
  it("keeps Admin and Mentor links inside their own workspaces", () => {
    const studentProfilePath = (roles as unknown as {
      studentProfilePath?: (role: "super_admin" | "admin", studentId: string) => string;
    }).studentProfilePath;
    expect(typeof studentProfilePath).toBe("function");
    expect(studentProfilePath?.("super_admin", "student-1")).toBe("/admin/students/student-1");
    expect(studentProfilePath?.("admin", "student-1")).toBe("/mentor/students/student-1");
  });
});
