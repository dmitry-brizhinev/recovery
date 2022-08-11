import * as React from 'react'

export const HEIGHT = 600;
export const WIDTH = 400;
export const GRID = 40;
export const ANGLE = 45;

export const COLS = 20;
export const ROWS = 20;

const PERSPECTIVE = 500;

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

export function project(view: WorldCoords, {c,r}: WorldCoords): {pos: SvgCoords, scale: SvgCoords} {
  const d = PERSPECTIVE;

  const ix = (c - view.c) * GRID;
  const iy = (r - view.r) * GRID;

  // rotate:
  let z = iy/Math.SQRT2;
  let y = iy/Math.SQRT2;

  let x = ix/(1-z/d);
      y = y/(1-z/d);

  return {pos:{x,y}, scale:{x:x/ix, y:y/iy}};
}

/*

x
y
z
1


1	0	0	tx
0	1	0	ty
0	0	1	tz  =  x+tx,y+ty,z+tz,1
0	0	0	1


1	 0	    0	  0
0	c(a) -s(a)	0  = x, y*ca, y*sa, 1 = x, y/sqrt(2), y/sqrt(2), 1
0	s(a)	c(a)	0
0	 0	    0	  1



1	0	    0	  0
0	1	    0	  0   =  x/(1-z/d), y/(1-z/d), z/(1-z/d), 1
0	0	    1	  0
0	0	  −1/d	1 
*/