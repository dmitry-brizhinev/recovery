import { myLexer, mooLexer } from './CustomLexer';
import { myParser } from './MyParser';
import { Doc, nearleyParser } from './NearleyParser';

export default async function parse(code: string, mine?: boolean): Promise<Doc> {
  if (mine) {
    throw new Error(myParser(myLexer(code)));
  }
  return nearleyParser(code, mooLexer());
}


