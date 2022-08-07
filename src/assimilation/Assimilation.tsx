import * as React from 'react'

import '../css/assimilation.css';
import { Callback, Func } from '../util/Utils';
import { Board, countPlayers, currentPlayerHasValidMove, donutBoard, GameState, InitialBoard, initialiseGameState, Move, moveResult, MoveResult, reduceGameState } from './Board';
import { SvgCoords, SymbolDeclarations, SymbolName, Team, TeamColours, svgFromGrid, GridCoords, gridFromSvg, PLAYER_TEAM, SIZE, VSIZE } from './Constants';
import { FilterDefinitions, FilterId } from './Filter';
import { makeMove } from './Player';

export default function Assimilation(props: {image?: string}): React.ReactElement {
  return <div className="game-wrapper"><Game image={props.image ?? '/ripple.png'}/></div>;
}

function Game(props: {image: string}): React.ReactElement {
  return <svg xmlns="http://www.w3.org/2000/svg" tabIndex={-1} onContextMenu={e => e.preventDefault()} width={SIZE} height={VSIZE} viewBox={`0 0 ${SIZE} ${VSIZE}`}>
    <defs><FilterDefinitions image={props.image}/></defs>
    <SymbolDeclarations/>
    <GameBoard startingBoard={donutBoard}/>
  </svg>;
}

interface GameBoardProps {
  startingBoard: InitialBoard;
}

function GameBoard(props: GameBoardProps): React.ReactElement {
  const [state, onMove] = React.useReducer(reduceGameState, props.startingBoard, initialiseGameState);
  const reset = React.useCallback(() => onMove(null), [onMove]);
  const useFilter = state.team === Team.Empty;
  return <g filter={useFilter ? `url(#${FilterId})`: undefined}>
    <rect width={SIZE} height={VSIZE} rx={15} className={`team-display ${TeamColours[state.team]}`}/>
    <Victory state={state} onClick={reset}/>
    <Backdrop board={state.board}/>
    <TeamPlayer team={Team.Blue} state={state} onMove={onMove}/>
    <TeamPlayer team={Team.Orange} state={state} onMove={onMove}/>
    <TeamPlayer team={Team.Green} state={state} onMove={onMove}/>
    <TeamPlayer team={Team.Red} state={state} onMove={onMove}/>
  </g>;
}

const Backdrop = React.memo((props: {board: Board}) => {
  // TODO: optimise by using initialBoard, which never changes
  const elements: React.ReactElement[] = []
  for (const [r, row] of props.board.entries()) {
    for (const [c, b] of row.entries()) {
      if (b == null) {
        continue;
      }
      elements.push(<Symbol key={c*1000 + r} name={SymbolName.Space} pos={svgFromGrid({c,r})}/>);
    }
  }
  return <g>{elements}</g>;
});

function Victory(props: {state: GameState, onClick: Func}): React.ReactElement {
  if (props.state.team !== Team.Empty) {
    return <g/>;
  }
  const counts = countPlayers(props.state.board);
  let team = Team.Empty;
  for (const [t, c] of counts.entries()) {
    if (t !== Team.Empty && c > 0) {
      team = t;
    }
  }
  return <text x={SIZE / 2} y={VSIZE / 2} dominantBaseline="central" className={`victory ${TeamColours[team]}`} onClick={props.onClick}>{team ? 'WINNER!!' : 'ALL GONE??'}</text>
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
  const completePendingMove = React.useCallback<Callback<Move>>(move => { setPendingMove(undefined); onMove(move); }, [setPendingMove, onMove]);

  const human = props.team === PLAYER_TEAM;

  const elements2: React.ReactElement[] = [];
  const elements3: React.ReactElement[] = [];
  for (const [r, row] of props.state.board.entries()) {
    for (const [c, b] of row.entries()) {
      if (b !== props.team) {
        continue;
      }
      const key = c*1000 + r;
      const pos = svgFromGrid({c,r});
      const beingMoved = pendingMove && pendingMove.from.c === c && pendingMove.from.r === r;
      const beingDragged = dragged?.c === c && dragged.r === r;

      const piece = human ? 
      <Piece key={key} team={props.team} initialPos={pos} dragDisplay={dragDisplay} onDrag={setDragged} onMove={props.onMove}/>
      : (beingMoved ?
      <MovingPiece key={'mover'} team={props.team} move={pendingMove} dragDisplay={dragDisplay} onDoneMove={completePendingMove}/>
      : <Symbol key={key} className={TeamColours[props.team]} pos={pos} name={SymbolName.Piece}/>);
      
      (beingDragged || beingMoved ? elements3 : elements2).push(piece);
    }
  }
  return <g>
    {human ? <AutoSurrender team={props.team} state={props.state} onSurrender={props.onMove}/> : <AutoPlayer team={props.team} state={props.state} onMove={setPendingMove} onSurrender={props.onMove}/>}
    {elements2.concat(elements3)}
  </g>;
}

function delay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

function AutoSurrender(props: {team: Team, state: GameState, onSurrender: Callback<null>}): React.ReactElement {
  const {state, onSurrender} = props;
  const active = state.team === props.team;
  React.useEffect(() => {
    if (!active) return;
    const x = {proceed: true};
    delay().then(() => x.proceed && !currentPlayerHasValidMove(state) && onSurrender(null));
    return () => { x.proceed = false; };
  }, [state, active, onSurrender]);
  return <g/>;
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
  React.useEffect(() => {
    if (!active) return;
    const x = {proceed: true};
    makeMove(state).then(move => x.proceed && move ? onMove(move) : onSurrender(null));
    return () => { x.proceed = false; };
  }, [state, active, onMove, onSurrender]);
  return <g/>;
}

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
