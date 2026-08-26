export type ServingMode = "WITH_FOOD" | "AS_SOON_AS_POSSIBLE" | "DRINK_FIRST";
export type EstimateItem = { productId?: string; productCode?: string; name?: string; quantity: number; department?: "FOOD" | "DRINK"; preparationMinutes?: number; options?: { preparationMinutesDelta?: number }[] };
export type EstimateInput = { requestId: string; orderId?: string; items: EstimateItem[]; orderedAt?: string; servingMode?: ServingMode; serviceType?: "EAT_IN" | "TAKEOUT"; kitchen?: { activeFoodOrders?: number; fryerBatches?: number; microwaveContainers?: number; activeMicrowaveSeconds?:number } };

export const CALCULATION_VERSION = "aok-v1.1-microwave-serial";
export const SHARED_CARBONARA_SAUCE_600W_SECONDS=50;

export function microwaveSeconds(item:EstimateItem){const text=`${item.productCode??""} ${item.name??""}`.toLowerCase(),quantity=Math.max(1,item.quantity);let seconds=0;if(/カルボナーラ.*パスタ|パスタ.*カルボナーラ|carbonara.*pasta/.test(text))seconds=190+SHARED_CARBONARA_SAUCE_600W_SECONDS;else if(/濃厚魚介つけ麺|つけ麺|tsukemen|tukemen/.test(text))seconds=180+40;else if(/贅沢ポテト/.test(text))seconds=SHARED_CARBONARA_SAUCE_600W_SECONDS;else if(/ほうとう/.test(text))seconds=720;else if(/うどん/.test(text))seconds=360;else if(/角煮丼/.test(text))seconds=120;else if(/煮カツ丼|カツ丼/.test(text))seconds=180;return seconds*quantity}

function foodMinutes(item: EstimateItem) {
  const configured = Number(item.preparationMinutes);
  const optionDelta = Array.isArray(item.options) ? item.options.reduce((sum, option) => sum + (Number.isFinite(Number(option?.preparationMinutesDelta)) ? Number(option.preparationMinutesDelta) : 0), 0) : 0;
  const text = `${item.productCode ?? ""} ${item.name ?? ""}`.toLowerCase();
  if (/カルボナーラ.*パスタ|パスタ.*カルボナーラ|carbonara.*pasta/.test(text)) return 9+optionDelta;
  if (Number.isFinite(configured) && configured > 0) return Math.max(1, configured + optionDelta);
  if (/ほうとう|houtou/.test(text)) return 15;
  if (/うどん|udon/.test(text)) return 10;
  if (/つけ麺|tsukemen|tukemen/.test(text)) return 10;
  if (/唐揚げ丼|からあげ丼|karaage.*don/.test(text)) return 8;
  if (/唐揚げ|からあげ|フライドチキン|チーズドッグ|たこ焼|ポテト|karaage|fried|cheese.*dog|takoyaki|poteto/.test(text)) return 8;
  if (/角煮丼|kakuni/.test(text)) return 8;
  if (/カツ丼|katsu/.test(text)) return 7;
  if (/かき氷|kakigori/.test(text)) return 6;
  if (/磯辺|isobe/.test(text)) return 5;
  if (/卵かけ|tkg|ライス|rice/.test(text)) return 4;
  return 10;
}

export function calculateSchedule(input: EstimateInput, drinkWorkMinutes = 5, liveFoodOrders = 0,liveMicrowaveSeconds=0) {
  const calculatedAt = Date.now(), orderedAt = input.orderedAt ? Date.parse(input.orderedAt) : calculatedAt;
  const foods = input.items.filter((item) => /かき氷|kakigori/i.test(`${item.productCode ?? ""} ${item.name ?? ""}`) || item.department === "FOOD" || item.department == null && !/drink|soft|alcohol|cafe|ドリンク|コーヒー|ジュース|茶/i.test(`${item.productCode ?? ""} ${item.name ?? ""}`));
  const drinks = input.items.filter((item) => !foods.includes(item));
  const individual = foods.map((item) => foodMinutes(item));
  const longest = individual.length ? Math.max(...individual) : 0;
  const itemCount = foods.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
  const queue = input.kitchen?.activeFoodOrders ?? liveFoodOrders;
  const parallelPenalty = Math.max(0, itemCount - 1) * 2;
  const queuePenalty = Math.min(20, queue * 2);
  const requestedMicrowaveSeconds=foods.reduce((sum,item)=>sum+microwaveSeconds(item),0),activeMicrowaveSeconds=Math.max(0,input.kitchen?.activeMicrowaveSeconds??liveMicrowaveSeconds),microwaveSerialMinutes=Math.ceil((requestedMicrowaveSeconds+activeMicrowaveSeconds)/60),assemblyMinutes=requestedMicrowaveSeconds>0?2:0;
  const equipmentPenalty = Math.max(0, input.kitchen?.fryerBatches ?? 0) * 2 + Math.max(0, (input.kitchen?.microwaveContainers ?? 0) - 1) * 2;
  const criticalPath=Math.max(longest,microwaveSerialMinutes+assemblyMinutes);
  const foodEstimatedMinutes = foods.length ? criticalPath + parallelPenalty + queuePenalty + equipmentPenalty : null;
  const foodReadyAt = foodEstimatedMinutes == null ? null : orderedAt + foodEstimatedMinutes * 60_000;
  const servingMode: ServingMode = input.servingMode ?? (foods.length && drinks.length ? "WITH_FOOD" : "AS_SOON_AS_POSSIBLE");
  let drinkStartAt: number | null = null, drinkReadyAt: number | null = null;
  if (drinks.length) {
    const independentReadyAt = orderedAt + drinkWorkMinutes * 60_000;
    if (servingMode === "WITH_FOOD" && foodReadyAt) { drinkStartAt = Math.max(orderedAt, foodReadyAt - drinkWorkMinutes * 60_000); drinkReadyAt = foodReadyAt; }
    else { drinkStartAt = orderedAt; drinkReadyAt = independentReadyAt; }
  }
  return { calculatedAt, foodEstimatedMinutes, foodReadyAt, drinkWorkMinutes, drinkStartAt, drinkReadyAt, servingMode, inputs: { liveFoodOrders: queue, itemCount, longestItemMinutes: longest, parallelPenalty, queuePenalty, equipmentPenalty,requestedMicrowaveSeconds,activeMicrowaveSeconds,microwaveSerialMinutes,assemblyMinutes,microwaveCount:1 } };
}

export function iso(value: number | null) { return value == null ? null : new Date(value).toISOString(); }
