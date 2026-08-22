"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MenuManager from "./menu-manager";

type Department = "FOOD" | "DRINK";
type Status = "ACCEPTED" | "COOKING" | "READY" | "CALLED" | "PICKED_UP" | "CANCELLED";
type Fulfillment = { id: string; orderId: string; department: Department; callNumber: number; status: Status; readyAt: number | null; calledAt: number | null; updatedAt: number; items: { name: string; quantity: number; options?: string[] }[] };
type Screen = "ORDERS" | "CALL_MONITOR" | "MENU";

const statusLabel: Record<Status, string> = { ACCEPTED: "未着手", COOKING: "調理中", READY: "完成", CALLED: "呼出中", PICKED_UP: "受渡済み", CANCELLED: "取消" };
const actionByStatus: Partial<Record<Status, { action: "START" | "READY" | "CALL" | "PICKUP"; label: string }>> = {
  ACCEPTED: { action: "START", label: "調理を開始" }, COOKING: { action: "READY", label: "完成" }, READY: { action: "CALL", label: "呼出" }, CALLED: { action: "PICKUP", label: "受渡完了" },
};

export default function KitchenBoard() {
  const [screen, setScreen] = useState<Screen>("ORDERS");
  const [department, setDepartment] = useState<Department>("FOOD");
  const [data, setData] = useState<Record<Department, Fulfillment[]>>({ FOOD: [], DRINK: [] });
  const [loading, setLoading] = useState(true), [message, setMessage] = useState(""), [updating, setUpdating] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null), previousCalled = useRef(new Set<string>());

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [foodResponse, drinkResponse] = await Promise.all(["FOOD", "DRINK"].map((value) => fetch(`/api/v1/kitchen/fulfillments?department=${value}`, { cache: "no-store" })));
      const [food, drink] = await Promise.all([foodResponse.json(), drinkResponse.json()]);
      if (!foodResponse.ok || !drinkResponse.ok) throw new Error(food.error ?? drink.error ?? "注文を取得できませんでした");
      const next = { FOOD: food.fulfillments ?? [], DRINK: drink.fulfillments ?? [] } as Record<Department, Fulfillment[]>;
      const called = new Set([...next.FOOD, ...next.DRINK].filter((item) => item.status === "CALLED").map((item) => item.id));
      if ([...called].some((id) => !previousCalled.current.has(id)) && previousCalled.current.size > 0) playChime();
      previousCalled.current = called; setData(next); setLastSync(new Date()); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "注文情報へ接続できませんでした"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 4000); return () => window.clearInterval(timer); }, []);

  async function act(item: Fulfillment, action: "START" | "READY" | "CALL" | "PICKUP") {
    setUpdating(item.id); setMessage("");
    try {
      const response = await fetch("/api/v1/kitchen/fulfillments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentId: item.id, action }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "状態を更新できませんでした");
      if (action === "CALL") playChime(); await load(true);
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "状態を更新できませんでした"); }
    finally { setUpdating(null); }
  }

  const current = data[department];
  const called = useMemo(() => [...data.FOOD, ...data.DRINK].filter((item) => item.status === "CALLED").sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)), [data]);
  const count = (status: Status) => [...data.FOOD, ...data.DRINK].filter((item) => item.status === status).length;

  return <main className={`board-shell ${screen === "CALL_MONITOR" ? "call-screen" : ""}`}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">CW</span><div><b>COMPASSION WORLD</b><span>KITCHEN MONITOR</span></div></div>
      <nav className="main-nav" aria-label="管理画面"><button className={screen === "ORDERS" ? "active" : ""} onClick={() => setScreen("ORDERS")}>注文管理</button><button className={screen === "CALL_MONITOR" ? "active" : ""} onClick={() => setScreen("CALL_MONITOR")}>呼出モニター</button><button className={screen === "MENU" ? "active" : ""} onClick={() => setScreen("MENU")}>メニュー管理</button></nav>
      <div className="connection"><span className="pulse" /> {message ? "接続確認中" : "接続中"} <b>{lastSync?.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}</b></div>
    </header>

    {screen === "MENU" ? <MenuManager /> : screen === "CALL_MONITOR" ? <section className="customer-call-monitor">
      <header><p>COMPASSION WORLD</p><h1>できあがりました</h1><span>番号をご確認のうえ、受取カウンターへお越しください</span></header>
      {called.length ? <div className="called-grid">{called.map((item) => <article className={item.department.toLowerCase()} key={item.id}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong><button onClick={() => { playChime(); void act(item, "CALL"); }}>♩ 再呼出</button></article>)}</div> : <div className="call-empty"><b>ただいま準備中です</b><span>完成した番号がここに表示されます</span></div>}
    </section> : <>
      <section className="summary" aria-label="注文サマリー"><div><span>未着手</span><strong>{count("ACCEPTED")}</strong></div><div><span>調理中</span><strong>{count("COOKING")}</strong></div><div><span>完成</span><strong className="ready-number">{count("READY")}</strong></div><div><span>呼出中</span><strong>{count("CALLED")}</strong></div></section>
      <div className="department-tabs"><button className={department === "FOOD" ? "active food" : ""} onClick={() => setDepartment("FOOD")}>フード <b>{data.FOOD.length}</b></button><button className={department === "DRINK" ? "active drink" : ""} onClick={() => setDepartment("DRINK")}>ドリンク <b>{data.DRINK.length}</b></button><span>4秒ごとに自動更新</span></div>
      {message && <p className="form-notice error">{message}</p>}
      <section className="order-grid" aria-live="polite">
        {loading && <div className="empty-menu">注文を取得しています…</div>}
        {!loading && !current.length && <div className="empty-menu">現在、{department === "FOOD" ? "フード" : "ドリンク"}の待ち注文はありません。</div>}
        {current.map((item) => { const action = actionByStatus[item.status]; return <article className={`order-card status-${item.status.toLowerCase()} department-${item.department.toLowerCase()}`} key={item.id}>
          <div className="card-head"><div><span className="order-kicker">{item.department === "FOOD" ? "フード呼出番号" : "ドリンク呼出番号"}</span><h2>{String(item.callNumber).padStart(3, "0")}</h2></div><span className="status-chip">{statusLabel[item.status]}</span></div>
          <div className="meta-row"><span>{item.department === "FOOD" ? "フード" : "ドリンク"}</span><span>決済済み</span><span>{elapsed(item.updatedAt)}</span></div>
          <div className="items">{item.items.map((product, index) => <div className="item" key={`${item.id}-${index}`}><strong className="quantity">{product.quantity}</strong><div><h3>{product.name}</h3>{product.options?.map((option) => <p key={option}>↳ {option}</p>)}</div></div>)}</div>
          {action && <button className="advance" disabled={updating === item.id} onClick={() => void act(item, action.action)}>{updating === item.id ? "更新中…" : action.label} <span>→</span></button>}
        </article>; })}
      </section>
    </>}
  </main>;
}

function elapsed(time: number) { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? "たった今" : `${minutes}分経過`; }
function friendly(message: string) { if (message.includes("UNAUTHORIZED")) return "会員証システムとの認証設定を確認してください"; if (message.includes("UNAVAILABLE")) return "会員証システムへ接続できません"; if (message.includes("INVALID_STATUS_TRANSITION")) return "別の端末で状態が更新されました"; return message; }
function playChime() { try { const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const context = new AudioContextClass(); const oscillator = context.createOscillator(), gain = context.createGain(); oscillator.type = "sine"; oscillator.frequency.setValueAtTime(784, context.currentTime); oscillator.frequency.setValueAtTime(1046, context.currentTime + .18); gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .48); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .5); } catch { /* 音声未許可時は表示のみ継続 */ } }
