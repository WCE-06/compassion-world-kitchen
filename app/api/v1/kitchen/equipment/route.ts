import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { fryerPreheated, setFryerPreheated } from "@/lib/schedule-store";

export async function GET(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  return NextResponse.json({fryerPreheated:await fryerPreheated(),fryerPreheatMinutes:10},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as {fryerPreheated?:boolean}|null;
  if(typeof body?.fryerPreheated!=="boolean")return NextResponse.json({error:"INVALID_SETTING"},{status:400});
  return NextResponse.json({fryerPreheated:await setFryerPreheated(body.fryerPreheated),fryerPreheatMinutes:10});
}
