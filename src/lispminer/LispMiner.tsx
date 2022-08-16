import * as React from 'react'

import '../css/lispminer.css';
import { Callback, unreachable } from '../util/Utils';
import { COLS, DefaultGameContext, GameContext, GRID, HEIGHT, project, ROWS, WIDTH, WorldCoords } from './Context';
import { Cell, Entities, Entity, GameAction, GameState, initialiseGameState, Move, reduceGameState, SYMBOL_CASTLE, SYMBOL_MINE, SYMBOL_PLAYER, World } from './GameState';

export default function LispMiner(): React.ReactElement {
  return <GameContext.Provider value={DefaultGameContext}>
    <Game/>
  </GameContext.Provider>;
}

const enum KeyType {
  WSAD,
  Arrow,
}

const enum Direction {
  Left,
  Right,
  Up,
  Down,
}

interface KeyEvent {
  type: KeyType;
  direction: Direction;
}

function keyboardParser(e: React.KeyboardEvent): KeyEvent | undefined {
  if (e.type === 'keydown') {

  } else if (e.type === 'keyup') {
    return undefined;
  } else {
    return undefined;
  }

  e.preventDefault();

  switch(e.key) {
    case 'w': return {type: KeyType.WSAD, direction: Direction.Up};
    case 's': return {type: KeyType.WSAD, direction: Direction.Down};
    case 'a': return {type: KeyType.WSAD, direction: Direction.Left};
    case 'd': return {type: KeyType.WSAD, direction: Direction.Right};
    case 'ArrowLeft': return {type: KeyType.Arrow, direction: Direction.Left};
    case 'ArrowRight': return {type: KeyType.Arrow, direction: Direction.Right};
    case 'ArrowUp': return {type: KeyType.Arrow, direction: Direction.Up};
    case 'ArrowDown': return {type: KeyType.Arrow, direction: Direction.Down};
    default:
      return undefined;
  }
}

function keyboardHandler(this: Callback<KeyEvent>, e: React.KeyboardEvent) {
  const f = keyboardParser(e);
  if (!f) return;
  this(f);
}

function movePos({c,r}: WorldCoords, direction: Direction): WorldCoords {
  switch(direction) {
    case Direction.Left: return {c:c-1,r};
    case Direction.Right: return {c:c+1,r};
    case Direction.Up: return {c,r:r-1};
    case Direction.Down: return {c,r:r+1};
    default: return unreachable(direction);
  }
}

function movePosClamped(pos: WorldCoords, direction: Direction): WorldCoords {
  const {c,r} = movePos(pos, direction);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return pos;
  return {c,r};
}

function movePlayer(entities: Entities, direction: Direction): Move | undefined {
  for (const [pos, e] of entities.entrySeq()) {
    if (e.type === 'player') {
      return {type:'move', from:pos, to:movePos(pos, direction)};
    }
  }
  return undefined;
}

function Game(): React.ReactElement {
  const [state, dispatch] = React.useReducer(reduceGameState, undefined, initialiseGameState);
  const [viewport, pan] = React.useReducer(movePosClamped, {r:0,c:0});
  const keyHandler = React.useCallback<Callback<KeyEvent>>(e => {
    if (e.type === KeyType.WSAD) {
      const m = movePlayer(state.entities, e.direction);
      m && dispatch(m);
    } else if (e.type === KeyType.Arrow) {
      pan(e.direction);
    }
  }, [state.entities, dispatch, pan]);

  return <div className="game-wrapper" onKeyDown={keyboardHandler.bind(keyHandler)}>
    <div className="game-background-wrapper">
      <Svg width={WIDTH} height={HEIGHT} view={viewport}>
        <WorldDisplay world={state.world}/>
      </Svg>
    </div>
    <div className="game-foreground-wrapper">
      <Svg width={WIDTH} height={HEIGHT}>
        <Symbols/>
        <GameWorld view={viewport} state={state} dispatch={dispatch} />
      </Svg>
    </div>
  </div>;
}

