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
let profileUpdateErrors: Array<{ code: string; message: string } | null>;
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
      return Promise.resolve({ error: profileUpdateErrors.length ? profileUpdateErrors.shift() ?? null : profileUpdateError }).then(onfulfilled, onrejected);
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
  profileUpdateErrors = [];
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
    expect(mocks.rpc).toHaveBeenCalledWith("reactivate_student_profile", expect.objectContaining({
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
      p_restored_during_creation: true,
    }));
    expect(profileUpdates).toContainEqual(expect.objectContaining({ is_active: false }));
    expect(auditRows).not.toContainEqual(expect.objectContaining({ action: "account_reactivated" }));
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
    expect(mocks.rpc).toHaveBeenCalledWith("reactivate_student_profile", expect.objectContaining({
      p_student_uuid: student.id,
      p_student_group: "krishna_home",
      p_restored_during_creation: false,
    }));
    expect(profileUpdates).not.toContainEqual({ is_active: true });
    expect(auditRows).not.toContainEqual(expect.objectContaining({ action: "account_reactivated" }));
  });

  it("re-bans Auth when transactional directory reactivation fails", async () => {
    profiles.push({ ...student });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "transaction failed" } });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    const result = await accountActions.reactivateStudentAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "error", message: "The Student could not be reactivated. The login remains disabled." });
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(1, student.id, { ban_duration: "none" });
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, student.id, { ban_duration: "876000h" });
  });

  it("does not re-ban Auth when another directory request concurrently activates the Student", async () => {
    profiles.push({ ...student });
    mocks.rpc.mockImplementation(async () => {
      profiles[1].is_active = true;
      return { data: null, error: { code: "22023", message: "student profile is already active in a different group" } };
    });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    const result = await accountActions.reactivateStudentAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "error", message: "The Student was reactivated by another request. Refresh before changing the group." });
    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    expect(mocks.updateUserById).toHaveBeenCalledWith(student.id, { ban_duration: "none" });
  });

  it("reports manual recovery when Auth re-ban fails after transactional reactivation failure", async () => {
    profiles.push({ ...student });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "transaction failed" } });
    mocks.updateUserById.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "re-ban failed" } });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "krishna_home");

    const result = await accountActions.reactivateStudentAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "error", message: "Automatic account recovery failed. Manually disable the Auth login and portal profile before retrying." });
  });

  it("reports manual recovery when creation-restoration cannot re-ban Auth after RPC failure", async () => {
    profiles.push({ ...student });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "transaction failed" } });
    mocks.updateUserById.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "re-ban failed" } });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home", student.email));

    expect(result).toEqual({ status: "error", message: "Automatic account recovery failed. Manually disable the Auth login and portal profile before retrying." });
    expect(mocks.rpc).toHaveBeenCalledWith("reactivate_student_profile", expect.objectContaining({ p_restored_during_creation: true }));
  });

  it("does not re-ban Auth when another creation-restoration request concurrently activates the Student", async () => {
    profiles.push({ ...student });
    mocks.rpc.mockImplementation(async () => {
      profiles[1].is_active = true;
      return { data: null, error: { code: "22023", message: "student profile is already active in a different group" } };
    });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home", student.email));

    expect(result).toEqual({ status: "error", message: "The Student was reactivated by another request. Refresh before changing the group." });
    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    expect(mocks.updateUserById).toHaveBeenCalledWith(student.id, expect.objectContaining({ ban_duration: "none" }));
  });

  it("checks both quarantine writes after a new-account group RPC failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "group failed" } });
    profileUpdateErrors = [null, { code: "XX000", message: "deactivation failed" }];
    mocks.updateUserById.mockResolvedValue({ error: { message: "ban failed" } });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home"));

    expect(result).toEqual({ status: "error", message: "Automatic account recovery failed. Manually disable the Auth login and portal profile before retrying." });
    expect(profileUpdates).toContainEqual({ is_active: false });
    expect(mocks.updateUserById).toHaveBeenCalledWith(student.id, { ban_duration: "876000h" });
  });

  it("keeps a primary new-account group failure distinct when quarantine succeeds", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "group failed" } });

    const result = await accountActions.createAccountAction({ status: "idle" }, studentForm("krishna_home"));

    expect(result).toEqual({ status: "error", message: "The Student group could not be initialized." });
    expect(profileUpdates).toContainEqual({ is_active: false });
    expect(mocks.updateUserById).toHaveBeenCalledWith(student.id, { ban_duration: "876000h" });
  });

  it("allows an assigned Mentor to reactivate only in the stored group", async () => {
    const assignedMentor = { ...mentor };
    mocks.requireProfile.mockResolvedValue(assignedMentor);
    profiles.push({ ...student, mentor_id: assignedMentor.id });
    const formData = new FormData();
    formData.set("targetId", student.id);
    formData.set("studentGroup", "abhay_hostel");

    const result = await accountActions.reactivateStudentAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("reactivate_student_profile", expect.objectContaining({ p_actor_uuid: assignedMentor.id, p_student_group: "abhay_hostel" }));
  });

  it("does not let a Mentor change the stored group or reactivate an unassigned Student", async () => {
    mocks.requireProfile.mockResolvedValue(mentor);
    profiles.push({ ...student, mentor_id: mentor.id });
    const change = new FormData();
    change.set("targetId", student.id);
    change.set("studentGroup", "krishna_home");

    await expect(accountActions.reactivateStudentAction({ status: "idle" }, change)).resolves.toEqual({ status: "error", message: "Only a Super Admin can change a Student group." });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();

    profiles.splice(1, 1, { ...student, mentor_id: actor.id });
    change.set("studentGroup", "abhay_hostel");
    await expect(accountActions.reactivateStudentAction({ status: "idle" }, change)).resolves.toEqual({ status: "error", message: "This Student cannot be reactivated." });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });
});
