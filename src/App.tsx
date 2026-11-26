import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Board, type Selection } from "./Board.tsx";
import { Help } from "./Help.tsx";
import { piyoLink, toKif } from "./kifu.ts";
import { categoryOf, moveBefore, type Problem } from "./problem.ts";
import { applyMove, type Position, type Square, sameSquare, sqIndex } from "./shogi.ts";
import { POOL_LABEL, Sidebar } from "./Sidebar.tsx";
import { loadStore, type Mark, type Store, saveStore } from "./storage.ts";
import { Transcript } from "./Transcript.tsx";

// Phones and tablets probably have the ぴよ将棋 app; a PC opens the web version (ぴよ将棋w).
// iPadOS reports itself as a Mac, hence the touch check.
const PIYO_TARGET =
  /iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) ? "app" : "web";

const AUTO_REPLY_DELAY_MS = 450;

export function App({ problems }: { problems: Problem[] }) {
  const [store, setStore] = useState<Store>(loadStore);
  const [index, setIndex] = useState(() => {
    const id = decodeURIComponent(location.hash.slice(1)) || store.last;
    return Math.max(0, problems.findIndex((p) => p.id === id));
  });
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  // Set to the step at which the opponent replies automatically, right after the user plays a move on the board.
  const [autoReplyAt, setAutoReplyAt] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const problem = problems[index];
  const moves = problem.moves;
  const positions = useMemo(() => {
    const ps: Position[] = [problem.start];
    for (const mv of moves) ps.push(applyMove(ps[ps.length - 1], mv));
    return ps;
  }, [problem]);
  const atEnd = step === moves.length;
  const last = moveBefore(problem, step);
  const mark = store.marks[problem.id];

  useEffect(() => saveStore(store), [store]);
  useEffect(() => {
    history.replaceState(null, "", `#${encodeURIComponent(problem.id)}`);
    document.title = `${problem.title} - 将棋の手筋`;
    setStore((s) => ({ ...s, last: problem.id }));
  }, [problem]);

  useEffect(() => {
    if (autoReplyAt !== step) return;
    const t = setTimeout(() => {
      setStep(step + 1);
      setAutoReplyAt(null);
    }, AUTO_REPLY_DELAY_MS);
    return () => clearTimeout(t);
  }, [autoReplyAt, step]);

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  };

  const toggleMark = (m: Mark) =>
    setStore((s) => {
      const marks = { ...s.marks };
      if (marks[problem.id] === m) delete marks[problem.id];
      else marks[problem.id] = m;
      return { ...s, marks };
    });

  /** Moves to a step of the solution. Everything but playing on the board goes through here. */
  const jump = (to: number) => {
    setStep(Math.max(0, Math.min(moves.length, to)));
    setSelection(null);
    setAutoReplyAt(null);
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= problems.length) return;
    setIndex(i);
    jump(0);
    setDrawerOpen(false);
  };

  const goToRandom = () => {
    const pool = store.randomPool;
    const candidates = problems.flatMap((p, i) => (i !== index && (pool === "all" || (store.marks[p.id] ?? "none") === pool) ? [i] : []));
    if (candidates.length === 0) return showToast(`「${POOL_LABEL[pool]}」の問題はありません`);
    goTo(candidates[Math.floor(Math.random() * candidates.length)]);
  };

  /** Next: the first problem of the next category. Previous: the first problem of this category, or of the previous one when already there. */
  const goToCategory = (dir: 1 | -1) => {
    const current = categoryOf(problem);
    const first = problems.findIndex((p) => categoryOf(p) === current);
    if (dir === 1) {
      const next = problems.findIndex((p, i) => i > index && categoryOf(p) !== current);
      if (next >= 0) goTo(next);
    } else if (first < index) {
      goTo(first);
    } else if (first > 0) {
      const previous = categoryOf(problems[first - 1]);
      goTo(problems.findIndex((p) => categoryOf(p) === previous));
    }
  };

  const copyKif = async () => {
    await navigator.clipboard.writeText(toKif(problem));
    showToast("棋譜をコピーしました（解説付き）");
  };

  // ---- Playing on the board: a move advances the solution only when it is the next move of it ----

  const tryMove = (source: NonNullable<Selection>, to: Square) => {
    setSelection(null);
    const expected = moves[step];
    const matches =
      sameSquare(expected.to, to) &&
      (source.type === "square" ? sameSquare(expected.from, source.sq) : expected.from === null && expected.kind === source.kind);
    if (!matches) {
      showToast("想定手順とは違う手です（→ で次の手を表示）");
      return;
    }
    setStep(step + 1);
    const reply = moves[step + 1];
    setAutoReplyAt(expected.side === "s" && reply?.side === "g" ? step + 1 : null);
  };

  const turn = atEnd ? null : moves[step].side;

  const onSquare = (sq: Square) => {
    const pc = positions[step].board[sqIndex(sq)];
    if (pc?.side === turn) {
      setSelection(selection?.type === "square" && sameSquare(selection.sq, sq) ? null : { type: "square", sq });
    } else if (selection?.type === "square" || (selection?.type === "hand" && !pc)) {
      tryMove(selection, sq);
    }
  };

  // ---- Keyboard ----

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLSelectElement) return;
    if (helpOpen) {
      if (e.key === "Escape" || e.key === "?") setHelpOpen(false);
      return;
    }
    const actions: Record<string, () => void> = {
      ArrowRight: () => jump(step + 1),
      l: () => jump(step + 1),
      ArrowLeft: () => jump(step - 1),
      h: () => jump(step - 1),
      ArrowDown: () => goTo(index + 1),
      j: () => goTo(index + 1),
      ArrowUp: () => goTo(index - 1),
      k: () => goTo(index - 1),
      "]": () => goToCategory(1),
      "[": () => goToCategory(-1),
      Home: () => jump(0),
      g: () => jump(0),
      End: () => jump(moves.length),
      G: () => jump(moves.length),
      " ": () => (atEnd ? goTo(index + 1) : jump(step + 1)),
      o: () => toggleMark("ok"),
      x: () => toggleMark("ng"),
      r: goToRandom,
      c: () => void copyKif(),
      "?": () => setHelpOpen(true),
      Escape: () => (drawerOpen ? setDrawerOpen(false) : setSelection(null)),
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

  const exportActions = (
    <>
      <button type="button" onClick={() => void copyKif()} title="解説付きの棋譜 (KIF) をコピー (c)">
        棋譜コピー
      </button>
      <a
        class="button"
        href={piyoLink(problem, step, PIYO_TARGET)}
        target={PIYO_TARGET === "web" ? "_blank" : undefined}
        rel="noreferrer"
        title="表示中の局面をぴよ将棋で開く（解説は付きません）"
      >
        {PIYO_TARGET === "app" ? "ぴよ将棋で開く" : "ぴよ将棋wで開く"}
      </a>
    </>
  );

  return (
    <div class={`app ${drawerOpen ? "drawer-open" : ""}`}>
      <Sidebar
        problems={problems}
        current={index}
        store={store}
        onSelect={goTo}
        onRandom={goToRandom}
        onRandomPool={(randomPool) => setStore((s) => ({ ...s, randomPool }))}
        mobileActions={exportActions}
      />
      <div class="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      <main>
        <header class="topbar">
          <button type="button" class="menu-button" onClick={() => setDrawerOpen(true)} aria-label="問題一覧">
            ☰
          </button>
          <div class="title-block">
            <div class="crumbs">
              {categoryOf(problem)}　{index + 1} / {problems.length}
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
            <Board
              pos={positions[step]}
              lastFrom={last?.from ?? null}
              lastTo={last?.to ?? null}
              selection={selection}
              turn={turn}
              onSquare={onSquare}
              onHand={(kind) => setSelection(selection?.type === "hand" && selection.kind === kind ? null : { type: "hand", kind })}
            />
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
              <span class="spacer" />
              <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} title="前の問題 (↑ / k)">
                ← 前
              </button>
              <button type="button" class="primary" onClick={() => goTo(index + 1)} disabled={index === problems.length - 1} title="次の問題 (↓ / j、最後の局面で Space)">
                次<span class="wide-only">の問題</span> →
              </button>
            </div>
            <div class="controls secondary desktop-only">
              {exportActions}
              <span class="spacer" />
              <button type="button" onClick={() => setHelpOpen(true)} title="キーボード操作 (?)">
                ?
              </button>
            </div>
          </section>

          <section class="comment-col">
            <Transcript problem={problem} step={step} onJump={jump} />
          </section>
        </div>
      </main>
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}
