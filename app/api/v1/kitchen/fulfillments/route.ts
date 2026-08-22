import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

type Runtime = { KITCHEN_API_TOKEN?: string; MEMBERS_API_BASE_URL?: string };

async function forward(request: NextRequest, method: "GET" | "PATCH") {
  if (!await getChatGPTUser()) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const runtime = env as unknown as Runtime;
  if (!runtime.KITCHEN_API_TOKEN) return NextResponse.json({ error: "KITCHEN_API_NOT_CONFIGURED" }, { status: 503 });
  const base = runtime.MEMBERS_API_BASE_URL ?? "https://compassion-world-members-card.combetter27.chatgpt.site";
  const department = request.nextUrl.searchParams.get("department");
  const target = `${base}/api/v1/kitchen/fulfillments${department ? `?department=${encodeURIComponent(department)}` : ""}`;
  try {
    const response = await fetch(target, {
      method,
      headers: { Authorization: `Bearer ${runtime.KITCHEN_API_TOKEN}`, ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}) },
      body: method === "PATCH" ? await request.text() : undefined,
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "KITCHEN_API_UNAVAILABLE" }, { status: 502 });
  }
}

export function GET(request: NextRequest) { return forward(request, "GET"); }
export function PATCH(request: NextRequest) { return forward(request, "PATCH"); }
