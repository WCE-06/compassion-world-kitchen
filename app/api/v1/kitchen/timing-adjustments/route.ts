import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb } from "@/lib/operations-store";

const KEYS={FRYER:"フライヤー",MICROWAVE:"電子レンジ",PREP:"盛付・準備",DRINK:"ドリンク"} as const;
type AdjustmentKey=keyof typeof KEYS;

export async function GET(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const rows=await(await operationsDb()).prepare("SELECT adjustment_key AS adjustmentKey,label,buffer_minutes AS bufferMinutes,source_title AS sourceTitle,sample_count AS sampleCount,updated_at AS updatedAt FROM kitchen_timing_adjustments ORDER BY adjustment_key").all<{adjustmentKey:AdjustmentKey;label:string;bufferMinutes:number;sourceTitle:string;sampleCount:number;updatedAt:number}>();
  return NextResponse.json({adjustments:rows.results,buffers:Object.fromEntries(rows.results.map(row=>[row.adjustmentKey,row.bufferMinutes]))},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as {adjustmentKey?:string;sourceTitle?:string;bufferMinutes?:number;sampleCount?:number}|null;
  const key=String(body?.adjustmentKey??"") as AdjustmentKey,bufferMinutes=Math.round(Number(body?.bufferMinutes)),sampleCount=Math.round(Number(body?.sampleCount)),sourceTitle=String(body?.sourceTitle??"").trim().slice(0,180);
  if(!(key in KEYS)||!sourceTitle||!Number.isInteger(bufferMinutes)||bufferMinutes<1||bufferMinutes>30||!Number.isInteger(sampleCount)||sampleCount<3)return NextResponse.json({error:"ADJUSTMENT_REQUIRES_THREE_SAMPLES"},{status:400});
  const now=Date.now(),db=await operationsDb();
  await db.prepare("INSERT INTO kitchen_timing_adjustments(adjustment_key,label,buffer_minutes,source_title,sample_count,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(adjustment_key) DO UPDATE SET label=excluded.label,buffer_minutes=excluded.buffer_minutes,source_title=excluded.source_title,sample_count=excluded.sample_count,updated_at=excluded.updated_at").bind(key,KEYS[key],bufferMinutes,sourceTitle,sampleCount,now).run();
  return NextResponse.json({ok:true,adjustment:{adjustmentKey:key,label:KEYS[key],bufferMinutes,sourceTitle,sampleCount,updatedAt:now}});
}
