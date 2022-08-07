import Assimilation from "./Assimilation";
import * as React from 'react'
import Immutable from "immutable";
import { SIZE, VSIZE } from "./Constants";

const GRADIENTWIDTH = SIZE * 0.1;
const CANVASWIDTH = SIZE + GRADIENTWIDTH + SIZE;
const CANVASHEIGHT = VSIZE;

export default function ImageMaker(): React.ReactElement {
  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  const result = React.useMemo(() => genImage(canvas.current), [canvas.current]);
  return <div>
    <canvas ref={canvas} id="ripple" width={CANVASWIDTH} height={CANVASHEIGHT} style={{border: '1px solid black'}}></canvas>
    <Assimilation image={result || undefined}/>
  </div>;
}

function color(right: number, up: number): string {
  const R = Math.round((right + 1) * 255 / 2);
  const G = Math.round((up + 1) * 255 / 2);
  return `rgb(${R},${G},0)`;
}

// Nice ripple when set to scale=50 and gradientWidth=SIZE * 0.1
function verticalRipple(pos: number): string {
  const right = Math.sin(pos * 2 * Math.PI);
  const up =  (1 - Math.cos(pos * 2 * Math.PI)) / 2;
  return color(0.2*right, 0.5*up);
}

function addRipple(ctx:CanvasRenderingContext2D, start: number, gradientWidth: number) {
  const grad = ctx.createLinearGradient(start, 0, start + gradientWidth, 0);
  for (const x of Immutable.Range(0, 1.01, 0.1)) {
    grad.addColorStop(x, verticalRipple(x));
  }

  ctx.fillStyle = grad;
  ctx.fillRect(start, 0, gradientWidth, CANVASHEIGHT);
}

function genImage(canvas: HTMLCanvasElement | null): string {
  if (!canvas) return '';
  const ctx = canvas?.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = color(0,0);
  ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);

  addRipple(ctx, SIZE, GRADIENTWIDTH);

  // 
  // const grad = ctx.createRadialGradient(SIZE / 2, VSIZE / 2, r, SIZE / 2, VSIZE / 2, r + gradientWidth);
  /*for (const start of Immutable.Range(0, SIZE - 0.01, gradientWidth)) {
    addRipple(ctx, start, gradientWidth);
  }*/

  return canvas.toDataURL();
}