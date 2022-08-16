import { delay } from "../util/Utils";
import { countPlayers, enumerateMoves, GameState, Move, reduceGameState } from "./Board";

function evaluateMove(state: GameState, move: Move): number {
  const result = reduceGameState(state, move);
  const counts = countPlayers(result.board);
  const me = counts[state.team];
  const others = counts.filter((v,t)=> t !== state.team).reduce((a,b)=>a+b);
  return me - others;
}

export async function makeMove(state: GameState): Promise<Move | null> {
  let bestMoves: Move[] = [];
  let bestScore = -Infinity;
  for (const move of enumerateMoves(state)) {
    const score = evaluateMove(state, move);
    if (score > bestScore) {
      bestMoves = [move];
      bestScore = score;
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  await delay(100);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || null;
}