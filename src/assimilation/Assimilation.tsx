import * as React from 'react'

import '../css/assimilation.css';
import { Callback } from '../util/Utils';
import { donutBoard, GameState, InitialBoard, initialiseGameState, Move, moveResult, MoveResult, reduceGameState } from './Board';
import { GRID, WIDTH, HEIGHT, SCALE, SvgCoords, SymbolDeclarations, SymbolName, Team, TeamColours, svgFromGrid, GridCoords, gridFromSvg, PLAYER_TEAM } from './Constants';
import { makeMove } from './Player';

export default function Assimilation(): React.ReactElement {
  return <div className="game-wrapper"><Game/></div>;
}

function Game(): React.ReactElement {
  return <svg xmlns="http://www.w3.org/2000/svg" tabIndex={-1} width={GRID * WIDTH * SCALE} height={GRID * HEIGHT * SCALE} viewBox={`0 0 ${GRID * WIDTH} ${GRID * HEIGHT}`}>
    <defs></defs>
    <SymbolDeclarations/>
    <GameBoard startingBoard={donutBoard}/>
  </svg>;
}

interface GameBoardProps {
  startingBoard: InitialBoard;
}

function GameBoard(props: GameBoardProps): React.ReactElement {
  const [state, dispatch] = React.useReducer(reduceGameState, props.startingBoard, initialiseGameState);
  const [dragged, setDragged] = React.useState<GridCoords | undefined>(undefined);
  const dragDisplay = React.useCallback<DragDisplay>(move => moveResult(state, move), [state]);
  const elements: React.ReactElement[] = []
  const elements2: React.ReactElement[] = [];
  const elements3: React.ReactElement[] = [];
  for (const [r, row] of state.board.entries()) {
    for (const [c, b] of row.entries()) {
      if (b == null) {
        continue;
      }
      elements.push(<Space key={c*1000 + r} pos={{c,r}}/>);
      if (b) {
        const key = -(c*1000 + r);
        const isDragged = dragged?.c === c && dragged.r === r;
        const elem = isDragged ? elements3 : elements2;
        elem.push(<Piece key={key} team={b} initialPos={svgFromGrid({c,r})} dragDisplay={dragDisplay} onDrag={setDragged} onMove={dispatch}/>);
      }
    }
  }
  return <>
    <AutoPlayer state={state} onMove={dispatch}/>
    <rect width={WIDTH * GRID} height={HEIGHT * GRID} rx={15} className={`team-display ${TeamColours[state.team]}`}/>
    {elements}
    {elements2.concat(elements3)}
  </>;
}

function Space(props: {pos: GridCoords}) {
  return <Symbol name={SymbolName.Space} pos={svgFromGrid(props.pos)}/>
}

interface AutoPlayerProps {
  state: GameState;
  onMove: Callback<Move>;
}

function AutoPlayer(props: AutoPlayerProps): React.ReactElement {
  const {state, onMove} = props;
  const player = state.team === PLAYER_TEAM;
  React.useEffect(() => {
    if (player) return;
    const x = {proceed: true};
    makeMove(state).then(move => move && x.proceed && onMove(move));
    return () => { x.proceed = false; };
  }, [state, player, onMove]);
  return <g></g>;
}

interface SymbolProps {
  name: SymbolName;
  pos: SvgCoords;
  className?: string;
}

class Symbol extends React.Component<SymbolProps, object> {
  render() {
    /*let maybeAnimate = null;
    if (this.props.selected) {
      maybeAnimate = <animate attributeName="stroke-width" values="1;2;1" dur="1s" repeatCount="indefinite" />;
    }*/
    //<use ...>{maybeAnimate}</use>;
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
          const x = e.clientX + this.props.initialPos.x - initialMousePos.x;
          const y = e.clientY + this.props.initialPos.y - initialMousePos.y;
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
