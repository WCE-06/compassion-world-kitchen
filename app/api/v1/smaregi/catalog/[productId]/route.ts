import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { deleteSmaregiProduct, updateSmaregiProduct, updateSmaregiSoldOut, type SmaregiProductInput } from "@/lib/smaregi";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  if (!await hasSiteSessionRequest(request)) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null) as (SmaregiProductInput|{action:"SET_SOLD_OUT";soldOut:boolean}) | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    const { productId } = await context.params;
    if("action" in body){if(body.action==="SET_SOLD_OUT"&&typeof body.soldOut==="boolean")return NextResponse.json({product:await updateSmaregiSoldOut(productId,body.soldOut),soldOut:body.soldOut});return NextResponse.json({error:"INVALID_ACTION"},{status:400})}
    return NextResponse.json({ product: await updateSmaregiProduct(productId, body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMAREGI_ERROR" }, { status: 502 });
  }
}

export async function DELETE(request:NextRequest,context:{params:Promise<{productId:string}>}){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  try{const{productId}=await context.params;await deleteSmaregiProduct(productId);return NextResponse.json({deleted:true,productId})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"SMAREGI_ERROR"},{status:502})}
}
