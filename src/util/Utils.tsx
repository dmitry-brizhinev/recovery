
export function pad2(num: number): string {
  return num.toString().padStart(2, '0');
}

export type Callback<T> = (x: T) => void;
export type Func = () => void;

type NamedGroups = {[key: string]: string | undefined};
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