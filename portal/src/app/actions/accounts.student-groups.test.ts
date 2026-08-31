import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireProfile: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: mocks.createUser, updateUserById: mocks.updateUserById } },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/security", () => ({ generateTemporaryPassword: () => "Temporary9!Password" }));

import * as accountActions from "@/app/actions/accounts";

const actor = {
  id: "00000000-0000-4000-8000-000000000010",
  role: "super_admin",
  full_name: "Owner",
  is_active: true,
} as Profile;
const mentor = {
  id: "00000000-0000-4000-8000-000000000020",
  role: "admin",
  full_name: "Mentor",
  email: "mentor@example.com",
  is_active: true,
} as Profile;
const student = {
  id: "00000000-0000-4000-8000-000000000030",
  role: "student",
  full_name: "Student",
  email: "student@example.com",
  is_active: false,
  student_group: "abhay_hostel",
  mentor_id: mentor.id,
} as Profile;

let profiles: Profile[];
let schemaError: { code: string; message: string } | null;
let profileUpdateError: { code: string; message: string } | null;
let profileUpdates: Array<Record<string, unknown>>;
let auditRows: Array<Record<string, unknown>>;

function profileBuilder() {
  const filters = new Map<string, unknown>();
  let selection = "";
  let updateValues: Record<string, unknown> | null = null;
  const builder: Record<string, unknown> & PromiseLike<{ error: typeof profileUpdateError }> = {
    select(columns: string) {
      selection = columns;
      return builder;
    },
    update(values: Record<string, unknown>) {
      updateValues = values;
      profileUpdates.push(values);
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return builder;
    },
    neq() {
      return builder;
    },
    async limit() {
      if (selection === "student_group") return { data: [], error: schemaError };
      return { data: [], error: null };
    },
    async maybeSingle() {
      const row = profiles.find((profile) => [...filters].every(([key, value]) => profile[key as keyof Profile] === value));
      return { data: row ?? null, error: null };
    },
    then<TResult1 = { error: typeof profileUpdateError }, TResult2 = never>(
      onfulfilled?: ((value: { error: typeof profileUpdateError }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      if (updateValues) {
        const row = profiles.find((profile) => [...filters].every(([key, value]) => profile[key as keyof Profile] === value));
        if (row && !profileUpdateError) Object.assign(row, updateValues);
      }
      return Promise.resolve({ error: profileUpdateError }).then(onfulfilled, onrejected);
    },
  };
  return builder;
}

function studentForm(group: "abhay_hostel" | "krishna_home", email = "new@example.com") {
  const formData = new FormData();
  formData.set("role", "student");
  formData.set("fullName", "New Student");
  formData.set("email", email);
  formData.set("mentorId", mentor.id);
  formData.set("joinedOn", "2026-08-31");
  formData.set("studentGroup", group);
  return formData;
}

beforeEach(() => {
  profiles = [mentor];
  schemaError = null;
  profileUpdateError = null;
  profileUpdates = [];
  auditRows = [];
  vi.clearAllMocks();
  mocks.requireProfile.mockResolvedValue(actor);
  mocks.createUser.mockResolvedValue({ data: { user: { id: student.id } }, error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: student, error: null });
  mocks.from.mockImplementation((table: string) => table === "audit_events"
    ? { insert: async (row: Record<string, unknown>) => { auditRows.push(row); return { error: null }; } }
    : profileBuilder());
});

describe("Student group account actions", () => {
  it("creates a Student with the selected group in auth metadata and verifies it through the audited RPC", async () => {
    mocks.createUser.mockResolvedValue({ data: { user: { id: student.id } }, error: null });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home"));

    expect(result.status).toBe("success");
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      user_metadata: expect.objectContaining({ student_group: "krishna_home" }),
    }));
    expect(mocks.rpc).toHaveBeenCalledWith("update_student_group", {
      p_actor_uuid: actor.id,
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
    });
  });

  it("uses the selected group when creation restores an inactive Student", async () => {
    profiles.push({ ...student });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home", student.email));

    expect(result.status).toBe("success");
    expect(mocks.updateUserById).toHaveBeenCalledWith(student.id, expect.objectContaining({
      user_metadata: expect.objectContaining({ student_group: "krishna_home" }),
    }));
    expect(mocks.rpc).toHaveBeenCalledWith("update_student_group", expect.objectContaining({
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
    }));
    expect(auditRows).toContainEqual(expect.objectContaining({
      action: "account_reactivated",
      metadata: expect.objectContaining({ old_group: "abhay_hostel", new_group: "krishna_home" }),
    }));
  });

  it("stops before creating authentication state when the group column is unavailable", async () => {
    schemaError = { code: "PGRST204", message: "student_group is missing from the schema cache" };

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("abhay_hostel"));

    expect(result).toEqual({
      status: "error",
      message: "Student groups are unavailable until the student group migration is applied.",
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("does not restore a legacy profile response that lacks the migrated group field", async () => {
    profiles.push({ ...student, student_group: undefined });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home", student.email));

    expect(result).toEqual({ status: "error", message: "Student groups are unavailable until the student group migration is applied." });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("edits an existing Student group through the audited RPC", async () => {
    profiles.push({ ...student, is_active: true });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    expect(typeof accountActions.updateStudentGroupAction).toBe("function");
    if (typeof accountActions.updateStudentGroupAction !== "function") return;
    const result = await accountActions.updateStudentGroupAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Student group saved." });
    expect(mocks.rpc).toHaveBeenCalledWith("update_student_group", {
      p_actor_uuid: actor.id,
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
    });
  });

  it("returns a migration-required result when the group RPC is unavailable", async () => {
    profiles.push({ ...student, is_active: true });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function update_student_group" } });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    expect(typeof accountActions.updateStudentGroupAction).toBe("function");
    if (typeof accountActions.updateStudentGroupAction !== "function") return;
    const result = await accountActions.updateStudentGroupAction({ status: "idle" }, formData);

    expect(result).toEqual({
      status: "error",
      message: "Student groups are unavailable until the student group migration is applied.",
    });
  });

  it("requires an explicit group when reactivating from the Student directory", async () => {
    profiles.push({ ...student });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    expect(typeof accountActions.reactivateStudentAction).toBe("function");
    if (typeof accountActions.reactivateStudentAction !== "function") return;
    const result = await accountActions.reactivateStudentAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Student reactivated in Krishna Home." });
    expect(mocks.rpc).toHaveBeenCalledWith("update_student_group", expect.objectContaining({
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
    }));
    expect(profileUpdates).toContainEqual({ is_active: true });
  });
});
