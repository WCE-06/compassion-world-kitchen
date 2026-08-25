"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MenuManager from "./menu-manager";
import CookingMaster from "./cooking-master";
import BusinessHoursManager from "./business-hours-manager";
import TestOrderPanel from "./test-order-panel";

type Department = "FOOD" | "DRINK";
type Status = "ACCEPTED" | "COOKING" | "READY" | "CALLED" | "PICKED_UP" | "CANCELLED";
type Fulfillment = { id: string; orderId: string; department: Department; callNumber: number; status: Status; currentStep?:number;totalSteps?:number;isTest?:boolean;readyAt: number | null; estimatedReadyAt?: number | null; calledAt: number | null; updatedAt: number; items: { name: string; quantity: number; options?: string[] }[] };
type WorkInstruction = { headline: string; equipment?: string; steps: string[] };
type OptimizedTask = { id:string; title:string; detail:string; equipment:string; calls:string[]; minutes:number };
type Screen = "ORDERS" | "CALL_MONITOR" | "HISTORY" | "ANNOUNCEMENTS" | "HOURS" | "MENU" | "MASTER" | "TEST";

const statusLabel: Record<Status, string> = { ACCEPTED: "未着手", COOKING: "調理中", READY: "完成", CALLED: "呼出中", PICKED_UP: "受渡済み", CANCELLED: "取消" };
const actionByStatus: Partial<Record<Status, { action: "START" | "STEP" | "CALL" | "PICKUP"; label: string }>> = {
  ACCEPTED: { action: "START", label: "作業を開始" }, COOKING: { action: "STEP", label: "この工程を完了" }, READY: { action: "CALL", label: "呼出" }, CALLED: { action: "PICKUP", label: "受渡完了" },
};

const OLD_BGM_URL = "https://wce-06.github.io/liff-entry/audio/bgm.mp3";
const ENTRY_BGM_BASE_VOLUME = 0.62;
const BGM_DUCK_VOLUME = 0.04;

function scheduledVolume() {
  return entryMasterVolume();
}

function entryMasterVolume() { const hour = new Date().getHours(); if (hour < 2) return 0.30; if (hour < 8) return 0.01; if (hour < 10) return 0.30; if (hour < 11) return 0.50; if (hour < 18) return 1; if (hour < 21) return 0.75; return 0.50; }
function entryBgmVolume() { return ENTRY_BGM_BASE_VOLUME * entryMasterVolume(); }
function percentLabel(value: number) { const percent = value * 100; return percent < 0.001 ? percent.toFixed(5) : percent < 1 ? percent.toFixed(2) : `${Math.round(percent)}`; }
function volumeLabel() { return `BGM ${percentLabel(entryBgmVolume())}%・呼出 ${percentLabel(scheduledVolume())}%`; }

