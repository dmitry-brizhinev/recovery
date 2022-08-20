import Assimilation from "./Assimilation";
import * as React from 'react';
import * as Immutable from "immutable";
import {SIZE, VSIZE} from "./Constants";
import type {Callback} from "../util/Utils";

const CANVASWIDTH = SIZE;
const CANVASHEIGHT = VSIZE;

interface TimedImage {
  url?: string;
  time?: number;
  last: number;
}

function reduce({last}: TimedImage, url: string | undefined): TimedImage {
  if (!url) return {last};
  const next = new Date().getTime();
  const time = next - last;
  return {url, time, last: next};
}

export default function ImageMaker(): React.ReactElement {
  const [image, setImage] = React.useReducer(reduce, {last: new Date().getTime()});
  const regenerateImage = React.useCallback<Callback<HTMLCanvasElement>>(canvas => genImage(canvas).then(setImage), [setImage]);
  return <div>
    {image.time ? `took ${image.time}ms` : 'loading...'}<br />
    <canvas ref={regenerateImage} id="ripple" width={CANVASWIDTH} height={CANVASHEIGHT} style={{border: '1px solid black'}}></canvas>
    {image.url && <Assimilation image={image.url} />}
  </div>;
}

function color(right: number, up: number): string {
  const [R, G] = col(right, up);
  return `rgb(${R},${G},0)`;
}

function col(right: number, up: number): [number, number] {
  const R = Math.round((right + 1) * 255 / 2);
  const G = Math.round((up + 1) * 255 / 2);
  return [R, G];
}

// Nice ripple when set to scale=50
function verticalRipple(pos: number): string {
  const right = Math.sin(pos * 2 * Math.PI);
  const up = (1 - Math.cos(pos * 2 * Math.PI)) / 2;
  return color(0.2 * right, 0.5 * up);
}

// Nice bulge when set to scale=50
function roundBulge(x: number, y: number): [number, number] {
  const [right, up] = roundBulgeRaw(2 * x - 1, 2 * y - 1);
  return col(right, up);
}

function roundBulgeRaw(x: number, y: number): [number, number] {
  // const R = 1; // If R is bigger I think it will need to be asin(r/R) / asin(1/R) or something??
  const rr = Math.hypot(x, y);
  const r = Math.min(rr, 1);
  // const m = Math.asin(r/R) * 2 / Math.PI - r;
  const m = Math.asin(r) * 2 / Math.PI - r;
  const right = -x * m / rr;
  const up = -y * m / rr;
  return [right, up];
}

function m(r: number) {
  return r >= 1 ? 0 : Math.asin(r) * 2 / Math.PI - r;
}

function roundRipple(xx: number, yy: number): [number, number] {
  const rr = Math.hypot(xx, yy);
  const mm = m(rr) - m(rr * 4 / 3) + m(rr * 2) - m(rr * 4);
  const right = -xx * mm / rr;
  const up = -yy * mm / rr;
  return col(right, up);
}

// Excellent ripple
async function addRoundRipple(ctx: CanvasRenderingContext2D, start: number, gradientWidth: number) {
  const image = ctx.createImageData(gradientWidth, gradientWidth);
  const data = image.data;
  for (const y of Immutable.Range(0, gradientWidth)) {
    for (const x of Immutable.Range(0, gradientWidth)) {
      const [r, g] = roundRipple(2 * x / gradientWidth - 1, 2 * y / gradientWidth - 1);
      const i = 4 * (x + y * gradientWidth);
      data[i] = r;
      data[i + 1] = g;
      //data[i+2] = 0;
      data[i + 3] = 255;
    }
    await (async () => {})();
  }
  ctx.putImageData(image, start, start);
}

export function addRoundBulge(ctx: CanvasRenderingContext2D, start: number, gradientWidth: number) {
  const image = ctx.createImageData(gradientWidth, gradientWidth);
  const data = image.data;
  for (const y of Immutable.Range(0, gradientWidth)) {
    for (const x of Immutable.Range(0, gradientWidth)) {
      const [r, g] = roundBulge(x / gradientWidth, y / gradientWidth);
      const i = 4 * (x + y * gradientWidth);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, start, start);
}

export function addVerticalRipple(ctx: CanvasRenderingContext2D, start: number, gradientWidth: number) {
  const grad = ctx.createLinearGradient(start, 0, start + gradientWidth, 0);
  for (const x of Immutable.Range(0, 1.01, 0.1)) {
    grad.addColorStop(x, verticalRipple(x));
  }

  ctx.fillStyle = grad;
  ctx.fillRect(start, 0, gradientWidth, CANVASHEIGHT);
}

async function genImage(canvas: HTMLCanvasElement): Promise<string | undefined> {
  if (!canvas) return undefined;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = color(0, 0);
  ctx.fillRect(0, 0, CANVASWIDTH, CANVASHEIGHT);

  //addVerticalRipple(ctx, 0, SIZE * 0.1);
  //addRoundBulge(ctx, 0, SIZE);
  await addRoundRipple(ctx, 0, SIZE);

  // 
  // const grad = ctx.createRadialGradient(SIZE / 2, VSIZE / 2, r, SIZE / 2, VSIZE / 2, r + gradientWidth);
  /*for (const start of Immutable.Range(0, SIZE - 0.01, gradientWidth)) {
    addRipple(ctx, start, gradientWidth);
  }*/

  return canvas.toDataURL();
}