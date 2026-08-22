import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
}).superRefine((env, context) => {
  if (process.env.NODE_ENV !== "production") return;
  if (env.NEXT_PUBLIC_APP_URL !== "https://app.abhayhostel.in") {
    context.addIssue({ code: "custom", message: "Production app URL must use the canonical HTTPS origin." });
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://")) {
    context.addIssue({ code: "custom", message: "Production Supabase URL must use HTTPS." });
  }
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("The portal is not configured correctly.");
  return parsed.data;
}

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
