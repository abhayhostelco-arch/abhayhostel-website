import type { Profile, StudentGroup } from "@/lib/types";

export const studentGroupOptions: ReadonlyArray<{ value: StudentGroup; label: string }> = [
  { value: "abhay_hostel", label: "Abhay Hostel" },
  { value: "krishna_home", label: "Krishna Home" },
];

export function isStudentGroup(group: StudentGroup | null | undefined): group is StudentGroup {
  return studentGroupOptions.some((option) => option.value === group);
}

export function studentGroupLabel(group: StudentGroup | null | undefined): string {
  return studentGroupOptions.find((option) => option.value === group)?.label ?? "Migration required";
}

export function parseStudentGroupFilter(value: string | undefined): StudentGroup | undefined {
  return studentGroupOptions.some((option) => option.value === value) ? value as StudentGroup : undefined;
}

export function filterStudentsByGroup(students: Profile[], group: StudentGroup | undefined): Profile[] {
  return group ? students.filter((student) => student.student_group === group) : students;
}
