import { env } from "cloudflare:workers";
import { scheduleSchema } from "@/db/schema";
import { microwaveSeconds } from "@/lib/schedule-engine";

let initialized = false;
export async function scheduleDb() {
  const db = env.DB;
  if (!initialized) {
    await db.batch(scheduleSchema.map((sql) => db.prepare(sql)));
    await db.prepare("INSERT OR IGNORE INTO kitchen_settings(setting_key,setting_value,updated_at) VALUES('drink_work_minutes','5',?)").bind(Date.now()).run();
    initialized = true;
  }
  return db;
}
export async function drinkWorkMinutes() { const row = await (await scheduleDb()).prepare("SELECT setting_value AS value FROM kitchen_settings WHERE setting_key='drink_work_minutes'").first<{ value: string }>(); return Math.max(1, Number(row?.value ?? 5)); }
export async function liveFoodOrderCount() {
  try {
    const runtime = env as unknown as { MEMBERS_API_BASE_URL?: string; KITCHEN_API_TOKEN?: string };
    if (!runtime.KITCHEN_API_TOKEN) return 0;
    const response = await fetch(`${runtime.MEMBERS_API_BASE_URL ?? "https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/fulfillments?department=FOOD`, { headers: { Authorization: `Bearer ${runtime.KITCHEN_API_TOKEN}` } });
    const body = await response.json() as { fulfillments?: unknown[] }; return response.ok ? body.fulfillments?.length ?? 0 : 0;
  } catch { return 0; }
}
export async function liveKitchenLoad(){try{const runtime=env as unknown as{MEMBERS_API_BASE_URL?:string;KITCHEN_API_TOKEN?:string};if(!runtime.KITCHEN_API_TOKEN)return{activeFoodOrders:0,activeMicrowaveSeconds:0};const response=await fetch(`${runtime.MEMBERS_API_BASE_URL??"https://compassion-world-members-card.combetter27.chatgpt.site"}/api/v1/kitchen/units?department=FOOD`,{headers:{Authorization:`Bearer ${runtime.KITCHEN_API_TOKEN}`}}),body=await response.json()as{units?:{orderId:string;status:string;isTest?:boolean;items?:{name?:string;quantity:number;preparationMinutes?:number}[]}[]};if(!response.ok)return{activeFoodOrders:0,activeMicrowaveSeconds:0};const units=(body.units??[]).filter(unit=>!unit.isTest&&(unit.status==="ACCEPTED"||unit.status==="COOKING")),orders=new Set(units.map(unit=>unit.orderId));const activeMicrowaveSeconds=units.reduce((sum,unit)=>sum+microwaveSeconds({name:unit.items?.[0]?.name,quantity:unit.items?.[0]?.quantity??1,department:"FOOD",preparationMinutes:unit.items?.[0]?.preparationMinutes}),0);return{activeFoodOrders:orders.size,activeMicrowaveSeconds}}catch{return{activeFoodOrders:0,activeMicrowaveSeconds:0}}}
