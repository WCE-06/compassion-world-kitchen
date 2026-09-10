import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb } from "@/lib/operations-store";

type EventRow={id:string;taskId:string;title:string;callsJson:string;equipment:string;expectedSeconds:number;action:"COMPLETE"|"UNDO";createdAt:number;deviceId:string};

function startOfTodayJst(now:number){const shifted=new Date(now+9*60*60_000);return Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-9*60*60_000}
function calls(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):[]}catch{return[]}}

export async function GET(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const now=Date.now(),from=startOfTodayJst(now),rows=await(await operationsDb()).prepare(
    "SELECT id,task_id AS taskId,title,calls_json AS callsJson,equipment,expected_seconds AS expectedSeconds,action,created_at AS createdAt,device_id AS deviceId FROM kitchen_task_events WHERE created_at>=? ORDER BY created_at DESC LIMIT 500",
  ).bind(from).all<EventRow>();
  let previousCompletedAt:number|null=null;
  const events=[...rows.results].reverse().map(row=>{const intervalSeconds=row.action==="COMPLETE"&&previousCompletedAt!==null?Math.max(0,Math.round((row.createdAt-previousCompletedAt)/1000)):null;if(row.action==="COMPLETE")previousCompletedAt=row.createdAt;return{...row,calls:calls(row.callsJson),intervalSeconds,overrunSeconds:intervalSeconds===null||row.expectedSeconds<=0?null:intervalSeconds-row.expectedSeconds}});
  const completed=events.filter(event=>event.action==="COMPLETE"),measured=completed.filter(event=>event.overrunSeconds!==null),delayed=measured.filter(event=>(event.overrunSeconds??0)>60);
  return NextResponse.json({from,to:now,summary:{completed:completed.length,measured:measured.length,delayed:delayed.length,onTime:measured.length-delayed.length},events:events.slice(-200).reverse()},{headers:{"Cache-Control":"no-store"}});
}
