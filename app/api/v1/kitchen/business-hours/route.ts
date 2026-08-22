import { env } from "cloudflare:workers";
import { NextRequest,NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";

type Runtime={KITCHEN_API_TOKEN?:string;MEMBERS_API_BASE_URL?:string};
async function forward(request:NextRequest){if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});const runtime=env as unknown as Runtime;if(!runtime.KITCHEN_API_TOKEN)return NextResponse.json({error:"KITCHEN_API_NOT_CONFIGURED"},{status:503});const response=await fetch(`${runtime.MEMBERS_API_BASE_URL??"https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/business-hours`,{method:request.method,headers:{Authorization:`Bearer ${runtime.KITCHEN_API_TOKEN}`,...(request.method==="PUT"?{"Content-Type":"application/json"}:{})},body:request.method==="PUT"?await request.text():undefined});return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
export function GET(request:NextRequest){return forward(request)}
export function PUT(request:NextRequest){return forward(request)}
