"use client";

import { useState } from "react";

type Item = {
  name: string;
  department: "FOOD" | "DRINK";
  preparationMinutes: number;
  quantity: number;
};

const presets: Omit<Item, "quantity">[] = [
  { name: "和風からあげ丼", department: "FOOD", preparationMinutes: 8 },
  { name: "フリフリポテト", department: "FOOD", preparationMinutes: 8 },
  { name: "角煮丼", department: "FOOD", preparationMinutes: 8 },
  { name: "カルボナーラパスタ", department: "FOOD", preparationMinutes: 9 },
  { name: "濃厚魚介つけ麺", department: "FOOD", preparationMinutes: 10 },
  { name: "きつねうどん", department: "FOOD", preparationMinutes: 10 },
  { name: "ほうとう", department: "FOOD", preparationMinutes: 15 },
  { name: "アイスコーヒー", department: "DRINK", preparationMinutes: 5 },
];

async function responseBody(response: Response) {
  return await response.json().catch(() => ({})) as {
    orderNumber?: string;
    deleted?: number;
    error?: string;
  };
}

export default function TestOrderPanel({ onCreated }: { onCreated: () => void }) {
  const [items, setItems] = useState<Item[]>(presets.map((item) => ({ ...item, quantity: 0 })));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const update = (index: number, quantity: number) =>
    setItems((rows) => rows.map((row, i) =>
      i === index ? { ...row, quantity: Math.max(0, Math.min(9, quantity)) } : row
    ));

  async function create() {
    const selected = items.filter((item) => item.quantity > 0);
    if (!selected.length) {
      setMessage("テスト商品を1つ以上選んでください");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/v1/kitchen/test-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selected }),
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error ?? "CREATE_FAILED");
      setMessage(`${body.orderNumber ?? "テスト注文"}を投入しました`);
      onCreated();
    } catch {
      setMessage("テスト注文を作成できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setClearing(true);
    setMessage("テスト注文を削除しています…");
    try {
      const response = await fetch("/api/v1/kitchen/test-orders", {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.error ?? `DELETE_FAILED_${response.status}`);
      setMessage(`テスト注文を${body.deleted ?? 0}件削除しました`);
      setConfirmClear(false);
      onCreated();
    } catch (error) {
      const reason = error instanceof Error && error.message.includes("UNAUTHORIZED")
        ? "認証設定を確認してください"
        : "もう一度お試しください";
      setMessage(`削除できませんでした。 ${reason}`);
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="test-order-workspace">
      <div className="workspace-head">
        <div>
          <p>FREE TEST ORDER</p>
          <h1>決済なしテスト注文</h1>
          <small>売上・ポイント・スマレジ取引には含まれません。商品1個ごとに呼出番号を発行します。</small>
        </div>
        <div className="clear-test-actions">
          {confirmClear && <button className="cancel-clear" disabled={clearing} onClick={() => setConfirmClear(false)}>やめる</button>}
          <button className={`clear-tests ${confirmClear ? "confirm" : ""}`} disabled={clearing || saving} onClick={() => confirmClear ? void clear() : setConfirmClear(true)}>
            {clearing ? "削除中…" : confirmClear ? "本当にすべて削除する" : "テスト注文を一括削除"}
          </button>
          {confirmClear && <small>テスト注文だけを削除します。通常注文は残ります。</small>}
        </div>
      </div>
      <div className="test-product-grid">
        {items.map((item, index) => (
          <article key={item.name}>
            <span>{item.department === "FOOD" ? "フード" : "ドリンク"}</span>
            <h2>{item.name}</h2>
            <small>目安 {item.preparationMinutes}分</small>
            <div>
              <button onClick={() => update(index, item.quantity - 1)}>−</button>
              <b>{item.quantity}</b>
              <button onClick={() => update(index, item.quantity + 1)}>＋</button>
            </div>
          </article>
        ))}
      </div>
      <footer>
        <span aria-live="polite">{message}</span>
        <button disabled={saving || clearing} onClick={() => void create()}>
          {saving ? "投入中…" : "選択したテスト注文を投入"}
        </button>
      </footer>
    </section>
  );
}
