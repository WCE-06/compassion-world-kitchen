"use client";

import { ChangeEvent, useRef, useState } from "react";

type MenuItem = {
  id: string;
  name: string;
  code: string;
  price: number;
  category: "FOOD" | "DRINK";
  image?: string;
  status: "PUBLISHED" | "DRAFT";
};

const initialMenus: MenuItem[] = [
  { id: "smaregi-1001", name: "季節野菜のカレー", code: "CW-1001", price: 980, category: "FOOD", status: "PUBLISHED" },
  { id: "smaregi-1002", name: "発酵デリプレート", code: "CW-1002", price: 1280, category: "FOOD", status: "PUBLISHED" },
  { id: "smaregi-2001", name: "自家製ジンジャーエール", code: "CW-2001", price: 580, category: "DRINK", status: "PUBLISHED" },
];

export default function MenuManager() {
  const [menus, setMenus] = useState(initialMenus);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [notice, setNotice] = useState("");
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  function openForm(item?: MenuItem) {
    setEditing(item ? { ...item } : { id: `draft-${menus.length + 1}`, name: "", code: "", price: 0, category: "FOOD", status: "DRAFT" });
    setNotice("");
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

  function save() {
    if (!editing?.name.trim() || !editing.code.trim() || editing.price <= 0) {
      setNotice("商品名、商品コード、価格を入力してください");
      return;
    }
    const saved = { ...editing, status: "DRAFT" as const };
    setMenus((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setNotice("下書きを保存しました。スマレジ連携後に公開されます。");
    setEditing(null);
  }

  if (editing) return (
    <section className="menu-workspace">
      <div className="workspace-head">
        <div><button className="back-link" onClick={() => setEditing(null)}>← メニュー一覧</button><p>MENU EDITOR</p><h1>{menus.some((item) => item.id === editing.id) ? "商品情報を修正" : "新メニュー追加"}</h1></div>
        <span className="draft-chip">下書き</span>
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
          <p className="photo-tip">明るい場所で、料理全体が中央に入るよう撮影してください。</p>
        </div>

        <div className="editor-card details-editor">
          <div className="section-title"><span>02</span><div><h2>基本情報</h2><p>スマレジの商品マスタへ連携する内容</p></div></div>
          <label>商品名<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="例：季節野菜のカレー" /></label>
          <div className="field-row">
            <label>商品コード<input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="CW-1003" /></label>
            <label>税込価格<div className="price-input"><span>¥</span><input type="number" min="0" value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div></label>
          </div>
          <label>カテゴリー<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as "FOOD" | "DRINK" })}><option value="FOOD">フード</option><option value="DRINK">ドリンク</option></select></label>
          <label>メニュー説明<textarea rows={4} placeholder="素材や味わいなど、お客様向けの説明を入力" /></label>
          <div className="publish-note"><b>スマレジ連携</b><p>下書き保存後、「スマレジへ登録して公開」から商品マスタへ登録します。</p></div>
        </div>
      </div>
      {notice && <p className="form-notice" role="alert">{notice}</p>}
      <footer className="editor-footer"><button className="secondary" onClick={() => setEditing(null)}>キャンセル</button><button className="primary" onClick={save}>下書きを保存</button></footer>
    </section>
  );

  return (
    <section className="menu-workspace">
      <div className="workspace-head">
        <div><p>MENU MANAGEMENT</p><h1>メニュー管理</h1><small>商品情報とスマレジへの同期状態を管理します</small></div>
        <button className="new-menu" onClick={() => openForm()}>＋ 新メニュー追加</button>
      </div>
      {notice && <p className="saved-notice">✓ {notice}</p>}
      <div className="menu-table">
        <div className="menu-table-head"><span>商品</span><span>商品コード</span><span>価格</span><span>連携状態</span><span /></div>
        {menus.map((item) => <article className="menu-row" key={item.id}>
          <div className="menu-product"><div className="menu-thumb">{item.image ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt="" />
          </> : <span>{item.category === "FOOD" ? "FOOD" : "DRINK"}</span>}</div><div><b>{item.name}</b><small>{item.category === "FOOD" ? "フード" : "ドリンク"}</small></div></div>
          <span>{item.code}</span><strong>¥{item.price.toLocaleString("ja-JP")}</strong>
          <span className={`sync-status ${item.status.toLowerCase()}`}>{item.status === "PUBLISHED" ? "スマレジ連携済" : "下書き"}</span>
          <button className="edit-menu" onClick={() => openForm(item)}>編集・画像差し替え</button>
        </article>)}
      </div>
    </section>
  );
}
