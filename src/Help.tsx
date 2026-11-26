const KEYS: [string, string][] = [
  ["→ / l, ← / h", "1 手進む / 戻る"],
  ["Home / g, End / G", "最初 / 最後の局面へ"],
  ["Space", "進む。最後の局面なら次の問題へ"],
  ["↓ / j, ↑ / k", "次の問題 / 前の問題"],
  ["] / [", "次のカテゴリ / 前のカテゴリ（カテゴリ内なら先頭へ）"],
  ["o / x", "○ / × を付ける（もう一度押すと外す）"],
  ["r", "ランダムに出題（対象は問題一覧の上で選択）"],
  [
    "c",
    "棋譜をコピー（ぴよ将棋の「クリップボードから棋譜を読み込む」で解説付きで読める）",
  ],
  ["Esc", "選択解除・閉じる"],
  ["?", "このヘルプ"],
];

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div class="overlay">
      <button
        type="button"
        class="overlay-backdrop"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div class="help">
        <h2>キーボード操作</h2>
        <table>
          <tbody>
            {KEYS.map(([key, action]) => (
              <tr key={key}>
                <th>{key}</th>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="muted">
          盤上の駒（または持ち駒）をクリックしてから移動先をクリックすると、想定手順どおりの手なら局面が進み、相手の応手も自動で指されます。
        </p>
      </div>
    </div>
  );
}
