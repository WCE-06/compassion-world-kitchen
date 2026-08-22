"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MenuManager from "./menu-manager";
import CookingMaster from "./cooking-master";

type Department = "FOOD" | "DRINK";
type Status = "ACCEPTED" | "COOKING" | "READY" | "CALLED" | "PICKED_UP" | "CANCELLED";
type Fulfillment = { id: string; orderId: string; department: Department; callNumber: number; status: Status; readyAt: number | null; estimatedReadyAt?: number | null; calledAt: number | null; updatedAt: number; items: { name: string; quantity: number; options?: string[] }[] };
type Screen = "ORDERS" | "CALL_MONITOR" | "HISTORY" | "ANNOUNCEMENTS" | "MENU" | "MASTER";

const statusLabel: Record<Status, string> = { ACCEPTED: "未着手", COOKING: "調理中", READY: "完成", CALLED: "呼出中", PICKED_UP: "受渡済み", CANCELLED: "取消" };
const actionByStatus: Partial<Record<Status, { action: "START" | "READY" | "CALL" | "PICKUP"; label: string }>> = {
  ACCEPTED: { action: "START", label: "調理を開始" }, COOKING: { action: "READY", label: "完成" }, READY: { action: "CALL", label: "呼出" }, CALLED: { action: "PICKUP", label: "受渡完了" },
};

const OLD_BGM_URL = "https://wce-06.github.io/liff-entry/audio/bgm.mp3";
const ENTRY_BGM_BASE_VOLUME = 0.62;
const BGM_DUCK_VOLUME = 0.04;

function scheduledVolume() {
  return entryMasterVolume();
}

function entryMasterVolume() { const hour = new Date().getHours(); if (hour < 2) return 0.30; if (hour < 8) return 0.01; if (hour < 9) return 0.75; if (hour < 18) return 1; if (hour < 21) return 0.75; return 0.50; }
function entryBgmVolume() { return ENTRY_BGM_BASE_VOLUME * entryMasterVolume(); }
function percentLabel(value: number) { const percent = value * 100; return percent < 0.001 ? percent.toFixed(5) : percent < 1 ? percent.toFixed(2) : `${Math.round(percent)}`; }
function volumeLabel() { return `BGM ${percentLabel(entryBgmVolume())}%・呼出 ${percentLabel(scheduledVolume())}%`; }

