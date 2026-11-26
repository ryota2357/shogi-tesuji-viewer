import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Board, type Selection } from "./Board.tsx";
import { piyoLink, toKif } from "./kif.ts";
import type { Problem } from "./problem.ts";
import { applyMove, type HandKind, type Move, moveLabel, type Position, type Square, sameSquare, sqIndex } from "./shogi.ts";
import { loadStore, type Mark, type RandomPool, type Store, saveStore } from "./storage.ts";

const groupKey = (p: Problem) => p.path.join(" / ");

/** スマホ・タブレットならアプリ版のぴよ将棋、PC なら WEB 版（ぴよ将棋w）で開く */
const IS_MOBILE = /iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

/** container の中だけをスクロールして要素を見せる（scrollIntoView はページ全体までスクロールしてしまうため） */
function scrollIntoContainer(container: HTMLElement | null, selector: string, smooth: boolean) {
  const el = container?.querySelector<HTMLElement>(selector);
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const delta = r.top < c.top ? r.top - c.top - 8 : r.bottom > c.bottom ? Math.min(r.bottom - c.bottom + 8, r.top - c.top - 8) : 0;
  if (delta !== 0) container.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
}

const POOL_LABEL: Record<RandomPool, string> = { all: "すべて", none: "無印", ok: "○", ng: "×" };

