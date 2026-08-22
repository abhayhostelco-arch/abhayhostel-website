import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function createCsp(): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let connectSources = "'self'";
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin;
      connectSources += ` ${origin} ${origin.replace("https://", "wss://")}`;
    } catch {
      // Invalid configuration fails authentication; keep the CSP restrictive.
    }
  }

  return [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com 'unsafe-inline' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const csp = createCsp();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set("Content-Security-Policy", csp);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          }),
        );
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