function Svg(props: {width: number, height: number, view?: WorldCoords, children: React.ReactNode}): React.ReactElement {
  const {width, height, view} = props;
  const {c,r} = view ?? {c:0,r:0};
  return <svg xmlns="http://www.w3.org/2000/svg" tabIndex={-1} onContextMenu={e => e.preventDefault()} width={width} height={height} viewBox={`${c * GRID} ${r * GRID} ${width} ${height}`}>
    {props.children}
  </svg>
}

function WorldDisplay({world}: {world: World}): React.ReactElement {
  return <g>
    <rect className="world-display" x={0} y={0} width={COLS * GRID} height={ROWS * GRID} />
    {world.cells(Cell.Grass).map(({c,r}) => <rect key={`${c} ${r}`} className="world-display-grass" x={c * GRID} y={r * GRID} width={GRID} height={GRID} />)}
    {world.cells(Cell.Water).map(({c,r}) => <rect key={`${c} ${r}`} className="world-display-water" x={c * GRID} y={r * GRID} width={GRID} height={GRID} />)}
  </g>;
}

function Symbols(): React.ReactElement {
  return <>
  <symbol id={SYMBOL_PLAYER} width={GRID} height={GRID} viewBox={`0 0 ${GRID} ${GRID}`}>
    <circle cx={GRID * 0.5} cy={GRID * 0.25} r={GRID * 0.18} />
    <line x1={GRID * 0.5}  y1={GRID * 0.4}  x2={GRID * 0.5}  y2={GRID * 0.65}/>
    <line x1={GRID * 0.25} y1={GRID * 0.55}  x2={GRID * 0.75} y2={GRID * 0.55}/>
    <line x1={GRID * 0.5}  y1={GRID * 0.65} x2={GRID * 0.25} y2={GRID * 0.9}/>
    <line x1={GRID * 0.5}  y1={GRID * 0.65} x2={GRID * 0.75} y2={GRID * 0.9}/>
  </symbol>
  <symbol id={SYMBOL_CASTLE} width={GRID} height={GRID} viewBox={`0 0 ${GRID} ${GRID}`}>
    <rect x={GRID * 0.4} y={GRID * 0.4} width={GRID * 0.2} height={GRID * 0.5} />
    <path d={`M ${GRID * 0.4} ${GRID * 0.4} L ${GRID * 0.5} ${GRID * 0.1} L ${GRID * 0.6} ${GRID * 0.4} Z`} />
  </symbol>
  <symbol id={SYMBOL_MINE} width={GRID} height={GRID} viewBox={`0 0 ${GRID} ${GRID}`}>
    {/*M(ove) x y A(rc) rx ry x-axis-rotation large-arc-flag sweep-flag x y Z(return to start) */}
    <path d={`M ${GRID * 0.1} ${GRID * 0.9} A ${GRID * 0.4} ${GRID * 0.4} 0 0 1 ${GRID * 0.9} ${GRID * 0.9} Z`} />
  </symbol>
  </>;
}

interface GameWorldProps {
  view: WorldCoords;
  state: GameState;
  dispatch: Callback<GameAction>;
}

function GameWorld(props: GameWorldProps): React.ReactElement {
  return <EntityDisplay entities={props.state.entities} view={props.view}/>;
}

function EntityDisplay({entities, view}: {entities: Entities, view: WorldCoords}): React.ReactElement {
  return <g>
    {[[1,1],[1,5],[5,1],[5,5]].map(([c,r]) => drawPoint(view, {c,r}))}
    {entities.entrySeq().map(drawEntity.bind(view))}
  </g>;
}

function drawPoint(view: WorldCoords, pos: WorldCoords) {
  const {pos:{x,y},scale:{x:sx,y:sy}} = project(view, pos);
  return <circle key={`${x} ${y}`} cx={0} cy={0} r={4} fill={'red'} transform={`translate(${x} ${y}) scale(${sx},${sy})`}/>
}

function drawEntity(this: WorldCoords, [pos, entity]: [WorldCoords, Entity]) {
  const {pos:{x,y}, scale:{x:sx,y:sy}} = project(this, pos);
  return <use key={`${pos.c} ${pos.r}`} href={'#' + entity.type} x={x} y={y} width={sx * GRID} height={sy * GRID} className={entity.type}/>;
}

