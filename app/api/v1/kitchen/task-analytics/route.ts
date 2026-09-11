import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { operationsDb } from "@/lib/operations-store";

type EventRow={id:string;taskId:string;title:string;callsJson:string;equipment:string;expectedSeconds:number;action:"COMPLETE"|"UNDO";createdAt:number;deviceId:string;startedAt:number|null};
type MeasuredEvent=EventRow&{calls:string[];intervalSeconds:number|null;durationSeconds:number|null;overrunSeconds:number;measurementSource:"START"|"INTERVAL"};

function startOfTodayJst(now:number){const shifted=new Date(now+9*60*60_000);return Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-9*60*60_000}
function calls(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(String):[]}catch{return[]}}
function adjustmentKey(equipment:string){if(/フライヤー/.test(equipment))return"FRYER";if(/電子レンジ/.test(equipment))return"MICROWAVE";if(/ドリンク/.test(equipment))return"DRINK";return"PREP"}

export async function GET(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const now=Date.now(),from=startOfTodayJst(now),db=await operationsDb(),rows=await db.prepare(
    "SELECT e.id,e.task_id AS taskId,e.title,e.calls_json AS callsJson,e.equipment,e.expected_seconds AS expectedSeconds,e.action,e.created_at AS createdAt,e.device_id AS deviceId,s.started_at AS startedAt FROM kitchen_task_events e LEFT JOIN kitchen_task_starts s ON s.task_id=e.task_id WHERE e.created_at>=? ORDER BY e.created_at DESC LIMIT 500",
  ).bind(from).all<EventRow>();
  let previousCompletedAt:number|null=null;
  const events=[...rows.results].reverse().map(row=>{const intervalSeconds=row.action==="COMPLETE"&&previousCompletedAt!==null?Math.max(0,Math.round((row.createdAt-previousCompletedAt)/1000)):null,durationSeconds=row.action==="COMPLETE"&&row.startedAt!==null&&row.startedAt<=row.createdAt?Math.max(0,Math.round((row.createdAt-row.startedAt)/1000)):null,measuredSeconds=durationSeconds??intervalSeconds;if(row.action==="COMPLETE")previousCompletedAt=row.createdAt;return{...row,calls:calls(row.callsJson),intervalSeconds,durationSeconds,measurementSource:durationSeconds!==null?"START" as const:"INTERVAL" as const,overrunSeconds:measuredSeconds===null||row.expectedSeconds<=0?null:measuredSeconds-row.expectedSeconds}});
  const completed=events.filter(event=>event.action==="COMPLETE"),measured=completed.filter((event):event is MeasuredEvent=>event.overrunSeconds!==null),delayed=measured.filter(event=>event.overrunSeconds>60);
  const groups=new Map<string,MeasuredEvent[]>();
  measured.forEach(event=>{const key=`${event.equipment}\u0000${event.title}`,group=groups.get(key)??[];group.push(event);groups.set(key,group)});
  const bottlenecks=[...groups.values()].map(group=>{const sampleCount=group.length,expectedSeconds=Math.round(group.reduce((sum,event)=>sum+event.expectedSeconds,0)/sampleCount),averageActualSeconds=Math.round(group.reduce((sum,event)=>sum+(event.durationSeconds??event.intervalSeconds??0),0)/sampleCount),averageOverrunSeconds=Math.round(group.reduce((sum,event)=>sum+event.overrunSeconds,0)/sampleCount),maxOverrunSeconds=Math.max(...group.map(event=>event.overrunSeconds)),directSamples=group.filter(event=>event.measurementSource==="START").length,suggestedSeconds=Math.max(expectedSeconds,Math.ceil((expectedSeconds+Math.max(0,averageOverrunSeconds))/60)*60);return{title:group[0].title,equipment:group[0].equipment,adjustmentKey:adjustmentKey(group[0].equipment),sampleCount,directSamples,expectedSeconds,averageActualSeconds,averageOverrunSeconds,maxOverrunSeconds,suggestedMinutes:Math.max(1,Math.ceil(suggestedSeconds/60)),suggestedBufferMinutes:Math.max(1,Math.ceil(Math.max(0,averageOverrunSeconds)/60)),needsReview:averageOverrunSeconds>60,confidence:directSamples>=3?"ENOUGH":"LOW"}}).sort((a,b)=>Number(b.needsReview)-Number(a.needsReview)||b.averageOverrunSeconds-a.averageOverrunSeconds||b.directSamples-a.directSamples).slice(0,8);
  const adjustments=await db.prepare("SELECT adjustment_key AS adjustmentKey,buffer_minutes AS bufferMinutes,source_title AS sourceTitle,updated_at AS updatedAt FROM kitchen_timing_adjustments").all<{adjustmentKey:string;bufferMinutes:number;sourceTitle:string;updatedAt:number}>();
  return NextResponse.json({from,to:now,summary:{completed:completed.length,measured:measured.length,delayed:delayed.length,onTime:measured.length-delayed.length},adjustments:Object.fromEntries(adjustments.results.map(row=>[row.adjustmentKey,row])),bottlenecks,events:events.slice(-200).reverse()},{headers:{"Cache-Control":"no-store"}});
}
