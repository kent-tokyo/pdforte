# pdforte

[English](README.md) | [中文](README_zh.md)

軽量・高速PDFエディタ。Tauri v2 + React + PDF.js 製。

## 競合との比較

| | pdforte | Adobe Acrobat | Smallpdf / PDF24 | Stirling PDF | Electron系アプリ |
|---|---|---|---|---|---|
| **価格** | 無料 / オープンソース | 月額2,000円〜 | 無料〜サブスク | 無料（自己ホスト） | 様々 |
| **プライバシー** | 完全オフライン | クラウド同期 | ファイルをクラウドにアップロード | 自己ホスト | 様々 |
| **バイナリサイズ** | ~5〜15 MB | ~2 GB | Webアプリ | Dockerイメージ | ~150 MB |
| **メモリ使用量** | ~50 MB | ~500 MB | N/A | N/A | ~200 MB |
| **CJKフォント** | 内蔵（Noto） | 内蔵 | 限定的 | 限定的 | 限定的 |
| **オフラインOCR** | Tesseract | ✓ | ✗ | ✓ | 少ない |
| **AI翻訳** | ✓（DeepL/GPT/Claude） | ✗ | ✗ | ✗ | ✗ |
| **ネイティブアプリ** | ✓（Tauri） | ✓ | ✗ | ✗ | 部分的 |

**主な優位性:**
- **サブスク不要** — Apache 2.0 オープンソース、ペイウォールなし
- **プライバシー優先** — PDFがマシン外に出ない、テレメトリーなし
- **超軽量** — Electron比10分の1、Acrobat比100分の1のバイナリサイズ
- **CJK完全対応** — Noto CJKフォントを同梱、日本語・中国語・韓国語テキストボックスが正しく保存される
- **オールインワン** — Acrobat（注釈/セキュリティ）・Smallpdf（圧縮/結合/分割）・Stirling PDF（ページ操作）・LibreOffice連携変換を1本で代替
- **AI内蔵** — DeepL・OpenAI・Claude APIによる翻訳機能を搭載

## 特徴

### 表示・ナビゲーション
- PDF.jsによる高品質レンダリング（HiDPI / Retina対応）
- 連続スクロール表示（遅延ロードで高速）
- ズーム 50〜500%、フィット幅、フィットページ
- キーボードナビゲーション（矢印キー、Page Up/Down）
- ページサムネイルサイドバー（現在ページをアクセント色でハイライト、自動スクロール）
- しおり・目次パネル（展開/折りたたみツリー、現在ページインジケーター付き）
- 全文検索（前後ナビゲーション付き）

### 注釈・マークアップ
- **テキストボックス** — ドラッグで配置、リサイズ、インライン編集（CJKフォント対応）
  - インラインフォーマットツールバー: フォント・サイズ・文字色・背景色・Bold・Italic
- **ハイライト / 下線 / 取り消し線** — テキスト選択後に適用
- **図形描画** — 矩形・楕円・線・矢印・多角形（右クリックで確定）
- **フリーハンド描画** — 鉛筆ツール（色・線幅・不透明度設定可）
- **画像の追加** — JPEG/PNG をページ上に配置、リサイズ対応
- **署名** — マウス・トラックパッドで手書き
- **スタンプ** — 画像をスタンプとして挿入（透明度調整可）
- **付箋 (Sticky Note)** — 📌 アイコンをクリックしてポップアップ展開/折りたたみ
- **吹き出し (Callout)** — テキストボックス＋ドラッグ可能な矢印テール
- **Undo / Redo** — Ctrl+Z / Ctrl+Y（無制限）
- **注釈一覧パネル** — サイドバー📝タブで全注釈をリスト表示・クリックでジャンプ
- **プロパティパネル** — 選択中注釈の色・サイズ・透明度を編集
- **注釈エクスポート/インポート** — `.annot` JSON形式で保存・復元

### 編集
- 既存テキスト編集（オーバーレイ方式）
- ページ並び替え・削除（ドラッグ＆ドロップ）
- ページ回転（ページ単位で90°回転）
- PDF結合（複数ファイルを1つに）
- PDF分割（ページ範囲指定）
- 白紙ページ挿入
- **透かし追加** — 対角テキストウォーターマーク（フォント・色・不透明度・回転角度設定可）
- **ヘッダー・フッター追加** — ページ番号を6箇所に挿入（`{n}`・`{total}` マクロ対応）

### 変換・エクスポート
- PDF → Word (.docx) / Excel (.xlsx) / PowerPoint (.pptx)（LibreOffice経由）
- PDF → JPEG / PNG（ページ単位）
- **テキストとして保存** — PDF全文を .txt ファイルとして書き出し
- Word / Excel / PowerPoint → PDF（LibreOffice経由）
- 画像（JPEG/PNG）→ PDF
- **PDFを作成** — 画像（JPEG/PNG）またはテキストから新規PDF生成
- **PDFスキャナー** — 画像を選択・並び替え・PDF化（A4/Letter/元サイズ）