export default function KitchenBoard({ displayOnly = false }: { displayOnly?: boolean }) {
  const [screen, setScreen] = useState<Screen>(displayOnly ? "CALL_MONITOR" : "ORDERS");
  const [department, setDepartment] = useState<Department | "ALL">("ALL");
  const [data, setData] = useState<Record<Department, Fulfillment[]>>({ FOOD: [], DRINK: [] });
  const [history, setHistory] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true), [message, setMessage] = useState(""), [updating, setUpdating] = useState<string | null>(null);
  const [optimizerDone,setOptimizerDone]=useState<Set<string>>(()=>new Set());
  const [lastSync, setLastSync] = useState<Date | null>(null), previousCalled = useRef(new Set<string>()), calledInitialized = useRef(false), knownOrders = useRef(new Set<string>()), ordersInitialized = useRef(false);
  const [audioEnabled, setAudioEnabled] = useState(false), [bgmEnabled, setBgmEnabled] = useState(true), [testingFull, setTestingFull] = useState(false), [audioStatus, setAudioStatus] = useState(`音声は停止中です・${volumeLabel()}`);
  const bgmRef = useRef<HTMLAudioElement | null>(null), bgmContextRef = useRef<AudioContext | null>(null), bgmGainRef = useRef<GainNode | null>(null), bgmSourceRef = useRef<MediaElementAudioSourceNode | null>(null), audioQueue = useRef(Promise.resolve()), audioEnabledRef = useRef(false), bgmEnabledRef = useRef(true);

  function bgmVolume() {
    return entryBgmVolume();
  }

  function createBgm() {
    const audio = new Audio(); audio.crossOrigin = "anonymous"; audio.src = OLD_BGM_URL; audio.loop = true; audio.preload = "auto"; return audio;
  }

  async function prepareBgm(audio: HTMLAudioElement) {
    if (!("AudioContext" in window) && !("webkitAudioContext" in window)) { audio.volume = bgmVolume(); return; }
    if (!bgmContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass(), gain = context.createGain(), source = context.createMediaElementSource(audio);
      source.connect(gain); gain.connect(context.destination); bgmContextRef.current = context; bgmGainRef.current = gain; bgmSourceRef.current = source;
    }
    if (bgmContextRef.current.state === "suspended") await bgmContextRef.current.resume();
    setBgmVolume(bgmVolume());
  }

  function setBgmVolume(value: number) {
    if (bgmGainRef.current) { bgmGainRef.current.gain.value = value; if (bgmRef.current) bgmRef.current.volume = 1; }
    else if (bgmRef.current) bgmRef.current.volume = value;
  }

  async function enableAudio() {
    const bgm = bgmRef.current ?? createBgm(); bgmRef.current = bgm;
    try {
      await prepareBgm(bgm);
      if (bgmEnabled) await bgm.play();
      audioEnabledRef.current = true; setAudioEnabled(true); setAudioStatus(`音声・BGM 稼働中・${volumeLabel()}`);
    } catch { audioEnabledRef.current = true; setAudioEnabled(true); setAudioStatus(`呼出音声は稼働中・${volumeLabel()}`); }
  }

  function toggleBgm() {
    const next = !bgmEnabledRef.current; bgmEnabledRef.current = next; setBgmEnabled(next);
    const bgm = bgmRef.current;
    if (!bgm) return;
    if (next) { setBgmVolume(bgmVolume()); void bgm.play(); } else bgm.pause();
  }

  async function testFullVolume() {
    const bgm = bgmRef.current ?? createBgm(); bgmRef.current = bgm;
    try {
      await prepareBgm(bgm); setBgmVolume(1); setTestingFull(true); setAudioStatus("BGM 100% テスト中（3秒で自動復帰）"); await bgm.play();
      window.setTimeout(() => { setBgmVolume(bgmVolume()); setTestingFull(false); setAudioStatus(`音声・BGM 稼働中・${volumeLabel()}`); }, 3000);
    } catch { setTestingFull(false); setAudioStatus("100%テストを開始できませんでした"); }
  }

  function announce(item: Fulfillment) {
    if (!audioEnabledRef.current) { setAudioStatus("呼出があります。『音声・BGMを開始』を押してください"); return; }
    const label = `${item.department === "FOOD" ? "フード" : "ドリンク"} ${String(item.callNumber).padStart(3, "0")}`;
    audioQueue.current = audioQueue.current.then(async () => {
      setAudioStatus(`放送中：${label}`);
      if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(Math.min(bgmVolume(), BGM_DUCK_VOLUME));
      await playLegacyCall(item);
      if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(bgmVolume());
      setAudioStatus(`音声・BGM 稼働中・${volumeLabel()}`);
    });
  }

  function announceNewOrder(items: Fulfillment[]) {
    if (!audioEnabledRef.current) { setAudioStatus("新しい注文があります。『音声・BGMを開始』を押してください"); return; }
    const numbers = items.map((item) => `${item.department === "FOOD" ? "フード" : "ドリンク"}番号、${String(item.callNumber).padStart(3, "0")}番`).join("、");
    audioQueue.current = audioQueue.current.then(async () => {
      setAudioStatus(`新規注文：${numbers}`);
      if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(Math.min(bgmVolume(), BGM_DUCK_VOLUME));
      playLegacyChime(); await wait(650); await speak(`新しい注文が入りました。${numbers}。注文内容を確認してください。`);
      if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(bgmVolume());
      setAudioStatus(`音声・BGM 稼働中・${volumeLabel()}`);
    });
  }

  function broadcast(title: string, text: string) {
    if (!audioEnabledRef.current) { setAudioStatus("館内放送の前に『音声・BGMを開始』を押してください"); return; }
    audioQueue.current = audioQueue.current.then(async () => {
      setAudioStatus(`館内放送中：${title}`); if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(Math.min(bgmVolume(), BGM_DUCK_VOLUME));
      playLegacyChime(); await wait(650); await speak(text); if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(bgmVolume()); setAudioStatus(`音声・BGM 稼働中・${volumeLabel()}`);
    });
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [foodResponse, drinkResponse, foodHistoryResponse, drinkHistoryResponse] = await Promise.all([fetch("/api/v1/kitchen/units?department=FOOD", { cache: "no-store" }), fetch("/api/v1/kitchen/units?department=DRINK", { cache: "no-store" }), fetch("/api/v1/kitchen/units?department=FOOD&history=true", { cache: "no-store" }), fetch("/api/v1/kitchen/units?department=DRINK&history=true", { cache: "no-store" })]);
      const [food, drink, foodHistory, drinkHistory] = await Promise.all([foodResponse.json(), drinkResponse.json(), foodHistoryResponse.json(), drinkHistoryResponse.json()]);
      if (!foodResponse.ok || !drinkResponse.ok) throw new Error(food.error ?? drink.error ?? "注文を取得できませんでした");
      const next = { FOOD: food.units ?? [], DRINK: drink.units ?? [] } as Record<Department, Fulfillment[]>;
      const active = [...next.FOOD, ...next.DRINK];
      if (!displayOnly && ordersInitialized.current) {
        const freshOrders = new Map<string, Fulfillment[]>();
        active.filter((item) => item.status === "ACCEPTED" && !knownOrders.current.has(item.orderId)).forEach((item) => freshOrders.set(item.orderId, [...(freshOrders.get(item.orderId) ?? []), item]));
        freshOrders.forEach((items) => announceNewOrder(items));
      }
      active.forEach((item) => knownOrders.current.add(item.orderId)); ordersInitialized.current = true;
      const called = new Set([...next.FOOD, ...next.DRINK].filter((item) => item.status === "CALLED").map((item) => item.id));
      if (!displayOnly && calledInitialized.current) [...next.FOOD, ...next.DRINK].filter((item) => item.status === "CALLED" && !previousCalled.current.has(item.id)).forEach(announce);
      calledInitialized.current = true;
      previousCalled.current = called; setData(next); if (foodHistoryResponse.ok && drinkHistoryResponse.ok) setHistory([...(foodHistory.units ?? []), ...(drinkHistory.units ?? [])].sort((a: Fulfillment, b: Fulfillment) => b.updatedAt - a.updatedAt)); setLastSync(new Date()); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "注文情報へ接続できませんでした"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 4000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => { if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(bgmVolume()); }, 30000); return () => window.clearInterval(timer); }, []);

  async function act(item: Fulfillment, action: "START" | "STEP" | "CALL" | "PICKUP" | "RESTORE_CALL") {
    setUpdating(item.id); setMessage("");
    try {
      const steps=stepsForUnit(item);const response = await fetch("/api/v1/kitchen/units", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: item.id, action,totalSteps:steps.length }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "状態を更新できませんでした");
      if (action === "CALL" || action === "RESTORE_CALL") { previousCalled.current.add(item.id); announce(item); } await load(true);
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "状態を更新できませんでした"); }
    finally { setUpdating(null); }
  }

  const current = useMemo(() => (department === "ALL" ? [...data.FOOD, ...data.DRINK] : [...data[department]]).sort(orderPriority), [data, department]);
  const nextTask = current.find((item) => item.status === "READY") ?? current.find((item) => item.status === "ACCEPTED") ?? current.find((item) => item.status === "COOKING") ?? current.find((item) => item.status === "CALLED");
  const nextInstruction = nextTask ? workInstruction(nextTask) : null;
  const optimizedTasks=useMemo(()=>optimizeKitchen([...data.FOOD,...data.DRINK].filter(item=>item.status==="ACCEPTED"||item.status==="COOKING")),[data]);
  const preparing = useMemo(() => [...data.FOOD, ...data.DRINK].filter((item) => item.status === "ACCEPTED" || item.status === "COOKING" || item.status === "READY").sort((a, b) => a.updatedAt - b.updatedAt), [data]);
  const called = useMemo(() => [...data.FOOD, ...data.DRINK].filter((item) => item.status === "CALLED").sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)), [data]);
  const count = (status: Status) => [...data.FOOD, ...data.DRINK].filter((item) => item.status === status).length;

  return <main className={`board-shell ${screen === "CALL_MONITOR" ? "call-screen" : ""} ${displayOnly ? "display-only" : ""}`}>
    {!displayOnly && <header className="topbar">
      <div className="brand"><span className="brand-mark">CW</span><div><b>COMPASSION WORLD</b><span>KITCHEN MONITOR</span></div></div>
      <nav className="main-nav" aria-label="管理画面"><button className={screen === "ORDERS" ? "active" : ""} onClick={() => setScreen("ORDERS")}>注文管理</button><button className={screen === "CALL_MONITOR" ? "active" : ""} onClick={() => setScreen("CALL_MONITOR")}>呼出モニター</button><button className={screen === "HISTORY" ? "active" : ""} onClick={() => setScreen("HISTORY")}>履歴</button><button className={screen === "ANNOUNCEMENTS" ? "active" : ""} onClick={() => setScreen("ANNOUNCEMENTS")}>館内放送</button><button className={screen === "HOURS" ? "active" : ""} onClick={() => setScreen("HOURS")}>営業時間</button><button className={screen === "MASTER" ? "active" : ""} onClick={() => setScreen("MASTER")}>調理マスタ</button><button className={screen === "MENU" ? "active" : ""} onClick={() => setScreen("MENU")}>メニュー管理</button><button className={screen === "TEST" ? "active" : ""} onClick={() => setScreen("TEST")}>テスト注文</button></nav>
      <div className="connection"><span className="pulse" /> {message ? "接続確認中" : "接続中"} <b>{lastSync?.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}</b></div>
    </header>}

    {screen === "MENU" ? <MenuManager /> : screen === "MASTER" ? <CookingMaster /> : screen === "HOURS" ? <BusinessHoursManager /> : screen === "TEST" ? <TestOrderPanel onCreated={()=>{setScreen("ORDERS");void load(true)}}/> : screen === "HISTORY" ? <section className="history-workspace"><div className="workspace-head"><div><p>FULFILLMENT HISTORY</p><h1>当日の受渡履歴</h1><small>誤操作した注文を呼出中へ戻し、顧客モニターへ再表示できます</small></div></div><div className="history-list">{history.length ? history.map((item) => <article key={item.id}><div className={`history-number ${item.department.toLowerCase()}`}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div><div><b>{item.items.map((entry) => `${entry.name} ×${entry.quantity}`).join("、")}</b><span>{new Date(item.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・{item.status === "PICKED_UP" ? "受渡完了" : "取消"}</span></div>{item.status === "PICKED_UP" && <button disabled={updating === item.id} onClick={() => void act(item, "RESTORE_CALL")}>呼出中へ戻して再呼出</button>}</article>) : <p className="history-empty">本日の受渡履歴はまだありません</p>}</div></section> : screen === "ANNOUNCEMENTS" ? <section className="announcement-workspace"><div className="workspace-head"><div><p>STORE ANNOUNCEMENTS</p><h1>館内放送</h1><small>放送前に上部の「音声・BGMを開始」を押してください</small></div></div><div className="announcement-grid">{[{title:"営業開始",tag:"OPEN",text:"おはようございます。本日も、Aozora Kitchenをご利用いただき、誠にありがとうございます。ただいまより営業を開始いたします。皆さまのご利用を心よりお待ちしております。"},{title:"ラストオーダー",tag:"LAST ORDER",text:"ご来館中のお客様にご案内いたします。Aozora Kitchenは、まもなくラストオーダーのお時間となります。ご注文予定のお客様は、お早めにご利用ください。"},{title:"営業終了",tag:"CLOSE",text:"ご来館中のお客様にご案内いたします。本日のAozora Kitchenの営業は終了いたしました。本日もご利用いただき、誠にありがとうございました。"}].map((item) => <article key={item.tag}><span>{item.tag}</span><h2>{item.title}</h2><p>{item.text}</p><button onClick={() => broadcast(item.title, item.text)}>▶ この放送を流す</button></article>)}</div></section> : screen === "CALL_MONITOR" ? <section className="customer-call-monitor">
      <header><p>AOZORA KITCHEN</p><h1>ご注文状況</h1><span>お呼び出し中に番号が表示されましたら、受取カウンターへお越しください</span></header>
      <div className="call-status-board">
        <section className="call-lane preparing"><header><span>ただいま</span><h2>調理中</h2></header><div className="call-number-list">{preparing.length ? preparing.map((item) => <div className={item.department.toLowerCase()} key={item.id}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}{item.estimatedReadyAt && <em>{clock(item.estimatedReadyAt)}ごろ</em>}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div>) : <p>現在、調理中のご注文はありません</p>}</div></section>
        <section className="call-lane completed"><header><span>できあがりました</span><h2>お呼び出し中</h2></header><div className="call-number-list">{called.length ? called.map((item) => <div className={item.department.toLowerCase()} key={item.id}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div>) : <p>完成した番号がここに表示されます</p>}</div></section>
      </div>
    </section> : <>
      <div className="staff-audio-bar"><div><b>呼出音声・店内BGM</b><span>{audioStatus}</span></div><button className={audioEnabled ? "enabled" : ""} onClick={() => void enableAudio()}>{audioEnabled ? "音声 有効 ✓" : "▶ 音声・BGMを開始"}</button><button className="bgm-toggle" disabled={!audioEnabled || testingFull} onClick={toggleBgm}>{bgmEnabled ? "BGM ON" : "BGM OFF"}</button><button className="volume-test" disabled={testingFull} onClick={() => void testFullVolume()}>{testingFull ? "100%テスト中…" : "100%を3秒テスト"}</button></div>
      <section className="summary" aria-label="注文サマリー"><div><span>未着手</span><strong>{count("ACCEPTED")}</strong></div><div><span>調理中</span><strong>{count("COOKING")}</strong></div><div><span>完成</span><strong className="ready-number">{count("READY")}</strong></div><div><span>呼出中</span><strong>{count("CALLED")}</strong></div></section>
      <div className="department-tabs"><button className={department === "ALL" ? "active all" : ""} onClick={() => setDepartment("ALL")}>すべて <b>{data.FOOD.length + data.DRINK.length}</b></button><button className={department === "FOOD" ? "active food" : ""} onClick={() => setDepartment("FOOD")}>フード <b>{data.FOOD.length}</b></button><button className={department === "DRINK" ? "active drink" : ""} onClick={() => setDepartment("DRINK")}>ドリンク <b>{data.DRINK.length}</b></button><span>4秒ごとに自動更新</span></div>
      {department === "ALL" && nextTask && nextInstruction && <section className={`next-task status-${nextTask.status.toLowerCase()}`}><header><span>今すべきこと</span><strong>{nextInstruction.headline}</strong><b>{nextTask.department === "FOOD" ? "フード" : "ドリンク"} {String(nextTask.callNumber).padStart(3, "0")}</b>{nextInstruction.equipment&&<em>{nextInstruction.equipment}</em>}</header><ol>{nextInstruction.steps.map((step,index)=><li key={`${step}-${index}`}><b>{index+1}</b><span>{step}</span></li>)}</ol><small>{nextTask.estimatedReadyAt?`提供予定 ${clock(nextTask.estimatedReadyAt)}・` : ""}{nextTask.items.map(item => `${item.name} ×${item.quantity}`).join("、")}</small></section>}
      {department==="ALL"&&optimizedTasks.length>0&&<section className="parallel-task-board optimized"><header><div><b>最短工程ナビ</b><small>全注文を機器・共通仕込み・待ち時間でまとめ直した推奨順です。新しい注文は4秒以内に再計算します。</small></div><span>{optimizedTasks.filter(task=>!optimizerDone.has(task.id)).length}工程</span></header><div>{optimizedTasks.map((task,index)=>{const done=optimizerDone.has(task.id),blocked=optimizedTasks.slice(0,index).some(previous=>!optimizerDone.has(previous.id));return <article key={task.id} className={done?"done":""}><strong className="task-sequence">{index+1}</strong><div><small>{task.equipment}・目安 {task.minutes}分{task.calls.length?`・対象 ${task.calls.join(" / ")}`:""}</small><b>{task.title}</b><p>{task.detail}</p></div><button disabled={done||blocked} onClick={()=>setOptimizerDone(current=>new Set([...current,task.id]))}>{done?"完了済み":blocked?"前工程待ち":"完了 →"}</button></article>})}</div></section>}
      {message && <p className="form-notice error">{message}</p>}
      <section className="order-grid" aria-live="polite">
        {loading && <div className="empty-menu">注文を取得しています…</div>}
        {!loading && !current.length && <div className="empty-menu">現在、{department === "ALL" ? "対応が必要な" : department === "FOOD" ? "フード" : "ドリンク"}待ち注文はありません。</div>}
        {current.map((item) => { const action = actionByStatus[item.status],steps=stepsForUnit(item),stepIndex=Math.min(item.currentStep??0,Math.max(0,steps.length-1)); return <article className={`order-card status-${item.status.toLowerCase()} department-${item.department.toLowerCase()}`} key={item.id}>
          <div className="card-head"><div><span className="order-kicker">{item.department === "FOOD" ? "フード呼出番号" : "ドリンク呼出番号"}</span><h2>{String(item.callNumber).padStart(3, "0")}</h2></div><span className="status-chip">{statusLabel[item.status]}</span></div>
          <div className="meta-row"><span>{item.department === "FOOD" ? "フード" : "ドリンク"}</span><span>{item.isTest?"テスト注文":"決済済み"}</span><span>{item.estimatedReadyAt ? `提供予定 ${clock(item.estimatedReadyAt)}` : "提供予定 できあがり次第"}</span><span>{elapsed(item.updatedAt)}</span></div>
          <div className="items">{item.items.map((product, index) => <div className="item" key={`${item.id}-${index}`}><strong className="quantity">{product.quantity}</strong><div><h3>{product.name}</h3>{product.options?.map((option) => <p key={option}>↳ {option}</p>)}</div></div>)}</div>
          {item.status==="COOKING"&&<div className="unit-task"><small>工程 {stepIndex+1} / {steps.length}</small><strong>{steps[stepIndex]}</strong><div><i style={{width:`${Math.round(((item.currentStep??0)/steps.length)*100)}%`}}/></div></div>}
          {action && <div className="card-actions">{item.status === "CALLED" && <button className="recall" onClick={() => announce(item)}>♩ 再呼出</button>}<button className="advance" disabled={updating === item.id} onClick={() => void act(item, action.action)}>{updating === item.id ? "更新中…" : action.label} <span>→</span></button></div>}
        </article>; })}
      </section>
    </>}
  </main>;
}