export default function KitchenBoard({ displayOnly = false }: { displayOnly?: boolean }) {
  const [screen, setScreen] = useState<Screen>(displayOnly ? "CALL_MONITOR" : "ORDERS");
  const [department, setDepartment] = useState<Department>("FOOD");
  const [data, setData] = useState<Record<Department, Fulfillment[]>>({ FOOD: [], DRINK: [] });
  const [history, setHistory] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true), [message, setMessage] = useState(""), [updating, setUpdating] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null), previousCalled = useRef(new Set<string>()), calledInitialized = useRef(false);
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
      const [foodResponse, drinkResponse, foodHistoryResponse, drinkHistoryResponse] = await Promise.all([fetch("/api/v1/kitchen/fulfillments?department=FOOD", { cache: "no-store" }), fetch("/api/v1/kitchen/fulfillments?department=DRINK", { cache: "no-store" }), fetch("/api/v1/kitchen/fulfillments?department=FOOD&history=true", { cache: "no-store" }), fetch("/api/v1/kitchen/fulfillments?department=DRINK&history=true", { cache: "no-store" })]);
      const [food, drink, foodHistory, drinkHistory] = await Promise.all([foodResponse.json(), drinkResponse.json(), foodHistoryResponse.json(), drinkHistoryResponse.json()]);
      if (!foodResponse.ok || !drinkResponse.ok) throw new Error(food.error ?? drink.error ?? "注文を取得できませんでした");
      const next = { FOOD: food.fulfillments ?? [], DRINK: drink.fulfillments ?? [] } as Record<Department, Fulfillment[]>;
      const called = new Set([...next.FOOD, ...next.DRINK].filter((item) => item.status === "CALLED").map((item) => item.id));
      if (!displayOnly && calledInitialized.current) [...next.FOOD, ...next.DRINK].filter((item) => item.status === "CALLED" && !previousCalled.current.has(item.id)).forEach(announce);
      calledInitialized.current = true;
      previousCalled.current = called; setData(next); if (foodHistoryResponse.ok && drinkHistoryResponse.ok) setHistory([...(foodHistory.fulfillments ?? []), ...(drinkHistory.fulfillments ?? [])].sort((a: Fulfillment, b: Fulfillment) => b.updatedAt - a.updatedAt)); setLastSync(new Date()); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "注文情報へ接続できませんでした"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(true), 4000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => { if (bgmRef.current && bgmEnabledRef.current) setBgmVolume(bgmVolume()); }, 30000); return () => window.clearInterval(timer); }, []);

  async function act(item: Fulfillment, action: "START" | "READY" | "CALL" | "PICKUP" | "RESTORE_CALL") {
    setUpdating(item.id); setMessage("");
    try {
      const response = await fetch("/api/v1/kitchen/fulfillments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentId: item.id, action }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "状態を更新できませんでした");
      if (action === "CALL" || action === "RESTORE_CALL") { previousCalled.current.add(item.id); announce(item); } await load(true);
    } catch (error) { setMessage(error instanceof Error ? friendly(error.message) : "状態を更新できませんでした"); }
    finally { setUpdating(null); }
  }

  const current = data[department];
  const preparing = useMemo(() => [...data.FOOD, ...data.DRINK].filter((item) => item.status === "ACCEPTED" || item.status === "COOKING" || item.status === "READY").sort((a, b) => a.updatedAt - b.updatedAt), [data]);
  const called = useMemo(() => [...data.FOOD, ...data.DRINK].filter((item) => item.status === "CALLED").sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)), [data]);
  const count = (status: Status) => [...data.FOOD, ...data.DRINK].filter((item) => item.status === status).length;

  return <main className={`board-shell ${screen === "CALL_MONITOR" ? "call-screen" : ""} ${displayOnly ? "display-only" : ""}`}>
    {!displayOnly && <header className="topbar">
      <div className="brand"><span className="brand-mark">CW</span><div><b>COMPASSION WORLD</b><span>KITCHEN MONITOR</span></div></div>
      <nav className="main-nav" aria-label="管理画面"><button className={screen === "ORDERS" ? "active" : ""} onClick={() => setScreen("ORDERS")}>注文管理</button><button className={screen === "CALL_MONITOR" ? "active" : ""} onClick={() => setScreen("CALL_MONITOR")}>呼出モニター</button><button className={screen === "HISTORY" ? "active" : ""} onClick={() => setScreen("HISTORY")}>履歴</button><button className={screen === "ANNOUNCEMENTS" ? "active" : ""} onClick={() => setScreen("ANNOUNCEMENTS")}>館内放送</button><button onClick={() => window.open("https://compassion-world-members-card.combetter27.chatgpt.site/menu-admin", "_blank", "noopener,noreferrer")}>営業時間</button><button className={screen === "MASTER" ? "active" : ""} onClick={() => setScreen("MASTER")}>調理マスタ</button><button className={screen === "MENU" ? "active" : ""} onClick={() => setScreen("MENU")}>メニュー管理</button></nav>
      <div className="connection"><span className="pulse" /> {message ? "接続確認中" : "接続中"} <b>{lastSync?.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) ?? "--:--"}</b></div>
    </header>}

    {screen === "MENU" ? <MenuManager /> : screen === "MASTER" ? <CookingMaster /> : screen === "HISTORY" ? <section className="history-workspace"><div className="workspace-head"><div><p>FULFILLMENT HISTORY</p><h1>当日の受渡履歴</h1><small>誤操作した注文を呼出中へ戻し、顧客モニターへ再表示できます</small></div></div><div className="history-list">{history.length ? history.map((item) => <article key={item.id}><div className={`history-number ${item.department.toLowerCase()}`}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div><div><b>{item.items.map((entry) => `${entry.name} ×${entry.quantity}`).join("、")}</b><span>{new Date(item.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・{item.status === "PICKED_UP" ? "受渡完了" : "取消"}</span></div>{item.status === "PICKED_UP" && <button disabled={updating === item.id} onClick={() => void act(item, "RESTORE_CALL")}>呼出中へ戻して再呼出</button>}</article>) : <p className="history-empty">本日の受渡履歴はまだありません</p>}</div></section> : screen === "ANNOUNCEMENTS" ? <section className="announcement-workspace"><div className="workspace-head"><div><p>STORE ANNOUNCEMENTS</p><h1>館内放送</h1><small>放送前に上部の「音声・BGMを開始」を押してください</small></div></div><div className="announcement-grid">{[{title:"営業開始",tag:"OPEN",text:"おはようございます。本日も、Aozora Kitchenをご利用いただき、誠にありがとうございます。ただいまより営業を開始いたします。皆さまのご利用を心よりお待ちしております。"},{title:"ラストオーダー",tag:"LAST ORDER",text:"ご来館中のお客様にご案内いたします。Aozora Kitchenは、まもなくラストオーダーのお時間となります。ご注文予定のお客様は、お早めにご利用ください。"},{title:"営業終了",tag:"CLOSE",text:"ご来館中のお客様にご案内いたします。本日のAozora Kitchenの営業は終了いたしました。本日もご利用いただき、誠にありがとうございました。"}].map((item) => <article key={item.tag}><span>{item.tag}</span><h2>{item.title}</h2><p>{item.text}</p><button onClick={() => broadcast(item.title, item.text)}>▶ この放送を流す</button></article>)}</div></section> : screen === "CALL_MONITOR" ? <section className="customer-call-monitor">
      <header><p>AOZORA KITCHEN</p><h1>ご注文状況</h1><span>お呼び出し中に番号が表示されましたら、受取カウンターへお越しください</span></header>
      <div className="call-status-board">
        <section className="call-lane preparing"><header><span>ただいま</span><h2>調理中</h2></header><div className="call-number-list">{preparing.length ? preparing.map((item) => <div className={item.department.toLowerCase()} key={item.id}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}{item.estimatedReadyAt && <em>{clock(item.estimatedReadyAt)}ごろ</em>}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div>) : <p>現在、調理中のご注文はありません</p>}</div></section>
        <section className="call-lane completed"><header><span>できあがりました</span><h2>お呼び出し中</h2></header><div className="call-number-list">{called.length ? called.map((item) => <div className={item.department.toLowerCase()} key={item.id}><small>{item.department === "FOOD" ? "フード" : "ドリンク"}</small><strong>{String(item.callNumber).padStart(3, "0")}</strong></div>) : <p>完成した番号がここに表示されます</p>}</div></section>
      </div>
    </section> : <>
      <div className="staff-audio-bar"><div><b>呼出音声・店内BGM</b><span>{audioStatus}</span></div><button className={audioEnabled ? "enabled" : ""} onClick={() => void enableAudio()}>{audioEnabled ? "音声 有効 ✓" : "▶ 音声・BGMを開始"}</button><button className="bgm-toggle" disabled={!audioEnabled || testingFull} onClick={toggleBgm}>{bgmEnabled ? "BGM ON" : "BGM OFF"}</button><button className="volume-test" disabled={testingFull} onClick={() => void testFullVolume()}>{testingFull ? "100%テスト中…" : "100%を3秒テスト"}</button></div>
      <section className="summary" aria-label="注文サマリー"><div><span>未着手</span><strong>{count("ACCEPTED")}</strong></div><div><span>調理中</span><strong>{count("COOKING")}</strong></div><div><span>完成</span><strong className="ready-number">{count("READY")}</strong></div><div><span>呼出中</span><strong>{count("CALLED")}</strong></div></section>
      <div className="department-tabs"><button className={department === "FOOD" ? "active food" : ""} onClick={() => setDepartment("FOOD")}>フード <b>{data.FOOD.length}</b></button><button className={department === "DRINK" ? "active drink" : ""} onClick={() => setDepartment("DRINK")}>ドリンク <b>{data.DRINK.length}</b></button><span>4秒ごとに自動更新</span></div>
      {message && <p className="form-notice error">{message}</p>}
      <section className="order-grid" aria-live="polite">
        {loading && <div className="empty-menu">注文を取得しています…</div>}
        {!loading && !current.length && <div className="empty-menu">現在、{department === "FOOD" ? "フード" : "ドリンク"}の待ち注文はありません。</div>}
        {current.map((item) => { const action = actionByStatus[item.status]; return <article className={`order-card status-${item.status.toLowerCase()} department-${item.department.toLowerCase()}`} key={item.id}>
          <div className="card-head"><div><span className="order-kicker">{item.department === "FOOD" ? "フード呼出番号" : "ドリンク呼出番号"}</span><h2>{String(item.callNumber).padStart(3, "0")}</h2></div><span className="status-chip">{statusLabel[item.status]}</span></div>
          <div className="meta-row"><span>{item.department === "FOOD" ? "フード" : "ドリンク"}</span><span>決済済み</span><span>{item.estimatedReadyAt ? `提供予定 ${clock(item.estimatedReadyAt)}` : "提供予定 できあがり次第"}</span><span>{elapsed(item.updatedAt)}</span></div>
          <div className="items">{item.items.map((product, index) => <div className="item" key={`${item.id}-${index}`}><strong className="quantity">{product.quantity}</strong><div><h3>{product.name}</h3>{product.options?.map((option) => <p key={option}>↳ {option}</p>)}</div></div>)}</div>
          {action && <div className="card-actions">{item.status === "CALLED" && <button className="recall" onClick={() => announce(item)}>♩ 再呼出</button>}<button className="advance" disabled={updating === item.id} onClick={() => void act(item, action.action)}>{updating === item.id ? "更新中…" : action.label} <span>→</span></button></div>}
        </article>; })}
      </section>
    </>}
  </main>;
}

function elapsed(time: number) { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? "たった今" : `${minutes}分経過`; }
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
