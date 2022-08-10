import * as React from 'react'

export const HEIGHT = 600;
export const WIDTH = 400;
export const GRID = 40;
export const ANGLE = 45;

export const COLS = 20;
export const ROWS = 20;

interface GameValues {
  readonly height: number;
  readonly width: number;
  readonly grid: number;
  readonly cols: number;
  readonly rows: number;
  readonly angle: number;
}

export interface WorldCoords {
  readonly c: number;
  readonly r: number;
}

export interface SvgCoords {
  readonly x: number;
  readonly y: number;
}

export const DefaultGameContext = {
  height: HEIGHT,
  width: WIDTH,
  grid: GRID,
  cols: COLS,
  rows: ROWS,
  angle: ANGLE,
}

export const GameContext = React.createContext<GameValues>(DefaultGameContext);

export function svgFromWorld({c,r}: WorldCoords): SvgCoords {
  const x = c * GRID;
  const y = r * GRID;
  return {x,y};
}