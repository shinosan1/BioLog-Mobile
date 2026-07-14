# Changelog

BioLog Mobile の変更履歴です。

## Unreleased

### Added

- 初回利用時と利用規約・プライバシーポリシーの同意対象版改定時に、同意を求める画面を追加。

### Safety

- 同意前は健康記録用の IndexedDB を開かず、通常機能と Service Worker の登録を開始しないように変更。
- 同意記録は端末内の `localStorage` にだけ保存し、外部サーバーへ送信しない。
- 同意しない場合も既存の健康記録は削除せず、同意後は既存記録を維持して利用する。

## 0.1.0-test - 2026-06-26

### Added

- BioLog Mobile PWA の初期テスト版を追加。
- vanilla HTML / CSS / JavaScript 構成で実装。
- スマホのホーム画面追加に対応する manifest / icon / service worker を追加。
- IndexedDB による端末内保存に対応。
- 1日1件の `date_user` upsert 仕様を実装。
- 今日の記録入力、履歴表示、編集、削除を追加。
- トップ画面に主要指標サマリーを追加。
- 体重、体温、血圧、脈拍、体脂肪率、基礎代謝量のグラフタブを追加。
- JSON バックアップ書き出し / 読み込みを追加。
- UTF-8 CSV 読み込みを追加。
- ライトモード / ダークモード切り替えを追加。
- `README.md` と `OPERATION_MANUAL.md` を追加。

### Safety

- 既存 BioLog Streamlit / API / SQLite 版とは独立した `biolog_mobile` として作成。
- Docker、サーバー、npm、外部CDN、外部ライブラリは不使用。
- 個人データを含むバックアップJSONは `.gitignore` 対象。
- CSV import は全件検証後に取り込み、不正CSVは途中まで保存しない。

### Notes

- この版は public 公開でのテスト利用を想定した段階です。
- 正式運用前に、スマホ実機でホーム画面追加、オフライン起動、JSONバックアップ復元、CSV読み込みを確認してください。
