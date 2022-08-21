import * as Immutable from 'immutable';

import {COLS, ROWS, type WorldCoords} from './Context';

export const enum Cell {
  Chasm,
  Water,
  Grass,
}

export class World {
  get({c, r}: WorldCoords): Cell {
    if (!this.valid({c, r})) {
      return Cell.Chasm;
    }
    if (r <= 2 || c <= 2) {
      return Cell.Water;
    }
    return Cell.Grass;
  }
  valid({c, r}: WorldCoords): boolean {
    return !(c < 0 || c >= COLS || r < 0 || r >= ROWS);
  }
  cells(filter: Cell) {
    return Immutable.Range(0, ROWS).flatMap(r => Immutable.Range(0, COLS).filter(c => this.get({c, r}) === filter).map(c => ({c, r})));
  }
}

function genWorld(): World {
  return new World();
}

function genEntities(_world: World): Entities {
  return Entities.init([
    [{c: 5, r: 5}, {type: 'castle'}],
    [{c: 5, r: 6}, {type: 'player'}],
    [{c: 7, r: 7}, {type: 'mine'}],
    [{c: 18, r: 4}, {type: 'mine'}],
    [{c: 17, r: 19}, {type: 'mine'}],
    [{c: 3, r: 16}, {type: 'mine'}],
    [{c: 11, r: 12}, {type: 'mine'}],
  ]);
}

export function initialiseGameState(): GameState {
  const world = genWorld();
  const entities = genEntities(world);
  return {world, entities};
}

export const SYMBOL_CASTLE = 'castle';
export interface Castle {
  type: 'castle',
}

export const SYMBOL_PLAYER = 'player';
export interface Player {
  type: 'player',
  gold?: number,
}

export const SYMBOL_MINE = 'mine';
export interface Mine {
  type: 'mine',
  empty?: boolean,
}

export type Entity = Castle | Player | Mine;

export class Entities {
  constructor(private readonly map: Immutable.Map<number, Entity> = Immutable.Map()) {}
  static init(es: [WorldCoords, Entity][]): Entities {
    return new Entities(Immutable.Map(es.map(([pos, e]) => [Entities.c(pos), e])));
  }
  get(pos: WorldCoords): Entity | undefined {
    return this.map.get(Entities.c(pos));
  }
  has(pos: WorldCoords): boolean {
    return this.map.has(Entities.c(pos));
  }
  move({from, to}: {from: WorldCoords, to: WorldCoords;}): Entities {
    const f = Entities.c(from);
    const t = Entities.c(to);
    const e = this.map.get(f);
    if (!e) return this;
    return new Entities(this.map.withMutations(
      m => m.delete(f).set(t, e)
    ));
  }
  entrySeq(): Immutable.Seq.Indexed<[WorldCoords, Entity]> {
    return this.map.entrySeq().map(([n, e]) => [Entities.unC(n), e]);
  }
  private static c({c, r}: WorldCoords): number {
    return c * 100000 + r;
  }
  private static unC(n: number): WorldCoords {
    const r = n % 100000;
    const c = Math.round((n - r) / 100000);
    return {c, r};
  }
}

export interface GameState {
  readonly world: World;
  readonly entities: Entities;
}

export interface Move {
  type: 'move',
  from: WorldCoords,
  to: WorldCoords,
}

interface Harvest {
  type: 'harvest',
  from: WorldCoords,
  to: WorldCoords,
}

interface Attack {
  type: 'attack',
  from: WorldCoords,
  to: WorldCoords,
}

export type GameAction = Move | Harvest | Attack;

function adjacent({from, to}: {from: WorldCoords, to: WorldCoords;}) {
  return Math.abs(from.c - to.c) + Math.abs(from.r - to.r) === 1;
}

function doMove(world: World, entities: Entities, move: Move): Entities {
  if (!world.valid(move.from) || !world.valid(move.to)) {
    return entities;
  }
  const p = entities.get(move.from);
  if (!p || p.type !== 'player') {
    return entities;
  }
  if (entities.has(move.to) || world.get(move.to) !== Cell.Grass || !adjacent(move)) {
    return entities;
  }
  return entities.move(move);
}

export function reduceGameState({world, entities}: GameState, action: GameAction): GameState {
  if (action.type === 'move') {
    entities = doMove(world, entities, action);
  }
  return {world, entities};
}