export function App({ problems }: { problems: Problem[] }) {
  const [store, setStore] = useState<Store>(loadStore);
  const [idx, setIdx] = useState(() => {
    const fromHash = decodeURIComponent(location.hash.slice(1));
    const i = problems.findIndex((p) => p.id === (fromHash || store.last));
    return i >= 0 ? i : 0;
  });
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  /** 盤上で指して進めた直後だけ、相手の応手を自動で指す */
  const [autoReplyAt, setAutoReplyAt] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const problem = problems[idx];
  const moves = problem.moves;
  const positions = useMemo(() => {
    const ps: Position[] = [problem.start];
    for (const mv of problem.moves) ps.push(applyMove(ps[ps.length - 1], mv));
    return ps;
  }, [problem]);
  const pos = positions[step];
  const last = step > 0 ? moves[step - 1] : problem.lastMove;
  const atEnd = step === moves.length;
  const turn = atEnd ? null : moves[step].side;

  useEffect(() => saveStore(store), [store]);
  useEffect(() => {
    history.replaceState(null, "", `#${encodeURIComponent(problem.id)}`);
    document.title = `${problem.title} - 将棋の手筋`;
    setStore((s) => ({ ...s, last: problem.id }));
  }, [problem]);

  useEffect(() => {
    if (autoReplyAt !== step || atEnd || moves[step].side !== "g") return;
    const t = setTimeout(() => {
      setStep(step + 1);
      setAutoReplyAt(null);
    }, 450);
    return () => clearTimeout(t);
  }, [autoReplyAt, step, problem]);

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  };

  const setMark = (mark: Mark | null) =>
    setStore((s) => {
      const status = { ...s.status };
      if (mark) status[problem.id] = mark;
      else delete status[problem.id];
      return { ...s, status };
    });
  const toggleMark = (mark: Mark) => setMark(store.status[problem.id] === mark ? null : mark);

  /** 手順上の位置を移動する（盤上の入力以外はすべてこれを通す） */
  const jump = (s: number) => {
    setStep(Math.max(0, Math.min(moves.length, s)));
    setSelection(null);
    setAutoReplyAt(null);
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= problems.length) return;
    setIdx(i);
    setStep(0);
    setSelection(null);
    setAutoReplyAt(null);
    setDrawer(false);
  };

  const random = () => {
    const pool = store.randomPool;
    const candidates = problems
      .map((p, i) => [store.status[p.id] ?? "none", i] as const)
      .filter(([m, i]) => i !== idx && (pool === "all" || m === pool))
      .map(([, i]) => i);
    if (candidates.length === 0) return showToast(`「${POOL_LABEL[pool]}」の問題はありません`);
    goTo(candidates[Math.floor(Math.random() * candidates.length)]);
  };

  const jumpGroup = (dir: 1 | -1) => {
    const key = groupKey(problem);
    if (dir === 1) {
      const i = problems.findIndex((p, j) => j > idx && groupKey(p) !== key);
      if (i >= 0) goTo(i);
      return;
    }
    const first = problems.findIndex((p) => groupKey(p) === key);
    if (first < idx) return goTo(first);
    if (first > 0) goTo(problems.findIndex((p) => groupKey(p) === groupKey(problems[first - 1])));
  };

  const copyKif = async () => {
    await navigator.clipboard.writeText(toKif(problem));
    showToast("棋譜をコピーしました（解説付き）");
  };

  // ---- 盤上の入力: 想定手順どおりなら進む ----

  const tryMove = (from: Square | null, to: Square, dropKind: HandKind | null) => {
    setSelection(null);
    const expected: Move = moves[step];
    const ok = sameSquare(expected.to, to) && (from === null ? expected.from === null && expected.kind === dropKind : sameSquare(expected.from, from));
    if (!ok) {
      showToast("想定手順とは違う手です（→ で次の手を表示）");
      return;
    }
    setStep(step + 1);
    setAutoReplyAt(expected.side === "s" ? step + 1 : null);
  };

  const onSquare = (sq: Square) => {
    if (!turn) return;
    const pc = pos.board[sqIndex(sq)];
    if (pc?.side === turn) {
      setSelection(selection?.type === "square" && sameSquare(selection.sq, sq) ? null : { type: "square", sq });
    } else if (selection?.type === "square") {
      tryMove(selection.sq, sq, null);
    } else if (selection?.type === "hand" && !pc) {
      tryMove(null, sq, selection.kind);
    }
  };

  const onHand = (kind: HandKind) => setSelection(selection?.type === "hand" && selection.kind === kind ? null : { type: "hand", kind });

  // ---- キーボード ----

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLSelectElement) return;
    if (help) {
      if (e.key === "Escape" || e.key === "?") setHelp(false);
      return;
    }
    const actions: Record<string, () => void> = {
      ArrowRight: () => jump(step + 1),
      l: () => jump(step + 1),
      ArrowLeft: () => jump(step - 1),
      h: () => jump(step - 1),
      ArrowDown: () => goTo(idx + 1),
      j: () => goTo(idx + 1),
      ArrowUp: () => goTo(idx - 1),
      k: () => goTo(idx - 1),
      "]": () => jumpGroup(1),
      "[": () => jumpGroup(-1),
      Home: () => jump(0),
      g: () => jump(0),
      End: () => jump(moves.length),
      G: () => jump(moves.length),
      " ": () => (atEnd ? goTo(idx + 1) : jump(step + 1)),
      o: () => toggleMark("ok"),
      x: () => toggleMark("ng"),
      r: random,
      c: () => void copyKif(),
      "?": () => setHelp(true),
      Escape: () => (drawer ? setDrawer(false) : setSelection(null)),
    };
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const extraActions = (
    <>
      <button type="button" onClick={() => void copyKif()} title="解説付きの棋譜 (KIF) をコピー (c)">
        棋譜コピー
      </button>
      <a
        class="button"
        href={piyoLink(problem, step, IS_MOBILE)}
        target={IS_MOBILE ? undefined : "_blank"}
        rel="noreferrer"
        title="表示中の局面をぴよ将棋で開く（解説は付きません）"
      >
        {IS_MOBILE ? "ぴよ将棋で開く" : "ぴよ将棋wで開く"}
      </a>
    </>
  );

  const mark = store.status[problem.id];
  return (
    <div class={`app ${drawer ? "drawer-open" : ""}`}>
      <Sidebar
        problems={problems}
        current={idx}
        store={store}
        onSelect={goTo}
        onRandom={random}
        onPool={(randomPool) => setStore((s) => ({ ...s, randomPool }))}
        extra={extraActions}
      />
      <div class="drawer-backdrop" onClick={() => setDrawer(false)} />
      <main>
        <header class="topbar">
          <button type="button" class="menu-button" onClick={() => setDrawer(true)} aria-label="問題一覧">
            ☰
          </button>
          <div class="title-block">
            <div class="crumbs">
              {problem.path.join(" / ")}
              <span class="count">
                {" "}
                {idx + 1} / {problems.length}
              </span>
            </div>
            <h1>{problem.title}</h1>
          </div>
          <div class="marks" role="group" aria-label="記録">
            <button type="button" class={`mark-button ${mark === "ok" ? "on ok" : ""}`} onClick={() => toggleMark("ok")} title="○ を付ける (o)">
              ○
            </button>
            <button type="button" class={`mark-button ${mark === "ng" ? "on ng" : ""}`} onClick={() => toggleMark("ng")} title="× を付ける (x)">
              ×
            </button>
          </div>
        </header>

        <div class="content">
          <section class="board-col">
            <Board pos={pos} lastTo={last?.to ?? null} lastFrom={last?.from ?? null} selection={selection} turn={turn} onSquare={onSquare} onHand={onHand} />
            <div class="controls">
              <button type="button" onClick={() => jump(0)} title="最初 (Home / g)">
                ⏮
              </button>
              <button type="button" onClick={() => jump(step - 1)} disabled={step === 0} title="戻る (← / h)">
                ◀
              </button>
              <span class="step">
                {step} / {moves.length}
              </span>
              <button type="button" onClick={() => jump(step + 1)} disabled={atEnd} title="進む (→ / l)">
                ▶
              </button>
              <button type="button" onClick={() => jump(moves.length)} title="最後 (End / G)">
                ⏭
              </button>
              <span class="sep" />
              <button type="button" onClick={() => goTo(idx - 1)} disabled={idx === 0} title="前の問題 (↑ / k)">
                ← 前
              </button>
              <button type="button" class="primary" onClick={() => goTo(idx + 1)} disabled={idx === problems.length - 1} title="次の問題 (↓ / j、最後の局面で Space)">
                次<span class="wide-only">の問題</span> →
              </button>
            </div>
            <div class="controls secondary desktop-only">
              {extraActions}
              <span class="sep" />
              <button type="button" onClick={() => setHelp(true)} title="キーボード操作 (?)">
                ?
              </button>
            </div>
          </section>

          <section class="comment-col">
            <Transcript problem={problem} step={step} onJump={jump} />
          </section>
        </div>
      </main>
      {help && <Help onClose={() => setHelp(false)} />}
      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}

