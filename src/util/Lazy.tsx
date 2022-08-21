import * as React from 'react';
import ErrorBoundary from './ErrorBoundary';
import '../css/lazy.css';
import {type Callback, delay, delayRet} from './Utils';

export function LazyTest(): React.ReactElement {
  const [faststate, setFast] = React.useState<LazyType>('a');
  const slowstate = React.useDeferredValue(faststate);
  const onClick = (t: LazyType) => {
    //startTransition(() => setSlow(t));
    setFast(t);
  };
  return <div className="lazy-test"><ErrorBoundary>
    <React.Suspense fallback={'Suspended...'}>
      <div className="lazy-buttons">
        <LazyTestButton type={'a'} onClick={onClick} />
        <LazyTestButton type={'b'} onClick={onClick} />
        <LazyTestButton type={'c'} onClick={onClick} />
      </div>
      <LazyTestWrapper type={slowstate} target={faststate} />
    </React.Suspense>
  </ErrorBoundary></div>;
}

function LazyTestButton(props: {type: LazyType, onClick: Callback<LazyType>;}): React.ReactElement {
  return <button onClick={() => props.onClick(props.type)}>{props.type}</button>;
}

type LazyType = 'a' | 'b' | 'c';

function LazyTestWrapper(props: {type: LazyType, target: LazyType;}): React.ReactElement {
  return <div className="lazy-inner">
    <LazyTestInner type={props.type} />, {props.target} {props.type}
  </div>;
}


function LazyTestInner(props: {type: LazyType;}): React.ReactElement {

  switch (props.type) {
    case 'a':
      return <LLA extra="extra" />;
    case 'b':
      return <LLB />;
    case 'c':
      return <LLC />;
  }
}

function getFactory<T>(x: T) {
  return () => delayRet(2000, {default: x});
}

function getLazy<T extends React.ComponentType<any>>(x: T) {
  return React.lazy(getFactory<T>(x));
}

//function LazyInnerA() {
//  return <span>AAA!!</span>;
//}
function LazyInnerB() {
  return <span>BBB!!</span>;
}
function LazyInnerC() {
  return <span>CCC!!</span>;
}

type TestData = {id: string, payload: string;};

async function getData(id: string): Promise<TestData> {
  await delay(2000);
  return {id, payload: `DATA[${id}]`};
}

function DataDisplay(props: {extra: string, data: TestData;}) {
  return <span>{`E:${props.extra}, D:${props.data.payload}`}</span>;
}


function Unwrapper(Component: typeof DataDisplay, data: TestData, props: any): React.ReactElement {
  return <Component data={data} {...props} />;
}

type FC<T> = (props: T) => React.ReactElement;

async function unwrap(component: typeof DataDisplay, id: string): Promise<{default: FC<any>;}> {
  const promise = getData(id);
  const data = await promise;
  return {default: (Unwrapper).bind(undefined, component, data)};
}

const LLA = React.lazy(() => unwrap(DataDisplay, 'id'));
const LLB = getLazy(LazyInnerB);
const LLC = getLazy(LazyInnerC);

/*
type ValueOf<T> = T[keyof T];

type MapTo<T, U> = {
  [P in keyof T]: U
};

function mapObject<T extends object, U>(mappingFn: (v: ValueOf<T>) => U, obj: T): MapTo<T, U> {
    const newObj = {} as MapTo<T, U>;
    for (const i in obj) {
        if (obj.hasOwnProperty(i)) {
            const oldValue = obj[i];
            newObj[i] = mappingFn(oldValue);
        }
    }
    return newObj;
}*/

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