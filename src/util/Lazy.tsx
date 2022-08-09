import * as React from 'react'
import ErrorBoundary from './ErrorBoundary';
import '../css/lazy.css';
import type { Callback } from './Utils';

export function LazyTest(): React.ReactElement {
  const [faststate, setFast] = React.useState<LazyType>('a');
  const slowstate = React.useDeferredValue(faststate);
  const onClick = (t: LazyType) => {
    //startTransition(() => setSlow(t));
    setFast(t);
  }
  return <div className="lazy-test"><ErrorBoundary>
    <React.Suspense fallback={'Suspended...'}>
      <div className="lazy-buttons">
        <LazyTestButton type={'a'} onClick={onClick}/>
        <LazyTestButton type={'b'} onClick={onClick}/>
        <LazyTestButton type={'c'} onClick={onClick}/>
      </div>
      <LazyTestWrapper type={slowstate} target={faststate}/>
    </React.Suspense>
  </ErrorBoundary></div>;
}

function LazyTestButton(props: {type: LazyType, onClick: Callback<LazyType>}): React.ReactElement {
  return <button onClick={() => props.onClick(props.type)}>{props.type}</button>
}

type LazyType = 'a'|'b'|'c';

function LazyTestWrapper(props: {type: LazyType, target: LazyType}): React.ReactElement {
  return <div className="lazy-inner">
    <LazyTestInner type={props.type}/>, {props.target} {props.type}
  </div>;
}

function LazyTestInner(props: {type: LazyType}): React.ReactElement {
  switch(props.type) {
    case 'a':
      return <LLA/>;
    case 'b':
      return <LLB/>;
    case 'c':
      return <LLC/>;
  }
}

function LA() {
  return <React.Suspense fallback={'Suspended A...'}><LLA/></React.Suspense>;
}

function LB() {
  return <React.Suspense fallback={'Suspended B...'}><LLB/></React.Suspense>;
}

function LC() {
  return <React.Suspense fallback={'Suspended C...'}><LLC/></React.Suspense>;
}


function getFactory<T>(x: T) {
  return () => new Promise<{default: T}>(resolve => setTimeout(() => resolve({default: x}), 2000));
}

function getLazy<T extends React.ComponentType<any>>(x:T) {
  return React.lazy(getFactory<T>(x));
}

function LazyInnerA() {
  return <span>AAA!!</span>;
}
function LazyInnerB() {
  return <span>BBB!!</span>;
}
function LazyInnerC() {
  return <span>CCC!!</span>;
}

const LLA = getLazy(LazyInnerA);
const LLB = getLazy(LazyInnerB);
const LLC = getLazy(LazyInnerC);
/*
function lazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): void {}

type CompType = new (p: any) => React.Component<any, any>;

interface LazyProps<T extends CompType> {
  fallback?: React.ReactNode;
  promise: () => T;//Promise<T>;
}

export default function Lazy<T extends CompType>(props: LazyProps<T>): React.ReactElement {
  //const Inner: React.LazyExoticComponent<T> = React.useMemo(() => React.lazy<T>(() => new Promise<{default: T}>(resolve => props.promise().then<void>((t:T) => resolve({'default': t})))), [props.promise]);
  //const Inner = React.lazy<T>(() => new Promise<{default: T}>(resolve => props.promise().then<void>((t:T) => resolve({'default': t}))));
  const Inner = props.promise();
  return <ErrorBoundary><React.Suspense fallback={props.fallback}>
    <Inner />
  </React.Suspense></ErrorBoundary>;
}

export function MyLazy() {

}*/