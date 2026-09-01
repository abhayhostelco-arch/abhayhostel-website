import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/types";

async function loadStudentGroups() {
  try {
    const modulePath = "@/lib/student-groups";
    return await import(/* @vite-ignore */ modulePath) as typeof import("@/lib/student-groups");
  } catch {
    return null;
  }
}

const students = [
  { id: "1", student_group: "abhay_hostel" },
  { id: "2", student_group: "krishna_home" },
] as Profile[];

describe("Student group presentation", () => {
  it("uses human-readable group labels", async () => {
    const studentGroups = await loadStudentGroups();
    expect(studentGroups).not.toBeNull();
    if (!studentGroups) return;
    expect(studentGroups.studentGroupLabel("abhay_hostel")).toBe("Abhay Hostel");
    expect(studentGroups.studentGroupLabel("krishna_home")).toBe("Krishna Home");
  });

  it("filters only for canonical query values", async () => {
    const studentGroups = await loadStudentGroups();
    expect(studentGroups).not.toBeNull();
    if (!studentGroups) return;
    expect(studentGroups.parseStudentGroupFilter("krishna_home")).toBe("krishna_home");
    expect(studentGroups.parseStudentGroupFilter("unknown")).toBeUndefined();
    expect(studentGroups.filterStudentsByGroup(students, "abhay_hostel").map((student) => student.id)).toEqual(["1"]);
    expect(studentGroups.filterStudentsByGroup(students, undefined)).toEqual(students);
  });
});
