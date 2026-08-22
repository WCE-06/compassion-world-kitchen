import { NextRequest, NextResponse } from "next/server";
import { createSiteSession, hasSiteSessionRequest, passwordIsValid, SITE_SESSION_COOKIE } from "@/lib/site-auth";

export async function GET(request: NextRequest) {
  return hasSiteSessionRequest(request).then((valid) => NextResponse.json({ authenticated: valid }, { status: valid ? 200 : 401 }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!await passwordIsValid(body.password ?? "")) return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  const session = await createSiteSession();
  if (!session) return NextResponse.json({ error: "認証設定を確認してください" }, { status: 503 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_SESSION_COOKIE, session, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
