
import * as React from 'react'

export const enum Team {
  Empty = 0,
  Blue = 1,
  Green = 2,
  Orange = 3,
  Red = 4,
}

export const TeamColours = ['empty', 'blue', 'green', 'orange', 'red'] as const;

export const PLAYER_TEAM = Team.Red;

export const enum SymbolName {
  Space = 'space',
  Piece = 'piece',
}

export const GRID = 40;
export const WIDTH = 15;
export const HEIGHT = 15;
export const SCALE = 1; // 1 pixel in SVG land = SCALE pixels displayed on the page

export function SymbolDeclarations(): React.ReactElement {
  return <>
    <symbol id={SymbolName.Space} width={GRID} height={GRID}>
      <circle cx={0.5 * GRID} cy={0.5 * GRID} r={0.4 * GRID} />
    </symbol>
    <symbol id={SymbolName.Piece} width={GRID} height={GRID}>
      <circle cx={0.5 * GRID} cy={0.5 * GRID} r={0.3 * GRID} />
    </symbol>
  </>;
}

export interface SvgCoords {
  readonly x: number;
  readonly y: number;
}

export interface GridCoords {
  readonly r: number;
  readonly c: number;
}

export function svgFromGrid({c,r}: GridCoords): SvgCoords {
  const even = r % 2 === 0;
  const x = c * GRID + (even ? GRID/2 : 0);
  const y = r * GRID * Math.sqrt(3/4);
  return {x,y};
}

export function gridFromSvg({x,y}: SvgCoords): GridCoords {
  const r = Math.round(y / GRID / Math.sqrt(3/4));
  const even = r % 2 === 0;
  const c = Math.round(x / GRID - (even ? 0.5 : 0));
  return {r,c};
}