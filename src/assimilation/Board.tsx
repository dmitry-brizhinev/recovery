import {type GridCoords, HEIGHT, Team, WIDTH} from "./Constants";
import {List, Range} from 'immutable';

export const MAX_ROWS = Math.trunc(HEIGHT / Math.sqrt(3 / 4));
export function MAX_COLUMNS(row: number): number {return (row % 2 === 0 ? WIDTH - 1 : WIDTH);}

export const enum MoveResult {
  Invalid,
  Copy,
  Move,
}

export type InitialBoard = (spot: GridCoords) => Team | undefined;

type RowData = List<Team | undefined>;
export type Board = List<RowData>;
interface BoardChange {readonly pos: GridCoords, readonly team: Team;};
export interface Move {readonly from: GridCoords, readonly to: GridCoords;};
export type GameState = {readonly board: Board, readonly team: Team;};

export function fullBoard(spot: GridCoords): Team | undefined {
  return corners(spot);
}

function corners(spot: GridCoords): Team {
  if (spot.r === 0 && spot.c === 0) {
    return Team.Blue;
  } else if (spot.r === 0 && spot.c + 1 === MAX_COLUMNS(spot.r)) {
    return Team.Green;
  } else if (spot.r + 1 === MAX_ROWS && spot.c === 0) {
    return Team.Orange;
  } else if (spot.r + 1 === MAX_ROWS && spot.c + 1 === MAX_COLUMNS(spot.r)) {
    return Team.Red;
  } else {
    return Team.Empty;
  }
}

export function donutBoard(spot: GridCoords): Team | undefined {
  if (Math.abs(spot.r - (MAX_ROWS - 1) / 2) < 3 && Math.abs(spot.c - (MAX_COLUMNS(spot.r) - 1) / 2) < 3) {
    return undefined;
  }
  return fullBoard(spot);
}

export function atPos(board: Board, pos: GridCoords): Team | undefined {
  if (pos.c < 0 || pos.r < 0) return undefined;
  return board.get(pos.r)?.get(pos.c);
}

function setAll(board: Board, diffs: BoardChange[]): Board {
  return board.withMutations(mutable => {
    for (const diff of diffs) {
      mutable = mutable.setIn([diff.pos.r, diff.pos.c], diff.team);
    }
  });
}

function adjacent(m: Move): boolean {
  const even = m.from.r % 2 === 0;
  const colDiff = m.from.c - m.to.c;
  const absColDiff = Math.abs(colDiff);
  const absRowDiff = Math.abs(m.from.r - m.to.r);
  return (absColDiff === 1 && absRowDiff === 0) ||
    (absRowDiff === 1 && absColDiff === 0) ||
    (absRowDiff === 1 && colDiff === (even ? -1 : 1));
}

function reachable(m: Move): boolean {
  const even = m.from.r % 2 === 0;
  const colDiff = m.from.c - m.to.c;
  const absColDiff = Math.abs(colDiff);
  const absRowDiff = Math.abs(m.from.r - m.to.r);

  return (absColDiff === 1 && absRowDiff === 0) ||
    (absColDiff === 2 && absRowDiff === 0) ||
    (absColDiff <= 1 && absRowDiff === 2) ||
    (absRowDiff === 1 && absColDiff <= 1) ||
    (absRowDiff === 1 && colDiff === (even ? -2 : 2));
}

export function currentPlayerHasValidMove(state: GameState) {
  let result = false;
  for (const move of enumerateMoves(state)) {
    result = !!move;
    break;
  }
  return result;
}

export function* enumerateMoves(state: GameState): Generator<Move, void, undefined> {
  for (const [r, row] of state.board.entries()) {
    for (const [c, team] of row.entries()) {
      if (team !== state.team) continue;

      for (const to of neighbours({r, c})) {
        const target = atPos(state.board, to);
        if (target === Team.Empty) {
          yield {from: {r, c}, to};
        }
      }
    }
  }
}

