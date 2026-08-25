"use client";

import { useMemo, useState } from "react";

type Section = "EQUIPMENT" | "COMMON" | "FRIED" | "RICE" | "NOODLE" | "DESSERT";
type MasterItem = { section: Section; name: string; summary: string; tags: string[]; steps?: string[]; details?: { label: string; value: string }[]; caution?: string };

const sectionLabels: Record<Section, string> = { EQUIPMENT: "設備", COMMON: "共通工程", FRIED: "揚げ物", RICE: "ご飯もの", NOODLE: "麺類", DESSERT: "デザート" };

const items: MasterItem[] = [
  { section:"EQUIPMENT",name:"フライヤー",summary:"揚げ物基本 180℃・6分",tags:["180℃","6分","唐揚げ12個","ポテト400g"],details:[{label:"基本",value:"180℃ 6分"},{label:"唐揚げ容量",value:"最大12個／1バッチ"},{label:"ポテト容量",value:"1食200g・最大2食（400g）／1バッチ"},{label:"混載換算",value:"ポテト1食＝唐揚げ6個分の容量"},{label:"ポテト系",value:"追加2分（合計8分）"}] },
  { section:"EQUIPMENT",name:"電子レンジ",summary:"Panasonic・1000W運用",tags:["1000W","600W","2容器"],details:[{label:"標準",value:"1000W・最大3分想定"},{label:"同時加熱",value:"容器2個まで"},{label:"代替",value:"600W時間も各工程に記載"}] },
  { section:"EQUIPMENT",name:"湯煎器",summary:"角煮運用変更により廃止候補",tags:["廃止候補"],caution:"現状は角煮用途のみ。新しい角煮工程では原則使用しない。" },
  { section:"EQUIPMENT",name:"温泉卵調理器",summary:"1回2個・約15分",tags:["2個","15分"] },
  { section:"EQUIPMENT",name:"ホットショーケース",summary:"2段・バット4枚",tags:["在庫バッファ","4バット"],details:[{label:"用途",value:"揚げ物等の在庫バッファ"}] },
  { section:"EQUIPMENT",name:"製氷機",summary:"ベルソス クリスタル製氷機",tags:["ベルソス"] },
  { section:"EQUIPMENT",name:"かき氷機",summary:"MIZUKARA・起動から完成約5分",tags:["MIZUKARA","5分"] },
  { section:"COMMON",name:"ご飯量",summary:"全丼共通",tags:["150g","200g","250g"],details:[{label:"少なめ",value:"150g"},{label:"普通",value:"200g"},{label:"大盛り",value:"250g・+100円"}] },
  { section:"COMMON",name:"味噌汁",summary:"丼・ご飯メニューに添付",tags:["150cc","丼共通"],steps:["スープ用カップを準備","規定味噌1袋","顆粒調味料1振り","ワカメ 規定さじ1杯","冷凍ネギ少々","お湯150cc"],caution:"単品ライスには味噌汁を付けない。" },
  { section:"COMMON",name:"温泉卵の在庫運用",summary:"最大3個・在庫1個で2個作成",tags:["15分","最大3個","別添え"],steps:["在庫が1個になったら2個作成開始","提供時は冷蔵状態","プラカップ＋キッチンペーパーで別添え"],details:[{label:"1回",value:"2個・約15分"},{label:"在庫2個",value:"そのまま維持"}] },
  { section:"COMMON",name:"共通カルボナーラソース",summary:"カルボナーラパスタ・贅沢ポテト共通",tags:["600W 50秒","共通工程"],steps:["ソース袋の表示と破損がないことを確認","電子レンジ600Wで約50秒加熱","商品ごとの仕上げ工程へ渡す"],details:[{label:"600W",value:"約50秒"},{label:"1000W",value:"約30秒"},{label:"500W表示",value:"1分"}],caution:"加熱時間を変更する場合は、この共通工程だけを変更して両商品へ反映する。" },
  { section:"FRIED",name:"唐揚げ丼",summary:"180℃ 6分・提供目安約8分",tags:["6個","8分","味噌汁"],steps:["唐揚げを180℃で6分","揚げ中にご飯と味噌汁を準備","丼へ盛り付け","最大の隙間へ、ご飯を隠すようにマヨネーズ"],details:[{label:"通常",value:"和風／にんにく 各6個"},{label:"合盛り",value:"3個＋3個"},{label:"小さい場合",value:"+1個"},{label:"マヨネーズ",value:"なし／少なめ／普通／多め +30円"}] },
  { section:"FRIED",name:"唐揚げ単品",summary:"180℃ 6分・惣菜パック",tags:["6分","惣菜パック"],steps:["唐揚げを180℃で6分","惣菜パックへ詰める"],caution:"ご飯・味噌汁は付けない。" },
  { section:"FRIED",name:"フライドチキン",summary:"180℃ 6分",tags:["6分","惣菜パック"],steps:["180℃で6分","惣菜パックへ詰める"] },
  { section:"FRIED",name:"チーズドッグ",summary:"冷凍から180℃ 6分",tags:["6分","指定ソース"],steps:["冷凍状態から180℃で6分","惣菜パックへ","指定ソースをかける"] },
  { section:"FRIED",name:"揚げたこ焼き",summary:"8個・180℃ 6分",tags:["8個","6分"],steps:["8個を180℃で6分","惣菜パックへ","ソース、マヨネーズ","鰹節1パックを別添え"] },
  { section:"FRIED",name:"フリフリポテト",summary:"180℃ 合計8分",tags:["8分","小さじ1"],steps:["180℃で6分＋追加2分","紙袋へ","シーズニング小さじ1","袋を振る"] },
  { section:"FRIED",name:"贅沢ポテト",summary:"180℃ 合計8分＋温玉別添え",tags:["8分","温玉","ソース"],steps:["180℃で6分＋追加2分","丼へ盛り付け","パスタソースを加熱して投入","温玉を別添え"],details:[{label:"ソース 1000W",value:"約30秒"},{label:"ソース 600W",value:"約50秒"},{label:"表示基準",value:"500W 1分"}] },
  { section:"FRIED",name:"磯辺揚げ",summary:"フライヤー3分",tags:["3分"] },
  { section:"RICE",name:"角煮丼",summary:"1000W 約1分10秒",tags:["角煮","温玉","味噌汁"],steps:["ご飯を盛る","解凍済み角煮と冷凍ネギを乗せる","電子レンジ加熱中に味噌汁と温玉を準備","天かすを投入して蓋","温玉を別添え","使用後、次回分の角煮を冷蔵解凍準備"],details:[{label:"1000W",value:"約1分10秒"},{label:"600W",value:"約2分"}] },
  { section:"RICE",name:"煮カツ丼",summary:"2段階レンジ加熱",tags:["生卵","味噌汁"],steps:["蓋を半分剥がして1回目加熱","加熱中に生卵を溶く","蓋を全部剥がしカツ周囲へ溶き卵","2回目加熱","ご飯へ盛り付け、味噌汁添付"],details:[{label:"1回目",value:"1000W 約1分18秒／600W 2分10秒"},{label:"2回目",value:"1000W 約30秒／600W 50秒"}] },
  { section:"RICE",name:"卵かけご飯",summary:"生卵を別添え",tags:["味噌汁","生卵"],steps:["ご飯を盛る","醤油を軽くかける","殻付き生卵をプラカップで別添え","味噌汁を添付"] },
  { section:"RICE",name:"単品ライス",summary:"ご飯を盛るだけ",tags:["味噌汁なし"],caution:"味噌汁は付けない。" },
  { section:"NOODLE",name:"きつねうどん",summary:"1000W 3分×2・途中混ぜ",tags:["約10分","1000W"],steps:["冷凍うどん、きつね、冷凍ネギを丼へ","1000W 3分","混ぜる30秒","1000W 3分","天かすを加える"],details:[{label:"顧客表示",value:"約10分"},{label:"代替",value:"600W運用時間はマニュアル換算"}] },
  { section:"NOODLE",name:"かけうどん",summary:"きつねうどんと同工程",tags:["約10分"],steps:["きつねうどんと同じ工程で加熱","完成後にきつねを取り除く","天かすを追加"] },
  { section:"NOODLE",name:"つけ麺",summary:"角煮1/2パウチ・つけ汁100cc",tags:["600W 40秒","角煮"],steps:["冷凍麺を袋ごとレンジ","水切りし袋内で水締め、丼へ","角煮1/2パウチをスープカップで加熱","スープの素＋お湯100ccを混ぜる","麺とつけ汁を提供"],details:[{label:"角煮",value:"600W 40秒"},{label:"残り半分",value:"スープカップで冷蔵保存"}] },
  { section:"NOODLE",name:"カルボナーラパスタ",summary:"電子レンジ1台で麺・共通ソースを直列加熱",tags:["600W 3分10秒","ソース50秒","180g"],steps:["トップバリュ スパゲッティ180gを600Wで3分10秒加熱","共通カルボナーラソースを600Wで約50秒加熱","パスタとソースを混ぜる","盛り付け・最終確認"],details:[{label:"パスタ",value:"JAN 4549414725094・180g"},{label:"麺加熱",value:"600W 3分10秒"},{label:"共通ソース",value:"600W 約50秒"},{label:"レンジ占有",value:"合計4分・他商品と直列"}] },
  { section:"NOODLE",name:"ほうとう",summary:"600W 合計12分・途中混ぜ必須",tags:["約15分","600W","途中混ぜ"],steps:["冷凍ほうとうを丼へ移す","600W 5分→混ぜる","600W 5分→混ぜる","600W 2分→最終混ぜ"],details:[{label:"提供目安",value:"約15分"}],caution:"途中混ぜを必ず行う。" },
  { section:"DESSERT",name:"かき氷",summary:"MIZUKARA・提供目安約6分",tags:["約6分","シロップ","練乳"],steps:["水をタンクへ入れて起動","約3分で一度目のシロップを一周","氷の偏りが少なくなる向きへ調整","約2分追加し停止、取り出す","最終シロップ、練乳、生クリーム"],details:[{label:"提供目安",value:"約6分"}] },
];

