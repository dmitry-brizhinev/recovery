import * as React from 'react'
import type { Callback } from './Utils';

interface TextareaProps {
  className?: string;
  value: string;
  onChange: Callback<string>;
  spellCheck?: boolean
}

function fromEvent(event: React.ChangeEvent<HTMLTextAreaElement>): string {
  return event.target.value;
}

export default function Textarea({className, value, onChange, spellCheck}: TextareaProps): React.ReactElement {
  const oonChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(fromEvent(e)), [onChange]);
  return <textarea className={className} value={value} onChange={oonChange} spellCheck={spellCheck ?? true}/>;
}

