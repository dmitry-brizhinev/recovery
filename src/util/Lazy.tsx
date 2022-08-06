import * as React from 'react'
import ErrorBoundary from './ErrorBoundary';


export function LazyTest(): React.ReactElement {
  return <ErrorBoundary><span>LA[{
    <React.Suspense fallback={'waiting'}><LLLL/></React.Suspense>
  }]ZY<br/><br/></span></ErrorBoundary>;
}


function getFactory<T>(x: T) {
  return () => new Promise<{default: T}>(resolve => setTimeout(() => resolve({default: x}), 6000));
}

function getLazy<T extends React.ComponentType<any>>(x:T) {
  return React.lazy(getFactory<T>(x));
}

function LazyInner() {
  return <span>Done!!</span>;
}
const LLLL = getLazy(LazyInner);
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