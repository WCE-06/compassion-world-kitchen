"use client";

import { useEffect, useState } from "react";
import KitchenBoard from "./kitchen-board";
import LoginGate from "./login-gate";

export default function AuthenticatedBoard({ display = false }: { display?: boolean }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/auth/login", { cache: "no-store" }).then((response) => setAuthenticated(response.ok)).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <main className="site-login"><div className="auth-loading">AOZORA KITCHEN<br /><small>認証を確認しています…</small></div></main>;
  if (!authenticated) return <LoginGate display={display} />;
  return <KitchenBoard displayOnly={display} />;
}
