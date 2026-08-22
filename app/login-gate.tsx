"use client";

import { FormEvent, useState } from "react";

export default function LoginGate({ display = false }: { display?: boolean }) {
  const [password, setPassword] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "ログインできませんでした"); setBusy(false); return; }
    window.location.reload();
  }
  return <main className="site-login"><form onSubmit={submit}><p>AOZORA KITCHEN</p><h1>{display ? "ご注文状況" : "注文管理"}</h1><span>表示するにはパスワードを入力してください</span><label><b>パスワード</b><input type="password" inputMode="numeric" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <small>{message}</small>}<button disabled={busy || !password}>{busy ? "確認中…" : "表示する"}</button></form></main>;
}
