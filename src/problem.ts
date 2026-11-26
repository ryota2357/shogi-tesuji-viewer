import type { Move, Position } from "./shogi.ts";

export type Problem = {
  /** Stable across extractions, so it keys the saved marks: "<category path>:<Title in the source data>" */
  id: string;
  title: string;
  /** Category path, e.g. ["双玉問題", "即詰みの手筋"] */
  path: string[];
  start: Position;
  /**
   * The move that led to the problem position, present only when the source data comments on it.
   * The other moves before the position only set up the board and are dropped.
   */
  lastMove: Move | null;
  /** Comments shown with the problem position */
  prompt: string[];
  /** The solution. 先手 always moves first, which the exports in kifu.ts rely on. */
  moves: Move[];
};

export const categoryOf = (p: Problem) => p.path.join(" / ");

/** The move played just before the position after `step` moves of the solution */
export const moveBefore = (p: Problem, step: number): Move | null => (step > 0 ? p.moves[step - 1] : p.lastMove);
