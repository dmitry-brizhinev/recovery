import * as Immutable from 'immutable';
import * as React from 'react';

import '../css/assimilation.css';
import ripple from './ripple.png';
import {useCancellable, useCancellableDelay} from '../util/Hooks';
import type {Callback, Func} from '../util/Utils';
import {type Board, countPlayers, currentPlayerHasValidMove, donutBoard, type GameState, type InitialBoard, initialiseGameState, type Move, moveResult, MoveResult, reduceGameState} from './Board';
import {type SvgCoords, SymbolDeclarations, SymbolName, Team, TeamColours, svgFromGrid, type GridCoords, gridFromSvg, PLAYER_TEAM, SIZE, VSIZE, GRID} from './Constants';
import {FilterDefinitions, FilterId, SimpleRipple} from './Filter';
import {makeMove} from './Player';

export default function Assimilation(props: {image?: string;}): React.ReactElement {
  return <div className="a-game-wrapper"><Game image={props.image ?? ripple} /></div>;
}

function Game(props: {image: string;}): React.ReactElement {
  return <svg xmlns="http://www.w3.org/2000/svg" tabIndex={-1} onContextMenu={e => e.preventDefault()} width={SIZE} height={VSIZE} viewBox={`0 0 ${SIZE} ${VSIZE}`}>
    <defs><FilterDefinitions image={props.image} /></defs>
    <SymbolDeclarations />
    <GameBoard startingBoard={donutBoard} />
  </svg>;
}

interface GameBoardProps {
  startingBoard: InitialBoard;
}

interface LastMove {
  move: Move | null;
  num: number;
}

function GameBoard(props: GameBoardProps): React.ReactElement {
  const [state, dispatch] = React.useReducer(reduceGameState, props.startingBoard, initialiseGameState);
  const [lastMove, setLastMove] = React.useState<LastMove>({move: null, num: 0});
  const onMove = React.useCallback<typeof dispatch>(move => {dispatch(move); setLastMove(({num}) => {return {move, num: num + 1};});}, [dispatch]);
  const reset = React.useCallback(() => onMove(null), [onMove]);
  const useFilter = state.team === Team.Empty;
  return <g filter={useFilter ? `url(#${FilterId})` : undefined}>
    <rect width={SIZE} height={VSIZE} rx={15} className={`team-display ${TeamColours[state.team]}`} />
    <Victory state={state} onClick={reset} />
    <Backdrop board={state.board} />
    <RippleDisplay lastMove={lastMove} />;
    <TeamPlayer team={Team.Blue} state={state} onMove={onMove} />
    <TeamPlayer team={Team.Orange} state={state} onMove={onMove} />
    <TeamPlayer team={Team.Green} state={state} onMove={onMove} />
    <TeamPlayer team={Team.Red} state={state} onMove={onMove} />
  </g>;
}

function createRipple(move: Move): Ripple {
  const {x, y} = svgFromGrid(move.to);
  const pos = {x: x + GRID / 2, y: y + GRID / 2};
  return {pos, done: false};
}

interface Ripple {
  pos: SvgCoords;
  done: boolean;
}

function RippleDisplay(props: {lastMove: LastMove;}): React.ReactElement {
  const [ripples, setRipples] = React.useState(Immutable.Map<number, Ripple>());
  const onDone = React.useCallback<Callback<number>>(n => setRipples(rip => rip.set(n, {pos: {x: 0, y: 0}, done: true})), [setRipples]);
  const {move, num} = props.lastMove;
  if (!move) return <g />;

  if (!ripples.has(num)) {
    setRipples(ripples.set(num, createRipple(move)));
  }

  return <g>
    {ripples.entrySeq().filter(([, r]) => !r.done).map(([n, r]) => <SimpleRipple key={n} id={n} pos={r.pos} duration={1} onDone={onDone} />)}
  </g>;
}

