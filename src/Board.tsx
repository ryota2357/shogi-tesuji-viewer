import { FILE_ZEN, HAND_KINDS, type HandKind, isPromoted, pieceGlyph, type Position, RANK_KAN, type Side, type Square, sameSquare, sqIndex } from "./shogi.ts";

/** The piece picked up to move: one on the board, or one in hand to drop */
export type Selection = { type: "square"; sq: Square } | { type: "hand"; kind: HandKind } | null;

type Props = {
  pos: Position;
  /** The previous move, highlighted */
  lastFrom: Square | null;
  lastTo: Square | null;
  selection: Selection;
  /** The side whose pieces can be operated, or null when the board is read-only. */
  turn: Side | null;
  /** Called only while `turn` is set */
  onSquare: (sq: Square) => void;
  /** Called only for the hand of `turn` */
  onHand: (kind: HandKind) => void;
};

export function Board({ pos, lastFrom, lastTo, selection, turn, onSquare, onHand }: Props) {
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

type HandProps = { side: Side; pos: Position; selection: Selection; active: boolean; onHand: (k: HandKind) => void };

function HandView({ side, pos, selection, active, onHand }: HandProps) {
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
