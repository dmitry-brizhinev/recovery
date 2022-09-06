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

export type RunnerResultType = 'stat' | 'ts' | 'js' | 'out' | 'err';

export interface RunnerResult {
  t: RunnerResultType;
  line: string;
  phiLoc?: TokenLocation;
  tsLoc?: TokenLocation | undefined;
}

const word = {
  check: {star: 'Checking ...', type: 'Type', verb: 'type checking'},
  run: {star: 'Running ...', type: 'Runtime', verb: 'executing'},
  parse: {star: 'Parsing ...', type: 'Parse', verb: 'parsing'},
  compile: {star: 'Compiling ...\n ', type: 'Compile', verb: 'compiling'},
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

export async function genTypes(): Promise<RunnerResult> {
  try {
    return {t: 'out', line: await generateTypes()};
  } catch (e) {
    return {t: 'err', line: errorString(e)};
  }
}

export async function* execute(code: string, mode: 'check' | 'compile' | 'run'): AsyncGenerator<RunnerResult, void, void> {
  const mmm = (typeof mode === 'string' ? mode : 'compile');
  yield {t: 'stat', line: word[mmm].star};
  let parser;
  try {
    parser = await getParser();
  } catch (e) {
    yield {t: 'err', line: myErrorString('parse', 'grammar', e)};
    return;
  }
  const post = new RootPostprocessor();
  const exec = new RootExecutor(post.module());
  const comp = new RootCompiler();
  const lineStarts: number[] = [];
  await delay(100);
  for (const [lineNum, line] of code.split('\n').entries()) {
    const lineLoc: TokenLocation = {sl: lineNum, sc: 0, ec: line.length};
    let statements;
    try {
      statements = await parser.parseLine(line + '\n');
    } catch (e: unknown) {
      // e.offset will have the index of the bad token, but that's not super helpful
      yield {t: 'err', line: myErrorString('parse', line, e), phiLoc: lineLoc};
      return;
    }
    for (const sta of statements) {
      let statement: Statement;
      try {
        statement = post.convert(sta);
      } catch (e) {
        yield {t: 'err', line: myErrorString('check', line, e), phiLoc: sta.loc ?? lineLoc};
        return;
      }
      try {
        if (mode !== 'check') {
          if (mode === 'run') {
            const rs = exec.run(statement);
            for (const r of rs) yield {t: 'out', line: r};
          } else {
            const {ts, start} = comp.compile(statement);
            lineStarts.push(start);
            yield {t: 'ts', line: ts};
          }
        }
      } catch (e) {
        yield {t: 'err', line: myErrorString(mmm, line, e), phiLoc: sta.loc ?? lineLoc};
        return;
      }
    }
  }
  try {
    await parser.finish();
  } catch (e: unknown) {
    yield {t: 'err', line: myErrorString('parse', 'at the end', e)};
    return;
  }
  if (mode !== 'run' && mode !== 'check') {
    yield {t: 'ts', line: ' '};
    yield {t: 'stat', line: 'Compiling TS -> JS\n '};
    const result = await comp.finish();
    for (const e of result.errors) {
      if (e.loc) {
        let lastStart = 0;
        let found = false;
        for (const [line, start] of lineStarts.entries()) {
          if (e.loc.start < start) {
            const sl = line - 1;
            const sc = e.loc.start - lastStart - e.loc.length;
            const ec = sc + e.loc.length;
            const tsLoc = {sl, sc, ec};
            yield {t: 'err', line: errorToString(e), tsLoc};
            found = true;
            break;
          } else {
            lastStart = start;
          }
        }
        if (!found) {
          const sl = lineStarts.length - 1;
          const sc = e.loc.start - lastStart - e.loc.length;
          const ec = sc + e.loc.length;
          const tsLoc = {sl, sc, ec};
          yield {t: 'err', line: errorToString(e), tsLoc};
        }
      }
      else {
        yield {t: 'err', line: errorToString(e)};
      }
    }
    if (result.outputText) {
      yield {t: 'js', line: result.outputText};
      yield {t: 'stat', line: 'Executing JS\n '};
      try {
        const rr = eval(result.outputText);
        const rrr = typeof rr === 'string' ? rr.replaceAll('\\n', '\n') : 'success';
        for (const r of rrr.split('\n')) {
          yield {t: 'out', line: r.length > 50 ? r.slice(0, 50) + '...' : r};
        }
        yield {t: 'out', line: ' '};
      } catch (e) {
        yield {t: 'err', line: errorString(e)};
        return;
      }
    }
  }
  yield {t: 'stat', line: 'Done.'};
  return;
}


