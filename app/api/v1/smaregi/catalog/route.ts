import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createSmaregiProduct, getSmaregiCatalog, type SmaregiProductInput } from "@/lib/smaregi";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getChatGPTUser()) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  try {
    return NextResponse.json(await getSmaregiCatalog(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!await getChatGPTUser()) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as SmaregiProductInput | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    return NextResponse.json({ product: await createSmaregiProduct(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
