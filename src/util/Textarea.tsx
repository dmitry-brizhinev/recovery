import * as React from 'react';
import {assert, type Callback} from './Utils';

type TAE = HTMLTextAreaElement;

interface TextareaProps {
  className?: string;
  value: string;
  onChange: Callback<string>;
  spellCheck?: boolean;
  onScrollChangeOrResize?: Callback<TAE>;
}

export default function Textarea({className, value, onChange: onChangeText, spellCheck, onScrollChangeOrResize}: TextareaProps): React.ReactElement {
  const a = React.useMemo(() => new A(), []);

  const onChange = React.useCallback((e: React.ChangeEvent<TAE>) => {onChangeText(e.target.value); onScrollChangeOrResize?.(e.target);}, [onChangeText, onScrollChangeOrResize]);
  const onScroll = React.useCallback((e: React.UIEvent<TAE>) => onScrollChangeOrResize?.(e.currentTarget), [onScrollChangeOrResize]);
  React.useEffect(() => {a.c = onScrollChangeOrResize;}, [a, onScrollChangeOrResize]);

  return <textarea ref={a.ref} className={className} value={value} onChange={onChange} spellCheck={spellCheck ?? true} onScroll={onScroll} />;
}

class A {
  private e: TAE | undefined;
  private o: ResizeObserver | undefined;
  c: Callback<TAE> | undefined;

  readonly ref: React.RefCallback<TAE> = (e: TAE | null) => {
    this.o?.disconnect();
    this.o = undefined;
    this.e = undefined;
    if (e && this.c) { // Could also rerun this check when changing c
      this.e = e;
      this.o = new ResizeObserver(this.resize);
      this.o.observe(this.e);
    }
  };

  private readonly resize: ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => {
    assert(observer === this.o);
    assert(entries.length === 1);
    const target = entries[0].target;
    assert(target.tagName === 'TEXTAREA');
    assert(target === this.e);
    this.c?.(this.e);
  };
}

