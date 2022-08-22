
export function pad2(num: number): string {
  return num.toString().padStart(2, '0');
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function delayRet<T>(ms: number, val: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(val), ms));
}

export function cancellableDelay(f: Func, ms: number): Func {
  const cancel = setTimeout(f, ms);
  return () => clearTimeout(cancel);
}

export type Callback<T> = (x: T) => void;
export type Func = () => void;
export type Getter<T> = () => T;

type NamedGroups = {[key: string]: string | undefined;};
export function extractNamedGroups(regex: RegExp, match: string): NamedGroups | undefined {
  const result = regex.exec(match);
  if (!result) return undefined;
  return result.groups || {};
}

export interface Day {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function unreachable(x: never, s?: string): never {
  throw new Error(`Unreachable code reached! ${s} ${x}`);
}

export function assert(x: unknown, message?: string, extraData?: unknown): asserts x {
  if (x) return;
  const m = (message ?? `Assertion failed; ${x} is falsy`) + (extraData == null ? '' : ` ${JSON.stringify(extraData)}`);
  throw new Error(m);
}

export function assertNonNull(x: unknown, message?: string): asserts x is {} {
  assert(x != null, message);
}

export function throwIfNull<T>(x: T | null | undefined, message?: string): T {
  assertNonNull(x, message);
  return x;
}


interface L<T> {
  v?: T;
  (): T;
}

export function makeLazySingleton<T>(initialiser: Getter<T>): Getter<T> {
  const x: L<T> = () => x.v ?? (x.v = initialiser());
  return x;
}

export function errorString(e: unknown): string {
  return e instanceof Error ? (e.stack || `${e.name}: ${e.message}`) : JSON.stringify(e);
}

export function numToLetter(start: 'a' | 'A', ...nums: number[]): string {
  const k = start === 'a' ? 97 : 65;
  return String.fromCharCode(...nums.map(n => n + k));
}