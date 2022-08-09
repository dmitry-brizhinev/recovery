import Assimilation from "./Assimilation";
import * as React from 'react'
import Immutable from "immutable";
import { SIZE, VSIZE } from "./Constants";
import type { Callback } from "../util/Utils";

const CANVASWIDTH = SIZE;
const CANVASHEIGHT = VSIZE;

export default function ImageMaker(): React.ReactElement {
  const [imageURL, setImage] = React.useState<string | undefined>(undefined);
  const regenerateImage = React.useCallback<Callback<HTMLCanvasElement>>(canvas => setImage(genImage(canvas)), [setImage]);
  return <div>
    <canvas ref={regenerateImage} id="ripple" width={CANVASWIDTH} height={CANVASHEIGHT} style={{border: '1px solid black'}}></canvas>
    <Assimilation image={imageURL}/>
  </div>;
}

function color(right: number, up: number): string {
  const[R,G] = col(right, up);
  return `rgb(${R},${G},0)`;
}

function col(right: number, up: number): [number, number] {
  const R = Math.round((right + 1) * 255 / 2);
  const G = Math.round((up + 1) * 255 / 2);
  return [R,G];
}

// Nice ripple when set to scale=50
function verticalRipple(pos: number): string {
  const right = Math.sin(pos * 2 * Math.PI);
  const up =  (1 - Math.cos(pos * 2 * Math.PI)) / 2;
  return color(0.2*right, 0.5*up);
}

// Nice bulge when set to scale=50
function roundBulge(x:number, y:number): [number, number] {
  const [right, up] = roundBulgeRaw(x, y);
  return col(right, up);
}

function roundBulgeRaw(x:number, y:number) : [number, number] {
  x = 2*x - 1;
  y = 2*y - 1;
  const R = 1; // If R is bigger I think it will need to be asin(r/R) / asin(1/R) or something??
  const rr = Math.hypot(x, y);
  const r = Math.min(rr, 1);
  const m = Math.asin(r/R) * 2 / Math.PI - r;
  const right = -x * m / rr;
  const up = -y * m / rr;
  return [right,up];
}

// Excellent ripple
export function addRoundRipple(ctx:CanvasRenderingContext2D, start:number, gradientWidth: number) {
  const image = ctx.createImageData(gradientWidth, gradientWidth);
  const data = image.data;
  for (const y of Immutable.Range(0, gradientWidth)) {
    for (const x of Immutable.Range(0, gradientWidth)) {
      let right = 0;
      let up = 0;
      const [xx, yy] = [x/gradientWidth, y/gradientWidth];
      const [x2, y2] = [xx * 4/3 - 1/6, yy * 4/3 - 1/6];
      const [x3, y3] = [xx * 2 - 0.5, yy * 2 - 0.5];
      const [x4, y4] = [xx * 4 - 1.5, yy * 4 - 1.5];

      const [rn, un] = roundBulgeRaw(xx, yy);
      const [r2, u2] = roundBulgeRaw(x2, y2);
      const [r3, u3] = roundBulgeRaw(x3, y3);
      const [r4, u4] = roundBulgeRaw(x4, y4);
      right = rn - r2 + r3 - r4;
      up = un - u2 + u3 - u4;

      const [r,g] = col(right,up);
      const i = 4*(x + y*gradientWidth);
      data[i] = r;
      data[i+1] = g;
      data[i+2] = 0;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(image, start, start);
}

export function addRoundBulge(ctx:CanvasRenderingContext2D, start:number, gradientWidth: number) {
  const image = ctx.createImageData(gradientWidth, gradientWidth);
  const data = image.data;
  for (const y of Immutable.Range(0, gradientWidth)) {
    for (const x of Immutable.Range(0, gradientWidth)) {
      const [r,g] = roundBulge(x/gradientWidth, y/gradientWidth);
      const i = 4*(x + y*gradientWidth);
      data[i] = r;
      data[i+1] = g;
      data[i+2] = 0;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(image, start, start);
}

export function addVerticalRipple(ctx:CanvasRenderingContext2D, start: number, gradientWidth: number) {
  const grad = ctx.createLinearGradient(start, 0, start + gradientWidth, 0);
  for (const x of Immutable.Range(0, 1.01, 0.1)) {
    grad.addColorStop(x, verticalRipple(x));
  }

  ctx.fillStyle = grad;
  ctx.fillRect(start, 0, gradientWidth, CANVASHEIGHT);
}

function genImage(canvas: HTMLCanvasElement): string | undefined {
  if (!canvas) return undefined;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = color(0,0);
  ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);

  //addVerticalRipple(ctx, 0, SIZE * 0.1);
  //addRoundBulge(ctx, 0, SIZE);
  addRoundRipple(ctx, 0, SIZE);

  // 
  // const grad = ctx.createRadialGradient(SIZE / 2, VSIZE / 2, r, SIZE / 2, VSIZE / 2, r + gradientWidth);
  /*for (const start of Immutable.Range(0, SIZE - 0.01, gradientWidth)) {
    addRipple(ctx, start, gradientWidth);
  }*/

  return canvas.toDataURL();
}