function Transcript({ problem, step, onJump }: { problem: Problem; step: number; onJump: (s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => scrollIntoContainer(ref.current, ".entry.current", true), [step, problem]);
  const moves = problem.moves;
  const remaining = moves.length - step;
  return (
    <div class="transcript" ref={ref}>
      <div class={`entry ${step === 0 ? "current" : ""}`} onClick={() => onJump(0)}>
        <div class="move">
          問題図
          {problem.lastMove && <span class="sub">（直前の手 {moveLabel(problem.lastMove, null)}）</span>}
        </div>
        {problem.prompt.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>
      {moves.slice(0, step).map((mv, i) => (
        <div key={i} class={`entry ${i + 1 === step ? "current" : ""} ${mv.comments.length === 0 ? "bare" : ""}`} onClick={() => onJump(i + 1)}>
          <div class="move">
            <span class="num">{i + 1}</span> {moveLabel(mv, i === 0 ? problem.lastMove : moves[i - 1])}
          </div>
          {mv.comments.map((c, j) => (
            <p key={j}>{c}</p>
          ))}
        </div>
      ))}
      <div class="remaining">{remaining > 0 ? `あと ${remaining} 手（→ / Space、または盤上で指して進む）` : "— 終了 —（Space で次の問題）"}</div>
    </div>
  );
}

type SidebarProps = {
  problems: Problem[];
  current: number;
  store: Store;
  onSelect: (i: number) => void;
  onRandom: () => void;
  onPool: (pool: RandomPool) => void;
  /** スマホ表示のときだけ一覧の上に出す操作 */
  extra: ComponentChildren;
};

function Sidebar({ problems, current, store, onSelect, onRandom, onPool, extra }: SidebarProps) {
  const groups = useMemo(() => {
    const gs: { key: string; items: number[] }[] = [];
    problems.forEach((p, i) => {
      const key = groupKey(p);
      if (gs.at(-1)?.key !== key) gs.push({ key, items: [] });
      gs[gs.length - 1].items.push(i);
    });
    return gs;
  }, [problems]);
  const currentKey = groupKey(problems[current]);
  const [open, setOpen] = useState<Set<string>>(() => new Set([currentKey]));
  useEffect(() => setOpen((o) => (o.has(currentKey) ? o : new Set(o).add(currentKey))), [currentKey]);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => scrollIntoContainer(ref.current, ".problem.current", false), [current, open]);

  const count = (m: Mark, items?: number[]) => (items ?? problems.map((_, i) => i)).filter((i) => store.status[problems[i].id] === m).length;
  const toggle = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <nav class="sidebar" ref={ref}>
      <div class="sidebar-actions mobile-only">{extra}</div>
      <div class="summary">
        <span>
          <span class="ok">○ {count("ok")}</span> <span class="ng">× {count("ng")}</span> <span class="muted">/ {problems.length}</span>
        </span>
        <span class="random">
          <select value={store.randomPool} onChange={(e) => onPool(e.currentTarget.value as RandomPool)} title="ランダム出題の対象">
            {(Object.keys(POOL_LABEL) as RandomPool[]).map((k) => (
              <option key={k} value={k}>
                {POOL_LABEL[k]}
              </option>
            ))}
          </select>
          <button type="button" onClick={onRandom} title="ランダムに出題 (r)">
            ランダム
          </button>
        </span>
      </div>
      {groups.map((g) => {
        const isOpen = open.has(g.key);
        return (
          <div class="group" key={g.key}>
            <button type="button" class={`group-head ${g.key === currentKey ? "current" : ""}`} onClick={() => toggle(g.key)}>
              <span>
                {isOpen ? "▾" : "▸"} {g.key}
              </span>
              <span class="muted">
                {count("ok", g.items)}/{g.items.length}
              </span>
            </button>
            {isOpen &&
              g.items.map((i) => {
                const p = problems[i];
                const m = store.status[p.id];
                return (
                  <button type="button" key={p.id} class={`problem ${i === current ? "current" : ""}`} onClick={() => onSelect(i)}>
                    <span class={`mark ${m ?? ""}`}>{m === "ok" ? "○" : m === "ng" ? "×" : ""}</span>
                    {p.title}
                  </button>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["→ / l, ← / h", "1 手進む / 戻る"],
    ["Home / g, End / G", "最初 / 最後の局面へ"],
    ["Space", "進む。最後の局面なら次の問題へ"],
    ["↓ / j, ↑ / k", "次の問題 / 前の問題"],
    ["] / [", "次のカテゴリ / 前のカテゴリ（カテゴリ内なら先頭へ）"],
    ["o / x", "○ / × を付ける（もう一度押すと外す）"],
    ["r", "ランダムに出題（対象は問題一覧の上で選択）"],
    ["c", "棋譜をコピー（ぴよ将棋の「クリップボードから棋譜を読み込む」で解説付きで読める）"],
    ["Esc", "選択解除・閉じる"],
    ["?", "このヘルプ"],
  ];
  return (
    <div class="overlay" onClick={onClose}>
      <div class="help" onClick={(e) => e.stopPropagation()}>
        <h2>キーボード操作</h2>
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="muted">盤上の駒（または持ち駒）をクリックしてから移動先をクリックすると、想定手順どおりの手なら局面が進み、相手の応手も自動で指されます。</p>
      </div>
    </div>
  );
}
