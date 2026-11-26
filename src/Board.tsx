import { FILE_ZEN, HAND_KINDS, type HandKind, isPromoted, pieceGlyph, type Position, RANK_KAN, type Side, type Square, sameSquare, sqIndex } from "./shogi.ts";

export type Selection = { type: "square"; sq: Square } | { type: "hand"; kind: HandKind } | null;

type Props = {
  pos: Position;
  /** 直前に動いた駒の移動先・移動元 */
  lastTo: Square | null;
  lastFrom: Square | null;
  selection: Selection;
  /** 盤上で操作できる手番（操作できないなら null） */
  turn: Side | null;
  onSquare: (sq: Square) => void;
  onHand: (kind: HandKind) => void;
};

export function Board({ pos, lastTo, lastFrom, selection, turn, onSquare, onHand }: Props) {
  const cells = [];
  for (let rank = 1; rank <= 9; rank++) {
    for (let file = 9; file >= 1; file--) {
      const sq = { file, rank };
      const pc = pos.board[sqIndex(sq)];
      const cls = ["cell"];
      if (sameSquare(lastTo, sq)) cls.push("last-to");
      if (sameSquare(lastFrom, sq)) cls.push("last-from");
      if (selection?.type === "square" && sameSquare(selection.sq, sq)) cls.push("selected");
      cells.push(
        <div class={cls.join(" ")} key={`${file}${rank}`} onClick={() => turn && onSquare(sq)}>
          {pc && <span class={`piece ${pc.side === "g" ? "gote" : ""} ${isPromoted(pc.kind) ? "promoted" : ""}`}>{pieceGlyph(pc)}</span>}
        </div>,
      );
    }
  }
  return (
    <div class={`board-wrap ${turn ? "interactive" : ""}`}>
      <HandView side="g" pos={pos} selection={selection} active={turn === "g"} onHand={onHand} />
      <div class="files">
        {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((f) => (
          <span key={f}>{FILE_ZEN[f]}</span>
        ))}
      </div>
      <div class="board-row">
        <div class="board">{cells}</div>
        <div class="ranks">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => (
            <span key={r}>{RANK_KAN[r]}</span>
          ))}
        </div>
      </div>
      <HandView side="s" pos={pos} selection={selection} active={turn === "s"} onHand={onHand} />
    </div>
  );
}

function HandView({ side, pos, selection, active, onHand }: { side: Side; pos: Position; selection: Selection; active: boolean; onHand: (k: HandKind) => void }) {
  const hand = pos.hands[side];
  return (
    <div class={`hand hand-${side}`}>
      <span class="hand-mark" title={side === "s" ? "先手" : "後手"}>
        {side === "s" ? "☗" : "☖"}
      </span>
      {HAND_KINDS.filter((k) => hand[k] > 0).map((k) => (
        <button
          type="button"
          key={k}
          class={`hand-piece ${active && selection?.type === "hand" && selection.kind === k ? "selected" : ""}`}
          disabled={!active}
          onClick={() => onHand(k)}
        >
          <span class={`piece ${side === "g" ? "gote" : ""}`}>{k}</span>
          {hand[k] > 1 && <span class="hand-count">{hand[k]}</span>}
        </button>
      ))}
    </div>
  );
}