function* closeNeighbours(pos: GridCoords): Generator<GridCoords, void, undefined> {
  const even = pos.r % 2 === 0;
  const c = pos.c;
  const r = pos.r;
  yield {r, c: c - 1};
  yield {r, c: c + 1};
  for (const r of [pos.r - 1, pos.r + 1]) {
    yield {r, c};
    yield {r, c: c + (even ? 1 : -1)};
  }
}

export function* neighbours(pos: GridCoords): Generator<GridCoords, void, undefined> {
  const even = pos.r % 2 === 0;
  const c = pos.c;
  const r = pos.r;
  yield {r, c: c - 2};
  yield {r, c: c - 1};
  yield {r, c: c + 1};
  yield {r, c: c + 2};
  for (const r of [pos.r - 2, pos.r - 1, pos.r + 1, pos.r + 2]) {
    yield {r, c: c - 1};
    yield {r, c: c + 1};
    yield {r, c};
  }
  for (const r of [pos.r - 1, pos.r + 1]) {
    yield {r, c: c + (even ? 2 : -2)};
  }
}

function surrender(state: GameState): Board {
  if (!state.team) {
    return initialiseBoard(donutBoard);
  }

  const diffs: BoardChange[] = [];
  for (const [r, row] of state.board.entries()) {
    for (const [c, t] of row.entries()) {
      if (t === state.team) {
        diffs.push({pos: {r, c}, team: Team.Empty});
      }
    }
  }
  return setAll(state.board, diffs);
}

function move(board: Board, m: Move): Board | null {
  if (!reachable(m)) return null;
  const f = atPos(board, m.from);
  if (!f) return null;
  const t = atPos(board, m.to);
  if (t !== Team.Empty) return null;
  const diffs: BoardChange[] = [{pos: m.to, team: f}];
  if (!adjacent(m)) diffs.push({pos: m.from, team: Team.Empty});
  for (const n of closeNeighbours(m.to)) {
    const e = atPos(board, n);
    if (e && e !== f) {
      diffs.push({pos: n, team: f});
    }
  }
  return setAll(board, diffs);
}

export function moveResult(state: GameState, move: Move): MoveResult {
  if (!reachable(move)) {
    return MoveResult.Invalid;
  }
  if (!state.team) {
    return MoveResult.Invalid;
  }
  if (atPos(state.board, move.from) !== state.team) {
    return MoveResult.Invalid;
  }
  if (atPos(state.board, move.to) !== Team.Empty) {
    return MoveResult.Invalid;
  }
  return adjacent(move) ? MoveResult.Copy : MoveResult.Move;
}

export function reduceGameState(state: GameState, action: Move | null): GameState {
  const board = action ? move(state.board, action) : surrender(state);
  if (!board) return state;
  const team = nextTeam(board, state.team);
  return {board, team};
}

export function countPlayers(board: Board): number[] {
  const result = [0, 0, 0, 0, 0];
  for (const row of board) {
    for (const t of row) {
      t && ++result[t];
    }
  }
  return result;
}

function nextTeam(board: Board, team: Team): Team {
  const counts = countPlayers(board);
  counts[Team.Empty] = 0;
  if (counts.map(x => x && (1 as number)).reduce((a, b) => a + b) <= 1)
    return Team.Empty;
  do {
    team = incrementTeam(team);
  } while (!counts[team]);
  return team;
}

function incrementTeam(team: Team): Team {
  return (team % 4) + 1;
}

function initialiseBoard(board: InitialBoard): Board {
  return rowIterator().map(r => columnInterator(r).map(c => board({r, c})).toList()).toList();
}

export function initialiseGameState(initialBoard: InitialBoard): GameState {
  const board = initialiseBoard(initialBoard);
  const team = Team.Red;
  return {board, team};
}

function rowIterator() {
  return Range(0, MAX_ROWS);
}

function columnInterator(row: number) {
  return Range(0, MAX_COLUMNS(row));
}
