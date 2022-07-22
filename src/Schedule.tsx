import * as React from 'react'
import ErrorBoundary from './ErrorBoundary';

interface EventInputProps {
  index: number;
  value: string;
  onChange: (index: number, value: string) => void
}

export function EventInput(props: EventInputProps): JSX.Element {
  return <ErrorBoundary>
    <input className="calendar-event" type="text" value={props.value} onChange={(event) => props.onChange(props.index, event.target.value)}/>
  </ErrorBoundary>;
}