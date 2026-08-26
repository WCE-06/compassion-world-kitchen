import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { updateSmaregiProduct, updateSmaregiSoldOut, type SmaregiProductInput } from "@/lib/smaregi";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as (SmaregiProductInput|{action:"SET_SOLD_OUT";soldOut:boolean}|{action:"SET_PUBLICATION";productCode:string;published:boolean}) | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    const { productId } = await context.params;
    if("action" in body){
      if(body.action==="SET_SOLD_OUT"&&typeof body.soldOut==="boolean")return NextResponse.json({product:await updateSmaregiSoldOut(productId,body.soldOut),soldOut:body.soldOut});
      if(body.action==="SET_PUBLICATION"&&typeof body.productCode==="string"&&typeof body.published==="boolean"){
        const runtime=env as unknown as{MEMBERS_API_BASE_URL?:string;KITCHEN_API_TOKEN?:string};
        if(!runtime.KITCHEN_API_TOKEN)return NextResponse.json({error:"KITCHEN_API_NOT_CONFIGURED"},{status:503});
        const response=await fetch(`${runtime.MEMBERS_API_BASE_URL??"https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/catalog-publication`,{method:"PATCH",headers:{Authorization:`Bearer ${runtime.KITCHEN_API_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({productCode:body.productCode,published:body.published})});
        return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
      }
      return NextResponse.json({error:"INVALID_ACTION"},{status:400})
    }
    return NextResponse.json({ product: await updateSmaregiProduct(productId, body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}
