"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type MenuItem = {
  id: string;
  name: string;
  code: string;
  price: number;
  category: "FOOD" | "DRINK";
  smaregiCategoryId: string;
  image?: string;
  soldOut?: boolean;
  menuCategory: string;
  displaySequence: number;
  status: "PUBLISHED" | "DRAFT";
};
type Category = { categoryId: string; categoryName: string };
type CatalogResponse = {
  products?: { productId: string; categoryId: string; productCode: string; productName: string; price: string; imageUrl?: string; soldOut?: boolean; menuCategory?: string; displaySequence?: number | string }[];
  categories?: Category[];
  environment?: "sandbox" | "production";
  source?: "shared-catalog" | "smaregi-production";
  readOnly?: boolean;
  syncedAt?: string | null;
  error?: string;
};

export default function MenuManager() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [sharedCatalog, setSharedCatalog] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [surface, setSurface] = useState<"mobile" | "register">("mobile");
  const [menuCategory, setMenuCategory] = useState("food-tsukemen");
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  async function loadCatalog() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/smaregi/catalog", { cache: "no-store" });
      const body = await response.json() as CatalogResponse;
      if (!response.ok) throw new Error(body.error ?? "商品を取得できませんでした");
      setCategories(body.categories ?? []);
      setEnvironment(body.environment ?? "sandbox");
      setSharedCatalog(body.source === "shared-catalog");
      setSyncedAt(body.syncedAt ?? null);
      setMenus((body.products ?? []).map((item) => ({
        id: item.productId,
        name: item.productName,
        code: item.productCode,
        price: Number(item.price),
        category: "FOOD",
        smaregiCategoryId: item.categoryId,
        image: item.imageUrl || undefined,
        soldOut: item.soldOut,
        menuCategory: item.menuCategory ?? "food-side",
        displaySequence: Number(item.displaySequence ?? 999999999),
        status: "PUBLISHED",
      })));
    } catch (error) {
      setMenus([]);
      setNotice(error instanceof Error ? `スマレジ接続エラー：${friendlyError(error.message)}` : "スマレジへ接続できませんでした");
    } finally {
      setLoading(false);
    }
  }

  // Initial synchronization intentionally updates the loading state and catalog.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadCatalog(); }, []);

  function openForm(item?: MenuItem) {
    setEditing(item ? { ...item } : { id: "", name: "", code: "", price: 0, category: "FOOD", smaregiCategoryId: categories[0]?.categoryId ?? "", menuCategory, displaySequence: 999999999, status: "DRAFT" });
    setNotice("");
  }

  const categoryTabs = [["food-tsukemen", "つけ麺"], ["food-udon", "うどん・ほうとう"], ["food-pasta", "パスタ"], ["food-don", "ご飯もの"], ["food-side", "サイド"], ["drink", "ドリンク"], ["dessert", "デザート"]] as const;
  const drinkTabs = [["soft-cafe", "カフェ"], ["soft-simple", "ソフトドリンク"], ["soft-mocktail", "モクテル"], ["alcohol-main", "ビール・焼酎など"], ["alcohol-cocktail", "カクテル"]] as const;
  const bucket = (item: MenuItem) => item.menuCategory === "cocktail" ? "alcohol-cocktail" : item.menuCategory === "mocktail" ? "soft-mocktail" : item.menuCategory;
  const visibleMenus = menus.filter((item) => menuCategory === "drink" ? bucket(item).startsWith("soft-") || bucket(item).startsWith("alcohol-") : bucket(item) === menuCategory).sort((a, b) => a.displaySequence - b.displaySequence || a.name.localeCompare(b.name, "ja"));

  function moveMenu(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const ids = visibleMenus.map((item) => item.id);
    const sourceIndex = ids.indexOf(sourceId), targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(targetIndex, 0, ids.splice(sourceIndex, 1)[0]);
    const sequence = new Map(ids.map((id, index) => [id, (index + 1) * 10]));
    setMenus((current) => current.map((item) => sequence.has(item.id) ? { ...item, displaySequence: sequence.get(item.id)! } : item));
    setOrderDirty(true);
  }

  function nudgeMenu(id: string, amount: -1 | 1) {
    const index = visibleMenus.findIndex((item) => item.id === id);
    const target = visibleMenus[index + amount];
    if (target) moveMenu(id, target.id);
  }

  async function saveOrder() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/v1/smaregi/catalog/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: visibleMenus.map((item) => item.id) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "表示順を保存できませんでした");
      setOrderDirty(false); setNotice(`${surface === "mobile" ? "モバイルオーダー" : "セルフレジ"}の表示順をスマレジへ保存しました`);
    } catch (error) { setNotice(error instanceof Error ? friendlyError(error.message) : "表示順を保存できませんでした"); }
    finally { setSaving(false); }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !editing) return;
    if (!file.type.startsWith("image/")) { setNotice("画像ファイルを選択してください"); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice("画像は10MB以下にしてください"); return; }
    const reader = new FileReader();
    reader.onload = () => setEditing((current) => current ? { ...current, image: String(reader.result) } : current);
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function save() {
    if (!editing?.name.trim() || !editing.code.trim() || editing.price <= 0 || !editing.smaregiCategoryId) {
      setNotice("商品名、商品コード、価格、スマレジ部門を入力してください");
      return;
    }
    setSaving(true);
    setNotice("");
    const existing = Boolean(editing.id);
    try {
      const response = await fetch(existing ? `/api/v1/smaregi/catalog/${editing.id}` : "/api/v1/smaregi/catalog", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: editing.smaregiCategoryId, productCode: editing.code, productName: editing.name, price: editing.price }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "スマレジ更新に失敗しました");
      setEditing(null);
      await loadCatalog();
      setNotice(existing ? "スマレジの商品情報を更新しました" : "スマレジへ新商品を登録しました");
    } catch (error) {
      setNotice(error instanceof Error ? friendlyError(error.message) : "スマレジ更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (editing) return (
    <section className="menu-workspace">
      <div className="workspace-head">
        <div><button className="back-link" onClick={() => setEditing(null)}>← メニュー一覧</button><p>MENU EDITOR</p><h1>{editing.id ? "商品情報を修正" : "新メニュー追加"}</h1></div>
        <span className="draft-chip">スマレジ {environment === "sandbox" ? "開発環境" : "本番環境"}</span>
      </div>

      <div className="editor-grid">
        <div className="editor-card image-editor">
          <div className="section-title"><span>01</span><div><h2>商品画像</h2><p>一覧・モバイルオーダーで表示する画像</p></div></div>
          <div className={`image-preview ${editing.image ? "has-image" : ""}`}>
            {editing.image ? <>
              <span className="sr-only">選択中の画像</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editing.image} alt={`${editing.name || "商品"}のプレビュー`} />
            </> : <div><span className="image-icon">＋</span><b>商品画像を追加</b><small>JPEG / PNG / WebP・10MBまで</small></div>}
          </div>
          <input ref={libraryInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
          <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={selectImage} />
          <div className="image-actions">
            <button type="button" onClick={() => libraryInput.current?.click()}><span>▧</span>画像を選択<small>端末内の写真から</small></button>
            <button type="button" onClick={() => cameraInput.current?.click()}><span>●</span>カメラで撮影<small>その場で商品を撮る</small></button>
          </div>
          {editing.image && <div className="replace-actions"><button onClick={() => libraryInput.current?.click()}>画像を差し替える</button><button className="danger-link" onClick={() => setEditing({ ...editing, image: undefined })}>画像を削除</button></div>}
          <p className="photo-tip">画像は現在プレビューのみです。公開URLの画像保存先を接続後、スマレジ商品画像にも同期します。</p>
        </div>

        <div className="editor-card details-editor">
          <div className="section-title"><span>02</span><div><h2>基本情報</h2><p>保存するとスマレジの商品マスタへ直接反映されます</p></div></div>
          <label>商品名<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="例：季節野菜のカレー" /></label>
          <div className="field-row">
            <label>商品コード<input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="CW-1003" /></label>
            <label>税込価格<div className="price-input"><span>¥</span><input type="number" min="0" step="1" value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div></label>
          </div>
          <label>スマレジ部門<select value={editing.smaregiCategoryId} onChange={(e) => setEditing({ ...editing, smaregiCategoryId: e.target.value })}><option value="">部門を選択</option>{categories.map((category) => <option value={category.categoryId} key={category.categoryId}>{category.categoryName}</option>)}</select></label>
          <label>キッチン区分<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as "FOOD" | "DRINK" })}><option value="FOOD">フード</option><option value="DRINK">ドリンク</option></select></label>
          <label>メニュー説明<textarea rows={4} placeholder="素材や味わいなど、お客様向けの説明を入力" /></label>
          <div className="publish-note"><b>スマレジへ直接反映</b><p>商品名・商品コード・税込価格・部門をスマレジ商品マスタへ登録または更新します。</p></div>
        </div>
      </div>
      {notice && <p className="form-notice" role="alert">{notice}</p>}
      <footer className="editor-footer"><button className="secondary" onClick={() => setEditing(null)}>キャンセル</button><button className="primary" disabled={saving} onClick={save}>{saving ? "スマレジへ保存中…" : editing.id ? "スマレジを更新" : "スマレジへ登録"}</button></footer>
    </section>
  );

  return (
    <section className="menu-workspace">
      <div className="workspace-head">
        <div><p>MENU MANAGEMENT</p><h1>メニュー管理</h1><small>スマレジ商品マスタとリアルタイム同期</small></div>
        <div className="menu-head-actions"><span className={`live-badge ${loading ? "loading" : ""}`}>{loading ? "同期中" : `● スマレジ ${environment === "sandbox" ? "開発環境" : "本番マスタ"}`}</span><button className="new-menu" disabled={loading || categories.length === 0 || sharedCatalog} onClick={() => openForm()}>＋ 新メニュー追加</button></div>
      </div>
      {sharedCatalog && <p className="saved-notice">スマレジ本番商品 {menus.length.toLocaleString("ja-JP")}件を同期済み{syncedAt ? `（${new Date(syncedAt).toLocaleString("ja-JP")}）` : ""}。登録・修正は本番の書き込み認証を接続後に有効になります。</p>}
      {notice && <p className={notice.includes("エラー") ? "form-notice error" : "saved-notice"}>{notice}</p>}
      <div className="menu-display-toolbar">
        <div className="surface-switch" aria-label="表示先"><button className={surface === "mobile" ? "active" : ""} onClick={() => setSurface("mobile")}>モバイルオーダー</button><button className={surface === "register" ? "active" : ""} onClick={() => setSurface("register")}>セルフレジ</button></div>
        <p><b>{surface === "mobile" ? "スマートフォン表示" : "セルフレジ表示"}</b><span>つまんで移動、または矢印で表示順を変更できます。並び順は両方へ共通反映されます。</span></p>
        <button className="save-order" disabled={!orderDirty || saving || visibleMenus.length === 0} onClick={() => void saveOrder()}>{saving ? "保存中…" : "表示順を保存"}</button>
      </div>
      <nav className="manager-genre-tabs">{categoryTabs.map(([key, label]) => <button key={key} className={(menuCategory === key || (key === "drink" && (menuCategory.startsWith("soft-") || menuCategory.startsWith("alcohol-")))) ? "active" : ""} onClick={() => setMenuCategory(key)}>{label}<small>{menus.filter((item) => key === "drink" ? bucket(item).startsWith("soft-") || bucket(item).startsWith("alcohol-") : bucket(item) === key).length}</small></button>)}</nav>
      {(menuCategory === "drink" || menuCategory.startsWith("soft-") || menuCategory.startsWith("alcohol-")) && <nav className="manager-drink-tabs">{drinkTabs.map(([key, label]) => <button key={key} className={menuCategory === key ? "active" : ""} onClick={() => setMenuCategory(key)}>{label}</button>)}</nav>}
      <div className={`sortable-menu-grid ${surface}`}>
        {loading && <div className="empty-menu">スマレジから商品を取得しています…</div>}
        {!loading && visibleMenus.length === 0 && <div className="empty-menu">このカテゴリに表示する商品はありません。</div>}
        {visibleMenus.map((item, index) => <article className={`sortable-menu-card ${draggingId === item.id ? "dragging" : ""}`} key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) moveMenu(draggingId, item.id); setDraggingId(null); }}>
          <div className="drag-handle" aria-label="ドラッグして並べ替え">⠿<small>{index + 1}</small></div>
          <div className={`menu-thumb ${item.image ? "has-image" : ""}`}>{item.image ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.image} alt="" /></> : <span>POS</span>}</div>
          <div className="sortable-menu-info"><b>{item.name}</b><span>¥{item.price.toLocaleString("ja-JP")}</span><small>{item.code || "コードなし"}{item.soldOut ? "・売切" : ""}</small></div>
          <div className="order-controls"><button disabled={index === 0} onClick={() => nudgeMenu(item.id, -1)} aria-label={`${item.name}を上へ`}>↑</button><button disabled={index === visibleMenus.length - 1} onClick={() => nudgeMenu(item.id, 1)} aria-label={`${item.name}を下へ`}>↓</button></div>
          <button className="edit-menu" disabled={sharedCatalog} onClick={() => openForm(item)}>編集</button>
        </article>)}
      </div>
      <button className="reload-catalog" onClick={() => void loadCatalog()} disabled={loading}>↻ スマレジから再取得</button>
    </section>
  );
}

function friendlyError(message: string) {
  if (message.includes("SMAREGI_NOT_CONFIGURED")) return "認証情報が未設定です";
  if (message.includes("SMAREGI_TOKEN_ERROR")) return "認証に失敗しました";
  if (message.includes("409") || message.includes("422")) return "商品コードなどの入力内容が重複しています";
  return message.replace(/^SMAREGI_API_ERROR:\d+:/, "");
}
