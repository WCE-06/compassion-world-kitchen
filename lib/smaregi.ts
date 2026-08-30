import { env } from "cloudflare:workers";

type SmaregiRuntime = {
  SMAREGI_CONTRACT_ID?: string;
  SMAREGI_CLIENT_ID?: string;
  SMAREGI_CLIENT_SECRET?: string;
  SMAREGI_ENV?: "sandbox" | "production";
};

export type SmaregiTransactionDetail = {
  transactionDetailId: string;
  transactionDetailDivision: string;
  productId?: string;
  productCode: string;
  productName: string;
  salesPrice?: string;
  quantity: string;
  memo?: string;
};

export type SmaregiTransaction = {
  transactionHeadId: string;
  transactionDateTime: string;
  updDateTime: string;
  transactionHeadDivision: string;
  cancelDivision: string;
  terminalId?: string;
  total?: string;
  details?: SmaregiTransactionDetail[];
};

export type SmaregiProduct = {
  productId: string;
  categoryId: string;
  productCode: string;
  productName: string;
  price: string;
  displayFlag: string;
  division: string;
  taxDivision?: "0" | "1";
  displaySequence?: string;
};

export type SmaregiCategory = {
  categoryId: string;
  categoryName: string;
  displaySequence?: string;
};

export type SmaregiProductInput = {
  categoryId: string;
  productCode: string;
  productName: string;
  price: number;
  taxDivision?: "0" | "1";
  soldOut?: boolean;
};

const cachedTokens = new Map<string, { value: string; expiresAt: number }>();

function config() {
  const runtime = env as unknown as SmaregiRuntime;
  const contractId = runtime.SMAREGI_CONTRACT_ID;
  const clientId = runtime.SMAREGI_CLIENT_ID;
  const clientSecret = runtime.SMAREGI_CLIENT_SECRET;
  if (!contractId || !clientId || !clientSecret) throw new Error("SMAREGI_NOT_CONFIGURED");
  const production = runtime.SMAREGI_ENV === "production";
  return {
    contractId,
    clientId,
    clientSecret,
    identityBase: production ? "https://id.smaregi.jp" : "https://id.smaregi.dev",
    apiBase: production ? "https://api.smaregi.jp" : "https://api.smaregi.dev",
    environment: production ? "production" : "sandbox",
  } as const;
}

async function accessToken(scope = "pos.products:read pos.products:write") {
  const cachedToken = cachedTokens.get(scope);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const current = config();
  const body = new URLSearchParams({ grant_type: "client_credentials", scope });
  const response = await fetch(`${current.identityBase}/app/${current.contractId}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${current.clientId}:${current.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) throw new Error(`SMAREGI_TOKEN_ERROR:${response.status}`);
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("SMAREGI_TOKEN_INVALID");
  cachedTokens.set(scope, { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000 });
  return result.access_token;
}

async function smaregiFetch<T>(path: string, init?: RequestInit, scope?: string): Promise<T> {
  const current = config();
  const response = await fetch(`${current.apiBase}/${current.contractId}/pos${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(scope)}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SMAREGI_API_ERROR:${response.status}:${detail.slice(0, 160)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getSmaregiTransactions(updatedFrom: Date, updatedTo: Date) {
  const query = new URLSearchParams({
    limit: "100",
    sort: "updDateTime:asc",
    "upd_date_time-from": updatedFrom.toISOString(),
    "upd_date_time-to": updatedTo.toISOString(),
    transaction_head_division: "1",
    with_details: "summary",
  });
  return smaregiFetch<SmaregiTransaction[]>(`/transactions?${query}`, undefined, "pos.transactions:read");
}

export async function getSmaregiCatalog() {
  const [products, categories] = await Promise.all([
    smaregiFetch<SmaregiProduct[]>("/products?limit=1000&sort=displaySequence:asc"),
    smaregiFetch<SmaregiCategory[]>("/categories?limit=1000&sort=displaySequence:asc"),
  ]);
  return { products, categories, environment: config().environment };
}

function productPayload(input: SmaregiProductInput) {
  if (!input.categoryId || !input.productCode.trim() || !input.productName.trim() || !Number.isInteger(input.price) || input.price <= 0) {
    throw new Error("INVALID_PRODUCT_INPUT");
  }
  return {
    categoryId: input.categoryId,
    productCode: input.productCode.trim(),
    productName: input.productName.trim(),
    taxDivision: input.taxDivision ?? "0",
    productPriceDivision: "1",
    price: String(input.price),
    displayFlag: input.soldOut ? "0" : "1",
    division: "0",
    salesDivision: "0",
  };
}

export function createSmaregiProduct(input: SmaregiProductInput) {
  return smaregiFetch<SmaregiProduct>("/products", { method: "POST", body: JSON.stringify(productPayload(input)) });
}

export function updateSmaregiProduct(productId: string, input: SmaregiProductInput) {
  if (!/^\d{1,15}$/.test(productId)) throw new Error("INVALID_PRODUCT_ID");
  return smaregiFetch<SmaregiProduct>(`/products/${productId}`, { method: "PATCH", body: JSON.stringify(productPayload(input)) });
}

export function updateSmaregiDisplaySequence(productId: string, displaySequence: number) {
  if (!/^\d{1,15}$/.test(productId) || !Number.isInteger(displaySequence) || displaySequence < 0) throw new Error("INVALID_DISPLAY_SEQUENCE");
  return smaregiFetch<SmaregiProduct>(`/products/${productId}`, { method: "PATCH", body: JSON.stringify({ displaySequence: String(displaySequence) }) });
}

export function updateSmaregiSoldOut(productId:string,soldOut:boolean){
  if(!/^\d{1,15}$/.test(productId))throw new Error("INVALID_PRODUCT_ID");
  return smaregiFetch<SmaregiProduct>(`/products/${productId}`,{method:"PATCH",body:JSON.stringify({displayFlag:soldOut?"0":"1"})});
}
