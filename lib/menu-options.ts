import { scheduleDb } from "@/lib/schedule-store";

export type MenuOptionChoice = { id: string; name: string; priceDelta: number; preparationMinutesDelta: number; displaySequence: number; enabled: boolean };
export type MenuOptionGroup = { id: string; productCode: string; name: string; type: "single" | "multiple"; required: boolean; minChoices: number; maxChoices: number; displaySequence: number; enabled: boolean; choices: MenuOptionChoice[] };

type GroupRow = { id:string; productCode:string; name:string; selectionType:string; required:number; minChoices:number; maxChoices:number; displaySequence:number; enabled:number };
type ChoiceRow = { id:string; groupId:string; name:string; priceDelta:number; preparationMinutesDelta:number; displaySequence:number; enabled:number };

export async function getMenuOptionGroups(productCode?: string, includeDisabled = false) {
  const db = await scheduleDb();
  const where = `${productCode ? " WHERE product_code = ?" : ""}${includeDisabled ? "" : productCode ? " AND enabled = 1" : " WHERE enabled = 1"}`;
  const query = db.prepare(`SELECT id,product_code AS productCode,name,selection_type AS selectionType,required,min_choices AS minChoices,max_choices AS maxChoices,display_sequence AS displaySequence,enabled FROM menu_option_groups${where} ORDER BY product_code,display_sequence,id`);
  const groups = await (productCode ? query.bind(productCode) : query).all<GroupRow>();
  const choices = await db.prepare(`SELECT id,group_id AS groupId,name,price_delta AS priceDelta,preparation_minutes_delta AS preparationMinutesDelta,display_sequence AS displaySequence,enabled FROM menu_option_choices${includeDisabled ? "" : " WHERE enabled = 1"} ORDER BY group_id,display_sequence,id`).all<ChoiceRow>();
  const byGroup = new Map<string, MenuOptionChoice[]>();
  for (const row of choices.results) {
    const list = byGroup.get(row.groupId) ?? [];
    list.push({ ...row, enabled: Boolean(row.enabled) }); byGroup.set(row.groupId, list);
  }
  return groups.results.map((row) => ({ id:row.id, productCode:row.productCode, name:row.name, type:row.selectionType === "multiple" ? "multiple" as const : "single" as const, required:Boolean(row.required), minChoices:row.minChoices, maxChoices:row.maxChoices, displaySequence:row.displaySequence, enabled:Boolean(row.enabled), choices:byGroup.get(row.id) ?? [] }));
}

export async function replaceMenuOptionGroups(productCode: string, groups: MenuOptionGroup[]) {
  const db = await scheduleDb(); const now = Date.now();
  const old = await db.prepare("SELECT id FROM menu_option_groups WHERE product_code = ?").bind(productCode).all<{id:string}>();
  const statements = old.results.map((row) => db.prepare("DELETE FROM menu_option_choices WHERE group_id = ?").bind(row.id));
  statements.push(db.prepare("DELETE FROM menu_option_groups WHERE product_code = ?").bind(productCode));
  groups.forEach((group, groupIndex) => {
    statements.push(db.prepare("INSERT INTO menu_option_groups(id,product_code,name,selection_type,required,min_choices,max_choices,display_sequence,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(group.id,productCode,group.name,group.type,group.required ? 1 : 0,group.minChoices,group.maxChoices,(groupIndex + 1) * 10,group.enabled ? 1 : 0,now));
    group.choices.forEach((choice, choiceIndex) => statements.push(db.prepare("INSERT INTO menu_option_choices(id,group_id,name,price_delta,preparation_minutes_delta,display_sequence,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(choice.id,group.id,choice.name,choice.priceDelta,choice.preparationMinutesDelta,(choiceIndex + 1) * 10,choice.enabled ? 1 : 0,now)));
  });
  await db.batch(statements); return getMenuOptionGroups(productCode, true);
}
