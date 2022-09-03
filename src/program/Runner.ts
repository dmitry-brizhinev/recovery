import {myLexer, mooLexer, type TokenLocation} from './CustomLexer';
import {myParser} from './MyParser';
import {generateTypes, NearleyParser, type Parser} from './NearleyParser';
import {delay, errorString} from '../util/Utils';
import RootExecutor from './Executor';
import RootCompiler from './Compiler';
import {errorToString} from './TsComp';
import {RootPostprocessor, type Statement} from './ParsePostprocessor';
// import Saver, {SaverStatusString} from '../helpers/Saver';

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

/*class Runner {
  private readonly checker: Saver<string>;

  private readonly onUpdate = (status: SaverStatusString) => {
    if (status === SaverStatusString.Saved) {
      return 'ss';
    }
    return '';
  };

  private readonly check = async (_code: string) => {

  };

  onChange(code: string) {
    this.checker.logUpdate(() => code);
  }

  constructor() {
    this.checker = new Saver(this.onUpdate, () => '', this.check);
  }
}
new Runner();*/

export async function genTypes() {
  try {
    return await generateTypes();
  } catch (e) {
    return errorString(e);
  }
}

export async function* execute(code: string, mode: 'check' | {ts: boolean, js: boolean;} | 'run'): AsyncGenerator<string | [string, TokenLocation], void, void> {
  const mmm = (typeof mode === 'string' ? mode : 'compile');
  yield word[mmm].star;
  let parser;
  try {
    parser = await getParser();
  } catch (e) {
    yield myErrorString('parse', 'grammar', e);
    return;
  }
  const post = new RootPostprocessor();
  const exec = new RootExecutor(post.module());
  const comp = new RootCompiler();
  await delay(100);
  for (const [lineNum, line] of code.split('\n').entries()) {
    const lineLoc: TokenLocation = {sl: lineNum, sc: 0, ec: line.length};
    let statements;
    try {
      statements = await parser.parseLine(line + '\n');
    } catch (e: unknown) {
      // e.offset will have the index of the bad token, but that's not super helpful
      yield [myErrorString('parse', line, e), lineLoc];
      return;
    }
    for (const sta of statements) {
      let statement: Statement;
      try {
        statement = post.convert(sta);
      } catch (e) {
        yield [myErrorString('check', line, e), sta.loc ?? lineLoc];
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
        yield [myErrorString(mmm, line, e), sta.loc ?? lineLoc];
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


