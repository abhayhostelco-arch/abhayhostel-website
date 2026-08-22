import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

const REAUTH_COOKIE = "abhay-recent-auth";
const REAUTH_SECONDS = 15 * 60;
const characterGroups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-+",
];

function choose(group: string): string {
  return group[randomInt(group.length)];
}

export function generateTemporaryPassword(length = 20): string {
  const all = characterGroups.join("");
  const values = characterGroups.map(choose);
  while (values.length < length) values.push(choose(all));
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.join("");
}

function signature(payload: string): string {
  return createHmac("sha256", getServerEnv().REAUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export async function markRecentReauth(userId: string): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + REAUTH_SECONDS;
  const payload = `${userId}.${expires}`;
  const store = await cookies();
  store.set(REAUTH_COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: REAUTH_SECONDS,
  });
}

export async function hasRecentReauth(userId: string): Promise<boolean> {
  const value = (await cookies()).get(REAUTH_COOKIE)?.value;
  if (!value) return false;
  const [id, expiresText, provided] = value.split(".");
  if (id !== userId || !expiresText || !provided) return false;
  if (Number(expiresText) < Math.floor(Date.now() / 1000)) return false;
  const expected = signature(`${id}.${expiresText}`);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
