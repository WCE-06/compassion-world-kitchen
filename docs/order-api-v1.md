# 共通注文API v1 初期契約

ベースパスは `/api/v1`。時刻はISO 8601、金額は税込・整数円、識別子は不透明な文字列として扱います。既存の会員証APIが返すフィールドは削除・改名せず、追加フィールドは後方互換な拡張として導入します。

## 注文状態

```text
WAITING_STORE_PAYMENT ──決済確定──┐
PAID ─────────────────────────────┼→ ACCEPTED → COOKING → READY → PICKED_UP
                                 └→ CANCELLED
WAITING_STORE_PAYMENT ──期限切れ──→ EXPIRED
```

キッチンへ配信するのは決済確定済みの `ACCEPTED` 以降だけです。Stripe注文は決済Webhookの検証後、店頭決済注文はセルフレジからの決済確定イベント後に `ACCEPTED` へ進めます。通常遷移の巻き戻しは禁止し、訂正は管理者専用操作と監査理由を必要とします。

## 注文モデル

```json
{
  "id": "ord_01J...",
  "orderNumber": "A-1842",
  "status": "COOKING",
  "version": 3,
  "channel": "MOBILE",
  "memberId": "mem_...",
  "payment": { "method": "STRIPE", "status": "PAID", "paymentId": "pi_..." },
  "totals": { "excludingTax": 1000, "tax": 100, "includingTax": 1100 },
  "requestedPickupAt": "2026-08-22T10:50:00+09:00",
  "promisedAt": "2026-08-22T10:49:00+09:00",
  "cookingInstructions": "辛さ控えめ",
  "items": [{
    "id": "item_...", "productId": "smaregi:1001", "productCode": "1001",
    "name": "季節野菜のカレー", "quantity": 1,
    "unitPriceIncludingTax": 980, "taxRateBps": 1000, "lineTotalIncludingTax": 1100,
    "options": [{ "optionId": "opt_egg", "name": "温泉卵", "priceIncludingTax": 120 }]
  }],
  "createdAt": "2026-08-22T10:36:12+09:00",
  "updatedAt": "2026-08-22T10:38:02+09:00"
}
```

## エンドポイント

### `GET /kitchen/orders`

キッチン用スナップショットを取得します。`statuses=ACCEPTED,COOKING,READY`、`updatedAfter`、`cursor`、`limit` を指定可能。レスポンスは `{ orders, nextCursor, serverTime }`。端末起動時と再接続時に必ず呼びます。

### `PATCH /kitchen/orders/{orderId}/status`

```http
Idempotency-Key: device-7:ord_01J:COOKING:3
```

```json
{ "to": "COOKING", "expectedVersion": 3, "deviceId": "kitchen-07" }
```

成功時は更新後の注文を返します。同じキー・同じ内容の再送は同じ成功結果を返します。現在版が異なる場合は `409 VERSION_CONFLICT` と最新注文、遷移不可は `409 INVALID_TRANSITION`、キーの内容が以前と異なる場合は `422 IDEMPOTENCY_KEY_REUSED` を返します。

### `GET /kitchen/orders/{orderId}/history`

`fromStatus`、`toStatus`、`actorType`、`actorId`、`deviceId`、`occurredAt`、`requestId` を持つ追記専用履歴を時系列で返します。

### `GET /kitchen/events`

SSEを基本とし、`Last-Event-ID` を受け取ります。イベントは少なくとも一回配送されるため、クライアントは `eventId` で重複排除します。保持期限外のIDには `410 RESYNC_REQUIRED` を返し、クライアントは注文一覧を再取得します。

## イベント

状態更新と同一トランザクションでOutboxへ保存します。

```json
{
  "eventId": "evt_01J...",
  "type": "order.ready",
  "schemaVersion": 1,
  "occurredAt": "2026-08-22T10:48:40+09:00",
  "orderId": "ord_01J...",
  "orderNumber": "A-1842",
  "orderVersion": 4,
  "requestedPickupAt": "2026-08-22T10:50:00+09:00"
}
```

`order.accepted`、`order.cooking`、`order.ready`、`order.picked_up` を定義します。通知、会員証、カスタマーモニターは `order.ready` を購読し、それぞれが `eventId` で冪等に処理します。

## 安全性

- API認証に加え、店舗・端末のスコープを検証する
- 更新処理は注文行の版確認、履歴追加、Outbox追加を単一トランザクションで行う
- 注文番号ではなく `orderId` を更新キーに使う
- ログに決済情報、会員の個人情報、自由記述を無加工で出さない

## メニュー画像

管理画面では端末内の画像選択と、モバイル・タブレットの背面カメラ撮影を提供します。追加時と商品情報修正時に同じ画像編集UIを使用します。

- 元画像はオブジェクトストレージへ保存し、商品レコードには画像IDと表示用URLだけを保持する
- JPEG、PNG、WebPを受け付け、上限10MBとする
- アップロード後に表示用サイズへ変換し、ファイル形式・実データ・画像寸法をサーバー側でも検査する
- 差し替えは新画像の保存完了後に参照先を切り替え、旧画像は猶予期間後に削除する
- スマレジ商品画像へ同期する場合も、COMPASSION WORLD側の画像IDを正本として同期状態を記録する
