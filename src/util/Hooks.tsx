import * as React from 'react'

import { Callback, cancellableDelay, Func } from "./Utils";

export function useCancellable<T>(request: () => Promise<T>, handler: Callback<T>, active: boolean = true) {
  React.useEffect(() => {
    if (!active) return;
    let x = {cancelled: false};
    request().then(response => x.cancelled || handler(response));
    return () => {x.cancelled = true};
  }, [active, request, handler]);
}

export function useCancellableDelay(handler: Func, ms: number, active: boolean = true) {
  React.useEffect(() => {
    if (!active) return;
    return cancellableDelay(handler, ms);
  }, [active, ms, handler]);
}

export function useEventHandler(onUpdate: Callback<string>): React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> {
  return React.useCallback(e => onUpdate(e.target.value), [onUpdate]);
}