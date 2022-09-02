import type {Map as IMap} from 'immutable';

export type CodeId = `${string}.phi`;
export type Code = string;
export type CodeData = IMap<CodeId, Code>;
export type CodeDiff = Map<CodeId, Code | null>;
export const makeCodeDiff: () => CodeDiff = () => new Map();

export interface CodeUpdate {id: CodeId, data: Code | null;}

export function checkCodeId(id: string): CodeId | null {
  if (id.endsWith('.phi')) return `${id.slice(0, -4)}.phi`;
  return null;
}

export function newCodeId(newId: CodeId, taken: (i: CodeId) => boolean): CodeId {
  while (taken(newId)) {
    newId = `${newId.slice(0, -4)}(c).phi`;
  }
  return newId;
}
