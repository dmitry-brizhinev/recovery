import * as React from 'react'

import '../css/lispminer.css';
import type { Callback } from '../util/Utils';
import { COLS, DefaultGameContext, GameContext, GRID, HEIGHT, project, ROWS, svgFromWorld, WIDTH, WorldCoords } from './Context';
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
  }
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
  const [viewport, pan] = React.useReducer(movePos, {r:0,c:0});
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
      <Svg width={GRID * COLS} height={GRID * ROWS}>
        <WorldDisplay world={state.world} view={viewport}/>
      </Svg>
    </div>
    <div className="game-foreground-wrapper">
      <Svg width={WIDTH} height={HEIGHT}>
        <Symbols/>
        <GameWorld state={state} dispatch={dispatch} />
      </Svg>
    </div>
  </div>;
}

function Svg(props: {width: number, height: number, children: React.ReactNode}): React.ReactElement {
  const {width, height} = props;
  return <svg xmlns="http://www.w3.org/2000/svg" tabIndex={-1} onContextMenu={e => e.preventDefault()} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {props.children}
  </svg>
}

function WorldDisplay({world, view:{r:rr,c:cc}}: {world: World, view: WorldCoords}): React.ReactElement {
  return <g>
    <rect className="world-display" x={cc * GRID} y={rr * GRID} width={COLS * GRID} height={ROWS * GRID} />
    {world.cells(Cell.Water).map(({c,r}) => <rect key={`${c} ${r}`} className="world-display-water" x={(c+cc) * GRID} y={(r+rr) * GRID} width={GRID} height={GRID} />)}
  </g>;
}

function Symbols(): React.ReactElement {
  return <>
  <symbol id={SYMBOL_PLAYER} width={GRID} height={GRID}>
    <circle cx={GRID * 0.5} cy={GRID * 0.25} r={GRID * 0.18} />
    <line x1={GRID * 0.5}  y1={GRID * 0.4}  x2={GRID * 0.5}  y2={GRID * 0.65}/>
    <line x1={GRID * 0.25} y1={GRID * 0.55}  x2={GRID * 0.75} y2={GRID * 0.55}/>
    <line x1={GRID * 0.5}  y1={GRID * 0.65} x2={GRID * 0.25} y2={GRID * 0.9}/>
    <line x1={GRID * 0.5}  y1={GRID * 0.65} x2={GRID * 0.75} y2={GRID * 0.9}/>
  </symbol>
  <symbol id={SYMBOL_CASTLE} width={GRID} height={GRID}>
    <rect x={GRID * 0.4} y={GRID * 0.4} width={GRID * 0.2} height={GRID * 0.5} />
    <path d={`M ${GRID * 0.4} ${GRID * 0.4} L ${GRID * 0.5} ${GRID * 0.1} L ${GRID * 0.6} ${GRID * 0.4} Z`} />
  </symbol>
  <symbol id={SYMBOL_MINE} width={GRID} height={GRID}>
    {/*M(ove) x y A(rc) rx ry x-axis-rotation large-arc-flag sweep-flag x y Z(return to start) */}
    <path d={`M ${GRID * 0.1} ${GRID * 0.9} A ${GRID * 0.4} ${GRID * 0.4} 0 0 1 ${GRID * 0.9} ${GRID * 0.9} Z`} />
  </symbol>
  </>;
}

interface GameWorldProps {
  state: GameState;
  dispatch: Callback<GameAction>;
}

function GameWorld(props: GameWorldProps): React.ReactElement {
  return <EntityDisplay entities={props.state.entities}/>;
}

function EntityDisplay({entities}: {entities: Entities}): React.ReactElement {
  return <g>
    {[[1,1],[1,5],[5,1],[5,5]].map(([c,r]) => drawPoint({c,r}))}
    {entities.entrySeq().map(drawEntity)}
  </g>;
}

function drawPoint(pos: WorldCoords) {
  const p = true;
  const f = p ? project : svgFromWorld;
  const {x,y} = f(pos);
  return <circle cx={x} cy={y} r={4} fill={'red'}/>
}

function drawEntity([pos, entity]: [WorldCoords, Entity]) {
  const {x,y} = svgFromWorld(pos);
  return <use key={`${pos.c} ${pos.r}`} href={'#' + entity.type} x={x} y={y} className={entity.type}/>;
}

