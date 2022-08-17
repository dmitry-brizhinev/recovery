import type * as React from 'react'
import { useEventHandler } from './Hooks';
import type { Callback } from './Utils';

interface TextareaProps {
  className?: string;
  value: string;
  onChange: Callback<string>;
  spellCheck?: boolean
}

export default function Textarea({className, value, onChange, spellCheck}: TextareaProps): React.ReactElement {
  const oonChange = useEventHandler(onChange);
  return <textarea className={className} value={value} onChange={oonChange} spellCheck={spellCheck ?? true}/>;
}

