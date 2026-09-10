import { NextRequest, NextResponse } from "next/server";
import { hasSiteSessionRequest } from "@/lib/site-auth";
import { CALCULATION_VERSION, iso } from "@/lib/schedule-engine";
import { drinkWorkMinutes, scheduleDb } from "@/lib/schedule-store";

type Body = { action?: "ADJUST" | "UNDO"; orderId?: string; minutes?: number; reason?: string; foodReadyAt?: number | null; drinkReadyAt?: number | null; foodCallNumber?: number | null; drinkCallNumber?: number | null };
type Row = { requestId:string; originalFoodReadyAt:number|null; foodReadyAt:number|null; originalDrinkReadyAt:number|null; drinkReadyAt:number|null; servingMode:string; createdAt:number };
type History = { foodReadyAt:number|null; drinkStartAt:number|null; drinkReadyAt:number|null };
type HistoryRow = History & { calculatedAt:number; reason:string|null; mode:string|null; calculationVersion:string|null };
const ORDER_ID=/^[A-Za-z0-9_-]{3,100}$/;

export async function GET(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const orderId=String(request.nextUrl.searchParams.get("orderId")??"").trim();
  if(!ORDER_ID.test(orderId))return NextResponse.json({error:"INVALID_ORDER_ID"},{status:400});
  const db=await scheduleDb(),current=await db.prepare("SELECT original_food_ready_at AS originalFoodReadyAt,food_ready_at AS foodReadyAt,original_drink_ready_at AS originalDrinkReadyAt,drink_ready_at AS drinkReadyAt,update_reason AS reason,update_mode AS mode,updated_at AS updatedAt FROM order_schedules WHERE order_id=?").bind(orderId).first<{originalFoodReadyAt:number|null;foodReadyAt:number|null;originalDrinkReadyAt:number|null;drinkReadyAt:number|null;reason:string|null;mode:string|null;updatedAt:number}>();
  if(!current)return NextResponse.json({error:"SCHEDULE_NOT_FOUND"},{status:404});
  const history=await db.prepare("SELECT calculated_at AS calculatedAt,food_ready_at AS foodReadyAt,drink_start_at AS drinkStartAt,drink_ready_at AS drinkReadyAt,update_reason AS reason,update_mode AS mode,calculation_version AS calculationVersion FROM schedule_history WHERE order_id=? ORDER BY calculated_at DESC LIMIT 30").bind(orderId).all<HistoryRow>();
  return NextResponse.json({orderId,original:{foodReadyAt:current.originalFoodReadyAt,drinkReadyAt:current.originalDrinkReadyAt},current:{foodReadyAt:current.foodReadyAt,drinkReadyAt:current.drinkReadyAt,reason:current.reason,mode:current.mode,updatedAt:current.updatedAt},history:history.results},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
  if(!await hasSiteSessionRequest(request))return NextResponse.json({error:"LOGIN_REQUIRED"},{status:401});
  const body=await request.json().catch(()=>null) as Body|null,orderId=String(body?.orderId??"").trim();
  if(!body||!ORDER_ID.test(orderId)||body.action!=="ADJUST"&&body.action!=="UNDO")return NextResponse.json({error:"INVALID_SCHEDULE_ADJUSTMENT"},{status:400});
  const db=await scheduleDb(),now=Date.now(),drinkMinutes=await drinkWorkMinutes(),existing=await db.prepare("SELECT request_id AS requestId,original_food_ready_at AS originalFoodReadyAt,food_ready_at AS foodReadyAt,original_drink_ready_at AS originalDrinkReadyAt,drink_ready_at AS drinkReadyAt,serving_mode AS servingMode,created_at AS createdAt FROM order_schedules WHERE order_id=?").bind(orderId).first<Row>();

  if(body.action==="UNDO"){
    if(!existing)return NextResponse.json({error:"SCHEDULE_NOT_FOUND"},{status:404});
    const history=await db.prepare("SELECT food_ready_at AS foodReadyAt,drink_start_at AS drinkStartAt,drink_ready_at AS drinkReadyAt FROM schedule_history WHERE order_id=? ORDER BY calculated_at DESC LIMIT 2").bind(orderId).all<History>(),previous=history.results[1]??{foodReadyAt:existing.originalFoodReadyAt,drinkStartAt:existing.originalDrinkReadyAt==null?null:Math.max(now,existing.originalDrinkReadyAt-drinkMinutes*60_000),drinkReadyAt:existing.originalDrinkReadyAt};
    return updateExisting(db,orderId,existing,previous.foodReadyAt,previous.drinkReadyAt,previous.drinkStartAt,"直前の予定変更を取り消し",now);
  }

  const minutes=Math.round(Number(body.minutes));
  if(!Number.isFinite(minutes)||minutes!==5&&minutes!==10)return NextResponse.json({error:"INVALID_ADJUSTMENT_MINUTES"},{status:400});
  const reason=String(body.reason??"").trim().slice(0,80);
  if(!reason)return NextResponse.json({error:"ADJUSTMENT_REASON_REQUIRED"},{status:400});
  const suppliedFood=timestamp(body.foodReadyAt),suppliedDrink=timestamp(body.drinkReadyAt),currentFood=existing?.foodReadyAt??suppliedFood,currentDrink=existing?.drinkReadyAt??suppliedDrink;
  if(currentFood==null&&currentDrink==null)return NextResponse.json({error:"SCHEDULE_NOT_FOUND"},{status:404});
  const shift=minutes*60_000,foodReadyAt=currentFood==null?null:currentFood+shift,drinkReadyAt=currentDrink==null?null:currentDrink+shift,drinkStartAt=drinkReadyAt==null?null:Math.max(now,drinkReadyAt-drinkMinutes*60_000),label=`${reason}のため${minutes}分延長`;
  if(existing)return updateExisting(db,orderId,existing,foodReadyAt,drinkReadyAt,drinkStartAt,label,now);

  const servingMode=currentFood!=null&&currentDrink!=null?"WITH_FOOD":"AS_SOON_AS_POSSIBLE",version=`${CALCULATION_VERSION}-manual`;
  await db.batch([
    db.prepare("INSERT INTO order_schedules(order_id,request_id,status,calculated_at,original_food_ready_at,food_ready_at,food_estimated_minutes,original_drink_ready_at,drink_start_at,drink_ready_at,drink_work_minutes,serving_mode,food_call_number,drink_call_number,update_reason,update_mode,calculation_version,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(orderId,`kitchen-manual-${orderId}`,"CONFIRMED",now,currentFood,foodReadyAt,foodReadyAt==null?null:Math.max(1,Math.ceil((foodReadyAt-now)/60_000)),currentDrink,drinkStartAt,drinkReadyAt,drinkMinutes,servingMode,body.foodCallNumber??null,body.drinkCallNumber??null,label,"MANUAL",version,"{}",now,now),
    db.prepare("INSERT INTO schedule_history(id,order_id,calculated_at,food_ready_at,drink_start_at,drink_ready_at,update_reason,update_mode,calculation_version) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,now-1,currentFood,currentDrink==null?null:Math.max(now,currentDrink-drinkMinutes*60_000),currentDrink,"変更前","AUTOMATIC",version),
    db.prepare("INSERT INTO schedule_history(id,order_id,calculated_at,food_ready_at,drink_start_at,drink_ready_at,update_reason,update_mode,calculation_version) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,now,foodReadyAt,drinkStartAt,drinkReadyAt,label,"MANUAL",version),
    event(db,orderId,foodReadyAt,drinkReadyAt,label,now),
  ]);
  return response(orderId,foodReadyAt,drinkReadyAt,label);
}

async function updateExisting(db:Awaited<ReturnType<typeof scheduleDb>>,orderId:string,existing:Row,foodReadyAt:number|null,drinkReadyAt:number|null,drinkStartAt:number|null,reason:string,now:number){const version=`${CALCULATION_VERSION}-manual`;await db.batch([
  db.prepare("UPDATE order_schedules SET calculated_at=?,food_ready_at=?,food_estimated_minutes=?,drink_start_at=?,drink_ready_at=?,update_reason=?,update_mode='MANUAL',calculation_version=?,updated_at=? WHERE order_id=?").bind(now,foodReadyAt,foodReadyAt==null?null:Math.max(1,Math.ceil((foodReadyAt-now)/60_000)),drinkStartAt,drinkReadyAt,reason,version,now,orderId),
  db.prepare("INSERT INTO schedule_history(id,order_id,calculated_at,food_ready_at,drink_start_at,drink_ready_at,update_reason,update_mode,calculation_version) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),orderId,now,foodReadyAt,drinkStartAt,drinkReadyAt,reason,"MANUAL",version),
  event(db,orderId,foodReadyAt,drinkReadyAt,reason,now),
]);return response(orderId,foodReadyAt,drinkReadyAt,reason)}
function event(db:Awaited<ReturnType<typeof scheduleDb>>,orderId:string,foodReadyAt:number|null,drinkReadyAt:number|null,reason:string,now:number){return db.prepare("INSERT INTO schedule_events(id,order_id,event_type,payload_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),orderId,"SCHEDULE_UPDATED",JSON.stringify({orderId,foodReadyAt:iso(foodReadyAt),drinkReadyAt:iso(drinkReadyAt),reason,mode:"MANUAL"}),now)}
function response(orderId:string,foodReadyAt:number|null,drinkReadyAt:number|null,reason:string){return NextResponse.json({ok:true,orderId,foodReadyAt,drinkReadyAt,reason},{headers:{"Cache-Control":"no-store"}})}
function timestamp(value:unknown){const number=Number(value);return Number.isFinite(number)&&number>0?number:null}
