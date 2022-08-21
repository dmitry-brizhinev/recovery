import * as Immutable from "immutable";
import {castToTypedef, type StrongTypedef} from "../util/StrongTypedef";

declare const pageid: unique symbol;
export type PageId = StrongTypedef<string, typeof pageid>;

const PageRegex = /^P[a-z][a-z]P$/;

export function checkPageId(id: string): PageId | null {
  if (PageRegex.test(id)) {
    return castToTypedef<typeof pageid, string>(id);
  }
  return null;
}

export function genNewId(current: {has: (id: PageId) => boolean;}): PageId {
  for (const a of Immutable.Range(0, 26)) {
    for (const b of Immutable.Range(0, 26)) {
      const id = checkPageId(`P${String.fromCharCode(97 + a, 97 + b)}P`);
      if (id && !current.has(id)) {
        return id;
      }
    }
  }
  throw new Error('Exhausted PageId pool!');
}
