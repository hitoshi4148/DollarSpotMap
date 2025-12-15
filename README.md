# Smith-Kerns Dollar Spot 発生確率マップ

芝生の病害「Dollar Spot」の発生確率を地図上に等値線で表示するWebアプリケーションです。

## 概要

このアプリケーションは、Smith-Kernsモデルを使用してDollar Spotの発生確率を計算し、地図上に等値線（contour lines）として可視化します。

Smith-Kernsモデルは、5日間の平均気温と平均湿度の移動平均を使用して、Dollar Spotの発生確率を予測するロジスティック回帰モデルです。

## Smith-Kernsモデルの数式

### Logit計算
```
Logit(μ) = -11.4041 + (0.0894 × MEANRH) + (0.1932 × MEANAT)
```

### 確率計算
```
確率 = e^logit(μ) / (1 + e^logit(μ)) × 100
```

ここで：
- **MEANRH**: 5日間の平均相対湿度（%）
- **MEANAT**: 5日間の平均気温（摂氏）
- **e**: オイラー数（約2.718）

### モデルの有効範囲
- 平均気温: 10°C以上、35°C以下
- それ以外の温度ではモデルは無効とみなされます

## セットアップ

### NASA POWERデータ取得機能を使用する場合

NASA POWER APIからデータを取得するには、バックエンドサーバーを起動する必要があります。

1. **必要なパッケージをインストール:**
   ```bash
   pip install -r requirements.txt
   ```

2. **バックエンドサーバーを起動:**
   ```bash
   python server.py
   ```
   サーバーは `http://localhost:5000` で起動します。

3. **ブラウザで `index.html` を開きます**

## 使用方法

### 基本的な使用方法（手動入力）

1. `index.html`をブラウザで開きます
2. 5日間の平均気温（°C）と平均湿度（%）を入力します
   - 気温は10°C以上35°C以下で入力してください
3. 「確率を計算して表示」ボタンをクリックします
4. 地図上に等値線とヒートマップが表示されます

### NASA POWERデータを使用する場合

1. **バックエンドサーバーを起動**（上記のセットアップを参照）
2. 緯度・経度を入力（または「現在位置を取得」ボタンで自動入力）
3. 日付を選択（指定日を含む過去5日間のデータを取得）
4. 「NASA POWERから取得」ボタンをクリック
5. データ取得後、自動的に5日間の移動平均が計算され、UIに反映されます
6. 「確率を計算して表示」ボタンで地図上に表示

### その他の機能

- **等値線の調整**: 等値線の間隔（%）や表示範囲（km）を変更できます
- **現在位置取得**: 「現在位置を取得」ボタンで、ブラウザの位置情報を使って現在地に移動できます
- **地図クリック**: 地図をクリックすると、その位置を中心として再計算されます

## 機能

- **リアルタイム計算**: 入力値を変更すると自動的に再計算されます
- **インタラクティブマップ**: マップをクリックすると中心位置が変更されます
- **等値線表示**: 発生確率の等値線をカラーで表示（Marching Squaresアルゴリズム使用）
- **ヒートマップ表示**: 確率値に基づいた色分け表示
- **現在位置取得**: ブラウザの位置情報機能を使って現在地に移動
- **カスタマイズ可能**: 等値線間隔や表示範囲を調整可能

## 技術スタック

### フロントエンド
- **HTML5/CSS3/JavaScript**: フロントエンド
- **Leaflet**: 地図表示ライブラリ
- **OpenStreetMap**: 地図タイル
- **Turf.js**: 空間解析（将来の拡張用）

### バックエンド（オプション）
- **Python Flask**: バックエンドサーバー
- **flask-cors**: CORS対応
- **requests**: HTTPリクエスト処理
- **NASA POWER API**: 気象データ取得

## 参考資料

- [Smith-Kerns Dollar Spot Model (University of Wisconsin-Madison)](https://tdl.wisc.edu/dollar-spot-model/)
- [PLOS One論文](http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0194216)

## デプロイ

### GitHubへのアップロード

1. **GitHubリポジトリを作成**
   - GitHubにログインして、新しいリポジトリを作成します

2. **ローカルリポジトリを初期化してプッシュ**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### Render.comでの公開

1. **Render.comアカウントを作成**
   - [Render.com](https://render.com)にアクセスしてサインアップ
   - GitHubアカウントで連携すると簡単です

2. **新しいWebサービスを作成**
   - Dashboardから「New +」→「Web Service」を選択
   - GitHubリポジトリを接続

3. **サービス設定**
   - **Name**: サービスの名前（例: `smith-kerns-dollar-spot`）
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Instance Type**: Free tierでOK

4. **環境変数（オプション）**
   - 通常は不要ですが、カスタム設定が必要な場合は以下を追加できます：
     - `FLASK_DEBUG`: `false`（本番環境ではデバッグモードを無効化）

5. **デプロイ**
   - 「Create Web Service」をクリック
   - 自動的にビルドとデプロイが開始されます

6. **静的ファイルの配信**
   - Render.comはPythonアプリケーションを実行しますが、静的ファイル（HTML/CSS/JS）も配信されます
   - `index.html`は自動的にルート（`/`）で提供されます

7. **アプリケーションの動作確認**
   - デプロイが完了すると、`https://YOUR_SERVICE_NAME.onrender.com` でアクセス可能になります
   - フロントエンドとバックエンドAPIは同じドメインで動作します

### 注意事項

- Render.comの無料プランでは、アイドル状態が続くとサービスがスリープします（最初のアクセス時に起動に時間がかかります）
- NASA POWER APIは外部APIなので、レート制限に注意してください
- CORS設定は既に`flask-cors`で有効化されています

## ライセンス

このプロジェクトは教育・研究目的で作成されています。