export default function CookingMaster() {
  const [section, setSection] = useState<Section | "ALL">("ALL"), [query, setQuery] = useState("");
  const visible = useMemo(() => items.filter((item) => (section === "ALL" || item.section === section) && (!query.trim() || `${item.name} ${item.summary} ${item.tags.join(" ")} ${item.steps?.join(" ") ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))), [section, query]);
  return <section className="master-workspace">
    <div className="workspace-head"><div><p>COOKING OPERATIONS</p><h1>調理運用マスタ</h1><small>Aozora Kitchen・ドリンク除外版</small></div><label className="master-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="商品名・機器・時間で検索" /></label></div>
    <nav className="master-tabs"><button className={section === "ALL" ? "active" : ""} onClick={() => setSection("ALL")}>すべて <b>{items.length}</b></button>{(Object.keys(sectionLabels) as Section[]).map((key) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>{sectionLabels[key]} <b>{items.filter((item) => item.section === key).length}</b></button>)}</nav>
    <div className="master-grid">{visible.map((item) => <article className="master-card" key={`${item.section}-${item.name}`}><header><span>{sectionLabels[item.section]}</span><h2>{item.name}</h2><p>{item.summary}</p></header><div className="master-tags">{item.tags.map((tag) => <b key={tag}>{tag}</b>)}</div>{item.details && <dl>{item.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}{item.steps && <ol>{item.steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>}{item.caution && <p className="master-caution">注意　{item.caution}</p>}</article>)}</div>
    {!visible.length && <div className="empty-menu">該当する調理マスタがありません。</div>}
  </section>;
}
