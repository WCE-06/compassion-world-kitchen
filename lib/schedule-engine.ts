export type ServingMode = "WITH_FOOD" | "AS_SOON_AS_POSSIBLE" | "DRINK_FIRST";
export type EstimateItem = { productId?: string; productCode?: string; name?: string; quantity: number; department?: "FOOD" | "DRINK"; preparationMinutes?: number; options?: { preparationMinutesDelta?: number }[] };
export type EstimateInput = { requestId: string; orderId?: string; items: EstimateItem[]; orderedAt?: string; servingMode?: ServingMode; serviceType?: "EAT_IN" | "TAKEOUT"; kitchen?: { activeFoodOrders?: number; fryerBatches?: number; microwaveContainers?: number } };

export const CALCULATION_VERSION = "aok-v1.0";

function foodMinutes(item: EstimateItem) {
  const configured = Number(item.preparationMinutes);
  const optionDelta = Array.isArray(item.options) ? item.options.reduce((sum, option) => sum + (Number.isFinite(Number(option?.preparationMinutesDelta)) ? Number(option.preparationMinutesDelta) : 0), 0) : 0;
  if (Number.isFinite(configured) && configured > 0) return Math.max(1, configured + optionDelta);
  const text = `${item.productCode ?? ""} ${item.name ?? ""}`.toLowerCase();
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

export function calculateSchedule(input: EstimateInput, drinkWorkMinutes = 5, liveFoodOrders = 0) {
  const calculatedAt = Date.now(), orderedAt = input.orderedAt ? Date.parse(input.orderedAt) : calculatedAt;
  const foods = input.items.filter((item) => item.department === "FOOD" || item.department == null && !/drink|soft|alcohol|cafe|ドリンク|コーヒー|ジュース|茶/i.test(`${item.productCode ?? ""} ${item.name ?? ""}`));
  const drinks = input.items.filter((item) => !foods.includes(item));
  const individual = foods.map((item) => foodMinutes(item));
  const longest = individual.length ? Math.max(...individual) : 0;
  const itemCount = foods.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
  const queue = input.kitchen?.activeFoodOrders ?? liveFoodOrders;
  const parallelPenalty = Math.max(0, itemCount - 2) * 2;
  const queuePenalty = Math.min(20, queue * 2);
  const equipmentPenalty = Math.max(0, input.kitchen?.fryerBatches ?? 0) * 2 + Math.max(0, (input.kitchen?.microwaveContainers ?? 0) - 2) * 2;
  const foodEstimatedMinutes = foods.length ? longest + parallelPenalty + queuePenalty + equipmentPenalty : null;
  const foodReadyAt = foodEstimatedMinutes == null ? null : orderedAt + foodEstimatedMinutes * 60_000;
  const servingMode: ServingMode = input.servingMode ?? (foods.length && drinks.length ? "WITH_FOOD" : "AS_SOON_AS_POSSIBLE");
  let drinkStartAt: number | null = null, drinkReadyAt: number | null = null;
  if (drinks.length) {
    const independentReadyAt = orderedAt + drinkWorkMinutes * 60_000;
    if (servingMode === "WITH_FOOD" && foodReadyAt) { drinkStartAt = Math.max(orderedAt, foodReadyAt - drinkWorkMinutes * 60_000); drinkReadyAt = foodReadyAt; }
    else { drinkStartAt = orderedAt; drinkReadyAt = independentReadyAt; }
  }
  return { calculatedAt, foodEstimatedMinutes, foodReadyAt, drinkWorkMinutes, drinkStartAt, drinkReadyAt, servingMode, inputs: { liveFoodOrders: queue, itemCount, longestItemMinutes: longest, parallelPenalty, queuePenalty, equipmentPenalty } };
}

export function iso(value: number | null) { return value == null ? null : new Date(value).toISOString(); }
