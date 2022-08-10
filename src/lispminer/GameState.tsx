import Immutable from 'immutable';

import { COLS, ROWS, WorldCoords } from './Context';

export const enum Cell {
  Chasm,
  Water,
  Grass,
}

export class World {
  get({c,r}: WorldCoords): Cell {
    if (!this.valid({c,r})) {
      return Cell.Chasm;
    }
    if (r <= 2 || c <= 2) {
      return Cell.Water;
    }
    return Cell.Grass;
  }
  valid({c,r}: WorldCoords): boolean {
    return !(c < 0 || c >= COLS || r < 0 || r >= ROWS);
  }
  cells(filter: Cell) {
    return Immutable.Range(0, ROWS).flatMap(r => Immutable.Range(0, COLS).filter(c => this.get({c,r}) === filter).map(c => {return {c,r}}));
  }
}

function genWorld(): World {
  return new World();
}

function genEntities(world: World): Entities {
  return Immutable.Map([
    [{c:5,r:5},{type: 'castle'}],
    [{c:5,r:6},{type: 'player'}],
    [{c:7,r:7},{type: 'mine'}],
    [{c:18,r:4},{type: 'mine'}],
    [{c:17,r:19},{type: 'mine'}],
    [{c:3,r:16},{type: 'mine'}],
    [{c:11,r:12},{type: 'mine'}],
  ]);
}

export function initialiseGameState(): GameState {
  const world = genWorld();
  const entities = genEntities(world);
  return { world, entities };
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

export type Entities = Immutable.Map<WorldCoords, Entity>;

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

function adjacent({from, to}: {from: WorldCoords, to: WorldCoords}) {
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
  return entities.delete(move.from).set(move.to, p);
}

export function reduceGameState({world, entities}: GameState, action: GameAction): GameState {
  if (action.type === 'move') {
    entities = doMove(world, entities, action);
  }
  return {world, entities};
}