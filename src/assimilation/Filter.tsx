import * as React from 'react'
import { VSIZE, SIZE } from './Constants';

export const FilterId = 'MyFilter';

// SourceGraphic
//     <animate attributeName="x" values="0;-660;0" dur="5s" repeatCount="indefinite" />
//     <animate attributeName="scale" values="50;-50;50" dur="5s" repeatCount="indefinite" />

export function FilterDefinitions(props: {image: string}): React.ReactElement {
  return <filter id={FilterId} filterUnits="userSpaceOnUse" x="0" y="0" width={SIZE*2.1} height={VSIZE}>
    <feImage href={props.image} result="myimage">
      <animate attributeName="x" values="0;-660;0" dur="5s" repeatCount="indefinite" />
    </feImage>
    <feDisplacementMap in="SourceGraphic" in2="myimage" colorInterpolationFilters="sRGB" 
    scale="50" xChannelSelector="R" yChannelSelector="G">
    </feDisplacementMap>
  </filter>;
}