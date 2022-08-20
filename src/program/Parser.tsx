import {myLexer, mooLexer} from './CustomLexer';
import {myParser} from './MyParser';
import {NearleyParser, Parser} from './NearleyParser';
import {delay, errorString} from '../util/Utils';
import RootExecutor from './Executor';
import RootCompiler from './Compiler';
import RootTypeChecker from './TypeChecker';

async function getParser(mine?: boolean): Promise<Parser> {
  if (mine) {
    throw new Error(myParser(myLexer('')));
  }
  return NearleyParser.start(mooLexer());
}

const word = {
  check: {star: 'Checking ...', type: 'Type', verb: 'type checking'},
  run: {star: 'Running ...', type: 'Runtime', verb: 'executing'},
  parse: {star: 'Parsing ...', type: 'Parse', verb: 'parsing'},
  compile: {star: 'Compiling ...\n', type: 'Compile', verb: 'compiling'},
} as const;

function myErrorString(mmm: 'check' | 'run' | 'parse' | 'compile', line: string, e: unknown): string {
  return `${word[mmm].type} error <- encountered while ${word[mmm].verb} ${line}\n${errorString(e)}`;
}

export async function* execute(code: string, mode: 'check' | {ts: boolean, js: boolean;} | 'run'): AsyncGenerator<string, void, void> {
  const mmm = (typeof mode === 'string' ? mode : 'compile');
  yield word[mmm].star;
  const parser = await getParser();
  const exec = new RootExecutor();
  const comp = new RootCompiler();
  const chec = new RootTypeChecker();
  await delay(100);
  for (const line of code.split('\n')) {
    let statements;
    try {
      statements = await parser.parseLine(line + '\n');
    } catch (e: unknown) {
      yield myErrorString('parse', line, e);
      return;
    }
    for (const sta of statements) {
      try {
        chec.check(sta);
      } catch (e) {
        yield myErrorString('check', line, e);
        return;
      }
      try {
        if (mode !== 'check') {
          if (mode === 'run') {
            const r = exec.run(sta);
            if (r) yield r;
          } else {
            const r = comp.compile(sta);
            if (mode.ts && r) yield r;
          }
        }
      } catch (e) {
        yield myErrorString(mmm, line, e);
        return;
      }
    }
  }
  try {
    await parser.finish();
  } catch (e: unknown) {
    yield myErrorString('parse', '', e);
    return;
  }
  if (mode !== 'run' && mode !== 'check') {
    if (mode.ts) {
      yield '';
    }
    yield 'Compiling TS -> JS';
    yield '';
    const result = comp.finish();
    if (mode.js) {
      yield result;
    }
    yield 'Executing JS';
    yield '';
    try {
      const rr = eval(result);
      const rrr = typeof rr === 'string' ? rr.replaceAll('\\n', '\n') : 'success';
      for (const r of rrr.split('\n')) {
        yield r.length > 50 ? r.slice(0, 50) + '...' : r;
      }
      yield '';
    } catch (e) {
      yield errorString(e);
      return;
    }
  }
  yield 'Done.';
  return;
}


