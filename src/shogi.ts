// A minimal model of shogi positions and moves.
//
// Legality is deliberately not checked: the source data builds each problem position by moving
// pieces with no regard for the rules, so the model only does what that requires — move a piece,
// and put a captured piece (even a king) into the capturer's hand.

export type Side = "s" | "g"; // s: 先手 (black, moves up the board), g: 後手

export const HAND_KINDS = ["飛", "角", "金", "銀", "桂", "香", "歩"] as const;
export type HandKind = (typeof HAND_KINDS)[number];
export type PromotedKind = "と" | "成香" | "成桂" | "成銀" | "馬" | "龍";
export type Kind = HandKind | "玉" | PromotedKind;

const PROMOTE: Partial<Record<Kind, PromotedKind>> = {
  歩: "と",
  香: "成香",
  桂: "成桂",
  銀: "成銀",
  角: "馬",
  飛: "龍",
};
const UNPROMOTE: Record<PromotedKind, HandKind> = {
  と: "歩",
  成香: "香",
  成桂: "桂",
  成銀: "銀",
  馬: "角",
  龍: "飛",
};

export type Piece = { side: Side; kind: Kind };
/** file (筋) and rank (段), both 1-9 */
export type Square = { file: number; rank: number };

/**
 * Includes 玉 because the setup moves of the source data capture kings. In a problem with only one
 * king on the board (片玉), the other king stays in a hand; it is neither shown nor exported.
 */
export type Hand = Record<HandKind | "玉", number>;
export type Position = {
  /** Indexed by `sqIndex`: row-major as displayed, starting from ９一 at the top left. */
  board: (Piece | null)[];
  hands: Record<Side, Hand>;
};

export type Move = {
  side: Side;
  /** null for a drop */
  from: Square | null;
  to: Square;
  /** The piece before the move, or the dropped piece */
  kind: Kind;
  promote: boolean;
  /** The source data explicitly says 不成 (declined a possible promotion) */
  noPromote: boolean;
  comments: string[];
};

export const sqIndex = (sq: Square) => (sq.rank - 1) * 9 + (9 - sq.file);
export const sameSquare = (a: Square | null, b: Square | null) =>
  a !== null && b !== null && a.file === b.file && a.rank === b.rank;

export const isPromoted = (kind: Kind) => kind in UNPROMOTE;

export function emptyHand(): Hand {
  return { 飛: 0, 角: 0, 金: 0, 銀: 0, 桂: 0, 香: 0, 歩: 0, 玉: 0 };
}

export function hiratePosition(): Position {
  const board: (Piece | null)[] = Array(81).fill(null);
  const put = (file: number, rank: number, side: Side, kind: Kind) => {
    board[sqIndex({ file, rank })] = { side, kind };
  };
  const back: Kind[] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"];
  back.forEach((kind, i) => {
    put(9 - i, 1, "g", kind);
    put(9 - i, 9, "s", kind);
  });
  put(8, 2, "g", "飛");
  put(2, 2, "g", "角");
  put(2, 8, "s", "飛");
  put(8, 8, "s", "角");
  for (let f = 1; f <= 9; f++) {
    put(f, 3, "g", "歩");
    put(f, 7, "s", "歩");
  }
  return { board, hands: { s: emptyHand(), g: emptyHand() } };
}

/** Applies a move without checking legality. Throws if the move does not fit the position at all. */
export function applyMove(pos: Position, mv: Move): Position {
  const next: Position = { board: pos.board.slice(), hands: { s: { ...pos.hands.s }, g: { ...pos.hands.g } } };
  let kind: Kind;
  if (mv.from === null) {
    const dropped = mv.kind as keyof Hand;
    if (!(next.hands[mv.side][dropped] > 0)) throw new Error(`no ${dropped} in hand`);
    next.hands[mv.side][dropped]--;
    kind = mv.kind;
  } else {
    const src = next.board[sqIndex(mv.from)];
    if (!src) throw new Error("no piece on the source square");
    if (src.side !== mv.side || src.kind !== mv.kind) throw new Error("the piece on the source square differs");
    next.board[sqIndex(mv.from)] = null;
    kind = mv.promote ? (PROMOTE[src.kind] ?? src.kind) : src.kind;
  }
  const captured = next.board[sqIndex(mv.to)];
  if (captured) {
    const k = captured.kind;
    next.hands[mv.side][k in UNPROMOTE ? UNPROMOTE[k as PromotedKind] : (k as keyof Hand)]++;
  }
  next.board[sqIndex(mv.to)] = { side: mv.side, kind };
  return next;
}

// ---- Notation ----

export const FILE_ZEN = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
export const RANK_KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** Like "▲７二飛打" or "△同　玉": KI2 style, except that a drop always gets 打. */
export function moveLabel(mv: Move, prev: Move | null): string {
  const mark = mv.side === "s" ? "▲" : "△";
  const dest = prev && sameSquare(prev.to, mv.to) ? "同　" : FILE_ZEN[mv.to.file] + RANK_KAN[mv.to.rank];
  const suffix = mv.from === null ? "打" : mv.promote ? "成" : mv.noPromote ? "不成" : "";
  return mark + dest + mv.kind + suffix;
}

/** The single character drawn on the board */
export function pieceGlyph(p: Piece): string {
  switch (p.kind) {
    case "成香":
      return "杏";
    case "成桂":
      return "圭";
    case "成銀":
      return "全";
    case "玉":
      return p.side === "g" ? "王" : "玉";
    default:
      return p.kind;
  }
}