/*
interface MovingPieceProps {
  team: Team;
  move: Move;
  dragDisplay: DragDisplay;
  onDoneMove: Callback<Move>;
}

function MovingPiece(props: MovingPieceProps): React.ReactElement {
  const {move, onDoneMove} = props;

  const startAnimationRef = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef2 = React.useCallback((dom: any) => dom?.beginElement(), []);

  const keepOrigin = props.dragDisplay(move) !== MoveResult.Move;

  React.useEffect(() => {
    const x = {proceed: true};
    setTimeout(() => {x.proceed && onDoneMove(move)}, 480);
    return () => { x.proceed = false; };
  }, [move, onDoneMove]);

  const from = svgFromGrid(move.from);
  const to = svgFromGrid(move.to);
  const className = `${SymbolName.Piece} ${TeamColours[props.team]}`;
  return <>
  {keepOrigin && <use href={'#' + SymbolName.Piece} x={from.x} y={from.y} className={className}/>}
  <use href={'#' + SymbolName.Piece} x={from.x} y={from.y} className={className}>
    <animate ref={startAnimationRef} attributeName="x" begin="indefinite" from={from.x} to={to.x} dur={'500ms'} repeatCount="1" />
    <animate ref={startAnimationRef2} attributeName="y" begin="indefinite" from={from.y} to={to.y} dur={'500ms'} repeatCount="1" />
  </use>
  </>;
}

interface SymbolProps {
  name: SymbolName;
  pos: SvgCoords;
  className?: string;
}

class Symbol extends React.Component<SymbolProps, object> {
  render() {
    const className = this.props.name + (this.props.className ? ` ${this.props.className}` : '');
    return <use href={'#' + this.props.name} x={this.props.pos.x} y={this.props.pos.y} className={className}/>;
  }
}

type DragDisplay = (drag: Move) => MoveResult;

interface PieceProps {
  team: Team;
  initialPos: SvgCoords;
  dragDisplay: DragDisplay;
  onMove: Callback<Move>;
  onDrag: Callback<GridCoords | undefined>;
}

interface PieceState {
  draggedPos: SvgCoords | null;
  initialMousePos: SvgCoords | null;
}
*/
/*
class Piece extends React.Component<PieceProps, PieceState> {
  constructor(props: PieceProps) {
    super(props);

    this.state = {draggedPos: null, initialMousePos: null};

    this.pointerEvent = this.pointerEvent.bind(this);
  }

  
//onPointerDown - same as mouse click (drag start)
//onPointerMove - same as mouse move  (move dragged thing)
//onPointerUp   -  same as mouse unclick (drag release)
//onPointerOut - end hover OR release finger OR cancel

//onPointerCancel  - cancel what we were doing, same as invalid release
//onPointerOver - start hover
//onPointerEnter - start hover OR press finger down
//onPointerLeave - end hover


  pointerEvent(e: React.PointerEvent) {
    if (this.props.team !== PLAYER_TEAM) {
      return;
    }
    switch(e.type) {
      case 'pointerdown':
        this.props.onDrag(gridFromSvg(this.props.initialPos));
        this.setState({initialMousePos: {x:e.clientX, y:e.clientY}, draggedPos: this.props.initialPos});
        break;
      case 'pointerup':
        if (this.state.draggedPos) {
          const from = gridFromSvg(this.props.initialPos);
          const to = gridFromSvg(this.state.draggedPos);
          const result = this.props.dragDisplay({from,to});
          if (result !== MoveResult.Invalid) {
            this.props.onMove({from,to});
          }
        }
        //this.props.onDrag(undefined);
        this.setState({initialMousePos: null, draggedPos: null});
        break;
      case 'pointermove':
        this.setState(({initialMousePos}) => {
          if (!initialMousePos) return {draggedPos: null};
          const x = this.props.initialPos.x + (e.clientX - initialMousePos.x); //  / SCALE;
          const y = this.props.initialPos.y + (e.clientY - initialMousePos.y); //  / SCALE;
          return {draggedPos: {x,y}};
        });
        break;
      case 'pointerout':
        //this.props.onDrag(undefined);
        this.setState({initialMousePos: null, draggedPos: null});
        break;
      default:
    }
  }

  render() {
    const pos = this.state.draggedPos || this.props.initialPos;

    let sourcePos = undefined;
    let targetPos = undefined;
    if (!!this.state.draggedPos) {
      const from = gridFromSvg(this.props.initialPos);
      const to = gridFromSvg(pos);
      const result = this.props.dragDisplay({from,to});
      if (result !== MoveResult.Move) {
        sourcePos = this.props.initialPos;
      }
      if (result !== MoveResult.Invalid) {
        targetPos = svgFromGrid(to);
      }
    }

    const className = SymbolName.Piece + ` ${TeamColours[this.props.team]}`;
    const me = <use href={'#' + SymbolName.Piece} x={pos.x} y={pos.y} className={className}
      onPointerDown={this.pointerEvent}
      onPointerMove={this.pointerEvent}
      onPointerUp={this.pointerEvent}
      onPointerOut={this.pointerEvent}/>;
    const source = sourcePos && <use href={'#' + SymbolName.Piece} x={sourcePos.x} y={sourcePos.y} className={className + ' ghost'}/>;
    const target = targetPos && <use href={'#' + SymbolName.Piece} x={targetPos.x} y={targetPos.y} className={className + ' ghost'}/>;

    return <>{source}{target}{me}</>;
  }
}
*/