function optimizeKitchen(units:Fulfillment[]):OptimizedTask[]{if(!units.length)return[];const sorted=[...units].sort((a,b)=>(a.estimatedReadyAt??Number.MAX_SAFE_INTEGER)-(b.estimatedReadyAt??Number.MAX_SAFE_INTEGER)||a.updatedAt-b.updatedAt),names=(unit:Fulfillment)=>unit.items[0]?.name??"商品",call=(unit:Fulfillment)=>`${unit.department==="FOOD"?"F":"D"}${String(unit.callNumber).padStart(3,"0")}`,key=(prefix:string,rows:Fulfillment[])=>`${prefix}:${rows.map(row=>row.id).sort().join(",")}`;const fried=sorted.filter(unit=>/唐揚げ|からあげ|ポテト|フライドチキン|チーズドッグ|たこ焼|磯辺/.test(names(unit))),rice=sorted.filter(unit=>/丼|ご飯|ライス/.test(names(unit))),microwave=sorted.filter(unit=>/角煮丼|煮カツ丼|うどん|つけ麺|ほうとう|贅沢ポテト/.test(names(unit))),drinks=sorted.filter(unit=>unit.department==="DRINK"),tasks:OptimizedTask[]=[];if(fried.length){const karaage=fried.filter(unit=>/唐揚げ|からあげ/.test(names(unit))).length*6,potatoes=fried.filter(unit=>/ポテト/.test(names(unit))).length,other=fried.filter(unit=>!/唐揚げ|からあげ|ポテト/.test(names(unit))).map(names);tasks.push({id:key("fryer-preheat",fried),title:"フライヤーをオンにして180℃まで予熱する",detail:`予熱中に、からあげ ${karaage}個${potatoes?`、ポテト ${potatoes*200}g（${potatoes}食）`:""}${other.length?`、${other.join("・")}`:""}を冷凍庫から出してバットへ用意する。`,equipment:"フライヤー",calls:fried.map(call),minutes:2})}const longMicrowave=microwave.filter(unit=>/ほうとう|うどん/.test(names(unit)));if(longMicrowave.length)tasks.push({id:key("long-heat",longMicrowave),title:"時間の長い麺類から電子レンジ加熱を開始する",detail:longMicrowave.map(unit=>`${call(unit)} ${names(unit)}：${/ほうとう/.test(names(unit))?"600W 5分→混ぜる→5分→混ぜる→2分":"1000W 3分→混ぜる→3分"}`).join(" ／ "),equipment:"電子レンジ",calls:longMicrowave.map(call),minutes:1});if(fried.length){const karaage=fried.filter(unit=>/唐揚げ|からあげ/.test(names(unit))).length*6,potatoes=fried.filter(unit=>/ポテト/.test(names(unit))).length,others=fried.filter(unit=>!/唐揚げ|からあげ|ポテト/.test(names(unit))).length,totalLoad=karaage+potatoes*6+others*6,batches=Math.max(1,Math.ceil(totalLoad/12));for(let batch=1;batch<=batches;batch++)tasks.push({id:`${key("fryer-load",fried)}:${batch}`,title:`フライヤー 第${batch}バッチを投入する`,detail:`1バッチは唐揚げ12個相当まで。ポテト1食200gは唐揚げ6個分として混載する。6分商品を先に上げ、ポテトは追加2分（合計8分）。全体は${batches}バッチ。`,equipment:"フライヤー（容量12個相当）",calls:fried.slice((batch-1)*2,batch*2).map(call),minutes:batch===1?1:6})}if(rice.length){const portions=rice.map(unit=>riceGrams(unit.items[0]?.options)).reduce((sum,value)=>sum+value,0),soups=rice.filter(unit=>!/単品ライス/.test(names(unit))).length;tasks.push({id:key("rice-prep",rice),title:`丼にご飯を合計${portions}g盛る`,detail:`各呼出番号の容器を並べ、普通200g・少なめ150g・大盛250gで盛り分ける。味噌汁も${soups}杯まとめて準備する。角煮丼は解凍済み角煮と冷凍ネギまで載せる。`,equipment:"盛付台・給湯",calls:rice.map(call),minutes:2})}const shortMicrowave=microwave.filter(unit=>!longMicrowave.includes(unit));if(shortMicrowave.length)tasks.push({id:key("short-heat",shortMicrowave),title:"揚げ待ち中に短時間のレンジ工程をまとめる",detail:shortMicrowave.map(unit=>`${call(unit)} ${names(unit)}：${/角煮丼/.test(names(unit))?"1000W 約1分10秒":/煮カツ丼/.test(names(unit))?"1000W 約1分18秒→卵→30秒":"調理マスタの加熱時間"}`).join(" ／ "),equipment:"電子レンジ（2容器まで）",calls:shortMicrowave.map(call),minutes:3});if(fried.length||rice.length||microwave.length){const foods=sorted.filter(unit=>unit.department==="FOOD");tasks.push({id:key("finish",foods),title:"加熱済みの商品から盛付・付属品を仕上げる",detail:"同じ呼出番号の容器・オプションを照合する。完成した商品は個別に完成操作し、できた物から呼び出す。",equipment:"盛付台",calls:foods.map(call),minutes:2})}if(drinks.length)tasks.push({id:key("drinks",drinks),title:"提供時刻に合わせてドリンクをまとめて調製する",detail:"フード同時提供は完成予定の5分前から開始。ドリンク単品はすぐ作り、蓋・氷・オプションを番号ごとに照合する。",equipment:"ドリンク設備",calls:drinks.map(call),minutes:5});return tasks}
function riceGrams(options?:string[]){const text=options?.join(" ")??"";if(/少なめ|150g/.test(text))return 150;if(/大盛|250g/.test(text))return 250;return 200}
function elapsed(time: number) { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? "たった今" : `${minutes}分経過`; }
function orderPriority(a:Fulfillment,b:Fulfillment){const rank:Record<Status,number>={READY:0,CALLED:1,ACCEPTED:2,COOKING:3,PICKED_UP:4,CANCELLED:5};const difference=rank[a.status]-rank[b.status];if(difference)return difference;const aTime=a.estimatedReadyAt??a.updatedAt,bTime=b.estimatedReadyAt??b.updatedAt;return aTime-bTime}
function workInstruction(item:Fulfillment):WorkInstruction{if(item.status==="READY")return{headline:"完成品を確認して呼び出す",steps:["商品・数量・オプションを最終確認","呼出ボタンを押し、受取カウンターへ置く"]};if(item.status==="CALLED")return{headline:"受け取りを確認して商品を渡す",steps:["呼出番号と商品を照合","商品を渡したら受渡完了を押す"]};if(item.status==="COOKING"){const steps=stepsForUnit(item),index=Math.min(item.currentStep??0,steps.length-1);return{headline:"次の工程を完了する",steps:[steps[index]],equipment:item.department==="DRINK"?"ドリンク設備":recipeFor(item.items[0]?.name??"",1,item.items[0]?.options).equipment}}if(item.department==="DRINK")return{headline:"ドリンク調製を開始する",equipment:"ドリンク設備",steps:item.items.map(product=>`${product.name} ×${product.quantity}を調製し、注文オプションを確認`).slice(0,4)};const recipes=item.items.map(product=>recipeFor(product.name,product.quantity,product.options));return{headline:recipes.length>1?"並行できる工程から調理を開始":"調理を開始する",equipment:[...new Set(recipes.map(recipe=>recipe.equipment).filter(Boolean))].join("・"),steps:recipes.flatMap(recipe=>recipe.steps).slice(0,6)}}
function stepsForUnit(item:Fulfillment){if(item.department==="DRINK")return[`${item.items[0]?.name??"ドリンク"}を調製する`,`オプション・蓋・提供状態を確認する`];const product=item.items[0],name=product?.name??"商品";if(/カルボナーラパスタ/.test(name))return["パスタ180gを電子レンジ600Wで3分10秒加熱する","共通カルボナーラソースを600Wで約50秒加熱する","パスタとソースを混ぜる","盛り付け・最終確認を行う"];return recipeFor(name,1,product?.options).steps}
function recipeFor(name:string,quantity:number,options?:string[]):WorkInstruction{const text=`${name} ${options?.join(" ")??""}`,qty=`${name} ×${quantity}`;if(/フリフリポテト/.test(text))return{headline:qty,equipment:"フライヤー 180℃",steps:[`${qty}を180℃で6分、さらに2分揚げる`,`紙袋へ入れ、シーズニング小さじ1を加えて振る`]};if(/贅沢ポテト/.test(text))return{headline:qty,equipment:"フライヤー 180℃・電子レンジ",steps:[`${qty}を180℃で合計8分揚げる`,`ソースを1000Wで約30秒加熱`,`丼へ盛り、ソースをかけて温玉を別添え`]};if(/唐揚げ丼|からあげ丼/.test(text))return{headline:qty,equipment:"フライヤー 180℃",steps:[`${qty}の唐揚げを180℃で6分揚げる`,`揚げている間にご飯と味噌汁を準備`,`盛付後、指定量のマヨネーズをかける`]};if(/唐揚げ|からあげ|フライドチキン/.test(text))return{headline:qty,equipment:"フライヤー 180℃",steps:[`${qty}を180℃で6分揚げる`,`惣菜パックへ詰める`]};if(/チーズドッグ/.test(text))return{headline:qty,equipment:"フライヤー 180℃",steps:[`${qty}を冷凍状態から180℃で6分揚げる`,`惣菜パックへ入れ指定ソースをかける`]};if(/たこ焼/.test(text))return{headline:qty,equipment:"フライヤー 180℃",steps:[`${qty}を180℃で6分揚げる`,`ソース・マヨネーズ、鰹節を別添え`]};if(/磯辺/.test(text))return{headline:qty,equipment:"フライヤー",steps:[`${qty}をフライヤーで3分揚げる`]};if(/角煮丼/.test(text))return{headline:qty,equipment:"電子レンジ 1000W",steps:["ご飯に解凍済み角煮と冷凍ネギを乗せる","1000Wで約1分10秒加熱","加熱中に味噌汁を作り、天かすと温玉を別添え"]};if(/煮カツ丼/.test(text))return{headline:qty,equipment:"電子レンジ 1000W",steps:["蓋を半分剥がし約1分18秒加熱","加熱中に卵を溶き、カツ周囲へ入れる","約30秒再加熱し、ご飯と味噌汁を準備"]};if(/卵かけご飯/.test(text))return{headline:qty,equipment:"盛付",steps:["ご飯を盛り醤油を軽くかける","殻付き生卵をカップで別添え","味噌汁を添える"]};if(/単品ライス|ライス/.test(text))return{headline:qty,equipment:"盛付",steps:["規定量のご飯を盛る","味噌汁は付けない"]};if(/きつねうどん/.test(text))return{headline:qty,equipment:"電子レンジ 1000W",steps:["冷凍うどん・きつね・ネギを丼へ","1000Wで3分→混ぜる→さらに3分","天かすを加える"]};if(/かけうどん/.test(text))return{headline:qty,equipment:"電子レンジ 1000W",steps:["きつねうどんと同工程で3分×2回加熱","完成後きつねを除き、天かすを追加"]};if(/つけ麺/.test(text))return{headline:qty,equipment:"電子レンジ",steps:["冷凍麺を袋ごと加熱し、水切り・水締め","角煮1/2パウチを600Wで40秒加熱","スープの素とお湯100ccでつけ汁を作る"]};if(/ほうとう/.test(text))return{headline:qty,equipment:"電子レンジ 600W",steps:["600Wで5分加熱して混ぜる","さらに5分加熱して混ぜる","最後に2分加熱し必ず混ぜる"]};if(/かき氷/.test(text))return{headline:qty,equipment:"MIZUKARA",steps:["水を入れて起動","約3分で一度目のシロップ","向きを調整し約2分後、仕上げを載せる"]};return{headline:qty,equipment:"調理マスタ確認",steps:[`${qty}のオプションを確認し、調理マスタに従って開始`]}}
function finishSteps(name:string,quantity:number){if(/唐揚げ丼|からあげ丼/.test(name))return[`${name} ×${quantity}：ご飯・味噌汁・マヨネーズを仕上げる`];if(/ポテト/.test(name))return[`${name} ×${quantity}：揚げ時間を確認して味付け・盛付`];if(/うどん|ほうとう/.test(name))return[`${name} ×${quantity}：途中混ぜと最終加熱を確認`];if(/角煮丼|煮カツ丼/.test(name))return[`${name} ×${quantity}：加熱状態を確認し、ご飯・味噌汁を仕上げる`];if(/かき氷/.test(name))return[`${name} ×${quantity}：氷の偏りを直し、シロップとトッピング`];return[`${name} ×${quantity}：加熱・盛付・オプションを確認`]}
function clock(time:number){return new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit"}).format(new Date(time));}
function friendly(message: string) { if (message.includes("UNAUTHORIZED")) return "会員証システムとの認証設定を確認してください"; if (message.includes("UNAVAILABLE")) return "会員証システムへ接続できません"; if (message.includes("INVALID_STATUS_TRANSITION")) return "別の端末で状態が更新されました"; return message; }
async function playLegacyCall(item: Fulfillment) {
  playLegacyChime(); await wait(650);
  const department = item.department === "FOOD" ? "フード" : "ドリンク";
  const number = String(item.callNumber).padStart(3, "0");
  await speak(`お待たせいたしました。${department}番号、${number}番のお客様。${number}番のお客様。商品ができあがりました。受け取りカウンターまでお越しください。`);
  playLegacyChime(); await wait(650);
}
function speak(text: string) { return new Promise<void>((resolve) => { if (!("speechSynthesis" in window)) { resolve(); return; } const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ja-JP"; utterance.rate = .88; utterance.pitch = 1; utterance.volume = scheduledVolume(); const voices = window.speechSynthesis.getVoices(); utterance.voice = voices.find((voice) => voice.lang.startsWith("ja")) ?? null; utterance.onend = () => resolve(); utterance.onerror = () => resolve(); window.speechSynthesis.speak(utterance); }); }
function playLegacyChime() { try { const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const context = new AudioContextClass(), peak = .13 * scheduledVolume(), floor = Math.max(0.0000000001, peak / 1000); [659, 784, 988].forEach((frequency, index) => { const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .14; oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(floor, start); gain.gain.exponentialRampToValueAtTime(peak, start + .02); gain.gain.exponentialRampToValueAtTime(floor, start + .32); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .34); }); } catch { /* 表示は継続 */ } }
function wait(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
