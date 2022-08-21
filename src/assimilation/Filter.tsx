import * as React from 'react';
import {useCancellableDelay} from '../util/Hooks';
import type {Callback} from '../util/Utils';
import {VSIZE, SIZE, type SvgCoords, GRID} from './Constants';

export const FilterId = 'RippleFilter';


function color(right: number, up: number): string {
  const R = Math.round((right + 1) * 255 / 2);
  const G = Math.round((up + 1) * 255 / 2);
  return `rgb(${R},${G},0)`;
}

// SourceGraphic
//     <animate attributeName="x" values="0;-660;0" dur="5s" repeatCount="indefinite" />
//     <animate attributeName="scale" values="50;-50;50" dur="5s" repeatCount="indefinite" />

export function FilterDefinitions(props: {image: string;}): React.ReactElement {
  return <filter id={FilterId} filterUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={VSIZE}>
    <feFlood x="0" y="0" width={SIZE} height={VSIZE} floodColor={color(0, 0)} floodOpacity="1" result="dispmap" />
    <feImage href={props.image} result="ripple" x="0" y="0" width={SIZE / 2} height={VSIZE / 2}>
      <animate attributeName="x" values="150;0;-300" dur="2s" repeatCount="indefinite" />
      <animate attributeName="y" values="150;0;-300" dur="2s" repeatCount="indefinite" />
      <animate attributeName="width" values="300;600;1200" dur="2s" repeatCount="indefinite" />
      <animate attributeName="height" values="300;600;1200" dur="2s" repeatCount="indefinite" />
    </feImage>

    <feMerge result="merged">
      <feMergeNode in="dispmap" />
      <feMergeNode in="ripple" />
    </feMerge>

    <feDisplacementMap in="SourceGraphic" in2="merged" colorInterpolationFilters="sRGB"
      scale="50" xChannelSelector="R" yChannelSelector="G">
      <animate attributeName="scale" values="50;33;0" dur="2s" repeatCount="indefinite" />
    </feDisplacementMap>
  </filter>;
}

export function SimpleRipple(props: {pos: SvgCoords, id: number, radius?: number, duration?: number, onDone: Callback<number>;}) {
  const {x, y} = props.pos;
  const onDone = props.onDone;
  const r = props.radius ?? 2 * GRID;
  const dur = props.duration ?? 1;
  const done = React.useCallback(() => onDone(props.id), [onDone, props.id]);
  useCancellableDelay(done, dur * 950);
  const d = `${dur}s`;
  const gradName = `rippleGradient${props.id}`;

  const startAnimationRef = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef2 = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef3 = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef4 = React.useCallback((dom: any) => dom?.beginElement(), []);
  const startAnimationRef5 = React.useCallback((dom: any) => dom?.beginElement(), []);
  return <g>
    <defs>
      <radialGradient id={gradName} fr="0%" r="50%">
        <animate ref={startAnimationRef} attributeName="fr" values="0%;25%" dur={d} begin="indefinite" />
        <animate ref={startAnimationRef2} attributeName="r" values="25%;50%" dur={d} begin="indefinite" />

        <stop offset="0%" stopColor="gray" stopOpacity={0} />

        <stop offset="20%" stopColor="gray" stopOpacity={0} />
        <stop offset="30%" stopColor="gray" stopOpacity={0.5}>
          <animate ref={startAnimationRef3} attributeName="stop-opacity" values="0.5;0" dur={d} begin="indefinite" />
        </stop>
        <stop offset="40%" stopColor="gray" stopOpacity={0} />

        <stop offset="50%" stopColor="gray" stopOpacity={0} />
        <stop offset="60%" stopColor="gray" stopOpacity={0.5}>
          <animate ref={startAnimationRef4} attributeName="stop-opacity" values="0.5;0" dur={d} begin="indefinite" />
        </stop>
        <stop offset="70%" stopColor="gray" stopOpacity={0} />

        <stop offset="80%" stopColor="gray" stopOpacity={0} />
        <stop offset="90%" stopColor="gray" stopOpacity={0.5}>
          <animate ref={startAnimationRef5} attributeName="stop-opacity" values="0.5;0" dur={d} begin="indefinite" />
        </stop>
        <stop offset="100%" stopColor="gray" stopOpacity={0} />
      </radialGradient>
    </defs>

    <circle cx={x} cy={y} r={r} fill={`url('#${gradName}')`} />
  </g>;
}