import {myLexer, mooLexer} from './CustomLexer';
import {myParser} from './MyParser';
import {generateTypes, NearleyParser, type Parser} from './NearleyParser';
import {delay, errorString} from '../util/Utils';
import RootExecutor from './Executor';
import RootCompiler from './Compiler';
import {errorToString} from './TsComp';
import {RootPostprocessor, type Statement} from './ParsePostprocessor';

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

export async function genTypes() {
  try {
    return await generateTypes();
  } catch (e) {
    return errorString(e);
  }
}

export async function* execute(code: string, mode: 'check' | {ts: boolean, js: boolean;} | 'run'): AsyncGenerator<string, void, void> {
  const mmm = (typeof mode === 'string' ? mode : 'compile');
  yield word[mmm].star;
  let parser;
  try {
    parser = await getParser();
  } catch (e) {
    yield myErrorString('parse', 'grammar', e);
    return;
  }
  const exec = new RootExecutor();
  const comp = new RootCompiler();
  const post = new RootPostprocessor();
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
      let statement: Statement;
      try {
        statement = post.convert(sta);
      } catch (e) {
        yield myErrorString('check', line, e);
        return;
      }
      try {
        if (mode !== 'check') {
          if (mode === 'run') {
            const rs = exec.run(statement);
            for (const r of rs) yield r;
          } else {
            const r = comp.compile(statement);
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
    yield myErrorString('parse', 'at the end', e);
    return;
  }
  if (mode !== 'run' && mode !== 'check') {
    if (mode.ts) {
      yield '';
    }
    yield 'Compiling TS -> JS';
    yield '';
    const result = await comp.finish();
    for (const e of result.errors) {
      yield errorToString(e);
    }
    if (result.outputText) {
      if (mode.js) {
        yield result.outputText;
      }
      yield 'Executing JS';
      yield '';
      try {
        const rr = eval(result.outputText);
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
  }
  yield 'Done.';
  return;
}


