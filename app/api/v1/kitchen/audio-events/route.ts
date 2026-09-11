import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb } from "@/lib/operations-store";

const DEVICE_ID=/^[A-Za-z0-9_-]{8,80}$/;
const EVENT_KEY=/^[A-Za-z0-9:_-]{8,240}$/;

export async function POST(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as {eventKey?:string;eventType?:string;deviceId?:string}|null;
  const eventKey=String(body?.eventKey??""),eventType=String(body?.eventType??"").slice(0,40),deviceId=String(body?.deviceId??"");
  if(!EVENT_KEY.test(eventKey)||!eventType||!DEVICE_ID.test(deviceId))return NextResponse.json({error:"INVALID_AUDIO_EVENT"},{status:400});
  const db=await operationsDb(),now=Date.now(),result=await db.prepare("INSERT OR IGNORE INTO kitchen_audio_events(event_key,event_type,device_id,played_at) VALUES(?,?,?,?)").bind(eventKey,eventType,deviceId,now).run();
  await db.prepare("DELETE FROM kitchen_audio_events WHERE played_at<?").bind(now-7*24*60*60_000).run();
  return NextResponse.json({play:Boolean(result.meta.changes),eventKey},{headers:{"Cache-Control":"no-store"}});
}
