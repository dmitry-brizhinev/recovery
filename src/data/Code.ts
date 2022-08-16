import type { Map as IMap } from 'immutable';

export type CodeId = 'tests' | `${string}.phi`;
export type Code = string;
export type CodeData = IMap<CodeId, Code>;
export type CodeDiff = Map<CodeId, Code | null>;
export const makeCodeDiff: () => CodeDiff = () => new Map();

export function checkCodeId(id: string): CodeId | null {
  if (id === 'tests') return id;
  if (id.endsWith('.phi')) return `${id.slice(0,-4)}.phi`;
  return null;
}