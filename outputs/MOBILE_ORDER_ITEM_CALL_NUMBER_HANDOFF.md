# モバイルオーダー 商品別呼出番号対応 引き継ぎ

## 目的

モバイルオーダー、会員証、セルフレジ、キッチン管理のすべてで、商品1個ごとに同じ呼出番号と状態を表示する。

現在のモバイルオーダーは「フード1番号・ドリンク1番号」だけを返すが、キッチン管理は kitchen_units により商品1個単位で管理している。会員証プロジェクト側を商品単位へ統一する。

## 最初に行う本番データ整理

修正前に作成された未決済の現地決済モバイル注文を、物理削除せず取消状態へ変更する。

対象条件:

- orders.payment_method = STORE
- orders.status が WAITING_STORE_PAYMENT または PAYMENT_PROCESSING
- kitchen_test_orders に存在しない
- スマレジ取引IDが未設定
- Stripe注文、決済済み、受渡済みは対象外

実行手順:

1. 対象の注文ID、注文番号、作成日時、金額、会員番号を変更前に一覧化
2. orders を CANCELLED へ変更
3. order_fulfillments を CANCELLED へ変更
4. kitchen_units を CANCELLED へ変更
5. ACTIVE の order_payment_locks を RELEASED にし、理由を MOBILE_ORDER_ITEM_UNIT_MIGRATION とする
6. 対象件数と注文番号を監査ログへ保存
7. 同じ検索条件で0件になったことを確認

処理は冪等にし、実行直前に PAID、CANCELLED、EXPIRED などへ変わった注文は変更しない。

## 現在の不整合

- app/api/v1/orders/route.ts は order_fulfillments を部門ごとに1行だけ作成
- app/mobile-order/page.tsx は complete.fulfillments を表示し、キーにも department を使用
- app/api/v1/me/membership/route.ts と app/page.tsx は foodCallNumber、drinkCallNumber の2項目だけを使用
- app/api/v1/kitchen/units/route.ts は商品数量単位に対応済みだが、キッチンAPIのGET時に遅延生成している

## 正本

- 商品別呼出番号と個別状態: kitchen_units
- 部門の集約状態: order_fulfillments
- 注文全体の状態: orders
- order_fulfillments.call_number は新規の顧客表示に使わない

## 必須修正

### 注文作成

order_items 作成後、同じ注文処理内で数量分の kitchen_units を作成する。

- 商品A ×2は2ユニット・2番号
- 商品B ×1は1ユニット・1番号
- フードとドリンクは別採番
- かき氷は FOOD／デザート
- 営業日ごとに001から採番
- 再送しても重複しない

ensureUnits は旧注文の補完だけに使い、新規注文をキッチン画面表示まで待たせない。

### 採番

order_call_counters と kitchen_unit_counters の二重採番を解消する。注文作成、テスト注文、旧注文補完は同じ採番関数を利用する。

### API

注文作成、注文再取得、決済確認のレスポンスへ units 配列を追加する。各要素に unitId、orderItemId、productName、department、callNumber、callNumberLabel、status を含める。

移行期間は既存 fulfillments と units を併記可能。新UIは units を優先し、units が存在しない旧注文だけ fulfillments へフォールバックする。

### 決済完了

Stripe webhookとセルフレジ決済確認の両方で、注文の全ユニットを ACCEPTED へ遷移させる。再送時に二重遷移・二重採番しない。

### モバイルオーダー

- complete.units を商品ごとに表示
- Reactキーは unitId
- 商品名、個別番号、個別状態を表示
- 同一商品×2も2番号を表示
- 「できあがった商品から個別に呼び出します」と案内

### 会員証

foodCallNumber、drinkCallNumber の固定表示を units 配列へ置換し、商品名、番号、状態、提供予定を個別表示する。

### セルフレジ

現地決済注文の取得結果にも units を含める。決済前後で同じ番号を保持する。

## 必須試験

1. フード2商品＋ドリンク2商品で4番号
2. 同一商品×2で別番号が2件
3. 現地決済前はキッチン一覧に表示しない
4. 現地決済後、同じ番号のまま全ユニットが ACCEPTED
5. Stripe決済でも番号を保持
6. 1商品だけ完成・呼出しても他商品は調理中
7. 会員証、モバイル、セルフレジ、キッチンの番号が一致
8. かき氷がドリンクに分類されない
9. API再送で番号が増えない
10. 旧注文の表示互換が壊れない

## 完了条件

- キッチン画面を開く前から商品別番号が存在
- 全画面で同じ unitId と番号を表示
- 新規コードが部門別代表番号へ依存しない
- 修正前の未決済現地決済注文が取消済み
- 決済済み注文とテスト注文が変更されていない
