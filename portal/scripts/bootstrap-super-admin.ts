import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  BOOTSTRAP_SUPER_ADMIN_EMAIL: z.email().trim().toLowerCase(),
  BOOTSTRAP_SUPER_ADMIN_NAME: z.string().trim().min(2).max(120),
});

const groups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-+",
];

function choose(value: string): string {
  return value[randomInt(value.length)];
}

function temporaryPassword(): string {
  const characters = groups.map(choose);
  const all = groups.join("");
  while (characters.length < 20) characters.push(choose(all));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join("");
}

async function main() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Set the Supabase and BOOTSTRAP_SUPER_ADMIN variables in .env.local.");
  }

  const env = parsed.data;
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  if (countError) throw new Error("Could not inspect existing Super Admin accounts.");
  if (count !== 0) {
    throw new Error("Bootstrap refused: a Super Admin already exists.");
  }

  const password = temporaryPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email: env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
    password,
    email_confirm: true,
    app_metadata: { role: "super_admin" },
    user_metadata: { full_name: env.BOOTSTRAP_SUPER_ADMIN_NAME },
  });
  if (error || !data.user) throw new Error("Super Admin creation failed.");

  // Auth metadata can be applied after the auth.users insert trigger runs, so
  // explicitly establish the sole privileged role before recording success.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "super_admin",
      full_name: env.BOOTSTRAP_SUPER_ADMIN_NAME,
      email: env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
      joined_on: null,
      is_active: true,
      must_change_password: true,
    })
    .eq("id", data.user.id);
  if (profileError) {
    await supabase.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
    throw new Error("Super Admin created but its profile could not be initialized.");
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    actor_id: data.user.id,
    action: "super_admin_bootstrapped",
    target_id: data.user.id,
    metadata: {},
  });
  if (auditError) throw new Error("Super Admin created, but audit recording failed.");

  process.stdout.write(
    `Super Admin created for ${env.BOOTSTRAP_SUPER_ADMIN_EMAIL}.\n` +
      `Temporary password (shown once): ${password}\n` +
      "Sign in and change it immediately.\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Bootstrap failed."}\n`);
  process.exitCode = 1;
});