const Backdrop = React.memo((props: {board: Board;}) => {
  // TODO: optimise by using initialBoard, which never changes
  const elements: React.ReactElement[] = [];
  for (const [r, row] of props.board.entries()) {
    for (const [c, b] of row.entries()) {
      if (b == null) {
        continue;
      }
      elements.push(<Symbol key={c * 1000 + r} name={SymbolName.Space} pos={svgFromGrid({c, r})} />);
    }
  }
  return <g>{elements}</g>;
});

function Victory(props: {state: GameState, onClick: Func;}): React.ReactElement {
  if (props.state.team !== Team.Empty) {
    return <g />;
    //return <>
    //  <text x={SIZE / 2} y={VSIZE / 2 - 20} dominantBaseline="central" className={`victory empty`}>BULGE</text>
    //  <text x={SIZE / 2} y={VSIZE / 2 + 20} dominantBaseline="central" className={`victory empty`}>TEST</text>
    //  </>;
  }
  const counts = countPlayers(props.state.board);
  let team = Team.Empty;
  for (const [t, c] of counts.entries()) {
    if (t !== Team.Empty && c > 0) {
      team = t;
    }
  }
  return <text x={SIZE / 2} y={VSIZE / 2} dominantBaseline="central" className={`victory ${TeamColours[team]}`} onClick={props.onClick}>{team ? 'WINNER!!' : 'ALL GONE??'}</text>;
}

interface TeamPlayerProps {
  team: Team;
  state: GameState;
  onMove: Callback<Move | null>;
}

function TeamPlayer(props: TeamPlayerProps): React.ReactElement {
  const [dragged, setDragged] = React.useState<GridCoords | undefined>(undefined);
  const dragDisplay = React.useCallback<DragDisplay>(move => moveResult(props.state, move), [props.state]);
  const [pendingMove, setPendingMove] = React.useState<Move | undefined>(undefined);

  const onMove = props.onMove;
  const completePendingMove = React.useCallback<Callback<Move>>(move => {setPendingMove(undefined); onMove(move);}, [setPendingMove, onMove]);

  const human = props.team === PLAYER_TEAM;

  const elements2: React.ReactElement[] = [];
  const elements3: React.ReactElement[] = [];
  for (const [r, row] of props.state.board.entries()) {
    for (const [c, b] of row.entries()) {
      if (b !== props.team) {
        continue;
      }
      const key = c * 1000 + r;
      const pos = svgFromGrid({c, r});
      const beingMoved = pendingMove && pendingMove.from.c === c && pendingMove.from.r === r;
      const beingDragged = dragged?.c === c && dragged.r === r;

      const piece = human ?
        <Piece key={key} team={props.team} initialPos={pos} dragDisplay={dragDisplay} onDrag={setDragged} onMove={props.onMove} />
        : (beingMoved ?
          <MovingPiece key={'mover'} team={props.team} move={pendingMove} dragDisplay={dragDisplay} onDoneMove={completePendingMove} />
          : <Symbol key={key} className={TeamColours[props.team]} pos={pos} name={SymbolName.Piece} />);

      (beingDragged || beingMoved ? elements3 : elements2).push(piece);
    }
  }
  return <g>
    {human ? <AutoSurrender team={props.team} state={props.state} onSurrender={props.onMove} /> : <AutoPlayer team={props.team} state={props.state} onMove={setPendingMove} onSurrender={props.onMove} />}
    {elements2.concat(elements3)}
  </g>;
}

function AutoSurrender(props: {team: Team, state: GameState, onSurrender: Callback<null>;}): React.ReactElement {
  const {state, onSurrender} = props;
  const active = state.team === props.team;
  const maybeSurrender = React.useCallback(() => currentPlayerHasValidMove(state) || onSurrender(null), [state, onSurrender]);
  useCancellableDelay(maybeSurrender, 1000, active);
  return <g />;
}

interface AutoPlayerProps {
  team: Team;
  state: GameState;
  onMove: Callback<Move>;
  onSurrender: Callback<null>;
}

