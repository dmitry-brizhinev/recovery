import * as React from 'react'
import { Callback } from './Utils';

interface TextareaProps {
  className?: string;
  value: string;
  onChange: Callback<string>;
}

function fromEvent(event: React.ChangeEvent<HTMLTextAreaElement>): string {
  return event.target.value;
}

export default function Textarea(props: TextareaProps): React.ReactElement {
  const onChange = props.onChange;
  const oonChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(fromEvent(e)), [onChange]);
  return <textarea className={props.className} value={props.value} onChange={oonChange}/>;
}

