import {myLexer, mooLexer} from './CustomLexer';
import {myParser} from './MyParser';
import {NearleyParser, Parser} from './NearleyParser';
import {delay, errorString} from '../util/Utils';
import RootExecutor from './Executor';
import RootCompiler from './Compiler';

async function getParser(mine?: boolean): Promise<Parser> {
  if (mine) {
    throw new Error(myParser(myLexer('')));
  }
  return NearleyParser.start(mooLexer());
}

export async function* execute(code: string, compile?: boolean): AsyncGenerator<string, void, void> {
  yield 'Running ...';
  const parser = await getParser();
  const exec = new RootExecutor();
  const comp = new RootCompiler();
  await delay(300);
  for (const line of code.split('\n')) {
    let statements;
    try {
      statements = await parser.parseLine(line + '\n');
    } catch (e: unknown) {
      yield `Parse error <- encountered while parsing ${line}`;
      yield errorString(e);
      return;
    }
    try {
      for (const sta of statements) {
        const r = compile ? comp.compile(sta) : exec.run(sta);
        if (r) yield r;
      }
    }
    catch (e: unknown) {
      yield `${compile ? 'Compile' : 'Runtime'} error <- encountered while ${compile ? 'compiling' : 'executing'} ${line}`;
      yield errorString(e);
      return;
    }
  }
  try {
    await parser.finish();
  } catch (e: unknown) {
    yield errorString(e);
    return;
  }
  yield 'Done.';
  return;
}