function AutoPlayer(props: AutoPlayerProps): React.ReactElement {
  const {state, onMove, onSurrender} = props;
  const active = state.team === props.team;
  const computeMove = React.useCallback(() => makeMove(state), [state]);
  const playMove = React.useCallback<Callback<Move | null>>(move => move ? onMove(move) : onSurrender(null), [onMove, onSurrender]);
  useCancellable(computeMove, playMove, active);
  return <g />;
}

interface MovingPieceProps {
  team: Team;
  move: Move;
  dragDisplay: DragDisplay;
  onDoneMove: Callback<Move>;
}

function MovingPiece(props: MovingPieceProps): React.ReactElement {
  const {move, onDoneMove} = props;
  const onDone = React.useCallback(() => onDoneMove(move), [move, onDoneMove]);
  useCancellableDelay(onDone, 480);

  const startAnimationRef = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef2 = React.useCallback((dom: any) => dom?.beginElement(), []);

  const keepOrigin = props.dragDisplay(move) !== MoveResult.Move;

  const from = svgFromGrid(move.from);
  const to = svgFromGrid(move.to);
  const className = `${SymbolName.Piece} ${TeamColours[props.team]}`;
  return <>
    {keepOrigin && <use href={'#' + SymbolName.Piece} x={from.x} y={from.y} className={className} />}
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
  override render() {
    const className = this.props.name + (this.props.className ? ` ${this.props.className}` : '');
    return <use href={'#' + this.props.name} x={this.props.pos.x} y={this.props.pos.y} className={className} />;
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

class Piece extends React.Component<PieceProps, PieceState> {
  constructor(props: PieceProps) {
    super(props);

    this.state = {draggedPos: null, initialMousePos: null};

    this.pointerEvent = this.pointerEvent.bind(this);
  }

  /*
onPointerDown - same as mouse click (drag start)
onPointerMove - same as mouse move  (move dragged thing)
onPointerUp   -  same as mouse unclick (drag release)
onPointerOut - end hover OR release finger OR cancel

onPointerCancel  - cancel what we were doing, same as invalid release
onPointerOver - start hover
onPointerEnter - start hover OR press finger down
onPointerLeave - end hover
  */

  pointerEvent(e: React.PointerEvent) {
    if (this.props.team !== PLAYER_TEAM) {
      return;
    }
    switch (e.type) {
      case 'pointerdown':
        this.props.onDrag(gridFromSvg(this.props.initialPos));
        this.setState({initialMousePos: {x: e.clientX, y: e.clientY}, draggedPos: this.props.initialPos});
        break;
      case 'pointerup':
        if (this.state.draggedPos) {
          const from = gridFromSvg(this.props.initialPos);
          const to = gridFromSvg(this.state.draggedPos);
          const result = this.props.dragDisplay({from, to});
          if (result !== MoveResult.Invalid) {
            this.props.onMove({from, to});
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
          return {draggedPos: {x, y}};
        });
        break;
      case 'pointerout':
        //this.props.onDrag(undefined);
        this.setState({initialMousePos: null, draggedPos: null});
        break;
      default:
    }
  }

  override render() {
    const pos = this.state.draggedPos || this.props.initialPos;

    let sourcePos = undefined;
    let targetPos = undefined;
    if (!!this.state.draggedPos) {
      const from = gridFromSvg(this.props.initialPos);
      const to = gridFromSvg(pos);
      const result = this.props.dragDisplay({from, to});
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
      onPointerOut={this.pointerEvent} />;
    const source = sourcePos && <use href={'#' + SymbolName.Piece} x={sourcePos.x} y={sourcePos.y} className={className + ' ghost'} />;
    const target = targetPos && <use href={'#' + SymbolName.Piece} x={targetPos.x} y={targetPos.y} className={className + ' ghost'} />;

    return <>{source}{target}{me}</>;
  }
}
