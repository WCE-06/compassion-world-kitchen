import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const SITE_SESSION_COOKIE = "aozora_kitchen_session";

type Runtime = { KITCHEN_SITE_PASSWORD?: string; AUTH_SESSION_SECRET?: string };

function runtime() { return env as unknown as Runtime; }

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function expectedSession() {
  const { KITCHEN_SITE_PASSWORD: password, AUTH_SESSION_SECRET: secret } = runtime();
  if (!password || !secret) return null;
  return digest(`${secret}:${password}:aozora-kitchen`);
}

export async function passwordIsValid(candidate: string) {
  const configured = runtime().KITCHEN_SITE_PASSWORD;
  if (!configured || candidate.length !== configured.length) return false;
  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) difference |= configured.charCodeAt(index) ^ candidate.charCodeAt(index);
  return difference === 0;
}

export async function createSiteSession() { return expectedSession(); }

export async function hasSiteSession() {
  const expected = await expectedSession();
  return Boolean(expected && (await cookies()).get(SITE_SESSION_COOKIE)?.value === expected);
}

export async function hasSiteSessionRequest(request: NextRequest) {
  const expected = await expectedSession();
  return Boolean(expected && request.cookies.get(SITE_SESSION_COOKIE)?.value === expected);
}
