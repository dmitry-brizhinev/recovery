import * as React from 'react'
import ErrorBoundary from './ErrorBoundary';
import { SuspenseBoundary } from './Loading';
import type { Callback } from './Utils';

type SwitcherState = string;
type SwitcherEntry = readonly [SwitcherState, () => React.ReactNode];
export type SwitcherData = readonly [SwitcherEntry, ...SwitcherEntry[]];

interface SwitcherProps {
  readonly initial?: string;
  readonly data: SwitcherData;
}

export default function Switcher({data, initial}: SwitcherProps): React.ReactElement {
  const [maybeState, setState] = React.useState(initial || '');
  const [state, inner] = data.find(e => e[0] === maybeState) || data[0];

  const buttons = data.map(([name]) => <SwitcherButton key={name} current={state} onClick={setState}>{name}</SwitcherButton>);

  return <ErrorBoundary>
    {buttons}
    <SuspenseBoundary><ErrorBoundary>{inner()}</ErrorBoundary></SuspenseBoundary>
  </ErrorBoundary>;
}

function SwitcherButton(props: {children: SwitcherState, current: SwitcherState, onClick: Callback<SwitcherState>}): React.ReactElement {
  const {children, current, onClick} = props;
  const [pending, startTransition] = React.useTransition();
  const click = React.useCallback(() => startTransition(() => onClick(children)), [children, onClick]);
  return <button disabled={pending || children === current} onClick={click}>{children}</button>
}