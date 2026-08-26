import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { hasSiteSessionRequest } from "@/lib/site-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { productCodes?: string[] } | null;
  const productCodes = body?.productCodes;
  if (!Array.isArray(productCodes) || productCodes.length === 0 || productCodes.length > 250 || new Set(productCodes).size !== productCodes.length) {
    return NextResponse.json({ error: "INVALID_ORDER" }, { status: 400 });
  }
  try {
    const runtime=env as unknown as{MEMBERS_API_BASE_URL?:string;KITCHEN_API_TOKEN?:string};
    if(!runtime.KITCHEN_API_TOKEN)return NextResponse.json({error:"KITCHEN_API_NOT_CONFIGURED"},{status:503});
    const response=await fetch(`${runtime.MEMBERS_API_BASE_URL??"https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/catalog-order`,{method:"PATCH",headers:{Authorization:`Bearer ${runtime.KITCHEN_API_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({productCodes})});
    return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
