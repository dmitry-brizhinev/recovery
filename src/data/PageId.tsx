import { castToTypedef, StrongTypedef } from "../util/StrongTypedef";

declare const pageid : unique symbol;
export type PageId = StrongTypedef<string, typeof pageid>;

const PageRegex = /^P[a-z][a-z]P[a-z]+$/;

export function checkPageId(id: string) : PageId | null {
  if (PageRegex.test(id)) {
    return castToTypedef<PageId, typeof pageid>(id);
  }
  return null;
}
