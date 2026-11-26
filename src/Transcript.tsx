import { useEffect, useRef } from "preact/hooks";
import { moveBefore, type Problem } from "./problem.ts";
import { scrollIntoContainer } from "./scroll.ts";
import { moveLabel } from "./shogi.ts";

type Props = { problem: Problem; step: number; onJump: (step: number) => void };

/** The moves and comments up to `step`, like a chat log; later moves stay hidden. */
export function Transcript({ problem, step, onJump }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => scrollIntoContainer(ref.current, ".entry.current", true),
    [step, problem],
  );
  const remaining = problem.moves.length - step;
  return (
    <div class="transcript" ref={ref}>
      <div class={`entry ${step === 0 ? "current" : ""}`}>
        <button type="button" class="move" onClick={() => onJump(0)}>
          問題図
          {problem.lastMove && (
            <span class="sub">
              （直前の手 {moveLabel(problem.lastMove, null)}）
            </span>
          )}
        </button>
        {problem.prompt.map((c, i) => (
          <p key={i}>{c}</p>
        ))}
      </div>
      {problem.moves.slice(0, step).map((mv, i) => (
        <div
          key={i}
          class={`entry ${i + 1 === step ? "current" : ""} ${mv.comments.length === 0 ? "bare" : ""}`}
        >
          <button type="button" class="move" onClick={() => onJump(i + 1)}>
            <span class="num">{i + 1}</span>{" "}
            {moveLabel(mv, moveBefore(problem, i))}
          </button>
          {mv.comments.map((c, j) => (
            <p key={j}>{c}</p>
          ))}
        </div>
      ))}
      <div class="remaining">
        {remaining > 0
          ? `あと ${remaining} 手（→ / Space、または盤上で指して進む）`
          : "— 終了 —（Space で次の問題）"}
      </div>
    </div>
  );
}