### OCR
- **テキスト抽出** — Tesseractで指定ページをOCR → テキストファイル保存
- **テキストレイヤー追加** — スキャンPDFを検索可能なPDFに変換（Tesseract PDF出力）

### AIツール
- **PDF翻訳** — DeepL / OpenAI / Claude APIでページを翻訳。
  テキストブロックを元位置に TextBoxAnnotation として重ねて配置。
- 対応言語：日本語・英語・中国語・韓国語・ドイツ語・フランス語・スペイン語・イタリア語・ポルトガル語

### セキュリティ
- **暗号化PDFを開く** — パスワードダイアログが自動表示、誤入力時は再試行ヒントを表示
- パスワード保護（ユーザー・オーナーパスワード、AES-256 / qpdf）
- 印刷・コピー禁止設定
- **パスワードの削除** — パスワード保護を解除してクリーンなPDFを保存
- **PDFのフラット化** — 注釈をページ内容に焼き込み、編集レイヤーを除去
- **PDFサニタイズ** — JavaScript / OpenAction / 埋め込みファイルを除去
- **署名の検証** — AcroForm署名フィールドの情報を表示
- **メタデータ編集** — タイトル・作成者・件名・キーワード等を読み書き・削除

### その他
- 印刷ダイアログ（ページ範囲・用紙サイズ・向き・部数）
- ファイルドロップ（ウィンドウへのドラッグ＆ドロップでPDFを開く）
- 最近使ったファイル一覧（Acrobat風ホーム画面）
- **閲覧モード** — ツールバー・サイドバーを非表示にして集中閲覧（Ctrl+Shift+H / Escで終了）
- Adobe Acrobat準拠のメニュー構成（ファイル・編集・表示・ウィンドウ）
- **10言語対応**：日本語・英語・中文(簡体/繁体)・한국어・Italiano・Français・Deutsch・Español・Português
- VS Codeライクなファイルエクスプローラーサイドバー

## なぜ Tauri？

| | pdforte (Tauri) | Electron |
|---|---|---|
| バイナリサイズ | ~5〜15 MB | ~150 MB |
| メモリ使用量 | ~50 MB | ~200 MB |
| WebView | OS標準 | Chromium同梱 |

## 動作要件

- **Node.js** 18+
- **Rust** 1.70+
- [Tauri v2 前提条件](https://tauri.app/start/prerequisites/)

オプション（対応機能を使う場合）:
- **LibreOffice** — Office ↔ PDF変換
  macOS: `brew install --cask libreoffice`
  Ubuntu: `sudo apt install libreoffice`
- **Tesseract** — OCR・テキストレイヤー追加
  macOS: `brew install tesseract tesseract-lang`
  Ubuntu: `sudo apt install tesseract-ocr`
- **qpdf** — PDFパスワード保護
  macOS: `brew install qpdf`
  Ubuntu: `sudo apt install qpdf`

## ビルド方法

```bash
git clone https://github.com/your-org/pdforte.git
cd pdforte
npm install
npm run tauri build
```

開発サーバー:
```bash
npm run tauri dev
```

## 設定

`~/.config/pdforte/settings.json`:

```json
{
  "language": "ja",
  "theme": "dark",
  "translationEngine": "deepl",
  "translationApiKey": "YOUR_API_KEY",
  "defaultZoom": 1.0
}
```

設定UIはツールバーの ⚙ ボタンから開けます。

## AI翻訳の使い方

1. PDFを開く
2. **ツールメニュー → PDFを翻訳**（または 🌐 ボタン）
3. 翻訳先言語とページ範囲を選択
4. ⚙ 設定からAPIキーを入力（未設定の場合）
5. **翻訳開始**をクリック

翻訳結果は元のテキスト位置にTextBoxAnnotationとして挿入されます。
対応エンジン：**DeepL**・**OpenAI GPT-4o-mini**・**Claude Haiku**

## PDFスキャナーの使い方

1. **ツールメニュー → PDFスキャナー**
2. **＋ 画像を追加** で JPEG/PNG を選択
3. ↑↓ボタンで順序を調整
4. 用紙サイズを選択（元サイズ / A4 / Letter）
5. **PDFを作成** をクリックして保存先を指定

## 注釈のエクスポート/インポート

サイドバーの **📝 注釈** タブを開き、上部の **↑**（エクスポート）/ **↓**（インポート）ボタンを使用します。
形式は独自の `.annot` JSON ファイルです。

## ライセンス

Apache 2.0 — 詳細は [LICENSE](LICENSE) を参照。

帰属表示: [PDF.js](https://mozilla.github.io/pdf.js/) (Apache 2.0)、[Noto Fonts](https://fonts.google.com/noto) (SIL OFL 1.1)

## 貢献

Issue / Pull Request を歓迎します。
