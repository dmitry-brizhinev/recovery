import { atPos, GameState, Move, neighbours } from "./Board";
import { Team } from "./Constants";

function* enumerateMoves(state: GameState): Generator<Move, void, undefined> {
  for (const [r, row] of state.board.entries()) {
    for (const [c, team] of row.entries()) {
      if (team !== state.team) continue;

      for (const to of neighbours({r,c})) {
        const target = atPos(state.board, to);
        if (target === Team.Empty) {
          yield {from:{r,c}, to};
        }
      }
    }
  }
}

export async function makeMove(state: GameState): Promise<Move | null> {
  for (const move of enumerateMoves(state)) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return move;
  }
  return null;
}