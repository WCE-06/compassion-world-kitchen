"use client";

import { useMemo, useState } from "react";

type KitchenStatus = "ACCEPTED" | "COOKING" | "READY" | "PICKED_UP";
type Filter = "ALL" | KitchenStatus;
type Order = {
  id: string;
  number: string;
  status: KitchenStatus;
  channel: "MOBILE" | "SELF_REGISTER";
  payment: "STRIPE" | "STORE";
  receivedAt: string;
  pickupAt: string;
  promisedAt: string;
  note?: string;
  items: { name: string; quantity: number; options?: string[] }[];
};

const initialOrders: Order[] = [
  {
    id: "ord-1842", number: "A-1842", status: "ACCEPTED", channel: "MOBILE", payment: "STRIPE",
    receivedAt: "10:36", pickupAt: "10:50", promisedAt: "10:49",
    items: [
      { name: "季節野菜のカレー", quantity: 2, options: ["ごはん少なめ", "温泉卵 +¥120"] },
      { name: "自家製ジンジャーエール", quantity: 1, options: ["氷なし"] },
    ],
    note: "1つは辛さ控えめでお願いします",
  },
  {
    id: "ord-1841", number: "A-1841", status: "COOKING", channel: "SELF_REGISTER", payment: "STORE",
    receivedAt: "10:31", pickupAt: "でき次第", promisedAt: "10:43",
    items: [
      { name: "発酵デリプレート", quantity: 1, options: ["パンに変更 +¥80"] },
      { name: "ドリップコーヒー", quantity: 1, options: ["HOT", "ミルク別添え"] },
    ],
  },
  {
    id: "ord-1839", number: "A-1839", status: "COOKING", channel: "MOBILE", payment: "STRIPE",
    receivedAt: "10:25", pickupAt: "10:40", promisedAt: "10:39",
    items: [{ name: "季節野菜のカレー", quantity: 1, options: ["大盛り +¥150"] }],
    note: "アレルギー確認済み：くるみ抜き",
  },
  {
    id: "ord-1837", number: "A-1837", status: "READY", channel: "SELF_REGISTER", payment: "STORE",
    receivedAt: "10:19", pickupAt: "でき次第", promisedAt: "10:32",
    items: [{ name: "発酵デリプレート", quantity: 2 }, { name: "ハーブティー", quantity: 2, options: ["HOT"] }],
  },
];

const statusLabel: Record<KitchenStatus, string> = {
  ACCEPTED: "未着手", COOKING: "調理中", READY: "提供待ち", PICKED_UP: "受渡済み",
};

const nextStatus: Partial<Record<KitchenStatus, KitchenStatus>> = {
  ACCEPTED: "COOKING", COOKING: "READY", READY: "PICKED_UP",
};

const nextLabel: Partial<Record<KitchenStatus, string>> = {
  ACCEPTED: "調理を開始", COOKING: "提供可能にする", READY: "受け渡し完了",
};

export default function KitchenBoard() {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<Filter>("ALL");
  const now = "10:38";
  const visible = useMemo(() => orders.filter((o) => filter === "ALL" ? o.status !== "PICKED_UP" : o.status === filter), [orders, filter]);
  const counts = (status: KitchenStatus) => orders.filter((o) => o.status === status).length;

  function advance(order: Order) {
    const status = nextStatus[order.status];
    if (!status) return;
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
  }

  return (
    <main className="board-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">CW</span><div><b>COMPASSION WORLD</b><span>KITCHEN MONITOR</span></div></div>
        <div className="connection"><span className="pulse" /> 接続中 <b>{now}</b></div>
      </header>

      <section className="summary" aria-label="注文サマリー">
        <div><span>未着手</span><strong>{counts("ACCEPTED")}</strong></div>
        <div><span>調理中</span><strong>{counts("COOKING")}</strong></div>
        <div><span>提供待ち</span><strong className="ready-number">{counts("READY")}</strong></div>
        <div className="summary-note"><span>最も早い受取</span><strong>あと 2分</strong></div>
      </section>

      <nav className="filters" aria-label="注文の絞り込み">
        {(["ALL", "ACCEPTED", "COOKING", "READY"] as Filter[]).map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {item === "ALL" ? "すべて" : statusLabel[item]}
          </button>
        ))}
        <span className="sync-note">最終同期 たった今</span>
      </nav>

      <section className="order-grid" aria-live="polite">
        {visible.map((order) => (
          <article className={`order-card status-${order.status.toLowerCase()}`} key={order.id}>
            <div className="card-head">
              <div><span className="order-kicker">注文番号</span><h2>{order.number}</h2></div>
              <span className="status-chip">{statusLabel[order.status]}</span>
            </div>
            <div className="timing">
              <div><span>受取希望</span><strong>{order.pickupAt}</strong></div>
              <div><span>提供予定</span><strong>{order.promisedAt}</strong></div>
            </div>
            <div className="meta-row">
              <span>{order.channel === "MOBILE" ? "モバイル" : "セルフレジ"}</span>
              <span>{order.payment === "STRIPE" ? "事前決済済" : "店頭決済済"}</span>
              <span>受付 {order.receivedAt}</span>
            </div>
            <div className="items">
              {order.items.map((item, index) => (
                <div className="item" key={`${order.id}-${index}`}>
                  <strong className="quantity">{item.quantity}</strong>
                  <div><h3>{item.name}</h3>{item.options?.map((option) => <p key={option}>↳ {option}</p>)}</div>
                </div>
              ))}
            </div>
            {order.note && <div className="note"><b>調理指示</b>{order.note}</div>}
            {nextStatus[order.status] && <button className="advance" onClick={() => advance(order)}>{nextLabel[order.status]} <span>→</span></button>}
          </article>
        ))}
      </section>
    </main>
  );
}
